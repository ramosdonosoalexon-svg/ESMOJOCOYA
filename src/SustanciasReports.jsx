import React,{useMemo,useState,useEffect} from 'react';
import {doc,setDoc,serverTimestamp,query,where,onSnapshot} from 'firebase/firestore';
import {FileSpreadsheet,ShieldCheck,AlertTriangle} from 'lucide-react';
import {db,stationPath} from './data';
import {useDocuments} from './hooks';
import {buildAnhReport} from './anhReportMath.js';
import {buildSustanciasPart1} from './sustanciasModel.js';
import {downloadSustanciasExcel} from './sustanciasTemplate.js';
import {boliviaCurrentMonth,monthDays,changeMonth,validMonth} from './movementMath.js';
import './sustanciasReports.css';
const fields=[['registration','N.º de registro en Sustancias Controladas'],['legalName','Razón social'],['legalRepresentative','Representante legal / propietario'],['city','Ciudad / localidad'],['address','Dirección'],['responsible','Responsable del llenado'],['telephone','Teléfono (opcional)']];
function nowBolivia(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
const emptyProfile=Object.fromEntries(fields.map(([key])=>[key,'']));
function fnum(value){return value===null||value===undefined?'—':Number(value).toLocaleString('es-BO',{maximumFractionDigits:2});}
export default function SustanciasReports({stationId,station,uid,canManage=false}){
 const [month,setMonth]=useState(boliviaCurrentMonth()),[draft,setDraft]=useState(emptyProfile),[saving,setSaving]=useState(false),[exporting,setExporting]=useState(false),[message,setMessage]=useState('');
 const lastDate=validMonth(month)?monthDays(month).at(-1):nowBolivia();
 const [stored,setStored]=useState(null),[settingsLoading,setSettingsLoading]=useState(true),[settingsError,setSettingsError]=useState('');
 useEffect(()=>{setSettingsLoading(true);setSettingsError('');
  return onSnapshot(doc(db,'stations',stationId,'reportSettings','sustancias'),snap=>{
    setStored(snap.exists()?snap.data():null);setSettingsLoading(false);
  },err=>{setSettingsError(err.message);setSettingsLoading(false);});
 },[stationId]);
 const {items:products,error:pError,loading:pLoad}=useDocuments(()=>stationPath(stationId,'products'),[stationId]);
 const {items:tanks,error:tError,loading:tLoad}=useDocuments(()=>stationPath(stationId,'tanks'),[stationId]);
 const {items:initialSettings,error:iError,loading:iLoad}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
 const {items:initialTanks,error:itError,loading:itLoad}=useDocuments(()=>stationPath(stationId,'initialTanks'),[stationId]);
 const {items:inventoryReadings,error:ivError,loading:ivLoad}=useDocuments(()=>query(stationPath(stationId,'inventoryReadings'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:receptions,error:rError,loading:rLoad}=useDocuments(()=>query(stationPath(stationId,'receptions'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:meterShifts,error:mError,loading:mLoad}=useDocuments(()=>query(stationPath(stationId,'meterShifts'),where('date','<=',lastDate)),[stationId,lastDate]);
 const {items:gnvBridge,error:gError,loading:gLoad}=useDocuments(()=>query(stationPath(stationId,'gnvBridge'),where('date','<=',lastDate)),[stationId,lastDate]);
 useEffect(()=>{setDraft({...emptyProfile,legalName:station?.name||'',city:station?.city||'',address:station?.address||'',...Object.fromEntries(fields.map(([key])=>[key,stored?.[key]||((key==='legalName'&&station?.name)||(key==='city'&&station?.city)||(key==='address'&&station?.address))||'']))});},[stationId,stored,station?.name,station?.city,station?.address]);
 const profile=useMemo(()=>({...emptyProfile,legalName:station?.name||'',city:station?.city||'',...stored}),[stored,station]);
 const report=useMemo(()=>buildAnhReport({month,station,products,tanks,initialSettings,initialTanks,inventoryReadings,receptions,meterShifts,gnvBridge,nowISO:nowBolivia()}),[month,station,products,tanks,initialSettings,initialTanks,inventoryReadings,receptions,meterShifts,gnvBridge]);
 const model=useMemo(()=>buildSustanciasPart1({report,receptions,meterShifts,profile}),[report,receptions,meterShifts,profile]);
 const loading=[settingsLoading,pLoad,tLoad,iLoad,itLoad,ivLoad,rLoad,mLoad,gLoad].some(Boolean);
 const errors=[settingsError,pError,tError,iError,itError,ivError,rError,mError,gError].filter(Boolean);
 const missingProfile=fields.filter(([key])=>key!=='telephone'&&!String(profile[key]||'').trim()).map(([,label])=>label);
 async function save(e){e.preventDefault();setMessage('');if(!canManage)return;setSaving(true);try{
   const data=Object.fromEntries(fields.map(([key])=>[key,String(draft[key]||'').trim()]));
   await setDoc(doc(db,'stations',stationId,'reportSettings','sustancias'),{...data,updatedBy:uid,updatedAt:serverTimestamp()});
   setMessage('Datos generales guardados para los siguientes meses.');
 }catch(error){setMessage(`No se pudieron guardar los datos: ${error.message}`);}finally{setSaving(false);}}
 async function exportExcel(){if(loading||errors.length||missingProfile.length){setMessage('Completa y guarda primero los datos generales de la estación.');return;}
  setMessage('');setExporting(true);try{await downloadSustanciasExcel(model);setMessage('Excel generado. Revisa las observaciones antes de presentar la declaración.');}
  catch(error){setMessage(`No se pudo generar el Excel: ${error.message}`);}finally{setExporting(false);}}
 return <div className="sust-container">
   <section className="panel sust-panel"><div className="section-title"><div><h2>Sustancias Controladas · Primera parte</h2><p>El mismo modelo de siete hojas proporcionado por la estación, con datos mensuales obtenidos de Movimientos y Recepciones.</p></div><ShieldCheck size={26}/></div>
   <div className="sust-toolbar"><label>Mes del reporte <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button type="button" className="secondary" onClick={()=>setMonth(changeMonth(month,-1))}>Mes anterior</button><button type="button" className="secondary" onClick={()=>setMonth(boliviaCurrentMonth())}>Mes actual</button></div>
   <p className="sust-help">{model.provisional?'BORRADOR DE REVISIÓN':'PREPARADO PARA REVISIÓN'} · Incluye datos registrados hasta {report.cutoff}. El mes abierto puede descargarse y continuará actualizándose cuando ingresen nuevos datos.</p>
   {loading&&<p>Cargando movimientos…</p>}{errors.length>0&&<p className="alert error">No se puede exportar porque Firestore devolvió: {errors.join(' · ')}</p>}
   </section>
   <section className="panel sust-panel"><h3>Identificación del establecimiento · se registra una sola vez</h3><p className="muted">No se copian los datos legales de octubre del ejemplo. Gerencia los confirma para cada estación.</p>
    <form onSubmit={save} className="sust-form">{fields.map(([key,label])=><label key={key}>{label}<input value={draft[key]||''} disabled={!canManage} maxLength={key==='address'?240:150} required={key!=='telephone'} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label>)}
      {canManage&&<div><button className="primary" type="submit" disabled={saving}>{saving?'Guardando…':'Guardar datos generales'}</button></div>}</form>
    {missingProfile.length>0&&<p className="sust-help">Pendientes: {missingProfile.join(', ')}</p>}
   </section>
   <section className="panel sust-panel"><h3>Resumen automático para el formulario</h3><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Saldo anterior</th><th>Adquisiciones</th><th>Ventas/salidas</th><th>Saldo contable</th></tr></thead>
    <tbody>{['DO','GE','GE_PLUS'].map(code=>{const x=model.periods[code];return <tr key={code}><td>{code==='DO'?'Diésel Oil':code==='GE'?'Gasolina Especial':'Gasolina Especial Plus'}</td><td>{x?fnum(x.opening):'Inactivo'}</td><td>{x?fnum(x.purchases):'—'}</td><td>{x?fnum(x.out):'—'}</td><td>{x?fnum(x.closing):'—'}</td></tr>})}</tbody></table></div>
    <div className="sust-export"><button className="primary" type="button" disabled={loading||errors.length>0||exporting||missingProfile.length>0||!model.codes.length} onClick={exportExcel}><FileSpreadsheet size={18}/>{exporting?'Generando…':'Descargar Excel · Primera parte'}</button><span>Formato Excel original (.xlsx), con siete hojas.</span></div>
    {message&&<p role="status" className="sust-help">{message}</p>}
   </section>
   <section className="panel sust-panel"><h3><AlertTriangle size={18} style={{verticalAlign:'middle'}}/> Controles previos a presentación</h3>
     {model.problems.length?<ul className="sust-warnings">{model.problems.map((s,i)=><li key={i}>{s}</li>)}</ul>:<p>Sin faltantes detectados automáticamente. Validar la declaración y documentación de respaldo.</p>}
     <p className="muted">Ventas: los meters proporcionan litros diarios, no números de factura ni compradores individuales. Esos campos quedan sin inventar hasta contar con comprobantes vinculados. En tanques compartidos, el saldo por producto es contable y requiere conciliación física conjunta. La descarga es una hoja de trabajo basada en el modelo de la estación; no reemplaza aprobación ni sello de la autoridad.</p>
   </section>
 </div>;
}
