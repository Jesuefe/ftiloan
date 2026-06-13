// FTI Logo — uses the actual brand colors from the logo image
// navy #1B2A6B + mint #00D48F
export function FTILogo({ size = 32, className = '' }) {
  return (
    <img
      src="/fti-logo.png"
      alt="FTI Loan"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  )
}

export function FTIWordmark({ className = '', light = false }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <FTILogo size={28}/>
      <div className={`font-bold text-lg leading-none ${light ? 'text-white' : 'text-[#1B2A6B]'}`}>
        FTI<span className="text-[#00D48F]">Loan</span>
      </div>
    </div>
  )
}
