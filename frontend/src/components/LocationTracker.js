import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, Circle } from 'react-leaflet';
import { FiMapPin, FiNavigation, FiPauseCircle } from 'react-icons/fi';
import { KineticButton } from './ReactBitsUI';
import { locationAPI, authAPI } from '../services/api';
import 'leaflet/dist/leaflet.css';

const markerIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const distanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const radius = 6371000;
  const dlat = toRadians(lat2 - lat1);
  const dlon = toRadians(lon2 - lon1);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dlon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 15);
  }, [map, position]);
  return null;
}

export default function LocationTracker({ employeeId, onGeofenceChange, onAttendanceChange }) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [company, setCompany] = useState(null);
  const watchRef = useRef(null);
  const sendIntervalRef = useRef(null);
  const latestCoordsRef = useRef(null);
  const companyRef = useRef(null);
  const lastSendRef = useRef(0);

  const position = useMemo(
    () => (location ? [location.latitude, location.longitude] : [28.6139, 77.209]),
    [location]
  );

  const stopTracking = useCallback(() => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    latestCoordsRef.current = null;
    lastSendRef.current = 0;
    setTracking(false);
  }, []);

  const updateGeofenceStatus = useCallback((coords, companyData = companyRef.current) => {
    if (companyData?.latitude == null || companyData?.longitude == null) {
      onGeofenceChange?.({ configured: false, companyOnline: Boolean(companyData?.is_online), inside: false, distance: null, company: companyData || null, location: coords || null });
      return;
    }

    if (!coords) {
      onGeofenceChange?.({ configured: true, companyOnline: Boolean(companyData.is_online), inside: false, distance: null, company: companyData, location: null });
      return;
    }

    const distance = distanceMeters(companyData.latitude, companyData.longitude, coords.latitude, coords.longitude);
    onGeofenceChange?.({
      configured: true,
      companyOnline: Boolean(companyData.is_online),
      inside: distance <= (companyData.geo_radius_meters || 100),
      distance,
      company: companyData,
      location: coords,
    });
  }, [onGeofenceChange]);

  const sendCurrentLocation = useCallback(async (coords) => {
    if (!coords || !employeeId) return;
    try {
      const companyResponse = await authAPI.employeeCompany().catch(() => null);
      if (companyResponse?.data) {
        companyRef.current = companyResponse.data;
        setCompany(companyResponse.data);
        updateGeofenceStatus(coords, companyResponse.data);
      }
      const response = await locationAPI.trackLocation({
        employee_id: employeeId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
      setLocation(response.data);
      setError('');
      onAttendanceChange?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to save current location.');
    }
  }, [employeeId, onAttendanceChange, updateGeofenceStatus]);

  const startTracking = useCallback(() => {
    if (!employeeId || !navigator.geolocation || watchRef.current) {
      if (!navigator.geolocation) setError('Geolocation is not supported in this browser.');
      return;
    }
    setTracking(true);

    // fetch company geofence
    authAPI.employeeCompany()
      .then((res) => {
        companyRef.current = res.data;
        setCompany(res.data);
        updateGeofenceStatus(latestCoordsRef.current, res.data);
      })
      .catch(() => {
        setCompany(null);
        onGeofenceChange?.({ configured: false, companyOnline: false, inside: false, distance: null, company: null, location: null });
      });

    // watchPosition updates latest coords; we send them at fixed interval
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const current = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
        latestCoordsRef.current = current;
        setLocation(current);
        updateGeofenceStatus(current);
        setError('');
        const now = Date.now();
        if (!lastSendRef.current || now - lastSendRef.current > 15000) {
          lastSendRef.current = now;
          sendCurrentLocation(current);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    // send every 20 seconds
    sendIntervalRef.current = setInterval(async () => {
      const c = latestCoordsRef.current;
      if (!c) return;
      lastSendRef.current = Date.now();
      updateGeofenceStatus(c);
      await sendCurrentLocation(c);
    }, 20000);
  }, [employeeId, onGeofenceChange, sendCurrentLocation, updateGeofenceStatus]);

  useEffect(() => {
    startTracking();
    return stopTracking;
  }, [employeeId, startTracking, stopTracking]);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-hyper dark:border-white/10 dark:bg-slate-900/90 dark:text-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-300">Live location</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">GPS tracking</h2>
        </div>
        <div className="flex gap-2">
          <KineticButton
            type="button"
            onClick={startTracking}
            disabled={tracking}
            className="px-3 py-2 text-sm"
          >
            <FiNavigation /> {tracking ? 'Tracking' : 'Start'}
          </KineticButton>
          <button
            type="button"
            onClick={stopTracking}
            disabled={!tracking}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            <FiPauseCircle /> Stop
          </button>
        </div>
      </div>

      <div className="p-5">
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs text-slate-600 dark:text-slate-400">Latitude</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950 dark:text-white">{location?.latitude?.toFixed(6) || 'Waiting'}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs text-slate-600 dark:text-slate-400">Longitude</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950 dark:text-white">{location?.longitude?.toFixed(6) || 'Waiting'}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs text-slate-600 dark:text-slate-400">Accuracy</p>
            <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
              {location?.accuracy ? `${Math.round(location.accuracy)} m` : 'Pending'}
            </p>
          </div>
        </div>

        <div className="h-80 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <MapContainer center={position} zoom={location ? 15 : 4} scrollWheelZoom className="h-full">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap position={position} />
            {company && company.latitude != null && company.longitude != null && (
              <Circle
                center={[company.latitude, company.longitude]}
                radius={company.geo_radius_meters || 100}
                pathOptions={{ color: 'cyan', fillColor: 'rgba(6,182,212,0.1)' }}
              />
            )}
            {location && (
              <Marker position={position} icon={markerIcon}>
                <Popup>
                  <div className="flex items-center gap-2">
                    <FiMapPin />
                    <span>Employee current location</span>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </section>
  );
}
