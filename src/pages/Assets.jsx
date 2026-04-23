import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency } from '../utils/formatCurrency'
import { Briefcase, Plus, Save, Trash2, Edit2, TrendingUp, TrendingDown, X } from 'lucide-react'

const ASSET_TYPES = ['SAHAM', 'CRYPTO', 'PROPERTI', 'LAINNYA']

export default function Assets() {
  const { user } = useAuth()
  
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [editId, setEditId] = useState(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('SAHAM')
  const [quantity, setQuantity] = useState('')
  const [acquisitionCost, setAcquisitionCost] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormVisible, setIsFormVisible] = useState(false)

  useEffect(() => {
    if (user) loadAssets()
  }, [user])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAssets(data || [])
    } catch (err) {
      console.error('Error loading assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditId(null)
    setName('')
    setType('SAHAM')
    setQuantity('')
    setAcquisitionCost('')
    setCurrentPrice('')
    setIsFormVisible(false)
  }

  const handleEditClick = (asset) => {
    setEditId(asset.id)
    setName(asset.name)
    setType(asset.type)
    setQuantity(asset.quantity)
    setAcquisitionCost(asset.acquisition_cost)
    setCurrentPrice(asset.current_price_per_unit)
    setIsFormVisible(true)
    // scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !quantity || !acquisitionCost || !currentPrice) return

    setIsSubmitting(true)
    const payload = {
      user_id: user.id,
      name,
      type,
      quantity: parseFloat(quantity),
      acquisition_cost: parseFloat(acquisitionCost),
      current_price_per_unit: parseFloat(currentPrice),
      updated_at: new Date().toISOString()
    }

    try {
      if (editId) {
        // Mode Update
        const { error } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editId)

        if (error) throw error
        
        setAssets(prev => prev.map(a => a.id === editId ? { ...a, ...payload } : a))
        alert('Aset berhasil diperbarui!')
      } else {
        // Mode Insert
        const { data, error } = await supabase
          .from('assets')
          .insert([payload])
          .select()

        if (error) throw error
        setAssets([data[0], ...assets])
        alert('Aset berhasil ditambahkan!')
      }
      resetForm()
    } catch (err) {
      console.error('Error saving asset:', err)
      alert('Gagal menyimpan aset.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Sungguh ingin menghapus catatan aset ini?")) return
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id)
      if (error) throw error
      setAssets(assets.filter(a => a.id !== id))
    } catch (err) {
      console.error('Error deleting asset:', err)
      alert('Gagal menghapus aset.')
    }
  }

  // Agregate Top Bar Stats
  const totalValuation = assets.reduce((sum, a) => sum + (Number(a.quantity) * Number(a.current_price_per_unit)), 0)
  const totalCost = assets.reduce((sum, a) => sum + (Number(a.quantity) * Number(a.acquisition_cost)), 0)
  const totalFloatingProfit = totalValuation - totalCost

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="pt-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aset & Investasi</h1>
          <p className="text-sm text-gray-500">Kelola portofolio kekayaan Anda</p>
        </div>
      </header>

      {/* Ringkasan Akumulasi Portofolio */}
      <div className="glass p-5 rounded-2xl flex flex-col justify-center text-center bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-sm relative overflow-hidden">
        <Briefcase size={80} className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500" />
        <p className="text-emerald-700/80 text-xs font-semibold uppercase tracking-widest mb-1">Total Nilai Portofolio</p>
        <h2 className="text-3xl font-bold text-emerald-900">{formatCurrency(totalValuation)}</h2>
        
        <div className="mt-3 flex justify-center items-center gap-4 text-xs font-medium">
           <div>
             <span className="text-emerald-700/70 block">Modal:</span>
             <span className="text-emerald-800">{formatCurrency(totalCost)}</span>
           </div>
           <div className={`px-2 py-1 rounded-lg ${totalFloatingProfit >= 0 ? 'bg-emerald-100/80 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
             <span className="opacity-70 block mb-0.5">Unrealized P/L:</span>
             <span className="flex items-center gap-1 justify-center font-bold">
                {totalFloatingProfit >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} 
                {totalFloatingProfit > 0 ? '+' : ''}{formatCurrency(totalFloatingProfit)}
             </span>
           </div>
        </div>
      </div>

      {/* Controller Area */}
      {!isFormVisible && (
        <button 
          onClick={() => setIsFormVisible(true)}
          className="w-full border border-dashed border-emerald-400 text-emerald-600 bg-emerald-50 py-3 rounded-2xl font-medium text-sm hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Tambah Aset Investasi
        </button>
      )}

      {/* Form Tambah/Edit Aset */}
      {isFormVisible && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase size={18} className="text-[var(--color-primary)]"/> 
              {editId ? 'Ubah Aset' : 'Aset Baru'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-700 bg-gray-100 p-1.5 rounded-full">
              <X size={14} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Aset</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Saham BBCA" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Jenis Aset</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Jumlah (Unit/Lot)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="0" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Harga Modal Satuan</label>
                  <input 
                    type="number" 
                    placeholder="Rp" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1"
                    value={acquisitionCost}
                    onChange={(e) => setAcquisitionCost(e.target.value)}
                    required
                  />
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Harga Kini Satuan</label>
                  <input 
                    type="number" 
                    placeholder="Rp" 
                    className="w-full relative z-10 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    required
                  />
               </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 mt-2 shadow-sm"
            >
              <Save size={16} /> {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Aset'}
            </button>
          </form>
        </div>
      )}

      {/* Daftar Aset */}
      <div>
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-4">Memuat data...</p>
        ) : assets.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4 glass rounded-2xl">Portofolio kosong</p>
        ) : (
          <div className="space-y-3">
             {assets.map(asset => {
                const totalCostAsset = asset.quantity * asset.acquisition_cost
                const totalValAsset = asset.quantity * asset.current_price_per_unit
                const profitAsset = totalValAsset - totalCostAsset
                const isProfit = profitAsset >= 0

                return (
                  <div key={asset.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
                     {/* Card Body */}
                     <div className="p-4">
                        <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                           <div>
                              <p className="font-bold text-gray-900 text-sm">{asset.name}</p>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">{asset.type} • {asset.quantity} UNIT</p>
                           </div>
                           <div className="flex bg-gray-50 rounded-lg p-1">
                              <button onClick={() => handleEditClick(asset)} className="p-1.5 text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                                 <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                                 <Trash2 size={14} />
                              </button>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <p className="text-[10px] text-gray-500 mb-0.5">Nilai Perolehan</p>
                              <p className="text-sm font-semibold text-gray-700">{formatCurrency(totalCostAsset)}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">@ {formatCurrency(asset.acquisition_cost)}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] text-gray-500 mb-0.5">Nilai Saat Ini</p>
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(totalValAsset)}</p>
                              <p className={`text-[10px] mt-0.5 font-bold ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                                {isProfit ? '+' : ''}{formatCurrency(profitAsset)}
                              </p>
                           </div>
                        </div>
                     </div>
                     
                     {/* Flashing color indicator at the bottom */}
                     <div className={`h-1.5 w-full ${isProfit ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                  </div>
                )
             })}
          </div>
        )}
      </div>

    </div>
  )
}
