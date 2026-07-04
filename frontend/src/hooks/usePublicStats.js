import { useEffect, useState } from 'react';
import { publicAPI } from '../services/api';

const fallbackStats = {
  total_companies: 0,
  active_companies: 0,
  total_employees: 0,
  active_employees: 0,
  active_sessions: 0,
  open_attendance_sessions: 0,
  attendance_records: 0,
  tracked_locations: 0,
  payroll_total: 0,
  latest_companies: [],
};

export default function usePublicStats() {
  const [stats, setStats] = useState(fallbackStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    publicAPI.stats()
      .then((response) => {
        if (mounted) {
          setStats({ ...fallbackStats, ...response.data });
        }
      })
      .catch(() => {
        if (mounted) {
          setStats(fallbackStats);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { stats, loading };
}
