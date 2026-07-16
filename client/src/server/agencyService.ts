import { getSupabase } from './supabaseClient';
import { CACHE_TTL } from './constants';

type AgencyNameRow = {
  agency_name: string | null;
  ministry_name: string | null;
};

let cachedNames: string[] | null = null;
let cachedAt = 0;
let inFlight: Promise<string[]> | null = null;

async function loadAgencyNames(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('agency')
    .select('agency_name, ministry_name, agency_order')
    .order('agency_order', { ascending: true });
  if (error) throw error;

  const names = (data ?? [])
    .map((row) => row as AgencyNameRow)
    .map((row) => row.agency_name || row.ministry_name)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

export async function fetchAgencyNames(): Promise<string[]> {
  const now = Date.now();
  if (cachedNames && now - cachedAt < CACHE_TTL.MAIN_DATA) return cachedNames;
  if (inFlight) return inFlight;

  inFlight = loadAgencyNames();
  try {
    cachedNames = await inFlight;
    cachedAt = Date.now();
    return cachedNames;
  } finally {
    inFlight = null;
  }
}
