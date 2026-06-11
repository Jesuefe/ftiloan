import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

  const dashByRole = {
    super_admin: '/admin',
    manager:     '/manager',
    agent:       '/agent',
    client:      '/client',
    operator:    '/operator',
    auditor:     '/auditor',
    security_officer: '/security',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn(email.trim(), password)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    const dest = dashByRole[result.user?.role] || '/client'
    navigate(dest, { replace: true })
  }

  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 font-display mb-1">Welcome back</h2>
      <p className="text-gray-500 text-sm mb-6">Sign in to your account to continue</p>

      {error && <Alert type="danger" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <div className="mb-6 relative">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full justify-center" loading={loading}>
          Sign In
        </Button>
      </form>

      <div className="mt-4 text-center">
        <a href="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          Forgot password?
        </a>
      </div>
    </>
  )
}
