import { Outlet } from 'react-router-dom'
import { FTILogo } from '@/components/ui/FTILogo'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4"
         style={{background:'linear-gradient(135deg,#071007 0%,#0a1f0a 55%,#112811 100%)'}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-2">
            <FTILogo size={64} className="mb-3 drop-shadow-lg"/>
            <div className="font-bold text-3xl text-white">FTI<span className="text-[#00D48F]">Loan</span></div>
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
