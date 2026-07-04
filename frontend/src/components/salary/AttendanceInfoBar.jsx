import React from 'react';

export default function AttendanceInfoBar({ month, summary }) {
  if (!summary) return null;
  const label = month ? new Date(`${month}-01T00:00:00`).toLocaleString(undefined, { month: 'long', year: 'numeric' }) : 'selected month';
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100">
      Auto-filled from attendance records for {label}. Present: {summary.days_present} days | Absent: {summary.days_absent} days | Working days: {summary.working_days}
    </div>
  );
}
