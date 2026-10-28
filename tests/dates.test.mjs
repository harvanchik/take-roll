import assert from 'node:assert/strict';
import {test} from 'node:test';
import {formatDay,formatTimestamp} from '../lib/dates.ts';
test('dates use the requested day-month-year and twelve-hour format',()=>{
 assert.equal(formatDay('2026-10-13'),'13 Oct 2026');
 assert.equal(formatTimestamp('2026-10-13T18:24:55Z','America/Chicago'),'13 Oct 2026, 1:24 PM');
 assert.equal(formatTimestamp('2026-10-13T00:04:00Z','UTC'),'13 Oct 2026, 12:04 AM');
});
