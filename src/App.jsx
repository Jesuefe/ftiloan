import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

// Layouts
import { AppLayout }      from '@/components/layout/AppLayout'
import { AuthLayout }     from '@/components/layout/AuthLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

// Auth
import Login    from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

// Admin
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminLoans     from '@/pages/admin/Loans'
import AdminLoanDetail from '@/pages/admin/LoanDetail'
import AdminClients   from '@/pages/admin/Clients'
import AdminPayments  from '@/pages/admin/Payments'
import AdminAgents    from '@/pages/admin/Agents'
import AdminSettings  from '@/pages/admin/Settings'
import AdminUsers     from '@/pages/admin/Users'
import AdminAnalytics from '@/pages/admin/Analytics'
import AdminAuditLogs from '@/pages/admin/AuditLogs'
import AdminKycTest   from '@/pages/admin/KycTest'
import AdminBlacklist from '@/pages/admin/Blacklist'
import AdminZones     from '@/pages/admin/Zones'
import AdminManagers  from '@/pages/admin/Managers'
import AdminOperators from '@/pages/admin/Operators'
import AdminAuditors          from '@/pages/admin/Auditors'
import AdminRepaymentHistory from '@/pages/admin/RepaymentHistory'
import AdminSalary          from '@/pages/admin/Salary'
import AdminRestructureLoan from '@/pages/admin/RestructureLoan'
import AdminCompanyAccounts from '@/pages/admin/CompanyAccounts'
import AdminResetPassword   from '@/pages/admin/ResetPassword'

// Agent
import AgentDashboard      from '@/pages/agent/Dashboard'
import AgentClients        from '@/pages/agent/Clients'
import AgentCreateClient   from '@/pages/agent/CreateClient'
import AgentApply          from '@/pages/agent/Apply'
import AgentRecordPayment  from '@/pages/agent/RecordPayment'
import AgentConfirmPayments from '@/pages/agent/ConfirmPayments'
import AgentVerify         from '@/pages/agent/Verify'
import AgentReports        from '@/pages/agent/Reports'
import AgentProfile        from '@/pages/agent/Profile'

// Client
import ClientDashboard  from '@/pages/client/Dashboard'
import ClientApply      from '@/pages/client/Apply'
import ClientApplyAsset from '@/pages/client/ApplyAsset'
import ClientLoans      from '@/pages/client/Loans'
import ClientPayments   from '@/pages/client/Payments'
import ClientSchedule   from '@/pages/client/Schedule'
import ClientProfile    from '@/pages/client/Profile'

// Manager
import ManagerDashboard     from '@/pages/manager/Dashboard'
import ManagerLoans         from '@/pages/manager/Loans'
import ManagerLoanDetail    from '@/pages/manager/LoanDetail'
import ManagerFormApprovals  from '@/pages/manager/FormApprovals'
import ManagerPaymentAudit  from '@/pages/manager/PaymentAudit'
import ManagerProfile       from '@/pages/manager/Profile'

// Operator
import OperatorDashboard     from '@/pages/operator/Dashboard'
import OperatorDisbursements from '@/pages/operator/Disbursements'
import OperatorQrScan        from '@/pages/operator/QrScan'
import OperatorProfile       from '@/pages/operator/Profile'

// Auditor
import AuditorDashboard from '@/pages/auditor/Dashboard'
import AuditorLoans     from '@/pages/auditor/Loans'
import AuditorPayments  from '@/pages/auditor/Payments'
import AuditorLogs      from '@/pages/auditor/Logs'
import AuditorFlags     from '@/pages/auditor/Flags'
import AuditorReports   from '@/pages/auditor/Reports'

