// Arqueos de operadores en modo pruebas: nunca escribe en Meters oficiales.
const safe = n => {const x=Number(n);return Number.isFinite(x)?x:0;};
export const r2 = n => Math.round((safe(n)+Number.EPSILON)*100)/100;
export const r3 = n => Math.round((safe(n)+Number.EPSILON)*1000)/1000;
export const unitFor = code => code==='GNV'?'m³':'L';
export const allowedConcepts = ['prepago','postpago','consumo_propio','calibracion_retorno','calibracion_venta','limpieza','otra_salida'];
export function pilotHoseTotals(row){
  const types=(row.meterTypes||['mecanico']);
  const selected=types.includes(row.primary)?row.primary:types[0];
  const calculated={};
  for (const type of types){
    const initial=row[`${type}Initial`],final=row[`${type}Final`];
    calculated[type]=(initial===''||initial==null||final===''||final==null)?null:r3(safe(final)-safe(initial));
  }
  return {primary:selected,difference:calculated[selected],calculated};
}
export function pilotSettlement(shift){
  const hoses=shift.readings||[];
  const lines=shift.allocations||[];
  const warnings=[];let totalSales=0,otherValue=0;
  const byProduct={};
  for(const row of hoses){
    const value=pilotHoseTotals(row);
    if(value.difference===null){warnings.push(`Falta lectura inicial/final en ${row.hoseName}`);continue;}
    if(value.difference<0)warnings.push(`Final inferior al inicial en ${row.hoseName}`);
    if(value.calculated.digital!=null&&value.calculated.mecanico!=null&&Math.abs(value.calculated.digital-value.calculated.mecanico)>0.01)warnings.push(`Meters mecánico y digital diferentes en ${row.hoseName}`);
    const vol=Math.max(0,value.difference);
    byProduct[row.productCode]=r3((byProduct[row.productCode]||0)+vol);
    if(row.priceBs===''||row.priceBs==null||safe(row.priceBs)<=0){warnings.push(`Falta precio aplicable para ${row.hoseName}`);continue;}
    totalSales=r2(totalSales+r2(vol*safe(row.priceBs)));
  }
  for(const item of lines){
    if(!allowedConcepts.includes(item.concept))warnings.push('Concepto de salida desconocido');
    if(item.volume===''||!Number.isFinite(Number(item.volume))||Number(item.volume)<0)warnings.push('Volumen especial inválido');
    if(['prepago','postpago'].includes(item.concept)&&!String(item.customer||'').trim())warnings.push('Falta cliente del vale');
    if(!String(item.reference||'').trim()&&['prepago','postpago','otra_salida'].includes(item.concept))warnings.push('Falta referencia del comprobante');
    const rowPrice=hoses.find(h=>h.productCode===item.productCode&&safe(h.priceBs)>0)?.priceBs;
    if(rowPrice==null)warnings.push(`Falta precio de ${item.productCode} para valorizar el vale`);
    if(item.concept!=='calibracion_venta')otherValue=r2(otherValue+r2(safe(item.volume)*safe(rowPrice)));
  }
  const specialByProduct={};
  for(const l of lines){specialByProduct[l.productCode]=r3((specialByProduct[l.productCode]||0)+safe(l.volume));}
  for(const [p,v] of Object.entries(specialByProduct))if(v>(byProduct[p]||0)+0.001)warnings.push(`Vales/salidas de ${p}: ${v} supera meters ${byProduct[p]||0}`);
  const qr=r2(shift.payments?.qr),card=r2(shift.payments?.card);
  const expected=r2(totalSales-otherValue-qr-card);
  if(expected<0)warnings.push('Descuentos o cobros superiores a ventas: revisar');
  const rendered=r2(safe(shift.payments?.cash)+safe(shift.payments?.deposit));
  const difference=r2(rendered-expected);
  return {totalSales,otherValue,qr,card,expectedCash:expected,renderedCash:rendered,difference,byProduct,warnings};
}
export function compareAdjacentReadings(events,hoseId,tolerance=0.01){
  // Eventos start/end independientes. Un cierre de medianoche no es entrega de turno.
  const all=(events||[]).filter(e=>e.hoseId===hoseId&&(e.phase==='inicio'||e.phase==='final')&&e.reading!=null&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(e.observedAt||'')))
    .sort((a,b)=>String(a.observedAt).localeCompare(String(b.observedAt))||String(a.id).localeCompare(String(b.id)));
  const results=[];
  for(const entrant of all.filter(e=>e.phase==='inicio')){
    const previous=all.filter(e=>e.phase==='final'&&e.operatorUid!==entrant.operatorUid&&e.observedAt<=entrant.observedAt&&e.shiftId!==entrant.shiftId).at(-1);
    if(!previous){results.push({incoming:entrant.id,status:'pendiente'});continue;}
    const minutes=(Date.parse(entrant.observedAt)-Date.parse(previous.observedAt))/60000;
    if(!Number.isFinite(minutes)||minutes>180){results.push({incoming:entrant.id,status:'pendiente'});continue;}
    const difference=r3(safe(entrant.reading)-safe(previous.reading));
    results.push({incoming:entrant.id,outgoing:previous.id,difference,status:Math.abs(difference)<=tolerance?'conciliado':'diferencia'});
  }
  return results;
}
export function operatorPilotValidation(entry,today=new Date()){
  if(!entry.readings?.length)return ['Elige al menos una manguera'];
  const day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  // Solo un turno fechado HOY requiere ambas horas automáticas.
  // Jornadas anteriores no piden horas, pero mantienen sus meters y vales.
  if(entry.kind==='turno'&&entry.date===day&&(!entry.startedAt||!entry.endedAt))return ['No se registró el horario automático de hoy'];
  if(entry.kind==='turno'&&entry.startedAt&&entry.endedAt&&entry.endedAt<entry.startedAt)return ['El cierre es anterior al inicio'];
  const issues=[];
  for(const row of entry.readings){
    for(const type of row.meterTypes||['mecanico']){
      if(row[`${type}Final`]===''||row[`${type}Final`]==null)issues.push(`Falta final ${type} de ${row.hoseName}`);
      if(entry.kind==='turno'&&(row[`${type}Initial`]===''||row[`${type}Initial`]==null))issues.push(`Falta inicial ${type} de ${row.hoseName}`);
      if(entry.kind==='turno'&&Number(row[`${type}Final`])<Number(row[`${type}Initial`]))issues.push(`Final menor que inicial en ${row.hoseName}`);
    }
  }
  if(entry.kind==='medianoche')return issues;
  const calc=pilotSettlement(entry);
  issues.push(...calc.warnings.filter(w=>/supera meters|volumen especial inválido|Falta cliente|Falta referencia|Concepto de salida desconocido/i.test(w)));
  return issues;
}
