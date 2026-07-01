import { NavLink } from 'react-router-dom'
import {
  LayoutGrid,
  CalendarDays,
  BookOpen,
  ShoppingBag,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Store as StoreIcon,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/menu', label: 'Menu', icon: BookOpen },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/customers', label: 'Customers', icon: Users },
]

const secondaryNav = [
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function NavItem({ to, label, icon: Icon, accent }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex w-[243px] items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
          isActive ? 'font-semibold text-white' : 'font-normal text-ink-soft hover:bg-line-soft'
        }`
      }
      style={({ isActive }) => (isActive ? { backgroundColor: accent } : undefined)}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span className="whitespace-nowrap leading-5">{label}</span>
    </NavLink>
  )
}

/* Small round store badge — uses the store logo when present, otherwise a
   tinted initial derived from the store's theme colour. */
function StoreBadge({ store, size = 40 }) {
  const color = store?.theme_color || '#e23744'
  const initial = (store?.name || '?').trim().charAt(0).toUpperCase()
  return store?.logo_url ? (
    <img
      src={store.logo_url}
      alt={store.name}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  )
}

export default function Sidebar() {
  const {
    user,
    role,
    stores,
    isSuperAdmin,
    store,
    effectiveStore,
    selectedStoreId,
    setSelectedStore,
    signOut,
  } = useAuth()

  const email = user?.email ?? ''
  const isBakery = role === 'bakery'
  const roleLabel = isSuperAdmin ? 'Super Admin' : isBakery ? 'Bakery Staff' : 'Store Admin'
  const name = user?.user_metadata?.full_name || email.split('@')[0] || roleLabel

  // The store whose brand accent tints the nav. Super-admin viewing "All"
  // falls back to the marketplace red.
  const activeStore = isSuperAdmin ? effectiveStore : store
  const accent = activeStore?.theme_color || '#e23744'

  // Bakery staff only get Calendar + Menu + Orders; everyone else gets full nav.
  const visibleMain = isBakery
    ? mainNav.filter((item) => ['/calendar', '/menu', '/orders'].includes(item.to))
    : mainNav
  const visibleSecondary = isBakery ? [] : secondaryNav

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col justify-between border-r border-line bg-surface py-6 shadow-[1px_0_1px_rgba(0,0,0,0.05)]">
      {/* Marketplace logo */}
      <div className="flex flex-col gap-3 px-6 pb-6">
        <div className="flex w-fit items-center justify-center overflow-hidden rounded-xl bg-[#0e3d2a] px-3 py-2.5">
          <img src="/bmt-logo.png" alt="BookMyTabarruk" className="h-11 w-auto object-contain" />
        </div>

        {/* Store context / switcher */}
        {isSuperAdmin ? (
          <label className="relative block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[1.2px] text-ink-muted">
              Viewing store
            </span>
            <div className="relative">
              <StoreIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-lg border border-line bg-canvas py-2.5 pl-9 pr-8 text-sm font-semibold text-ink outline-none focus:border-ink-soft"
              >
                <option value="">All stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            </div>
          </label>
        ) : (
          <div className="flex items-center gap-2.5">
            <StoreBadge store={store} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{store?.name || 'K14 Bakery'}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[1px] text-ink-soft">
                {roleLabel}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1 px-2 pt-1">
        {visibleMain.map((item) => (
          <NavItem key={item.to} {...item} accent={accent} />
        ))}

        {visibleSecondary.length > 0 && (
          <div className="mt-6 w-[227px] border-t border-line pt-5">
            <div className="flex flex-col items-center gap-1">
              {visibleSecondary.map((item) => (
                <NavItem key={item.to} {...item} accent={accent} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Profile */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-3 rounded-xl bg-line-soft p-4">
          <img
            src="/assets/profile.png"
            alt=""
            className="h-10 w-10 shrink-0 rounded-full bg-line-2 object-cover"
          />
          <div className="flex flex-col overflow-hidden">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-soft">{email}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="ml-auto shrink-0 text-ink-soft hover:text-brand"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
