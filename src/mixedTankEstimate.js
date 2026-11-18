// Estimación orientativa de la composición de tanques con dos grados de combustible.
// NO es análisis químico, ni declara cuál producto salió realmente del surtidor.
// La venta facturada conserva el producto elegido en el arqueo. No modifica Firestore.
import {round3} from './priceMath.js';
import {sameFamily} from './receptionMath.js';
const isoDay = value => typeof value==='string' ? value.slice(0,10) : '';
const timestamp = value => typeof value==='string' && value.includes('T') ? value.slice(0,16) : `${isoDay(value)}T00:00`;
const quantity = value => Math.max(0,Number(value)||0);
const sorted = events => events.sort((a,b) => a.at.localeCompare(b.at)||a.order-b.order);
const valid = row => row?.status!=='anulada';
export function estimateTankComposition({tanks=[],initialTanks=[],receptions=[],meterShifts=[],hoses=[],untilDate,fromDate}={}){
  const output=[];
  for(const tank of tanks.filter(t=>t.productCode!=='GNV')){
    const initial=initialTanks.find(r=>r.tankId===tank.id);
    const balance={};let dataQuality=[];const timeline=[];
    if(initial){
      const splits=initial.productBalances;
      if(splits&&typeof splits==='object'){
        for(const [code,amount] of Object.entries(splits))if(sameFamily(code,tank.productCode))balance[code]=quantity(amount);
      }else if(sameFamily(initial.productCode||tank.productCode,tank.productCode)){
        balance[initial.productCode||tank.productCode]=quantity(initial.accountingLiters);
      }
    }else dataQuality.push('Sin saldo contable inicial del tanque');
    const events=[];
    for(const receipt of receptions.filter(r=>valid(r)&&r.tankId===tank.id&&sameFamily(r.productCode,tank.productCode)&&(!untilDate||r.date<=untilDate)&&(!fromDate||r.date>=fromDate))){
      events.push({kind:'receipt',at:timestamp(receipt.finishedAt||receipt.date),order:0,record:receipt});
    }
    for(const shift of meterShifts.filter(r=>valid(r)&&sameFamily(r.productCode,tank.productCode)&&(!untilDate||r.date<=untilDate)&&(!fromDate||r.date>=fromDate))){
      const h=hoses.find(x=>x.id===shift.hoseId);
      const ids=h?.feedTankIds?.length?h.feedTankIds:(h?.tankId?[h.tankId]:[]);
      if(ids.length===1&&ids[0]===tank.id){
        events.push({kind:'out',at:`${shift.date}T${shift.shiftTime||'23:59'}`,order:1,record:shift});
      }else if(ids.includes(tank.id))dataQuality.push('Despachos con alimentación desde varios tanques sin asignación');
    }
    let estimatedOut={},received={},truncated=0;
    for(const event of sorted(events)){
      const r=event.record;
      if(event.kind==='receipt'){
        const vol=quantity(r.documentLiters)+quantity(r.otherIncomeLiters);
        if(r.oldProductAccountingL!=null && r.priorProductCode && r.priorProductCode!==r.productCode && Math.abs(quantity(r.oldProductAccountingL)-quantity(balance[r.priorProductCode]))>Math.max(5,quantity(r.oldProductAccountingL)*0.01))dataQuality.push('El remanente declarado difiere del saldo estimado anterior a la descarga');
        balance[r.productCode]=round3((balance[r.productCode]||0)+vol);
        received[r.productCode]=round3((received[r.productCode]||0)+vol);
        if(r.quality!=='verificable_con_meters')dataQuality.push('Recepción con diferencia de transporte provisional');
        // Esta estimación sitúa la entrada al finalizar la descarga. Ventas intermedias
        // requieren lecturas verificadas y cronología más detallada.
        if(r.meterMode==='meters' && quantity(r.salesDuringReceptionL)>0)dataQuality.push('Hubo ventas durante descarga; asignación de mezcla aproximada');
      }else{
        const outgoing=quantity(r.netTankOutVolume);
        let vol=outgoing;
        const total=Object.values(balance).reduce((a,b)=>a+b,0);
        if(total<=0){if(vol>0)dataQuality.push('Meter sin saldo teórico suficiente para repartir');continue;}
        if(vol>total+0.001){truncated+=vol-total;dataQuality.push('Salidas superiores al saldo calculado; estimación limitada');vol=total;}
        const keys=Object.keys(balance).filter(k=>balance[k]>0);
        keys.forEach((code,index)=>{
          const take=index===keys.length-1?Math.min(balance[code],vol):Math.min(balance[code],round3(Math.min(outgoing,total)*balance[code]/total));
          balance[code]=round3(Math.max(0,balance[code]-take));
          estimatedOut[code]=round3((estimatedOut[code]||0)+take);
          vol=round3(Math.max(0,vol-take));
        });
      }
      const currentTotal=round3(Object.values(balance).reduce((a,b)=>a+b,0));
      timeline.push({at:event.at,kind:event.kind,productCode:r.productCode,volume:event.kind==='receipt'?round3(quantity(r.documentLiters)):round3(quantity(r.netTankOutVolume)),balances:{...balance},total:currentTotal});
    }
    const total=round3(Object.values(balance).reduce((a,b)=>a+b,0));
    output.push({tankId:tank.id,tankName:tank.name,sourceProduct:tank.productCode,total,
      estimatedBalances:balance,estimatedOut,received,timeline,uncertainties:[...new Set(dataQuality)],truncatedL:round3(truncated),
      method:'mezcla_homogenea_estimada',note:'Reparto proporcional teórico, no análisis de composición ni dato para facturación o control de calidad.'});
  }
  return output;
}
