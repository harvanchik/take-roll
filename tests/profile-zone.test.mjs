import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileInitials} from '../lib/workspace-settings.ts';
import {timeZoneOffset} from '../lib/dates.ts';

test('profile initials use the first two names and handle whitespace and Unicode',()=>{
 for(const [name,want] of [['JExample25 HExample22','JH'],['  Preview   Admin  ','PA'],['Émile Zola','ÉZ'],['Alex','A'],['Alex Morgan Smith','AM'],['','U']])assert.equal(profileInitials(name),want);
});
test('time zone offsets include daylight saving, negative and fractional offsets',()=>{
 const winter=new Date('2026-01-15T12:00:00Z'),summer=new Date('2026-07-15T12:00:00Z');
 assert.equal(timeZoneOffset('UTC',winter),'UTC+00:00');
 assert.equal(timeZoneOffset('America/Chicago',winter),'UTC-06:00');
 assert.equal(timeZoneOffset('America/Chicago',summer),'UTC-05:00');
 assert.equal(timeZoneOffset('Asia/Kolkata',summer),'UTC+05:30');
 assert.equal(timeZoneOffset('Asia/Kathmandu',summer),'UTC+05:45');
 assert.match(timeZoneOffset('device',summer),/^UTC[+-]\d{2}:\d{2}$/);
});
