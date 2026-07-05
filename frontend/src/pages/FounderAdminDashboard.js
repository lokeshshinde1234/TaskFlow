import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FiCrosshair, FiDollarSign, FiDownload, FiEdit2, FiLogOut, FiMapPin, FiPlus, FiSave, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { adminAPI, authAPI, employeeAPI, locationAPI, salaryAPI } from '../services/api';
import selectLocationIcon from '../utils/selectLocationIcon';
import 'leaflet/dist/leaflet.css';

const markerIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const defaultCompanyLocation = {
  latitude: '19.997500',
  longitude: '73.789800',
  geo_radius_meters: 100,
};

const defaultCompanyTiming = {
  start_time: '',
  end_time: '',
};

function MapSizeController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    const refreshMap = () => {
      map.invalidateSize();
      if (center) {
        map.setView(center, zoom);
      }
    };

    refreshMap();
    const timeout = window.setTimeout(refreshMap, 250);
    return () => window.clearTimeout(timeout);
  }, [center, map, zoom]);

  return null;
}

const emptyEmployee = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  salary: '',
  profile_image_url: '',
  date_of_joining: '',
  is_active: true,
  employee_id: '',
};

function CompanyLocationPicker({ selectedPosition, radius, onSelect }) {
  const map = useMapEvents({
    click(event) {
      onSelect(event.latlng);
      map.setView(event.latlng, Math.max(map.getZoom(), 15));
    },
  });

  useEffect(() => {
    if (selectedPosition) {
      map.setView(selectedPosition, Math.max(map.getZoom(), 15));
    }
  }, [map, selectedPosition]);

  if (!selectedPosition) return null;

  return (
    <>
      <Circle
        center={selectedPosition}
        radius={radius}
        pathOptions={{ color: '#0891b2', fillColor: '#22d3ee', fillOpacity: 0.12 }}
      />
      <Marker position={selectedPosition} icon={selectLocationIcon}>
        <Popup>Selected company check-in location</Popup>
      </Marker>
    </>
  );
}

const formatApiDetail = (detail) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) {
          const field = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : '';
          return field ? `${field}: ${item.msg}` : item.msg;
        }
        return JSON.stringify(item);
      })
      .join(' ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return '';
};

const handleError = (error, fallbackMessage) => {
  const detail = error?.response?.data?.detail;
  const message = formatApiDetail(detail);
  if (message) return message;
  return fallbackMessage;
};

const isEmployeeCheckedIn = (employee) => Boolean(employee?.is_checked_in) || employee?.work_status === 'active';

const workStatusClass = (employee) => (
  isEmployeeCheckedIn(employee)
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
);

const workStatusLabel = (employee) => (isEmployeeCheckedIn(employee) ? 'Active' : 'Inactive');

