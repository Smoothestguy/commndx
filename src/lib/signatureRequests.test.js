import { expect, test } from 'bun:test';
import { summarizeSignatures } from './signatureRequests.ts';

test('a person with two stays counts once and is signed if any stay is signed', () => {
  const s = summarizeSignatures([
    { personnelId: 'a', name: 'Ana', signature: null }, { personnelId: 'a', name: 'Ana', signature: 'x.png' },
    { personnelId: 'b', name: 'Bo', signature: null },
  ]);
  expect(s.total).toBe(2); expect(s.signed).toBe(1); expect(s.missing.map(m => m.name)).toEqual(['Bo']);
});

 test('missing names include a demobilized worker with worked rows without requiring active roster',()=>{
 const summary=summarizeSignatures([{personnelId:'removed',name:'Demobilized Worker',signature:null},{personnelId:'active',name:'Active Worker',signature:'ink.png'}]);
 expect(summary.missing.map(r=>r.personnelId)).toEqual(['removed']);expect(summary.missing.map(r=>r.name)).toEqual(['Demobilized Worker']);
 });
