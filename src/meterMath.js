import {activePriceAt,round3,round2,isISODate,isTime} from './priceMath.js';
import {isEffectiveShift} from './meterSummary.js';
import {computeInternationalSale,effectiveInternationalRate,INTERNATIONAL_CONCEPT} from './internationalPricing.js';
const fuelFamily=code=>['GE','GE_PLUS'].includes(code)?'gasolina':['DO','D_ULS'].includes(code)?'diesel':code==='GNV'?'gnv':null;
export const compatibleHoseProduct=(hoseCode,code)=>Boolean(fuelFamily(hoseCode)&&fuelFamily(hoseCode)===fuelFamily(code));
export const PAID_TYPES=new Set(['venta','prepago','postpago','calibracion_venta',INTERNATIONAL_CONCEPT]);
export const SHIFT_TYPES={
  venta:'Venta directa',prepago:'Entrega de prepago',postpago:'Entrega a crédito / postpago',
  venta_internacional:'Venta a precio internacional (factura)',
  calibracion_retorno:'Calibración con devolución al tanque',calibracion_venta:'Calibración: volumen vendido',
  limpieza:'Limpieza / purga (salida definitiva)',
  consumo_propio:'Consumo propio',otra_salida:'Otra salida definitiva'
};
const positiveNumber=v=>v!==''&&v!==null&&Number.isFinite(Number(v))&&Number(v)>=0;
export function computeMeterShift({date,shiftTime='23:59',hose,productCode,readings,primary,concept='venta',customer='',reference='',allocations=null,priceHistory=[],internationalHistory=[],sequence=0}){
  if(!isISODate(date)||!isTime(shiftTime))throw Error('Fecha u hora de operación inválida.');
  if(!hose?.id)throw Error('Manguera no encontrada.');
  if(!compatibleHoseProduct(hose.productCode,productCode))throw Error('La manguera no corresponde a la familia del producto elegido.');
  if(!(concept in SHIFT_TYPES))throw Error('Concepto de salida no válido.');
  const meterTypes=Array.isArray(hose.meterTypes)&&hose.meterTypes.length?hose.meterTypes:[hose.meterType||'mecanico'];
  if(!meterTypes.includes(primary))throw Error('Selecciona el meter principal de esta manguera.');
  const normalized={},totals={};
  for(const meter of meterTypes){
    const r=readings?.[meter];
    if(!r||!positiveNumber(r.initial)||!positiveNumber(r.final))throw Error(`Completa las lecturas inicial y final del meter ${meter}.`);
    const initial=Number(r.initial),final=Number(r.final);
    if(final<initial)throw Error(`El meter ${meter} tiene una lectura final menor que la inicial.`);
    normalized[meter]={initial,final};totals[meter]=round3(final-initial);
  }
  const gross=totals[primary];
  // El mismo arqueo puede incluir venta, vales, prepagos, crédito y calibración.
  // Las cantidades asignadas NO vuelven a restarse del meter.
  // El desglose es opcional. La venta normal se deduce automáticamente por
  // diferencia, sin forzar al operador a escribir todos los litros del meter.
  // Cuando no se abren los detalles, los litros completos son venta directa.
  const inputLines=Array.isArray(allocations)?allocations:[{concept,volume:gross,customer,reference}];
  const price=activePriceAt(priceHistory,productCode,date,shiftTime);
  const movementLines=inputLines.map(line=>{
    if(!(line.concept in SHIFT_TYPES))throw Error('Concepto de salida no válido.');
    if(productCode==='GNV'&&line.concept==='calibracion_retorno')throw Error('La calibración GNV no puede registrarse como devolución a un tanque de líquidos.');
    if(line.volume===''||!Number.isFinite(Number(line.volume))||Number(line.volume)<0)throw Error('La cantidad del desglose debe ser válida.');
    const volume=round3(Number(line.volume));
    const who=String(line.customer||'').trim(),ref=String(line.reference||'').trim();
    const voucherAccountId=String(line.voucherAccountId||'').trim();
    if(['prepago','postpago'].includes(line.concept)&&!who)throw Error('Indica el cliente de las entregas prepago o postpago.');
    if(['otra_salida','limpieza','consumo_propio'].includes(line.concept)&&!ref)throw Error('Indica el motivo o referencia de la salida definitiva.');
    if(PAID_TYPES.has(line.concept)&&!price)throw Error(`Configura primero el precio vigente del producto para ${date}.`);
    if(line.concept===INTERNATIONAL_CONCEPT){
      const tariff=effectiveInternationalRate(internationalHistory,productCode,date,shiftTime);
      const intl=computeInternationalSale(volume,tariff,ref);
      return {...intl,customer:who,paymentStatus:'por_conciliar'};
    }
    return {concept:line.concept,volume,customer:who,reference:ref,...(voucherAccountId?{voucherAccountId}:{}),amountBs:PAID_TYPES.has(line.concept)?round2(volume*price.priceBs):0,
      paymentStatus:line.concept==='postpago'?'pendiente':line.concept==='prepago'?'descontar_saldo_prepago':PAID_TYPES.has(line.concept)?'por_conciliar':'no_corresponde'};
  });
  const invoices=movementLines.filter(l=>l.concept===INTERNATIONAL_CONCEPT).map(l=>l.reference.trim().toLowerCase());
  if(new Set(invoices).size!==invoices.length)throw Error('Una misma factura internacional no puede registrarse dos veces en el arqueo.');
  const allocated=round3(movementLines.reduce((n,l)=>n+l.volume,0));
  if(allocated>gross)throw Error(`El desglose (${allocated}) no puede superar el despacho por meter (${gross}).`);
  // La tolerancia solo evita errores binarios de redondeo en el tercer decimal.
  const normalSale=round3(Math.max(0,gross-allocated));
  if(normalSale>0){
    if(!price)throw Error(`Configura primero el precio vigente del producto para ${date}.`);
    movementLines.push({concept:'venta',volume:normalSale,customer:'',reference:'',amountBs:round2(normalSale*price.priceBs),paymentStatus:'por_conciliar'});
  }
  if(!movementLines.length){
    // Arqueo de cero litros: se conserva una línea de venta sin duplicar salidas.
    movementLines.push({concept:'venta',volume:0,customer:'',reference:'',amountBs:0,paymentStatus:'por_conciliar'});
  }
  const returned=round3(movementLines.filter(l=>l.concept==='calibracion_retorno').reduce((n,l)=>n+l.volume,0));
  const net=round3(gross-returned);
  const totalAmount=round2(movementLines.reduce((n,l)=>n+l.amountBs,0));
  if(!Number.isInteger(sequence)||sequence<0||sequence>20)throw Error('Número de turno fuera de rango.');
  return {
    date,shiftTime,month:date.slice(0,7),hoseId:hose.id,hoseName:hose.name,productCode,sequence,
    concept:movementLines.length===1?movementLines[0].concept:'mixto',customer:movementLines.length===1?movementLines[0].customer:'',reference:movementLines.length===1?movementLines[0].reference:'',primary,readings:normalized,
    movementLines,meterTotals:totals,grossVolume:gross,returnedVolume:returned,netTankOutVolume:net,
    meterDifference:meterTypes.length===2?round3(totals.mecanico-totals.digital):null,
    unit:productCode==='GNV'?'m³':'L',
    priceBs:movementLines.some(l=>PAID_TYPES.has(l.concept))?price.priceBs:null,
    priceEffectiveAt:movementLines.some(l=>PAID_TYPES.has(l.concept))?`${price.effectiveDate}T${price.effectiveTime||'00:00'}`:null,
    amountBs:totalAmount,
    paymentStatus:movementLines.length===1?movementLines[0].paymentStatus:'mixto'
  };
}
export function nextMeterInitial(existing,date,hoseId,meter){
  const candidates=(existing||[]).filter(s=>isEffectiveShift(s)&&s.hoseId===hoseId&&s.date<=date&&s.readings?.[meter]);
  candidates.sort((a,b)=>(a.date.localeCompare(b.date))||(a.sequence-b.sequence));
  return candidates.length?candidates.at(-1).readings[meter].final:null;
}
// La primera apertura de una manguera toma el meter inicial de Datos iniciales
// aunque el primer arqueo se registre días después de la fecha de arranque.
export function openingMeterValue(existing,date,hoseId,meter,initialMeters=[],initialDate=null){
  if(initialDate && date<initialDate)return null;
  const desdeInicio=initialDate?(existing||[]).filter(r=>typeof r.date==='string'&&r.date>=initialDate):existing;
  const prior=nextMeterInitial(desdeInicio,date,hoseId,meter);
  if(prior!==null && prior!==undefined)return prior;
  const row=initialMeters.find(item=>item.hoseId===hoseId);
  return row?.readings?.[meter]??null;
}
// Solo para mangueras de gasolina: cambia la asignación del siguiente tramo,
// sin borrar el histórico ni reiniciar el contador de la manguera.
export function activeGasolineProduct(hose,date,rows,availableCodes){
  if(!['GE','GE_PLUS'].includes(hose?.productCode))return hose?.productCode;
  const candidates=(rows||[]).filter(r=>isEffectiveShift(r)&&r.hoseId===hose.id&&r.date<=date&&['GE','GE_PLUS'].includes(r.productCode))
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.shiftTime||'').localeCompare(String(b.shiftTime||''))||a.sequence-b.sequence);
  const last=candidates.at(-1)?.productCode;
  if(last && availableCodes.includes(last))return last;
  if(availableCodes.includes(hose.productCode))return hose.productCode;
  return availableCodes.find(code=>['GE','GE_PLUS'].includes(code))??hose.productCode;
}
export function nextSequence(existing,date,hoseId){
  const segments=(existing||[]).filter(s=>s.hoseId===hoseId&&s.date===date).map(s=>s.sequence);
  return segments.length?Math.max(...segments)+1:0;
}
export function sumDay(existing,date,code){
  const shifts=(existing||[]).filter(s=>isEffectiveShift(s)&&s.date===date&&s.productCode===code);
  return {grossVolume:round3(shifts.reduce((t,s)=>t+s.grossVolume,0)),netTankOutVolume:round3(shifts.reduce((t,s)=>t+s.netTankOutVolume,0)),amountBs:round2(shifts.reduce((t,s)=>t+s.amountBs,0)),count:shifts.length};
}
