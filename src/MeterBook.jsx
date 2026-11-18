import React,{useEffect,useMemo,useState} from 'react';
import {query,where} from 'firebase/firestore';
import {Plus,ChevronDown,ChevronUp,ChevronLeft,ChevronRight} from 'lucide-react';
import {stationPath} from './data';
import {useDocuments} from './hooks';
import {addDaysISO} from './inventoryWindow';
import {sortRegistered,colorForProduct} from './calibrationMath';
import {activePriceAt,DISPLAY_BY_CODE,UNIT_BY_CODE} from './priceMath';
import {effectiveInternationalRate} from './internationalPricing.js';
import {nextSequence,sumDay,SHIFT_TYPES,compatibleHoseProduct,openingMeterValue,activeGasolineProduct,computeMeterShift} from './meterMath';
import {GNV_BRIDGE_CHANNELS,bridgeInitialForDate,roundBridge} from './gnvBridgeMath';
import {gnvMeterAudit,prmDayState,validatePrmInput,recordedMeterCheck} from './gnvReconciliation.js';
import {saveShift,cancelShift,saveGNVBridge} from './meterData';
import {resolveLegacyHoses} from './hoseCompat';
import {sameFamily} from './receptionMath';
import './meter.css';
import {isSundayISO} from './reportCalendar';
import {voucherAccountStatement,validateVoucherAllocations} from './voucherMath.js';
import VoucherLedger from './VoucherLedger.jsx';
import {isEffectiveShift,effectiveDayShifts,meterHoseDayCell,meterConsistencyReport} from './meterSummary';

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmt=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('es-BO',{maximumFractionDigits:3}):'—';
const shortDate=d=>d?.slice(8,10)+'/'+d?.slice(5,7);
const types=h=>Array.isArray(h.meterTypes)&&h.meterTypes.length?h.meterTypes:(h.meterType?[h.meterType]:['mecanico']);
const startOfInterval=(rows,date,hoseId)=>{
 const last=(rows||[]).filter(r=>r.date===date&&r.hoseId===hoseId&&isEffectiveShift(r)).sort((a,b)=>a.sequence-b.sequence).at(-1);
 if(!last?.shiftTime)return '08:00';
 const [hour,minute]=last.shiftTime.split(':').map(Number);const time=hour*60+minute+1;
 return time>=24*60?'':`${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`;
};
function createDraft(h,date,rows,initialMeters,initialDate){
 const readings={};
 for(const type of types(h)){
   const initial=openingMeterValue(rows,date,h.id,type,initialMeters,initialDate);
   readings[type]={initial:initial??'',final:''};
 }
 return readings;
}
function InlineMeterRow({stationId,uid,date,initialDate,hose,productCode,rows,initialMeters,prices,internationalPrices,dispensers,accounts,cashflows,voucherShifts,onSaved,onClose,editable}){
 const n=nextSequence(rows,date,hose.id);
 const [finals,setFinals]=useState({});const [time,setTime]=useState(()=>startOfInterval(rows,date,hose.id));
 const [primary,setPrimary]=useState(types(hose)[0]);
 const [details,setDetails]=useState(false),[lines,setLines]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setFinals({});setTime(startOfInterval(rows,date,hose.id));setError('');setLines([]);},[n,date,hose.id]);
 const meters=types(hose);
 const opening=Object.fromEntries(meters.map(t=>[t,openingMeterValue(rows,date,hose.id,t,initialMeters,initialDate)]));
 const quantities=Object.fromEntries(meters.map(t=>[t,opening[t]!=null&&finals[t]!==undefined&&finals[t]!==''?Number(finals[t])-Number(opening[t]):null]));
 const gross=quantities[primary];const unit=UNIT_BY_CODE[productCode]||'L';
 const specified=lines.reduce((a,l)=>a+(l.volume!==''&&Number.isFinite(Number(l.volume))?Number(l.volume):0),0);
 const remaining=gross!==null&&Number.isFinite(gross)?Math.round((gross-specified)*1000)/1000:null;
 const setVoucherAccount=(index,accountId)=>{
   const account=accounts.find(a=>a.id===accountId);
   setLines(old=>old.map((l,j)=>index===j?{...l,voucherAccountId:accountId,customer:account?.name||''}:l));
 };
 const setLine=(i,key,val)=>setLines(old=>old.map((l,j)=>i===j?{...l,[key]:val}:l));
 const save=async()=>{setBusy(true);setError('');try{
   if(!editable)throw Error('La fecha no está disponible para registro.');
   if(!time)throw Error('Indica hora del arqueo.');
   const prev=rows.filter(r=>isEffectiveShift(r)&&r.hoseId===hose.id&&r.date===date).sort((a,b)=>a.sequence-b.sequence).at(-1);
   if(prev?.shiftTime&&time<=prev.shiftTime)throw Error('La hora debe ser posterior a la del intervalo anterior.');
   const reads=Object.fromEntries(meters.map(t=>[t,{initial:opening[t],final:finals[t]}]));
   const allocations=lines.map((l,i)=>{
     if(l.volume==='')throw Error(`Completa los litros del concepto ${i+1} o quita esa fila.`);
     return {...l};
   });
   const preview=computeMeterShift({date,shiftTime:time,hose,productCode,readings:reads,primary,allocations,priceHistory:prices,internationalHistory:internationalPrices,sequence:n});
   validateVoucherAllocations(preview.movementLines,accounts,voucherShifts,cashflows);
   for(const l of preview.movementLines.filter(x=>x.concept==='venta_internacional')){
     const duplicate=voucherShifts.filter(s=>isEffectiveShift(s)).some(s=>
       (s.movementLines||[]).some(x=>x.concept==='venta_internacional' && s.productCode===productCode &&
         String(x.reference||'').trim().toLowerCase()===l.reference.trim().toLowerCase()));
     if(duplicate)throw Error(`La factura internacional ${l.reference} ya está registrada para este producto en la estación.`);
   }
   await saveShift(stationId,{date,shiftTime:time,hose,productCode,readings:reads,primary,allocations,priceHistory:prices,internationalHistory:internationalPrices,sequence:n},uid);
   onSaved?.();
 }catch(e){setError(e.message||String(e))}finally{setBusy(false)}};
 return <div className="meter-inline-wrap">
  <div className="meter-inline-scroll"><table className="meter-inline-table"><thead><tr><th>Manguera</th><th>Producto del tramo</th><th>Hora</th>{meters.map(t=><React.Fragment key={t}><th>{t==='mecanico'?'Mecánico':'Digital'} inicial</th><th>{t==='mecanico'?'Mecánico':'Digital'} FINAL</th></React.Fragment>)}{meters.length===2&&<th>Meter principal</th>}<th>Despacho</th><th>Guardar</th></tr></thead><tbody><tr>
   <td><b>{hose.name}</b><small>{dispensers.find(d=>d.id===hose.dispenserId)?.name||'Dispenser'}</small></td>
   <td><span className="meter-inline-grade" style={{background:colorForProduct(productCode)}}></span>{DISPLAY_BY_CODE[productCode]}</td>
   <td><input type="time" aria-label={`Hora ${hose.name}`} value={time} onChange={e=>setTime(e.target.value)}/></td>
   {meters.map(t=><React.Fragment key={t}><td><b>{fmt(opening[t])}</b></td><td><input aria-label={`${hose.name} final ${t}`} type="number" min="0" step="0.001" placeholder="Final" value={finals[t]??''} onChange={e=>setFinals(f=>({...f,[t]:e.target.value}))}/></td></React.Fragment>)}
   {meters.length===2&&<td><select aria-label={`Medidor principal ${hose.name}`} value={primary} onChange={e=>setPrimary(e.target.value)}><option value="mecanico">Mecánico</option><option value="digital">Digital</option></select></td>}
   <td><b>{gross!==null&&Number.isFinite(gross)?fmt(gross):'—'} {unit}</b></td><td><button type="button" className="primary" disabled={busy||n>20||!editable} onClick={save}>{busy?'Guardando…':'Guardar final'}</button></td>
  </tr></tbody></table></div>
  {meters.some(t=>opening[t]===null||opening[t]===undefined)&&<p className="alert error">Faltan datos iniciales de {hose.name}. Regístralos antes de guardar.</p>}
  {meters.length===2&&quantities.mecanico!==null&&quantities.digital!==null&&<p className="meter-help">Diferencia entre medidores: {fmt(quantities.mecanico-quantities.digital)} {unit}. No se suman.</p>}
  <div className="meter-inline-options"><button type="button" className="secondary" onClick={()=>setDetails(v=>!v)}>{details?'Ocultar detalles':'Desglose opcional: vales, precio internacional, otras salidas'}</button>{n>0&&<button type="button" className="secondary" onClick={onClose}>Cerrar turno adicional</button>}</div>
  {details&&<div className="meter-breakdown">
   <p>Identifica solamente las salidas especiales. Lo no desglosado se registra automáticamente como venta normal facturada. Ninguna clasificación agrega litros al meter.</p>
   {lines.map((line,i)=><div className="meter-allocation" key={i}>
    <label>Tipo de salida<select value={line.concept} onChange={e=>setLines(old=>old.map((l,j)=>i===j?{...l,concept:e.target.value,customer:'',voucherAccountId:''}:l))}>{Object.entries(SHIFT_TYPES).filter(([c])=>c!=='venta'&&(productCode!=='GNV'||c!=='calibracion_retorno')).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Volumen {unit}<input type="number" min="0" step="0.001" placeholder="Litros identificados" value={line.volume} onChange={e=>setLine(i,'volume',e.target.value)}/></label>
    {['prepago','postpago'].includes(line.concept)&&<label>Cuenta del cliente<select value={line.voucherAccountId||''} onChange={e=>setVoucherAccount(i,e.target.value)}><option value="">Selecciona un cliente…</option>{accounts.filter(a=>a.active!==false&&a.mode===line.concept).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{line.voucherAccountId&&<small className="voucher-account-balance">{line.concept==='prepago'?'Disponible':'Por cobrar'}: Bs {fmt(voucherAccountStatement(accounts.find(a=>a.id===line.voucherAccountId),voucherShifts,cashflows)?.balanceBs||0)}</small>}</label>}
    {['otra_salida','limpieza','consumo_propio','prepago','postpago','calibracion_venta','calibracion_retorno','venta_internacional'].includes(line.concept)&&<label>Referencia / motivo<input placeholder={line.concept==='venta_internacional'?'N.º factura internacional (obligatorio)':line.concept==='limpieza'?'Motivo de limpieza':line.concept==='calibracion_retorno'?'Acta / retorno a tanque':'Vale, factura o motivo'} value={line.reference} onChange={e=>setLine(i,'reference',e.target.value)}/></label>}
    {line.concept==='venta_internacional'&&(()=>{const rate=effectiveInternationalRate(internationalPrices,productCode,date,time||'23:59');const volume=Number(line.volume)||0;return <small className="intl-meter-rate">{rate?`Internacional Bs ${rate.internationalPriceBs} · diferencial YPFB Bs ${rate.differentialBs} / ${unit} · para ${fmt(volume)} ${unit}: Bs ${(volume*rate.differentialBs).toFixed(2)} YPFB · resolución ${rate.resolutionNumber}`:'Sin tarifa ANH para esta fecha. Configurar en Configuración.'}</small>})()}
    <button type="button" className="secondary" onClick={()=>setLines(v=>v.filter((_,j)=>j!==i))}>Quitar</button>
   </div>)}
   <button type="button" className="secondary" onClick={()=>setLines(v=>[...v,{concept:'prepago',volume:'',customer:'',voucherAccountId:'',reference:''}])}>+ Identificar otra salida</button>
   <div className="meter-auto-sale" role="status"><span>Meter total: <b>{fmt(gross)} {unit}</b></span><span>Salidas identificadas: <b>{fmt(specified)} {unit}</b></span><span>Venta normal automática: <b>{remaining!==null&&remaining>=0?fmt(Math.max(0,remaining)):'EXCEDE METER'} {unit}</b></span></div>
   {remaining!==null&&remaining<0&&<p className="alert error">El desglose no puede exceder el despacho por meter. Reduce los litros identificados.</p>}
   <p>Prepago: descuenta saldo del cliente. Postpago: suma deuda por cobrar. Limpieza y otras salidas: producto que no regresa. Calibración devuelta: regresa al tanque y reduce la salida neta; calibración vendida: salida definitiva.</p>
  </div>}
  {error&&<p role="alert" className="alert error">{error}</p>}
 </div>;
}
function GNVBridge({stationId,uid,date,initialDate,existing,initialDoc,shifts,onSaved,canRecord}){
 const saved=existing.find(r=>r.date===date&&r.readings?.manual&&r.readings?.corrected&&r.readings?.uncorrected);
 const legacy=existing.filter(r=>r.date===date&&!r.readings);
 const openings=useMemo(()=>Object.fromEntries(GNV_BRIDGE_CHANNELS.map(ch=>[ch.key,bridgeInitialForDate(existing,date,ch.key,initialDoc)])),[existing,date,initialDoc]);
 const [finals,setFinals]=useState({manual:'',corrected:'',uncorrected:''});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setFinals({manual:'',corrected:'',uncorrected:''});setMessage('');setError('')},[date]);
 const complete=GNV_BRIDGE_CHANNELS.every(ch=>openings[ch.key]!==null&&openings[ch.key]!==undefined);
 const previousDate=addDaysISO(date,-1);
 const previousClosed=!initialDate||date<=initialDate||existing.some(r=>r.date===previousDate&&GNV_BRIDGE_CHANNELS.every(ch=>r.readings?.[ch.key]));
 const readings=Object.fromEntries(GNV_BRIDGE_CHANNELS.map(ch=>[ch.key,{initial:openings[ch.key],final:finals[ch.key]}]));
 const inputErrors=Object.fromEntries(GNV_BRIDGE_CHANNELS.map(ch=>{
   const input=finals[ch.key];
   const error=input!==''?validatePrmInput(input):null;
   const backwards=!error&&input!==''&&openings[ch.key]!=null&&Number(input)<Number(openings[ch.key]);
   return [ch.key,error||(backwards?'El final no puede ser menor que el inicial.':null)];
 }));
 const save=async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{
   if(!complete)throw Error('Registra primero los tres meters del puente en Datos iniciales.');
   if(saved)throw Error('El puente ya fue guardado para esta fecha.');
   if(!previousClosed)throw Error(`Primero guarda el puente del ${shortDate(previousDate)}. Los cierres deben ser consecutivos.`);
   for(const ch of GNV_BRIDGE_CHANNELS){
     if(finals[ch.key]==='')throw Error(`Falta lectura final de ${ch.label}.`);
     if(inputErrors[ch.key])throw Error(`${ch.label}: ${inputErrors[ch.key]}`);
   }
   await saveGNVBridge(stationId,{date,readings},uid);
   setMessage('Puente guardado. La lectura final será la inicial del día siguiente.');onSaved?.();
 }catch(err){setError(err.message||'No se pudo guardar el puente.')}finally{setBusy(false)}};
 const used=saved?.readings;
 const dayAudit=gnvMeterAudit(shifts,date);
 const dispenserTotal=dayAudit.totalStored;
 const days=[addDaysISO(date,-2),addDaysISO(date,-1),date,addDaysISO(date,1)];
 const monthDays=[];
 if(date && /^\d{4}-\d{2}-\d{2}$/.test(date)){
   let cursor=`${date.slice(0,7)}-01`;
   while(cursor.slice(0,7)===date.slice(0,7)){monthDays.push(cursor);cursor=addDaysISO(cursor,1);}
 }
 const counterText=(state,key)=>{
   if(state.kind==='before'||state.kind==='missing')return '—';
   if(state.kind==='base'){const v=state.readings?.[key];return v==null?'Sin dato inicial':`Base: ${fmt(Number(v))}`;}
   if(state.kind==='pending'){const v=state.readings?.[key];return v==null?'Sin dato inicial':`${fmt(Number(v))} → pendiente`;}
   const r=state.record?.readings?.[key];
   if(!r)return '—';
   const measured=roundBridge(Number(r.final)-Number(r.initial));
   const stored=Number(r.volume);
   const mismatch=Number.isFinite(stored)&&Math.abs(stored-measured)>0.005;
   return `${fmt(Number(r.initial))} → ${fmt(Number(r.final))} · Δ ${fmt(measured)}${mismatch?' ⚠ volumen desactualizado':''}`;
 };
 const bridgeRow=(day)=>{
   const state=prmDayState(existing,day,initialDate,initialDoc);
   const isBase=state.kind==='base';
   const isCurrent=day===date;
   const difference=state.kind==='saved'?Number(state.record.receivedCorrected):null;
   const flow=gnvMeterAudit(shifts,day);
   const m3uncorrected=state.kind==='saved'?Number(state.record.uncorrectedConvertedM3):null;
   return <tr key={day} className={`${isCurrent?'meter-summary-today':''} ${isSundayISO(day)?'report-sunday-row':''}`}>
     <td><strong>{shortDate(day)}</strong><small>{isBase?'Base inicial':state.kind==='saved'?'Guardado':state.kind==='pending'?'Pendiente':'Anterior'}{isSundayISO(day)?' · DOM':''}</small></td>
     {GNV_BRIDGE_CHANNELS.map(ch=><td key={ch.key}>{counterText(state,ch.key)}</td>)}
     <td>{m3uncorrected!==null&&Number.isFinite(m3uncorrected)?`${fmt(m3uncorrected)} (K)`:'—'}</td>
     <td>{flow.checks.length?`${fmt(flow.totalStored)} m³`:'—'}</td>
     <td>{difference!==null&&flow.checks.length?`${fmt(roundBridge(difference-flow.totalStored))} m³`:'—'}</td>
   </tr>;
 };
 return <section className="meter-bridge">
   <div className="meter-bridge-title"><div><h3>1. Puente de regulación · GNV (PRM)</h3><p>Libro de lecturas continuas como la matriz: cierre anterior → apertura del día siguiente. Los tres contadores son independientes, nunca se suman entre sí.</p></div><strong>m³</strong></div>
   <p className="meter-help">Matriz PRM: manual, volumen corregido y no corregido. La equivalencia del no corregido usa K = J × 28,31701636, únicamente si esa conversión corresponde a las unidades reales del equipo.</p>
   <div className="meter-summary-scroller"><table className="meter-summary-table meter-prm-daily-table"><thead><tr><th>Día</th>{GNV_BRIDGE_CHANNELS.map(ch=><th key={ch.key}>{ch.label}<small>Inicial → Final · Diferencia</small></th>)}<th>Equivalencia K<small>No corregido</small></th><th>Dispensers</th><th>Corregido − Disp.</th></tr></thead><tbody>{days.map(bridgeRow)}</tbody></table></div>
   <details className="meter-prm-month"><summary>Consultar todo el mes del PRM · {date.slice(0,7)}</summary><div className="meter-summary-scroller"><table className="meter-summary-table meter-prm-daily-table"><thead><tr><th>Día</th>{GNV_BRIDGE_CHANNELS.map(ch=><th key={ch.key}>{ch.label}<small>Inicial → Final · Diferencia</small></th>)}<th>Equivalencia K</th><th>Dispensers</th><th>Corregido − Disp.</th></tr></thead><tbody>{monthDays.map(bridgeRow)}</tbody></table></div></details>
   {!complete&&!saved&&<p className="alert error">Faltan datos iniciales del puente. Abre <b>Datos iniciales → Puente de regulación GNV</b> y registra los tres contadores.</p>}
   {!previousClosed&&!saved&&<p className="alert error">El cierre del PRM del {shortDate(previousDate)} está pendiente. Regístralo antes de guardar esta jornada para conservar la continuidad.</p>}
   {!saved&&<p className="meter-help">Ingresa solamente las lecturas finales del PRM. <b>Sin separadores de miles:</b> escribe 83837991, no 83,837991. Usa punto solo para decimales. Pulsa <b>Guardar puente del día</b> para conservar el cierre.</p>}
   <form onSubmit={save}><div className="meter-bridge-scroller"><table className="meter-bridge-table"><thead><tr><th>Componente</th><th>Lectura inicial</th><th>Lectura final</th><th>Diferencia del medidor</th><th>Equivalencia matriz (m³)</th></tr></thead><tbody>
     {GNV_BRIDGE_CHANNELS.map(ch=>{const rec=used?.[ch.key];const initial=rec?.initial??openings[ch.key];const final=rec?.final??finals[ch.key];
       const validCurrent=saved||(!inputErrors[ch.key]&&final!==''&&initial!=null&&Number.isFinite(Number(final))&&Number(final)>=Number(initial));
       const volume=validCurrent?roundBridge(Number(final)-Number(initial)):null;
       return <tr key={ch.key}><td><strong>{ch.label}</strong></td><td><input aria-label={`${ch.label} inicial`} type="text" value={initial??''} readOnly/></td><td><input aria-label={`${ch.label} final`} type="text" inputMode="decimal" placeholder="Sin separadores de miles" value={final} disabled={Boolean(saved)||!canRecord||!complete} onChange={e=>setFinals(s=>({...s,[ch.key]:e.target.value}))}/>{!saved&&inputErrors[ch.key]&&<small className="meter-prm-input-error">{inputErrors[ch.key]}</small>}</td><td><b>{volume!==null?fmt(volume):'—'}</b>{saved&&rec?.volume!=null&&volume!==null&&Math.abs(rec.volume-volume)>0.005&&<small className="meter-prm-input-error">Guardado: {fmt(rec.volume)}. Requiere rectificación.</small>}</td><td>{ch.key==='uncorrected'&&volume!==null?fmt(roundBridge(volume*28.31701636)):'—'}</td></tr>})}
   </tbody></table></div>
   <div className="meter-bridge-bottom"><p>Despacho por dispensers GNV: <b>{fmt(dispenserTotal)} m³</b>{saved&&<span> · Diferencia volumen corregido − dispensers registrados: <b>{fmt(roundBridge(Number(saved.receivedCorrected)-dispenserTotal))} m³</b> (comparativo, no merma automática)</span>}</p>{!saved&&canRecord&&<button className="secondary" disabled={busy||!complete||!previousClosed}>{busy?'Guardando…':'Guardar puente del día'}</button>}{saved&&<span className="meter-bridge-saved">✓ Puente registrado en Firestore</span>}</div>
   </form>
   {dayAudit.mismatches.length>0&&<div className="meter-prm-alert"><strong>Atención: hay despachos GNV con lecturas corregidas y volumen histórico desactualizado.</strong><p>El sistema mantiene el volumen oficial almacenado hasta realizar una rectificación controlada; cambiar solo `readings.final` en Firebase no recalcula los demás campos.</p><ul>{dayAudit.mismatches.map(r=><li key={r.id}>{r.hoseName}: diferencia de lecturas <b>{fmt(r.computed)} m³</b>, volumen almacenado <b>{fmt(r.stored)} m³</b>; diferencia <b>{fmt(r.difference)} m³</b>.</li>)}</ul><p>Total almacenado: <b>{fmt(dayAudit.totalStored)} m³</b>. Total según lecturas: <b>{fmt(dayAudit.totalFromReadings)} m³</b>. No cerrar Movimientos hasta conciliar.</p></div>}
   {legacy.length>0&&<p className="meter-help">Hay {legacy.length} registro(s) PRM antiguos sin las tres lecturas. Se conservan separados y requieren verificación.</p>}
   {message&&<p className="alert success">{message}</p>}{error&&<p className="alert error">{error}</p>}
 </section>;
}
function ProductArcheos({stationId,uid,codes,date,initialDate,shifts,initialMeters,initialGNVBridge,hoses,dispensers,prices,internationalPrices,accounts,cashflows,voucherShifts,canManage,canRecord,onSaved,bridge,receipts}){
 const [activeEdit,setActiveEdit]=useState({}),[choices,setChoices]=useState({}),[cancelId,setCancelId]=useState(null),[reason,setReason]=useState(''),[error,setError]=useState('');
 const liquid=codes[0]!=='GNV',gasoline=codes.some(c=>['GE','GE_PLUS'].includes(c));
 const days=[addDaysISO(date,-2),addDaysISO(date,-1),date,addDaysISO(date,1)];
 const allHoses=sortRegistered(hoses.filter(h=>h.active!==false&&codes.some(c=>compatibleHoseProduct(h.productCode,c))));
 const previous=hoses.filter(h=>shifts.some(r=>r.hoseId===h.id&&codes.includes(r.productCode)&&days.includes(r.date)));
 const displayHoses=sortRegistered([...new Map([...previous,...allHoses].map(h=>[h.id,h])).values()]);
 const unit=UNIT_BY_CODE[codes[0]]||'L';
 const visibilityIds=displayHoses.map(h=>h.id);
 const report=days.map(d=>({date:d,...meterConsistencyReport(shifts,d,codes,visibilityIds)}));
 const orphans=report.flatMap(r=>r.orphan.map(o=>({...o,reportDate:r.date})));
 const title=gasoline?'Gasolinas · mismo tanque y meters':codes.length>1?'Diéseles · libro de mangueras':DISPLAY_BY_CODE[codes[0]];
 const defaultCode=h=>{
   const last=shifts.filter(r=>r.hoseId===h.id&&isEffectiveShift(r)&&r.date<=date&&codes.includes(r.productCode)).sort((a,b)=>a.date.localeCompare(b.date)||a.sequence-b.sequence).at(-1);
   const feed=h.feedTankIds?.length===1?h.feedTankIds[0]:h.tankId;
   const rec=receipts.filter(r=>r.status!=='anulada'&&r.tankId===feed&&r.date<=date&&codes.includes(r.productCode)).sort((a,b)=>(a.finishedAt||a.date).localeCompare(b.finishedAt||b.date)).at(-1);
   // Solo sugiere el último producto cronológico. El operador confirma
   // expresamente el producto FACTURADO de cada tramo; la mezcla va aparte.
   const lastShiftAt=last?`${last.date}T${last.shiftTime||'23:59'}`:'';
   const lastReceiptAt=rec?(rec.finishedAt||`${rec.date}T23:59`):'';
   if(rec&&lastReceiptAt>lastShiftAt)return rec.productCode;
   if(last)return last.productCode;
   if(rec)return rec.productCode;
   return codes.includes(h.productCode)?h.productCode:codes[0];
 };
 const selected=h=>choices[h.id]||defaultCode(h);
 const annul=async r=>{try{await cancelShift(stationId,r.id,reason,uid);setCancelId(null);setReason('');setError('');onSaved?.()}catch(e){setError(e.message||String(e));}};
 return <section id={`meters-${codes[0]}`} className="panel meter-product" style={{borderLeft:`5px solid ${colorForProduct(codes[0])}`}}>
  <header className="meter-product-head"><div><h2>{title}</h2><p>{allHoses.length} manguera(s) · {codes.map(c=>`${DISPLAY_BY_CODE[c]}: ${activePriceAt(prices,c,date)?`Bs ${fmt(activePriceAt(prices,c,date).priceBs)}`:'sin precio'}`).join(' · ')}</p></div><span className="meter-unit">{unit}</span></header>
  {codes[0]==='GNV'&&initialDate&&initialGNVBridge.some(r=>r.id==='start')&&<p className="meter-help">Los tres valores del puente registrados en Datos iniciales corresponden al <b>cierre de {shortDate(addDaysISO(initialDate,-1))}</b>, base del primer día operativo. No generan volumen despachado hasta ingresar las lecturas finales.</p>}
  {codes[0]==='GNV'&&<><GNVBridge stationId={stationId} uid={uid} date={date} initialDate={initialDate} existing={bridge} initialDoc={initialGNVBridge.find(r=>r.id==='start')} shifts={shifts} canRecord={canRecord} onSaved={onSaved}/><h3 className="meter-gnv-subtitle">2. Meters de dispensers GNV</h3></>}
  {liquid&&codes.length>1&&<p className="meter-help">Un mismo contador continúa aunque cambie la gasolina o el diésel. El producto de la factura se elige para cada tramo. La composición estimada del tanque se consulta por separado en Movimientos.</p>}
  {!displayHoses.length?<div><p className="muted">Sin mangueras activas. Comprueba sus tanques de alimentación en Configuración.</p>{orphans.length>0&&<p className="meter-link-warning">Hay {orphans.length} registro(s) antiguos de {title} que ya figuran en Movimientos, pero no tienen una manguera configurada actualmente. No los vuelvas a registrar; revisa la configuración original.</p>}</div>:<>
    <p className="meter-summary-caption">Cierre inicial del día anterior → primer inicial y último final de cada jornada. Los guiones no significan ventas cero. Se muestran por separado los registros que aún no se pueden vincular a una manguera.</p>
    {orphans.length>0&&<div className="meter-link-warning" role="alert"><b>Hay {orphans.length} arqueo(s) guardados en Movimientos sin asociación con una manguera de esta pantalla.</b> No vuelvas a ingresarlos: están contabilizados. Comprueba el ID de manguera del registro histórico y el de Configuración. El volumen sigue incluido en el total por producto.
      <details><summary>Ver registros pendientes de vincular</summary><ul>{orphans.map(r=><li key={`${r.id||r.hoseId}_${r.reportDate}_${r.sequence}`}>{shortDate(r.reportDate)} · {r.hoseName||r.hoseId||'Sin manguera'} · {fmt(Number(r.grossVolume)||0)} {unit} · {r.productCode} · ID: {r.hoseId||'sin ID'}</li>)}</ul></details>
    </div>}
    <div className="meter-summary-scroller"><table className="meter-summary-table"><thead><tr><th>Fecha</th>{displayHoses.map(h=><th key={h.id}>{h.name}<small>{dispensers.find(d=>d.id===h.dispenserId)?.name||''}</small></th>)}{orphans.length>0&&<th>Sin vincular</th>}<th>Total {unit}</th></tr></thead><tbody>
    {days.map((d,i)=>{const audit=report[i];return <tr key={d} className={`${i===2?'meter-summary-today':''} ${isSundayISO(d)?'report-sunday-row':''}`}><td><b>{shortDate(d)}</b><small>{i===2?'Registro':i===3?'Siguiente':'Anterior'}{isSundayISO(d)?' · DOM':''}</small></td>{displayHoses.map(h=>{const cell=meterHoseDayCell(shifts,d,codes,h.id,initialMeters,initialDate);return <td className="meter-summary-cell" key={h.id}>{cell.kind==='recorded'?<div className="meter-summary-readings">
       {['mecanico','digital'].filter(t=>cell.summary.readings[t]).map(t=><span className="meter-reading-pair" key={t}><small>{t==='mecanico'?'Mec.':'Dig.'}</small><span>{fmt(cell.summary.readings[t].initial)} <b>→</b> {fmt(cell.summary.readings[t].final)}</span></span>)}
       <strong>{fmt(cell.summary.grossVolume)} {unit}</strong><small>{cell.summary.count} arqueo(s) · {cell.summary.products.map(c=>DISPLAY_BY_CODE[c]||c).join(' / ')}</small></div>
       :cell.kind==='anchor'?<div className="meter-summary-readings meter-summary-anchor">{['mecanico','digital'].filter(t=>cell.readings[t]!==undefined).map(t=><span className="meter-reading-pair" key={t}><small>{t==='mecanico'?'Mec.':'Dig.'}</small><span>{fmt(cell.readings[t])}</span></span>)}<small>Base inicial · cierre anterior</small></div>
       :cell.kind==='pending'?<div className="meter-summary-readings meter-summary-pending">{['mecanico','digital'].filter(t=>cell.readings[t]!==undefined).map(t=><span className="meter-reading-pair" key={t}><small>{t==='mecanico'?'Mec.':'Dig.'}</small><span>{fmt(cell.readings[t])} <b>→</b> pendiente</span></span>)}<small>Sin final registrado</small></div>
       :<span className="meter-summary-no-data">—<small>Sin dato inicial</small></span>}</td>})}{orphans.length>0&&<td className="meter-summary-unlinked">{audit.orphan.length?<><b>{fmt(audit.unlinked)} {unit}</b><small>{audit.orphan.length} pendiente(s)</small></>:'—'}</td>}<td><b>{audit.count?fmt(audit.total):'—'}</b>{audit.count>0&&<small>{audit.count} arqueo(s)</small>}</td></tr>})}</tbody></table></div>
    <div className="meter-sheet-current"><h3>{shortDate(date)} · Registro directo de lecturas finales {isSundayISO(date)?'· DOM':''}</h3><p>Las lecturas iniciales se obtienen de Datos iniciales o del último final guardado. No debes volver a escribirlas.</p>
      {codes.length>1&&<div className="meter-receipts-tags"><strong>Recepciones del día:</strong>{receipts.filter(r=>r.date===date&&codes.includes(r.productCode)&&r.status!=='anulada').map(r=><span key={r.id} className="meter-receipt-tag" style={{borderColor:colorForProduct(r.productCode)}}>{DISPLAY_BY_CODE[r.productCode]} · {r.tankName||'Tanque'} · {fmt(r.documentLiters)} L</span>)}{!receipts.some(r=>r.date===date&&codes.includes(r.productCode)&&r.status!=='anulada')&&<span>Sin recepciones registradas</span>}</div>}
      {allHoses.map(h=>{const rows=shifts.filter(r=>isEffectiveShift(r)&&r.hoseId===h.id&&r.date===date).sort((a,b)=>a.sequence-b.sequence);const n=nextSequence(shifts,date,h.id);const show=n===0||activeEdit[h.id];const code=selected(h);const possibleDuplicate=orphans.some(r=>r.reportDate===date&&String(r.hoseName||'').trim().toLowerCase()===String(h.name||'').trim().toLowerCase());
        return <section className="meter-sheet-hose" key={h.id}><div className="meter-sheet-hose-title"><strong>{h.name}</strong><small>{dispensers.find(d=>d.id===h.dispenserId)?.name||'Dispenser'} · {n} intervalo(s)</small>
          {codes.length>1&&<label>Producto facturado<select value={code} onChange={e=>setChoices(old=>({...old,[h.id]:e.target.value}))}>{codes.map(c=><option value={c} key={c}>{DISPLAY_BY_CODE[c]}</option>)}</select></label>}
          {n>0&&!show&&canRecord&&<button type="button" className="secondary" onClick={()=>setActiveEdit(o=>({...o,[h.id]:true}))}><Plus size={15}/> Otro turno</button>}
        </div>
        {rows.map(r=><div key={r.id} className="meter-sheet-saved"><span style={{color:colorForProduct(r.productCode)}}>●</span> {r.shiftTime} · {DISPLAY_BY_CODE[r.productCode]} · Mecánico {fmt(r.readings?.mecanico?.final)} · Digital {fmt(r.readings?.digital?.final)} · <b>{fmt(r.grossVolume)} {unit}</b>{recordedMeterCheck(r)?.inconsistent&&<span className="meter-prm-input-error"> ⚠ Lecturas: {fmt(recordedMeterCheck(r).computed)} {unit}. Registro desactualizado; requiere rectificación.</span>}{canManage&&<button type="button" className="meter-cancel-link" onClick={()=>setCancelId(r.id)}>Anular</button>}{cancelId===r.id&&<div className="meter-cancel"><input placeholder="Motivo (mínimo 8 caracteres)" value={reason} onChange={e=>setReason(e.target.value)}/><button className="secondary" onClick={()=>annul(r)}>Confirmar</button><button className="secondary" onClick={()=>setCancelId(null)}>Volver</button></div>}</div>)}
        {possibleDuplicate&&<p className="meter-link-warning">Esta manguera tiene un arqueo histórico identificado por su nombre, pero su ID no coincide. No agregues el mismo despacho nuevamente: primero verifica el vínculo del registro.</p>}
        {show&&canRecord&&!possibleDuplicate&&<InlineMeterRow key={`${h.id}_${date}_${n}`} date={date} initialDate={initialDate} hose={h} productCode={code} stationId={stationId} uid={uid} rows={shifts} initialMeters={initialMeters} dispensers={dispensers} prices={prices} internationalPrices={internationalPrices} accounts={accounts} cashflows={cashflows} voucherShifts={voucherShifts} editable={canRecord} onClose={()=>setActiveEdit(o=>({...o,[h.id]:false}))} onSaved={()=>{setActiveEdit(o=>({...o,[h.id]:false}));onSaved?.()}}/>}
      </section>})}
    </div>
  </>}
  {error&&<p role="alert" className="alert error">{error}</p>}
 </section>;
}
export default function MeterBook({stationId,uid,products,tanks=[],hoses,dispensers,canManage,operationalDate,onOperationalDateChange}){
 // useDocuments descarta consultas si alguna dependencia es falsy. Empezar en 1: con 0 se bloqueaba la suscripción a meterShifts.
 const [localDate,setLocalDate]=useState(today()),[refresh,setRefresh]=useState(1);
 const date=operationalDate||localDate;
 const setDate=next=>{if(!next)return;setLocalDate(next);onOperationalDateChange?.(next)};
 // Incluimos la historia previa para que un medidor no regrese accidentalmente
 // a su valor inicial cuando hubo un cierre hace más de 14 días.
 const {items:shifts,error,loading:loadingShifts}=useDocuments(()=>query(stationPath(stationId,'meterShifts'),where('date','<=',addDaysISO(date,1))),[stationId,date,refresh]);
 const {items:prices}=useDocuments(()=>stationPath(stationId,'priceHistory'),[stationId]);
 const {items:internationalPrices,error:internationalError}=useDocuments(()=>stationPath(stationId,'internationalPriceHistory'),[stationId]);
 const {items:accounts,error:voucherAccountError}=useDocuments(()=>stationPath(stationId,'voucherAccounts'),[stationId]);
 const {items:voucherShifts,error:voucherShiftsError}=useDocuments(()=>stationPath(stationId,'meterShifts'),[stationId]);
 const {items:cashflows,error:voucherCashflowError}=useDocuments(()=>stationPath(stationId,'voucherCashflows'),[stationId]);
 const {items:initialMeters}=useDocuments(()=>stationPath(stationId,'initialMeters'),[stationId]);
 const {items:initialGNVBridge}=useDocuments(()=>stationPath(stationId,'initialGNVBridge'),[stationId]);
 const {items:bridge}=useDocuments(()=>stationPath(stationId,'gnvBridge'),[stationId]);
 const {items:receipts}=useDocuments(()=>query(stationPath(stationId,'receptions'),where('date','<=',date)),[stationId,date]);
 const {items:settings}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
 const initialDate=settings.find(s=>s.id==='start')?.date;
 const enabled=products.filter(p=>p.active&&UNIT_BY_CODE[p.code]);
 // Las mangueras anteriores a v0.4 no tenían productCode.
 // Configuración reconoce su combustible mediante feedTankIds; Meters debe hacer lo mismo.
 const resolvedHoses=useMemo(()=>resolveLegacyHoses(hoses,tanks),[hoses,tanks]);
 const unresolvedHoses=resolvedHoses.filter(h=>h.active!==false&&!h.productCode);
 const groups=[['GE','GE_PLUS'],['DO','D_ULS'],['GNV']].map(codes=>codes.filter(c=>enabled.some(p=>p.code===c))).filter(c=>c.length);
 return <div className="ops-page meter-book"><div className="section-intro"><h2>Libro de meters y arqueos</h2><p>Registro horizontal como en la matriz: cada manguera conserva su meter inicial; solo escribe el final de cada turno y guarda la fila.</p></div>
   <section className="panel meter-toolbar" aria-label="Fecha operativa y accesos rápidos a meters">
     <div className="meter-date-control"><label htmlFor="meter-operational-date">Fecha operativa</label>
       <div className="meter-date-steps">
         <button type="button" className="meter-day-step" title="Día anterior" aria-label="Día anterior" disabled={Boolean(initialDate)&&date<=initialDate} onClick={()=>setDate(addDaysISO(date,-1))}><ChevronLeft size={18}/></button>
         <input id="meter-operational-date" type="date" aria-label="Fecha operativa editable" value={date} onChange={e=>setDate(e.target.value)} min={initialDate||undefined}/>
         <button type="button" className="meter-day-step" title="Día siguiente" aria-label="Día siguiente" onClick={()=>setDate(addDaysISO(date,1))}><ChevronRight size={18}/></button>
       </div>
     </div>
     <div className="meter-current-date"><b>Registro de {shortDate(date)} · {date.slice(0,4)}</b><small>Lecturas y precios de la fecha seleccionada</small></div>
     <nav className="meter-jump-links" aria-label="Ir directamente al tipo de combustible">
       {groups.map(codes=><button type="button" key={codes[0]} className="meter-jump" onClick={()=>document.getElementById(`meters-${codes[0]}`)?.scrollIntoView({behavior:'smooth',block:'start'})}>{codes[0]==='GE'?'Gasolinas':codes[0]==='DO'?'Diésel':'GNV'}</button>)}
     </nav>
   </section>
   {loadingShifts&&<p className="meter-help">Consultando arqueos guardados de la estación…</p>}
   <details className="meter-help"><summary>Diagnóstico de sincronización de Meters (solo lectura)</summary><p>Estación seleccionada: <code>{stationId}</code>. Fecha: <code>{date}</code>. Lecturas descargadas hasta el día siguiente: <b>{shifts.length}</b>. Lecturas del día: <b>{shifts.filter(s=>s.date===date).length}</b>. Mangueras configuradas: <b>{resolvedHoses.length}</b>.</p><p>Si un arqueo existe en Firebase pero no aparece aquí, comprueba que su estación sea la misma. Si aparece abajo pero la columna está vacía, compara el ID de manguera con el de Configuración.</p><div className="meter-inline-scroll"><table className="meter-inline-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Manguera registrada</th><th>ID de registro</th><th>ID configurado</th><th>Producto</th><th>Litros o m³</th><th>Estado</th></tr></thead><tbody>{shifts.filter(s=>s.date===date).slice(0,50).map(s=><tr key={s.id}><td>{s.date}</td><td>{s.shiftTime||'—'}</td><td>{s.hoseName||'—'}</td><td><code>{s.hoseId||'—'}</code></td><td><code>{resolvedHoses.find(h=>h.id===s.hoseId)?.id||'SIN VINCULAR'}</code></td><td>{s.productCode||'—'}</td><td>{fmt(s.grossVolume)}</td><td>{s.status||'histórico'}</td></tr>)}</tbody></table></div>{shifts.filter(s=>s.date===date).length>50&&<p>Se muestran los primeros 50 registros de la fecha.</p>}</details>
   {error&&<p className="alert error">No se pudieron consultar los arqueos: {error}. No vuelvas a registrar datos hasta revisar el acceso.</p>}
   {!initialDate&&<p className="alert error">Registra primero la fecha de inicio en Datos iniciales.</p>}
   {!enabled.length&&<p className="alert error">Activa los productos desde Configuración.</p>}
   {unresolvedHoses.length>0&&<p className="alert error">No se pudo identificar el tanque de alimentación de: {unresolvedHoses.map(h=>h.name).join(', ')}. Revisa sus conexiones en Configuración; no elimines las mangueras ni sus lecturas iniciales.</p>}
   {groups.map(codes=><ProductArcheos key={codes.join('_')} stationId={stationId} uid={uid} codes={codes} date={date} initialDate={initialDate} shifts={shifts} initialMeters={initialMeters} initialGNVBridge={initialGNVBridge} hoses={resolvedHoses} dispensers={dispensers} prices={prices} internationalPrices={internationalPrices} accounts={accounts} cashflows={cashflows} voucherShifts={voucherShifts} canManage={canManage} canRecord={Boolean(initialDate)&&date>=initialDate} onSaved={()=>setRefresh(x=>x+1)} bridge={bridge} receipts={receipts}/>) }
   {(voucherAccountError||voucherCashflowError||voucherShiftsError)&&<p className="alert error">No se pudieron leer las cuentas de vales: {voucherAccountError||voucherCashflowError||voucherShiftsError}. No registres entregas prepago/postpago hasta revisarlo.</p>}
   {internationalError&&<p className="alert error">No se pudo consultar el historial internacional: {internationalError}. No registres facturas internacionales hasta resolverlo.</p>}
   <VoucherLedger stationId={stationId} uid={uid} canManage={canManage} accounts={accounts} cashflows={cashflows} shifts={voucherShifts}/>
   <section className="panel"><h3>Integración Facturito/GOTA (posterior)</h3><p className="muted">El registro manual conserva por separado fecha, hora, manguera, producto, lecturas mecánicas y digitales. La importación automática se integrará sin reescribir los arqueos históricos.</p></section>
 </div>;
}
