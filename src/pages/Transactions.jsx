import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { useMonth } from '../contexts/MonthContext'
import { supabase } from '../lib/supabaseClient'
import { ensureBudgetExists } from '../utils/budgetUtils'
import { formatCurrency } from '../utils/formatCurrency'
import MonthPicker from '../components/MonthPicker'
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Receipt, SearchX, Edit2, Trash2, X } from 'lucide-react'

export default function Transactions() {
  const { user } = useAuth()
  const { triggerRefresh, refreshTrigger } = useRefresh()
  const { selectedMonth } = useMonth()
  
  // Data State
  const [cashAccounts, setCashAccounts] = useState([])
  const [budgetPos, setBudgetPos] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [editId, setEditId] = useState(null)
  const [type, setType] = useState('out')
  const [amount, setAmount] = useState('')
  const [selectedPosId, setSelectedPosId] = useState('')
  const [selectedSubItemId, setSelectedSubItemId] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  
  const getDefaultDate = () => {
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    // If selected month is same as true current month, use today's exact date
    if (selectedMonth === currentMonth) {
      return today.toLocaleDateString('en-CA') 
    }
    // Else default to exactly selectedMonth (the 1st)
    return selectedMonth
  }

  const [date, setDate] = useState(getDefaultDate())
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Every time selectedMonth changes, change the fallback date on form
  useEffect(() => {
    if (!editId) {
      setDate(getDefaultDate())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  useEffect(() => {
    if (user && selectedMonth) {
      loadInitialData()
    }
  }, [user, refreshTrigger, selectedMonth])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      
      const currentMonthPos = selectedMonth
      const d = new Date(selectedMonth)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const startDate = selectedMonth
      const endDate = new Date(year, month, 0).toLocaleDateString('en-CA')

      // 1. Fetch Accounts
      const accPromise = supabase.from('cash_accounts').select('*').order('name')
      // 2. Fetch or seed Budget
      const posPromise = ensureBudgetExists(user.id, currentMonthPos)
      // 3. Fetch Transaction History inside this month boundary
      const histPromise = supabase.from('transactions').select(`
          *,
          cash_account:cash_accounts(name),
          budget_sub_item:budget_sub_items(id, name, budget_pos:budget_pos(id, name))
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(20) // show up to 20 instead

      const [accountsRes, posData, historyRes] = await Promise.all([accPromise, posPromise, histPromise])

      if (accountsRes.error) throw accountsRes.error
      if (historyRes.error) throw historyRes.error

      setCashAccounts(accountsRes.data || [])
      setBudgetPos(posData || [])
      setHistory(historyRes.data || [])

      if (!editId && accountsRes.data && accountsRes.data.length > 0) {
         setSelectedAccountId(accountsRes.data[0].id)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (newType) => {
    setType(newType)
    setSelectedPosId('')
    setSelectedSubItemId('')
  }
  
  const resetForm = () => {
    setEditId(null)
    setAmount('')
    setNotes('')
    setSelectedPosId('')
    setSelectedSubItemId('')
    setDate(getDefaultDate())
    if (cashAccounts.length > 0) setSelectedAccountId(cashAccounts[0].id)
  }

  const handleEditClick = (trx) => {
    setEditId(trx.id)
    setType(trx.type)
    setAmount(trx.amount)
    
    // Attempt to guess selectedPosId by finding the pos holding this sub item
    const parentPos = budgetPos.find(p => p.budget_sub_items.some(s => s.id === trx.budget_sub_item_id))
    if (parentPos) {
       setSelectedPosId(parentPos.id)
       setSelectedSubItemId(trx.budget_sub_item_id)
    } else {
       setSelectedPosId('')
       setSelectedSubItemId('')
    }
    
    setSelectedAccountId(trx.cash_account_id)
    setDate(trx.date)
    setNotes(trx.notes || '')
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filteredPos = budgetPos.filter(pos => pos.type === (type === 'in' ? 'income' : 'expense'))
  const selectedPos = budgetPos.find(p => p.id === selectedPosId)
  const filteredSubItems = selectedPos ? selectedPos.budget_sub_items : []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || !selectedSubItemId || !selectedAccountId || !date) return

    setIsSubmitting(true)
    try {
      const payload = {
        user_id: user.id,
        amount: parseFloat(amount),
        type: type,
        budget_sub_item_id: selectedSubItemId,
        cash_account_id: selectedAccountId,
        date: date,
        notes: notes || null
      }

      if (editId) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editId)
        if (error) throw error
        alert('Transaksi berhasil di-update!')
      } else {
        const { error } = await supabase.from('transactions').insert([payload])
        if (error) throw error
        alert('Transaksi berhasil dicatat!')
      }
      
      triggerRefresh() // refreshes both transactions history & dashboard
      resetForm()
    } catch (err) {
      console.error('Error input transaction:', err)
      alert('Gagal menyimpan transaksi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus transaksi ini? Saldo rekening akan dikembalikan berdasarkan nilai ini.")) return
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      triggerRefresh()
    } catch (err) {
      console.error('Error deleting transaction:', err)
      alert("Gagal menghapus transaksi.")
    }
  }

  const formatDisplayDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="pt-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaksi</h1>
          <p className="text-sm text-gray-500">Catat pemasukan dan pengeluaran</p>
        </div>
        <MonthPicker />
      </header>

      {/* Form Input */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden animate-in fade-in slide-in-from-top-4">
        {editId && (
          <div className="absolute top-0 w-full left-0 bg-yellow-50 text-yellow-800 text-xs px-5 py-2.5 font-bold flex justify-between items-center border-b border-yellow-100">
            MENGUBAH TRANSAKSI
            <button onClick={resetForm} className="text-yellow-700 hover:text-yellow-900 bg-yellow-200 p-0.5 rounded-full"><X size={14}/></button>
          </div>
        )}

        <div className={`flex bg-gray-100 p-1 rounded-xl mb-5 ${editId ? 'mt-6' : ''}`}>
          <button
            onClick={() => handleTypeChange('out')}
            className={`flex-1 flex justify-center items-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              type === 'out' 
              ? 'bg-white text-red-500 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
          >
             <ArrowUpRight size={16} /> Pengeluaran
          </button>
          <button
            onClick={() => handleTypeChange('in')}
            className={`flex-1 flex justify-center items-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              type === 'in' 
              ? 'bg-white text-[var(--color-primary)] shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
          >
             <ArrowDownRight size={16} /> Pemasukan
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Pos Anggaran</label>
               <select 
                 value={selectedPosId}
                 onChange={(e) => {
                   setSelectedPosId(e.target.value)
                   setSelectedSubItemId('')
                 }}
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                 required
               >
                 <option value="" disabled>Pilih Pos</option>
                 {filteredPos.map(pos => (
                   <option key={pos.id} value={pos.id}>{pos.name}</option>
                 ))}
               </select>
             </div>

             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Sub-Akun</label>
               <select 
                 value={selectedSubItemId}
                 onChange={(e) => setSelectedSubItemId(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50"
                 required
                 disabled={!selectedPosId || filteredSubItems.length === 0}
               >
                 <option value="" disabled>
                   {!selectedPosId ? 'Pilih Pos dulu' : filteredSubItems.length === 0 ? 'Kosong' : 'Pilih Sub-akun'}
                 </option>
                 {filteredSubItems.map(subItem => (
                   <option key={subItem.id} value={subItem.id}>{subItem.name}</option>
                 ))}
               </select>
             </div>
          </div>

          <div>
             <label className="block text-xs font-semibold text-gray-500 mb-1">Nominal</label>
             <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-medium">Rp</span>
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                  required
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Rekening / Dana</label>
               <select 
                 value={selectedAccountId}
                 onChange={(e) => setSelectedAccountId(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                 required
               >
                 <option value="" disabled>Pilih Rekening</option>
                 {cashAccounts.map(acc => (
                   <option key={acc.id} value={acc.id}>{acc.name}</option>
                 ))}
               </select>
             </div>

             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Tanggal</label>
               <input 
                 type="date"
                 value={date}
                 onChange={(e) => setDate(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-medium text-gray-700"
                 required
               />
             </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Catatan Tambahan</label>
             <input 
               type="text"
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="Opsional"
               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
             />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !selectedSubItemId || !selectedAccountId || !amount}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-2 text-white shadow-sm border border-transparent
              ${isSubmitting || !selectedSubItemId || !amount ? 'opacity-50 cursor-not-allowed bg-gray-400' : 
                editId ? 'bg-yellow-500 hover:bg-yellow-600' :
                type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-900 hover:bg-gray-800'
              }`
            }
          >
             <CheckCircle2 size={18} />
             {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Catat Transaksi'}
          </button>

        </form>
      </div>

      {/* Riwayat */}
      <div className="space-y-3 pt-2">
        <h3 className="font-semibold text-gray-900 text-sm pl-1 flex items-center gap-2">
           <Receipt size={18} className="text-[var(--color-primary)]" />
           Transaksi Bulan Ini
        </h3>

        {loading ? (
           <p className="text-center text-sm text-gray-400 py-4">Memuat riwayat...</p>
        ) : history.length === 0 ? (
           <div className="p-6 text-center text-gray-500 bg-white border border-gray-100 rounded-2xl flex flex-col items-center">
             <SearchX size={32} className="text-gray-300 mb-2" />
             <p className="text-sm">Belum ada transaksi di bulan ini</p>
           </div>
        ) : (
           <div className="space-y-2">
              {history.map(trx => (
                 <div key={trx.id} className="flex flex-col bg-white p-3.5 rounded-2xl shadow-sm border border-gray-50 overflow-hidden group">
                   <div className="flex justify-between items-center bg-white">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                          ${trx.type === 'in' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}
                        `}>
                          {trx.type === 'in' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {trx.budget_sub_item?.name || 'Sub-akun ID dihapus'}
                          </p>
                          <p className="text-[11px] text-gray-500 w-[120px] sm:w-full truncate">
                            {trx.cash_account?.name} • {formatDisplayDate(trx.date)}
                          </p>
                        </div>
                     </div>
                     <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${trx.type === 'in' ? 'text-emerald-500' : 'text-red-500'}`}>
                           {trx.type === 'in' ? '+' : '-'} {formatCurrency(trx.amount)}
                        </p>
                        {trx.notes && <p className="text-[10px] text-gray-400 truncate max-w-[80px]">{trx.notes}</p>}
                     </div>
                   </div>
                   
                   <div className="mt-2 flex justify-end gap-1.5 border-t border-gray-50 pt-2 opacity-100">
                     <button onClick={() => handleEditClick(trx)} className="flex items-center gap-1 text-[11px] px-2 py-1 bg-gray-50 border border-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                       <Edit2 size={12}/> Edit
                     </button>
                     <button onClick={() => handleDelete(trx.id)} className="flex items-center gap-1 text-[11px] px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                       <Trash2 size={12}/> Hapus
                     </button>
                   </div>
                 </div>
              ))}
           </div>
        )}
      </div>

    </div>
  )
}
