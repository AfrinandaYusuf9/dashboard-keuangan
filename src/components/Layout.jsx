import { Outlet } from 'react-router-dom'
import BottomNavBar from './BottomNavBar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 
        This wrapper creates a mobile-like container centered on desktop 
        pb-24 ensures content isn't hidden behind the sticky bottom nav bar 
      */}
      <div className="flex-1 w-full max-w-md mx-auto bg-white shadow-sm pb-24 min-h-screen relative overflow-x-hidden">
        <Outlet />
      </div>
      <BottomNavBar />
    </div>
  )
}
