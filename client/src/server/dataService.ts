import { CACHE_TTL, BUDGET_YEAR } from './constants';
import {
  getMainBudgetData,
  type MainBudgetDataRow,
} from '@/modules/budget/application/getMainBudgetData';
import { supabaseBudgetReadRepository } from '@/modules/budget/infrastructure/supabaseBudgetReadRepository';

export type MainDataRow = MainBudgetDataRow;

// Simple in-memory cache with TTL to avoid repeated heavy work
let mainDataCache: MainDataRow[] | null = null;
let mainDataCachedAt = 0;
let mainDataInFlight: Promise<MainDataRow[]> | null = null;
const MAIN_LIMIT = Number(process.env.MAIN_DATA_LIMIT || (process.env.NODE_ENV === 'development' ? 800 : 2000));

export async function fetchMainData(): Promise<MainDataRow[]> {
  const now = Date.now();
  if (mainDataCache && now - mainDataCachedAt < CACHE_TTL.MAIN_DATA) {
    return mainDataCache;
  }
  if (mainDataInFlight) return mainDataInFlight;

  mainDataInFlight = getMainBudgetData(supabaseBudgetReadRepository, {
    budgetYear: BUDGET_YEAR.CURRENT,
    limit: MAIN_LIMIT,
  });
  try {
    const rows = await mainDataInFlight;
    mainDataCache = rows;
    mainDataCachedAt = Date.now();
    return rows;
  } finally {
    mainDataInFlight = null;
  }
}