// Security
import SecurityDashboard from '@/pages/security/Dashboard'
import SecurityBlocked   from '@/pages/security/Blocked'
import SecuritySessions  from '@/pages/security/Sessions'
import SecurityThreats   from '@/pages/security/Threats'
import SecurityReports   from '@/pages/security/Reports'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AppInit({ children }) {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [init])
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppInit>
          <Routes>
            {/* Auth */}
            <Route element={<AuthLayout/>}>
              <Route path="/login"    element={<Login/>}/>
              <Route path="/register" element={<Register/>}/>
            </Route>

            {/* Admin */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['super_admin']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index               element={<AdminDashboard/>}/>
              <Route path="loans"        element={<AdminLoans/>}/>
              <Route path="loans/:id"    element={<AdminLoanDetail/>}/>
              <Route path="clients"      element={<AdminClients/>}/>
              <Route path="payments"     element={<AdminPayments/>}/>
              <Route path="agents"       element={<AdminAgents/>}/>
              <Route path="managers"     element={<AdminManagers/>}/>
              <Route path="operators"    element={<AdminOperators/>}/>
              <Route path="auditors"     element={<AdminAuditors/>}/>
              <Route path="users"        element={<AdminUsers/>}/>
              <Route path="analytics"    element={<AdminAnalytics/>}/>
              <Route path="audit-logs"   element={<AdminAuditLogs/>}/>
              <Route path="kyc-test"     element={<AdminKycTest/>}/>
              <Route path="blacklist"    element={<AdminBlacklist/>}/>
              <Route path="zones"               element={<AdminZones/>}/>
              <Route path="settings"            element={<AdminSettings/>}/>
              <Route path="loans/:id/repayments" element={<AdminRepaymentHistory/>}/>
              <Route path="loans/:id/restructure" element={<AdminRestructureLoan/>}/>
              <Route path="salary"              element={<AdminSalary/>}/>
              <Route path="company-accounts"    element={<AdminCompanyAccounts/>}/>
              <Route path="reset-password"      element={<AdminResetPassword/>}/>
            </Route>

            {/* Agent */}
            <Route path="/agent" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index                    element={<AgentDashboard/>}/>
              <Route path="clients"           element={<AgentClients/>}/>
              <Route path="create-client"     element={<AgentCreateClient/>}/>
              <Route path="apply"             element={<AgentApply/>}/>
              <Route path="record-payment"    element={<AgentRecordPayment/>}/>
              <Route path="confirm-payments"  element={<AgentConfirmPayments/>}/>
              <Route path="verify"            element={<AgentVerify/>}/>
              <Route path="reports"           element={<AgentReports/>}/>
              <Route path="profile"           element={<AgentProfile/>}/>
            </Route>

            {/* Client */}
            <Route path="/client" element={
              <ProtectedRoute roles={['client']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index               element={<ClientDashboard/>}/>
              <Route path="apply"        element={<ClientApply/>}/>
              <Route path="apply-asset"  element={<ClientApplyAsset/>}/>
              <Route path="loans"        element={<ClientLoans/>}/>
              <Route path="payments"     element={<ClientPayments/>}/>
              <Route path="schedule"     element={<ClientSchedule/>}/>
              <Route path="profile"      element={<ClientProfile/>}/>
            </Route>

            {/* Manager */}
            <Route path="/manager" element={
              <ProtectedRoute roles={['manager']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index                   element={<ManagerDashboard/>}/>
              <Route path="loans"            element={<ManagerLoans/>}/>
              <Route path="loans/:id"        element={<ManagerLoanDetail/>}/>
              <Route path="form-approvals"   element={<ManagerFormApprovals/>}/>
              <Route path="payment-audit"    element={<ManagerPaymentAudit/>}/>
              <Route path="profile"          element={<ManagerProfile/>}/>
            </Route>

            {/* Operator */}
            <Route path="/operator" element={
              <ProtectedRoute roles={['operator']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index                  element={<OperatorDashboard/>}/>
              <Route path="disbursements"   element={<OperatorDisbursements/>}/>
              <Route path="qr-scan"         element={<OperatorQrScan/>}/>
              <Route path="profile"         element={<OperatorProfile/>}/>
            </Route>

            {/* Auditor */}
            <Route path="/auditor" element={
              <ProtectedRoute roles={['auditor']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index            element={<AuditorDashboard/>}/>
              <Route path="loans"     element={<AuditorLoans/>}/>
              <Route path="payments"  element={<AuditorPayments/>}/>
              <Route path="logs"      element={<AuditorLogs/>}/>
              <Route path="flags"     element={<AuditorFlags/>}/>
              <Route path="reports"   element={<AuditorReports/>}/>
            </Route>

            {/* Security */}
            <Route path="/security" element={
              <ProtectedRoute roles={['security_officer']}>
                <AppLayout/>
              </ProtectedRoute>
            }>
              <Route index            element={<SecurityDashboard/>}/>
              <Route path="blocked"   element={<SecurityBlocked/>}/>
              <Route path="sessions"  element={<SecuritySessions/>}/>
              <Route path="threats"   element={<SecurityThreats/>}/>
              <Route path="reports"   element={<SecurityReports/>}/>
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace/>}/>
            <Route path="*" element={<Navigate to="/login" replace/>}/>
          </Routes>
        </AppInit>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
