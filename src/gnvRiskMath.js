// Conciliación GNV para la matriz operacional: siempre comparar m³ corregidos
// del PRM contra m³ entregados por las mangueras en el MISMO intervalo.
// Se trata de una diferencia técnica indicativa, NO una prueba de fuga.
const round3 = n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const round4 = n => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
const number = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const CATEGORIES = Object.freeze({
  venta:'contado', venta_internacional:'contado', consumo_propio:'consumoPropio',
  calibracion_venta:'calibracion', calibracion_retorno:'calibracion',
  prepago:'prepago', postpago:'postpago',
  limpieza:'otros', otra_salida:'otros'
});

export function classifyGnvShifts(shifts=[]){
  const out={contado:0,consumoPropio:0,calibracion:0,prepago:0,postpago:0,otros:0,sinClasificar:0};
  const problems=[];
  for(const s of shifts){
    if(s?.status==='anulada' || s?.productCode!=='GNV')continue;
    const gross=round3(Math.max(0,number(s.grossVolume)));
    const lines=Array.isArray(s.movementLines) ? s.movementLines : [];
    if(!lines.length){
      const category=CATEGORIES[s.concept] || (s.concept==='mixto'?'sinClasificar':'sinClasificar');
      out[category]=round3(out[category]+gross);
      if(category==='sinClasificar'&&gross>0)problems.push(`${s.hoseName||s.hoseId||'Manguera'}: sin clasificación`);
      continue;
    }
    const allocated=round3(lines.reduce((n,l)=>n+Math.max(0,number(l.volume)),0));
    // No permitir que las categorías visuales superen el meter ni contabilizar
    // dos veces registros antiguos que traigan datos inconsistentes.
    if(allocated>gross+0.005 || lines.some(l=>!Number.isFinite(Number(l.volume)) || Number(l.volume)<0)){
      out.sinClasificar=round3(out.sinClasificar+gross);
      problems.push(`${s.hoseName||s.hoseId||'Manguera'}: desglose excede el meter`);
      continue;
    }
    for(const line of lines){
      const key=CATEGORIES[line.concept]||'sinClasificar';
      out[key]=round3(out[key]+number(line.volume));
    }
    // Como en Meters: lo no identificado dentro del meter es venta normal.
    const remainder=round3(Math.max(0,gross-allocated));
    out.contado=round3(out.contado+remainder);
  }
  return {categories:out,problems};
}

export function gnvDailyVariance(corrected,dispensed){
  if(corrected===null || corrected===undefined || dispensed===null || dispensed===undefined ||
     !Number.isFinite(Number(corrected)) || !Number.isFinite(Number(dispensed)) ||
     Number(corrected)<0 || Number(dispensed)<0){
    return {signed:null,percent:null,loss:null,surplus:null};
  }
  const signed=round3(Number(dispensed)-Number(corrected));
  const percent=Number(corrected)>0?round4(100*signed/Number(corrected)):(Number(dispensed)===0?0:null);
  return {signed,percent,loss:round3(Math.max(0,-signed)),surplus:round3(Math.max(0,signed))};
}

export function gnvMonthlySummary(rows=[],month=''){
  const relevant=rows.filter(r=>typeof r.date==='string'&&r.date.startsWith(`${month}-`));
  const observed=relevant.filter(r=>Number.isFinite(r.receivedCorrected)&&r.receivedCorrected>=0&&
    Number.isFinite(r.outVolume)&&r.outVolume>=0&&Number.isFinite(r.signedDifference)&&
    (r.receivedCorrected>0 || (r.hasBridge && r.hasMeters)));
  const corrected=round3(observed.reduce((n,r)=>n+r.receivedCorrected,0));
  const dispensed=round3(observed.reduce((n,r)=>n+r.outVolume,0));
  const signed=round3(observed.reduce((n,r)=>n+r.signedDifference,0));
  const loss=round3(observed.reduce((n,r)=>n+Math.max(0,-r.signedDifference),0));
  const surplus=round3(observed.reduce((n,r)=>n+Math.max(0,r.signedDifference),0));
  const dailyAverage=observed.length?round4(observed.reduce((n,r)=>n+Math.max(0,-r.differencePercent),0)/observed.length):null;
  return {
    month,observedDays:observed.length,totalDays:relevant.length,
    complete:relevant.length>=28&&observed.length===relevant.length,
    corrected,dispensed,signed,loss,surplus,
    lossRatePct:corrected>0?round4(100*loss/corrected):null,
    surplusRatePct:corrected>0?round4(100*surplus/corrected):null,
    signedRatePct:corrected>0?round4(100*signed/corrected):null,
    dailyAverageLossPct:dailyAverage
  };
}

export function compareGnvMonthlyRisk(current,previous,thresholdFraction=0.10){
  if(!previous?.complete || previous?.lossRatePct===null || previous?.lossRatePct===undefined ||
     !current || !current.observedDays || current.lossRatePct===null){
    return {status:'sin_referencia',threshold:null,relativeIncreasePct:null};
  }
  const prior=previous.lossRatePct;
  if(prior<=0){
    return {status:'referencia_cero',threshold:0,relativeIncreasePct:null};
  }
  const threshold=round4(prior*(1+thresholdFraction));
  const increase=round4(100*(current.lossRatePct/prior-1));
  const status=current.lossRatePct>threshold+0.00001?'critico':current.lossRatePct>prior+0.00001?'superior':'dentro';
  const priorSurplus=previous.surplusRatePct;
  const surplusThreshold=priorSurplus>0?round4(priorSurplus*(1+thresholdFraction)):null;
  const surplusStatus=surplusThreshold!==null&&current.surplusRatePct>surplusThreshold+0.00001?'critico':
    priorSurplus!==null&&priorSurplus!==undefined&&current.surplusRatePct>priorSurplus+0.00001?'superior':'dentro';
  return {status,threshold,relativeIncreasePct:increase,surplusThreshold,surplusStatus};
}

// Vista resumida diaria: reutiliza exactamente la regla de diferencia
// empleada por los movimientos de GNV. No convierte ausencias en cero.
export function gnvDailyIndicator(row={}){
  const variance=gnvDailyVariance(row.receivedCorrected,row.outVolume);
  if(variance.signed===null || variance.percent===null){
    return {state:'pendiente',signed:null,percent:null,lossM3:null,lossPercent:null,surplusM3:null,surplusPercent:null};
  }
  const state=variance.signed<0?'merma':variance.signed>0?'demasia':'igual';
  return {
    state,signed:variance.signed,percent:variance.percent,
    lossM3:variance.loss,lossPercent:variance.signed<0?round4(-variance.percent):0,
    surplusM3:variance.surplus,surplusPercent:variance.signed>0?variance.percent:0
  };
}
