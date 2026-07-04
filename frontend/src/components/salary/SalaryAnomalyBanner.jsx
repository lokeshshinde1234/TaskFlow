import React from 'react';

export default function SalaryAnomalyBanner({ records }) {
  const alerts = [];
  const byEmployeeMonth = new Map();
  records.forEach((record) => {
    const key = `${record.employee_id}-${record.month}`;
    byEmployeeMonth.set(key, (byEmployeeMonth.get(key) || 0) + 1);
    if (Number(record.net_salary) === 0) alerts.push(`Net salary is zero for ${record.employee_name || record.employee_id}.`);
  });
  byEmployeeMonth.forEach((count, key) => {
    if (count > 1) alerts.push(`Duplicate salary records detected for ${key}.`);
  });

  if (!alerts.length) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
      {alerts.slice(0, 4).map((alert) => <p key={alert}>{alert}</p>)}
    </div>
  );
}
