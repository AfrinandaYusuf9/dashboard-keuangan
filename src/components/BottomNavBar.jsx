import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ReceiptText, Wallet, PieChart, Settings } from 'lucide-react'

export default function BottomNavBar() {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Transaksi', path: '/transactions', icon: ReceiptText },
    { name: 'Anggaran', path: '/budget', icon: Wallet },
    { name: 'Aset', path: '/assets', icon: PieChart },
    { name: 'Pengaturan', path: '/settings', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2">
      <div className="max-w-md mx-auto relative glass rounded-2xl flex justify-between items-center px-6 py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <Icon size={24} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
