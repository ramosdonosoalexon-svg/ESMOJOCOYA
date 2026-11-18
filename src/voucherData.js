import {addDoc,serverTimestamp} from 'firebase/firestore';
import {stationPath} from './data.js';
import {isISODate} from './priceMath.js';

export async function createVoucherAccount(stationId, {name,mode}, uid) {
  const clean=String(name||'').trim();
  if (clean.length < 3 || clean.length > 120) throw Error('El cliente debe tener entre 3 y 120 caracteres.');
  if (!['prepago','postpago'].includes(mode)) throw Error('Modalidad de vale inválida.');
  return addDoc(stationPath(stationId,'voucherAccounts'), {
    name:clean,mode,active:true,createdBy:uid,createdAt:serverTimestamp()
  });
}

export async function recordVoucherPayment(stationId, {account,date,amountBs,reference}, uid) {
  const amount=Number(amountBs), ref=String(reference||'').trim();
  if (!account?.id || !['prepago','postpago'].includes(account.mode)) throw Error('Selecciona una cuenta de vales.');
  if (!isISODate(date)) throw Error('Fecha de pago inválida.');
  if (!Number.isFinite(amount) || amount<=0 || amount>10000000) throw Error('Monto del pago inválido.');
  if (ref.length<3 || ref.length>160) throw Error('Indica una referencia del pago de al menos 3 caracteres.');
  return addDoc(stationPath(stationId,'voucherCashflows'), {
    accountId:account.id,date,month:date.slice(0,7),amountBs:Math.round(amount*100)/100,
    kind:account.mode==='prepago'?'recarga_prepago':'cobro_postpago',
    reference:ref,recordedBy:uid,createdAt:serverTimestamp()
  });
}
