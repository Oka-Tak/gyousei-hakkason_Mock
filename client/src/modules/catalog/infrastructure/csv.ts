import fs from 'fs';

export function readText(path: string): string {
  const buffer = fs.readFileSync(path);
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let index = 0;
  let row: string[] = [];
  let field = '';
  let quoted = false;

  while (index < text.length) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (character === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (character === '\r') {
      index += 1;
      continue;
    }
    if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
      continue;
    }
    field += character;
    index += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvToObjects(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [headerRow, ...records] = rows;
  const headers = headerRow.map((header) => header.trim());
  return records
    .filter((record) => !(record.length === 1 && record[0] === ''))
    .map((record) => Object.fromEntries(
      headers.map((header, index) => [header, record[index] ?? '']),
    ));
}
