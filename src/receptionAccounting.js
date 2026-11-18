// Saldo contable ANTES de una nueva descarga, por tanque y por producto.
// Nunca inferir composición física ni sumar el mismo despacho dos veces.
import {sameFamily,roundL} from './receptionMath.js';

const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date||''));
const validTime=time=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time||''));
const nonnegative=(v)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
const active=item=>item&&item.status!=='anulada';
function timestamp(date,time){return validDate(date)&&validTime(time)?`${date}T${time}`:null;}
function receiptBefore(r,date,time){
  if(!validDate(r?.date))return false;
  const cutoff=timestamp(date,time);
  // Una descarga que termina después del inicio NO es saldo anterior.
  if(typeof r.finishedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.finishedAt))
    return cutoff?r.finishedAt.slice(0,16)<cutoff:r.finishedAt.slice(0,10)<date;
  return r.date<date;
}
function shiftBefore(s,date,time){
  if(!validDate(s?.date))return false;
  if(s.date<date)return true;
  return s.date===date&&validTime(time)&&validTime(s.shiftTime)&&s.shiftTime<time;
}
export function productBeforeReception({tank,initialTanks=[],receptions=[],date,time}){
  if(!tank)return null;
  const last=(receptions||[]).filter(r=>active(r)&&r.tankId===tank.id&&receiptBefore(r,date,time))
    .sort((a,b)=>String(a.finishedAt||a.date).localeCompare(String(b.finishedAt||b.date))).at(-1);
  const baseline=(initialTanks||[]).find(t=>t.tankId===tank.id||t.id===tank.id);
  return last?.productCode||baseline?.productCode||tank.productCode||null;
}

// La fecha/hora de la descarga sirve como límite cronológico. Si no existe
// una asignación inequívoca de una manguera a tanque, se avisa y NO se inventa un saldo.
export function accountingBeforeReception({tank,productCode,date,time,initialDate,initialTanks=[],receptions=[],meterShifts=[],hoses=[],tanks=[]}){
  if(!tank||!validDate(date)||!productCode)return {value:null,error:'Faltan tanque, fecha o producto.'};
  if(!validDate(initialDate)||date<initialDate)return {value:null,error:'Falta la fecha inicial de operaciones.'};
  if(!validTime(time))return {value:null,error:'Indica primero la hora de inicio de la descarga para calcular el remanente automáticamente.'};
  const initial=initialTanks.find(t=>t.tankId===tank.id||t.id===tank.id);
  if(!initial||!nonnegative(initial.accountingLiters))return {value:null,error:'Falta el saldo contable inicial del tanque en Datos iniciales.'};
  if(!sameFamily(initial.productCode,productCode))return {value:null,error:'El producto anterior no coincide con la familia de combustible del tanque.'};
  let balance=initial.productCode===productCode?Number(initial.accountingLiters):0;
  const incomplete=[];
  const cutoff=`${date}T${time}`;
  for(const r of receptions){
    if(!active(r)||r.tankId!==tank.id||r.productCode!==productCode||!validDate(r.date)||r.date<initialDate||r.date>date)continue;
    if(receiptBefore(r,date,time)){
      if(!nonnegative(r.documentLiters)||!nonnegative(r.otherIncomeLiters??0))incomplete.push('Existe una recepción anterior sin litros válidos.');
      else balance+=Number(r.documentLiters)+Number(r.otherIncomeLiters||0);
    }else if(r.date===date&&(!r.finishedAt||r.finishedAt.slice(0,16)<cutoff&&r.date===date)){
      incomplete.push('Hay otra recepción del mismo día sin hora final verificable.');
    }
  }
  const candidates=(tanks||[]).filter(t=>t.active!==false&&sameFamily(t.productCode,tank.productCode));
  for(const s of meterShifts){
    if(!active(s)||s.productCode!==productCode||!validDate(s.date)||s.date<initialDate||s.date>date)continue;
    if(!shiftBefore(s,date,time)){
      if(s.date===date&&!validTime(s.shiftTime))incomplete.push('Hay despachos del día sin hora verificable.');
      continue;
    }
    const hose=hoses.find(h=>h.id===s.hoseId);
    const feeds=Array.isArray(hose?.feedTankIds)?hose.feedTankIds:[];
    const definite=feeds.length===1&&feeds[0]===tank.id;
    const other=feeds.length>0&&!feeds.includes(tank.id);
    if(other)continue;
    if(!definite){
      // Solo se puede usar inferencia cuando el tanque es el único de su familia.
      if(candidates.length!==1||candidates[0].id!==tank.id){
        incomplete.push(`El despacho ${s.id||s.hoseName||s.hoseId||''} no está asignado exclusivamente a un tanque.`);
        continue;
      }
    }
    const amount=Number(s.netTankOutVolume??(Number(s.grossVolume)-Number(s.returnedVolume||0)));
    if(!Number.isFinite(amount)||amount<0){incomplete.push('Hay un despacho anterior sin volumen válido.');continue;}
    balance-=amount;
  }
  if(balance < -0.0005)incomplete.push(`El cálculo da un saldo negativo (${roundL(balance)} L); revisa la continuidad de los meters.`);
  if(incomplete.length)return {value:null,error:[...new Set(incomplete)].join(' ')};
  return {value:roundL(Math.max(0,balance)),error:null};
}

// La observación es OPCIONAL. El texto por defecto indica explícitamente
// que no existe observación ni autorización adjunta: nunca fingir una aprobación.
export function receptionChangeNote(text,changed){
  const note=String(text||'').trim();
  if(note&&note.length<8)throw new Error('La observación, si se escribe, debe tener al menos 8 caracteres.');
  return changed?(note||'Cambio de producto registrado automáticamente, sin observación ni autorización documentada.'):note;
}
