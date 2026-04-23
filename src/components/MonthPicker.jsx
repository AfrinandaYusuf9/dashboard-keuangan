import { useMonth } from '../contexts/MonthContext'

export default function MonthPicker() {
  const { selectedMonth, setMonthOnly } = useMonth()

  // parse back to YYYY-MM for the html element
  const inputVal = selectedMonth ? selectedMonth.substring(0, 7) : ''

  return (
    <div className="flex items-center gap-1.5 bg-gray-50/80 px-2 py-1.5 rounded-xl border border-gray-100 shadow-sm">
       <input 
          type="month"
          value={inputVal}
          onChange={(e) => setMonthOnly(e.target.value)}
          className="bg-transparent outline-none text-xs font-bold text-gray-800 cursor-pointer appearance-none uppercase"
          style={{ width: '100px' }}
       />
    </div>
  )
}
