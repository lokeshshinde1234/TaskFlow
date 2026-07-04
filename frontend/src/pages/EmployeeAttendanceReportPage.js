import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiLogOut, FiMoon, FiRefreshCw, FiSun } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { attendanceAPI, authAPI, employeeAPI, salaryAPI } from '../services/api';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime';

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function EmployeeAttendanceReportPage() {
  const { employeeId, companyId } = useParams();
  const navigate = useNavigate();
  const { user, logout, theme, toggleTheme } = useContext(AuthContext);
  const isDark = theme === 'dark';
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const targetEmployeeId = employeeId || user?.employee_id;
  const backPath = useMemo(() => {
    if (user?.role === 'super_admin' && companyId) return `/super-admin-dashboard/company/${companyId}`;
    if (user?.role === 'founder_admin') return '/admin-dashboard';
    return '/employee-dashboard';
  }, [companyId, user?.role]);

  const loadReport = useCallback(async () => {
    if (!targetEmployeeId) return;
    setLoading(true);
    setMessage('');
    try {
      const [employeeResponse, attendanceResponse, salaryResponse] = await Promise.all([
        employeeAPI.getEmployee(targetEmployeeId).catch(() => ({ data: null })),
        attendanceAPI.getAttendance(targetEmployeeId),
        salaryAPI.listRecords({ employee_id: targetEmployeeId }).catch(() => ({ data: [] })),
      ]);
      setEmployee(employeeResponse.data);
      setAttendance(attendanceResponse.data);
      setSalaries(salaryResponse.data);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to load attendance report.');
    } finally {
      setLoading(false);
    }
  }, [targetEmployeeId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const downloadAttendance = () => {
    const name = employee ? `${employee.first_name}-${employee.last_name}` : `employee-${targetEmployeeId}`;
    downloadCsv(`attendance-${name}.csv`, [
      ['Company', 'Employee', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Status', 'Late Mark', 'Late Reason', 'Checkout Type', 'Checkout Reason', 'Auto Checkout At', 'Company Start Time', 'Company End Time'],
      ...attendance.map((row) => [
        row.company_name || employee?.company_name || '',
        row.employee_name || (employee ? `${employee.first_name} ${employee.last_name}` : ''),
        formatLocalDate(row.date),
        formatLocalTime(row.time_in),
        formatLocalTime(row.time_out),
        row.working_hours ?? '',
        row.status,
        row.is_late ? 'Late' : '',
        row.late_reason || '',
        row.checkout_type || '',
        row.checkout_reason || '',
        formatLocalTime(row.auto_checkout_at),
        row.company_start_time || '',
        row.company_end_time || '',
      ]),
    ]);
  };

  const downloadSalary = () => {
    const name = employee ? `${employee.first_name}-${employee.last_name}` : `employee-${targetEmployeeId}`;
    downloadCsv(`salary-${name}.csv`, [
      ['Distribution Day', 'Month', 'Gross Salary', 'Attendance Salary', 'Deduction', 'LOP Deduction', 'Net Salary', 'Status', 'Payslip Sent'],
      ...salaries.map((row) => [
        '1',
        row.month?.slice(0, 7) || '',
        row.gross_salary,
        row.attendance_salary,
        row.total_deductions,
        row.lop_deduction,
        row.net_salary,
        row.status,
        row.payslip_sent_at ? 'Yes' : 'No',
      ]),
    ]);
  };

  const downloadPayslip = async (row) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(salaryAPI.downloadPayslipUrl(row.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${row.employee_code || row.employee_id}-${row.month?.slice(0, 7) || 'salary'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage('Payslip file is not available yet. Ask the Founder Admin to send it again.');
    }
  };

  const handleLogout = async () => {
    await authAPI.logout().catch(() => null);
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="tf-mesh-page min-h-screen text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(backPath)} className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 dark:border-slate-700 dark:bg-white/10 dark:text-slate-200">
              <FiArrowLeft />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-500">Attendance report</p>
              <h1 className="text-xl font-black">
                {employee ? `${employee.first_name} ${employee.last_name}` : 'Employee'}
                {employee?.employee_id ? <span className="ml-2 text-sm text-slate-500">#{employee.employee_id}</span> : null}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadReport} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-white/10">
              <FiRefreshCw /> Refresh
            </button>
            <button type="button" onClick={toggleTheme} className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 dark:border-slate-700 dark:bg-white/10 dark:text-slate-200">
              {isDark ? <FiSun /> : <FiMoon />}
            </button>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
              <FiLogOut /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {message && <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
            <p className="text-sm text-slate-500">Attendance records</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{attendance.length}</p>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
            <p className="text-sm text-slate-500">Salary distribution date</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">1st of every month</p>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
            <p className="text-sm text-slate-500">Latest status</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {attendance[0]?.time_out ? 'Checked out' : attendance[0]?.is_late ? 'Late' : attendance[0]?.status || (employee?.work_status === 'active' ? 'Present' : 'Inactive')}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="font-black dark:text-white">Daily attendance sheet</h2>
            <button type="button" onClick={downloadAttendance} disabled={!attendance.length} className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <FiDownload /> Download CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                  <th className="px-4 py-3">Working Hours</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Late Mark</th>
                  <th className="px-4 py-3">Late Reason</th>
                  <th className="px-4 py-3">Checkout Type</th>
                  <th className="px-4 py-3">Checkout Reason</th>
                  <th className="px-4 py-3">Auto Checkout At</th>
                  <th className="px-4 py-3">Start Time</th>
                  <th className="px-4 py-3">End Time</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">{row.company_name || employee?.company_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{formatLocalDate(row.date)}</td>
                    <td className="px-4 py-3">{formatLocalTime(row.time_in)}</td>
                    <td className="px-4 py-3">{formatLocalTime(row.time_out)}</td>
                    <td className="px-4 py-3">{row.working_hours ? `${row.working_hours} hrs` : '-'}</td>
                    <td className="px-4 py-3">{row.time_out ? 'Checked out' : row.status}</td>
                    <td className="px-4 py-3">{row.is_late ? 'Late Mark' : '-'}</td>
                    <td className="px-4 py-3">{row.late_reason || '-'}</td>
                    <td className="px-4 py-3">{row.checkout_type || '-'}</td>
                    <td className="px-4 py-3">{row.checkout_reason || '-'}</td>
                    <td className="px-4 py-3">{formatLocalTime(row.auto_checkout_at)}</td>
                    <td className="px-4 py-3">{row.company_start_time || '-'}</td>
                    <td className="px-4 py-3">{row.company_end_time || '-'}</td>
                  </tr>
                ))}
                {!loading && !attendance.length && (
                  <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-500">No attendance records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="font-black dark:text-white">Salary report</h2>
              <p className="mt-1 text-sm text-slate-500">Salary is distributed on day 1 of each month.</p>
            </div>
            <button type="button" onClick={downloadSalary} disabled={!salaries.length} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <FiDownload /> Download CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Distribution Day</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Attendance Salary</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">LOP</th>
                  <th className="px-4 py-3">Net Salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">1</td>
                    <td className="px-4 py-3">{row.month?.slice(0, 7) || '-'}</td>
                    <td className="px-4 py-3">Rs {Number(row.gross_salary || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">Rs {Number(row.attendance_salary || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-600">Rs {Number(row.total_deductions || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-600">Rs {Number(row.lop_deduction || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">Rs {Number(row.net_salary || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {row.payslip_sent_at || row.payslip_pdf_url ? (
                        <button type="button" onClick={() => downloadPayslip(row)} className="inline-flex items-center gap-2 rounded-md border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 dark:text-violet-200">
                          <FiFileText /> Download
                        </button>
                      ) : (
                        <span className="text-slate-500">Not sent</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && !salaries.length && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No salary records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
