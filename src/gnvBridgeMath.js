// Puente GNV: tres contadores independientes, como la matriz de medidores GNV.
// Se conserva cada lectura sin sustituirla por otro contador.
export const GNV_BRIDGE_CHANNELS = [
  {key:'manual', label:'Meter manual (analógico)'},
  {key:'corrected', label:'Control volumen corregido'},
  {key:'uncorrected', label:'Control volumen no corregido'}
];
const valid = v => v!=='' && v!==null && v!==undefined && Number.isFinite(Number(v)) && Number(v)>=0;
// En la matriz GNV: K = J * 28,31701636 para el contador no corregido.
export const GNV_UNCORRECTED_FACTOR = 28.31701636;
export const roundBridge = n => Math.round((n + Number.EPSILON) * 1000) / 1000;
export function computeGnvBridge(readings){
  const normalized={};
  for(const {key,label} of GNV_BRIDGE_CHANNELS){
    const r=readings?.[key];
    if(!r || !valid(r.initial) || !valid(r.final))throw Error(`Completa las lecturas inicial y final de ${label}.`);
    const initial=Number(r.initial), final=Number(r.final);
    if(final<initial)throw Error(`La lectura final no puede ser menor que la inicial en ${label}.`);
    normalized[key]={initial,final,volume:roundBridge(final-initial)};
  }
  return {readings:normalized,receivedManual:normalized.manual.volume,
    receivedCorrected:normalized.corrected.volume,
    receivedUncorrected:normalized.uncorrected.volume,
    uncorrectedConvertedM3:roundBridge(normalized.uncorrected.volume*GNV_UNCORRECTED_FACTOR)};
}
export function bridgeInitialForDate(existing,date,key,initialDoc){
  const previous=(existing||[]).filter(r=>r.date<date && r.readings?.[key]?.final!==undefined && r.readings[key].final!==null)
    .sort((a,b)=>a.date.localeCompare(b.date));
  const fromPrevious=previous.at(-1)?.readings?.[key]?.final;
  return fromPrevious??initialDoc?.readings?.[key]??null;
}
