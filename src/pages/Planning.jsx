import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency } from '../utils/formatCurrency'
import { CalendarRange, Plus, Trash2, TrendingUp, TrendingDown, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const PLAN_MONTHS = [
  { value: '2026-05', label: 'Mei 2026' },
  { value: '2026-06', label: 'Juni 2026' },
  { value: '2026-07', label: 'Juli 2026' },
  { value: '2026-08', label: 'Agustus 2026' },
  { value: '2026-09', label: 'September 2026' },
  { value: '2026-10', label: 'Oktober 2026' },
  { value: '2026-11', label: 'November 2026' },
  { value: '2026-12', label: 'Desember 2026' },
]

export default function Planning() {
  const { user } = useAuth()

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentNetWorth, setCurrentNetWorth] = useState(0)

  // Form state
  const [month, setMonth] = useState('2026-05')
  const [type, setType] = useState('income')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch planning entries
      const { data: planData, error: planErr } = await supabase
        .from('planning_entries')
        .select('*')
        .order('month', { ascending: true })
        .order('created_at', { ascending: true })

      if (planErr) throw planErr
      setEntries(planData || [])

      // Fetch current Net Worth (cash + assets) — read-only, no mutation
      const [accRes, assetRes] = await Promise.all([
        supabase.from('cash_accounts').select('balance'),
        supabase.from('assets').select('quantity, current_price_per_unit'),
      ])

      const totalCash = accRes.data?.reduce((s, a) => s + Number(a.balance), 0) || 0
      const totalAsset = assetRes.data?.reduce((s, a) => s + Number(a.quantity) * Number(a.current_price_per_unit), 0) || 0
      setCurrentNetWorth(totalCash + totalAsset)

    } catch (err) {
      console.error('Error loading planning data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!category.trim() || !amount) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('planning_entries')
        .insert([{
          user_id: user.id,
          month,
          type,
          category: category.trim(),
          amount: parseFloat(amount),
        }])
        .select()

      if (error) throw error

      setEntries(prev => [...prev, data[0]].sort((a, b) => a.month.localeCompare(b.month)))
      setCategory('')
      setAmount('')
    } catch (err) {
      console.error('Error adding planning entry:', err)
      alert('Gagal menambahkan rencana.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus item rencana ini?')) return
    try {
      const { error } = await supabase.from('planning_entries').delete().eq('id', id)
      if (error) throw error
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      console.error('Error deleting entry:', err)
      alert('Gagal menghapus.')
    }
  }

  // --- Aggregation Logic ---
  const grouped = PLAN_MONTHS.map(m => {
    const monthEntries = entries.filter(e => e.month === m.value)
    const totalIncome = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
    const totalExpense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
    return {
      ...m,
      entries: monthEntries,
      totalIncome,
      totalExpense,
      surplus: totalIncome - totalExpense,
    }
  }).filter(m => m.entries.length > 0) // Only show months that have entries

  const totalSurplusAllMonths = grouped.reduce((s, m) => s + m.surplus, 0)
  const estimatedNetWorth = currentNetWorth + totalSurplusAllMonths

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="pt-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarRange size={24} className="text-[var(--color-primary)]" />
          Rencana Keuangan 2026
        </h1>
        <p className="text-xs text-gray-500 mt-1">Proyeksi pemasukan & pengeluaran Mei – Desember</p>
      </header>

      {/* Kartu Estimasi Net Worth */}
      <div className="rounded-3xl p-6 bg-gradient-to-br from-indigo-600 to-violet-800 text-white shadow-lg relative overflow-hidden border-0">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Target size={120} className="-mt-8 -mr-8" />
        </div>

        <div className="relative z-10">
          <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">
            🎯 Estimasi Net Worth Desember 2026
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight mb-4">{formatCurrency(estimatedNetWorth)}</h2>

          <div className="grid grid-cols-3 gap-3 border-t border-indigo-400/30 pt-3">
            <div>
              <p className="text-[9px] text-indigo-200 uppercase opacity-70">Net Worth Kini</p>
              <p className="text-xs font-bold">{formatCurrency(currentNetWorth)}</p>
            </div>
            <div>
              <p className="text-[9px] text-indigo-200 uppercase opacity-70">Total Surplus</p>
              <p className={`text-xs font-bold ${totalSurplusAllMonths >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {totalSurplusAllMonths >= 0 ? '+' : ''}{formatCurrency(totalSurplusAllMonths)}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-indigo-200 uppercase opacity-70">Pertumbuhan</p>
              <p className="text-xs font-bold">
                {currentNetWorth > 0 ? ((totalSurplusAllMonths / currentNetWorth) * 100).toFixed(1) : '0'}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Input */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-[var(--color-primary)]" /> Tambah Rencana
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bulan</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1"
              >
                {PLAN_MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipe</label>
              <div className="flex bg-gray-100 p-0.5 rounded-xl h-[42px]">
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all ${
                    type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <ArrowDownRight size={12} /> Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all ${
                    type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <ArrowUpRight size={12} /> Keluar
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Kategori</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Contoh: Gaji, THR, Liburan"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-medium">Rp</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !category.trim() || !amount}
            className="w-full py-3 rounded-xl text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {isSubmitting ? 'Menyimpan...' : 'Tambah ke Rencana'}
          </button>
        </form>
      </div>

      {/* Proyeksi Per Bulan */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8 bg-white rounded-2xl border border-gray-100">
          <CalendarRange size={32} className="mx-auto text-gray-300 mb-2" />
          Belum ada rencana. Mulai tambahkan proyeksi Anda!
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 pl-1 flex items-center gap-2">
            <CalendarRange size={16} className="text-[var(--color-primary)]" />
            Proyeksi Per Bulan
          </h3>

          {grouped.map(m => (
            <div key={m.value} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Month Header */}
              <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
                <h4 className="font-bold text-gray-900 text-sm">{m.label}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  m.surplus >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}>
                  {m.surplus >= 0 ? 'Surplus' : 'Defisit'} {formatCurrency(Math.abs(m.surplus))}
                </span>
              </div>

              {/* Entries */}
              <div className="divide-y divide-gray-50">
                {m.entries.map(entry => (
                  <div key={entry.id} className="px-4 py-2.5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        entry.type === 'income' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                      }`}>
                        {entry.type === 'income' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                      <span className="text-sm text-gray-800 font-medium">{entry.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Month Summary */}
              <div className="px-4 py-3 bg-gray-50/70 grid grid-cols-3 gap-2 text-[10px] font-bold uppercase">
                <div>
                  <span className="text-gray-500 block">Pemasukan</span>
                  <span className="text-emerald-600 text-xs">{formatCurrency(m.totalIncome)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Pengeluaran</span>
                  <span className="text-red-500 text-xs">{formatCurrency(m.totalExpense)}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 block">Surplus</span>
                  <span className={`text-xs ${m.surplus >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {m.surplus >= 0 ? '+' : ''}{formatCurrency(m.surplus)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
