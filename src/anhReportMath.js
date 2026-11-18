// Reportes preparatorios ANH / Octano. No sustituyen formularios emitidos por ANH.
import {buildLiquidMovements,buildGnvMovements,monthDays,validMonth,validRecord, MOVEMENT_CODES,MOVEMENT_NAMES,LIQUID_GROUPS} from './movementMath.js';
import {internationalMonthlyLedger} from './internationalPricing.js';

const r2=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
const n=x=>x===null||x===undefined||!Number.isFinite(Number(x))?null:Number(x);
const v=x=>n(x)??0;
export const REPORT_PRODUCTS=Object.freeze(MOVEMENT_CODES);
export const REPORT_NAMES=MOVEMENT_NAMES;
export const reportIsPuesto=s=>String(s?.type||'').toLowerCase().includes('puesto');
export const reportProducts=(s,products=[])=>{
  const configured=products.filter(x=>x.active===true).map(x=>x.code);
  return MOVEMENT_CODES.filter(code=>configured.includes(code) && (!reportIsPuesto(s)||code!=='GNV'));
};
export const reportType=(s,products=[])=>reportIsPuesto(s)?'puesto':reportProducts(s,products).includes('GNV')?'mixta':'liquidos';
export const reportDateLimit=(month,nowISO)=>validMonth(month)?(nowISO?.startsWith(month)?nowISO:(nowISO<`${month}-01`?`${month}-00`:monthDays(month).at(-1))):'';
const classifyLiquid=(row,shared)=>{
  if(!row||row.beginning===null||row.beginning===undefined)return null;
  const beginning=n(row.beginning),receipt=v(row.receiptL),other=v(row.otherIncomeL),netOut=v(row.outL);
  const sale=row.hasShift?netOut:null;
  const accounting=r2(beginning+receipt+other-netOut);
  const physical=n(row.physical);
  // En tanques compartidos, sin medición física independiente no se inventa un reparto.
  const delta=physical===null?null:r2(physical-accounting);
  return {
    beginning,receipt,other,sale,accounting,
    plus:delta===null?null:Math.max(0,delta),loss:delta===null?null:Math.max(0,-delta),
    incoming:delta===null?null:r2(receipt+other+Math.max(0,delta)),
    outgoing:delta===null?null:r2(netOut+Math.max(0,-delta)),
    physical,shared:shared&&physical===null,
    status:physical===null?(shared?'SIN DESGLOSE FISICO POR PRODUCTO':'SIN CIERRE FISICO'):(row.hasShift?'CONCILIADO':'SIN METERS')
  };
};
function asExportRow(date,source,shared,cutoff){
  if(date>cutoff)return {date,status:'FUTURO',beginning:null,receipt:null,other:null,sale:null,plus:null,loss:null,incoming:null,outgoing:null,physical:null,accounting:null};
  const base=classifyLiquid(source,shared);
  if(!base)return {date,status:'SIN DATOS INICIALES',beginning:null,receipt:null,other:null,sale:null,plus:null,loss:null,incoming:null,outgoing:null,physical:null,accounting:null};
  const inactive=base.beginning===0 && !v(source?.receiptL) && !v(source?.otherIncomeL) && !v(source?.outL) && !source?.hasActivity;
  const status=inactive?'SIN MOVIMIENTO':source?.transportProvisional&&base.physical!==null?'REVISAR RECEPCION':base.status;
  return {date,...base,status};
}
const summation=(rows,key)=>r2(rows.reduce((acc,x)=>acc+(Number.isFinite(x[key])?x[key]:0),0));
const safeMonth=(month)=>{if(!validMonth(month))throw new Error('Mes inválido.');return month;};
export function buildAnhReport({month,station={},products=[],tanks=[],initialTanks=[],initialSettings=[],inventoryReadings=[],receptions=[],meterShifts=[],gnvBridge=[],nowISO}={}){
  safeMonth(month);
  const active=reportProducts(station,products),today=nowISO||new Date().toISOString().slice(0,10);
  const cutoff=reportDateLimit(month,today),dates=monthDays(month);
  const initialDate=initialSettings.find(x=>x.id==='start')?.date||null;
  const liquid=buildLiquidMovements({month,products,tanks,initialTanks,initialDate,inventoryReadings,receptions,meterShifts});
  const liquids={};
  for(const code of active.filter(x=>x!=='GNV')){
    const group=code==='GE'||code==='GE_PLUS'?'gasolina':'diesel';
    const shared=(LIQUID_GROUPS[group]||[]).filter(c=>active.includes(c)).length>1;
    const source=new Map((liquid.products[code]||[]).map(x=>[x.date,x]));
    let prior=r2(initialTanks.filter(x=>x.productCode===code).reduce((n,x)=>n+v(x.accountingLiters),0));
    const rows=dates.map(date=>{
      const raw=source.get(date);
      if(date<=cutoff && initialDate && date>=initialDate && (!raw||!raw.hasActivity)){
        // Sin arqueo/cierre no asumimos 0 ventas ni un saldo físico.
        return {date,beginning:prior,receipt:null,other:null,sale:null,accounting:null,
          plus:null,loss:null,incoming:null,outgoing:null,physical:null,status:'SIN REGISTRO DEL DÍA'};
      }
      const result=asExportRow(date,raw,shared,cutoff);
      if(raw?.hasActivity){if(Number.isFinite(raw.physical))prior=raw.physical;
        else if(Number.isFinite(raw.closing))prior=raw.closing;}
      return result;
    });
    liquids[code]={name:MOVEMENT_NAMES[code],unit:'L',rows,summary:{receipt:summation(rows,'receipt'),sale:summation(rows,'sale'),surplus:summation(rows,'plus'),loss:summation(rows,'loss')},
      pending:rows.filter(r=>r.date<=cutoff && !['CONCILIADO','SIN MOVIMIENTO','FUTURO'].includes(r.status)).length};
  }
  const family={};
  for(const [key,codes] of Object.entries(LIQUID_GROUPS)){
    if(!codes.some(x=>active.includes(x)))continue;
    const byDay=new Map((liquid.families[key]||[]).map(x=>[x.date,x]));
    family[key]=dates.map(date=>{
      const x=byDay.get(date);
      if(date>cutoff || !x || x.beginning===null||x.beginning===undefined)return {date,status:date>cutoff?'FUTURO':'SIN DATOS',physical:null};
      const beginning=n(x.beginning),received=v(x.receiptL)+v(x.otherIncomeL),sale=v(x.outL);
      const accounting=r2(beginning+received-sale),physical=n(x.physical),delta=physical===null?null:r2(physical-accounting);
      return {date,beginning,receipt:received,sale,accounting,physical,delta,
        surplus:delta===null?null:Math.max(0,delta),loss:delta===null?null:Math.max(0,-delta),
        status:physical===null?'SIN CIERRE FISICO':'CONCILIADO'};
    });
  }
  const gnv=active.includes('GNV')&&!reportIsPuesto(station)?buildGnvMovements({month,bridge:gnvBridge,meterShifts}):null;
  const gasRows=gnv?gnv.map(x=>({
    date:x.date,receivedManual:n(x.receivedManual),receivedCorrected:n(x.receivedCorrected),
    venta:n(x.outVolume),counted:n(x.categories?.contado),prepago:n(x.categories?.prepago),
    postpago:n(x.categories?.postpago),consumo:n(x.categories?.consumoPropio),
    calibracion:n(x.categories?.calibracion),otros:n(x.categories?.otros),
    sinClasificar:n(x.categories?.sinClasificar),diferencia:n(x.signedDifference),porcentaje:n(x.differencePercent),
    status:x.date>cutoff?'FUTURO':(x.outVolume===null?'SIN METERS':x.receivedCorrected===null?'SIN PRM':'CONCILIADO')
  })):null;
  const international=internationalMonthlyLedger(meterShifts,[],month);
  const issues=[];
  if(!initialDate)issues.push('Falta fecha de inicio en Datos iniciales');
  if(!station.name)issues.push('Falta razón social o nombre de establecimiento');
  if(!station.city)issues.push('Falta municipio / localidad de la estación');
  if(!station.address && !station.direccion)issues.push('Falta dirección para encabezado ANH');
  for(const [code,item] of Object.entries(liquids)){
    const pending=item.rows.filter(x=>x.date<=cutoff&&!['CONCILIADO','SIN MOVIMIENTO','FUTURO'].includes(x.status));
    if(pending.length)issues.push(`${code}: ${pending.length} día(s) sin conciliación física individual`);
  }
  if(gasRows?.some(x=>x.date<=cutoff&&x.status!=='CONCILIADO'))issues.push('GNV: hay días sin PRM o sin meters');
  if(international.docs.some(x=>!x.valid))issues.push('Facturas internacionales con importes o datos incompletos');
  if(international.docs.some(x=>x.valid))issues.push('Verificar NIT, placa y número fiscal de cada factura internacional: no están asegurados en los arqueos');
  if(!active.length)issues.push('No hay productos activos configurados');
  return {month,today,cutoff,station,active,type:reportType(station,products),liquids,family,gnv:gasRows,international,issues,provisional:issues.length>0||cutoff<dates.at(-1)};
}
