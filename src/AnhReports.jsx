import React,{useMemo,useState} from 'react';
import {query,where} from 'firebase/firestore';
import {FileSpreadsheet,Printer,AlertCircle,CheckCircle2,CalendarRange} from 'lucide-react';
import {useDocuments} from './hooks';
import {stationPath} from './data';
import {buildAnhReport,reportProducts} from './anhReportMath.js';
import {downloadAnhExcel} from './anhExcelExport.js';
import {printAnhReport} from './anhPrint.js';
import {boliviaCurrentMonth,changeMonth,monthDays,validMonth} from './movementMath.js';
import './anhReports.css';
const nfmt=x=>Number.isFinite(x)?new Intl.NumberFormat('es-BO',{maximumFractionDigits:2}).format(x):'—';
function currentISO(){const a=new Intl.DateTimeFormat('en-US',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const t=Object.fromEntries(a.map(x=>[x.type,x.value]));return `${t.year}-${t.month}-${t.day}`;}
export default function AnhReports({stationId,station}){
 const [month,setMonth]=useState(boliviaCurrentMonth()),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const lastDate=validMonth(month)?monthDays(month).at(-1):currentISO();
 // La contabilidad necesita el historial anterior al mes para arrastrar el saldo físico.
 const {items:products,error:productsError,loading:productsLoading}=useDocuments(()=>stationPath(stationId,'products'),[stationId]);
 const {items:tanks,error:tanksError,loading:tanksLoading}=useDocuments(()=>stationPath(stationId,'tanks'),[stationId]);
 const {items:initialSettings,error:settingsError,loading:settingsLoading}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
 const {items:initialTanks,error:initialError,loading:initialLoading}=useDocuments(()=>stationPath(stationId,'initialTanks'),[stationId]);
 const {items:inventoryReadings,error:inventoryError,loading:inventoryLoading}=useDocuments(()=>query(stationPath(stationId,'inventoryReadings'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:receptions,error:receptionsError,loading:receptionsLoading}=useDocuments(()=>query(stationPath(stationId,'receptions'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:meterShifts,error:shiftsError,loading:shiftsLoading}=useDocuments(()=>query(stationPath(stationId,'meterShifts'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:gnvBridge,error:bridgeError,loading:bridgeLoading}=useDocuments(()=>query(stationPath(stationId,'gnvBridge'),where('date','<=',lastDate)),[stationId,lastDate]);
 const loading=[productsLoading,tanksLoading,settingsLoading,initialLoading,inventoryLoading,receptionsLoading,shiftsLoading,bridgeLoading].some(Boolean);
 const errors=[productsError,tanksError,settingsError,initialError,inventoryError,receptionsError,shiftsError,bridgeError].filter(Boolean);
 const report=useMemo(()=>buildAnhReport({month,station,products,tanks,initialSettings,initialTanks,inventoryReadings,receptions,meterShifts,gnvBridge,nowISO:currentISO()}),
   [month,station,products,tanks,initialSettings,initialTanks,inventoryReadings,receptions,meterShifts,gnvBridge]);
 const hasOutput=report.active.length>0;
 async function excel(){if(errors.length||loading)return;setBusy(true);setNotice('');try{await downloadAnhExcel(report);}catch(e){setNotice(`No se pudo descargar Excel: ${e.message}`);}finally{setBusy(false);}}
 function pdf(part){setNotice('');try{printAnhReport(report,part);}catch(e){setNotice(e.message);}}
 return <div className="anh-module">
   <section className="panel anh-panel">
    <div className="anh-title"><div><h2>Reportes ANH · Octano Volúmenes</h2><p>Exportación mensual automática a partir de Inventarios, Recepciones y Meters. Un solo origen de datos para el cuadre.</p></div><CalendarRange size={29}/></div>
    <div className="anh-controls"><label>Mes de reporte<input type="month" value={month} onChange={e=>setMonth(e.target.value||boliviaCurrentMonth())}/></label>
      <button type="button" className="secondary" onClick={()=>setMonth(changeMonth(month,-1))}>← Mes anterior</button>
      <button type="button" className="secondary" onClick={()=>setMonth(boliviaCurrentMonth())}>Mes actual</button>
    </div>
    <div className="anh-meta"><span><b>Tipo:</b> {report.type==='puesto'?'Puesto de venta':report.type==='mixta'?'Estación líquidos + GNV':'Estación de líquidos'}</span>
    <span><b>Productos:</b> {report.active.length?report.active.join(' · '):'Ninguno activo'}</span>
    <span><b>Período:</b> {month}</span>
    <span className={`anh-mark ${report.provisional?'anh-warn':'anh-ok'}`}>{report.provisional?'PRELIMINAR':'PARA VALIDAR'}</span></div>
    {loading&&<div className="anh-note">Cargando registros de Firebase para este mes…</div>}
    {errors.length>0&&<div className="alert error">Error de lectura de Firestore. No exportar hasta corregirlo: {errors.join(' · ')}</div>}
    {notice&&<div role="status" className="alert error">{notice}</div>}
    <div className="anh-actions"><button type="button" className="primary" disabled={busy||loading||!hasOutput||errors.length>0} onClick={excel}><FileSpreadsheet size={19}/>{busy?'Generando Excel...':'Descargar Excel Octano + ANH'}</button>
     <button type="button" className="secondary" disabled={loading||!report.active.some(x=>x!=='GNV')||errors.length>0} onClick={()=>pdf('liquidos')}><Printer size={18}/> PDF líquidos / puesto</button>
     {report.gnv&&<button type="button" className="secondary" disabled={loading||errors.length>0} onClick={()=>pdf('gnv')}><Printer size={18}/> PDF GNV</button>}
     <button type="button" className="secondary" disabled={loading||!hasOutput||errors.length>0} onClick={()=>pdf('todos')}><Printer size={18}/> PDF completo</button></div>
    <p className="anh-note">En PDF se abrirá la vista de impresión: elige «Guardar como PDF» o tu impresora. Los archivos son <b>borradores para conciliación</b>, no formularios emitidos por ANH. No se crean firmas, QR ni códigos oficiales.</p>
   </section>
   <section className="panel anh-panel"><h3>Estado del cuadre del mes</h3>
    <div className="anh-cards">{Object.entries(report.liquids).map(([code,p])=><div key={code} className="anh-card"><b>{code} · {p.name}</b><span>Recepción: {nfmt(p.summary.receipt)} L</span><span>Salidas: {nfmt(p.summary.sale)} L</span><small className={p.pending?'anh-pending':'anh-complete'}>{p.pending?`${p.pending} día(s) pendientes de físico individual`:'Sin pendientes físicos detectados'}</small></div>)}
      {report.gnv&&<div className="anh-card"><b>GNV · Gas Natural Vehicular</b><span>Salida del mes: {nfmt(report.gnv.filter(x=>x.date<=report.cutoff).reduce((n,r)=>n+(r.venta||0),0))} m³</span><span>Solo salidas por dispensers, sin sumar PRM</span><small>Control técnico independiente en Movimientos</small></div>}
    </div>
    {report.issues.length>0?<div className="anh-alert"><AlertCircle size={18}/><div><b>Pendientes de validación antes de presentar</b><ul>{report.issues.map((x,i)=><li key={i}>{x}</li>)}</ul></div></div>:
    <div className="anh-ok-message"><CheckCircle2 size={18}/> Sin alertas automáticas. Verificar que el formulario y los códigos oficiales correspondan a la normativa vigente.</div>}
    <p className="anh-note">Los reportes distinguen datos faltantes de valores cero; no agregan saldos no registrados. Cuando GE/GE+ o DO/D_ULS comparten tanque, el físico conjunto figura en una hoja auxiliar y no se reparte arbitrariamente.</p>
   </section>
 </div>;
}
