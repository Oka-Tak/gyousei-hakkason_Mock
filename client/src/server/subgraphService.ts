import { z } from 'zod';
import { getSupabase } from './supabaseClient';
import { BUDGET_YEAR, CACHE_TTL } from './constants';
import { RawProjectDataSchema } from '@/types/schemas';
import type { RawProjectData } from '@/types';
import {
  matchesOrganizationPath,
  parseOrganizationNodeId,
  type OrganizationHierarchy,
} from '@/modules/budget/domain/organizationPath';

type AgencyRow = {
  agency_id: string;
  agency_name: string | null;
  agency_order: number | null;
  ministry_name: string | null;
};

type OrganizationRow = {
  organization_id: string;
  agency_id: string | null;
  bureau_office: string | null;
  department: string | null;
  division: string | null;
  unit: string | null;
  section: string | null;
  group: string | null;
  team: string | null;
};

type ProjectRow = {
  project_id: number;
  project_name: string | null;
  organization_id: string | null;
  budget_year: number | null;
  initial_budget_total: number | null;
};

type CacheEntry = { at: number; data: RawProjectData[] };

const PROJECT_LIMIT_DEFAULT = 600;
const MAX_CACHE_ENTRIES = 100;
const subgraphCache = new Map<string, CacheEntry>();
const requestsInFlight = new Map<string, Promise<RawProjectData[]>>();

function toOrganizationHierarchy(row: OrganizationRow): OrganizationHierarchy {
  return {
    bureau: row.bureau_office,
    department: row.department,
    division: row.division,
    office: row.unit,
    section: row.section,
    group: row.group,
    team: row.team,
  };
}

async function findAgencies(topLevel: string): Promise<AgencyRow[]> {
  const supabase = getSupabase();
  const selection = 'agency_id, agency_name, agency_order, ministry_name';
  const byAgency = await supabase
    .from('agency')
    .select(selection)
    .eq('agency_name', topLevel);
  if (byAgency.error) throw byAgency.error;
  if (byAgency.data?.length) return byAgency.data as AgencyRow[];

  const byMinistry = await supabase
    .from('agency')
    .select(selection)
    .eq('ministry_name', topLevel);
  if (byMinistry.error) throw byMinistry.error;
  return (byMinistry.data ?? []) as AgencyRow[];
}

async function loadSubgraph(nodeId: string, projectLimit: number): Promise<RawProjectData[]> {
  const nodeReference = parseOrganizationNodeId(nodeId);
  if (!nodeReference) return [];

  const agencyRows = await findAgencies(nodeReference.topLevel);
  if (agencyRows.length === 0) return [];

  const agencyIds = agencyRows.map((agency) => agency.agency_id);
  const { data: organizations, error: organizationError } = await getSupabase()
    .from('organization')
    .select('organization_id, agency_id, bureau_office, department, division, unit, section, group, team')
    .in('agency_id', agencyIds);
  if (organizationError) throw organizationError;

  // Graph paths omit empty hierarchy levels, so positional database filters can
  // target the wrong column. Normalize each row before matching the path.
  const organizationRows = ((organizations ?? []) as OrganizationRow[])
    .filter((organization) => matchesOrganizationPath(
      toOrganizationHierarchy(organization),
      nodeReference.path,
    ));
  if (organizationRows.length === 0) return [];

  const organizationIds = organizationRows.map((organization) => organization.organization_id);
  const { data: projects, error: projectError } = await getSupabase()
    .from('project')
    .select('project_id, project_name, organization_id, budget_year, initial_budget_total')
    .in('organization_id', organizationIds)
    .eq('budget_year', BUDGET_YEAR.CURRENT)
    .order('initial_budget_total', { ascending: false })
    .limit(projectLimit);
  if (projectError) throw projectError;

  const organizationById = new Map(
    organizationRows.map((organization) => [organization.organization_id, organization]),
  );
  const agencyById = new Map(agencyRows.map((agency) => [agency.agency_id, agency]));

  // Spending details are intentionally loaded only after a project is selected.
  // Keeping them out of the graph payload removes thousands of unused rows.
  const merged = ((projects ?? []) as ProjectRow[]).map((project) => {
    const organization = project.organization_id
      ? organizationById.get(project.organization_id)
      : undefined;
    const agency = organization?.agency_id ? agencyById.get(organization.agency_id) : undefined;
    return {
      ...project,
      agency_name: agency?.agency_name,
      ministry_name: agency?.ministry_name || agency?.agency_name,
      bureau_agency: organization?.bureau_office,
      department: organization?.department,
      division: organization?.division,
      office: organization?.unit,
      section: organization?.section,
      group: organization?.group,
      team: organization?.team,
      spending_list: [],
    };
  });

  return z.array(RawProjectDataSchema).parse(merged);
}

function cacheResult(key: string, data: RawProjectData[]): void {
  if (subgraphCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = subgraphCache.keys().next().value as string | undefined;
    if (oldestKey) subgraphCache.delete(oldestKey);
  }
  subgraphCache.set(key, { at: Date.now(), data });
}

export async function fetchSubgraph(
  nodeId: string,
  options?: { projectLimit?: number },
): Promise<RawProjectData[]> {
  const projectLimit = options?.projectLimit ?? PROJECT_LIMIT_DEFAULT;
  const cacheKey = `${nodeId}::${projectLimit}`;
  const cached = subgraphCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL.SUBGRAPH) return cached.data;
  if (cached) subgraphCache.delete(cacheKey);

  const pending = requestsInFlight.get(cacheKey);
  if (pending) return pending;

  const request = loadSubgraph(nodeId, projectLimit);
  requestsInFlight.set(cacheKey, request);
  try {
    const data = await request;
    cacheResult(cacheKey, data);
    return data;
  } finally {
    requestsInFlight.delete(cacheKey);
  }
}
