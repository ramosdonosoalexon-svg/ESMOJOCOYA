import React,{useMemo,useState} from 'react';
import {useDocuments} from './hooks';
import {stationPath} from './data';
import {DISPLAY_BY_CODE} from './priceMath.js';
import {internationalMonthlyLedger} from './internationalPricing.js';
import {registerInternationalDeposit} from './internationalData.js';
import './international.css';
const fmt=n=>Number(n||0).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtVol=n=>Number(n||0).toLocaleString('es-BO',{maximumFractionDigits:3});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export default function InternationalLedger({stationId,uid,canManage,shifts,month}) {
 const {items:deposits,error}=useDocuments(()=>stationPath(stationId,'internationalDeposits'),[stationId]);
 const [periodMonth,setPeriodMonth]=useState(month);
 const model=useMemo(()=>internationalMonthlyLedger(shifts,deposits,periodMonth),[shifts,deposits,periodMonth]);
 const [date,setDate]=useState(today()),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(e){e.preventDefault();setBusy(true);setMessage('');try{
  await registerInternationalDeposit(stationId,uid,{period:periodMonth,date,amountBs:amount,reference,notes});
  setAmount('');setReference('');setNotes('');setMessage('Comprobante registrado. Contrasta el depósito con YPFB antes de darlo por conciliado.');
 }catch(err){setMessage(err.message||'No se pudo registrar el depósito.');}finally{setBusy(false)}}
 return <section className="panel intl-ledger">
  <div className="section-title"><div><h2>Precio internacional · diferencial YPFB</h2><p>{periodMonth} · Solo facturas internacionales identificadas en Meters; no incluye automáticamente ventas nacionales ni todos los litros de un dispenser.</p></div></div>
  <label className="meter-price-date">Mes de liquidación <input type="month" value={periodMonth} onChange={e=>setPeriodMonth(e.target.value)}/></label>
  {error&&<p className="alert error">No se pueden consultar depósitos: {error}</p>}
  <div className="intl-kpis">
   <div><span>Facturación internacional</span><b>Bs {fmt(model.gross)}</b></div>
   <div><span>Importe atribuible a estación</span><b>Bs {fmt(model.station)}</b></div>
   <div><span>Diferencial estimado YPFB</span><b>Bs {fmt(model.ypfb)}</b></div>
   <div><span>Depósitos registrados</span><b>Bs {fmt(model.deposited)}</b></div>
   <div><span>{model.remaining<0?'Excedente registrado':'Pendiente por conciliar'}</span><b>Bs {fmt(Math.abs(model.remaining))}</b></div>
  </div>
  {model.unpriced.length>0&&<p className="alert error">Existen {model.unpriced.length} facturas internacionales con campos monetarios incompletos. Los importes no están conciliados y no deben usarse para un depósito definitivo.</p>}
  <div className="intl-table-wrap"><table className="intl-table"><thead><tr><th>Producto</th><th>Facturas</th><th>Volumen</th><th>Recaudación Bs</th><th>Estación Bs</th><th>YPFB Bs</th></tr></thead><tbody>
  {Object.entries(model.byProduct).map(([code,r])=><tr key={code}><td>{DISPLAY_BY_CODE[code]||code}</td><td>{r.count}</td><td>{fmtVol(r.volume)} {code==='GNV'?'m³':'L'}</td><td>{fmt(r.amountBs)}</td><td>{fmt(r.stationBs)}</td><td>{fmt(r.ypfbBs)}</td></tr>)}
  {!Object.keys(model.byProduct).length&&<tr><td colSpan={6}>Todavía no existen facturas internacionales identificadas en este período.</td></tr>}
  </tbody></table></div>
  <details><summary>Ver facturas internacionales ({model.docs.length})</summary><div className="intl-table-wrap"><table className="intl-table"><thead><tr><th>Fecha / hora</th><th>Factura</th><th>Producto</th><th>Litros / m³</th><th>Recaudación</th><th>Para YPFB</th></tr></thead><tbody>{model.docs.map(d=><tr key={d.id}><td>{d.date} {d.shiftTime}</td><td>{d.reference||'Sin referencia'}</td><td>{DISPLAY_BY_CODE[d.productCode]}</td><td>{fmtVol(d.volume)} {d.unit}</td><td>Bs {fmt(d.amountBs)}</td><td>{d.valid?`Bs ${fmt(d.ypfbBs)}`:'Revisar'}</td></tr>)}</tbody></table></div></details>
  <details><summary>Depósitos registrados ({model.deposits.length})</summary><div className="intl-table-wrap"><table className="intl-table"><thead><tr><th>Fecha</th><th>Comprobante</th><th>Monto Bs</th><th>Observación</th></tr></thead><tbody>{model.deposits.map(d=><tr key={d.id}><td>{d.date}</td><td>{d.reference}</td><td>{fmt(d.amountBs)}</td><td>{d.notes||'—'}</td></tr>)}</tbody></table></div></details>
  {canManage&&<form className="intl-deposit-form" onSubmit={save}>
   <h3>Registrar depósito a YPFB</h3><p>Registra únicamente un depósito ya realizado y respaldado. Período facturado: <b>{periodMonth}</b>.</p>
   <label>Fecha del depósito<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>Monto Bs<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label>N.º comprobante bancario<input required maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <label>Observación (opcional)<input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
   <button type="submit" className="secondary" disabled={busy}>{busy?'Registrando…':'Registrar depósito efectuado'}</button>
   {message&&<small role="status" className="intl-feedback">{message}</small>}
  </form>}
  <p className="intl-guidance">Conciliación administrativa sujeta a las facturas y a la resolución ANH aplicable. No realiza transferencias bancarias ni sustituye la liquidación oficial de YPFB. Las facturas y depósitos quedan documentados sin modificar litros ni precios de arqueos históricos.</p>
 </section>;
}
