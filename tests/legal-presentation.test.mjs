import assert from 'node:assert/strict';
import {test} from 'node:test';
import {legalHeading,legalEffectiveDate,legalBodyText,currentCopyrightYear} from '../lib/legal-presentation.ts';
test('legal headings preserve acronyms and lowercase minor words except first',()=>{
 assert.equal(legalHeading('Terms Of Service & EULA'),'Terms of Service & EULA');
 assert.equal(legalHeading('And The Use Of Records'),'And the Use of Records');
 assert.equal(legalHeading('Scope And Instructions'),'Scope and Instructions');
});
test('effective dates use unambiguous day month year in every timezone',()=>{
 assert.equal(legalEffectiveDate('2026-01-01'),'1 January 2026');
 assert.equal(legalBodyText('Effective October 17, 2026. Text.','2026-10-17'),'Effective 17 October 2026. Text.');
});
test('copyright follows the device year with a safe 2026 fallback',()=>{
 assert.equal(currentCopyrightYear(new Date(2031,0,1)),2031);
 assert.equal(currentCopyrightYear(new Date(NaN)),2026);
 assert.equal(currentCopyrightYear(new Date(2020,0,1)),2026);
});
