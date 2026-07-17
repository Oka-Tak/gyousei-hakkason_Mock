import assert from 'node:assert/strict';
import test from 'node:test';
import { csvToObjects } from './csv';

test('csvToObjects preserves quoted CSV values and trims headers', () => {
  const records = csvToObjects(' name ,description\r\n"a,b","say ""hello"""\r\n');
  assert.deepEqual(records, [{ name: 'a,b', description: 'say "hello"' }]);
});
