import path from 'path';
import { readText, csvToObjects } from './csv';

const dataDir = path.join(process.cwd(), 'data');

type AnyRec = Record<string, string>;

let cache: Record<string, AnyRec[]> = {};

function loadCsvOnce(filename: string): AnyRec[] {
  if (cache[filename]) return cache[filename];
  const p = path.join(dataDir, filename);
  const text = readText(p);
  const rows = csvToObjects(text);
  cache[filename] = rows;
  return rows;
}

export function loadProjectOverview(): AnyRec[] {
  return loadCsvOnce('1-2_RS_2024_基本情報_事業概要等.csv');
}

export function loadPolicyLaw(): AnyRec[] {
  return loadCsvOnce('1-3_RS_2024_基本情報_政策・施策、法令等.csv');
}

export function loadSubsidy(): AnyRec[] {
  return loadCsvOnce('1-4_RS_2024_基本情報_補助率等.csv');
}

export function loadRelatedProjects(): AnyRec[] {
  return loadCsvOnce('1-5_RS_2024_基本情報_関連事業.csv');
}

export function loadKpiSeries(): AnyRec[] {
  return loadCsvOnce('3-1_RS_2024_効果発現経路_目標・実績.csv');
}

export function loadKpiLinks(): AnyRec[] {
  return loadCsvOnce('3-2_RS_2024_効果発現経路_目標のつながり.csv');
}

export function findProjectIdsByName(part: string): string[] {
  const list = loadProjectOverview();
  const p = (part || '').toLowerCase();
  const set = new Set<string>();
  for (const r of list) {
    const name = (r['事業名'] || '').toLowerCase();
    if (!p || name.includes(p)) set.add(r['予算事業ID']);
  }
  return Array.from(set);
}

