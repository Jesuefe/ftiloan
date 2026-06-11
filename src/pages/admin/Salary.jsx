import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { formatNaira } from '@/lib/utils'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

export default function AdminSalary() {
  const qc = useQueryClient()
  const [flash, setFlash]   = useState(null)
  const [editing, setEditing] = useState(null)
  const [salaryVal, setSalaryVal] = useState('')

  const { data: staff } = useQuery({
    queryKey: ['staff-salaries'],
    queryFn: async () => {
      const { data: users } = await supabase.from('users')
        .select('id,first_name,last_name,role,status,staff_code')
        .in('role',['super_admin','manager','agent','auditor','operator','security_officer'])
        .order('role').order('first_name')

      const { data: salaries } = await supabase.from('staff_salaries').select('*')
      const salMap = {}
      salaries?.forEach(s => { salMap[s.user_id] = s.salary })

      return users?.map(u => ({ ...u, salary: salMap[u.id] || 0 })) || []
    },
  })

  const { data: monthlyRecovery } = useQuery({
    queryKey: ['monthly-recovery'],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
      const end   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
      const { data } = await supabase.from('repayment_schedule')
        .select('amount_due')
        .in('status',['pending','overdue','partial'])
        .gte('due_date', start).lte('due_date', end)
      return data?.reduce((s,r) => s+Number(r.amount_due),0) || 0
    },
  })

  const totalSalary = staff?.reduce((s,u) => s+Number(u.salary),0) || 0
  const surplus     = (monthlyRecovery||0) - totalSalary

  const save = useMutation({
    mutationFn: async ({ userId, salary }) => {
      const { error } = await supabase.from('staff_salaries')
        .upsert({ user_id: userId, salary: Number(salary) }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-salaries'] })
      setEditing(null); setSalaryVal('')
      setFlash({ type:'success', msg:'Salary updated.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const roleColor = r => ({ super_admin:'purple',manager:'blue',agent:'green',auditor:'amber',operator:'gray',security_officer:'red' }[r]||'gray')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign size={20} className="text-brand-600"/> Salary Management
        </h1>
        <p className="text-sm text-gray-500">Staff salaries vs monthly loan recovery</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-green-600"/>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">{formatNaira(monthlyRecovery||0)}</div>
              <div className="text-xs text-gray-500">Expected Recovery This Month</div>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <TrendingDown size={18} className="text-red-600"/>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">{formatNaira(totalSalary)}</div>
              <div className="text-xs text-gray-500">Total Monthly Salaries</div>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${surplus>=0?'bg-green-50':'bg-red-50'} rounded-lg flex items-center justify-center`}>
              <DollarSign size={18} className={surplus>=0?'text-green-600':'text-red-600'}/>
            </div>
            <div>
              <div className={`text-lg font-bold ${surplus>=0?'text-green-600':'text-red-600'}`}>{formatNaira(Math.abs(surplus))}</div>
              <div className="text-xs text-gray-500">{surplus>=0?'Surplus':'Deficit'}</div>
            </div>
          </div>
        </CardBody></Card>
      </div>

      {/* Staff table */}
      <Card>
        <CardHeader><div className="font-bold">Staff Salaries</div></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['Name','Staff Code','Role','Monthly Salary',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {staff?.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-600">{u.staff_code||'—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                      {u.role?.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {Number(u.salary) > 0 ? formatNaira(u.salary) : <span className="text-gray-400">Not set</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(u); setSalaryVal(u.salary||'') }}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Set Salary — ${editing?.first_name} ${editing?.last_name}`}>
        <Input label="Monthly Salary (₦)" type="number" value={salaryVal} onChange={e => setSalaryVal(e.target.value)} placeholder="0"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate({ userId: editing.id, salary: salaryVal })}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
