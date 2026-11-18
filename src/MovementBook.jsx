import InternationalLedger from './InternationalLedger.jsx';
import React,{useMemo,useState} from 'react';
import {doc,query,where,setDoc,serverTimestamp} from 'firebase/firestore';
import {CalendarDays, ChevronLeft, ChevronRight, MessageSquareText, Save, Info, Layers3, Eye, EyeOff} from 'lucide-react';
import {useDocuments} from './hooks';
import {db} from './firebase';
import {stationPath} from './data';
import {colorForProduct} from './calibrationMath';
import {boliviaCurrentMonth,monthDays,changeMonth,validMonth,MOVEMENT_CODES,MOVEMENT_NAMES,
  LIQUID_GROUPS,FAMILY_TITLES,buildLiquidMovements,buildGnvMovements,visibleMovementColumns} from './movementMath';
import './movement.css';
import {estimateTankComposition} from './mixedTankEstimate.js';
import {isSundayISO} from './reportCalendar';
import {SHIFT_TYPES} from './meterMath.js';
import {gnvMeterAudit} from './gnvReconciliation.js';
import {gnvMonthlySummary,compareGnvMonthlyRisk,gnvDailyIndicator} from './gnvRiskMath.js';
import {GAS_COLOR,gasolineReceiptsByDate,combineGasolineMix,estimatedPhysicalSplit,previousISO} from './gasolineVisual.js';
const fmt=(v,unit='')=>v===null||v===undefined?'—':`${Number(v).toLocaleString('es-BO',{maximumFractionDigits:3})}${unit}`;
const shortDate=date=>date?`${date.slice(8,10)}/${date.slice(5,7)}`:'';
const MONTH_LABEL=new Intl.DateTimeFormat('es-BO',{month:'long',year:'numeric',timeZone:'UTC'});
const displayMonth=month=>validMonth(month)?MONTH_LABEL.format(new Date(`${month}-01T12:00:00Z`)):month;
const LIQUID_COLUMNS=[
 {key:'beginning',label:'Saldo anterior',group:'Saldo anterior',showZero:true},
 {key:'receiptL',label:'Recepciones',group:'Ingresos',showZero:true},
 {key:'otherIncomeL',label:'Otros ingresos',group:'Ingresos'},
 {key:'grossOutL',label:'Meters',group:'Salidas',showZero:true},
 {key:'returnedL',label:'Devolución calibración',group:'Salidas'},
 {key:'outL',label:'Salidas netas',group:'Salidas',showZero:true},
 {key:'transportDiff',label:'Merma / demasía',group:'Transporte',showZero:true,difference:true},
 {key:'closing',label:'Contable calculado',group:'Saldo contable',showZero:true},
 {key:'operationDiff',label:'Merma / demasía',group:'Operación',showZero:true,difference:true},
 {key:'physical',label:'Saldo final FÍSICO',group:'Saldo final',showZero:true},
 {key:'amountBs',label:'Despachos (Bs)',group:'Valor',showZero:true},
];
const GROUP_COLUMNS=[
 {key:'beginning',label:'Saldo anterior físico',group:'Saldo anterior',showZero:true},
 {key:'receiptL',label:'Recepciones',group:'Ingresos',showZero:true},
 {key:'otherIncomeL',label:'Otros ingresos',group:'Ingresos'},
 {key:'grossOutL',label:'Meters',group:'Salidas'},
 {key:'returnedL',label:'Calibración devuelta',group:'Salidas'},
 {key:'outL',label:'Salidas netas',group:'Salidas',showZero:true},
 {key:'accounting',label:'Contable calculado',group:'Saldo contable',showZero:true},
 {key:'transportDiff',label:'Transporte',group:'Diferencias',showZero:true,difference:true},
 {key:'operationDiff',label:'Operación',group:'Diferencias',showZero:true,difference:true},
 {key:'totalDiff',label:'Total',group:'Diferencias',showZero:true,difference:true},
 {key:'physical',label:'Saldo final FÍSICO',group:'Saldo final',showZero:true},
 {key:'amountBs',label:'Despachos (Bs)',group:'Valor'},
];
function MonthBar({month,onChange}){
 return <div className="movement-monthbar">
   <button type="button" className="secondary movement-arrow" aria-label="Mes anterior" onClick={()=>onChange(changeMonth(month,-1))}><ChevronLeft size={17}/></button>
   <label><span>Mes</span><input aria-label="Seleccionar mes" type="month" value={month} onChange={e=>validMonth(e.target.value)&&onChange(e.target.value)}/></label>
   <button type="button" className="secondary movement-arrow" aria-label="Mes siguiente" onClick={()=>onChange(changeMonth(month,1))}><ChevronRight size={17}/></button>
 </div>;
}
function NoteEditor({date,code,note,stationId,uid,onClose,canManage}){
 const [value,setValue]=useState(note?.note||''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const save=async e=>{e.preventDefault();setError('');setBusy(true);try{
   const txt=value.trim();if(txt.length<3||txt.length>1000)throw Error('La observación debe contener entre 3 y 1.000 caracteres.');
   await setDoc(doc(db,'stations',stationId,'movementNotes',`${date}_${code}`),{date,productCode:code,note:txt,updatedBy:uid,updatedAt:serverTimestamp()});
   onClose();
 }catch(err){setError(err.message||String(err));}finally{setBusy(false);}};
 return <div className="movement-note-editor"><form onSubmit={save}>
   <strong>Observación · {shortDate(date)}</strong>
   <textarea rows={3} maxLength={1000} disabled={!canManage} value={value} onChange={e=>setValue(e.target.value)} placeholder="Describir el motivo, incidencia o justificación"/>
   {error&&<span className="movement-error">{error}</span>}
   <div><button type="button" className="secondary" onClick={onClose}>Cerrar</button>{canManage&&<button type="submit" className="primary" disabled={busy||value.trim().length<3}><Save size={14}/> {busy?'Guardando…':'Guardar observación'}</button>}</div>
 </form></div>;
}
function MovementSection({title,code,month,onMonth,rows,columns,stationId,uid,canManage,notes,highlight,help,unit='L'}){
 const available=visibleMovementColumns(rows,columns);
 const [editing,setEditing]=useState(null),[detailsDay,setDetailsDay]=useState(null);
 const noteMap=useMemo(()=>new Map(notes.filter(n=>n.productCode===code).map(n=>[n.date,n])),[notes,code]);
 const grouped=available.reduce((arr,c)=>{const last=arr[arr.length-1];if(last?.name===c.group)last.count++;else arr.push({name:c.group,count:1});return arr;},[]);
 const withData=rows.filter(r=>r.hasActivity).length;
 return <section className="panel movement-section" style={{'--movement-color':highlight}}>
   <div className="movement-heading"><div><h2>{title}</h2><p>{displayMonth(month)} · {withData} día(s) con datos · {unit==='m³'?'Metros cúbicos':'Litros'}{help?' · conciliación separada':''}</p></div><MonthBar month={month} onChange={onMonth}/></div>
   {help&&<p className="movement-explanation"><Info size={16}/>{help}</p>}
   <div className="movement-scroll"><table className="movement-table">
      <thead><tr className="movement-groups"><th rowSpan={2} className="movement-date">Día</th>
       {grouped.map(g=><th key={g.name} colSpan={g.count}>{g.name}</th>)}<th rowSpan={2}>Estado</th><th rowSpan={2} aria-label="Observaciones">Obs.</th></tr>
       <tr className="movement-labels">{available.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map(r=>{const saved=noteMap.get(r.date);const hasNote=Boolean(saved?.note);return <React.Fragment key={r.date}>
        <tr className={`${r.hasActivity?'movement-row-with-data':'movement-row-empty'} ${editing===r.date?'movement-open-note':''} ${isSundayISO(r.date)?'report-sunday-row':''}`}>
        <td className="movement-date"><b>{shortDate(r.date)}</b>{isSundayISO(r.date)&&<small className="report-sunday-label">DOM</small>}</td>
        {available.map(c=>{const v=r[c.key];return <td key={c.key} className={`${c.difference&&v!==null&&v!==undefined?(v<0?'movement-loss':v>0?'movement-surplus':''):''}`}>
          {fmt(v)}{r.transportProvisional&&c.key==='transportDiff'&&v!==null&&<sup title="Recepción provisional">*</sup>}
        </td>})}
        <td className="movement-state">{!r.hasActivity?'Sin registro':code==='GNV'?r.technicalDifference!==null?'Por conciliar':'Parcial':r.physical!==null||r.operationDiff!==null?'Por revisar':'Parcial'}</td>
        <td>{Object.keys(r.lines||{}).length>0&&<button type="button" className="movement-breakdown-btn" onClick={()=>setDetailsDay(detailsDay===r.date?null:r.date)} title="Ver tipos de salida">{detailsDay===r.date?"Ocultar":"Detalle"}</button>}<button type="button" className={`movement-note-btn ${hasNote?'has-note':''}`} title={hasNote?saved.note:'Registrar observación'} aria-label={`Observación ${r.date}`} onClick={()=>setEditing(editing===r.date?null:r.date)}><MessageSquareText size={16}/></button></td></tr>
        {detailsDay===r.date&&Object.keys(r.lines||{}).length>0&&<tr><td colSpan={available.length+3} className="movement-breakdown-row"><b>Salidas incluidas en los meters:</b><div>{Object.entries(r.lines).map(([key,vol])=><span key={key}>{SHIFT_TYPES[key]||key}: <b>{fmt(vol)} {unit}</b></span>)}</div><small>Venta normal, prepago, postpago, limpieza y calibraciones forman parte del mismo meter. La calibración devuelta se descuenta solo al calcular salidas netas.</small></td></tr>}
        {editing===r.date&&<tr><td colSpan={available.length+3} className="movement-note-cell"><NoteEditor key={`${code}_${r.date}`} date={r.date} code={code} note={saved} stationId={stationId} uid={uid} onClose={()=>setEditing(null)} canManage={canManage}/></td></tr>}
      </React.Fragment>})}</tbody>
   </table></div>
   {!withData&&<p className="movement-empty">Todavía no hay registros en este mes. Las columnas de movimientos aparecerán automáticamente cuando existan datos.</p>}
 </section>;
}
/** Libro principal de la familia Gasolinas. Un único físico; detalle contable bajo demanda. */
function GasolineFamilySection({month,onMonth,rows,productRows,initialTanks,mixtureModels,receptions,stationId,uid,canManage,notes}){
 const [view,setView]=useState('ALL');
 const [openDay,setOpenDay]=useState(null);
 const [editing,setEditing]=useState(null);
 const receiptMap=useMemo(()=>gasolineReceiptsByDate(receptions),[receptions]);
 const noteMap=useMemo(()=>new Map(notes.filter(n=>n.productCode==='FAMILY_gasolina').map(n=>[n.date,n])),[notes]);
 const mixMap=useMemo(()=>new Map(rows.map(r=>[r.date,combineGasolineMix(mixtureModels,initialTanks,r.date)])),[rows,mixtureModels,initialTanks]);
 const active=visibleMovementColumns(rows,GROUP_COLUMNS);
 const groups=active.reduce((a,c)=>{const prev=a.at(-1);if(prev?.name===c.group)prev.count++;else a.push({name:c.group,count:1});return a;},[]);
 const selections=[{code:'ALL',name:'Gasolinas · conjunto'},{code:'GE',name:'Solo Gasolina Especial'},{code:'GE_PLUS',name:'Solo Gasolina Plus'}];
 const count=rows.filter(r=>r.hasActivity).length;
 const selectedName=view==='GE'?'Gasolina Especial':'Gasolina Especial Plus';
 // Una cifra por celda. La división estimada queda exclusivamente bajo el ojito.
 const compactReceipt=(receipt,value)=>{
   if(value==null)return '—';
   const ge=Number(receipt?.GE)||0,plus=Number(receipt?.GE_PLUS)||0;
   if(ge>0&&plus>0)return <span className="gfv-inline-receipts" title={`GE: ${fmt(ge)} L · GE+: ${fmt(plus)} L`}><b className="gfv-ge">GE {fmt(ge)}</b><span aria-hidden="true">·</span><b className="gfv-plus">GE+ {fmt(plus)}</b></span>;
   return <span className={`gfv-single-amount ${plus>0?'gfv-plus':'gfv-ge'}`} title={plus>0?'Recepción de Gasolina Especial Plus':ge>0?'Recepción de Gasolina Especial':'Recepción conjunta'}>{fmt(value)}</span>;
 };
 const compactBalance=(value,mix)=>{
   if(value==null)return '—';
   const composed=mix&&mix.total>0;
   const hasGe=composed&&mix.GE>0.0005,hasPlus=composed&&mix.GE_PLUS>0.0005;
   const majorityPlus=Boolean(hasPlus&&(!hasGe||mix.GE_PLUS>mix.GE));
   const title=composed?`Estimación GE ${mix.gePct.toFixed(1)} %, GE+ ${mix.plusPct.toFixed(1)} %. Pulsa el ojo para ver el detalle.`:'Sin estimación de composición. Pulsa el ojo para ver los detalles.';
   return <span className={`gfv-single-balance ${majorityPlus?'gfv-plus':'gfv-ge'}`} title={title}>
     {hasGe&&hasPlus&&<span aria-hidden="true" className="gfv-mix-mark"><i style={{width:`${mix.gePct}%`,background:GAS_COLOR.GE}}/><i style={{width:`${mix.plusPct}%`,background:GAS_COLOR.GE_PLUS}}/></span>}
     {fmt(value)}
   </span>;
 };
 const changeView=code=>{setView(code);setEditing(null);setOpenDay(null);};
 return <>
 <section className="panel movement-section gfv-family" style={{'--movement-color':GAS_COLOR.BLEND}}>
  <div className="movement-heading"><div><h2>Gasolinas · movimiento conjunto</h2><p>{displayMonth(month)} · {count} día(s) con datos · GE y GE+ comparten tanque y meters</p></div><MonthBar month={month} onChange={onMonth}/></div>
  <div className="gfv-toolbar" role="group" aria-label="Vista de gasolinas">
    {selections.map(s=><button key={s.code} type="button" className={`gfv-switch ${view===s.code?'gfv-selected':''}`} onClick={()=>changeView(s.code)}>{s.code!=='ALL'&&<i className={`gfv-dot ${s.code==='GE'?'gfv-dark':'gfv-brown'}`}/>} {s.name}</button>)}
    <div className="gfv-legend"><span><i className="gfv-dot gfv-dark"/>GE · negro</span><span><i className="gfv-dot gfv-brown"/>GE+ · café</span><span><i className="gfv-dot gfv-amber"/>Mezcla estimada · naranja</span></div>
  </div>
  {view==='ALL'?<>
   <p className="movement-explanation"><Info size={16}/>La tabla principal usa el saldo físico total del tanque y todos los despachos sin duplicarlos. Las recepciones GE se identifican en negro y las GE+ en café. El reparto visual del saldo es una estimación de mezcla, no una medición química ni una reasignación de la factura.</p>
   <div className="movement-scroll"><table className="movement-table gfv-ledger">
    <thead><tr className="movement-groups"><th rowSpan={2} className="movement-date">Día</th>{groups.map(g=><th key={g.name} colSpan={g.count}>{g.name}</th>)}<th rowSpan={2}>Estado</th><th rowSpan={2}>Detalle</th></tr>
    <tr className="movement-labels">{active.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map(r=>{
      const saved=noteMap.get(r.date),dayMix=mixMap.get(r.date),beforeMix=combineGasolineMix(mixtureModels,initialTanks,previousISO(r.date));
      const receipt=receiptMap.get(r.date);
      const hasBreakdown=Boolean(dayMix?.total>0||receipt?.records.length||r.hasActivity);
      return <React.Fragment key={r.date}>
        <tr className={`${r.hasActivity?'movement-row-with-data':'movement-row-empty'} ${isSundayISO(r.date)?'report-sunday-row':''}`}>
          <td className="movement-date"><b>{shortDate(r.date)}</b>{isSundayISO(r.date)&&<small className="report-sunday-label">DOM</small>}</td>
          {active.map(c=>{
            const value=r[c.key];
            const deltaClass=c.difference&&value!=null?(value<0?'movement-loss':value>0?'movement-surplus':''):'';
            return <td key={c.key} className={deltaClass}>
              {c.key==='receiptL'?compactReceipt(receipt,value):
               c.key==='physical'?compactBalance(value,dayMix):
               c.key==='beginning'?compactBalance(value,beforeMix):
               fmt(value)}
              {r.preliminary&&c.key==='transportDiff'&&value!=null&&<sup title="Recepción provisional">*</sup>}
            </td>;
          })}
          <td className="movement-state">{!r.hasActivity?'Sin registro':r.physical!==null?'Por revisar':'Parcial'}</td>
          <td className="gfv-action-cell"><button type="button" className="gfv-eye" disabled={!hasBreakdown} onClick={()=>setOpenDay(openDay===r.date?null:r.date)} aria-label={`Ver detalle de gasolinas ${r.date}`} title="Ver GE y GE+"><Eye size={16}/></button><button type="button" className="movement-note-btn" onClick={()=>setEditing(editing===r.date?null:r.date)} title={saved?.note||'Observación'}><MessageSquareText size={16}/></button></td>
        </tr>
        {openDay===r.date&&<tr><td colSpan={active.length+3} className="gfv-detail-cell">
          <div className="gfv-detail-head"><b>Detalle de {shortDate(r.date)} · Separación contable y estimación de mezcla</b><button type="button" className="gfv-close" onClick={()=>setOpenDay(null)}><EyeOff size={15}/> Ocultar</button></div>
          <div className="gfv-detail-grid">{['GE','GE_PLUS'].map(code=>{
            const p=productRows?.[code]?.find(x=>x.date===r.date);
            const theoretical=dayMix?.[code];
            const estimated=estimatedPhysicalSplit(dayMix,r.physical)?.[code];
            return <div key={code} className={`gfv-detail-card ${code==='GE_PLUS'?'gfv-detail-plus':''}`}>
              <strong>{code==='GE'?'Gasolina Especial · GE':'Gasolina Especial Plus · GE+'}</strong>
              <div>Recepción: <b>{fmt(receipt?.[code]||0)} L</b></div>
              <div>Despacho registrado por producto facturado: <b>{fmt(p?.grossOutL||0)} L</b></div>
              <div>Saldo contable del libro individual: <b>{fmt(p?.closing)} L</b></div>
              <div>Modelo de mezcla estimada: <b>{theoretical==null?'Sin dato':`${fmt(theoretical)} L`}</b></div>
              {estimated!=null&&<div>Parte estimada del físico: <b>~{fmt(estimated)} L</b></div>}
            </div>;
          })}</div>
          {dayMix?.total>0&&<><div className="gfv-composition-track" role="img" aria-label={`Estimación teórica de mezcla GE ${dayMix.gePct.toFixed(1)} por ciento, GE Plus ${dayMix.plusPct.toFixed(1)} por ciento`}><span style={{width:`${dayMix.gePct}%`,background:GAS_COLOR.GE}}/><span style={{width:`${dayMix.plusPct}%`,background:GAS_COLOR.GE_PLUS}}/></div><small>GE: {dayMix.gePct.toFixed(1)} % · GE+: {dayMix.plusPct.toFixed(1)} %. Los litros estimados no sustituyen el físico ni modifican los saldos oficiales.</small></>}
          {dayMix?.warnings?.length>0&&<p className="gfv-quality-note">Advertencia del modelo: {dayMix.warnings.join(' · ')}</p>}
          {!dayMix?.total&&<small>Sin base verificable para estimar composición en esta fecha.</small>}
        </td></tr>}
        {editing===r.date&&<tr><td colSpan={active.length+3}><NoteEditor key={`FAMILY_gasolina_${r.date}`} date={r.date} code="FAMILY_gasolina" note={saved} stationId={stationId} uid={uid} onClose={()=>setEditing(null)} canManage={canManage}/></td></tr>}
      </React.Fragment>;
    })}</tbody>
   </table></div>
   <p className="gfv-disclaimer">Rojo y verde se reservan exclusivamente para mermas y demasías. Las estimaciones visuales no cambian la clasificación de ventas ni la conciliación física.</p>
  </>:<div className="gfv-filtered">
     <p className="movement-explanation"><Info size={16}/>Vista contable de {selectedName}. Las lecturas físicas y meters son compartidos; aquí solo se presentan recepciones y ventas registradas con este producto. Un contador registrado no implica necesariamente una venta atribuida a GE+.</p>
     <MovementSection key={view} title={`Detalle contable · ${selectedName}`} code={view} month={month} onMonth={onMonth} rows={productRows[view]||[]} columns={LIQUID_COLUMNS} stationId={stationId} uid={uid} canManage={canManage} notes={notes} highlight={view==='GE'?GAS_COLOR.GE:GAS_COLOR.GE_PLUS} />
  </div>}
 </section>
 </>;
}

// GNV como la matriz de estación: PRM, clasificación de los meters, diferencia y %.
// No clasifica la diferencia como una fuga probada.
const GNV_TYPES=[
 ['contado','Facturación al contado'],
 ['consumoPropio','Consumo propio'],
 ['calibracion','Calibración'],
 ['prepago','Prepago'],
 ['postpago','Postpago'],
 ['otros','Otros'],
 ['sinClasificar','Sin clasificar']
];
const gnvPercent=(n)=>n===null||n===undefined?'—':`${Number(n).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2})} %`;
function GnvMatrixSection({month,onMonth,rows,previousRows,stationId,uid,canManage,notes}){
 const [opened,setOpened]=useState(null),[editing,setEditing]=useState(null);
 const noteMap=useMemo(()=>new Map(notes.filter(n=>n.productCode==='GNV').map(n=>[n.date,n])),[notes]);
 const current=useMemo(()=>gnvMonthlySummary(rows,month),[rows,month]);
 const previous=useMemo(()=>gnvMonthlySummary(previousRows,changeMonth(month,-1)),[previousRows,month]);
 const risk=compareGnvMonthlyRisk(current,previous);
 const previousMonth=displayMonth(changeMonth(month,-1));
 const dailyRows=useMemo(()=>rows.filter(r=>r.hasActivity).map(r=>({...r,indicator:gnvDailyIndicator(r)})),[rows]);
 return <section className="panel movement-section gnv-matrix-section" style={{'--movement-color':'#568947'}}>
   <div className="movement-heading"><div><h2>Gas Natural Vehicular (GNV)</h2><p>{displayMonth(month)} · Matriz PRM versus dispensers · m³</p></div><MonthBar month={month} onChange={onMonth}/></div>
   <p className="movement-explanation"><Info size={16}/>El volumen corregido del PRM representa el ingreso medido; las mangueras registran el despacho. <b>Diferencia = dispensers − PRM corregido</b>: negativa en rojo (merma técnica estimada), positiva en verde (demasía técnica). Los valores deben estar en m³ comparables y corresponder al mismo corte horario. No confirma por sí sola una fuga.</p>
   <div className="gnv-summary-grid">
     <div><span>PRM corregido del mes</span><b>{fmt(current.observedDays?current.corrected:null)} m³</b></div>
     <div><span>Dispensers del mes</span><b>{fmt(current.observedDays?current.dispensed:null)} m³</b></div>
     <div><span>Diferencia neta del mes</span><b className={current.signed<0?'movement-loss':current.signed>0?'movement-surplus':''}>{fmt(current.observedDays?current.signed:null)} m³</b></div>
     <div><span>Merma media ponderada</span><b className={current.loss>0?'movement-loss':''}>{gnvPercent(current.lossRatePct)}</b></div>
     <div><span>Demasía media ponderada</span><b className={current.surplus>0?'movement-surplus':''}>{gnvPercent(current.surplusRatePct)}</b></div>
   </div>
   {risk.status==='critico'?<div className="gnv-risk gnv-risk-critical"><strong>ALERTA CRÍTICA: diferencia superior en más del 10 % al promedio del mes anterior.</strong><p>Promedio anterior: {gnvPercent(previous.lossRatePct)} · actual: {gnvPercent(current.lossRatePct)} · umbral relativo: {gnvPercent(risk.threshold)}. Solicitar inspección técnica inmediata según el procedimiento de seguridad de la estación; este cálculo NO demuestra una fuga.</p></div>:
    risk.status==='superior'?<div className="gnv-risk gnv-risk-warning"><strong>Alerta preventiva: la merma estimada supera el promedio del mes anterior.</strong><p>Referencia: {gnvPercent(previous.lossRatePct)} · actual: {gnvPercent(current.lossRatePct)}. Si sigue aumentando se activará alerta crítica al superar {gnvPercent(risk.threshold)}.</p></div>:
    risk.status==='sin_referencia'?<p className="gnv-reference-note">Referencia mensual pendiente: para comparar necesitamos todos los días conciliados de {previousMonth}. No se inventa un promedio anterior.</p>:
    risk.status==='referencia_cero'?<p className="gnv-reference-note">La referencia del mes anterior fue 0 %; no se puede calcular un incremento relativo del 10 %. Revisar manualmente cualquier nueva pérdida positiva.</p>:
    <p className="gnv-reference-note">Dentro del promedio anterior: {gnvPercent(previous.lossRatePct)} · límite interno con 10 % de tolerancia relativa: {gnvPercent(risk.threshold)}.</p>}
   {(risk.surplusStatus==='critico'||risk.surplusStatus==='superior')&&<p className="gnv-reference-note gnv-surplus-warning">Atención: la demasía media de {gnvPercent(current.surplusRatePct)} supera la referencia anterior de {gnvPercent(previous.surplusRatePct)}. Revisar calibración y consistencia de los contadores; no es un indicador directo de fuga.</p>}
   <div className="gnv-daily-panel" aria-label="Control diario de mermas y demasías GNV">
     <div className="gnv-daily-heading"><div><h3>Control diario · mermas y demasías</h3><p>Lectura directa por fecha, sin desplazarte hasta el extremo de la matriz.</p></div><span>m³ y %</span></div>
     <div className="gnv-daily-wrap"><table className="gnv-daily-table">
       <thead><tr><th>Fecha</th><th>PRM corregido</th><th>Dispensers</th><th>Merma / demasía (m³)</th><th>Diferencia (%)</th><th>Estado</th></tr></thead>
       <tbody>{dailyRows.length?dailyRows.map(r=>{
         const v=r.indicator;
         const kind=v.state==='merma'?'movement-loss':v.state==='demasia'?'movement-surplus':'';
         return <tr key={r.date} className={isSundayISO(r.date)?'gnv-daily-sunday':''}>
           <td className="gnv-daily-date"><b>{shortDate(r.date)}</b>{isSundayISO(r.date)&&<small>DOM</small>}</td>
           <td>{fmt(r.receivedCorrected)}</td><td>{fmt(r.outVolume)}</td>
           <td className={kind}><b>{fmt(v.signed)}</b></td>
           <td className={kind}><b>{gnvPercent(v.percent)}</b></td>
           <td><span className={`gnv-daily-status gnv-daily-${v.state}`}>{v.state==='merma'?'Merma':v.state==='demasia'?'Demasía':v.state==='igual'?'Sin diferencia':'Pendiente'}</span></td>
         </tr>;
       }):<tr><td colSpan={6} className="gnv-daily-empty">Sin mediciones registradas para este mes.</td></tr>}</tbody>
     </table></div>
     <p className="gnv-daily-help">En rojo, el despacho medido es menor que el volumen corregido del PRM; en verde, es mayor. Los días incompletos muestran «Pendiente» y no se interpretan como 0 m³.</p>
   </div>
   <div className="movement-scroll"><table className="movement-table gnv-matrix-table">
     <thead>
       <tr className="movement-groups gnv-matrix-top"><th className="movement-date" rowSpan={2}>FECHA</th><th colSpan={2}>MEDIDA P.R.M.</th><th colSpan={8}>SALIDAS POR METERS (m³)</th><th>CONTROL DIARIO</th><th rowSpan={2}>OBS.</th><th className="gnv-percentage-head" rowSpan={2}>MERMA / DEMASÍA %</th></tr>
       <tr className="movement-labels"><th>Volumen manual</th><th>Volumen corregido</th>
         {GNV_TYPES.map(([key,label])=><th key={key}>{label}</th>)}<th>Total dispensers</th><th>Dispensers − corregido</th></tr>
     </thead>
     <tbody>{rows.map(r=>{
       const saved=noteMap.get(r.date),hasNote=Boolean(saved?.note),hasVariance=r.signedDifference!==null&&r.signedDifference!==undefined;
       const signedStyle=hasVariance?(r.signedDifference<0?'movement-loss':r.signedDifference>0?'movement-surplus':''):'';
       return <React.Fragment key={r.date}>
         <tr className={`${r.hasActivity?'movement-row-with-data':'movement-row-empty'} ${isSundayISO(r.date)?'report-sunday-row':''}`}>
           <td className="movement-date"><b>{shortDate(r.date)}</b>{isSundayISO(r.date)&&<small className="report-sunday-label">DOM</small>}</td>
           <td>{fmt(r.receivedManual)}</td><td><b>{fmt(r.receivedCorrected)}</b></td>
           {GNV_TYPES.map(([key])=><td key={key}>{r.outVolume===null?'—':fmt(r.categories?.[key]||0)}</td>)}
           <td><b>{fmt(r.outVolume)}</b></td>
           <td className={signedStyle}>{fmt(r.signedDifference)}</td>
           <td className="gnv-obs">
             {r.hasActivity&&<button type="button" className="gnv-detail-eye" title="Ver detalle PRM y clasificación" aria-label={`Ver detalle GNV ${r.date}`} onClick={()=>setOpened(opened===r.date?null:r.date)}><Eye size={16}/></button>}
             <button type="button" className={`movement-note-btn ${hasNote?'has-note':''}`} title={hasNote?saved.note:'Registrar observación'} onClick={()=>setEditing(editing===r.date?null:r.date)} aria-label={`Observación GNV ${r.date}`}><MessageSquareText size={16}/></button>
           </td>
           <td className={`gnv-percent-cell ${signedStyle}`}>{gnvPercent(r.differencePercent)}</td>
         </tr>
         {opened===r.date&&<tr><td className="gnv-detail-cell" colSpan={13}>
           <strong>Detalle de GNV · {shortDate(r.date)}</strong>
           <div className="gnv-detail-grid"><span>PRM no corregido: <b>{fmt(r.receivedUncorrected)}</b></span><span>Valor de los despachos: <b>Bs {fmt(r.amountBs)}</b></span><span>Merma técnica estimada: <b className="movement-loss">{fmt(r.estimatedLossM3)} m³</b></span><span>Demasía técnica estimada: <b className="movement-surplus">{fmt(r.estimatedSurplusM3)} m³</b></span></div>
           {r.classificationProblems?.length>0&&<p className="gnv-risk-warning-text">Arqueos que requieren clasificación: {r.classificationProblems.join(' · ')}.</p>}
           <small>El total del dispenser se cuenta una sola vez; los tipos de salida son únicamente su desglose. Comprueba que el PRM y los dispensers correspondan al mismo intervalo de operación.</small>
         </td></tr>}
         {editing===r.date&&<tr><td className="movement-note-cell" colSpan={13}><NoteEditor key={`GNV_${r.date}`} date={r.date} code="GNV" note={saved} stationId={stationId} uid={uid} onClose={()=>setEditing(null)} canManage={canManage}/></td></tr>}
       </React.Fragment>;
     })}</tbody>
   </table></div>
   <p className="gnv-footnote">Promedio del mes: m³ de merma estimada acumulada ÷ m³ corregidos acumulados × 100. La referencia se obtiene exclusivamente de un mes anterior completo. Un exceso relativo del 10 % es un disparador interno de revisión, no un umbral regulatorio ni una demostración de fuga. Las discrepancias pueden involucrar calibración, diferencias de condiciones de medición o cortes de horario.</p>
 </section>;
}

export default function MovementBook({stationId,uid,products,tanks,hoses=[],canManage}){
 const active=products.filter(p=>p.active!==false&&MOVEMENT_CODES.includes(p.code));
 const codes=active.map(p=>p.code);
 const [months,setMonths]=useState({});
 const current=boliviaCurrentMonth();
 const monthOf=code=>months[code]||current;
 const setMonth=(code,month)=>setMonths(previous=>({...previous,[code]:month}));
 const maxMonth=[...codes.map(monthOf),monthOf('FAMILY_gasolina'),monthOf('FAMILY_diesel')].sort().at(-1)||current;
 const lastDate=monthDays(maxMonth).at(-1);
 // Se incluyen los registros anteriores al mes mostrado para mantener los saldos de arrastre.
 // En fases posteriores se usarán cierres mensuales consolidados para limitar el historial descargado.
 const {items:settings}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
 const {items:initialTanks}=useDocuments(()=>stationPath(stationId,'initialTanks'),[stationId]);
 const {items:inventoryReadings,error:inventoryError}=useDocuments(()=>query(stationPath(stationId,'inventoryReadings'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:receptions,error:receptionError}=useDocuments(()=>query(stationPath(stationId,'receptions'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:shifts,error:meterError}=useDocuments(()=>query(stationPath(stationId,'meterShifts'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:bridge,error:bridgeError}=useDocuments(()=>query(stationPath(stationId,'gnvBridge'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:notes,error:notesError}=useDocuments(()=>stationPath(stationId,'movementNotes'),[stationId]);
 const startDate=settings.find(s=>s.id==='start')?.date;
 const model=useMemo(()=>{
   const output={};for(const code of codes.filter(c=>c!=='GNV')){
     output[code]=buildLiquidMovements({month:monthOf(code==='GE'||code==='GE_PLUS'?'FAMILY_gasolina':code),products:active,tanks,initialTanks,initialDate:startDate,inventoryReadings,receptions,meterShifts:shifts}).products[code];
   }
   for(const group of Object.keys(LIQUID_GROUPS)){
     const shared=LIQUID_GROUPS[group].filter(c=>codes.includes(c)).length>1;
     if(shared||(group==='gasolina'&&LIQUID_GROUPS[group].some(c=>codes.includes(c))))output[`FAMILY_${group}`]=buildLiquidMovements({month:monthOf(`FAMILY_${group}`),products:active,tanks,initialTanks,initialDate:startDate,inventoryReadings,receptions,meterShifts:shifts}).families[group];
   }
   if(codes.includes('GNV'))output.GNV=buildGnvMovements({month:monthOf('GNV'),bridge,meterShifts:shifts});
   if(codes.includes('GNV'))output.GNV_PREVIOUS=buildGnvMovements({month:changeMonth(monthOf('GNV'),-1),bridge,meterShifts:shifts});
   return output;
 },[codes.join('|'),JSON.stringify(months),current,startDate,tanks,initialTanks,inventoryReadings,receptions,shifts,bridge]);
 const sharedFamilies=Object.keys(LIQUID_GROUPS).filter(g=>g==='gasolina'?LIQUID_GROUPS[g].some(c=>codes.includes(c)):LIQUID_GROUPS[g].filter(c=>codes.includes(c)).length>1);
 const mixtures=useMemo(()=>{
   return Object.fromEntries(sharedFamilies.map(f=>[f,estimateTankComposition({
      tanks:tanks.filter(t=>LIQUID_GROUPS[f].includes(t.productCode)),initialTanks,
      receptions,meterShifts:shifts,hoses,fromDate:startDate,
      untilDate:monthDays(monthOf(`FAMILY_${f}`)).at(-1)
   })]));
 },[sharedFamilies.join('|'),tanks,initialTanks,receptions,shifts,hoses,startDate,JSON.stringify(months),current]);
 const errors=[inventoryError,receptionError,meterError,bridgeError,notesError].filter(Boolean);
 const gnvAudit = useMemo(()=>gnvMeterAudit(shifts),[shifts]);
 return <div className="ops-page movement-book">
  <header className="movement-intro"><div><h2>Movimiento de productos</h2><p>Gasolinas en conjunto con detalle opcional por producto. Los demás combustibles conservan su libro mensual; selecciona el mes para consultar el historial.</p></div><CalendarDays size={25}/></header>
  {errors.length>0&&<div className="alert error">No se pudo cargar toda la información: {errors.join(' · ')}</div>}
  {gnvAudit.mismatches.length>0&&<div className="meter-prm-alert"><strong>Inconsistencia de meters GNV: los finales corregidos no coinciden con los volúmenes almacenados.</strong><p>Movimientos todavía utiliza los volúmenes históricos hasta realizar una rectificación trazable. No cierres ese periodo ni agregues m³ de forma manual.</p><ul>{gnvAudit.mismatches.slice(0,12).map(r=><li key={r.id}>{r.date} · {r.hoseName}: lectura indica {fmt(r.computed)} m³, pero el arqueo tiene {fmt(r.stored)} m³.</li>)}</ul>{gnvAudit.mismatches.length>12&&<p>Hay más discrepancias; revísalas desde Meters.</p>}</div>}
  {!startDate&&<div className="alert error">Falta registrar la fecha de arranque en Datos iniciales. No se calcularán saldos anteriores hasta completarla.</div>}
  {codes.some(c=>c==='GE'||c==='GE_PLUS')&&<GasolineFamilySection
     month={monthOf('FAMILY_gasolina')} onMonth={m=>setMonth('FAMILY_gasolina',m)}
     rows={model.FAMILY_gasolina||model.GE||model.GE_PLUS||[]}
     productRows={{GE:model.GE||[],GE_PLUS:model.GE_PLUS||[]}}
     initialTanks={initialTanks} mixtureModels={mixtures.gasolina||[]} receptions={receptions}
     stationId={stationId} uid={uid} canManage={canManage} notes={notes}/>}
  {codes.filter(c=>c!=='GNV'&&c!=='GE'&&c!=='GE_PLUS').map(code=>{
    const family='diesel';
    const shared=LIQUID_GROUPS[family].filter(c=>codes.includes(c)).length>1;
    return <MovementSection key={code} title={MOVEMENT_NAMES[code]} code={code} rows={model[code]||[]}
      month={monthOf(code)} onMonth={m=>setMonth(code,m)} columns={LIQUID_COLUMNS}
      stationId={stationId} uid={uid} canManage={canManage} notes={notes} highlight={colorForProduct(code)}
      help={shared?'El físico final de los diéseles compartidos se concilia conjuntamente; no se imputan mermas arbitrariamente.':null}/>;
  })}
  {Object.keys(LIQUID_GROUPS).filter(group=>group!=='gasolina'&&LIQUID_GROUPS[group].filter(code=>codes.includes(code)).length>1).map(group=><MovementSection
      key={group} title={FAMILY_TITLES[group]} code={`FAMILY_${group}`} rows={model[`FAMILY_${group}`]||[]}
      month={monthOf(`FAMILY_${group}`)} onMonth={m=>setMonth(`FAMILY_${group}`,m)} columns={GROUP_COLUMNS}
      stationId={stationId} uid={uid} canManage={canManage} notes={notes} highlight={group==='gasolina'?'#bd3035':'#2f70b9'}
      help="Saldo anterior = físico de medianoche anterior. Saldo contable = anterior + ingresos − salidas netas. Saldo final = FÍSICO de medianoche actual. Merma/demasía = físico menos contable, separando transporte. La diferencia física se concilia por familia y nunca se imputa arbitrariamente a un producto compartido."/>)}
  {sharedFamilies.filter(f=>f!=='gasolina').map(f=><section key={`mixture_${f}`} className="panel movement-section" style={{'--movement-color':f==='gasolina'?GAS_COLOR.BLEND:'#2f70b9'}}>
    <div className="movement-heading"><div><h2>Composición contable estimada · {f==='gasolina'?'gasolinas':'diéseles'}</h2>
      <p>Modelo de mezcla proporcional por tanque · Consulta {displayMonth(monthOf(`FAMILY_${f}`))}</p></div></div>
    <p className="movement-explanation"><Info size={16}/>Estimación teórica para ayudar a conciliar la carga muerta: cuando ingresa otro producto, se supone mezcla homogénea. Cada despacho posterior se reparte proporcionalmente entre los volúmenes contables. <b>No identifica químicamente qué combustible salió, no altera el producto facturado y no reparte mermas físicas.</b> Verifica siempre las especificaciones y autorizaciones aplicables antes de cambiar el producto de un tanque.</p>
    <div className="movement-scroll"><table className="movement-table"><thead><tr><th>Tanque</th><th>Modelo total (L)</th>{LIQUID_GROUPS[f].filter(c=>codes.includes(c)).map(c=><th key={c}>{MOVEMENT_NAMES[c]} (L, estimado)</th>)}<th>Observaciones</th></tr></thead><tbody>
     {(mixtures[f]||[]).map(t=><tr key={t.tankId}><td><b>{t.tankName}</b></td><td>{fmt(t.total)}</td>{LIQUID_GROUPS[f].filter(c=>codes.includes(c)).map(c=><td key={c} className={f==='gasolina'?(c==='GE_PLUS'?'gfv-plus':'gfv-ge'):''}>{fmt(t.estimatedBalances[c]||0)}</td>)}<td><small>{t.uncertainties.length?t.uncertainties.join(' · '):'Estimación sin alertas de integridad'}</small></td></tr>)}
    </tbody></table></div>
    <div className="movement-mixture-grids">{(mixtures[f]||[]).map(t=><div className="movement-mixture-card" key={t.tankId}>
      <div className="movement-mixture-caption"><b>{t.tankName}</b><span>{fmt(t.total)} L (teóricos)</span></div>
      <div className="movement-mixture-bar" role="img" aria-label={`Distribución teórica en ${t.tankName}`}>
       {LIQUID_GROUPS[f].filter(c=>codes.includes(c)).map(c=>{const share=t.total>0?100*(t.estimatedBalances[c]||0)/t.total:0;return <div key={c} style={{width:`${share}%`,background:f==='gasolina'?(GAS_COLOR[c]||colorForProduct(c)):colorForProduct(c)}} title={`${MOVEMENT_NAMES[c]}: ${fmt(t.estimatedBalances[c]||0)} L · ${share.toFixed(1)} %`}/>})}
      </div>
      <div className="movement-mixture-legend">{LIQUID_GROUPS[f].filter(c=>codes.includes(c)).map(c=><span key={c}><i style={{background:f==='gasolina'?(GAS_COLOR[c]||colorForProduct(c)):colorForProduct(c)}}/>{MOVEMENT_NAMES[c]}: {fmt(t.estimatedBalances[c]||0)} L</span>)}</div>
      <details><summary>Ver ingresos y despachos considerados ({t.timeline.length})</summary>
       <div className="movement-mixture-events">{t.timeline.slice(-12).map((event,i)=><div key={i}><span>{event.at.replace('T',' · ')}</span><span>{event.kind==='receipt'?'Ingreso':'Despacho'} · {MOVEMENT_NAMES[event.productCode]||event.productCode}</span><b>{fmt(event.volume)} L</b></div>)}</div>
      </details>
    </div>)}</div>
    <p className="movement-explanation">El cuadro es auxiliar y no sustituye los saldos contables por producto del libro ni el saldo físico nocturno total. Las diferencias de transporte y operación permanecen en el movimiento consolidado.</p>
   </section>)}
  <InternationalLedger stationId={stationId} uid={uid} canManage={canManage} shifts={shifts} month={monthOf('FAMILY_gasolina')}/>
  {codes.includes('GNV')&&<GnvMatrixSection rows={model.GNV||[]} previousRows={model.GNV_PREVIOUS||[]}
    month={monthOf('GNV')} onMonth={m=>setMonth('GNV',m)}
    stationId={stationId} uid={uid} canManage={canManage} notes={notes}/>}
  {!codes.length&&<section className="panel"><Layers3 size={24}/><p>Activa productos en Configuración para crear sus libros mensuales.</p></section>}
  <p className="movement-footer"><Info size={16}/> El SALDO FINAL es siempre el físico nocturno registrado; el contable es solo un cálculo para obtener merma/demasía. Si falta medición física, el cierre queda pendiente. La merma/demasía se muestra con signo negativo o positivo. Las recepciones provisionales y los arqueos sin cierre nocturno requieren revisión. Los valores de meters no se duplican al clasificar prepago, crédito, calibraciones o consumo propio.</p>
 </div>;
}
