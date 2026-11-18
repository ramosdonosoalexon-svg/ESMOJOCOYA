// Saldos administrativos de vales por cuenta y estación.
// Los abonos monetarios son independientes de los despachos en litros.
import {round2,round3} from './priceMath.js';
import {isEffectiveShift} from './meterSummary.js';

const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function voucherAccountStatement(account, shifts = [], cashflows = [], month = null) {
  if (!account?.id || !['prepago','postpago'].includes(account.mode)) return null;
  const concept = account.mode;
  const lines = (shifts || [])
    .filter(isEffectiveShift)
    .flatMap(shift => (shift.movementLines || []).filter(line =>
      line.concept === concept && line.voucherAccountId === account.id)
      .map(line => ({date:shift.date, shiftId:shift.id, hoseName:shift.hoseName,
        productCode:shift.productCode, unit:shift.unit || (shift.productCode==='GNV'?'m³':'L'), liters:amount(line.volume), amountBs:amount(line.amountBs),
        reference:line.reference || ''})));
  const payments = (cashflows || []).filter(p => p.accountId === account.id &&
    p.kind === (concept === 'prepago' ? 'recarga_prepago' : 'cobro_postpago'));
  const dispensedBs = round2(lines.reduce((t,l)=>t + l.amountBs,0));
  const creditsBs = round2(payments.reduce((t,p)=>t + amount(p.amountBs),0));
  const balanceBs = round2(concept === 'prepago' ? creditsBs - dispensedBs : dispensedBs - creditsBs);
  const periodLines = month ? lines.filter(l=>l.date?.startsWith(month)) : lines;
  const periodPayments = month ? payments.filter(p=>p.date?.startsWith(month)) : payments;
  return {
    accountId:account.id, mode:concept, balanceBs, dispensedBs, creditsBs,
    periodLiters:round3(periodLines.filter(l=>l.unit!=='m³').reduce((t,l)=>t + l.liters,0)),
    periodM3:round3(periodLines.filter(l=>l.unit==='m³').reduce((t,l)=>t + l.liters,0)),
    periodDispensedBs:round2(periodLines.reduce((t,l)=>t + l.amountBs,0)),
    periodPaymentsBs:round2(periodPayments.reduce((t,p)=>t + amount(p.amountBs),0)),
    lines, payments
  };
}

export function validateVoucherAllocations(movementLines, accounts, shifts, cashflows) {
  const reserved = new Map();
  for (const line of movementLines) {
    if (!['prepago','postpago'].includes(line.concept)) continue;
    const account = (accounts || []).find(a=>a.id === line.voucherAccountId);
    if (!account || account.active === false || account.mode !== line.concept) {
      throw Error(`Selecciona una cuenta de vales ${line.concept} activa para ${line.customer || 'la entrega'}.`);
    }
    if (account.name.trim() !== line.customer.trim()) {
      throw Error('La cuenta de vales y el nombre del cliente deben coincidir.');
    }
    const total = round2((reserved.get(account.id) || 0) + amount(line.amountBs));
    reserved.set(account.id,total);
    if (line.concept === 'prepago') {
      const statement = voucherAccountStatement(account, shifts, cashflows);
      if (total > statement.balanceBs + 0.005) {
        throw Error(`Saldo prepago insuficiente de ${account.name}: Bs ${statement.balanceBs.toFixed(2)} disponibles, Bs ${total.toFixed(2)} solicitados.`);
      }
    }
  }
  return true;
}
