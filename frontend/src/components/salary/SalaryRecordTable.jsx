import React from 'react';
import { formatMoney } from '../../utils/salaryCalculations';

export default function SalaryRecordTable({ records, onView, onEdit, onGenerate, onSend, onPaid }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black">Salary records</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {['Employee', 'Month', 'Working days', 'Present', 'Absent', 'Gross', 'Deductions', 'Net', 'Status', 'Actions'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold">{record.employee_name || record.employee_id}</td>
                <td className="px-3 py-3">{record.month?.slice(0, 7)}</td>
                <td className="px-3 py-3">{record.working_days}</td>
                <td className="px-3 py-3">{record.days_present}</td>
                <td className="px-3 py-3">{record.days_absent}</td>
                <td className="px-3 py-3">₹{formatMoney(record.gross_salary)}</td>
                <td className="px-3 py-3 text-red-600">₹{formatMoney((record.total_deductions || 0) + (record.lop_deduction || 0))}</td>
                <td className="px-3 py-3 font-black text-emerald-600">₹{formatMoney(record.net_salary)}</td>
                <td className="px-3 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold dark:bg-slate-800">{record.status}</span></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onView(record)} className="rounded-md border border-slate-300 px-2 py-1 font-semibold">View</button>
                    {record.status === 'draft' && <button onClick={() => onEdit(record)} className="rounded-md border border-cyan-300 px-2 py-1 font-semibold text-cyan-700">Edit</button>}
                    <button onClick={() => onGenerate(record)} className="rounded-md border border-purple-300 px-2 py-1 font-semibold text-purple-700">PDF</button>
                    <button onClick={() => onSend(record)} className="rounded-md border border-blue-300 px-2 py-1 font-semibold text-blue-700">Send</button>
                    {record.status !== 'paid' && <button onClick={() => onPaid(record)} className="rounded-md border border-emerald-300 px-2 py-1 font-semibold text-emerald-700">Paid</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!records.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">No salary records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
