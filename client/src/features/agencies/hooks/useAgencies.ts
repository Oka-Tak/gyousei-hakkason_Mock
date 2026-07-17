"use client";

import { useApiData } from '@/hooks/useApiData';

const AGENCIES_ERROR = '省庁一覧の取得に失敗しました';

export function useAgencies() {
  const { data, ...state } = useApiData<string[]>('/api/agencies', AGENCIES_ERROR);
  return { agencies: data ?? [], ...state };
}