const formatInr = (value) => {
  const amount = Number(value || 0);
  if (!amount) return '-';
  return `Rs ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const panelClass = 'rounded-lg border border-white/10 bg-slate-900/88 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl';
const sectionClass = 'rounded-lg border border-white/10 bg-slate-900/88 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl';
const fieldClass = 'mt-2 w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20';
const compactFieldClass = 'w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const founderTabs = [
  ['analytics', 'Command', 'Operational health and workforce signals', FiUsers],
  ['employees', 'People', 'Create, search, edit, and audit employee records', FiUsers],
  ['locations', 'Geo Ops', 'Working hours, geofence, and live map control', FiMapPin],
  ['salary', 'Payroll', 'Generate monthly salary records', FiDollarSign],
  ['reports', 'Reports', 'Export attendance and compliance history', FiDownload],
  ['enterprise', 'Enterprise', 'Advanced modules and workflow controls', FiCrosshair],
];

const tabDetails = {
  analytics: ['Command Center', 'Live business posture for your company workspace.'],
  employees: ['People Operations', 'A clean control room for employee identity, roles, departments, and status.'],
  locations: ['Geo Operations', 'Set company attendance timing and geofence behavior from one operational map.'],
  salary: ['Payroll Studio', 'Generate payroll records against current employee data.'],
  reports: ['Attendance Intelligence', 'Review and export attendance records with operational context.'],
  enterprise: ['Enterprise Modules', 'Open the advanced administration console.'],
};

export default function FounderAdminDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [company, setCompany] = useState(null);
  const [locations, setLocations] = useState([]);
  const [companyLocationForm, setCompanyLocationForm] = useState(defaultCompanyLocation);
  const [companyTimingForm, setCompanyTimingForm] = useState(defaultCompanyTiming);
  const [analytics, setAnalytics] = useState(null);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [editingId, setEditingId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [salaryForm, setSalaryForm] = useState({ employee_id: '', base_salary: '', bonus: 0, deduction: 0, month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'pending' });
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    const [companyResponse, employeeResponse, locationResponse, analyticsResponse] = await Promise.all([
      authAPI.companyMe().catch(() => ({ data: null })),
      employeeAPI.getAllEmployees({ search: query || undefined, department: department || undefined }),
      locationAPI.getCompanyLocations().catch(() => ({ data: [] })),
      adminAPI.analytics().catch(() => ({ data: null })),
    ]);
    setCompany(companyResponse.data);
    setEmployees(employeeResponse.data);
    setLocations(locationResponse.data);
    setAnalytics(analyticsResponse.data);
  }, [department, query]);

  useEffect(() => {
    loadData().catch((err) => setMessage(handleError(err, 'Unable to load founder admin dashboard.')));
  }, [loadData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadData().catch(() => null);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  useEffect(() => {
    authAPI.presence().catch(() => null);
    const intervalId = window.setInterval(() => {
      authAPI.presence().catch(() => null);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!company) return;
    setCompanyLocationForm({
      latitude: company.latitude ?? defaultCompanyLocation.latitude,
      longitude: company.longitude ?? defaultCompanyLocation.longitude,
      geo_radius_meters: company.geo_radius_meters || 100,
    });
    setCompanyTimingForm({
      start_time: company.start_time || '',
      end_time: company.end_time || '',
    });
  }, [company]);

  useEffect(() => {
    const ws = new WebSocket((process.env.REACT_APP_WS_URL || 'ws://localhost:8000') + '/ws/locations');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'attendance_update') {
          if (company?.id && data.company_id && Number(data.company_id) !== Number(company.id)) return;
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
        if (data.type !== 'employee_work_status') return;
        if (company?.id && data.company_id && Number(data.company_id) !== Number(company.id)) return;
        const nextEmployee = data.employee;
        const statusPatch = {
          is_checked_in: data.is_checked_in,
          work_status: data.work_status,
        };
        setEmployees((current) => current.map((employee) => (
          Number(employee.id) === Number(data.employee_db_id) ? { ...employee, ...(nextEmployee || {}), ...statusPatch } : employee
        )));
        setSelectedEmployee((current) => (
          current && Number(current.id) === Number(data.employee_db_id) ? { ...current, ...(nextEmployee || {}), ...statusPatch } : current
        ));
      } catch (error) {}
    };
    return () => ws.close();
  }, [company?.id]);

  const departments = useMemo(() => [...new Set(employees.map((employee) => employee.department).filter(Boolean))], [employees]);
  const chartData = useMemo(() => {
    const counts = employees.reduce((acc, employee) => ({ ...acc, [employee.department]: (acc[employee.department] || 0) + 1 }), {});
    return Object.entries(counts).map(([name, value]) => ({ name, employees: value }));
  }, [employees]);
  const selectedCompanyPosition = useMemo(() => {
    const latitude = Number(companyLocationForm.latitude);
    const longitude = Number(companyLocationForm.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
  }, [companyLocationForm.latitude, companyLocationForm.longitude]);
  const locationMapCenter = selectedCompanyPosition || [Number(defaultCompanyLocation.latitude), Number(defaultCompanyLocation.longitude)];
  const companyLocationRadius = Number(companyLocationForm.geo_radius_meters) || 100;

  const submitEmployee = async (event) => {
    event.preventDefault();
    setMessage('');
    const payload = {
      ...employeeForm,
      company_id: company?.id ?? user?.company_id ?? undefined,
      salary: employeeForm.salary ? Number(employeeForm.salary) : null,
      is_active: employeeForm.is_active,
      date_of_joining: employeeForm.date_of_joining || undefined,
    };
    try {
      let response;
      if (editingId) {
        response = await employeeAPI.updateEmployee(editingId, payload);
        setMessage('Employee updated.');
      } else {
        response = await employeeAPI.createEmployee(payload);
        setMessage('Employee added.');
      }
      setSelectedEmployee(response.data);
      setEmployeeForm(emptyEmployee);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setMessage(handleError(err, 'Employee save failed.'));
    }
  };

  const editEmployee = (employee) => {
    setEditingId(employee.id);
    setSelectedEmployee(employee);
    setEmployeeForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone || '',
      department: employee.department || '',
      position: employee.position || '',
      salary: employee.salary || '',
      profile_image_url: employee.profile_image_url || '',
      date_of_joining: employee.date_of_joining ? new Date(employee.date_of_joining).toISOString().slice(0, 10) : '',
      is_active: employee.is_active ?? true,
      employee_id: employee.employee_id || '',
    });
    setTab('employees');
  };

  const deleteEmployee = async (id) => {
    const employeeId = Number(id);
    if (!employeeId) return;
    if (!window.confirm('Delete this employee and their login account?')) return;
    setMessage('');
    try {
      await employeeAPI.deleteEmployee(employeeId);
      setEmployees((current) => current.filter((employee) => employee.id !== employeeId));
      if (selectedEmployee?.id === employeeId) {
        setSelectedEmployee(null);
      }
      if (editingId === employeeId) {
        setEditingId(null);
        setEmployeeForm(emptyEmployee);
      }
      setMessage('Employee deleted successfully.');
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setMessage(typeof detail === 'string' ? detail : 'Unable to delete employee. Try again.');
    }
  };

  const submitSalary = async (event) => {
    event.preventDefault();
    try {
      await salaryAPI.createSalary({
        ...salaryForm,
        employee_id: Number(salaryForm.employee_id),
        base_salary: Number(salaryForm.base_salary),
        bonus: Number(salaryForm.bonus),
        deduction: Number(salaryForm.deduction),
        month: Number(salaryForm.month),
        year: Number(salaryForm.year),
      });
      setMessage('Salary record generated.');
      setSalaryForm({ ...salaryForm, employee_id: '', base_salary: '' });
    } catch (err) {
      setMessage(handleError(err, 'Salary save failed.'));
    }
  };

  const selectCompanyLocation = ({ lat, lng }) => {
    setCompanyLocationForm((current) => ({
      ...current,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const submitCompanyLocation = async (event) => {
    event.preventDefault();
    const latitude = Number(companyLocationForm.latitude);
    const longitude = Number(companyLocationForm.longitude);
    const geoRadius = Number(companyLocationForm.geo_radius_meters);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMessage('Select a company location on the map before saving.');
      return;
    }

    try {
      const response = await authAPI.updateCompanyLocation({
        latitude,
        longitude,
        geo_radius_meters: Number.isFinite(geoRadius) ? geoRadius : 100,
      });
      setCompany(response.data);
      setMessage('Company check-in location saved.');
    } catch (err) {
      setMessage(handleError(err, 'Unable to save company check-in location.'));
    }
  };

  const submitCompanyTiming = async (event) => {
    event.preventDefault();
    setMessage('');
    if (!companyTimingForm.start_time || !companyTimingForm.end_time) {
      setMessage('Company working hours are not set. Please update starting and ending time.');
      return;
    }
    if (companyTimingForm.end_time <= companyTimingForm.start_time) {
      setMessage('Company ending time must be greater than starting time.');
      return;
    }
    try {
      const response = await authAPI.updateCompanyTiming(companyTimingForm);
      setCompany((current) => ({ ...current, ...response.data }));
      setMessage('Company starting and ending time updated.');
    } catch (err) {
      setMessage(handleError(err, 'Unable to save company timing.'));
    }
  };

  const exportAttendanceCsv = () => {
    const rows = [['Employee ID', 'Employee Name', 'Date', 'Time In', 'Time Out', 'Hours', 'Late Mark', 'Late Reason', 'Checkout Type', 'Checkout Reason', 'Auto Checkout At', 'Company Start Time', 'Company End Time']];
    (analytics?.recent_attendance || []).forEach((record) => rows.push([
      record.employee_code || record.employee_id,
      record.employee_name || '',
      record.date,
      record.time_in,
      record.time_out || '',
      record.working_hours || '',
      record.is_late ? 'Late' : record.status,
      record.late_reason || '',
      record.checkout_type || '',
      record.checkout_reason || '',
      record.auto_checkout_at || '',
      record.company_start_time || '',
      record.company_end_time || '',
    ]));
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await authAPI.logout().catch(() => null);
    logout();
    navigate('/', { replace: true });
  };
  const currentPage = tabDetails[tab] || tabDetails.analytics;

  return (
    <div className="dark">
    <div className="relative min-h-screen overflow-hidden bg-[#040816] text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_18%_8%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_86%_4%,rgba(99,102,241,0.22),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

      <div className="relative lg:flex">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 border-r border-white/10 bg-[#07111f]/95 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:block">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-400/15 p-3 text-cyan-300 shadow-xl shadow-cyan-500/10">
              <FiUsers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">TaskFlow Admin</p>
              <h1 className="text-2xl font-black text-white">Founder Console</h1>
            </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">Company control plane for people, attendance, geofence, payroll, and reporting.</p>
          </div>

          <nav className="mt-6 grid gap-2">
            {founderTabs.map(([id, label, description, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`grid grid-cols-[38px_1fr] items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${tab === id ? 'border-cyan-400/50 bg-cyan-400/12 text-white shadow-[0_18px_50px_rgba(34,211,238,0.12)]' : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-md ${tab === id ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-cyan-300'}`}><Icon className="text-base" /></span>
                <span>
                  <span className="block text-sm font-black">{label}</span>
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">{description}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="w-full lg:pl-80">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111f]/88 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">{currentPage[0]}</p>
                  <h2 className="mt-2 text-3xl font-black text-white">{company?.name || 'Company workspace'}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">{currentPage[1]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                    <FiLogOut /> Logout
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {founderTabs.map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)} className={`rounded-md border px-4 py-2.5 text-sm font-bold transition ${tab === id ? 'border-cyan-400/60 bg-cyan-400/12 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <main className="mx-auto grid w-full max-w-[1500px] gap-6 p-4 sm:p-6 lg:p-8">
            {message && <div className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">{typeof message === 'string' ? message : JSON.stringify(message)}</div>}

          {company && (
            <section className="overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,47,73,0.72),rgba(88,28,135,0.42))] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Company workspace</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    {company.logo_url && (
                      <img src={company.logo_url} alt="" className="h-16 w-16 rounded-lg border border-white/15 bg-slate-950/70 object-contain p-2 shadow-sm" />
                    )}
                    <div>
                      <h3 className="text-3xl font-black text-white">{company.name}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{company.description || 'Manage employee records, attendance, salary, and live location data from this workspace.'}</p>
                    </div>
                  </div>
                  {(!company.start_time || !company.end_time) && (
                    <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                      Company working hours are not set. Please update starting and ending time.
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300 shadow-inner">
                  <p className="font-bold text-white">{company.email}</p>
                  <p>{company.phone}</p>
                  <p>{company.address}</p>
                  <p className="mt-2 font-semibold text-white">
                    {company.start_time || '--:--'} to {company.end_time || '--:--'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {tab === 'analytics' && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ['Employees', analytics?.total_employees || employees.length],
                  ['Active today', analytics?.active_today || 0],
                  ['Open sessions', analytics?.open_attendance_sessions || 0],
                  ['Payroll total', formatInr(analytics?.payroll_total)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-slate-900/88 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                    <p className="text-sm font-semibold text-slate-400">{label}</p>
                    <p className="mt-3 text-3xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              <section className={panelClass}>
                <h3 className="font-black text-white">Department distribution</h3>
                <div className="mt-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="employees" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}

          {tab === 'employees' && (
            <div className="grid min-w-0 gap-6">
              <form onSubmit={submitEmployee} className={panelClass}>
                <h3 className="flex items-center gap-2 font-black text-white"><FiPlus /> {editingId ? 'Edit employee' : 'Add employee'}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block">
                    <span className={labelClass}>First name</span>
                    <input value={employeeForm.first_name} onChange={(event) => setEmployeeForm({ ...employeeForm, first_name: event.target.value })} placeholder="First name" type="text" className={fieldClass} required />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Last name</span>
                    <input value={employeeForm.last_name} onChange={(event) => setEmployeeForm({ ...employeeForm, last_name: event.target.value })} placeholder="Last name" type="text" className={fieldClass} required />
                  </label>
                  <label className="block lg:col-span-2">
                    <span className={labelClass}>Email</span>
                    <input value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} placeholder="Email" type="email" className={fieldClass} required />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Employee ID</span>
                    <input value={employeeForm.employee_id} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_id: event.target.value })} placeholder="Auto-generated if left blank" type="text" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Phone</span>
                    <input value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Phone" type="text" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Department</span>
                    <input value={employeeForm.department} onChange={(event) => setEmployeeForm({ ...employeeForm, department: event.target.value })} placeholder="Department" type="text" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Position</span>
                    <input value={employeeForm.position} onChange={(event) => setEmployeeForm({ ...employeeForm, position: event.target.value })} placeholder="Position" type="text" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Salary</span>
                    <input value={employeeForm.salary} onChange={(event) => setEmployeeForm({ ...employeeForm, salary: event.target.value })} placeholder="Salary" type="number" min="0" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Join date</span>
                    <input value={employeeForm.date_of_joining} onChange={(event) => setEmployeeForm({ ...employeeForm, date_of_joining: event.target.value })} placeholder="Date of joining" type="date" className={`${fieldClass} [color-scheme:dark]`} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Status</span>
                    <select value={employeeForm.is_active ? 'active' : 'inactive'} onChange={(event) => setEmployeeForm({ ...employeeForm, is_active: event.target.value === 'active' })} className={fieldClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="block lg:col-span-2">
                    <span className={labelClass}>Profile image URL</span>
                    <input value={employeeForm.profile_image_url} onChange={(event) => setEmployeeForm({ ...employeeForm, profile_image_url: event.target.value })} placeholder="Profile image URL" type="url" className={fieldClass} />
                  </label>
                </div>
                <button className="tf-kinetic mt-4 w-full rounded-md px-4 py-3 font-bold text-white shadow-hyper">{editingId ? 'Update employee' : 'Add employee'}</button>
              </form>

              <section className={sectionClass}>
                <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-[1fr_220px]">
                  <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2">
                    <FiSearch className="text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees" className="w-full bg-transparent text-white placeholder:text-slate-500 outline-none" />
                  </label>
                  <select value={department} onChange={(event) => setDepartment(event.target.value)} className={compactFieldClass}>
                    <option value="">All departments</option>
                    {departments.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
                {selectedEmployee && (
                  <div className="border-b border-white/10 p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Selected employee</p>
                    <div className="grid gap-4 rounded-lg border border-white/10 bg-slate-950/70 p-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-400">Name</p>
                        <p className="mt-1 font-semibold text-white">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Email</p>
                        <p className="mt-1 text-sm text-white">{selectedEmployee.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Employee ID</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">{selectedEmployee.employee_id || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Department</p>
                        <p className="mt-1 font-semibold text-white">{selectedEmployee.department || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Status</p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-semibold ${workStatusClass(selectedEmployee)}`}>
                          {workStatusLabel(selectedEmployee)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-4 p-5 md:hidden">
                  {employees.map((employee) => (
                    <div key={employee.id} onClick={() => navigate(`/admin-dashboard/employees/${employee.id}/attendance`)} className="cursor-pointer rounded-lg border border-white/10 bg-slate-950/70 p-4 text-slate-100 shadow-sm transition hover:border-cyan-500/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-slate-400">{employee.email}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${workStatusClass(employee)}`}>
                          {workStatusLabel(employee)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-400">
                        <p><span className="font-semibold text-slate-200">Employee ID:</span> <span className="font-mono text-cyan-300">{employee.employee_id || '-'}</span></p>
                        <p><span className="font-semibold text-slate-200">Department:</span> {employee.department || '-'}</p>
                        <p><span className="font-semibold text-slate-200">Role:</span> {employee.position || '-'}</p>
                        <p><span className="font-semibold text-slate-200">Joined:</span> {employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-'}</p>
                        <p><span className="font-semibold text-slate-200">Salary:</span> {formatInr(employee.salary)}</p>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            editEmployee(employee);
                          }}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEmployee(employee.id);
                          }}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-red-700 transition hover:bg-red-100 dark:border-red-500 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-slate-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden w-full overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-800 text-slate-300">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-slate-300">Name</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Email</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Employee ID</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Department</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Position</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Join date</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Salary</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Status</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((employee) => (
                        <tr key={employee.id} onClick={() => navigate(`/admin-dashboard/employees/${employee.id}/attendance`)} className="cursor-pointer border-t border-slate-800 text-slate-200 transition hover:bg-slate-800/70">
                          <td className="px-6 py-4 font-semibold text-white">{employee.first_name} {employee.last_name}</td>
                          <td className="px-6 py-4 text-slate-300">{employee.email}</td>
                          <td className="px-6 py-4 font-mono text-sm font-semibold text-cyan-300">{employee.employee_id || '-'}</td>
                          <td className="px-6 py-4 text-slate-300">{employee.department || '-'}</td>
                          <td className="px-6 py-4 text-slate-300">{employee.position || '-'}</td>
                          <td className="px-6 py-4 text-slate-300">{employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-'}</td>
                          <td className="px-6 py-4 font-semibold text-white">{formatInr(employee.salary)}</td>
                          <td className="px-6 py-4"><span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${workStatusClass(employee)}`}>{workStatusLabel(employee)}</span></td>
                          <td className="flex gap-2 px-6 py-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                editEmployee(employee);
                              }}
                              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEmployee(employee.id);
                              }}
                              className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-red-700 transition hover:bg-red-100 dark:border-red-500 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-slate-700"
                            >
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === 'locations' && (
            <section className={panelClass}>
              <form onSubmit={submitCompanyTiming} className="mb-5 grid gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-300">Company Starting Time</span>
                  <input
                    type="time"
                    value={companyTimingForm.start_time}
                    onChange={(event) => setCompanyTimingForm({ ...companyTimingForm, start_time: event.target.value })}
                    className={`${compactFieldClass} mt-1 [color-scheme:dark]`}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-300">Company Ending Time</span>
                  <input
                    type="time"
                    value={companyTimingForm.end_time}
                    onChange={(event) => setCompanyTimingForm({ ...companyTimingForm, end_time: event.target.value })}
                    className={`${compactFieldClass} mt-1 [color-scheme:dark]`}
                    required
                  />
                </label>
                <button type="submit" className="tf-kinetic inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-white shadow-hyper sm:self-end">
                  <FiSave /> Save Time
                </button>
              </form>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-black text-white">Employee live locations</h3>
                  <p className="mt-1 text-sm text-slate-300">Select the company check-in location used for employee in/out tracking.</p>
                </div>
                <form onSubmit={submitCompanyLocation} className="grid w-full gap-3 lg:max-w-xl lg:grid-cols-[1fr_1fr_150px_auto]">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-300">Latitude</span>
                    <input
                      value={companyLocationForm.latitude}
                      onChange={(event) => setCompanyLocationForm({ ...companyLocationForm, latitude: event.target.value })}
                      placeholder="Click map"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      className={`${compactFieldClass} mt-1`}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-300">Longitude</span>
                    <input
                      value={companyLocationForm.longitude}
                      onChange={(event) => setCompanyLocationForm({ ...companyLocationForm, longitude: event.target.value })}
                      placeholder="Click map"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      className={`${compactFieldClass} mt-1`}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-300">Radius</span>
                    <input
                      value={companyLocationForm.geo_radius_meters}
                      onChange={(event) => setCompanyLocationForm({ ...companyLocationForm, geo_radius_meters: event.target.value })}
                      type="number"
                      min="25"
                      max="5000"
                      className={`${compactFieldClass} mt-1`}
                      required
                    />
                  </label>
                  <button type="submit" className="tf-kinetic inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-white shadow-hyper lg:self-end">
                    <FiSave /> Save
                  </button>
                </form>
              </div>
              <div className="mt-5 h-[560px] min-h-[360px] overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-inner">
                <MapContainer
                  center={locationMapCenter}
                  zoom={selectedCompanyPosition ? 15 : 4}
                  scrollWheelZoom
                  className="h-full w-full"
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapSizeController center={locationMapCenter} zoom={selectedCompanyPosition ? 15 : 4} />
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CompanyLocationPicker
                    selectedPosition={selectedCompanyPosition}
                    radius={companyLocationRadius}
                    onSelect={selectCompanyLocation}
                  />
                  {locations.map((location) => (
                    <Marker key={location.id} position={[location.latitude, location.longitude]} icon={markerIcon}>
                      <Popup>Employee #{location.employee_id}<br />{new Date(location.timestamp).toLocaleString()}</Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                <FiCrosshair className="text-cyan-300" />
                <span>Click the map or type coordinates, then save to set the attendance tracking location.</span>
              </div>
            </section>
          )}

          {tab === 'salary' && (
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.86),rgba(15,23,42,0.94),rgba(88,28,135,0.42))] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.32)]">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Payroll overview</p>
                <h3 className="mt-3 text-3xl font-black text-white">Salary command desk</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  Generate monthly salary records with employee context, payroll totals, and active workforce signals in one workspace.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {[
                    ['Employees', employees.length],
                    ['Payroll total', formatInr(analytics?.payroll_total)],
                    ['Active today', analytics?.active_today || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-3 text-2xl font-black text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <form onSubmit={submitSalary} className={panelClass}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">New salary record</p>
                    <h3 className="mt-2 text-2xl font-black text-white">Generate monthly salary</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Select an employee and create a clean payroll entry for the selected month.</p>
                  </div>
                  <span className="rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-bold text-slate-300">
                    {salaryForm.month}/{salaryForm.year}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Employee
                    <select value={salaryForm.employee_id} onChange={(event) => setSalaryForm({ ...salaryForm, employee_id: event.target.value })} className={fieldClass} required>
                      <option value="">Select employee</option>
                      {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.first_name} {employee.last_name}</option>)}
                    </select>
                  </label>
                  {['base_salary', 'bonus', 'deduction', 'month', 'year', 'status'].map((key) => (
                    <label key={key} className={labelClass}>
                      {key.replaceAll('_', ' ')}
                      <input value={salaryForm[key]} onChange={(event) => setSalaryForm({ ...salaryForm, [key]: event.target.value })} placeholder={key.replaceAll('_', ' ')} type={key === 'status' ? 'text' : 'number'} className={fieldClass} required />
                    </label>
                  ))}
                </div>
                <button className="tf-kinetic mt-6 inline-flex items-center gap-2 rounded-md px-5 py-3 font-bold text-white shadow-hyper">
                  <FiSave /> Save salary
                </button>
              </form>
            </div>
          )}

          {tab === 'reports' && (
            <section className={panelClass}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-black text-white">Attendance reports</h3>
                <button onClick={exportAttendanceCsv} className="tf-kinetic inline-flex items-center gap-2 rounded-md px-4 py-2 font-bold text-white shadow-hyper"><FiDownload /> Export CSV</button>
              </div>
              <div className="mt-5 overflow-x-auto min-w-0">
                <table className="min-w-[1180px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Employee ID</th>
                      <th className="px-4 py-3 whitespace-nowrap">Employee</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Time in</th>
                      <th className="px-4 py-3 whitespace-nowrap">Time out</th>
                      <th className="px-4 py-3 whitespace-nowrap">Late mark</th>
                      <th className="px-4 py-3 whitespace-nowrap">Late reason</th>
                      <th className="px-4 py-3 whitespace-nowrap">Checkout type</th>
                      <th className="px-4 py-3 whitespace-nowrap">Checkout reason</th>
                      <th className="px-4 py-3 whitespace-nowrap">Auto checkout at</th>
                      <th className="px-4 py-3 whitespace-nowrap">Start time</th>
                      <th className="px-4 py-3 whitespace-nowrap">End time</th>
                      <th className="px-4 py-3 whitespace-nowrap">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.recent_attendance || []).map((record) => (
                      <tr key={record.id} className="border-t border-slate-100 dark:border-slate-800 dark:text-slate-200">
                        <td className="px-4 py-3 whitespace-nowrap">{record.employee_code || record.employee_id}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.employee_name || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.time_in ? new Date(record.time_in).toLocaleTimeString() : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.time_out ? new Date(record.time_out).toLocaleTimeString() : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.is_late ? 'Late' : record.status}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.late_reason || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.checkout_type || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.checkout_reason || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.auto_checkout_at ? new Date(record.auto_checkout_at).toLocaleTimeString() : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.company_start_time || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.company_end_time || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{record.working_hours || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'enterprise' && (
            <div className="grid gap-6">
              <section className="overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.9),rgba(15,23,42,0.96),rgba(79,70,229,0.32))] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.34)]">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">Enterprise workspace</p>
                    <h3 className="mt-3 text-3xl font-black text-white">Advanced company operations</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                      A unified command area for organization design, attendance governance, payroll control, project delivery, and platform security.
                    </p>
                  </div>
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100">
                    <FiCrosshair /> Run anomaly scan
                  </button>
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Org design', 'Departments, teams, roles, and company hierarchy control.'],
                  ['Attendance policy', 'Shift rules, leave workflows, approvals, and daily summaries.'],
                  ['Payroll controls', 'Salary runs, payslips, deductions, bonuses, and audit checks.'],
                  ['Project delivery', 'Projects, task ownership, priority queues, and completion tracking.'],
                  ['Platform security', 'API keys, webhooks, access policy, and operational audit logs.'],
                  ['Workflow data', 'Reports, exports, integrations, and company-wide data hygiene.'],
                ].map(([title, text], index) => (
                  <article key={title} className="rounded-lg border border-white/10 bg-slate-900/88 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Module {String(index + 1).padStart(2, '0')}</p>
                    <h4 className="mt-4 text-lg font-black text-white">{title}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
                  </article>
                ))}
              </div>

              <section className={panelClass}>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ['Company', company?.name || 'Workspace'],
                    ['Employees', employees.length],
                    ['Open sessions', analytics?.open_attendance_sessions || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-3 text-2xl font-black text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
    </div>
    </div>
  );
}
