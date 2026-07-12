import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { useMonth } from '../contexts/MonthContext'
import { supabase } from '../lib/supabaseClient'
import { ensureBudgetExists } from '../utils/budgetUtils'
import { formatCurrency } from '../utils/formatCurrency'
import MonthPicker from '../components/MonthPicker'
import { Plus, Wallet, TrendingUp, TrendingDown, LayoutDashboard, Eye, EyeOff, ChevronDown } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const { refreshTrigger } = useRefresh()
  const { selectedMonth } = useMonth()
  
  const [totalBalance, setTotalBalance] = useState(0)
  const [totalAssetValue, setTotalAssetValue] = useState(0)
  const [budgetData, setBudgetData] = useState([])
  const [incomeData, setIncomeData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNetWorth, setShowNetWorth] = useState(true)
  const [expandedPosId, setExpandedPosId] = useState(null) // accordion state

  const displayName = user?.email?.split('@')[0] || 'User'

  const getMonthStr = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  useEffect(() => {
    if (user && selectedMonth) {
      loadDashboardData()
    }
  }, [user, refreshTrigger, selectedMonth])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      const currentMonthPos = selectedMonth
      
      const d = new Date(selectedMonth)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const currentMonthStartTrx = selectedMonth
      const currentMonthEndTrx = new Date(year, month, 0).toLocaleDateString('en-CA')

      // Fetch Accounts (For total balance)
      const { data: accountsData, error: accountsErr } = await supabase
        .from('cash_accounts')
        .select('balance')
      if (accountsErr) throw accountsErr
      const sumBalance = accountsData?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0
      setTotalBalance(sumBalance)

      // Fetch Assets (For net worth)
      const { data: assetsData, error: assetsErr } = await supabase
        .from('assets')
        .select('quantity, current_price_per_unit')
      if (assetsErr) throw assetsErr
      const assetSum = assetsData?.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.current_price_per_unit)), 0) || 0
      setTotalAssetValue(assetSum)

      // Fetch Budget Pos (with auto-seeding if missing)
      const posData = await ensureBudgetExists(user.id, currentMonthPos)

      // Fetch Transaction sums for this month
      const { data: trxData, error: trxErr } = await supabase
        .from('transactions')
        .select('amount, type, budget_sub_item_id')
        .gte('date', currentMonthStartTrx)
        .lte('date', currentMonthEndTrx)
      if (trxErr) throw trxErr

      // Aggregate data — now includes per-sub-item breakdown
      const processedExpenses = []
      const processedIncomes = []

      posData?.forEach(pos => {
        const subItems = pos.budget_sub_items || []
        const subItemIds = subItems.map(s => s.id)

        // Calculate per-sub-item realisasi
        const subItemDetails = subItems.map(sub => {
          const subRealisasi = trxData
            ?.filter(trx => {
              const trxMatch = (pos.type === 'expense' && trx.type === 'out') || (pos.type === 'income' && trx.type === 'in')
              return trxMatch && trx.budget_sub_item_id === sub.id
            })
            .reduce((sum, trx) => sum + Number(trx.amount), 0) || 0
          
          const subBudget = Number(sub.budget_amount || 0)
          let subPercentage = 0
          if (subBudget > 0) subPercentage = (subRealisasi / subBudget) * 100

          return {
            id: sub.id,
            name: sub.name,
            budget: subBudget,
            realisasi: subRealisasi,
            percentage: isFinite(subPercentage) ? subPercentage : 0,
            isOverbudget: subRealisasi > subBudget && subBudget > 0,
          }
        })

        const totalRealisasi = subItemDetails.reduce((s, si) => s + si.realisasi, 0)
        const budgetAmount = subItemDetails.reduce((s, si) => s + si.budget, 0)

        if (pos.type === 'expense') {
          let percentage = 0
          if (budgetAmount > 0) percentage = (totalRealisasi / budgetAmount) * 100
          processedExpenses.push({
            id: pos.id,
            name: pos.name,
            budget: budgetAmount,
            realisasi: totalRealisasi,
            sisa: Math.max(0, budgetAmount - totalRealisasi),
            percentage: isFinite(percentage) ? percentage : 0,
            isOverbudget: totalRealisasi > budgetAmount,
            subItems: subItemDetails, // ← NEW: per-sub-item breakdown
          })
        } else if (pos.type === 'income') {
          processedIncomes.push({ id: pos.id, name: pos.name, budget: budgetAmount, realisasi: totalRealisasi })
        }
      })

      processedExpenses.sort((a, b) => b.percentage - a.percentage)
      setBudgetData(processedExpenses)
      setIncomeData(processedIncomes)

    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getProgressBarColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-400'
    return 'bg-[var(--color-primary)]' 
  }

  const getSubProgressBarColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-400'
    if (percentage >= 80) return 'bg-yellow-300'
    return 'bg-emerald-300'
  }

  const handleToggleExpand = (posId) => {
    setExpandedPosId(prev => prev === posId ? null : posId)
  }

  const netWorth = totalBalance + totalAssetValue

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header Segmen */}
      <header className="pt-4 flex justify-between items-end">
        <div className="flex items-center gap-3">
          <img src="/Logo_Keuangan.png" alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize leading-tight">Halo, {displayName}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Ringkasan {getMonthStr(selectedMonth)}</p>
          </div>
        </div>
        <MonthPicker />
      </header>

      {/* Kartu NET WORTH Utama */}
      <div className="glass rounded-3xl p-6 bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-lg relative overflow-hidden border-0">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <LayoutDashboard size={120} className="-mt-8 -mr-8" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-6 truncate">
              <p className="text-emerald-50 text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">🔥 Net Worth (Kekayaan Bersih)</p>
              <h2 className="text-4xl font-extrabold tracking-tight mb-6">
                {showNetWorth ? formatCurrency(netWorth) : "Rp •••••"}
              </h2>
            </div>
            <button 
              onClick={() => setShowNetWorth(!showNetWorth)}
              className="text-white/60 hover:text-white p-1 transition-colors"
              title={showNetWorth ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
            >
              {showNetWorth ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 border-t border-emerald-500/30 pt-4">
            <div>
              <p className="text-[10px] text-emerald-100 uppercase opacity-70">Uang Tunai & Kas</p>
              <p className="text-sm font-bold">
                {showNetWorth ? formatCurrency(totalBalance) : "Rp •••••"}
              </p>
            </div>
            <div>
               <p className="text-[10px] text-emerald-100 uppercase opacity-70">Valuasi Aset</p>
               <p className="text-sm font-bold">
                 {showNetWorth ? formatCurrency(totalAssetValue) : "Rp •••••"}
               </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
         <Link to="/transactions" className="flex-1 flex justify-center items-center gap-2 bg-gray-900 text-white py-3 rounded-2xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm">
            <Plus size={16} /> Transaksi
         </Link>
         <Link to="/assets" className="flex-1 flex justify-center items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 py-3 rounded-2xl text-sm font-medium hover:bg-emerald-100 transition-colors shadow-sm">
            <TrendingUp size={16} /> Aset
         </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Ringkasan Pemasukan */}
          {incomeData.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-900 text-sm pl-1 flex items-center gap-1.5">
                <TrendingUp size={18} className="text-emerald-500"/> Realisasi Pemasukan
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {incomeData.map(inc => (
                  <div key={inc.id} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
                    <p className="text-xs text-gray-500 mb-1 truncate">{inc.name}</p>
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(inc.realisasi)}</p>
                    {inc.budget > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">Target: {formatCurrency(inc.budget)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Pos Anggaran (Pengeluaran) — with Accordion */}
          <div className="space-y-4">
             <div className="flex justify-between items-end">
                <h3 className="font-bold text-gray-900 text-sm pl-1 flex items-center gap-1.5">
                  <TrendingDown size={18} className="text-orange-500"/> Progress Anggaran
                </h3>
             </div>

             <div className="space-y-3">
               {budgetData.length === 0 ? (
                 <p className="text-center text-sm text-gray-400 py-4 glass rounded-2xl">Belum ada data anggaran tersimpan bulan ini.</p>
               ) : (
                 budgetData.map((exp) => {
                   const progressColor = getProgressBarColor(exp.percentage)
                   const cappedPercentage = Math.min(exp.percentage, 100)
                   const isExpanded = expandedPosId === exp.id
                   const hasSubItems = exp.subItems && exp.subItems.length > 0

                   return (
                     <div key={exp.id} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                       {/* Main Card — Clickable */}
                       <button
                         onClick={() => hasSubItems && handleToggleExpand(exp.id)}
                         className={`w-full text-left p-4 transition-colors ${hasSubItems ? 'cursor-pointer hover:bg-gray-50/50 active:bg-gray-100/50' : ''}`}
                       >
                         <div className="flex justify-between items-end mb-2">
                           <div>
                             <div className="flex items-center gap-1.5">
                               <p className="font-semibold text-gray-800 text-sm">{exp.name}</p>
                               {hasSubItems && (
                                 <ChevronDown 
                                   size={14} 
                                   className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                                 />
                               )}
                             </div>
                             <p className="text-xs text-gray-500">Target: {formatCurrency(exp.budget)}</p>
                           </div>
                           <div className="text-right">
                             <p className={`text-xs font-bold ${exp.isOverbudget ? 'text-red-500' : 'text-gray-900'}`}>
                               {exp.isOverbudget ? 'OVERBUDGET' : `Sisa ${formatCurrency(exp.sisa)}`}
                             </p>
                           </div>
                         </div>
                         
                         <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                           <div 
                             className={`h-full ${progressColor} transition-all duration-500 ease-out`} 
                             style={{ width: `${cappedPercentage}%` }}
                           ></div>
                         </div>
                         
                         <div className="flex justify-between items-center text-[11px]">
                           <p className="text-gray-500">Terpakai: {formatCurrency(exp.realisasi)}</p>
                           <p className={`font-semibold ${exp.isOverbudget ? 'text-red-500' : 'text-gray-400'}`}>
                             {exp.percentage.toFixed(0)}%
                           </p>
                         </div>
                       </button>

                       {/* Expanded Sub-Items Section */}
                       <div 
                         className="overflow-hidden transition-all duration-300 ease-in-out"
                         style={{ 
                           maxHeight: isExpanded ? `${(exp.subItems?.length || 0) * 80 + 16}px` : '0px',
                           opacity: isExpanded ? 1 : 0,
                         }}
                       >
                         <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                           {exp.subItems?.map(sub => {
                             const subColor = getSubProgressBarColor(sub.percentage)
                             const subCapped = Math.min(sub.percentage, 100)

                             return (
                               <div key={sub.id} className="bg-gray-50/80 rounded-xl p-3 ml-2 border border-gray-100/60">
                                 <div className="flex justify-between items-center mb-1.5">
                                   <p className="text-xs font-semibold text-gray-700 truncate mr-2">{sub.name}</p>
                                   <p className="text-[10px] text-gray-500 shrink-0 font-medium">
                                     {formatCurrency(sub.realisasi)} / {formatCurrency(sub.budget)}
                                   </p>
                                 </div>
                                 <div className="h-1.5 w-full bg-gray-200/70 rounded-full overflow-hidden">
                                   <div 
                                     className={`h-full ${subColor} transition-all duration-500 ease-out rounded-full`}
                                     style={{ width: `${subCapped}%` }}
                                   ></div>
                                 </div>
                                 <div className="flex justify-between mt-1">
                                   <span className={`text-[9px] font-bold ${sub.isOverbudget ? 'text-red-500' : 'text-gray-400'}`}>
                                     {sub.percentage.toFixed(0)}%
                                   </span>
                                   {sub.isOverbudget && (
                                     <span className="text-[9px] font-bold text-red-500">OVER</span>
                                   )}
                                 </div>
                               </div>
                             )
                           })}
                         </div>
                       </div>
                     </div>
                   )
                 })
               )}
             </div>
          </div>
        </>
      )}
    </div>
  )
}
