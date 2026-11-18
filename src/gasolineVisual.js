// Representación auxiliar de GE/GE+ (no altera inventarios, facturas ni meters).
// Los porcentajes representan un MODELO teórico de mezcla homogénea, no calidad medida.
export const GAS_COLOR = Object.freeze({GE:'#263238',GE_PLUS:'#89502b',BLEND:'#d58b33'});
export const GAS_NAME = Object.freeze({GE:'Gasolina Especial',GE_PLUS:'Gasolina Especial Plus'});
export const isGasoline = code => code==='GE'||code==='GE_PLUS';
export const roundVisual = n => Math.round(((Number(n)||0)+Number.EPSILON)*1000)/1000;
export const qty = n => Math.max(0,Number(n)||0);
export const activeRow = r => r?.status!=='anulada' && /^\d{4}-\d\d-\d\d$/.test(r?.date||'');

// Desglosa las recepciones por producto SIN inventar reparto de los meters.
export function gasolineReceiptsByDate(receptions=[]){
  const result=new Map();
  for(const r of receptions){
    if(!activeRow(r)||!isGasoline(r.productCode))continue;
    const value=roundVisual(qty(r.documentLiters));
    const previous=result.get(r.date)||{GE:0,GE_PLUS:0,records:[]};
    previous[r.productCode]=roundVisual(previous[r.productCode]+value);
    previous.records.push({id:r.id||`${r.date}_${previous.records.length}`,productCode:r.productCode,liters:value});
    result.set(r.date,previous);
  }
  return result;
}

// Recupera la composición estimada del modelo a una fecha. Reconciliar con físico
// solo escala porcentajes; NO imputa físicamente litros a cada producto.
export function mixAtDate(tankModel,initialTanks=[],date){
  if(!tankModel||!date)return null;
  const first=initialTanks.find(x=>x.tankId===tankModel.tankId);
  let split;
  if(first?.productBalances && typeof first.productBalances==='object'){
    split={GE:qty(first.productBalances.GE),GE_PLUS:qty(first.productBalances.GE_PLUS)};
  }else if(first&&isGasoline(first.productCode||tankModel.sourceProduct)){
    split={GE:0,GE_PLUS:0};split[first.productCode||tankModel.sourceProduct]=qty(first.accountingLiters);
  }else{
    return null;
  }
  // Los eventos de estimateTankComposition vienen cronológicamente ordenados.
  for(const item of tankModel.timeline||[]){
    if(typeof item.at==='string'&&item.at.slice(0,10)<=date)
      split={GE:qty(item.balances?.GE),GE_PLUS:qty(item.balances?.GE_PLUS)};
    else if(item.at?.slice(0,10)>date)break;
  }
  const total=roundVisual(split.GE+split.GE_PLUS);
  return {
    GE:roundVisual(split.GE),GE_PLUS:roundVisual(split.GE_PLUS),total,
    gePct:total>0?100*split.GE/total:0,
    plusPct:total>0?100*split.GE_PLUS/total:0,
    estimated:true,
    warnings:tankModel.uncertainties||[]
  };
}

export function combineGasolineMix(tankModels=[],initialTanks=[],date){
  let ge=0,plus=0,hasData=false,warnings=[];
  for(const tank of tankModels){
    const mix=mixAtDate(tank,initialTanks,date);
    if(!mix)continue;
    hasData=true;ge+=mix.GE;plus+=mix.GE_PLUS;
    warnings.push(...mix.warnings);
  }
  if(!hasData)return null;
  const GE=roundVisual(ge),GE_PLUS=roundVisual(plus),total=roundVisual(GE+GE_PLUS);
  return {GE,GE_PLUS,total,gePct:total>0?100*GE/total:0,plusPct:total>0?100*GE_PLUS/total:0,
    warnings:[...new Set(warnings)],estimated:true};
}

export function estimatedPhysicalSplit(mix,physical){
  if(!mix||mix.total<=0||physical===null||physical===undefined||!Number.isFinite(Number(physical)))return null;
  const liters=Number(physical);
  return {GE:roundVisual(liters*mix.gePct/100),GE_PLUS:roundVisual(liters*mix.plusPct/100)};
}

export function previousISO(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
  const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-1);
  return d.toISOString().slice(0,10);
}
