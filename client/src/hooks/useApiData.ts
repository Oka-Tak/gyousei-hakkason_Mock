"use client";

import { useEffect, useState } from 'react';

export interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiData<T>(url: string | null, fallbackError: string): ApiDataState<T> {
  const [state, setState] = useState<ApiDataState<T>>({
    data: null,
    loading: url !== null,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: fallbackError });
      return;
    }

    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });

    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as T;
        if (controller.signal.aborted) return;
        setState({ data, loading: false, error: null });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : fallbackError,
        });
      }
    })();

    return () => controller.abort();
  }, [fallbackError, url]);

  return state;
}
