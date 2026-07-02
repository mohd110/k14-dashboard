import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

/* Absolute session lifetime: 3 hours from sign-in, then auto sign-out. */
const SESSION_MAX_MS = 3 * 60 * 60 * 1000
const LOGIN_AT_KEY = 'wb-login-at'
/* Super-admin's chosen store in the switcher ('' = All stores). */
const ACTIVE_STORE_KEY = 'bmt-dash-store'

const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  storeId: null,
  store: null,
  stores: [],
  isSuperAdmin: false,
  effectiveStoreId: null,
  effectiveStore: null,
  selectedStoreId: '',
  setSelectedStore: () => {},
  loading: true,
  signOut: () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [storeId, setStoreId] = useState(null) // the account's own store (null = super-admin)
  const [stores, setStores] = useState([]) // all stores, for the super-admin switcher
  const [selectedStoreId, setSelectedStoreId] = useState(
    () => localStorage.getItem(ACTIVE_STORE_KEY) || ''
  )
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  // Load the signed-in account's role + store from profiles.
  const loadProfile = async (s) => {
    if (!s?.user) {
      setRole(null)
      setStoreId(null)
      return
    }
    let { data, error } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', s.user.id)
      .single()
    // Graceful fallback if migration 011 (store_id column) hasn't run yet,
    // so the dashboard still works during a code-before-SQL deploy.
    if (error) {
      const res = await supabase
        .from('profiles')
        .select('role')
        .eq('id', s.user.id)
        .single()
      data = res.data
    }
    setRole(data?.role ?? null)
    setStoreId(data?.store_id ?? null)
  }

  // The full store list (RLS: stores are world-readable) powers the
  // super-admin switcher and the per-store branding lookup.
  const loadStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .order('sort_order', { ascending: true })
    setStores(data ?? [])
  }

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const forceSignOut = () => {
      clearTimer()
      localStorage.removeItem(LOGIN_AT_KEY)
      supabase.auth.signOut()
    }

    // Schedule the 3-hour auto-logout (or sign out now if the window already passed).
    const armExpiry = (active) => {
      clearTimer()
      if (!active) return
      let loginAt = Number(localStorage.getItem(LOGIN_AT_KEY))
      if (!loginAt) {
        loginAt = Date.now()
        localStorage.setItem(LOGIN_AT_KEY, String(loginAt))
      }
      const remaining = loginAt + SESSION_MAX_MS - Date.now()
      if (remaining <= 0) {
        forceSignOut()
        return
      }
      timerRef.current = setTimeout(forceSignOut, remaining)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session ?? null
      setSession(s)
      await Promise.all([loadProfile(s), s ? loadStores() : Promise.resolve()])
      armExpiry(!!s)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s ?? null)
      loadProfile(s ?? null)
      if (s) loadStores()
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(LOGIN_AT_KEY)
        clearTimer()
      } else {
        // SIGNED_IN starts a fresh window (loginAt was cleared on the prior sign-out);
        // refresh / token-refresh events keep the existing window.
        armExpiry(!!s)
      }
    })

    return () => {
      sub.subscription.unsubscribe()
      clearTimer()
    }
  }, [])

  const setSelectedStore = (id) => {
    const val = id || ''
    setSelectedStoreId(val)
    if (val) localStorage.setItem(ACTIVE_STORE_KEY, val)
    else localStorage.removeItem(ACTIVE_STORE_KEY)
  }

  const signOut = () => {
    localStorage.removeItem(LOGIN_AT_KEY)
    localStorage.removeItem(ACTIVE_STORE_KEY)
    return supabase.auth.signOut()
  }

  // The explicit 'super_admin' role is the marketplace super-admin.
  // (Legacy fallback: a restaurant/bakery account with no store_id, from
  //  before migration 011 introduced the dedicated role value.)
  const isSuperAdmin =
    role === 'super_admin' ||
    (!!role && ['restaurant', 'bakery'].includes(role) && !storeId)
  // Which store the UI is currently acting on. Scoped accounts are pinned
  // to their own store; the super-admin picks one (or '' = all stores).
  const effectiveStoreId = isSuperAdmin ? selectedStoreId || null : storeId
  const store = stores.find((s) => s.id === storeId) ?? null
  const effectiveStore = stores.find((s) => s.id === effectiveStoreId) ?? null

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        storeId,
        store,
        stores,
        isSuperAdmin,
        effectiveStoreId,
        effectiveStore,
        selectedStoreId,
        setSelectedStore,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
