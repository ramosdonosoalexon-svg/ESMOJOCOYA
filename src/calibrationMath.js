// Todas las alturas se almacenan en mm; los volúmenes en litros.
export function asNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const t = value.trim().replace(/\s/g, '');
  if (!t) return NaN;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

export function volumeForHeight(points, heightMm) {
  if(heightMm === '' || heightMm === null || heightMm === undefined) return null;
  const mm = Number(heightMm);
  if (!Number.isFinite(mm) || !Array.isArray(points) || points.length < 2) return null;
  const low = points[0], high = points[points.length - 1];
  if (mm < low.mm || mm > high.mm) return null; // Nunca extrapolar fuera de tabla.
  let left = 0, right = points.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    if (points[mid].mm === mm) return points[mid].liters;
    if (points[mid].mm < mm) left = mid + 1;
    else right = mid - 1;
  }
  const a = points[right], b = points[left];
  if (!a || !b || b.mm <= a.mm) return null;
  return Math.round((a.liters + (mm - a.mm) * (b.liters - a.liters) / (b.mm - a.mm)) * 1000) / 1000;
}

function numericPair(row, a, b) {
  const mm = asNumber(row?.[a]), liters = asNumber(row?.[b]);
  return Number.isFinite(mm) && Number.isFinite(liters) && mm >= 0 && liters >= 0 ? {mm, liters} : null;
}

export function extractCalibrationPoints(rows) {
  if (!Array.isArray(rows)) throw new Error('Hoja de cálculo no válida.');
  const candidates = [];
  for (let r=0;r<Math.min(rows.length,55);r++) {
    const row = rows[r] || [];
    for (let col=0;col<Math.min(row.length-1,25);col++) {
      const first = String(row[col]??'').toUpperCase();
      const second = String(row[col+1]??'').toUpperCase();
      if (/(ALTURA|MEDIDA)/.test(first) && /(VOLUMEN|CAPACIDAD)/.test(second))
        candidates.push({start:r+1,col,priority:100});
    }
  }
  // Fallback: tablas simples con dos columnas de medidas y litros.
  for (let c=0;c<Math.min(10,Math.max(...rows.slice(0,25).map(r=>r?.length||0),0)-1);c++)
    candidates.push({start:0,col:c,priority:0});
  let best = [];
  let bestScore = 0;
  for (const {start,col,priority} of candidates) {
    let run=[], maxRun=[];
    for (let r=start;r<rows.length;r++) {
      const v = numericPair(rows[r],col,col+1);
      if (v && (!run.length || (v.mm > run[run.length-1].mm && v.liters >= run[run.length-1].liters))) {
        run.push(v);
      } else if (run.length) {
        if (run.length>maxRun.length) maxRun=run;
        run=[];
      }
    }
    if(run.length>maxRun.length)maxRun=run;
    const score = maxRun.length + (maxRun.length >= 10 ? priority : 0);
    if(score>bestScore){best=maxRun;bestScore=score;}
  }
  if(best.length < 10) throw new Error('No se encontró una tabla válida de altura (mm) y volumen (L). Selecciona la hoja del tanque o exporta sus columnas a Excel.');
  if(best.length>4000) throw new Error('La tabla supera 4.000 mediciones; divide el archivo o utiliza otra tabla.');
  return best;
}
export const colorForProduct = code => ({GE:'#b91c1c',GE_PLUS:'#ed7777',DO:'#1d4ed8',D_ULS:'#85aef0',GNV:'#21866b'})[code]||'#75889a';
export const sortRegistered = items => [...items].sort((a,b)=>{
  const aa=a.createdAt?.toMillis?.()??null, bb=b.createdAt?.toMillis?.()??null;
  if(aa!==null&&bb!==null&&aa!==bb)return aa-bb;
  if(aa!==null&&bb===null)return 1;
  if(aa===null&&bb!==null)return -1;
  return (a.name||'').localeCompare(b.name||'', 'es', {numeric:true}) || a.id.localeCompare(b.id);
});
