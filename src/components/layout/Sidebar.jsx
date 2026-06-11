import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FileText, CreditCard, Settings,
  Shield, BarChart3, LogOut, Menu, X, UserCheck,
  Building2, AlertCircle, ClipboardList, Banknote,
  Search, Bell, ChevronRight
} from 'lucide-react'

const navByRole = {
  super_admin: [
    { section: 'Overview' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/admin' },
    { label: 'Loans',          icon: FileText,        to: '/admin/loans' },
    { label: 'Clients',        icon: Users,           to: '/admin/clients' },
    { label: 'Payments',       icon: CreditCard,      to: '/admin/payments' },
    { section: 'Staff' },
    { label: 'Agents',         icon: UserCheck,       to: '/admin/agents' },
    { label: 'Managers',       icon: Users,           to: '/admin/managers' },
    { label: 'Operators',      icon: Users,           to: '/admin/operators' },
    { label: 'Auditors',       icon: ClipboardList,   to: '/admin/auditors' },
    { section: 'System' },
    { label: 'KYC & Credit',   icon: Search,          to: '/admin/kyc-test' },
    { label: 'Blacklist',        icon: Shield,          to: '/admin/blacklist' },
    { label: 'Audit Logs',       icon: BarChart3,       to: '/admin/audit-logs' },
    { label: 'Analytics',        icon: BarChart3,       to: '/admin/analytics' },
    { section: 'Finance' },
    { label: 'Company Accounts', icon: Building2,       to: '/admin/company-accounts' },
    { label: 'Salary',           icon: Banknote,        to: '/admin/salary' },
    { label: 'Reset Password',   icon: Shield,          to: '/admin/reset-password' },
    { section: 'Config' },
    { label: 'Settings',         icon: Settings,        to: '/admin/settings' },
    { label: 'Zones',            icon: Building2,       to: '/admin/zones' },
  ],
  manager: [
    { section: 'Overview' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/manager' },
    { label: 'Loans',          icon: FileText,        to: '/manager/loans' },
    { label: 'Form Approvals', icon: ClipboardList,   to: '/manager/form-approvals' },
    { label: 'Profile',        icon: Users,           to: '/manager/profile' },
  ],
  agent: [
    { section: 'Overview' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/agent' },
    { label: 'My Clients',     icon: Users,           to: '/agent/clients' },
    { label: 'New Client',     icon: UserCheck,       to: '/agent/create-client' },
    { label: 'Apply for Client',icon: FileText,       to: '/agent/apply' },
    { section: 'Payments' },
    { label: 'Record Payment', icon: CreditCard,      to: '/agent/record-payment' },
    { label: 'Confirm Payments',icon: CreditCard,     to: '/agent/confirm-payments' },
    { section: 'Other' },
    { label: 'Verify Identity',icon: Shield,          to: '/agent/verify' },
    { label: 'Reports',        icon: BarChart3,       to: '/agent/reports' },
    { label: 'Profile',        icon: Users,           to: '/agent/profile' },
  ],
  client: [
    { section: 'Account' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/client' },
    { label: 'Apply — Cash',   icon: Banknote,        to: '/client/apply' },
    { label: 'Apply — Asset',  icon: Building2,       to: '/client/apply-asset' },
    { label: 'My Loans',       icon: FileText,        to: '/client/loans' },
    { label: 'Payments',       icon: CreditCard,      to: '/client/payments' },
    { label: 'Schedule',       icon: ClipboardList,   to: '/client/schedule' },
    { label: 'Profile',        icon: Users,           to: '/client/profile' },
  ],
  operator: [
    { section: 'Overview' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/operator' },
    { label: 'Disbursements',  icon: Banknote,        to: '/operator/disbursements' },
    { label: 'QR Scan',        icon: Search,          to: '/operator/qr-scan' },
    { label: 'Profile',        icon: Users,           to: '/operator/profile' },
  ],
  auditor: [
    { section: 'Overview' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/auditor' },
    { label: 'Loans',          icon: FileText,        to: '/auditor/loans' },
    { label: 'Payments',       icon: CreditCard,      to: '/auditor/payments' },
    { label: 'Audit Logs',     icon: BarChart3,       to: '/auditor/logs' },
    { label: 'Flags',          icon: AlertCircle,     to: '/auditor/flags' },
    { label: 'Reports',        icon: ClipboardList,   to: '/auditor/reports' },
  ],
  security_officer: [
    { section: 'Overview' },
    { label: 'Dashboard',      icon: LayoutDashboard, to: '/security' },
    { label: 'Blocked IPs',    icon: Shield,          to: '/security/blocked' },
    { label: 'Active Sessions',icon: Users,           to: '/security/sessions' },
    { label: 'Threats',        icon: AlertCircle,     to: '/security/threats' },
    { label: 'Reports',        icon: BarChart3,       to: '/security/reports' },
  ],
}

export function Sidebar({ open, onClose }) {
  const { profile, signOut } = useAuthStore()
  const nav = navByRole[profile?.role] || []

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose}/>}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-dark z-40 flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="font-display text-xl font-bold text-white">
            FTI<span className="text-brand-400">Loan</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-white/60 hover:text-white">
            <X size={18}/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {nav.map((item, i) => {
            if (item.section) return (
              <div key={i} className="px-3 py-2 mt-3 first:mt-0">
                <span className="text-xs font-bold text-white/30 uppercase tracking-widest">{item.section}</span>
              </div>
            )
            const Icon = item.icon
            return (
              <NavLink
                key={i}
                to={item.to}
                end={item.to.split('/').length === 2}
                onClick={onClose}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                )}
              >
                <Icon size={16}/>
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{profile?.first_name} {profile?.last_name}</div>
              <div className="text-white/40 text-xs capitalize">{profile?.role?.replace('_',' ')}</div>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/60 hover:bg-white/8 hover:text-white text-sm transition-all">
            <LogOut size={15}/>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
