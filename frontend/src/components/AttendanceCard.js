import React, { useEffect, useState } from 'react';
import { FiLogIn, FiLogOut } from 'react-icons/fi';
import { formatLocalDate, formatLocalTime, parseApiDateTime } from '../utils/dateTime';
import { KineticButton } from './ReactBitsUI';

export default function AttendanceCard({ timedIn, attendance, onTimeIn, onTimeOut, loading, geofence }) {
  const [, setTick] = useState(0);
  const geofenceReady = Boolean(geofence?.configured);
  const companyOnline = Boolean(geofence?.companyOnline);
  const hasCurrentLocation = Boolean(geofence?.location);
  const insideCompanyRadius = Boolean(geofenceReady && geofence?.inside);
  const attendanceDisabled = loading || !companyOnline || !insideCompanyRadius;
  const statusLabel = attendance?.time_out
    ? 'Checked out'
    : attendance?.is_late
      ? 'Late Mark'
      : attendance?.status
        ? attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)
        : timedIn
          ? 'Present'
          : 'Ready';

  useEffect(() => {
    if (!timedIn) return undefined;
    const id = setInterval(() => setTick((value) => value + 1), 30000);
    return () => clearInterval(id);
  }, [timedIn]);

  const getWorkingHours = () => {
    if (!attendance?.time_in) return '0h 0m';
    const start = parseApiDateTime(attendance.time_in);
    const end = attendance.time_out ? parseApiDateTime(attendance.time_out) : new Date();
    const diff = Math.max(0, end - start);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-hyper dark:border-white/10 dark:bg-slate-900/90 dark:text-white">
      <div className={`p-5 text-white ${timedIn ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`}>
        <p className="text-sm font-semibold uppercase opacity-90">Attendance</p>
        <h2 className="mt-1 text-2xl font-black">{statusLabel}</h2>
      </div>
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Date</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">
              {attendance?.date ? formatLocalDate(attendance.date) : formatLocalDate(new Date())}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Time in</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">{formatLocalTime(attendance?.time_in)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Time out</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">{formatLocalTime(attendance?.time_out)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Working hours</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">{getWorkingHours()}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Company start</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">{attendance?.company_start_time || geofence?.company?.start_time || '-'}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Company end</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">{attendance?.company_end_time || geofence?.company?.end_time || '-'}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Late reason</p>
            <p className="mt-2 font-bold text-slate-950 dark:text-white">{attendance?.is_late ? attendance?.late_reason || '-' : '-'}</p>
          </div>
        </div>
        {attendance?.checkout_type === 'auto_checkout' && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Auto checkout at {formatLocalTime(attendance.auto_checkout_at || attendance.time_out)}: {attendance.checkout_reason || 'Company status became inactive before end time'}
          </div>
        )}
        <div className="mt-5">
          {!geofenceReady && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Company location is not configured. Ask your Founder Admin to set it on the map.
            </div>
          )}
          {geofenceReady && !companyOnline && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Company is not active right now. You can check in or check out only when the company owner is logged in.
            </div>
          )}
          {geofenceReady && companyOnline && !hasCurrentLocation && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Waiting for your GPS location before attendance can be changed.
            </div>
          )}
          {geofenceReady && companyOnline && hasCurrentLocation && !insideCompanyRadius && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              You are outside from company location. We cannot check in or check out.
            </div>
          )}
          {geofenceReady && companyOnline && insideCompanyRadius && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              You are inside the company radius. Attendance will update automatically.
            </div>
          )}
          {timedIn ? (
            <button type="button" onClick={onTimeOut} disabled={attendanceDisabled} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-5 py-3 font-bold text-white shadow-hyper disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              <FiLogOut /> Time out
            </button>
          ) : (
            <KineticButton type="button" onClick={onTimeIn} disabled={attendanceDisabled} className="w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60">
              <FiLogIn /> Time in
            </KineticButton>
          )}
        </div>
      </div>
    </section>
  );
}
