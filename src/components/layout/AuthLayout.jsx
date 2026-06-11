import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4"
         style={{background:'linear-gradient(135deg,#071007 0%,#0a1f0a 55%,#112811 100%)'}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-display text-3xl font-bold text-white mb-2">
            FTI<span className="text-brand-400">Loan</span>
          </div>
          <p className="text-white/50 text-sm">Fast. Trusted. Inclusive.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Outlet/>
        </div>
      </div>
    </div>
  )
}
