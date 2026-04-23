import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMonth } from '../contexts/MonthContext'
import { supabase } from '../lib/supabaseClient'
import { ensureBudgetExists } from '../utils/budgetUtils'
import { formatCurrency } from '../utils/formatCurrency'
import MonthPicker from '../components/MonthPicker'
import { Plus, Save, Trash2 } from 'lucide-react'

export default function Budget() {
  const { user } = useAuth()
  const { selectedMonth } = useMonth()
  const [budgetPos, setBudgetPos] = useState([])
  const [loading, setLoading] = useState(true)
  
  // State for updating budget_amount per SUB ITEM
  const [subItemAmounts, setSubItemAmounts] = useState({})
  const [savingSubItemId, setSavingSubItemId] = useState(null)

  // State for adding new sub-items
  const [addingSubItemId, setAddingSubItemId] = useState(null)
  const [newSubItemName, setNewSubItemName] = useState('')

  useEffect(() => {
    if (user && selectedMonth) {
      loadBudgetPos()
    }
  }, [user, selectedMonth])

  const loadBudgetPos = async () => {
    try {
      setLoading(true)
      // Call our centralized utility
      const data = await ensureBudgetExists(user.id, selectedMonth)
      initSubItemAmounts(data)
      setBudgetPos(data)
    } catch (err) {
      console.error('Error loading budgets:', err)
      alert("Gagal memuat anggaran.")
    } finally {
      setLoading(false)
    }
  }

  // Initialize input state for ALL sub items
  const initSubItemAmounts = (posArray) => {
    const initialAmounts = {}
    posArray.forEach(pos => {
      pos.budget_sub_items?.forEach(sub => {
        initialAmounts[sub.id] = sub.budget_amount || ''
      })
    })
    setSubItemAmounts(initialAmounts)
  }

  const handleUpdateSubItemAmount = async (subItemId, posId) => {
    setSavingSubItemId(subItemId)
    try {
      const amountVal = parseFloat(subItemAmounts[subItemId]) || 0
      const { error } = await supabase
        .from('budget_sub_items')
        .update({ budget_amount: amountVal })
        .eq('id', subItemId)

      if (error) throw error
      
      // Update local state deeply
      setBudgetPos(prev => prev.map(p => {
        if (p.id === posId) {
          return {
            ...p,
            budget_sub_items: p.budget_sub_items.map(sub => 
              sub.id === subItemId ? { ...sub, budget_amount: amountVal } : sub
            )
          }
        }
        return p
      }))
      
    } catch (err) {
      console.error('Error updating amount:', err)
      alert('Gagal menyimpan nilai anggaran sub-akun.')
    } finally {
      setSavingSubItemId(null)
    }
  }

  const handleAddSubItem = async (e, posId) => {
    e.preventDefault()
    if (!newSubItemName) return

    try {
      const { data, error } = await supabase
        .from('budget_sub_items')
        .insert([{
          budget_pos_id: posId,
          name: newSubItemName,
          budget_amount: 0 // initial budget amount is 0
        }])
        .select('id, name, budget_amount')

      if (error) throw error

      setSubItemAmounts(prev => ({...prev, [data[0].id]: ''}))

      setBudgetPos(prev => prev.map(p => {
        if (p.id === posId) {
          return {
            ...p,
            budget_sub_items: [...(p.budget_sub_items || []), data[0]]
          }
        }
        return p
      }))
      
      setAddingSubItemId(null)
      setNewSubItemName('')
    } catch (err) {
      console.error('Error adding sub item:', err)
      alert('Gagal manambah sub-akun.')
    }
  }

  const handleDeleteSubItem = async (subItemId, posId) => {
    if(!window.confirm("Hapus sub-akun ini selamanya?")) return;
    try {
      const { error } = await supabase.from('budget_sub_items').delete().eq('id', subItemId)
      if (error) throw error

      setBudgetPos(prev => prev.map(p => {
        if (p.id === posId) {
          return {
            ...p,
            budget_sub_items: p.budget_sub_items.filter(s => s.id !== subItemId)
          }
        }
        return p
      }))
    } catch (err) {
      console.error('Error deleting sub-item:', err)
    }
  }

  const d = new Date(selectedMonth)
  const currentMonthName = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' })
  
  // Total Anggaran Gabungan
  const totalAnggaranIncome = budgetPos.filter(p => p.type === 'income').reduce((sum, pos) => {
    const posTotal = pos.budget_sub_items?.reduce((s, item) => s + Number(item.budget_amount || 0), 0) || 0
    return sum + posTotal
  }, 0)

  const totalAnggaranExpense = budgetPos.filter(p => p.type === 'expense').reduce((sum, pos) => {
    const posTotal = pos.budget_sub_items?.reduce((s, item) => s + Number(item.budget_amount || 0), 0) || 0
    return sum + posTotal
  }, 0)

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="pt-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anggaran</h1>
          <p className="text-xs text-gray-500 mt-0.5">Periode: {currentMonthName}</p>
        </div>
        <MonthPicker />
      </header>

      {/* Ringkasan Anggaran */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="glass p-4 rounded-2xl border border-blue-100 bg-blue-50/50 flex flex-col justify-center">
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Total Pemasukan</p>
          <p className="text-lg font-extrabold text-blue-900">{formatCurrency(totalAnggaranIncome)}</p>
        </div>
        <div className="glass p-4 rounded-2xl border border-orange-100 bg-orange-50/50 flex flex-col justify-center">
          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">Total Pengeluaran</p>
          <p className="text-lg font-extrabold text-orange-900">{formatCurrency(totalAnggaranExpense)}</p>
        </div>
      </div>

      {totalAnggaranIncome >= totalAnggaranExpense && totalAnggaranIncome > 0 && (
         <div className="text-center text-xs font-medium text-emerald-600 bg-emerald-50 py-2 rounded-xl border border-emerald-100 mb-4 shadow-sm">
            ✨ Anggaran Anda Sehat (Surplus)
         </div>
      )}
      {totalAnggaranIncome < totalAnggaranExpense && (
         <div className="text-center text-xs font-medium text-red-600 bg-red-50 py-2 rounded-xl border border-red-100 mb-4 shadow-sm">
            ⚠️ Anggaran Defisit (Pengeluaran &gt; Pemasukan)
         </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {budgetPos.map(pos => {
             const subItems = pos.budget_sub_items || []
             const posTotalAnggaran = subItems.reduce((acc, current) => acc + Number(current.budget_amount || 0), 0)
             
             return (
              <div key={pos.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                
                {/* Header Pos Utama */}
                <div className="p-4 border-b border-gray-50 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${pos.type === 'income' ? 'bg-blue-500' : 'bg-orange-400'}`}></span>
                      {pos.name}
                    </h3>
                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {pos.type === 'income' ? 'Masuk' : 'Keluar'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium pl-4">
                    Total Anggaran Pos: <span className="text-gray-900 font-bold">{formatCurrency(posTotalAnggaran)}</span>
                  </p>
                </div>

                {/* Sub Items List Body */}
                <div className="p-4 bg-gray-50/50">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-Akun Utama</p>
                    {addingSubItemId !== pos.id && (
                      <button 
                        onClick={() => setAddingSubItemId(pos.id)}
                        className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg shadow-sm"
                      >
                        <Plus size={14} /> Tambah
                      </button>
                    )}
                  </div>

                  {/* Form Tambah Nama Sub Akun Baru */}
                  {addingSubItemId === pos.id && (
                    <div className="mb-4 bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
                       <input 
                          type="text"
                          autoFocus
                          placeholder="Ketik Nama Sub-Akun Baru..."
                          value={newSubItemName}
                          onChange={(e) => setNewSubItemName(e.target.value)}
                          className="text-sm bg-gray-50 border-gray-100 border rounded outline-none p-2 w-full focus:border-emerald-500 focus:ring-1"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setAddingSubItemId(null); setNewSubItemName(''); }}
                            className="flex-1 text-xs py-2 text-gray-600 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Batal
                          </button>
                          <button 
                            onClick={(e) => handleAddSubItem(e, pos.id)}
                            className="flex-1 text-xs py-2 bg-[var(--color-primary)] text-white rounded-lg font-medium transition-colors"
                          >
                            Buat Akun
                          </button>
                        </div>
                    </div>
                  )}

                  {/* Jejeran Sub Akun */}
                  <div className="space-y-3">
                    {subItems.length > 0 ? (
                      subItems.map(subItem => (
                        <div key={subItem.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2 transition-all hover:border-emerald-100">
                          <div className="flex justify-between items-center text-sm font-semibold text-gray-800">
                             <span>{subItem.name}</span>
                             <button onClick={() => handleDeleteSubItem(subItem.id, pos.id)} className="text-gray-300 hover:text-red-500">
                               <Trash2 size={16} />
                             </button>
                          </div>
                          <div className="flex flex-row gap-2 items-center">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2 text-gray-400 text-xs">Rp</span>
                              <input 
                                type="number" 
                                value={subItemAmounts[subItem.id] !== undefined ? subItemAmounts[subItem.id] : ''} 
                                onChange={(e) => setSubItemAmounts({...subItemAmounts, [subItem.id]: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 transition-all"
                                placeholder="Anggaran"
                              />
                            </div>
                            <button 
                              onClick={() => handleUpdateSubItemAmount(subItem.id, pos.id)}
                              disabled={savingSubItemId === subItem.id}
                              className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center min-w-[75px] disabled:opacity-50"
                            >
                              {savingSubItemId === subItem.id ? '...' : <><Save size={14} className="mr-1"/> Simpan</>}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">Pos ini belum memiliki sub-akun.</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
