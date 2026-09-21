/**
 * usePollResult.js
 *
 * React hook — polls GET /results/{imageId} every 2 seconds until
 * status === 'COMPLETE' or 'FAILED', then stops.
 *
 * Returns: { result, isPolling, error }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api/apiClient';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS        = 60; // stop after 2 minutes

export function usePollResult(imageId) {
  const [result,    setResult]    = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error,     setError]     = useState(null);

  const intervalRef  = useRef(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!imageId) return;

    setResult(null);
    setError(null);
    setIsPolling(true);
    pollCountRef.current = 0;

    const poll = async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > MAX_POLLS) {
        setError('Analysis timed out. Please check back later.');
        stopPolling();
        return;
      }

      try {
        const { data } = await apiClient.get(`/results/${imageId}`);

        if (data.status === 'COMPLETE' || data.status === 'FAILED') {
          setResult(data);
          stopPolling();
        }
        // status === 'PROCESSING' → keep polling
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch result');
        stopPolling();
      }
    };

    // Poll immediately, then on interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [imageId, stopPolling]);

  return { result, isPolling, error };
}
