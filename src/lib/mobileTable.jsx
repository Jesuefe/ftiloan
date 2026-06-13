// Shared mobile-responsive table wrapper
// Usage: wrap your table with <MobileTable cols={...} rows={...} />
// Or use the MobileCardList for pure card lists

export function TableWrapper({ children, mobileCards }) {
  return (
    <>
      <div className="lg:hidden">{mobileCards}</div>
      <div className="hidden lg:block overflow-x-auto">{children}</div>
    </>
  )
}
