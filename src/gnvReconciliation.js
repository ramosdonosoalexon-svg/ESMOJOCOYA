// Diagnóstico de consistencia: comparar los contadores físicos con los
// volúmenes derivados persistidos, sin mutar arqueos históricos.
function addDaysISO(date,offset){
  const d=new Date(`${date}T12:00:00Z`);
  if(!Number.isFinite(d.getTime()))return '';
  d.setUTCDate(d.getUTCDate()+offset);
  return d.toISOString().slice(0,10);
}

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
export const roundMeter = value => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;

export function recordedMeterCheck(shift){
  if(!shift || shift.status === 'anulada' || !shift.readings) return null;
  const primary = shift.primary;
  const reading = shift.readings?.[primary];
  if (!reading || !finite(reading.initial) || !finite(reading.final) || !finite(shift.grossVolume)) return null;
  const computed = roundMeter(Number(reading.final) - Number(reading.initial));
  const stored = Number(shift.grossVolume);
  const difference = roundMeter(computed - stored);
  const meterTotal = shift.meterTotals?.[primary];
  const storedMeterTotal = finite(meterTotal) ? Number(meterTotal) : null;
  const allocationTotal = Array.isArray(shift.movementLines)
    ? roundMeter(shift.movementLines.reduce((sum,line)=>sum+(Number(line.volume)||0),0)) : null;
  const inconsistent = !Number.isFinite(computed) || computed < 0 ||
    Math.abs(difference) > 0.005 ||
    (storedMeterTotal !== null && Math.abs(roundMeter(computed - storedMeterTotal)) > 0.005) ||
    (allocationTotal !== null && Math.abs(roundMeter(stored - allocationTotal)) > 0.005);
  return {id:shift.id||'',date:shift.date||'',hoseName:shift.hoseName||shift.hoseId||'',
    productCode:shift.productCode||'',primary,computed,stored,difference,
    storedMeterTotal,allocationTotal,inconsistent};
}
export function gnvMeterAudit(shifts=[],date=null){
  const rows = (shifts||[]).filter(shift=>shift.status!=='anulada' && shift.productCode==='GNV' && (!date || shift.date===date));
  const checks = rows.map(recordedMeterCheck).filter(Boolean);
  return {totalStored:roundMeter(rows.reduce((n,s)=>n+(Number(s.grossVolume)||0),0)),
    totalFromReadings:roundMeter(checks.reduce((n,s)=>n+s.computed,0)),
    mismatches:checks.filter(c=>c.inconsistent),checks};
}
export function prmDayState(records=[],day,initialDate,initialDoc){
  if(!initialDate) return {kind:'missing'};
  const baseDay=addDaysISO(initialDate,-1);
  if(day<baseDay)return {kind:'before'};
  const keys=['manual','corrected','uncorrected'];
  if(day===baseDay)return {kind:'base',readings:Object.fromEntries(keys.map(key=>[key,initialDoc?.readings?.[key]??null]))};
  const record=(records||[]).find(r=>r.date===day && keys.every(key=>r.readings?.[key]));
  if(record)return {kind:'saved',record};
  const prior=(records||[]).filter(r=>r.date<day&&r.date>=initialDate&&keys.every(key=>r.readings?.[key]?.final!==undefined))
    .sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  return {kind:'pending',readings:Object.fromEntries(keys.map(key=>[key,prior?.readings?.[key]?.final??initialDoc?.readings?.[key]??null]))};
}
export function validatePrmInput(input){
  const value=String(input??'').trim();
  // No convertir separadores implícitamente: '838.379' podría ser 838,379 o 838.379.
  if(!/^\d+(\.\d{1,3})?$/.test(value))return 'Ingresa la lectura sin separadores de miles; usa punto solo si hay decimales.';
  return null;
}
