import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import DashboardLayout from './layout/DashboardLayout.jsx'
import Login from './pages/Login.jsx'
import Overview from './pages/Overview.jsx'
import Orders from './pages/Orders.jsx'
import Calendar from './pages/Calendar.jsx'
import Menu from './pages/Menu.jsx'
import Riders from './pages/Riders.jsx'
import Customers from './pages/Customers.jsx'
import Outlets from './pages/Outlets.jsx'
import DeliveryFees from './pages/DeliveryFees.jsx'
import Banners from './pages/Banners.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'

/* Where each role lands by default. Bakery staff start on the Calendar. */
function homeFor(role) {
  return role === 'bakery' ? '/calendar' : '/dashboard'
}

function Protected({ children }) {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-canvas text-ink-soft">Loading…</div>
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}

/* Restrict a route to the given roles; bakery staff get bounced to their home. */
function RoleRoute({ allow, children }) {
  const { role, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-canvas text-ink-soft">Loading…</div>
  }
  if (role && !allow.includes(role)) return <Navigate to={homeFor(role)} replace />
  return children
}

/* The index route ("/") sends each role to its default landing page. */
function RoleHome() {
  const { role } = useAuth()
  return <Navigate to={homeFor(role)} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <DashboardLayout />
              </Protected>
            }
          >
            <Route path="/" element={<RoleHome />} />
            {/* Shared by all staff (restaurant + bakery) */}
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/menu" element={<Menu />} />
            {/* Restaurant-admin + super-admin only — bakery staff are redirected away */}
            <Route path="/dashboard" element={<RoleRoute allow={['restaurant', 'super_admin']}><Overview /></RoleRoute>} />
            <Route path="/riders" element={<RoleRoute allow={['restaurant', 'super_admin']}><Riders /></RoleRoute>} />
            <Route path="/customers" element={<RoleRoute allow={['restaurant', 'super_admin']}><Customers /></RoleRoute>} />
            <Route path="/outlets" element={<RoleRoute allow={['restaurant', 'super_admin']}><Outlets /></RoleRoute>} />
            <Route path="/delivery-fees" element={<RoleRoute allow={['restaurant', 'super_admin']}><DeliveryFees /></RoleRoute>} />
            <Route path="/banners" element={<RoleRoute allow={['restaurant', 'super_admin']}><Banners /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute allow={['restaurant', 'super_admin']}><Reports /></RoleRoute>} />
            <Route path="/settings" element={<RoleRoute allow={['restaurant', 'super_admin']}><Settings /></RoleRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
