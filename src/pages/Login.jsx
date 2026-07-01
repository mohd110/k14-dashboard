import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@k14.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    // Bakery staff land on the Calendar; everyone else on the dashboard.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()
    setLoading(false)
    navigate(profile?.role === 'bakery' ? '/calendar' : '/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-10 shadow-[0_12px_40px_rgba(45,52,54,0.10)]">
        {/* brand */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="flex items-center justify-center rounded-2xl bg-black px-7 py-5">
            <img src="/k14-logo.png" alt="K14 Bakers" className="w-48 object-contain" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[1.4px] text-ink-soft">
            Restaurant Admin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Email</label>
            <div className="relative mt-2">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@k14.com"
                className="w-full rounded-xl border border-line py-3 pl-11 pr-3.5 text-sm text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Password</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-line py-3 pl-11 pr-3.5 text-sm text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                required
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-brand-light px-3.5 py-2.5 text-xs font-medium text-brand">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs leading-relaxed text-ink-soft">
          Restaurant staff access only · Ya Hussain (عليه السلام)
        </p>
      </div>
    </div>
  )
}
