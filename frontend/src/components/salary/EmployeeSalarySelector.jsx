import React from 'react';

export default function EmployeeSalarySelector({ employees, employeeId, month, onEmployeeChange, onMonthChange, disabled }) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_220px]">
      <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Select employee
        <select
          value={employeeId}
          onChange={(event) => onEmployeeChange(event.target.value)}
          disabled={disabled}
          className="rounded-md border border-slate-300 bg-white px-3 py-3 text-slate-950 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Search employee by name or code</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.first_name} {employee.last_name} / {employee.employee_id}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Select month
        <input
          type="month"
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-3 text-slate-950 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </label>
    </section>
  );
}
