import React, { useCallback, useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBriefcase,
  FiDollarSign,
  FiLogOut,
  FiMapPin,
  FiMoon,
  FiRefreshCw,
  FiSun,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { platformAPI } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const employeeLocationIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const companyLocationIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 10px 10px 10px 2px;
      background: #7c3aed;
      border: 3px solid #ffffff;
      box-shadow: 0 12px 28px rgba(124, 58, 237, 0.35);
      transform: rotate(-45deg);
      display: grid;
      place-items: center;
    ">
      <div style="
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #ffffff;
      "></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
  tooltipAnchor: [18, -24],
});

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { logout, theme, toggleTheme } = useContext(AuthContext);
  const isDark = theme === 'dark';

  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [liveLocations, setLiveLocations] = useState([]);
  const [locationRecords, setLocationRecords] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const wsRef = useRef(null);

  const mergeCompany = useCallback((incomingCompany) => {
    if (!incomingCompany?.id) return;
    setCompanies((current) => {
      const exists = current.some((company) => Number(company.id) === Number(incomingCompany.id));
      const companyWithDefaults = {
        employee_count: 0,
        user_count: 0,
        payroll_total: 0,
        active_today: 0,
        created_at: new Date().toISOString(),
        is_active: true,
        ...incomingCompany,
      };
      if (exists) {
        return current.map((company) => (
          Number(company.id) === Number(incomingCompany.id)
            ? { ...company, ...incomingCompany }
            : company
        ));
      }
      return [companyWithDefaults, ...current];
    });
  }, []);

  const handleError = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg || JSON.stringify(item)).join(' ');
    return fallback;
  };

  const loadOverview = useCallback(async () => {
    const { data } = await platformAPI.overview();
    setOverview(data);
  }, []);

  const loadCompanies = useCallback(async () => {
    const { data } = await platformAPI.listCompanies();
    setCompanies(data);
  }, []);

  const loadLocations = useCallback(async () => {
    const { data } = await platformAPI.listLocations(100);
    setLocationRecords(data);
    const latestByEmployee = new Map();
    data.forEach((location) => {
      if (!latestByEmployee.has(location.employee_id)) {
        latestByEmployee.set(location.employee_id, location);
      }
    });
    setLiveLocations(Array.from(latestByEmployee.values()));
  }, []);

  const loadAttendance = useCallback(async () => {
    const { data } = await platformAPI.listAttendance(500);
    setAttendanceRecords(data);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      await Promise.all([loadOverview(), loadCompanies(), loadLocations(), loadAttendance()]);
    } catch (err) {
      setMessage(handleError(err, 'Unable to load platform data.'));
    } finally {
      setLoading(false);
    }
  }, [loadAttendance, loadCompanies, loadLocations, loadOverview]);

  useEffect(() => {
    refreshAll();
    // connect websocket for live locations
    try {
      const ws = new WebSocket((process.env.REACT_APP_WS_URL || 'ws://localhost:8000') + '/ws/locations');
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'company_online_status') {
            loadOverview().catch(() => null);
            if (data.company) {
              mergeCompany(data.company);
              return;
            }
            setCompanies((current) => current.map((company) => (
              Number(company.id) === Number(data.company_id)
                ? { ...company, is_online: data.is_online }
                : company
            )));
            return;
          }
          if (data.type === 'company_update') {
            mergeCompany(data.company);
            loadOverview().catch(() => null);
            return;
          }
          if (data.type === 'attendance_update') {
            const updatedAttendance = data.attendance;
            if (!updatedAttendance) return;
            setAttendanceRecords((current) => {
              const exists = current.some((record) => Number(record.id) === Number(updatedAttendance.id));
              if (exists) {
                return current.map((record) => (Number(record.id) === Number(updatedAttendance.id) ? updatedAttendance : record));
              }
              return [updatedAttendance, ...current].slice(0, 500);
            });
            return;
          }
          if (data.type && data.type !== 'location') return;
          setLiveLocations((prev) => {
            const others = prev.filter((p) => p.employee_id !== data.employee_id);
            return [...others, data];
          });
          setLocationRecords((prev) => [data, ...prev.filter((record) => record.id !== data.id)].slice(0, 100));
        } catch (e) {}
      };
      wsRef.current = ws;
    } catch (e) {}
  }, [loadOverview, mergeCompany, refreshAll]);

  const selectCompany = (companyId) => {
    const url = `/super-admin-dashboard/company/${companyId}`;
    window.open(url, '_blank');
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const formatCoordinate = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(6) : '-');
  const formatAccuracy = (value) => (value || value === 0 ? `${Math.round(Number(value))} m` : '-');
  const companyMapLocations = companies.filter((company) => Number.isFinite(Number(company.latitude)) && Number.isFinite(Number(company.longitude)));
  const companyStatusClass = (isOnline) => (
    isOnline
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-slate-300 bg-white text-slate-600 shadow-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
  );

  return (
    <div className={`relative min-h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.15),_transparent_30%)]" />

      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${isDark ? 'border-slate-800/80 bg-slate-950/95' : 'border-slate-200/80 bg-white/95'}`}>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-400">Platform control</p>
            <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>Super Admin</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All registered companies and full database access</p>
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
            <button type="button" onClick={() => navigate('/superadmin/salary')} className="inline-flex items-center gap-2 rounded-full border border-violet-300 bg-white px-4 py-3 text-sm font-semibold text-violet-700 dark:border-violet-400/30 dark:bg-slate-900 dark:text-violet-200">
              <FiDollarSign /> Salary
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

      <main className="mx-auto grid max-w-[1600px] gap-6 p-4 sm:p-6 lg:p-8">
        {message && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-200">
            {message}
          </div>
        )}

        {overview && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Companies', overview.total_companies],
              ['Active companies', overview.active_companies],
              ['Employees', overview.total_employees],
              ['Users', overview.total_users],
              ['Total payroll', `$${Number(overview.payroll_total).toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/70 bg-white/90 p-5 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        )}

        <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-black dark:text-white">
              <FiBriefcase /> All registered companies
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Click a row to view and edit company data, employees, payroll, and attendance.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className={`${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                <tr>
                  <th className="px-4 py-3">Logo</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Employees</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Active today</th>
                  <th className="px-4 py-3">Payroll</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    onClick={() => selectCompany(company.id)}
                    className={`cursor-pointer border-t transition ${
                      isDark
                        ? 'border-slate-800 hover:bg-slate-800/80'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt="" className="h-10 w-10 rounded-md border border-slate-200 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-950" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                          <FiBriefcase />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{company.id}</td>
                    <td className="px-4 py-3 font-semibold dark:text-white">{company.name}</td>
                    <td className="px-4 py-3">{company.email}</td>
                    <td className="px-4 py-3">{company.phone}</td>
                    <td className="px-4 py-3">{company.start_time || '-'}</td>
                    <td className="px-4 py-3">{company.end_time || '-'}</td>
                    <td className="px-4 py-3">{company.employee_count}</td>
                    <td className="px-4 py-3">{company.user_count}</td>
                    <td className="px-4 py-3">{company.active_today}</td>
                    <td className="px-4 py-3">${Number(company.payroll_total).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${companyStatusClass(company.is_online)}`}>
                        <span className={`h-2 w-2 rounded-full ${company.is_online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {company.is_online ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(company.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!companies.length && (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                      No companies registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-xl font-black dark:text-white">All company attendance</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Attendance records across every company and employee.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead className={`${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Check-out</th>
                  <th className="px-4 py-3">Late mark</th>
                  <th className="px-4 py-3">Late reason</th>
                  <th className="px-4 py-3">Checkout type</th>
                  <th className="px-4 py-3">Checkout reason</th>
                  <th className="px-4 py-3">Auto checkout at</th>
                  <th className="px-4 py-3">Start time</th>
                  <th className="px-4 py-3">End time</th>
                  <th className="px-4 py-3">Hours</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((record) => (
                  <tr key={record.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <td className="px-4 py-3 font-semibold">{record.company_name || '-'}</td>
                    <td className="px-4 py-3">{record.employee_name || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{record.employee_code || record.employee_id}</td>
                    <td className="px-4 py-3">{record.date ? new Date(record.date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">{record.time_in ? new Date(record.time_in).toLocaleTimeString() : '-'}</td>
                    <td className="px-4 py-3">{record.time_out ? new Date(record.time_out).toLocaleTimeString() : '-'}</td>
                    <td className="px-4 py-3">{record.is_late ? 'Late' : record.status}</td>
                    <td className="px-4 py-3 max-w-sm whitespace-normal">{record.late_reason || '-'}</td>
                    <td className="px-4 py-3">{record.checkout_type || '-'}</td>
                    <td className="px-4 py-3 max-w-sm whitespace-normal">{record.checkout_reason || '-'}</td>
                    <td className="px-4 py-3">{record.auto_checkout_at ? new Date(record.auto_checkout_at).toLocaleTimeString() : '-'}</td>
                    <td className="px-4 py-3">{record.company_start_time || '-'}</td>
                    <td className="px-4 py-3">{record.company_end_time || '-'}</td>
                    <td className="px-4 py-3">{record.working_hours || '-'}</td>
                  </tr>
                ))}
                {!attendanceRecords.length && (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-slate-500">No attendance records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-xl font-black dark:text-white">Realtime map</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {companyMapLocations.length} company office pins with saved locations, plus live employee positions across companies.
            </p>
          </div>
          <div className="h-96">
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={5}
              doubleClickZoom={false}
              closePopupOnClick={false}
              className="h-full w-full"
            >
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {companyMapLocations.map((company) => (
                <Marker
                  key={`company-${company.id}`}
                  position={[Number(company.latitude), Number(company.longitude)]}
                  icon={companyLocationIcon}
                >
                  <Tooltip direction="top" offset={[0, -28]} opacity={1} sticky>
                    <div className="max-w-56 rounded-md bg-white text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                      <p className="font-black">{company.name}</p>
                      <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${company.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {company.is_online ? 'Active now' : 'Inactive'}
                      </p>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{company.description || company.address || 'No company description saved.'}</p>
                    </div>
                  </Tooltip>
                  <Popup autoPan={false}>
                    <div className="space-y-1 text-sm">
                      <strong>Company:</strong> {company.name}<br />
                      <strong>Status:</strong> {company.is_online ? 'Active' : 'Inactive'}<br />
                      <strong>Email:</strong> {company.email}<br />
                      <strong>Phone:</strong> {company.phone}<br />
                      <strong>Starting time:</strong> {company.start_time || '-'}<br />
                      <strong>Ending time:</strong> {company.end_time || '-'}<br />
                      <strong>Latitude:</strong> {formatCoordinate(company.latitude)}<br />
                      <strong>Longitude:</strong> {formatCoordinate(company.longitude)}<br />
                      <strong>Address:</strong> {company.address || '-'}<br />
                      <strong>About:</strong> {company.description || '-'}
                      <button
                        type="button"
                        onClick={() => navigate(`/super-admin-dashboard/company/${company.id}`)}
                        className="mt-3 w-full rounded-md bg-violet-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        View company details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {liveLocations.map((loc) => (
                <Marker key={loc.employee_id} position={[loc.latitude, loc.longitude]} icon={employeeLocationIcon}>
                  <Popup autoPan={false}>
                    <div className="space-y-1 text-sm">
                      <strong>Company:</strong> {loc.company_name || '-'}<br />
                      <strong>Time:</strong> {new Date(loc.timestamp).toLocaleString()}<br />
                      <strong>Latitude:</strong> {formatCoordinate(loc.latitude)}<br />
                      <strong>Longitude:</strong> {formatCoordinate(loc.longitude)}<br />
                      <strong>Accuracy:</strong> {formatAccuracy(loc.accuracy)}<br />
                      <strong>Address:</strong> {loc.address || '-'}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>

        <section className="rounded-lg border border-white/70 bg-white/90 shadow-hyper dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-black dark:text-white">
              <FiMapPin /> Recent employee location records
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Real saved GPS records from employees, including id, timestamp, coordinates, accuracy, and address.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead className={`${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                <tr>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Latitude</th>
                  <th className="px-4 py-3">Longitude</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Address</th>
                </tr>
              </thead>
              <tbody>
                {locationRecords.map((loc) => (
                  <tr key={loc.id || `${loc.employee_id}-${loc.timestamp}`} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <td className="px-4 py-3 font-mono font-semibold">{loc.employee_code || `#${loc.employee_id}`}</td>
                    <td className="px-4 py-3">{loc.employee_name || '-'}</td>
                    <td className="px-4 py-3">{loc.company_name || '-'}</td>
                    <td className="px-4 py-3">{loc.timestamp ? new Date(loc.timestamp).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCoordinate(loc.latitude)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCoordinate(loc.longitude)}</td>
                    <td className="px-4 py-3">{formatAccuracy(loc.accuracy)}</td>
                    <td className="px-4 py-3 max-w-md whitespace-normal break-words">{loc.address || '-'}</td>
                  </tr>
                ))}
                {!locationRecords.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No employee location records found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
