import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import OrderNotifications from '../components/OrderNotifications.jsx'

export default function DashboardLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1">
          <Outlet />
        </div>
        {/* House copyright mark (left) + build credit (extreme right) */}
        <footer className="flex items-center justify-between gap-3 border-t border-line px-8 py-3 text-[11px] text-ink-soft">
          <span className="font-semibold uppercase tracking-wide">k14 epicurian delight foods</span>
          <span className="text-ink-muted">Powered by Taskshift AI</span>
        </footer>
      </main>
      {/* Real-time new-order toasts, shown on every dashboard page */}
      <OrderNotifications />
    </div>
  )
}
