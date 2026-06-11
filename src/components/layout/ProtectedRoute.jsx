import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function ProtectedRoute({ children, roles }) {
  const { profile, loading } = useAuthStore()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )

  if (!profile) return <Navigate to="/login" replace/>
  if (roles && !roles.includes(profile.role)) return <Navigate to="/login" replace/>

  return children
}
