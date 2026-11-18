import {doc,getDoc,setDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
import {db,stationPath} from './data';
import {computeMeterShift} from './meterMath';
import {isISODate,isTime} from './priceMath';
import {computeGnvBridge} from './gnvBridgeMath';

export async function saveEffectivePrice(stationId,productCode,effectiveDate,effectiveTime,priceBs,uid){
  const price=Number(priceBs);
  if(!isISODate(effectiveDate)||!isTime(effectiveTime)||!Number.isFinite(price)||price<=0||price>1000)throw Error('Fecha o precio inválidos.');
  const ref=doc(db,'stations',stationId,'priceHistory',`${productCode}_${effectiveDate}_${effectiveTime}`);
  return setDoc(ref,{productCode,effectiveDate,effectiveTime,priceBs:price,currency:'BOB',createdBy:uid,createdAt:serverTimestamp()});
}
export async function saveShift(stationId,{date,shiftTime,hose,productCode,readings,primary,concept,customer,reference,allocations,priceHistory,internationalHistory,sequence},uid){
  const rec=computeMeterShift({date,shiftTime,hose,productCode,readings,primary,concept,customer,reference,allocations,priceHistory,internationalHistory,sequence});
  const id=`${date}_${hose.id}_${String(sequence).padStart(2,'0')}`;
  const shiftRef = doc(db,'stations',stationId,'meterShifts',id);
  // La escritura es un alta; nunca se debe sobrescribir un arqueo existente.
  // setDoc sobre un ID ocupado sería una actualización, rechazada por las reglas.
  const previous = await getDoc(shiftRef);
  if (previous.exists()) {
    throw Error(`Ya existe el arqueo ${id} (${previous.data()?.hoseName || hose.name}). No lo vuelvas a registrar: verifica el libro de Meters y su vínculo con la manguera.`);
  }
  try {
    return await setDoc(shiftRef,{...rec,status:'vigente',recordedBy:uid,createdAt:serverTimestamp()});
  } catch (error) {
    if (error?.code === 'permission-denied') {
      throw Error(`Firebase rechazó la CREACIÓN del arqueo ${id}. Verifica si el ID ya existe y la coincidencia de estación, manguera, producto y fecha inicial. No modifiques las reglas hasta identificar la condición exacta.`);
    }
    throw error;
  }
}
export async function cancelShift(stationId,shiftId,reason,uid){
  if(reason.trim().length<8)throw Error('Indica un motivo de anulación de al menos 8 caracteres.');
  return updateDoc(doc(db,'stations',stationId,'meterShifts',shiftId),{status:'anulada',canceledBy:uid,cancelReason:reason.trim(),canceledAt:serverTimestamp()});
}
export async function saveGNVBridge(stationId,{date,readings},uid){
  if(!isISODate(date))throw Error('Fecha del puente inválida.');
  const calculated=computeGnvBridge(readings);
  // Un documento por jornada. Las reglas no autorizan reemplazar un cierre existente.
  return setDoc(doc(db,'stations',stationId,'gnvBridge',date),{
    date,month:date.slice(0,7),unit:'m³',...calculated,
    recordedBy:uid,createdAt:serverTimestamp()
  });
}
