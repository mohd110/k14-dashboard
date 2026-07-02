import { useEffect, useState } from 'react'
import { Store, Plus, X, Loader2 } from 'lucide-react'
import Topbar, { TopIcons } from '../layout/Topbar.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'

/* slugify a store name: lowercase, non-alnum → dashes, collapse & trim. */
function slugify(s = '') {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/* Small on/off switch (matches the Menu page toggle). */
function Toggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
        on ? 'bg-brand' : 'bg-line-2'
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

/* Modal shell (matches the Menu page modal). */
function Modal({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface p-5">
          <div>
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-line p-5">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Create a new store / outlet (super-admin only) ── */
function AddStoreModal({ existing, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [shortDesc, setShortDesc] = useState('')
  const [description, setDescription] = useState('')
  const [themeColor, setThemeColor] = useState('#10b981')
  const [phone, setPhone] = useState('')
  const [upiId, setUpiId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Keep the slug in step with the name until the admin edits it by hand.
  const effectiveSlug = slugEdited ? slug : slugify(name)
  const dupeSlug = existing.some((s) => s.slug === effectiveSlug)
  const canSave = !!name.trim() && !!effectiveSlug && !dupeSlug

  const nextSort = existing.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0) + 1

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const { data, error } = await supabase
      .from('stores')
      .insert({
        name: name.trim(),
        slug: effectiveSlug,
        short_desc: shortDesc.trim(),
        description: description.trim(),
        theme_color: themeColor,
        phone: phone.trim() || null,
        upi_id: upiId.trim() || null,
        is_active: isActive,
        sort_order: nextSort,
      })
      .select('*')
      .single()
    if (error) {
      setSaving(false)
      // RLS returns no row when the account isn't the super-admin.
      if (error.code === 'PGRST116' || /row-level security/i.test(error.message)) {
        alert(
          'Store could not be created — only the marketplace super-admin can add outlets. ' +
            'Run migration 015 (store admin writes) in Supabase and sign in again.'
        )
      } else {
        alert(`Could not create store: ${error.message}`)
      }
      return
    }
    setSaving(false)
    onSaved(data)
  }

  return (
    <Modal
      title="Add new store"
      subtitle="Create an outlet on the marketplace."
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-line-soft"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !canSave}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create store
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Store name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kabacchi"
            autoFocus
            className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Slug <span className="font-normal normal-case text-ink-muted">(used in the store URL & order codes)</span>
          </label>
          <input
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true)
              setSlug(slugify(e.target.value))
            }}
            placeholder="e.g. kabacchi"
            className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
          />
          {dupeSlug && (
            <p className="mt-1 text-xs font-semibold text-brand">
              A store with this slug already exists — choose a different one.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Short description <span className="font-normal normal-case text-ink-muted">(optional)</span>
          </label>
          <input
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            placeholder="Biryani & Mughlai cuisine"
            className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Description <span className="font-normal normal-case text-ink-muted">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Longer description shown on the store page"
            className="w-full resize-none rounded-lg border border-line bg-surface-low px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Theme colour
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-surface-low"
              />
              <input
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Phone <span className="font-normal normal-case text-ink-muted">(optional)</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contact number"
              className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            UPI ID <span className="font-normal normal-case text-ink-muted">(optional — advance-payment payee)</span>
          </label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="store@upi"
            className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <span className="text-sm font-semibold text-ink">Active (visible to customers)</span>
          <Toggle on={isActive} onClick={() => setIsActive((v) => !v)} />
        </label>
      </div>
    </Modal>
  )
}

/* Round store badge — logo when present, else a tinted initial. */
function StoreBadge({ store }) {
  const color = store?.theme_color || '#e23744'
  const initial = (store?.name || '?').trim().charAt(0).toUpperCase()
  return store?.logo_url ? (
    <img src={store.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
  ) : (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {initial}
    </span>
  )
}

export default function Outlets() {
  const { isSuperAdmin, role, storeId, user } = useAuth()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let alive = true
    supabase
      .from('stores')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) console.error('Failed to load stores:', error.message)
        setStores(data ?? [])
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <Topbar>
        <h1 className="text-xl font-bold text-ink">Outlet Management</h1>
        <div className="flex items-center gap-2">
          <TopIcons />
          {isSuperAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="ml-1 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <Plus className="h-4 w-4" /> Add Store
            </button>
          )}
        </div>
      </Topbar>

      <div className="space-y-6 p-8">
        {/* TEMP DIAGNOSTIC — remove once Add Store shows for the super-admin */}
        <div className="rounded-lg border border-dashed border-brand bg-brand-light px-4 py-3 font-mono text-xs text-ink">
          <b>auth debug:</b>{' '}
          email=<b>{user?.email ?? '—'}</b>{' · '}
          role=<b>{String(role)}</b>{' · '}
          storeId=<b>{String(storeId)}</b>{' · '}
          isSuperAdmin=<b>{String(isSuperAdmin)}</b>
          {!isSuperAdmin && (
            <span className="ml-2 text-brand">
              → Add Store hidden because isSuperAdmin is false.
            </span>
          )}
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[28px] font-bold leading-8 text-ink">Stores &amp; Outlets</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {isSuperAdmin
                ? 'Every store on the marketplace. Add a new outlet to start listing its menu.'
                : 'Stores on the marketplace.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Store</th>
                <th className="px-5 py-3 font-semibold">Slug</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-ink-soft">
                    Loading stores…
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-ink-soft">
                    No stores yet.
                  </td>
                </tr>
              ) : (
                stores.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <StoreBadge store={s} />
                        <div>
                          <p className="text-sm font-semibold text-ink">{s.name}</p>
                          <p className="max-w-[280px] truncate text-xs text-ink-soft">
                            {s.short_desc || s.description || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-ink-soft">{s.slug}</span>
                    </td>
                    <td className="px-5 py-4">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-pos-soft px-2.5 py-1 text-[11px] font-semibold text-pos-dark">
                          <span className="h-1.5 w-1.5 rounded-full bg-pos" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-line-soft px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                          <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" /> Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-ink-soft">
                      {s.sort_order ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between p-5">
            <span className="text-sm text-ink-soft">
              {loading ? 'Loading…' : `${stores.length} store${stores.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        {!isSuperAdmin && !loading && (
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <Store className="h-3.5 w-3.5" />
            Only the marketplace super-admin can add or edit stores.
          </p>
        )}
      </div>

      {showAdd && (
        <AddStoreModal
          existing={stores}
          onClose={() => setShowAdd(false)}
          onSaved={(store) => {
            setStores((prev) =>
              [...prev, store].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            )
            setShowAdd(false)
          }}
        />
      )}
    </>
  )
}
