import React, { useMemo } from 'react';
import NetSalaryDisplay from './NetSalaryDisplay';
import { formatMoney, recalculateSalary } from '../../utils/salaryCalculations';

const editableFields = [
  ['basic', 'Basic salary'],
  ['hra', 'HRA'],
  ['special_allowance', 'Special allowance'],
  ['travel_allowance', 'Travel allowance'],
  ['medical_allowance', 'Medical allowance'],
  ['overtime_hours', 'Overtime hours'],
  ['paid_leaves_used', 'Paid leaves used'],
  ['pf_rate', 'PF rate (%)'],
  ['esi_rate', 'ESI rate (%)'],
  ['professional_tax', 'Professional tax'],
  ['tds_deduction', 'TDS / income tax'],
  ['loan_deduction', 'Loan / advance deduction'],
  ['other_deductions', 'Other deductions'],
];

function Input({ label, value, onChange, readOnly, tone = 'white' }) {
  const toneClass = tone === 'teal'
    ? 'bg-teal-50 border-teal-200 dark:bg-teal-400/10 dark:border-teal-400/20'
    : tone === 'purple'
      ? 'bg-purple-50 border-purple-200 dark:bg-purple-400/10 dark:border-purple-400/20'
      : tone === 'red'
        ? 'bg-red-50 border-red-200 dark:bg-red-400/10 dark:border-red-400/20'
        : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-700';
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        readOnly={readOnly}
        className={`rounded-md border px-3 py-2 text-slate-950 outline-none dark:text-white ${toneClass}`}
      />
    </label>
  );
}

function Panel({ title, children, tone = 'white' }) {
  const cls = tone === 'teal' ? 'border-teal-200 bg-teal-50 dark:border-teal-400/20 dark:bg-teal-400/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
  return <section className={`rounded-lg border p-4 shadow-sm ${cls}`}><h2 className="mb-4 font-black">{title}</h2>{children}</section>;
}

export default function SalaryStructureForm({ employee, form, onChange, calculatedSalary }) {
  const calculated = useMemo(() => recalculateSalary(form), [form]);
  const displaySalary = calculatedSalary || calculated;
  const update = (key, value) => onChange({ ...form, [key]: value });
  const overtimeAutoPay = calculated.overtime_pay || 0;

  return (
    <div className="grid gap-4">
      <Panel title="Employee info" tone="teal">
        <div className="grid gap-3 md:grid-cols-4">
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Employee</p><p className="font-bold">{employee?.first_name} {employee?.last_name}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Employee ID</p><p className="font-bold">{employee?.employee_id}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Department</p><p className="font-bold">{employee?.department}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Designation</p><p className="font-bold">{employee?.position}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Working days</p><p className="font-bold">{form.working_days || 0}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Days present</p><p className="font-bold">{form.days_present || 0}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Days absent</p><p className="font-bold">{form.days_absent || 0}</p></div>
          <div><p className="text-xs text-slate-600 dark:text-slate-300">Late arrivals</p><p className="font-bold">{form.late_count || 0}</p></div>
        </div>
      </Panel>

      <Panel title="Basic salary components">
        <div className="grid gap-3 md:grid-cols-3">
          {editableFields.slice(0, 6).map(([key, label]) => (
            <Input key={key} label={label} value={key === 'overtime_hours' ? form.overtime_hours : form[key]} onChange={(value) => update(key, value)} />
          ))}
          <Input label="Overtime pay" value={overtimeAutoPay} onChange={(value) => update('overtime_pay', value)} readOnly tone="teal" />
          <Input label="Gross salary" value={calculated.gross_salary} onChange={() => null} readOnly tone="purple" />
          <Input label="Per-day rate" value={calculated.per_day_rate} onChange={() => null} readOnly tone="teal" />
        </div>
      </Panel>

      <Panel title="Attendance-linked calculation">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Days present" value={form.days_present} onChange={() => null} readOnly tone="teal" />
          <Input label="Days absent" value={form.days_absent} onChange={() => null} readOnly tone="teal" />
          <Input label="Paid leaves used" value={form.paid_leaves_used} onChange={(value) => update('paid_leaves_used', value)} />
          <Input label="Payable days" value={calculated.payable_days} onChange={() => null} readOnly tone="teal" />
          <Input label="LOP days" value={calculated.lop_days} onChange={() => null} readOnly tone="teal" />
          <Input label="Attendance salary" value={calculated.attendance_salary} onChange={() => null} readOnly tone="purple" />
        </div>
      </Panel>

      <Panel title="Deductions">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Provident fund (PF)" value={calculated.pf_deduction} onChange={() => null} readOnly tone="teal" />
          <Input label="ESI / health insurance" value={calculated.esi_deduction} onChange={() => null} readOnly tone="teal" />
          {editableFields.slice(9).map(([key, label]) => (
            <Input key={key} label={label} value={calculated[key] ?? form[key]} onChange={(value) => update(key, value)} />
          ))}
          <Input label="PF rate (%)" value={form.pf_rate} onChange={(value) => update('pf_rate', value)} />
          <Input label="ESI rate (%)" value={form.esi_rate} onChange={(value) => update('esi_rate', value)} />
          <Input label="LOP deduction" value={calculated.lop_deduction} onChange={() => null} readOnly tone="red" />
          <Input label="Total deductions" value={calculated.total_deductions} onChange={() => null} readOnly tone="red" />
        </div>
      </Panel>

      <NetSalaryDisplay value={displaySalary.net_salary} />
      <div className="hidden">{formatMoney(displaySalary.net_salary)}</div>
    </div>
  );
}
