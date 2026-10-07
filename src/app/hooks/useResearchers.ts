import { useState, useEffect } from 'react';
import { apiService } from '../services/api.service';
import type { Researcher } from '../data/mockData';

/**
 * Custom hook to fetch researchers from SQLite Database API
 */
export function useResearchers() {
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getResearchers();
      setResearchers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Failed to load researchers from database:', err);
      setError('Could not connect to database.');
      setResearchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  return { researchers, loading, error, refresh };
}

/**
 * Custom hook to fetch a single researcher by ID from SQLite Database API
 */
export function useResearcher(id: string) {
  const [researcher, setResearcher] = useState<Researcher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchResearcher = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getResearcherById(id);
        setResearcher(data || null);
      } catch (err: any) {
        console.warn('Failed to load researcher from database:', err);
        setError('Researcher not found in database.');
        setResearcher(null);
      } finally {
        setLoading(false);
      }
    };

    fetchResearcher();
  }, [id]);

  return { researcher, loading, error };
}
