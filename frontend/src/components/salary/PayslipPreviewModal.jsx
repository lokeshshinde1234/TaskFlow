import React from 'react';
import { formatMoney } from '../../utils/salaryCalculations';

export default function PayslipPreviewModal({ record, onClose }) {
  if (!record) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Payslip preview</h2>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1 font-semibold">Close</button>
        </div>
        <div className="mt-5 grid gap-4">
          <div className="rounded-md bg-slate-50 p-4 dark:bg-slate-800">
            <p className="font-black">TaskFlow Payslip</p>
            <p>{record.employee_name} / {record.employee_code}</p>
            <p>Pay period: {record.month?.slice(0, 7)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="font-black">Earnings</h3>
              <p className="mt-2 flex justify-between"><span>Gross</span><span>₹{formatMoney(record.gross_salary)}</span></p>
              <p className="flex justify-between"><span>Attendance salary</span><span>₹{formatMoney(record.attendance_salary)}</span></p>
              <p className="flex justify-between"><span>Overtime pay</span><span>₹{formatMoney(record.overtime_pay)}</span></p>
            </div>
            <div className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="font-black">Deductions</h3>
              <p className="mt-2 flex justify-between"><span>PF</span><span>₹{formatMoney(record.pf_deduction)}</span></p>
              <p className="flex justify-between"><span>ESI</span><span>₹{formatMoney(record.esi_deduction)}</span></p>
              <p className="flex justify-between"><span>Tax + other</span><span>₹{formatMoney((record.total_deductions || 0) - (record.pf_deduction || 0) - (record.esi_deduction || 0))}</span></p>
              <p className="flex justify-between"><span>LOP</span><span>₹{formatMoney(record.lop_deduction)}</span></p>
            </div>
          </div>
          <div className="rounded-md bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-100">
            <p className="text-sm font-bold uppercase">Net salary</p>
            <p className="text-3xl font-black">₹{formatMoney(record.net_salary)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
