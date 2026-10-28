import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calendarDate,calendarMonth,calendarValue} from '../lib/calendar-date.ts';

test('calendar values round trip as local days, including leap days and year boundaries',()=>{
 for(const value of ['2026-09-27','2026-03-08','2026-11-01','2024-02-29','0099-01-01','0001-01-01','9999-12-31']){
  const date=calendarDate(value);assert.ok(date,value);assert.equal(calendarValue(date),value);assert.equal(date.getHours(),12);
 }
 for(const value of ['2026-02-29','1900-02-29','2026-04-31','2026-00-10','2026-13-01','0000-01-01','27/09/2026',''])assert.equal(calendarDate(value),undefined,value);
 assert.equal(calendarValue(calendarMonth(2026,12)),'2027-01-01');assert.equal(calendarValue(calendarMonth(2026,-1)),'2025-12-01');
});
