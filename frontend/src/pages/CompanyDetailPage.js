import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiEdit2,
  FiLogOut,
  FiMoon,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSun,
  FiTrash2,
  FiUsers,
  FiDollarSign,
  FiCalendar,
  FiMapPin,
  FiClock,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { platformAPI } from '../services/api';

const emptyCompanyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  logo_url: '',
  description: '',
  start_time: '',
  end_time: '',
  is_active: true,
  password: '',
};

const emptyEmployeeForm = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  phone: '',
  department: '',
  position: '',
  salary: '',
  employee_id: '',
  date_of_joining: '',
  profile_image_url: '',
  is_active: true,
};

const isEmployeeCheckedIn = (employee) => Boolean(employee?.is_checked_in) || employee?.work_status === 'active';

const workStatusClass = (employee) => (
  isEmployeeCheckedIn(employee)
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
);

const workStatusLabel = (employee) => (isEmployeeCheckedIn(employee) ? 'Active' : 'Inactive');

const companyPresenceClass = (company) => (
  company?.is_online
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
);

const companyPresenceLabel = (company) => (company?.is_online ? 'Active' : 'Inactive');
const adminFieldClass = 'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/20';

export default function CompanyDetailPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { logout, theme, toggleTheme } = useContext(AuthContext);
  const isDark = theme === 'dark';

  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [locations, setLocations] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const handleError = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg || JSON.stringify(item)).join(' ');
    return fallback;
  };

  const loadCompanyDetail = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setMessage('');
    }
    try {
      const companyIdInt = parseInt(companyId, 10);
      if (isNaN(companyIdInt)) {
        if (!silent) {
          setMessage('Invalid company ID.');
          setLoading(false);
        }
        return;
      }
      const { data } = await platformAPI.getCompany(companyIdInt);
      setCompany(data.company);
      setEmployees(data.employees);
      setAnalytics(data.analytics);
      setLocations(data.locations);
      setSalaries(data.salaries);
      setCompanyForm({
        name: data.company.name,
        email: data.company.email,
        phone: data.company.phone,
        address: data.company.address,
        logo_url: data.company.logo_url || '',
        description: data.company.description || '',
        start_time: data.company.start_time || '',
        end_time: data.company.end_time || '',
        is_active: data.company.is_active,
        password: '',
      });
    } catch (err) {
      if (silent) return;
      setMessage(handleError(err, 'Unable to load company details.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadCompanyDetail();
  }, [loadCompanyDetail]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadCompanyDetail({ silent: true });
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadCompanyDetail]);

  useEffect(() => {
    const ws = new WebSocket((process.env.REACT_APP_WS_URL || 'ws://localhost:8000') + '/ws/locations');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Number(data.company_id) !== Number(companyId)) return;
        if (data.type === 'attendance_update') {
          const updatedAttendance = data.attendance;
          setAnalytics((current) => {
            if (!current?.recent_attendance || !updatedAttendance) return current;
            const exists = current.recent_attendance.some((record) => Number(record.id) === Number(updatedAttendance.id));
            const recentAttendance = exists
              ? current.recent_attendance.map((record) => (Number(record.id) === Number(updatedAttendance.id) ? updatedAttendance : record))
              : [updatedAttendance, ...current.recent_attendance].slice(0, 100);
            return { ...current, recent_attendance: recentAttendance };
          });
          return;
        }
        if (data.type === 'company_online_status') {
          setCompany((current) => current ? { ...current, is_online: data.is_online } : current);
          return;
        }
        if (data.type === 'company_update' && data.company) {
          setCompany((current) => current ? { ...current, ...data.company } : data.company);
          return;
        }
        if (data.type !== 'employee_work_status') return;
        const nextEmployee = data.employee;
        setEmployees((current) => current.map((employee) => (
          Number(employee.id) === Number(data.employee_db_id)
            ? { ...employee, ...(nextEmployee || {}), is_checked_in: data.is_checked_in, work_status: data.work_status }
            : employee
        )));
      } catch (error) {}
    };
    return () => ws.close();
  }, [companyId]);

  const refreshAll = async () => {
    await loadCompanyDetail();
  };

  const companyIdInt = parseInt(companyId, 10);

  const saveCompany = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const payload = { ...companyForm };
      if (payload.end_time && payload.start_time && payload.end_time <= payload.start_time) {
        setMessage('Company ending time must be greater than starting time.');
        return;
      }
      if (!payload.password) delete payload.password;
      await platformAPI.updateCompany(companyIdInt, payload);
      setMessage('Company updated successfully.');
      await refreshAll();
    } catch (err) {
      setMessage(handleError(err, 'Company update failed.'));
    }
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    setMessage('');
    const payload = {
      ...employeeForm,
      salary: employeeForm.salary ? Number(employeeForm.salary) : null,
      company_id: companyIdInt,
    };
    if (!payload.password) {
      delete payload.password;
    }
    if (!editingEmployeeId && !employeeForm.password) {
      setMessage('Set a login password so this employee can sign in.');
      return;
    }
    try {
      if (editingEmployeeId) {
        await platformAPI.updateEmployee(editingEmployeeId, payload);
        setMessage('Employee updated.');
      } else {
        await platformAPI.createEmployee(companyIdInt, payload);
        setMessage('Employee added.');
      }
      setEditingEmployeeId(null);
      setEmployeeForm(emptyEmployeeForm);
      await refreshAll();
    } catch (err) {
      setMessage(handleError(err, 'Employee save failed.'));
    }
  };

  const editEmployee = (employee) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      password: '',
      phone: employee.phone || '',
      department: employee.department || '',
      position: employee.position || '',
      salary: employee.salary ?? '',
      employee_id: employee.employee_id || '',
      date_of_joining: employee.date_of_joining ? new Date(employee.date_of_joining).toISOString().split('T')[0] : '',
      profile_image_url: employee.profile_image_url || '',
      is_active: employee.is_active,
    });
    setActiveTab('employees');
  };

  const cancelEditEmployee = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
  };

  const deleteEmployee = async (employeeId) => {
    if (!window.confirm('Delete this employee and their login?')) return;
    try {
      await platformAPI.deleteEmployee(employeeId);
      setMessage('Employee deleted.');
      await refreshAll();
    } catch (err) {
      setMessage(handleError(err, 'Delete failed.'));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  if (loading && !company) {
    return (
      <div className={`relative min-h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading company details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className={`relative min-h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-xl mb-4">Company not found</p>
            <Link to="/super-admin-dashboard" className="text-violet-600 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiDollarSign },
    { id: 'employees', label: 'Employees', icon: FiUsers },
    { id: 'attendance', label: 'Attendance', icon: FiClock },
    { id: 'locations', label: 'Locations', icon: FiMapPin },
    { id: 'salaries', label: 'Salaries', icon: FiCalendar },
  ];

  return (
    <div className={`relative min-h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.15),_transparent_30%)]" />

      {/* Header */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${isDark ? 'border-slate-800/80 bg-slate-950/95' : 'border-slate-200/80 bg-white/95'}`}>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/super-admin-dashboard')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
            >
              <FiArrowLeft /> Back
            </button>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-400">Company Management</p>
              <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>
                {company.name} <span className="text-slate-500 text-lg">#{company.id}</span>
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}
            >
              <FiRefreshCw /> {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button type="button" onClick={toggleTheme} className={`rounded-full border p-3 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}>
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500">
              <FiLogOut /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {message && (
          <div className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            message.includes('success') || message.includes('updated') || message.includes('added')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-200'
              : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-200'
          }`}>
            {message}
          </div>
        )}

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[
              ['Total Employees', analytics.total_employees, FiUsers, 'text-blue-500'],
              ['Active Today', analytics.active_today, FiClock, 'text-emerald-500'],
              ['Open Sessions', analytics.open_attendance_sessions, FiRefreshCw, 'text-amber-500'],
              ['Total Payroll', `$${Number(analytics.payroll_total).toLocaleString()}`, FiDollarSign, 'text-violet-500'],
            ].map(([label, value, Icon, color]) => (
              <div key={label} className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
                  </div>
                  <div className={`p-3 rounded-full bg-slate-100 dark:bg-slate-800 ${color}`}>
                    <Icon size={24} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <tab.icon /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Edit Company Form */}
            <form onSubmit={saveCompany} className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
              <h3 className="flex items-center gap-2 text-lg font-black dark:text-white">
                <FiEdit2 /> Edit Company Details
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Company Name *
                  <input
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className={adminFieldClass}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Email *
                  <input
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className={adminFieldClass}
                    type="email"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Phone *
                  <input
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className={adminFieldClass}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Logo URL
                  <input
                    value={companyForm.logo_url}
                    onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })}
                    className={adminFieldClass}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Company Starting Time
                  <input
                    type="time"
                    value={companyForm.start_time}
                    onChange={(e) => setCompanyForm({ ...companyForm, start_time: e.target.value })}
                    className={adminFieldClass}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Company Ending Time
                  <input
                    type="time"
                    value={companyForm.end_time}
                    onChange={(e) => setCompanyForm({ ...companyForm, end_time: e.target.value })}
                    className={adminFieldClass}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">
                  Address *
                  <input
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className={adminFieldClass}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">
                  Description
                  <textarea
                    value={companyForm.description}
                    onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                    rows={3}
                    className={adminFieldClass}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Status
                  <select
                    value={companyForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setCompanyForm({ ...companyForm, is_active: e.target.value === 'active' })}
                    className={adminFieldClass}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Reset Founder Password (optional)
                  <input
                    type="password"
                    value={companyForm.password}
                    onChange={(e) => setCompanyForm({ ...companyForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className={adminFieldClass}
                  />
                </label>
              </div>
              <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-500">
                <FiSave /> Save Changes
              </button>
            </form>

            {/* Company Info Summary */}
            <div className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
              <h3 className="text-lg font-black dark:text-white mb-4">Company Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Company ID</span>
                  <span className="font-semibold">{company.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold dark:text-white">{company.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Email</span>
                  <span className="dark:text-white">{company.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Phone</span>
                  <span className="dark:text-white">{company.phone}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Address</span>
                  <span className="dark:text-white text-right">{company.address}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Status</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${companyPresenceClass(company)}`}>
                    {companyPresenceLabel(company)}
                  </span>
                </div>
                {(!company.start_time || !company.end_time) && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    Company working hours are not set. Please update starting and ending time.
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Starting Time</span>
                  <span className="dark:text-white">{company.start_time || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Ending Time</span>
                  <span className="dark:text-white">{company.end_time || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Registered</span>
                  <span className="dark:text-white">{new Date(company.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Last Updated</span>
                  <span className="dark:text-white">{new Date(company.updated_at).toLocaleString()}</span>
                </div>
                {company.description && (
                  <div className="py-2">
                    <span className="text-slate-500 block mb-1">Description</span>
                    <p className="dark:text-white">{company.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="grid gap-6">
            {/* Add/Edit Employee Form */}
            <form onSubmit={saveEmployee} className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
              <h3 className="flex items-center gap-2 text-lg font-black dark:text-white">
                <FiPlus /> {editingEmployeeId ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Employee ID
                  <input
                    value={employeeForm.employee_id}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employee_id: e.target.value })}
                    className={adminFieldClass}
                    placeholder="Auto-generated if blank"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  First Name *
                  <input
                    value={employeeForm.first_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                    className={adminFieldClass}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Last Name *
                  <input
                    value={employeeForm.last_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                    className={adminFieldClass}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Email *
                  <input
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className={adminFieldClass}
                    type="email"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Login Password *
                  <input
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                    className={adminFieldClass}
                    type="password"
                    minLength={6}
                    placeholder={editingEmployeeId ? 'Leave blank to keep current' : 'Create password'}
                    required={!editingEmployeeId}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Phone
                  <input
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className={adminFieldClass}
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Department
                  <input
                    value={employeeForm.department}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                    className={adminFieldClass}
                    placeholder="General"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Position
                  <input
                    value={employeeForm.position}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                    className={adminFieldClass}
                    placeholder="Employee"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Salary
                  <input
                    value={employeeForm.salary}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, salary: e.target.value })}
                    className={adminFieldClass}
                    type="number"
                    placeholder="0.00"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Date of Joining
                  <input
                    value={employeeForm.date_of_joining}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, date_of_joining: e.target.value })}
                    className={adminFieldClass}
                    type="date"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Profile Image URL
                  <input
                    value={employeeForm.profile_image_url}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, profile_image_url: e.target.value })}
                    className={adminFieldClass}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Status
                  <select
                    value={employeeForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, is_active: e.target.value === 'active' })}
                    className={adminFieldClass}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-5 py-3 font-bold text-white hover:bg-cyan-500">
                  <FiSave /> {editingEmployeeId ? 'Update Employee' : 'Add Employee'}
                </button>
                {editingEmployeeId && (
                  <button
                    type="button"
                    onClick={cancelEditEmployee}
                    className="rounded-md border border-slate-300 px-5 py-3 font-semibold dark:border-slate-700"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            {/* Employees Table */}
            <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
              <div className="border-b border-slate-200 p-5 dark:border-slate-800">
                <h3 className="flex items-center gap-2 font-black dark:text-white">
                  <FiUsers /> All Employees ({employees.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className={isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                    <tr>
                      <th className="px-4 py-3">Emp ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3">Salary</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr
                        key={employee.id}
                        onClick={() => navigate(`/super-admin-dashboard/company/${companyId}/employees/${employee.id}/attendance`)}
                        className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} ${
                          editingEmployeeId === employee.id ? (isDark ? 'bg-violet-500/10' : 'bg-violet-50') : ''
                        } cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800`}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{employee.employee_id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">
                          {employee.first_name} {employee.last_name}
                        </td>
                        <td className="px-4 py-3">{employee.email}</td>
                        <td className="px-4 py-3">{employee.phone || '-'}</td>
                        <td className="px-4 py-3">{employee.department || '-'}</td>
                        <td className="px-4 py-3">{employee.position || '-'}</td>
                        <td className="px-4 py-3">{employee.salary ? `$${employee.salary.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-3">{employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${workStatusClass(employee)}`}>
                            {workStatusLabel(employee)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                editEmployee(employee);
                              }}
                              className={`rounded border px-2 py-1 transition ${
                                editingEmployeeId === employee.id
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title="Edit Employee"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteEmployee(employee.id);
                              }}
                              className="rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              title="Delete Employee"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!employees.length && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                          No employees found for this company.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'attendance' && (
          <section className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
            <h3 className="flex items-center gap-2 text-lg font-black dark:text-white mb-4">
              <FiClock /> Attendance Records
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              One latest row per employee. Click an employee row to view all daily attendance records.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-2">Employee ID</th>
                    <th className="py-2 px-2">Employee Name</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Time In</th>
                    <th className="py-2 px-2">Time Out</th>
                    <th className="py-2 px-2">Late Reason</th>
                    <th className="py-2 px-2">Checkout Type</th>
                    <th className="py-2 px-2">Checkout Reason</th>
                    <th className="py-2 px-2">Auto Checkout</th>
                    <th className="py-2 px-2">Start</th>
                    <th className="py-2 px-2">End</th>
                    <th className="py-2 px-2">Working Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.recent_attendance || []).map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/super-admin-dashboard/company/${companyId}/employees/${row.employee_id}/attendance`)}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                    >
                      <td className="py-3 px-2 font-mono text-xs">{row.employee_code || row.employee_id}</td>
                      <td className="py-3 px-2 font-semibold text-slate-900 dark:text-white">{row.employee_name || '-'}</td>
                      <td className="py-3 px-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.status === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' :
                          row.status === 'late' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' :
                          row.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {row.is_late ? 'Late Mark' : row.status}
                        </span>
                      </td>
                      <td className="py-3 px-2">{row.time_in ? new Date(row.time_in).toLocaleTimeString() : '-'}</td>
                      <td className="py-3 px-2">{row.time_out ? new Date(row.time_out).toLocaleTimeString() : '-'}</td>
                      <td className="py-3 px-2">{row.late_reason || '-'}</td>
                      <td className="py-3 px-2">{row.checkout_type || '-'}</td>
                      <td className="py-3 px-2">{row.checkout_reason || '-'}</td>
                      <td className="py-3 px-2">{row.auto_checkout_at ? new Date(row.auto_checkout_at).toLocaleTimeString() : '-'}</td>
                      <td className="py-3 px-2">{row.company_start_time || '-'}</td>
                      <td className="py-3 px-2">{row.company_end_time || '-'}</td>
                      <td className="py-3 px-2">{row.working_hours ? `${row.working_hours} hrs` : '-'}</td>
                    </tr>
                  ))}
                  {!(analytics?.recent_attendance || []).length && (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500">
                        No attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'locations' && (
          <section className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
            <h3 className="flex items-center gap-2 text-lg font-black dark:text-white mb-4">
              <FiMapPin /> Recent Location Tracking
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-2">Employee ID</th>
                    <th className="py-2 px-2">Timestamp</th>
                    <th className="py-2 px-2">Latitude</th>
                    <th className="py-2 px-2">Longitude</th>
                    <th className="py-2 px-2">Accuracy</th>
                    <th className="py-2 px-2">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-3 px-2 font-mono text-xs">{loc.employee_code || loc.employee_id}</td>
                      <td className="py-3 px-2">{new Date(loc.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-2">{loc.latitude}</td>
                      <td className="py-3 px-2">{loc.longitude}</td>
                      <td className="py-3 px-2">{loc.accuracy ? `${loc.accuracy}m` : '-'}</td>
                      <td className="py-3 px-2 max-w-xs truncate">{loc.address || '-'}</td>
                    </tr>
                  ))}
                  {!locations.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No location records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'salaries' && (
          <section className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
            <h3 className="flex items-center gap-2 text-lg font-black dark:text-white mb-4">
              <FiCalendar /> Salary Records
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-2">Employee ID</th>
                    <th className="py-2 px-2">Month/Year</th>
                    <th className="py-2 px-2">Base Salary</th>
                    <th className="py-2 px-2">Bonus</th>
                    <th className="py-2 px-2">Deduction</th>
                    <th className="py-2 px-2">Net Salary</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.map((salary) => (
                    <tr key={salary.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-3 px-2 font-mono text-xs">{salary.employee_id}</td>
                      <td className="py-3 px-2">{salary.month}/{salary.year}</td>
                      <td className="py-3 px-2">${salary.base_salary?.toLocaleString()}</td>
                      <td className="py-3 px-2 text-emerald-600">+${salary.bonus?.toLocaleString()}</td>
                      <td className="py-3 px-2 text-rose-600">-${salary.deduction?.toLocaleString()}</td>
                      <td className="py-3 px-2 font-semibold">${salary.net_salary?.toLocaleString()}</td>
                      <td className="py-3 px-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          salary.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' :
                          salary.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {salary.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!salaries.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No salary records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
