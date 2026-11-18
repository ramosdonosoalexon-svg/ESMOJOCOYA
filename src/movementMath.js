import {classifyGnvShifts,gnvDailyVariance} from './gnvRiskMath.js';
// Libro de movimientos derivado de las tres fuentes operativas existentes.
// Los saldos contables NO se igualan al inventario fisico: las diferencias se conservan.
export const MOVEMENT_CODES = ['GE','GE_PLUS','DO','D_ULS','GNV'];
export const MOVEMENT_NAMES = {GE:'Gasolina Especial',GE_PLUS:'Gasolina Especial Plus',DO:'Diésel Oil',D_ULS:'Diésel ULS',GNV:'Gas Natural Vehicular'};
export const LIQUID_GROUPS = {gasolina:['GE','GE_PLUS'],diesel:['DO','D_ULS']};
export const FAMILY_TITLES = {gasolina:'Control físico conjunto · Gasolinas',diesel:'Control físico conjunto · Diéseles'};
export const roundMovement = value => Math.round((value + Number.EPSILON)*1000)/1000;
export function boliviaCurrentMonth(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit'}).formatToParts(now);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}`;
}
export function validMonth(month){return typeof month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month);}
export function monthDays(month){
  if(!validMonth(month))return [];
  const [y,m]=month.split('-').map(Number);
  const last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return Array.from({length:last},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);
}
export function changeMonth(month,delta){
  if(!validMonth(month))return month;
  const [y,m]=month.split('-').map(Number);
  return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);
}
export function movementFamily(code){return ['GE','GE_PLUS'].includes(code)?'gasolina':['DO','D_ULS'].includes(code)?'diesel':code==='GNV'?'gnv':null;}
export function validRecord(record){return record?.status!=='anulada'&&/^\d{4}-\d{2}-\d{2}$/.test(record?.date||'');}
function sum(records,key){return roundMovement(records.reduce((total,r)=>total+(Number(r[key])||0),0));}
function byDate(list){
 const m=new Map();for(const r of list||[]){if(!validRecord(r))continue;const a=m.get(r.date)||[];a.push(r);m.set(r.date,a);}return m;
}
function initialFor(code,initialTanks){return roundMovement((initialTanks||[]).filter(t=>t.productCode===code).reduce((v,t)=>v+(Number(t.accountingLiters)||0),0));}
function physicalByFamily(date,initDate,tanks,initialTanks,readingsByDay){
 const snapshots=readingsByDay.get(date)||[];
 const map=new Map(snapshots.map(r=>[r.tankId,r]));
 const result={};
 for(const [family,codes] of Object.entries(LIQUID_GROUPS)){
  const physicalTanks=tanks.filter(t=>t.active!==false&&codes.includes(t.productCode));
  if(!physicalTanks.length){result[family]=null;continue;}
  const measured=physicalTanks.every(t=>map.has(t.id));
  if(measured)result[family]=roundMovement(physicalTanks.reduce((v,t)=>v+Number(map.get(t.id).volumeLiters||0),0));
  else result[family]=null;
 }
 return result;
}
// Calcula continuidad desde la fecha inicial, aunque el mes seleccionado sea posterior.
// maxMonth = mayor mes que necesita una vista; el calculo NO cambia datos de Firebase.
export function buildLiquidMovements({month,products=[],tanks=[],initialTanks=[],initialDate,inventoryReadings=[],receptions=[],meterShifts=[]}){
 const days=monthDays(month);if(!days.length)return {products:{},families:{},days:[]};
 const enabled=new Set(products.filter(p=>p.active!==false).map(p=>p.code));
 const recMap=byDate(receptions),shiftMap=byDate(meterShifts),inventoryMap=byDate(inventoryReadings);
 const start=(initialDate&&/^\d{4}-\d{2}-\d{2}$/.test(initialDate))?initialDate:null;
 const end=days.at(-1),startLoop=start&&start<end?start:end;
 const balances=Object.fromEntries(MOVEMENT_CODES.filter(x=>x!=='GNV').map(code=>[code,initialFor(code,initialTanks)]));
 const productDays=Object.fromEntries(MOVEMENT_CODES.filter(x=>x!=='GNV').map(c=>[c,[]]));
 const familyDays={gasolina:[],diesel:[]};
 // Saldos físicos compartidos: no es correcto imputarlos a un producto arbitrario.
 const familyBalances=Object.fromEntries(Object.entries(LIQUID_GROUPS).map(([f,codes])=>
   [f,roundMovement(codes.reduce((total,c)=>total+(balances[c]||0),0))]));
 let cursor=startLoop;let guard=0;
 while(cursor<=end&&guard++<10000){
   const eligible=Boolean(start&&cursor>=start);
   const rs=eligible?(recMap.get(cursor)||[]):[],shifts=eligible?(shiftMap.get(cursor)||[]):[];
   const physical=eligible?physicalByFamily(cursor,start,tanks,initialTanks,inventoryMap):{};
   const productWork={};
   for(const code of Object.keys(productDays)){
     const incomes=rs.filter(r=>r.productCode===code),outgoings=shifts.filter(s=>s.productCode===code);
     const receiptL=sum(incomes,'documentLiters'),otherL=sum(incomes,'otherIncomeLiters');
     const grossSales=sum(outgoings,'grossVolume'),returned=sum(outgoings,'returnedVolume'),outL=sum(outgoings,'netTankOutVolume');
     const transport=sum(incomes,'transportDifferenceL');
     const hasActivity=incomes.length>0||outgoings.length>0||(eligible&&cursor===start);
     const beginning=eligible?balances[code]:null;
     const closing=eligible?roundMovement(beginning+receiptL+otherL-outL):null;
     if(eligible)balances[code]=closing;
     const lines={};
     for(const s of outgoings){for(const line of (s.movementLines||[]))lines[line.concept]=roundMovement((lines[line.concept]||0)+(Number(line.volume)||0));}
     const result={date:cursor,productCode:code,hasActivity,beginning:hasActivity?beginning:null,
       receiptL:incomes.length?receiptL:null,otherIncomeL:otherL||null,
       grossOutL:outgoings.length?grossSales:null,returnedL:returned||null,
       outL:outgoings.length?outL:null,closing:hasActivity?closing:null,
       transportDiff:incomes.length?transport:null,transportProvisional:incomes.some(r=>r.quality!=='verificable_con_meters'),
       lines,amountBs:outgoings.length?sum(outgoings,'amountBs'):null,
       hasReceipt:incomes.length>0,hasShift:outgoings.length>0,
       physical:null,operationDiff:null};
     productWork[code]=result;
     if(cursor.startsWith(month))productDays[code].push(result);
   }
   for(const family of Object.keys(familyDays)){
     const codes=LIQUID_GROUPS[family];
     const used= codes.filter(c=>enabled.has(c));
     const isShared=used.length>1;
     const familyBeginning=eligible?familyBalances[family]:null;
     const familyReceipts=rs.filter(r=>codes.includes(r.productCode));
     const familyShifts=shifts.filter(s=>codes.includes(s.productCode));
     const familyReceiptL=sum(familyReceipts,'documentLiters');
     const familyOtherIncomeL=sum(familyReceipts,'otherIncomeLiters');
     const familyOutL=sum(familyShifts,'netTankOutVolume');
     const familyGrossL=sum(familyShifts,'grossVolume');
     const familyReturnedL=sum(familyShifts,'returnedVolume');
     const account=eligible?roundMovement(familyBeginning+familyReceiptL+familyOtherIncomeL-familyOutL):null;
     const famReceipts=familyReceipts;
     const transport=sum(famReceipts,'transportDifferenceL');
     const measured=physical[family]??null;
     const diff=measured!==null&&account!==null?roundMovement(measured-account):null;
     const op=diff!==null?roundMovement(diff-transport):null;
     // El saldo fisico nocturno es la apertura de la jornada siguiente.
     // Si no existe medicion, se arrastra provisionalmente el contable, sin inventar un fisico.
     if(eligible)familyBalances[family]=measured!==null?measured:account;
     // En productos compartidos solo se atribuye la medicion a un producto cuando
     // el otro carece de existencias y movimientos. En una mezcla real, NO se reparte
     // el saldo fisico por producto sin evidencia.
     const populated=codes.filter(c=>Math.abs(balances[c]||0)>0.0005 ||
       (productWork[c].hasReceipt||productWork[c].hasShift));
     const sole=(populated.length===1&&used.includes(populated[0]))?populated[0]:null;
     if(measured!==null&&sole){
       const p=productWork[sole];
       if(p.beginning===null){p.beginning=balances[sole];p.closing=balances[sole];}
       p.physical=measured;
       p.operationDiff=op;
       p.transportProvisional=p.transportProvisional||famReceipts.some(r=>r.quality!=='verificable_con_meters');
       p.hasActivity=true;
       // No se modifica el cierre contable de hoy; la siguiente apertura es el fisico.
       balances[sole]=measured;
     }
     if(cursor.startsWith(month))familyDays[family].push({date:cursor,beginning:familyBeginning,
       receiptL:familyReceipts.length?familyReceiptL:null,
       otherIncomeL:familyOtherIncomeL||null,
       grossOutL:familyShifts.length?familyGrossL:null,
       returnedL:familyReturnedL||null,
       outL:familyShifts.length?familyOutL:null,
       physical:measured,accounting:measured!==null?account:null,
       amountBs:familyShifts.length?sum(familyShifts,'amountBs'):null,
       transportDiff:famReceipts.length?transport:null,operationDiff:op,totalDiff:diff,
       preliminary:famReceipts.some(r=>r.quality!=='verificable_con_meters'),isShared,
       hasActivity:measured!==null||famReceipts.length>0||codes.some(c=>productWork[c].hasActivity)});
   }
   const dt=new Date(`${cursor}T12:00:00Z`);dt.setUTCDate(dt.getUTCDate()+1);cursor=dt.toISOString().slice(0,10);
 }
 // Source dates before the initial date are never shown as real movements.
 for(const code of Object.keys(productDays)){
   if(productDays[code].length<days.length){const present=new Map(productDays[code].map(r=>[r.date,r]));productDays[code]=days.map(date=>present.get(date)||{date,productCode:code,hasActivity:false});}
 }
 for(const f of Object.keys(familyDays)){
   if(familyDays[f].length<days.length){const present=new Map(familyDays[f].map(r=>[r.date,r]));familyDays[f]=days.map(date=>present.get(date)||{date,hasActivity:false,isShared:false});}
 }
 return {products:productDays,families:familyDays,days};
}
export function buildGnvMovements({month,bridge=[],meterShifts=[]}){
 const days=monthDays(month),b=byDate(bridge),s=byDate(meterShifts);
 return days.map(date=>{
  const bridges=b.get(date)||[],validBridge=bridges.find(r=>r.readings?.corrected)||null;
  const shifts=(s.get(date)||[]).filter(r=>r.productCode==='GNV');
  const manual=validBridge?Number(validBridge.receivedManual||0):null;
  const corrected=validBridge?Number(validBridge.receivedCorrected||0):null;
  const uncorrected=validBridge?Number(validBridge.receivedUncorrected||0):null;
  const disp=shifts.length?sum(shifts,'grossVolume'):null;
  // Compatibilidad histórica: technicalDifference conserva el cálculo anterior
  // (corregido - dispenser) pero la matriz muestra el signo INVERSO,
  // dispenser - corregido: negativo = merma técnica, positivo = demasía.
  const technicalDifference=corrected!==null&&disp!==null?roundMovement(corrected-disp):null;
  const delta=gnvDailyVariance(corrected,disp);
  const classification=classifyGnvShifts(shifts);
  return {date,receivedManual:manual,receivedCorrected:corrected,receivedUncorrected:uncorrected,
    outVolume:disp,technicalDifference,
    signedDifference:delta.signed,differencePercent:delta.percent,
    estimatedLossM3:delta.loss,estimatedSurplusM3:delta.surplus,
    categories:classification.categories,classificationProblems:classification.problems,
    amountBs:shifts.length?sum(shifts,'amountBs'):null,
    hasBridge:Boolean(validBridge),hasMeters:shifts.length>0,
    hasActivity:Boolean(validBridge||shifts.length)};
 });
}
// Solo se exhiben columnas que realmente tienen al menos un valor registrado.
export function visibleMovementColumns(rows,definitions){return definitions.filter(d=>rows.some(r=>r[d.key]!==null&&r[d.key]!==undefined&&(d.showZero||r[d.key]!==0)));}
