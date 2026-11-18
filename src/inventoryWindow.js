// Fechas ISO (AAAA-MM-DD). El cálculo se hace en UTC para evitar saltos por zona horaria.
export function addDaysISO(value, offset) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + offset * 86400000).toISOString().slice(0, 10);
}

export function inventoryWindow(date) {
  return Array.from({length: 9}, (_, index) => addDaysISO(date, index - 5));
}

/**
 * La fecha operativa se determina por el último día con mediciones para el
 * producto. Si todos sus tanques tienen lectura, avanza al día siguiente;
 * en caso contrario se permanece allí hasta completar el cierre físico.
 * No permite que una lectura de otra estación/producto cambie la fecha.
 */
export function nextInventoryDate(readings, tanks, startDate, fallbackDate) {
  const enabled = new Set(tanks.filter(t => t.active !== false).map(t => t.id));
  if (enabled.size === 0) return startDate || fallbackDate;
  const relevant = (readings || []).filter(r => enabled.has(r.tankId) &&
    typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    (!startDate || r.date >= startDate));
  if (!relevant.length) return startDate || fallbackDate;
  const lastDate = relevant.reduce((max, reading) => reading.date > max ? reading.date : max, relevant[0].date);
  const done = new Set(relevant.filter(r => r.date === lastDate).map(r => r.tankId));
  return [...enabled].every(id => done.has(id)) ? addDaysISO(lastDate, 1) : lastDate;
}

export function latestReadingsByTank(readings) {
  const latest = new Map();
  for (const r of readings || []) {
    if (!r.tankId || !r.date) continue;
    const saved = latest.get(r.tankId);
    if (!saved || r.date > saved.date) latest.set(r.tankId, r);
  }
  return latest;
}

export const productTones = {
  GE: {name:'Gasolina Especial', color:'#263238', shade:'#7f8b90', dark:'#141c20'},
  GE_PLUS: {name:'Gasolina Especial Plus', color:'#89502b', shade:'#d4a579', dark:'#5c321b'},
  DO: {name:'Diésel Oil', color:'#2862b1', shade:'#7bc8f0', dark:'#193e7d'},
  D_ULS: {name:'Diésel ULS', color:'#6babe6', shade:'#c1e5ff', dark:'#3d7db6'},
  GNV: {name:'Gas Natural Vehicular', color:'#13877e', shade:'#9bded4', dark:'#126157'}
};
