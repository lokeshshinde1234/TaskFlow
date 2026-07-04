import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiCalendar, FiClock, FiLogOut, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import AttendanceCard from '../components/AttendanceCard';
import LocationTracker from '../components/LocationTracker';
import MobileDotsPanel from '../components/MobileDotsPanel';
import { AuthContext } from '../context/AuthContext';
import { attendanceAPI, authAPI, employeeAPI } from '../services/api';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime';

const DEFAULT_LATE_REASON = 'Checked in more than 30 minutes after company starting time.';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { logout, theme, toggleTheme } = useContext(AuthContext);
  const [employee, setEmployee] = useState(null);
  const [company, setCompany] = useState(null);
  const [records, setRecords] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [savingLateReason, setSavingLateReason] = useState(false);
  const [geofence, setGeofence] = useState({ configured: false, companyOnline: false, inside: false, distance: null, location: null });

  const timedIn = Boolean(attendance?.time_in && !attendance?.time_out);
  const companyTimingMissing = !geofence?.company?.start_time || !geofence?.company?.end_time;
  const rawLateReason = attendance?.late_reason?.trim() || '';
  const savedLateReason = rawLateReason && rawLateReason !== DEFAULT_LATE_REASON ? rawLateReason : '';
  const isCurrentlyLate = (() => {
    const start = geofence?.company?.start_time;
    if (!start) return false;
    const [hours, minutes] = start.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    const lateAfter = new Date();
    lateAfter.setHours(hours, minutes + 30, 0, 0);
    return new Date() > lateAfter && !timedIn;
  })();
  const attendanceLabel = attendance?.time_out
    ? 'Checked out'
    : attendance?.is_late
      ? 'Late'
      : attendance?.status
        ? attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)
        : timedIn
          ? 'Present'
          : 'Ready';
  const showLateReasonField = Boolean((isCurrentlyLate && !timedIn) || attendance?.is_late);
  const showSaveLateReasonButton = Boolean(attendance?.is_late && showLateReasonField && !savedLateReason);

  const workingHours = useMemo(() => {
    const today = records.find((record) => new Date(record.date).toDateString() === new Date().toDateString());
    return today?.working_hours || (timedIn ? 'Running' : 0);
  }, [records, timedIn]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeeResponse, companyResponse] = await Promise.all([
        employeeAPI.getCurrentEmployee(),
        authAPI.employeeCompany().catch(() => ({ data: null })),
      ]);
      setEmployee(employeeResponse.data);
      setCompany(companyResponse.data);
      const attendanceResponse = await attendanceAPI.getAttendance(employeeResponse.data.id);
      setRecords(attendanceResponse.data);
      setAttendance(attendanceResponse.data.find((record) => record.time_in && !record.time_out) || attendanceResponse.data[0] || null);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to load employee dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const refreshAttendance = useCallback(async () => {
    if (!employee?.id) return;
    try {
      const attendanceResponse = await attendanceAPI.getAttendance(employee.id);
      setRecords(attendanceResponse.data);
      setAttendance(attendanceResponse.data.find((record) => record.time_in && !record.time_out) || attendanceResponse.data[0] || null);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to refresh attendance.');
    }
  }, [employee?.id]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let sent = false;
    const logoutEmployeeOnClose = () => {
      if (sent) return;
      sent = true;
      const storedToken = localStorage.getItem('token');
      if (!storedToken) return;
      authAPI.logoutOnClose(storedToken);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    };

    window.addEventListener('pagehide', logoutEmployeeOnClose);
    window.addEventListener('beforeunload', logoutEmployeeOnClose);
    return () => {
      window.removeEventListener('pagehide', logoutEmployeeOnClose);
      window.removeEventListener('beforeunload', logoutEmployeeOnClose);
    };
  }, []);

  useEffect(() => {
    if (attendance?.is_late) {
      const reason = attendance.late_reason?.trim() || '';
      setLateReason(reason === DEFAULT_LATE_REASON ? '' : reason);
    }
  }, [attendance?.id, attendance?.is_late, attendance?.late_reason]);

  const handleTimeIn = async () => {
    setMessage('');
    if (!geofence.configured) {
      setMessage('Company location is not configured. Ask your Founder Admin to set it on the map.');
      return;
    }
    if (!geofence.companyOnline) {
      setMessage('Company is not active right now. You can check in or check out only when the company owner is logged in.');
      return;
    }
    if (!geofence.location) {
      setMessage('Waiting for your GPS location before attendance can be changed.');
      return;
    }
    if (!geofence.inside) {
      setMessage('You are outside from company location. We cannot check in or check out.');
      return;
    }
    try {
      const response = await attendanceAPI.timeIn({ ...geofence.location, late_reason: lateReason.trim() || undefined });
      setAttendance(response.data);
      const attendanceResponse = await attendanceAPI.getAttendance(employee.id);
      setRecords(attendanceResponse.data);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to record time in.');
    }
  };

  const handleTimeOut = async () => {
    setMessage('');
    if (!geofence.configured) {
      setMessage('Company location is not configured. Ask your Founder Admin to set it on the map.');
      return;
    }
    if (!geofence.companyOnline) {
      setMessage('Company is not active right now. You can check in or check out only when the company owner is logged in.');
      return;
    }
    if (!geofence.location) {
      setMessage('Waiting for your GPS location before attendance can be changed.');
      return;
    }
    if (!geofence.inside) {
      setMessage('You are outside from company location. We cannot check in or check out.');
      return;
    }
    try {
      const latestAttendance = await attendanceAPI.getAttendance(employee.id);
      const latestRecords = latestAttendance.data;
      const openAttendance = latestRecords.find((record) => record.time_in && !record.time_out);
      if (!openAttendance) {
        setRecords(latestRecords);
        setAttendance(latestRecords[0] || null);
        setMessage('No active check-in found. Please check in first.');
        return;
      }
      const response = await attendanceAPI.timeOut(openAttendance.id, geofence.location);
      setAttendance(response.data);
      const attendanceResponse = await attendanceAPI.getAttendance(employee.id);
      setRecords(attendanceResponse.data);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to record time out.');
    }
  };

  const handleGeofenceChange = useCallback((nextGeofence) => {
    setGeofence(nextGeofence);
  }, []);

  const handleSaveLateReason = async () => {
    if (!attendance?.id || !attendance?.is_late) return;
    if (!lateReason.trim()) {
      setMessage('Please enter late reason before saving.');
      return;
    }
    setSavingLateReason(true);
    setMessage('');
    try {
      const response = await attendanceAPI.updateLateReason(attendance.id, lateReason.trim());
      const updated = response.data;
      setAttendance(updated);
      setRecords((current) => current.map((record) => (Number(record.id) === Number(updated.id) ? updated : record)));
      setMessage('Late reason saved successfully.');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to save late reason.');
    } finally {
      setSavingLateReason(false);
    }
  };

  const handleLogout = async () => {
    await authAPI.logout().catch(() => null);
    logout();
    navigate('/', { replace: true });
  };

  const companyLogo = company?.logo_url || employee?.company_logo_url;

  if (loading) {
    return <div className="tf-mesh-page grid min-h-screen place-items-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" /></div>;
  }

  return (
    <div className="tf-mesh-page min-h-screen text-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {companyLogo && (
              <img src={companyLogo} alt="" className="h-14 w-14 rounded-lg border border-cyan-100 bg-white object-contain p-2 shadow-sm dark:border-white/10 dark:bg-slate-900" />
            )}
            <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-500">Employee dashboard</p>
              <span className="hidden rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-700 md:inline">Mobile friendly</span>
            </div>
            <h1 className="text-xl font-black text-slate-950 dark:text-white">Hi, {employee?.first_name}</h1>
            {(company?.name || employee?.company_name) && (
              <p className="mt-1 text-sm font-semibold text-cyan-700 dark:text-cyan-300">{company?.name || employee.company_name}</p>
            )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/employee-dashboard/attendance')} className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">
              <FiCalendar /> Show attendance
            </button>
            <div className="md:hidden">
              <MobileDotsPanel
                title="Quick actions"
                subtitle="Tap to access dashboard shortcuts and account tools."
                tips={[
                  { title: 'Time controls', description: 'Use the attendance card to clock in or out quickly.' },
                  { title: 'Profile summary', description: 'Your current details and recent attendance are easy to review.' },
                ]}
                actions={[
                  { label: 'Refresh data', to: '/employee-dashboard' },
                  { label: 'Logout', onClick: handleLogout },
                ]}
              />
            </div>
            <button type="button" onClick={toggleTheme} className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 dark:border-slate-700 dark:bg-white/10 dark:text-slate-200">
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-hyper dark:bg-white dark:text-slate-950">
              <FiLogOut /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section className="grid gap-6">
          {message && <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-hyper dark:border-white/10 dark:bg-slate-900/90">
              <FiClock className="text-cyan-600 dark:text-cyan-400" />
              <p className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{attendanceLabel}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Current status</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-hyper dark:border-white/10 dark:bg-slate-900/90">
              <p className="text-sm text-slate-600 dark:text-slate-400">Today hours</p>
              <p className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{workingHours}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-hyper dark:border-white/10 dark:bg-slate-900/90">
              <p className="text-sm text-slate-600 dark:text-slate-400">Attendance records</p>
              <p className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{records.length}</p>
            </div>
          </div>

          <AttendanceCard
            timedIn={timedIn}
            attendance={attendance}
            onTimeIn={handleTimeIn}
            onTimeOut={handleTimeOut}
            loading={loading}
            geofence={geofence}
          />
          {companyTimingMissing && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Company working hours are not set. Please update starting and ending time.
            </div>
          )}
          {geofence?.company && !companyTimingMissing && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-hyper dark:border-white/10 dark:bg-slate-900/90">
              <p className="font-bold text-slate-950 dark:text-white">Company time: {geofence.company.start_time} to {geofence.company.end_time}</p>
              {showLateReasonField && (
                <label className="mt-3 block font-semibold text-slate-700 dark:text-slate-200">
                  Late reason
                  <input
                    value={lateReason}
                    onChange={(event) => setLateReason(event.target.value)}
                    placeholder="Why are you late?"
                    readOnly={Boolean(savedLateReason)}
                    className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-amber-500 read-only:bg-slate-50 read-only:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:read-only:bg-slate-800/70 dark:read-only:text-slate-300"
                  />
                  {savedLateReason && (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                      Saved reason: {savedLateReason}
                    </p>
                  )}
                </label>
              )}
              {showSaveLateReasonButton && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveLateReason}
                    disabled={savingLateReason}
                    className="w-full rounded-md bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-hyper transition hover:bg-amber-500 disabled:opacity-60 sm:w-auto"
                  >
                    {savingLateReason ? 'Saving...' : 'Save Late Reason'}
                  </button>
                </div>
              )}
            </div>
          )}
          <LocationTracker employeeId={employee?.id} onGeofenceChange={handleGeofenceChange} onAttendanceChange={refreshAttendance} />
        </section>

        <aside className="grid gap-6 content-start">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-hyper dark:border-white/10 dark:bg-slate-900/90">
            {(company?.name || employee?.company_name) && (
              <div className="mb-5 flex items-center gap-3 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">
                {companyLogo ? (
                  <img src={companyLogo} alt="" className="h-10 w-10 rounded-md bg-white object-contain p-1" />
                ) : (
                  <FiBriefcase />
                )}
                <span className="text-sm font-bold">{company?.name || employee.company_name}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-slate-900 text-cyan-300 dark:bg-white dark:text-slate-950">
                <FiUser />
              </div>
              <div>
                <h2 className="font-black text-slate-950 dark:text-white">{employee?.first_name} {employee?.last_name}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{employee?.position}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm text-slate-900 dark:text-slate-100">
              <p><span className="font-semibold text-slate-600 dark:text-slate-400">Email:</span> {employee?.email}</p>
              <p><span className="font-semibold text-slate-600 dark:text-slate-400">Department:</span> {employee?.department}</p>
              <p><span className="font-semibold text-slate-600 dark:text-slate-400">Joined:</span> {new Date(employee?.date_of_joining).toLocaleDateString()}</p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-hyper dark:border-white/10 dark:bg-slate-900/90">
            <h2 className="font-black text-slate-950 dark:text-white">Recent attendance</h2>
            <div className="mt-4 grid gap-3">
              {records.slice(0, 6).map((record) => (
                <div key={record.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="font-semibold text-slate-950 dark:text-white">{formatLocalDate(record.date)}</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {formatLocalTime(record.time_in)} to {record.time_out ? formatLocalTime(record.time_out) : 'Active'} / {record.is_late ? 'Late Mark' : record.status}
                  </p>
                  {record.is_late && <p className="mt-1 text-amber-700 dark:text-amber-300">Reason: {record.late_reason || '-'}</p>}
                  {record.checkout_type === 'auto_checkout' && (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      Auto checkout: {record.checkout_reason || '-'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
