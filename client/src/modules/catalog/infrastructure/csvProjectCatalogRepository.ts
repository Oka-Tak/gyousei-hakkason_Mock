import path from 'path';
import type {
  CatalogRecord,
  ProjectCatalogRepository,
} from '../application/projectCatalogRepository';
import { csvToObjects, readText } from './csv';

const dataDirectory = path.join(process.cwd(), 'data');
const cache = new Map<string, CatalogRecord[]>();

function loadCsvOnce(filename: string): readonly CatalogRecord[] {
  const cached = cache.get(filename);
  if (cached) return cached;
  const records = csvToObjects(readText(path.join(dataDirectory, filename)));
  cache.set(filename, records);
  return records;
}

export const csvProjectCatalogRepository: ProjectCatalogRepository = {
  getProjectOverviews: () => loadCsvOnce('1-2_RS_2024_基本情報_事業概要等.csv'),
  getPolicies: () => loadCsvOnce('1-3_RS_2024_基本情報_政策・施策、法令等.csv'),
  getSubsidies: () => loadCsvOnce('1-4_RS_2024_基本情報_補助率等.csv'),
  getRelatedProjects: () => loadCsvOnce('1-5_RS_2024_基本情報_関連事業.csv'),
  getKpiSeries: () => loadCsvOnce('3-1_RS_2024_効果発現経路_目標・実績.csv'),
  getKpiLinks: () => loadCsvOnce('3-2_RS_2024_効果発現経路_目標のつながり.csv'),
};
