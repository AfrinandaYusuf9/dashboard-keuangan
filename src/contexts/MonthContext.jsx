import { createContext, useContext, useState } from 'react'

const MonthContext = createContext()

export function useMonth() {
  return useContext(MonthContext)
}

export function MonthProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default is current month structured as 'YYYY-MM-01'
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })

  const setMonthOnly = (yearMonthStr) => {
    // yearMonthStr is from <input type="month"> expected as 'YYYY-MM'
    if(yearMonthStr) {
      setSelectedMonth(`${yearMonthStr}-01`)
    }
  }

  return (
    <MonthContext.Provider value={{ selectedMonth, setMonthOnly }}>
      {children}
    </MonthContext.Provider>
  )
}
