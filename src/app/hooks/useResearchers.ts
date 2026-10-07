import { useState, useEffect } from 'react';
import { apiService } from '../services/api.service';
import { mockResearchers, Researcher } from '../data/mockData';
import { API_CONFIG } from '../config/api.config';

/**
 * Custom hook to fetch researchers
 * Automatically falls back to mock data if API fails or USE_MOCK_DATA is true
 */
export function useResearchers() {
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResearchers = async () => {
      setLoading(true);
      setError(null);

      // Use mock data if enabled in config
      if (API_CONFIG.USE_MOCK_DATA) {
        setResearchers(mockResearchers);
        setLoading(false);
        return;
      }

      try {
        const data = await apiService.getResearchers();
        setResearchers(data);
      } catch (err) {
        console.error('Failed to fetch researchers, using mock data:', err);
        setError('Failed to load researchers from API. Using cached data.');
        setResearchers(mockResearchers); // Fallback to mock data
      } finally {
        setLoading(false);
      }
    };

    fetchResearchers();
  }, []);

  return { researchers, loading, error };
}

/**
 * Custom hook to fetch a single researcher by ID
 */
export function useResearcher(id: string) {
  const [researcher, setResearcher] = useState<Researcher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResearcher = async () => {
      setLoading(true);
      setError(null);

      // Use mock data if enabled in config
      if (API_CONFIG.USE_MOCK_DATA) {
        const found = mockResearchers.find((r) => r.id === id);
        setResearcher(found || null);
        setLoading(false);
        return;
      }

      try {
        const data = await apiService.getResearcherById(id);
        setResearcher(data);
      } catch (err) {
        console.error('Failed to fetch researcher, using mock data:', err);
        setError('Failed to load researcher from API. Using cached data.');
        const found = mockResearchers.find((r) => r.id === id);
        setResearcher(found || null);
      } finally {
        setLoading(false);
      }
    };

    fetchResearcher();
  }, [id]);

  return { researcher, loading, error };
}
