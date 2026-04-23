import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency } from '../utils/formatCurrency'
import { ShieldCheck, LogOut, Wallet, Plus, Save, Trash2, Edit2, X } from 'lucide-react'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { triggerRefresh } = useRefresh()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  
  // Form State
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [editId, setEditId] = useState(null)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')

  useEffect(() => {
    if (user) {
      loadAccounts()
    }
  }, [user])

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from('cash_accounts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading accounts:', error)
    } else {
      setAccounts(data)
    }
  }

  const resetForm = () => {
    setEditId(null)
    setNewAccountName('')
    setNewAccountBalance('')
    setIsFormVisible(false)
  }

  const handleEditClick = (acc) => {
    setEditId(acc.id)
    setNewAccountName(acc.name)
    setNewAccountBalance(acc.balance)
    setIsFormVisible(true)
  }

  const handleSaveAccount = async (e) => {
    e.preventDefault()
    if (!newAccountName || !newAccountBalance) return

    setLoading(true)
    const payload = {
      user_id: user.id,
      name: newAccountName,
      balance: parseFloat(newAccountBalance)
    }

    try {
      if (editId) {
        // Mode Update
        const { error } = await supabase
          .from('cash_accounts')
          .update(payload)
          .eq('id', editId)

        if (error) throw error
        setAccounts(prev => prev.map(a => a.id === editId ? { ...a, ...payload } : a))
      } else {
        // Mode Insert
        const { data, error } = await supabase
          .from('cash_accounts')
          .insert([payload])
          .select()

        if (error) throw error
        setAccounts([data[0], ...accounts])
      }
      triggerRefresh()
      resetForm()
    } catch (err) {
      console.error('Error saving account:', err)
      alert("Gagal menyimpan akun.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async (id) => {
    if(!window.confirm("Yakin ingin menghapus rekening ini?")) return;
    try {
      const { error } = await supabase.from('cash_accounts').delete().eq('id', id)
      if (error) throw error
      setAccounts(accounts.filter(acc => acc.id !== id))
      triggerRefresh()
    } catch(err) {
      console.error('delete error:', err)
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0)

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="pt-4">
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500">Kelola akun dan dompet Anda</p>
      </header>

      {/* Profil Tipe Akun */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center font-bold text-lg">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-gray-900 text-sm truncate">{user?.email}</p>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 mt-0.5">
              <ShieldCheck size={14} /> Terverifikasi
            </p>
          </div>
        </div>
        <button 
          onClick={signOut}
          className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="border-t border-gray-200"></div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-lg font-bold text-gray-900">Dompet & Rekening</h2>
          {!isFormVisible && (
            <button 
              onClick={() => setIsFormVisible(true)}
              className="text-[var(--color-primary)] text-xs font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100"
            >
              <Plus size={14} /> Tambah Baru
            </button>
          )}
        </div>

        {/* Ringkasan Akumulasi Portofolio - Teks High Contrast Poin 4 */}
        <div className="glass p-5 rounded-2xl flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-sm relative overflow-hidden">
           <Wallet className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500" size={80} />
           <div>
             <p className="text-emerald-700/80 text-xs font-semibold uppercase tracking-wider mb-1">Total Saldo Gabungan</p>
             <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalBalance)}</p>
           </div>
        </div>

        {/* Form Insert/Update Rekening */}
        {isFormVisible && (
          <form onSubmit={handleSaveAccount} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-800 border-b-2 border-emerald-400 pb-1 inline-block">
                {editId ? 'Edit Rekening' : 'Rekening Baru'}
              </h3>
              <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-700 bg-gray-100 rounded-full p-1">
                 <X size={14} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Bank / Dompet</label>
                <input 
                  type="text" 
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Contoh: Bank BCA" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Saldo</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">Rp</span>
                  <input 
                    type="number" 
                    value={newAccountBalance}
                    onChange={(e) => setNewAccountBalance(e.target.value)}
                    placeholder="0" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[var(--color-primary)] text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={16} /> {loading ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Rekening'}
              </button>
            </div>
          </form>
        )}

        {/* Master Data Rekening */}
        <div className="space-y-2 mt-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">Belum ada rekening tertaut.</p>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-emerald-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0 border border-gray-100">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-800">{acc.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(acc.balance)}</p>
                  </div>
                </div>
                
                <div className="flex bg-gray-50 rounded-lg p-1">
                   <button onClick={() => handleEditClick(acc)} className="p-1.5 text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                      <Edit2 size={14} />
                   </button>
                   <button onClick={() => handleDeleteAccount(acc.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
