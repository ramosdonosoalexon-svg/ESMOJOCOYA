import {doc,setDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
import {db,stationPath} from './data';
import {volumeForHeight} from './calibrationMath';
import {calculateReception,sameFamily} from './receptionMath';
import {receptionChangeNote} from './receptionAccounting.js';

const notEmpty=value=>typeof value==='string'&&value.trim().length>0;
const numeric=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0;

export async function createReception(sid,form,tank,calibration,uid){
  if(!sid||!uid||!tank||tank.productCode==='GNV')throw new Error('Selecciona un tanque de líquidos.');
  if(!calibration||calibration.id!==tank.activeCalibrationId)throw new Error('Cargar la tabla volumétrica vigente del tanque.');
  if(!sameFamily(tank.productCode,form.productCode))throw new Error('Este combustible no pertenece a la familia permitida del tanque.');
  if(!sameFamily(tank.productCode,form.priorProductCode))throw new Error('Producto anterior incompatible con el tanque.');
  const reason=receptionChangeNote(form.changeReason,form.priorProductCode!==form.productCode);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(form.date))throw new Error('Fecha operativa inválida.');
  if(!notEmpty(form.documentNumber)||!notEmpty(form.supplier))throw new Error('Completa el documento y proveedor de la cisterna.');
  if(Number(form.otherIncomeLiters)>0&&!notEmpty(form.otherIncomeDocument))throw new Error('Indica el documento de otros ingresos.');
  if(!notEmpty(form.startedAt)||!notEmpty(form.finishedAt)||form.finishedAt<form.startedAt)
    throw new Error('Completa horas válidas de medición inicial y final.');
  if(!numeric(form.startHeightMm)||!numeric(form.endHeightMm)||!numeric(form.documentLiters)||!numeric(form.otherIncomeLiters))
    throw new Error('Completa las mediciones y volúmenes con números válidos.');
  const startVolumeL=volumeForHeight(calibration.points,form.startHeightMm);
  const endVolumeL=volumeForHeight(calibration.points,form.endHeightMm);
  if(startVolumeL===null||endVolumeL===null)throw new Error('Una de las alturas está fuera de la tabla volumétrica.');
  const oldProductBalance=String(form.oldProductAccountingL??'').trim();
  if(oldProductBalance!==''&&!numeric(oldProductBalance))throw new Error('Remanente contable inválido.');
  const calculated=calculateReception({startVolumeL,endVolumeL,documentLiters:Number(form.documentLiters),
    otherIncomeLiters:Number(form.otherIncomeLiters),meterMode:form.meterMode,
    meterRows:form.meterRows,meterCoverageComplete:form.meterCoverageComplete});
  const docKey=`${form.date}_${tank.id}_${encodeURIComponent(form.documentNumber.trim()).slice(0,100)}_${encodeURIComponent(form.startedAt)}`;
  if(calculated.meterLines.some(row=>!sameFamily(row.productCode,tank.productCode)))
    throw new Error('Hay una manguera asociada a una familia de combustible incompatible.');
  return setDoc(doc(stationPath(sid,'receptions'),docKey),{
    date:form.date,month:form.date.slice(0,7),tankId:tank.id,tankName:tank.name,
    calibrationId:calibration.id,productCode:form.productCode,priorProductCode:form.priorProductCode,
    changeReason:reason.slice(0,700),
    oldProductAccountingL:oldProductBalance===''?null:Number(oldProductBalance),
    supplier:form.supplier.trim().slice(0,150),documentNumber:form.documentNumber.trim().slice(0,100),
    cisternPlate:(form.cisternPlate||'').trim().slice(0,60),
    startedAt:form.startedAt,finishedAt:form.finishedAt,
    startHeightMm:Number(form.startHeightMm),endHeightMm:Number(form.endHeightMm),
    startVolumeL,endVolumeL,
    documentLiters:Number(form.documentLiters),
    otherIncomeDocument:(form.otherIncomeDocument||'').trim().slice(0,100),
    otherIncomeLiters:Number(form.otherIncomeLiters),
    meterMode:form.meterMode,meterCoverageComplete:!!form.meterCoverageComplete,
    meterLines:calculated.meterLines,salesByProductL:calculated.salesByProductL,
    physicalIncreaseL:calculated.physicalIncreaseL,
    salesDuringReceptionL:calculated.salesDuringReceptionL,
    physicalReceivedL:calculated.physicalReceivedL,
    transportDifferenceL:calculated.transportDifferenceL,
    quality:calculated.quality,
    observation:(form.observation||'').trim().slice(0,1000),
    status:'vigente',recordedBy:uid,createdAt:serverTimestamp()
  });
}
export async function voidReception(sid,receipt,uid,reason){
  if(receipt.status!=='vigente')throw new Error('La recepción ya está anulada.');
  if(!reason||reason.trim().length<8)throw new Error('La anulación requiere un motivo de al menos 8 caracteres.');
  await updateDoc(doc(db,'stations',sid,'receptions',receipt.id),{
    status:'anulada',cancelReason:reason.trim().slice(0,500),canceledBy:uid,canceledAt:serverTimestamp()
  });
}
