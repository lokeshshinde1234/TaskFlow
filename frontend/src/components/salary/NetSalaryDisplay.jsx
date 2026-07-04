import React from 'react';
import { formatMoney } from '../../utils/salaryCalculations';

export default function NetSalaryDisplay({ value }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
      <p className="text-sm font-black uppercase tracking-[0.18em]">Net salary payable</p>
      <p className="mt-2 text-4xl font-black">Rs {formatMoney(value)}</p>
      <p className="mt-1 text-sm">attendance salary - deductions - LOP deduction</p>
    </section>
  );
}
