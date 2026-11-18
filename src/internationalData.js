import {doc,getDoc,setDoc,addDoc,serverTimestamp} from 'firebase/firestore';
import {db,stationPath} from './data';
import {isISODate,isTime,ACTIVE_PRODUCT_CODES} from './priceMath';

export async function registerInternationalRate(stationId,uid,{productCode,effectiveDate,effectiveTime='00:00',internationalPriceBs,differentialBs,resolutionNumber,sourceUrl=''}) {
  const price=Number(internationalPriceBs),diff=Number(differentialBs);
  const resolution=String(resolutionNumber||'').trim(),url=String(sourceUrl||'').trim();
  if(!ACTIVE_PRODUCT_CODES.includes(productCode)||!isISODate(effectiveDate)||!isTime(effectiveTime)||
    !Number.isFinite(price)||price<=0||price>1000||!Number.isFinite(diff)||diff<0||diff>price||
    resolution.length<3||resolution.length>120||url.length>500)
    throw Error('Verifica producto, vigencia, precio, diferencial y número de resolución ANH.');
  const ref=doc(db,'stations',stationId,'internationalPriceHistory',`${productCode}_${effectiveDate}_${effectiveTime}`);
  if((await getDoc(ref)).exists())throw Error('Ya existe esta tarifa. No se sobrescribe: registra una nueva vigencia o solicita rectificación documentada.');
  return setDoc(ref,{productCode,effectiveDate,effectiveTime,internationalPriceBs:price,differentialBs:diff,
    resolutionNumber:resolution,sourceUrl:url,currency:'BOB',createdBy:uid,createdAt:serverTimestamp()});
}
export async function registerInternationalDeposit(stationId,uid,{period,date,amountBs,reference,notes=''}) {
  const value=Number(amountBs),ref=String(reference||'').trim(),note=String(notes||'').trim();
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||!isISODate(date)||
    !Number.isFinite(value)||value<=0||value>1e8||ref.length<3||ref.length>160||note.length>500)
    throw Error('Completa período, fecha, monto y número de comprobante de depósito válido.');
  return addDoc(stationPath(stationId,'internationalDeposits'),{
    period,date,amountBs:value,reference:ref,notes:note,status:'registrado',recordedBy:uid,createdAt:serverTimestamp()
  });
}
