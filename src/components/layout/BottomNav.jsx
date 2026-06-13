import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FileText, CreditCard,
  UserPlus, CheckSquare, CalendarDays, Banknote,
  Search, User, ClipboardList, Shield, MessageCircle,
} from 'lucide-react'

// Bottom nav tabs per role — max 5 tabs
const bottomNavByRole = {
  client: [
    { label: 'Home',     icon: LayoutDashboard, to: '/client' },
    { label: 'Loans',    icon: FileText,        to: '/client/loans' },
    { label: 'Chat',     icon: MessageCircle,   to: '/client/chat' },
    { label: 'Payments', icon: CreditCard,      to: '/client/payments' },
    { label: 'Profile',  icon: User,            to: '/client/profile' },
  ],
  agent: [
    { label: 'Home',     icon: LayoutDashboard,  to: '/agent' },
    { label: 'Clients',  icon: Users,            to: '/agent/clients' },
    { label: 'Chat',     icon: MessageCircle,    to: '/agent/chat' },
    { label: 'Payments', icon: CheckSquare,      to: '/agent/confirm-payments' },
    { label: 'Profile',  icon: User,             to: '/agent/profile' },
  ],
  operator: [
    { label: 'Home',    icon: LayoutDashboard,  to: '/operator' },
    { label: 'Disburse',icon: Banknote,         to: '/operator/disbursements' },
    { label: 'QR Scan', icon: Search,           to: '/operator/qr-scan' },
    { label: 'Profile', icon: User,             to: '/operator/profile' },
  ],
  manager: [
    { label: 'Home',    icon: LayoutDashboard,  to: '/manager' },
    { label: 'Loans',   icon: FileText,         to: '/manager/loans' },
    { label: 'Forms',   icon: ClipboardList,    to: '/manager/form-approvals' },
    { label: 'Audit',   icon: Shield,           to: '/manager/payment-audit' },
    { label: 'Profile', icon: User,             to: '/manager/profile' },
  ],
}

// Roles that get a bottom nav on mobile
const BOTTOM_NAV_ROLES = ['client', 'agent', 'operator', 'manager']

export function BottomNav() {
  const { profile } = useAuthStore()
  const role = profile?.role
  const tabs = bottomNavByRole[role]

  if (!tabs) return null

  // Always show on native app; on web only show when screen < 1024px
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom">
      <div className={cn(
        'grid h-16',
        tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-5'
      )}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to.split('/').length === 2}
              className={({ isActive }) => cn(
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-[#1B2A6B]'
                  : 'text-gray-400'
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'w-10 h-6 rounded-full flex items-center justify-center transition-all',
                    isActive ? 'bg-[#e8f5ee]' : ''
                  )}>
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  </div>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export { BOTTOM_NAV_ROLES }
