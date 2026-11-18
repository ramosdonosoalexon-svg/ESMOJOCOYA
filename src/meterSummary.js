// Conciliación visual de la pestaña Meters (solo lectura).
// Todas las cifras de despachos proceden de meterShifts, igual que Movimiento.
// Los datos iniciales son un ANCLA al cierre del día previo, no un despacho.
import {addDaysISO} from './inventoryWindow.js';

export const isEffectiveShift = record => Boolean(record && record.status !== 'anulada');

export function effectiveDayShifts(records = [], date, productCodes = []) {
  return records.filter(r => isEffectiveShift(r) && r.date === date && productCodes.includes(r.productCode));
}

function sortChronological(a,b) {
  const day = String(a.date || '').localeCompare(String(b.date || ''));
  if (day) return day;
  const aSeq = Number(a.sequence), bSeq = Number(b.sequence);
  if (Number.isFinite(aSeq) && Number.isFinite(bSeq)) return aSeq - bSeq;
  return String(a.shiftTime || '').localeCompare(String(b.shiftTime || ''));
}

export function meterHoseDaySummary(records = [], date, productCodes = [], hoseId) {
  const rows = effectiveDayShifts(records, date, productCodes)
    .filter(r => r.hoseId === hoseId).sort(sortChronological);
  if (!rows.length) return null;
  const readings = {};
  for (const meter of ['mecanico','digital']) {
    const withReadings = rows.filter(r => r.readings?.[meter] &&
      r.readings[meter].initial !== undefined && r.readings[meter].final !== undefined);
    if (withReadings.length) {
      readings[meter] = {
        initial: Number(withReadings[0].readings[meter].initial),
        final: Number(withReadings[withReadings.length-1].readings[meter].final)
      };
    }
  }
  return {
    count: rows.length,
    grossVolume: rows.reduce((sum,r) => sum+(Number(r.grossVolume)||0),0),
    products: [...new Set(rows.map(r => r.productCode))],
    readings
  };
}

export function meterFamilyDayTotal(records = [], date, productCodes = []) {
  return effectiveDayShifts(records,date,productCodes)
    .reduce((sum,r) => sum+(Number(r.grossVolume)||0),0);
}

const validReading = v => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

// Muestra el punto de partida en la fecha inmediatamente anterior al arranque.
// Nunca se registra ese día como un arqueo ni se inventa un despacho de cero.
export function meterInitialAnchor(initialMeters = [], hoseId, initialDate, day) {
  if (!initialDate || day !== addDaysISO(initialDate,-1)) return null;
  const initial = initialMeters.find(m => m.hoseId === hoseId || m.id === hoseId);
  if (!initial) return null;
  const readings = {};
  for (const meter of ['mecanico','digital']) {
    const value = initial.readings?.[meter];
    if (validReading(value)) readings[meter] = Number(value);
  }
  return Object.keys(readings).length ? readings : null;
}

// Último final anterior al día, o dato inicial si aún no hay despacho.
// No reutiliza como inicial de un día una lectura final POSTERIOR a ese día.
export function lastConfirmedReadings(records = [], hoseId, date, initialMeters = [], initialDate) {
  if (!initialDate || date < initialDate) return null;
  const prior = records.filter(r => isEffectiveShift(r) && r.hoseId === hoseId && r.date >= initialDate && r.date < date)
    .sort(sortChronological);
  const registered = initialMeters.find(m => m.hoseId === hoseId || m.id === hoseId);
  const values = {};
  for (const meter of ['mecanico','digital']) {
    const last = [...prior].reverse().find(r => validReading(r.readings?.[meter]?.final));
    const raw = last?.readings?.[meter]?.final ?? registered?.readings?.[meter];
    if (validReading(raw)) values[meter] = Number(raw);
  }
  return Object.keys(values).length ? values : null;
}

// Estado de una casilla: registrado, base inicial o pendiente (sin final).
export function meterHoseDayCell(records = [], day, codes = [], hoseId, initialMeters = [], initialDate) {
  const summary = meterHoseDaySummary(records,day,codes,hoseId);
  if (summary) return {kind:'recorded',summary};
  const anchor = meterInitialAnchor(initialMeters,hoseId,initialDate,day);
  if (anchor) return {kind:'anchor',readings:anchor};
  const last = lastConfirmedReadings(records,hoseId,day,initialMeters,initialDate);
  if (last) return {kind:'pending',readings:last};
  return {kind:'none'};
}

// Detecta por qué Movimiento suma litros que la tabla no puede asociar
// a una manguera configurada actualmente. No reasigna ni altera registros.
export function meterOrphanDayRecords(records = [], date, codes = [], visibleHoseIds = []) {
  const ids = new Set(visibleHoseIds);
  return effectiveDayShifts(records,date,codes).filter(r => !r.hoseId || !ids.has(r.hoseId));
}

export function meterConsistencyReport(records = [], date, codes = [], visibleHoseIds = []) {
  const all = effectiveDayShifts(records,date,codes);
  const orphan = meterOrphanDayRecords(records,date,codes,visibleHoseIds);
  const total = all.reduce((a,r) => a + (Number(r.grossVolume)||0),0);
  const unlinked = orphan.reduce((a,r) => a + (Number(r.grossVolume)||0),0);
  return {total, linked:total-unlinked, unlinked, count:all.length, orphan};
}
