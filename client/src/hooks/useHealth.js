/**
 * useHealth.js — Gọi health check API (custom hook).
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/health')
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e.response?.data?.message || e.message || 'Lỗi mạng');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
