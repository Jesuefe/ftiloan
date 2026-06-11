import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

// Roles that can access any page (staff override)
const STAFF_ROLES = ['super_admin', 'manager', 'agent', 'auditor', 'operator', 'security_officer']

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

  // Staff can access any route (admin reviewing client pages etc)
  if (STAFF_ROLES.includes(profile.role)) return children

  // For client-only routes, check role
  if (roles && !roles.includes(profile.role)) {
    // Redirect to their own dashboard
    const dashMap = {
      super_admin: '/admin',
      manager: '/manager',
      agent: '/agent',
      client: '/client',
      operator: '/operator',
      auditor: '/auditor',
      security_officer: '/security',
    }
    return <Navigate to={dashMap[profile.role] || '/login'} replace/>
  }

  return children
}
