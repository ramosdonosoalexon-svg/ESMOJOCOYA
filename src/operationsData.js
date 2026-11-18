import {doc, setDoc, writeBatch, serverTimestamp,runTransaction} from 'firebase/firestore';
import {db,stationPath} from './data';
import {volumeForHeight} from './calibrationMath';
const base=sid=>['stations',sid];

export async function saveCalibration(sid,tank,points,filename,sheetName,uid){
  if(tank.productCode==='GNV')throw new Error('Los cilindros GNV no utilizan tabla volumétrica de líquidos.');
  if(!Array.isArray(points)||points.length<10||points.length>4000)throw new Error('La tabla debe tener entre 10 y 4.000 mediciones.');
  const ref=doc(stationPath(sid,'calibrations'));
  const batch=writeBatch(db);
  batch.set(ref,{tankId:tank.id,productCode:tank.productCode,points,sourceFile:filename.slice(0,180),sourceSheet:sheetName.slice(0,100),minMm:points[0].mm,maxMm:points.at(-1).mm,createdBy:uid,createdAt:serverTimestamp()});
  batch.update(doc(db,...base(sid),'tanks',tank.id),{activeCalibrationId:ref.id,calibrationUpdatedAt:serverTimestamp()});
  await batch.commit(); return ref.id;
}
export async function setInitialDate(sid,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Introduce una fecha inicial válida.');
  return setDoc(doc(db,...base(sid),'initialSettings','start'),{date,updatedAt:serverTimestamp()});
}
export async function saveInitialTank(sid,tank,calibration,heightMm,accountingLiters,uid){
  const physical=volumeForHeight(calibration.points,heightMm);
  if(physical===null||!Number.isFinite(Number(accountingLiters))||Number(accountingLiters)<0)throw new Error('Altura o saldo contable inválido.');
  return setDoc(doc(db,...base(sid),'initialTanks',tank.id),{tankId:tank.id,productCode:tank.productCode,calibrationId:calibration.id,heightMm:Number(heightMm),physicalLiters:physical,accountingLiters:Number(accountingLiters),recordedBy:uid,createdAt:serverTimestamp()});
}
export async function saveInitialGNVBridge(sid,readings,uid){
  const keys=['manual','corrected','uncorrected'];
  if(keys.some(key=>readings?.[key]==='' || readings?.[key]===undefined || !Number.isFinite(Number(readings[key])) || Number(readings[key])<0))
    throw new Error('Completa los tres meters iniciales del puente de regulación.');
  const values=Object.fromEntries(keys.map(key=>[key,Number(readings[key])]));
  return setDoc(doc(db,...base(sid),'initialGNVBridge','start'),{
    readings:values,recordedBy:uid,createdAt:serverTimestamp()
  });
}
export async function saveInitialMeter(sid,hose,readings,uid){
  if(!Object.values(readings).length||Object.values(readings).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error('Completa los meters con valores válidos.');
  return setDoc(doc(db,...base(sid),'initialMeters',hose.id),{hoseId:hose.id,readings,recordedBy:uid,createdAt:serverTimestamp()});
}
export async function saveInventoryReading(sid,{date,tank,calibration,heightMm,uid,existing,reason=''}){
  const physical=volumeForHeight(calibration.points,heightMm);
  if(physical===null)throw new Error('La medida está fuera del rango de calibración.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Fecha no válida.');
  const ref=doc(db,...base(sid),'inventoryReadings',`${date}_${tank.id}`);
  if(existing){
    if(reason.trim().length<5)throw new Error('Para corregir una medición ya guardada, indica el motivo (mínimo 5 caracteres).');
    const auditRef=doc(stationPath(sid,'inventoryAudit'));
    return runTransaction(db,async tx=>{
      const old=await tx.get(ref);
      if(!old.exists()) throw new Error('La medición anterior ya no existe. Actualiza la página.');
      const prev=old.data();
      tx.update(ref,{heightMm:Number(heightMm),volumeLiters:physical,updatedAt:serverTimestamp(),updatedBy:uid,correctionReason:reason.trim()});
      tx.set(auditRef,{readingId:ref.id,date,reason:reason.trim(),previousHeightMm:prev.heightMm,previousVolumeLiters:prev.volumeLiters,newHeightMm:Number(heightMm),newVolumeLiters:physical,changedBy:uid,createdAt:serverTimestamp()});
    });
  }
  return setDoc(ref,{date,month:date.slice(0,7),tankId:tank.id,productCode:tank.productCode,calibrationId:calibration.id,heightMm:Number(heightMm),volumeLiters:physical,recordedBy:uid,createdAt:serverTimestamp()});
}
