export const UNIT_BY_CODE={GE:'L',GE_PLUS:'L',DO:'L',D_ULS:'L',GNV:'m³'};
export const DISPLAY_BY_CODE={GE:'Gasolina Especial',GE_PLUS:'Gasolina Especial Plus',DO:'Diésel Oil',D_ULS:'Diésel ULS',GNV:'Gas Natural Vehicular'};
export const ACTIVE_PRODUCT_CODES=Object.keys(UNIT_BY_CODE);
export const isISODate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'));
export const isTime=s=>typeof s==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s);
export function activePriceAt(entries,code,date,time='23:59'){
  if(!isISODate(date)||!isTime(time))return null;
  const cutoff=`${date}T${time}`;
  const eligible=(entries||[]).filter(p=>p.productCode===code&&isISODate(p.effectiveDate)&&`${p.effectiveDate}T${p.effectiveTime||'00:00'}`<=cutoff&&Number.isFinite(p.priceBs)&&p.priceBs>0);
  eligible.sort((a,b)=>`${a.effectiveDate}T${a.effectiveTime||'00:00'}`.localeCompare(`${b.effectiveDate}T${b.effectiveTime||'00:00'}`));
  return eligible.at(-1)||null;
}
export const round3=n=>Math.round((n+Number.EPSILON)*1000)/1000;
export const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
