import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiFileText, FiPlay, FiSave, FiSend } from 'react-icons/fi';
import AttendanceInfoBar from '../components/salary/AttendanceInfoBar';
import EmployeeSalarySelector from '../components/salary/EmployeeSalarySelector';
import PayslipPreviewModal from '../components/salary/PayslipPreviewModal';
import SalaryRecordTable from '../components/salary/SalaryRecordTable';
import SalaryStructureForm from '../components/salary/SalaryStructureForm';
import { employeeAPI, salaryAPI } from '../services/api';
import { currentMonthValue, recalculateSalary } from '../utils/salaryCalculations';

const blankForm = {
  basic: '',
  hra: '',
  special_allowance: '',
  travel_allowance: '',
  medical_allowance: '',
  overtime_hours: 0,
  overtime_pay: 0,
  pf_rate: 12,
  esi_rate: 0.75,
  professional_tax: 200,
  tds_deduction: 0,
  loan_deduction: 0,
  other_deductions: 0,
  working_days: '',
  days_present: '',
  days_absent: '',
  paid_leaves_used: 0,
  late_count: 0,
};

export default function SalaryPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(currentMonthValue());
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [monthlyNetSalary, setMonthlyNetSalary] = useState(null);

  const selectedEmployee = useMemo(() => employees.find((employee) => Number(employee.id) === Number(employeeId)), [employees, employeeId]);
  const calculated = useMemo(() => recalculateSalary(form), [form]);

  const loadRecords = useCallback(async () => {
    const response = await salaryAPI.listRecords({ month });
    setRecords(response.data);
  }, [month]);

  useEffect(() => {
    employeeAPI.getAllEmployees().then((response) => setEmployees(response.data)).catch(() => setMessage('Unable to load employees.'));
  }, []);

  useEffect(() => {
    loadRecords().catch(() => null);
  }, [loadRecords]);

  const loadEmployeeSalary = async (nextEmployeeId = employeeId, nextMonth = month) => {
    if (!nextEmployeeId) {
      setSummary(null);
      setForm(blankForm);
      setMonthlyNetSalary(null);
      return;
    }
    setMessage('');
    setMonthlyNetSalary(null);
    try {
      const [summaryResponse, structureResponse] = await Promise.all([
        salaryAPI.attendanceSummary(nextEmployeeId, nextMonth),
        salaryAPI.getStructure(nextEmployeeId).catch(() => ({ data: null })),
      ]);
      const nextSummary = summaryResponse.data;
      const nextStructure = structureResponse.data;
      setSummary(nextSummary);
      setForm({
        ...blankForm,
        ...(nextStructure || {}),
        tds_deduction: nextStructure?.tds_monthly || 0,
        working_days: nextSummary.working_days,
        days_present: nextSummary.days_present,
        days_absent: nextSummary.days_absent,
        paid_leaves_used: nextSummary.paid_leaves_used || 0,
        overtime_hours: nextSummary.overtime_hours || 0,
        late_count: nextSummary.late_count || 0,
      });
      if (!nextStructure) {
        setMessage('No active salary structure found. Enter components and save the structure before payroll.');
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to auto-fill salary data.');
    }
  };

  const changeEmployee = (value) => {
    setEmployeeId(value);
    loadEmployeeSalary(value, month);
  };

  const changeMonth = (value) => {
    setMonth(value);
    setMonthlyNetSalary(null);
    if (employeeId) loadEmployeeSalary(employeeId, value);
  };

  const saveStructure = async () => {
    if (!employeeId) return null;
    try {
      const response = await salaryAPI.saveStructure({
        employee_id: Number(employeeId),
        basic: Number(form.basic || 0),
        hra: Number(form.hra || 0),
        special_allowance: Number(form.special_allowance || 0),
        travel_allowance: Number(form.travel_allowance || 0),
        medical_allowance: Number(form.medical_allowance || 0),
        pf_rate: Number(form.pf_rate || 12),
        esi_rate: Number(form.esi_rate || 0.75),
        professional_tax: Number(form.professional_tax || 200),
        tds_monthly: Number(form.tds_deduction || 0),
        effective_from: `${month}-01T00:00:00`,
      });
      setMessage('Salary structure saved.');
      return response.data;
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to save salary structure.');
      return null;
    }
  };

  const calculateOnServer = async () => {
    const response = await salaryAPI.calculate({
      employee_id: Number(employeeId),
      month,
      paid_leaves_used: Number(form.paid_leaves_used || 0),
      overtime_hours: Number(form.overtime_hours || 0),
      overtime_pay: Number(calculated.overtime_pay || 0),
      loan_deduction: Number(form.loan_deduction || 0),
      other_deductions: Number(form.other_deductions || 0),
    });
    return response.data;
  };

  const calculateMonthlySalary = async () => {
    if (!employeeId) return;
    setMessage('');
    try {
      const currentStructure = await saveStructure();
      if (!currentStructure) return;
      const serverCalculated = await calculateOnServer();
      setForm((current) => ({
        ...current,
        ...serverCalculated,
        tds_deduction: serverCalculated.tds_deduction ?? current.tds_deduction,
        loan_deduction: serverCalculated.loan_deduction ?? current.loan_deduction,
        other_deductions: serverCalculated.other_deductions ?? current.other_deductions,
      }));
      setMonthlyNetSalary(serverCalculated);
      setMessage('Monthly net salary calculated.');
    } catch (error) {
      setMonthlyNetSalary(null);
      setMessage(error.response?.data?.detail || 'Unable to calculate monthly salary.');
    }
  };

  const saveDraft = async () => {
    if (!employeeId) return null;
    const savedStructure = await saveStructure();
    if (!savedStructure) {
      return;
    }
    try {
      const serverCalculated = await calculateOnServer();
      const response = await salaryAPI.saveRecord({ ...serverCalculated, month, salary_structure_id: savedStructure.id });
      setMessage('Draft salary record saved.');
      await loadRecords();
      return response.data;
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to save draft.');
      return null;
    }
  };

  const processPayroll = async () => {
    const record = await saveDraft();
    if (!record) return;
    try {
      await salaryAPI.processRecord(record.id);
      setMessage('Payroll processed.');
      await loadRecords();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to process payroll.');
    }
  };

  const generatePayslip = async (record) => {
    try {
      const response = await salaryAPI.generatePayslip(record.id);
      setMessage('Payslip PDF generated.');
      await loadRecords();
      return response.data;
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to generate payslip.');
      return null;
    }
  };

  const sendPayslip = async (record) => {
    try {
      await salaryAPI.generatePayslip(record.id).catch(() => null);
      await salaryAPI.sendPayslip(record.id, 'email');
      setMessage('Payslip sent to employee.');
      await loadRecords();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to send payslip.');
    }
  };

  const markPaid = async (record) => {
    try {
      let current = record;
      if (current.status === 'draft') current = (await salaryAPI.processRecord(current.id)).data;
      if (current.status === 'processed') current = (await salaryAPI.approveRecord(current.id)).data;
      await salaryAPI.markPaid(current.id);
      setMessage('Salary marked as paid.');
      await loadRecords();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Unable to mark paid.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-6">
      <main className="mx-auto grid max-w-7xl gap-5">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button onClick={() => navigate('/admin-dashboard')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><FiArrowLeft /> Admin dashboard</button>
            <h1 className="text-3xl font-black">Salary management</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="month" value={month} onChange={(event) => changeMonth(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
            <button onClick={processPayroll} disabled={!employeeId} className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 font-bold text-white disabled:opacity-50"><FiPlay /> Run payroll</button>
          </div>
        </header>

        {message && <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">{message}</div>}

        <EmployeeSalarySelector employees={employees} employeeId={employeeId} month={month} onEmployeeChange={changeEmployee} onMonthChange={changeMonth} />
        <AttendanceInfoBar month={month} summary={summary} />

        {employeeId && (
          <>
            <SalaryStructureForm employee={selectedEmployee} form={form} onChange={(nextForm) => { setForm(nextForm); setMonthlyNetSalary(null); }} calculatedSalary={monthlyNetSalary} />
            <div className="flex flex-wrap gap-2">
              <button onClick={calculateMonthlySalary} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-3 font-bold text-white"><FiPlay /> Calculate</button>
              <button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-3 font-bold text-white dark:bg-white dark:text-slate-950"><FiSave /> Save draft</button>
              <button onClick={processPayroll} className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-3 font-bold text-white"><FiPlay /> Process payroll</button>
              <button onClick={() => setSelectedPreview({ ...calculated, employee_name: `${selectedEmployee?.first_name || ''} ${selectedEmployee?.last_name || ''}`, employee_code: selectedEmployee?.employee_id, month })} className="inline-flex items-center gap-2 rounded-md border border-purple-300 px-4 py-3 font-bold text-purple-700"><FiFileText /> Preview payslip PDF</button>
              <button onClick={async () => { const record = await saveDraft(); if (record) await sendPayslip(record); }} className="inline-flex items-center gap-2 rounded-md border border-blue-300 px-4 py-3 font-bold text-blue-700"><FiSend /> Send to employee</button>
            </div>
          </>
        )}

        <SalaryRecordTable records={records} onView={setSelectedPreview} onEdit={(record) => { setEmployeeId(String(record.employee_id)); setForm({ ...form, ...record }); }} onGenerate={generatePayslip} onSend={sendPayslip} onPaid={markPaid} />
      </main>
      <PayslipPreviewModal record={selectedPreview} onClose={() => setSelectedPreview(null)} />
    </div>
  );
}
