import test from 'node:test';
import assert from 'node:assert/strict';
import {gnvMeterAudit,prmDayState,validatePrmInput,recordedMeterCheck} from '../src/gnvReconciliation.js';
const initialDoc={readings:{manual:83796672,corrected:27865024,uncorrected:837966}};
const shifts=[
 {id:'1',date:'2026-11-01',hoseName:'LADO GNV 1A',productCode:'GNV',status:'vigente',primary:'digital',readings:{digital:{initial:730966.67,final:732267.11}},grossVolume:1300.44,meterTotals:{digital:1300.44},movementLines:[{volume:1300.44}]},
 {id:'2',date:'2026-11-01',hoseName:'LADO GNV 1B',productCode:'GNV',status:'vigente',primary:'digital',readings:{digital:{initial:252981.52,final:254842.47}},grossVolume:1860.95},
 {id:'3',date:'2026-11-01',hoseName:'LADO GNV 2A',productCode:'GNV',status:'vigente',primary:'digital',readings:{digital:{initial:341558.01,final:343047.71}},grossVolume:1.49,meterTotals:{digital:1.49},movementLines:[{volume:1.49}]},
 {id:'4',date:'2026-11-01',hoseName:'LADO GNV 2B',productCode:'GNV',status:'vigente',primary:'digital',readings:{digital:{initial:446401.45,final:447396.77}},grossVolume:995.32}
];
test('GNV2A detects difference between corrected reading and cached grossVolume',()=>{
 const result=recordedMeterCheck(shifts[2]);assert.equal(result.stored,1.49);assert.equal(result.computed,1489.7);assert.equal(result.difference,1488.21);assert.equal(result.inconsistent,true);
});
test('Audit compares saved 4158.2 m3 vs current readings 5646.41 m3',()=>{
 const audit=gnvMeterAudit(shifts,'2026-11-01');assert.equal(audit.totalStored,4158.2);assert.equal(audit.totalFromReadings,5646.41);assert.equal(audit.mismatches.length,1);
});
test('Canceled meter is not counted',()=>{
 const audit=gnvMeterAudit([...shifts,{...shifts[2],id:'old',status:'anulada'}]);assert.equal(audit.mismatches.length,1);
});
test('PRM initial anchor is previous day, without fabricated volume',()=>{
 const anchor=prmDayState([], '2026-10-31','2026-11-01',initialDoc);assert.equal(anchor.kind,'base');assert.equal(anchor.readings.corrected,27865024);
});
test('PRM pending day shows inherited base until saved',()=>{
 const pending=prmDayState([], '2026-11-01','2026-11-01',initialDoc);assert.equal(pending.kind,'pending');assert.equal(pending.readings.uncorrected,837966);
});
test('PRM carries all saved final values to following date',()=>{
 const saved=[{date:'2026-11-01',readings:{manual:{initial:83796672,final:83837991},corrected:{initial:27865024,final:27870941},uncorrected:{initial:837966,final:838379}}}];
 const pending=prmDayState(saved,'2026-11-02','2026-11-01',initialDoc);assert.equal(pending.readings.manual,83837991);assert.equal(pending.readings.corrected,27870941);
});
test('PRM rejects ambiguous thousands separators',()=>{
 assert.ok(validatePrmInput('83,837991'));assert.equal(validatePrmInput('83837991'),null);assert.equal(validatePrmInput('83837991.125'),null);assert.ok(validatePrmInput('838.379.91'));
});
