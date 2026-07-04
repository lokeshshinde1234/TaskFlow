import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiEye, FiFlag } from 'react-icons/fi';
import PayslipPreviewModal from '../components/salary/PayslipPreviewModal';
import SalaryAnalyticsChart from '../components/salary/SalaryAnalyticsChart';
import SalaryAnomalyBanner from '../components/salary/SalaryAnomalyBanner';
import { platformAPI, salaryAPI } from '../services/api';
import { currentMonthValue, formatMoney } from '../utils/salaryCalculations';

export default function SuperAdminSalaryPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({ company_id: '', month: currentMonthValue(), status: '' });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [recordsResponse, analyticsResponse, companiesResponse] = await Promise.all([
      salaryAPI.adminRecords({
        company_id: filters.company_id || undefined,
        month: filters.month || undefined,
        status: filters.status || undefined,
      }),
      salaryAPI.adminAnalytics(),
      platformAPI.listCompanies().catch(() => ({ data: [] })),
    ]);
    setRecords(recordsResponse.data);
    setAnalytics(analyticsResponse.data);
    setCompanies(companiesResponse.data);
  }, [filters.company_id, filters.month, filters.status]);

  useEffect(() => {
    load().catch((error) => setMessage(error.response?.data?.detail || 'Unable to load salary data.'));
  }, [load]);

  const currentMonthPayroll = useMemo(() => records.reduce((sum, row) => sum + Number(row.net_salary || 0), 0), [records]);
  const pendingApprovals = useMemo(() => records.filter((row) => ['draft', 'processed'].includes(row.status)).length, [records]);
  const companySummary = useMemo(() => {
    const map = new Map();
    records.forEach((row) => {
      const key = row.company_id;
      const current = map.get(key) || { company_id: row.company_id, company_name: row.company_name, headcount: 0, gross: 0, deductions: 0, net: 0 };
      current.headcount += 1;
      current.gross += Number(row.gross_salary || 0);
      current.deductions += Number(row.total_deductions || 0) + Number(row.lop_deduction || 0);
      current.net += Number(row.net_salary || 0);
      map.set(key, current);
    });
    return Array.from(map.values());
  }, [records]);

  const overrideRecord = async (record) => {
    const reason = window.prompt('Reason for override / flag');
    if (!reason) return;
    try {
      await salaryAPI.adminOverride(record.id, reason);
      setMessage('Record flagged and audit logged.');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to flag record.');
    }
  };

  const downloadPayslip = async (record) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(salaryAPI.downloadPayslipUrl(record.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${record.employee_code || record.employee_id}-${record.month?.slice(0, 7)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage('Generate the payslip before downloading.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-6">
      <main className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button onClick={() => navigate('/super-admin-dashboard')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><FiArrowLeft /> Super admin dashboard</button>
          <h1 className="text-3xl font-black">Super admin salary</h1>
        </header>

        {message && <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">{message}</div>}

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ['Total companies with payroll', analytics?.total_companies_with_payroll || 0],
            ['Total payroll amount this month', `₹${formatMoney(currentMonthPayroll)}`],
            ['Total payslips processed', analytics?.total_payslips_processed || 0],
            ['Pending approvals', pendingApprovals],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
          <select value={filters.company_id} onChange={(event) => setFilters({ ...filters, company_id: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <option value="">All companies</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <input type="month" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <option value="">All statuses</option>
            {['draft', 'processed', 'approved', 'paid', 'cancelled'].map((status) => <option key={status}>{status}</option>)}
          </select>
        </section>

        <SalaryAnomalyBanner records={records} />

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>{['Company', 'Employee', 'Emp ID', 'Department', 'Month', 'Basic', 'Gross', 'Total deductions', 'LOP deduction', 'Net salary', 'Status', 'Actions'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-3">{record.company_name}</td>
                    <td className="px-3 py-3 font-semibold">{record.employee_name}</td>
                    <td className="px-3 py-3">{record.employee_code}</td>
                    <td className="px-3 py-3">{record.department}</td>
                    <td className="px-3 py-3">{record.month?.slice(0, 7)}</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">₹{formatMoney(record.gross_salary)}</td>
                    <td className="px-3 py-3 text-red-600">₹{formatMoney(record.total_deductions)}</td>
                    <td className="px-3 py-3 text-red-600">₹{formatMoney(record.lop_deduction)}</td>
                    <td className="px-3 py-3 font-black text-emerald-600">₹{formatMoney(record.net_salary)}</td>
                    <td className="px-3 py-3">{record.status}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setPreview(record)} className="rounded-md border border-slate-300 p-2"><FiEye /></button>
                        <button onClick={() => downloadPayslip(record)} className="rounded-md border border-slate-300 p-2"><FiDownload /></button>
                        <button onClick={() => overrideRecord(record)} className="rounded-md border border-amber-300 p-2 text-amber-700"><FiFlag /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!records.length && <tr><td colSpan={12} className="px-3 py-8 text-center text-slate-500">No salary records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <SalaryAnalyticsChart data={analytics?.payroll_by_company_month || []} />

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-black">Company payroll summary</h2>
          <div className="grid gap-2">
            {companySummary.map((row) => (
              <div key={row.company_id} className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800 md:grid-cols-5">
                <span className="font-bold">{row.company_name}</span>
                <span>Headcount: {row.headcount}</span>
                <span>Gross: ₹{formatMoney(row.gross)}</span>
                <span>Deductions: ₹{formatMoney(row.deductions)}</span>
                <span>Net: ₹{formatMoney(row.net)}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PayslipPreviewModal record={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
