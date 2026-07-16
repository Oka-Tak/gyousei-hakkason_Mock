import path from 'path';
import { readText, csvToObjects } from './csv';

const dataDir = path.join(process.cwd(), 'data');

export type CsvRecord = Record<string, string>;

const cache: Record<string, CsvRecord[]> = {};

function loadCsvOnce(filename: string): CsvRecord[] {
  if (cache[filename]) return cache[filename];
  const p = path.join(dataDir, filename);
  const text = readText(p);
  const rows = csvToObjects(text);
  cache[filename] = rows;
  return rows;
}

export function loadProjectOverview(): CsvRecord[] {
  return loadCsvOnce('1-2_RS_2024_基本情報_事業概要等.csv');
}

export function loadPolicyLaw(): CsvRecord[] {
  return loadCsvOnce('1-3_RS_2024_基本情報_政策・施策、法令等.csv');
}

export function loadSubsidy(): CsvRecord[] {
  return loadCsvOnce('1-4_RS_2024_基本情報_補助率等.csv');
}

export function loadRelatedProjects(): CsvRecord[] {
  return loadCsvOnce('1-5_RS_2024_基本情報_関連事業.csv');
}

export function loadKpiSeries(): CsvRecord[] {
  return loadCsvOnce('3-1_RS_2024_効果発現経路_目標・実績.csv');
}

export function loadKpiLinks(): CsvRecord[] {
  return loadCsvOnce('3-2_RS_2024_効果発現経路_目標のつながり.csv');
}
