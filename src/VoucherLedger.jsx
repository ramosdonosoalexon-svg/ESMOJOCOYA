import React,{useMemo,useState} from 'react';
import {createVoucherAccount,recordVoucherPayment} from './voucherData';
import {voucherAccountStatement} from './voucherMath';
import './voucher.css';

const bs=n=>Number(n||0).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
const currentDate=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`};
const currentMonth=()=>currentDate().slice(0,7);

export default function VoucherLedger({stationId,uid,canManage,accounts=[],cashflows=[],shifts=[]}) {
  const [month,setMonth]=useState(currentMonth);
  const [name,setName]=useState(''),[mode,setMode]=useState('prepago');
  const [chosen,setChosen]=useState(''),[paymentAmount,setPaymentAmount]=useState(''),[paymentDate,setPaymentDate]=useState(currentDate),[paymentRef,setPaymentRef]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const chosenAccount=accounts.find(a=>a.id===chosen);
  const statements=useMemo(()=>accounts.filter(a=>a.active!==false).map(a=>({account:a,summary:voucherAccountStatement(a,shifts,cashflows,month)})).filter(r=>r.summary).sort((a,b)=>a.account.name.localeCompare(b.account.name)),[accounts,shifts,cashflows,month]);
  const act=async (operation)=>{setBusy(true);setError('');setMessage('');try{await operation();setMessage('Registro guardado. El saldo se actualizará al sincronizar Firestore.')}catch(e){setError(e.message||String(e))}finally{setBusy(false)}};
  return <section className="panel voucher-panel" id="vales-clientes">
    <div className="voucher-heading"><div><h2>Vales de clientes · prepago y postpago</h2><p>Los vales se descuentan de las lecturas de Meters, pero no duplican las salidas del tanque. Los abonos se registran aparte y no aumentan los litros del inventario.</p></div><label>Mes para revisar<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></div>
    {canManage&&<div className="voucher-actions">
      <form onSubmit={e=>{e.preventDefault();act(async()=>{if(accounts.some(a=>a.mode===mode&&a.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase()))throw Error('Esa cuenta ya existe para la misma modalidad.');await createVoucherAccount(stationId,{name,mode},uid);setName('')})}}>
        <h3>Crear cuenta de vales</h3><label>Cliente<input required value={name} maxLength={120} placeholder="Ej. Policía" onChange={e=>setName(e.target.value)}/></label><label>Modalidad<select value={mode} onChange={e=>setMode(e.target.value)}><option value="prepago">Prepago (se abona antes)</option><option value="postpago">Postpago (se cobra después)</option></select></label><button type="submit" className="secondary" disabled={busy}>Crear cuenta</button>
      </form>
      <form onSubmit={e=>{e.preventDefault();act(async()=>{if(chosenAccount?.mode==='postpago'&&Number(paymentAmount)>voucherAccountStatement(chosenAccount,shifts,cashflows)?.balanceBs+0.005)throw Error('El cobro no puede superar el saldo pendiente de ese cliente.');if(cashflows.some(p=>p.accountId===chosen&&p.reference.trim().toLowerCase()===paymentRef.trim().toLowerCase()&&p.date===paymentDate))throw Error('Ya se registró un pago con la misma fecha y referencia para este cliente.');await recordVoucherPayment(stationId,{account:chosenAccount,date:paymentDate,amountBs:paymentAmount,reference:paymentRef},uid);setPaymentAmount('');setPaymentRef('')})}}>
        <h3>Registrar dinero recibido</h3><label>Cuenta<select required value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Seleccionar cliente…</option>{accounts.filter(a=>a.active!==false).map(a=><option key={a.id} value={a.id}>{a.name} · {a.mode==='prepago'?'Prepago':'Postpago'}</option>)}</select></label><label>Fecha<input type="date" required value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label><label>Importe Bs<input type="number" required min="0.01" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><label>Referencia de pago<input required minLength={3} maxLength={160} value={paymentRef} placeholder="Recibo, depósito, QR…" onChange={e=>setPaymentRef(e.target.value)}/></label><button type="submit" className="secondary" disabled={busy||!chosen}>Registrar {chosenAccount?.mode==='postpago'?'cobro':'recarga'}</button>
      </form>
    </div>}
    {message&&<p className="alert success">{message}</p>}{error&&<p className="alert error">{error}</p>}
    <div className="voucher-table-wrap"><table className="voucher-table"><thead><tr><th>Cliente</th><th>Modalidad</th><th>Despachado del mes</th><th>Valor del mes Bs</th><th>Pagado del mes Bs</th><th>Saldo acumulado Bs</th></tr></thead><tbody>{statements.map(({account,summary})=><tr key={account.id}><td><b>{account.name}</b></td><td>{account.mode==='prepago'?'Prepago':'Postpago'}</td><td>{summary.periodLiters.toLocaleString('es-BO',{maximumFractionDigits:3})} L{summary.periodM3>0&&` · ${summary.periodM3.toLocaleString('es-BO',{maximumFractionDigits:3})} m³`}</td><td>{bs(summary.periodDispensedBs)}</td><td>{bs(summary.periodPaymentsBs)}</td><td className={summary.balanceBs<0?'voucher-negative':'voucher-positive'}><b>{bs(summary.balanceBs)}</b><small>{account.mode==='prepago'?'Saldo disponible':'Saldo pendiente de cobro'}</small></td></tr>)}{!statements.length&&<tr><td colSpan={6}>Todavía no hay cuentas de vales. Crea una para empezar a registrar recargas, cobros y despachos asociados.</td></tr>}</tbody></table></div>
    <p className="voucher-caution">Los importes son valorizaciones de los despachos; las recargas y cobros son movimientos de dinero. Para pruebas, el saldo prepago se valida con los registros sincronizados. <b>Antes de operar simultáneamente en varias cajas se requiere control transaccional de saldo en el servidor.</b> Los arqueos antiguos sin una cuenta asociada no se asignan automáticamente para evitar errores.</p>
  </section>;
}
