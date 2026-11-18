// Precio internacional fiscal: separado del precio local y del volumen de los meters.
// El diferencial publicado por la ANH NO siempre es una resta directa de precios.
import {round2,round3,isISODate,isTime} from './priceMath.js';
import {isEffectiveShift} from './meterSummary.js';

export const INTERNATIONAL_CONCEPT = 'venta_internacional';
export function effectiveInternationalRate(entries,code,date,time='23:59') {
  if (!isISODate(date)||!isTime(time)) return null;
  const cutoff=`${date}T${time}`;
  return (entries||[]).filter(p=>p.productCode===code && isISODate(p.effectiveDate) &&
    isTime(p.effectiveTime||'00:00') && `${p.effectiveDate}T${p.effectiveTime||'00:00'}`<=cutoff &&
    Number.isFinite(p.internationalPriceBs)&&p.internationalPriceBs>0 &&
    Number.isFinite(p.differentialBs)&&p.differentialBs>=0 && p.differentialBs<=p.internationalPriceBs)
    .sort((a,b)=>`${a.effectiveDate}T${a.effectiveTime||'00:00'}`.localeCompare(`${b.effectiveDate}T${b.effectiveTime||'00:00'}`)).at(-1)||null;
}
export function computeInternationalSale(volume,rate,reference) {
  const n=Number(volume),ref=String(reference||'').trim();
  if(!Number.isFinite(n)||n<=0)throw Error('Indica los litros o m³ de la factura internacional.');
  if(!rate||!Number.isFinite(rate.internationalPriceBs)||rate.internationalPriceBs<=0||
     !Number.isFinite(rate.differentialBs)||rate.differentialBs<0||rate.differentialBs>rate.internationalPriceBs)
     throw Error('Falta un precio internacional y diferencial ANH válidos para la fecha del despacho. Configúralos antes de registrar la factura.');
  if(ref.length<3||ref.length>160)throw Error('Identifica la factura internacional con una referencia de 3 a 160 caracteres.');
  const gross=round2(n*rate.internationalPriceBs);
  const ypfb=round2(n*rate.differentialBs);
  return {
    concept:INTERNATIONAL_CONCEPT,volume:round3(n),reference:ref,
    amountBs:gross,internationalPriceBs:rate.internationalPriceBs,
    differentialBs:rate.differentialBs,ypfbDifferentialBs:ypfb,
    stationRevenueBs:round2(gross-ypfb),
    internationalRateEffectiveAt:`${rate.effectiveDate}T${rate.effectiveTime||'00:00'}`,
    internationalResolution:rate.resolutionNumber
  };
}
const money=x=>Number.isFinite(Number(x))?Number(x):0;
export function internationalMonthlyLedger(shifts=[],deposits=[],month='') {
  const docs=[];
  for(const s of shifts||[]){
    if(!isEffectiveShift(s)||!String(s.date||'').startsWith(month+'-'))continue;
    for(const [i,l] of (s.movementLines||[]).entries()){
      if(l.concept!==INTERNATIONAL_CONCEPT)continue;
      const valid=Number.isFinite(l.ypfbDifferentialBs)&&Number.isFinite(l.stationRevenueBs)&&
        Number.isFinite(l.amountBs)&&Number.isFinite(l.volume)&&Boolean(l.reference);
      docs.push({id:`${s.id||s.hoseId}_${i}`,date:s.date,shiftTime:s.shiftTime,productCode:s.productCode,
        hoseName:s.hoseName,reference:l.reference||'',volume:money(l.volume),unit:s.unit||'L',
        amountBs:money(l.amountBs),ypfbBs:money(l.ypfbDifferentialBs),
        stationBs:money(l.stationRevenueBs),valid});
    }
  }
  const periodDeposits=(deposits||[]).filter(d=>d.period===month&&d.status!=='anulada');
  const gross=round2(docs.filter(d=>d.valid).reduce((n,d)=>n+d.amountBs,0));
  const ypfb=round2(docs.filter(d=>d.valid).reduce((n,d)=>n+d.ypfbBs,0));
  const station=round2(docs.filter(d=>d.valid).reduce((n,d)=>n+d.stationBs,0));
  const deposited=round2(periodDeposits.reduce((n,d)=>n+money(d.amountBs),0));
  const remaining=round2(ypfb-deposited);
  const byProduct={};
  for(const d of docs.filter(x=>x.valid)){
    const a=byProduct[d.productCode]||{count:0,volume:0,amountBs:0,ypfbBs:0,stationBs:0};
    a.count++;a.volume=round3(a.volume+d.volume);a.amountBs=round2(a.amountBs+d.amountBs);
    a.ypfbBs=round2(a.ypfbBs+d.ypfbBs);a.stationBs=round2(a.stationBs+d.stationBs);
    byProduct[d.productCode]=a;
  }
  return {month,docs,deposits:periodDeposits,byProduct,gross,ypfb,station,deposited,remaining,
    unpriced:docs.filter(d=>!d.valid)};
}
