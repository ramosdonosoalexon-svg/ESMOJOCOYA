// Primera parte: reproducción del formato suministrado por el establecimiento.
// Ningún número fiscal ni autorización se infiere a partir de litros.
import {validRecord} from './movementMath.js';
export const SUST_CODES=['DO','GE','GE_PLUS'];
export const SUST_TITLES={DO:'DIESEL',GE:'GASOLINA ESPECIAL',GE_PLUS:'GASOLINA ESPECIAL +'};
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const sum=(rows,key)=>rows.reduce((n,x)=>n+(number(x[key])||0),0);
const rounded=n=>Math.round((n+Number.EPSILON)*100)/100;
export function buildSustanciasPart1({report,receptions=[],meterShifts=[],profile={}}){
 if(!report?.month||!report?.liquids)throw new Error('El reporte de movimientos no está disponible.');
 const codes=SUST_CODES.filter(x=>report.active.includes(x));
 const periods={};const problems=[];
 const start=`${report.month}-01`,end=report.cutoff;
 for(const code of codes){
  const source=report.liquids[code];const inMonth=x=>validRecord(x)&&x.date>=start&&x.date<=end&&x.productCode===code;
  const incoming=receptions.filter(inMonth).sort((a,b)=>a.date.localeCompare(b.date)||String(a.startedAt||'').localeCompare(String(b.startedAt||'')));
  const shifts=meterShifts.filter(inMonth);
  const daySales=new Map();
  for(const sh of shifts)daySales.set(sh.date,rounded((daySales.get(sh.date)||0)+(number(sh.netTankOutVolume)??number(sh.grossVolume)??0)));
  const sales=[...daySales.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,amount])=>({date,amount}));
  const listed=source.rows.filter(r=>r.date<=end&&r.beginning!==null);
  const opening=listed.find(r=>number(r.beginning)!==null)?.beginning??null;
  const purchases=rounded(sum(incoming,'documentLiters'));
  const other=rounded(sum(incoming,'otherIncomeLiters'));
  const out=rounded(sales.reduce((n,r)=>n+r.amount,0));
  const plus=rounded(sum(source.rows.filter(r=>r.date<=end),'plus'));
  const loss=rounded(sum(source.rows.filter(r=>r.date<=end),'loss'));
  // Si el tanque es compartido, el cierre por producto es estrictamente contable.
  const closing=number(opening)===null?null:rounded(Number(opening)+purchases+other+plus-out-loss);
  const pending=source.pending||0;
  if(number(opening)===null)problems.push(`${code}: falta saldo inicial verificable.`);
  if(pending)problems.push(`${code}: ${pending} día(s) pendientes de conciliación; el saldo individual puede ser contable.`);
  if(incoming.some(r=>!r.supplier))problems.push(`${code}: una o más recepciones carecen de proveedor registrado.`);
  if(shifts.some(x=>!(x.reference||x.invoiceNumber)))problems.push(`${code}: los meters no identifican todas las facturas individuales; el detalle de ventas se presenta por día, con factura en blanco.`);
  periods[code]={code,opening:number(opening),purchases,other,plus,loss,out,closing,
    incoming:incoming.map(r=>({date:r.date,volume:number(r.documentLiters)||0,supplier:r.supplier||'',route:r.routeSheet||r.guideNumber||'',authorization:r.authorizationNumber||'',documentNumber:r.documentNumber||''})),
    sales,days:source.rows.filter(x=>x.date<=end)};
 }
 if(!codes.length)problems.push('Ninguna sustancia líquida está activa (GE, GE+ o DO).');
 if(report.active.includes('D_ULS'))problems.push('Diésel ULS está activo pero no tiene hoja en la plantilla proporcionada; requiere formulario específico.');
 for(const [key,label] of [['registration','N.º de registro DGSC'],['legalName','Razón social'],['legalRepresentative','Representante legal'],['city','Ciudad/localidad'],['responsible','Responsable del llenado']])if(!String(profile[key]||'').trim())problems.push(`Falta ${label.toLowerCase()} en los datos generales.`);
 return {month:report.month,cutoff:end,codes,periods,profile,provisional:report.provisional||problems.length>0,problems};
}
