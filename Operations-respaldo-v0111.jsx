import React,{useMemo,useState} from 'react';
import {query,where} from 'firebase/firestore';
import {ChevronLeft,ChevronRight,RotateCcw,CalendarDays,Layers3,Droplets,Info,CheckCircle2} from 'lucide-react';
import {useDocuments} from './hooks';
import {stationPath} from './data';
import {loadVolumetricWorkbook} from './calibrationExcel';
import {volumeForHeight,colorForProduct,sortRegistered} from './calibrationMath';
import {saveCalibration,setInitialDate,saveInitialTank,saveInitialMeter,saveInitialGNVBridge,saveInventoryReading} from './operationsData';
import {addDaysISO,inventoryWindow,nextInventoryDate,productTones} from './inventoryWindow';
import {useLatestTankReadings} from './useLatestInventory';
import './inventoryVisual.css';
import {isSundayISO} from './reportCalendar';
import {GNV_BRIDGE_CHANNELS} from './gnvBridgeMath';
import {estimateTankComposition} from './mixedTankEstimate.js';
import {GAS_COLOR,isGasoline,mixAtDate} from './gasolineVisual.js';

const format = n => typeof n==='number'?n.toLocaleString('es-BO',{maximumFractionDigits:3}):'—';
const types = h => Array.isArray(h.meterTypes)?h.meterTypes:(h.meterType?[h.meterType]:[]);
const label = code => ({GE:'Gasolina Especial',GE_PLUS:'Gasolina Especial Plus',DO:'Diésel Oil',D_ULS:'Diésel ULS',GNV:'GNV'})[code]||code;
function Feedback({error,success}){return <>{error&&<p className="alert error">{error}</p>}{success&&<p className="alert success">{success}</p>}</>}
function ProductTabs({products,code,onChange,dualGas=false}){return <div className="ops-product-tabs">{products.map(p=><button type="button" key={p} className={`ops-product ${p===code?'picked':''}`} style={{'--product':dualGas&&p==='GE'?GAS_COLOR.BLEND:colorForProduct(p)}} onClick={()=>onChange(p)}>{dualGas&&p==='GE'?'Gasolinas · GE y GE+':label(p)}</button>)}</div>}

export function CalibrationManager({stationId,uid,tanks,canManage}){
  const liquidTanks=sortRegistered(tanks.filter(t=>t.productCode!=='GNV'));
  const [tankId,setTankId]=useState(''),[fileInfo,setFileInfo]=useState(null),[selectedSheet,setSelectedSheet]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const {items:calibrations}=useDocuments(()=>stationPath(stationId,'calibrations'),[stationId]);
  const activeTank=liquidTanks.find(t=>t.id===tankId);
  const sheet=fileInfo?.sheets.find(s=>s.name===selectedSheet);
  async function chooseFile(e){
    const file=e.target.files?.[0]; setError('');setMessage('');setFileInfo(null);setSelectedSheet('');if(!file)return;
    setBusy(true);
    try{
      const sheets=await loadVolumetricWorkbook(file);
      setFileInfo({name:file.name,sheets});
      setSelectedSheet(sheets.find(s=>s.points.length)?.name||sheets[0]?.name||'');
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function upload(){
    if(!activeTank || !sheet?.points?.length)return;
    setBusy(true);setError('');setMessage('');
    try{
      await saveCalibration(stationId,activeTank,sheet.points,fileInfo.name,selectedSheet,uid);
      setMessage(`Tabla registrada en ${activeTank.name}. ${sheet.points.length} alturas importadas. La versión anterior queda en el historial.`);
      setFileInfo(null);setSelectedSheet('');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="panel ops-calibration">
    <div className="section-title"><div><h2>Tablas volumétricas por tanque</h2><p>Importa Excel (.xlsx o .xlsm), selecciona la hoja del tanque y revisa las alturas en mm y volúmenes en litros antes de guardar.</p></div></div>
    <Feedback error={error} success={message}/>
    {liquidTanks.length===0?<p className="muted">Primero registra un tanque de gasolina o diésel.</p>:<>
      <div className="ops-cal-grid"><label>Tanque al que pertenece<select disabled={!canManage||busy} value={tankId} onChange={e=>{setTankId(e.target.value);setFileInfo(null);setSelectedSheet('');}}><option value="">Seleccionar tanque</option>{liquidTanks.map(t=><option key={t.id} value={t.id}>{t.name} · {label(t.productCode)}</option>)}</select></label>
      <label>Archivo Excel<input type="file" accept=".xlsx,.xlsm" disabled={!canManage||!tankId||busy} onChange={chooseFile}/></label></div>
      {fileInfo&&<div className="ops-preview"><label>Hoja del Excel<select value={selectedSheet} onChange={e=>setSelectedSheet(e.target.value)}>{fileInfo.sheets.map(s=><option key={s.name} value={s.name}>{s.name}{s.points.length?` · ${s.points.length} puntos`:' · sin tabla detectable'}</option>)}</select></label>
        {sheet?.points.length?<><p className="small">Vista previa: {sheet.points.length} mediciones · de {format(sheet.points[0].mm)} a {format(sheet.points.at(-1).mm)} mm.</p>
        <table className="ops-preview-table"><thead><tr><th>Altura (mm)</th><th>Volumen (L)</th></tr></thead><tbody>{[...sheet.points.slice(0,4),...sheet.points.slice(-2)].map((p,i)=><tr key={i}><td>{format(p.mm)}</td><td>{format(p.liters)}</td></tr>)}</tbody></table>
        <button type="button" className="primary" disabled={busy||!canManage} onClick={upload}>{busy?'Guardando…':'Guardar tabla para este tanque'}</button></>:<p className="alert error">{sheet?.error||'La hoja no contiene una tabla válida.'}</p>}
      </div>}
      <div className="ops-registered">{liquidTanks.map(t=>{const cal=calibrations.find(c=>c.id===t.activeCalibrationId);return <div className="ops-row" key={t.id}><span className="ops-dot" style={{background:colorForProduct(t.productCode)}}/><b>{t.name}</b><span className="muted">{cal?`${cal.points.length} mediciones · ${cal.sourceSheet} · ${cal.sourceFile}`:'Sin calibración cargada'}</span></div>})}</div>
    </>}
    <p className="small muted">Se guarda una copia de la tabla en Firestore; cada nueva importación crea una versión sin borrar la anterior. Si un archivo .xlsm no puede leerse, guárdalo como .xlsx desde Excel. Los archivos no se ejecutan como macros.</p>
  </section>;
}

function InitialTankRow({stationId,tank,calibration,initial,uid,canManage}){
  const [height,setHeight]=useState(''),[account,setAccount]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const volume=volumeForHeight(calibration?.points,height);
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');
    try{await saveInitialTank(stationId,tank,calibration,height,account,uid);setMessage('Datos iniciales guardados.');}catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <div className="ops-entry"><div className="ops-entry-title"><span className="ops-dot" style={{background:colorForProduct(tank.productCode)}}/><b>{tank.name}</b><span className="muted">{label(tank.productCode)}</span></div>
    {initial&&<p className="small muted">Registrado: {format(initial.heightMm)} mm = {format(initial.physicalLiters)} L físicos · {format(initial.accountingLiters)} L contables.</p>}
    {!calibration?<p className="alert error">Falta la tabla volumétrica para este tanque. Cárgala primero en Configuración.</p>:<form className="ops-fields" onSubmit={save}>
      <label>Altura inicial (mm)<input type="number" min={calibration.minMm} max={calibration.maxMm} step="any" required value={height} onChange={e=>setHeight(e.target.value)} placeholder={initial?.heightMm??'Medida física'}/></label>
      <label>Volumen físico calculado<input value={volume===null?'Fuera de rango / pendiente':`${format(volume)} L`} readOnly/></label>
      <label>Saldo contable inicial (L)<input type="number" min="0" step="any" required value={account} onChange={e=>setAccount(e.target.value)} placeholder={initial?.accountingLiters??'Cantidad contable'}/></label>
      {canManage&&<button type="submit" className="secondary" disabled={busy||volume===null}>{busy?'Guardando…':initial?'Actualizar inicial':'Guardar inicial'}</button>}
    </form>}
    <Feedback error={error} success={message}/>
  </div>;
}
function InitialHoseRow({stationId,hose,dispenser,existing,uid,canManage}){
  const enabledTypes=types(hose),[values,setValues]=useState({mecanico:'',digital:''}),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');
    try{const readings=Object.fromEntries(enabledTypes.map(type=>[type,Number(values[type])]));
      if(enabledTypes.some(type=>values[type]===''))throw new Error('Completa todas las lecturas activas.');
      await saveInitialMeter(stationId,hose,readings,uid);setMessage('Meters iniciales guardados.');
    }catch(err){setError(err.message);}finally{setBusy(false);}}
  return <div className="ops-entry"><div className="ops-entry-title"><b>{dispenser?.name||'Dispenser'} · {hose.name}</b></div>
    {existing&&<p className="small muted">Registrado: {Object.entries(existing.readings||{}).map(([k,v])=>`${k}: ${format(v)}`).join(' · ')}</p>}
    <form className="ops-fields" onSubmit={save}>{enabledTypes.map(type=><label key={type}>Meter {type} inicial<input type="number" min="0" step="any" required value={values[type]} onChange={e=>setValues({...values,[type]:e.target.value})} placeholder={existing?.readings?.[type]??'Lectura inicial'}/></label>)}
      {canManage&&<button className="secondary" disabled={busy}>{busy?'Guardando…':existing?'Actualizar lecturas':'Guardar lecturas'}</button>}
    </form><Feedback error={error} success={message}/>
  </div>;
}

function InitialGNVBridge({stationId,uid,existing,canManage}){
  const [values,setValues]=useState({manual:'',corrected:'',uncorrected:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');
    try{await saveInitialGNVBridge(stationId,values,uid);setMessage('Tres lecturas iniciales del puente guardadas.');}
    catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <section className="panel"><h2>GNV · Datos iniciales del puente de regulación</h2>
    <p className="muted">Se registran por separado los tres contadores de la matriz: meter manual, volumen corregido y no corregido. Se usarán automáticamente como apertura de GNV.</p>
    {existing&&<p className="small muted">Lecturas guardadas: {GNV_BRIDGE_CHANNELS.map(c=>`${c.label}: ${format(existing.readings?.[c.key])}`).join(' · ')}</p>}
    <form className="ops-fields" onSubmit={save}>{GNV_BRIDGE_CHANNELS.map(c=><label key={c.key}>{c.label} inicial (m³)
      <input type="number" step="0.001" min="0" required value={values[c.key]}
        placeholder={existing?.readings?.[c.key]??'Lectura inicial'}
        onChange={e=>setValues(prev=>({...prev,[c.key]:e.target.value}))}/></label>)}
      {canManage&&<button className="secondary" disabled={busy}>{busy?'Guardando…':existing?'Actualizar iniciales GNV':'Guardar iniciales GNV'}</button>}
    </form><Feedback error={error} success={message}/>
  </section>;
}

export function InitialData({stationId,uid,tanks,dispensers,hoses,canManage}){
  const {items:settings}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
  const {items:initialTanks}=useDocuments(()=>stationPath(stationId,'initialTanks'),[stationId]);
  const {items:initialMeters}=useDocuments(()=>stationPath(stationId,'initialMeters'),[stationId]);
  const {items:initialGNVBridge}=useDocuments(()=>stationPath(stationId,'initialGNVBridge'),[stationId]);
  const {items:calibrations}=useDocuments(()=>stationPath(stationId,'calibrations'),[stationId]);
  const [date,setDate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const start=settings.find(s=>s.id==='start')?.date;
  const locked=initialTanks.length>0||initialMeters.length>0||initialGNVBridge.length>0;
  const liquid=sortRegistered(tanks.filter(t=>t.productCode!=='GNV'));
  async function saveStart(e){e.preventDefault();setBusy(true);setError('');setMessage('');
    try{await setInitialDate(stationId,date);setMessage('Fecha inicial registrada.');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <div className="ops-page">
    <div className="section-intro"><h2>Datos iniciales del establecimiento</h2><p className="muted">Como en la matriz: una fecha común, medición física y saldo contable inicial de cada tanque, y lectura inicial de cada meter por manguera.</p></div>
    <section className="panel"><h2>Fecha de inicio de operaciones en el sistema</h2>{start?<p>Fecha configurada: <b>{start}</b> {locked&&<span className="muted small">(bloqueada después de cargar datos iniciales)</span>}</p>:<p className="muted">Define la fecha antes de registrar saldos iniciales.</p>}
      {canManage&&<form className="ops-fields" onSubmit={saveStart}><label>Fecha inicial<input type="date" required value={start||date} disabled={locked} onChange={e=>setDate(e.target.value)}/></label><button className="secondary" disabled={busy||locked||(!start&&!date)}>Guardar fecha</button></form>}
      <Feedback error={error} success={message}/></section>
    {!start?<div className="alert error">Primero registra la fecha inicial del establecimiento.</div>:<>
      <section className="panel"><div className="section-title"><div><h2>Saldos iniciales por tanque</h2><p>Las gasolinas y diéseles usan milímetros y tablas de calibración; nunca reemplazamos el saldo contable por el físico.</p></div></div>
        {liquid.map(t=><InitialTankRow key={t.id} stationId={stationId} tank={t} uid={uid} canManage={canManage} calibration={calibrations.find(c=>c.id===t.activeCalibrationId)} initial={initialTanks.find(x=>x.tankId===t.id)}/>)}
        {!liquid.length&&<p className="muted">Registra los tanques de líquidos desde Configuración.</p>}
        {tanks.some(t=>t.productCode==='GNV')&&<p className="small muted">Los cilindros GNV se configuran físicamente en Configuración. Sus saldos se calcularán con la medición del suministro y los meters de GNV (m³), no con la varilla de líquidos.</p>}
      </section>
      {(tanks.some(t=>t.productCode==='GNV')||hoses.some(h=>h.productCode==='GNV'))&&
        <InitialGNVBridge stationId={stationId} uid={uid} canManage={canManage}
          existing={initialGNVBridge.find(r=>r.id==='start')}/>}
      <section className="panel"><h2>Lecturas iniciales de cada manguera</h2><p className="muted">Mecánico y digital se registran por separado cuando ambos estén habilitados.</p>
        {sortRegistered(hoses).map(h=><InitialHoseRow key={h.id} stationId={stationId} hose={h} dispenser={dispensers.find(d=>d.id===h.dispenserId)} existing={initialMeters.find(m=>m.hoseId===h.id)} uid={uid} canManage={canManage}/>)}
        {!hoses.length&&<p className="muted">Registra dispensers y mangueras antes de continuar.</p>}
      </section>
    </>}
  </div>;
}


const visualFormat = n => typeof n==='number' && Number.isFinite(n)
  ? n.toLocaleString('es-BO',{maximumFractionDigits:2}) : '—';
const calendarLabel = date => new Intl.DateTimeFormat('es-BO',{
  weekday:'short',timeZone:'UTC'
}).format(new Date(`${date}T12:00:00Z`)).replace('.','').toUpperCase();
const displayDate = date => date ? date.split('-').reverse().join('/') : '—';
const localTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const clampPercent = (value,capacity) =>
  typeof value === 'number' && Number.isFinite(value) && Number(capacity)>0
    ? Math.min(100,Math.max(0,value/Number(capacity)*100)) : null;

/** Ilustración vectorial original. La superficie del líquido se anima sin imágenes externas. */
function LiquidTankArt({percentage,tone,name,mix}){
  const rawId = React.useId().replaceAll(':','');
  const maskId = `ivs-mask-${rawId}`;
  const steelId = `ivs-steel-${rawId}`;
  const fluidId = `ivs-fluid-${rawId}`;
  const blendId = `ivs-gas-blend-${rawId}`;
  const mixed=Boolean(mix&&mix.total>0);
  const top = percentage===null?184:184 - 156 * percentage/100;
  return <svg className="ivs-tank-art" viewBox="0 0 260 212" role="img"
      aria-label={`${name}: ${percentage===null?'nivel sin registrar':`llenado aproximado ${visualFormat(percentage)} por ciento`}`}>
    <defs>
      <linearGradient id={steelId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#8fa5b4"/><stop offset="10%" stopColor="#f0f6f9"/>
        <stop offset="35%" stopColor="#c6d6df"/><stop offset="65%" stopColor="#eff6f8"/>
        <stop offset="100%" stopColor="#7890a3"/>
      </linearGradient>
      <linearGradient id={blendId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={GAS_COLOR.GE}/><stop offset={`${mix?.gePct??100}%`} stopColor={GAS_COLOR.GE}/>
        <stop offset={`${mix?.gePct??100}%`} stopColor={GAS_COLOR.GE_PLUS}/><stop offset="100%" stopColor={GAS_COLOR.GE_PLUS}/>
      </linearGradient>
      <linearGradient id={fluidId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tone.shade}/><stop offset="100%" stopColor={tone.dark}/>
      </linearGradient>
      <clipPath id={maskId}><rect x="43" y="26" width="174" height="158" rx="17"/></clipPath>
    </defs>
    <ellipse cx="130" cy="199" rx="104" ry="9" fill="#293c4b" opacity=".11"/>
    <path d="M57 177h19v22H57z M184 177h19v22h-19z" fill="#778d9c"/>
    <rect x="36" y="18" width="188" height="174" rx="24" fill={`url(#${steelId})`} stroke="#7e97a5" strokeWidth="2"/>
    <rect x="43" y="26" width="174" height="158" rx="17" fill="#ecf4f8"/>
    <g clipPath={`url(#${maskId})`}>
      {percentage!==null&&percentage>0&&<>
        <rect x="43" y={top+5} width="174" height={Math.max(0,190-top)} fill={`url(#${mixed?blendId:fluidId})`}/>
        <g className="ivs-wave">
          <path d={`M-140 ${top+4} C-85 ${top-7} -45 ${top+16} 8 ${top+5} S100 ${top-7} 152 ${top+5} S246 ${top-7} 300 ${top+5} S390 ${top+16} 450 ${top+4} L450 200H-140Z`} fill={mixed?GAS_COLOR.BLEND:tone.color} opacity={mixed?'.20':'.88'}/>
        </g>
        <g className="ivs-wave ivs-wave-secondary">
          <path d={`M-140 ${top+7} C-70 ${top+25} 10 ${top-4} 78 ${top+9} S215 ${top+24} 300 ${top+9} S415 ${top+2} 460 ${top+9} L460 200H-140Z`} fill={tone.shade} opacity=".24"/>
        </g>
      </>}
      <rect x="51" y="31" width="14" height="145" rx="6" fill="#fff" opacity=".15"/>
    </g>
    <rect x="43" y="26" width="174" height="158" rx="17" fill="none" stroke="#f6fbff" strokeWidth="3"/>
    <rect x="38" y="58" width="184" height="8" rx="3" fill="#c4d3db" opacity=".6"/>
    <rect x="38" y="136" width="184" height="8" rx="3" fill="#c4d3db" opacity=".38"/>
    <rect x="29" y="88" width="12" height="33" rx="4" fill="#839eac"/>
    <rect x="219" y="87" width="11" height="34" rx="4" fill="#839eac"/>
    <rect x="114" y="7" width="32" height="12" rx="3" fill="#8ea4b1"/>
    <rect x="124" y="0" width="12" height="9" rx="2" fill="#6c8493"/>
    <rect x="93" y="148" width="74" height="25" rx="7" fill="#183647" opacity=".90"/>
    <text x="130" y="165" textAnchor="middle" fontSize="11" fontWeight="700" fill="#f7fcff">
      {percentage===null?'SIN DATO':`${Math.round(percentage)}%`}
    </text>
  </svg>;
}

/** Cilindros GNV industriales: se muestra capacidad geométrica, nunca un saldo inventado. */
function GnvCylinderArt({name}){
  const rawId=React.useId().replaceAll(':','');
  const steel=`ivs-gnv-metal-${rawId}`;
  return <svg className="ivs-cylinder-art" viewBox="0 0 260 212" role="img" aria-label={`Cilindro de gas natural: ${name}`}>
    <defs><linearGradient id={steel} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor="#173d4a"/><stop offset=".20" stopColor="#688e9e"/>
      <stop offset=".48" stopColor="#e5f1f1"/><stop offset=".75" stopColor="#76a0ab"/>
      <stop offset="1" stopColor="#1a4d59"/>
    </linearGradient></defs>
    <ellipse cx="131" cy="199" rx="91" ry="10" fill="#163f50" opacity=".12"/>
    <rect x="121" y="14" width="18" height="21" rx="3" fill="#2a6770"/>
    <path d="M130 5v11m-17-6h34" stroke="#377881" strokeWidth="5" strokeLinecap="round"/>
    <path d="M116 34V29h28v5" fill="#a9c5cc" stroke="#456e7c" strokeWidth="2"/>
    <rect x="83" y="33" width="94" height="156" rx="45" fill={`url(#${steel})`} stroke="#34606c" strokeWidth="2"/>
    <path d="M94 62Q130 32 166 62" fill="none" stroke="#eef9f7" opacity=".50" strokeWidth="3"/>
    <path d="M98 62v97" stroke="#fff" opacity=".20" strokeWidth="8" strokeLinecap="round"/>
    <rect x="84" y="96" width="92" height="17" rx="5" fill="#176d74" opacity=".93"/>
    <path d="M90 99h80" stroke="#d2eeeb" strokeWidth="2" opacity=".53"/>
    <text x="130" y="108" fill="#effdfa" fontSize="9" textAnchor="middle" fontWeight="800" letterSpacing="2">GNV</text>
    <path d="M88 158h84" stroke="#28596a" strokeWidth="7" opacity=".60"/>
    <rect x="102" y="184" width="56" height="10" rx="4" fill="#2c5862"/>
    <circle cx="184" cy="41" r="15" fill="#e8f4f5" stroke="#4b7a83" strokeWidth="3"/>
    <circle cx="184" cy="41" r="10" fill="#fafdff"/>
    <path d="M184 42l6-5" stroke="#267772" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="184" cy="42" r="2" fill="#267772"/>
    <path d="M145 25h33v3" stroke="#4a7b81" fill="none" strokeWidth="5" strokeLinecap="round"/>
  </svg>;
}

function StorageCard({tank,reading,initial,startDate,mix,dualGas=false}){
  const gas=tank.productCode==='GNV';
  const tone=productTones[tank.productCode]||productTones.GE;
  const sharedGas=dualGas&&isGasoline(tank.productCode);
  const liters=reading?.volumeLiters ?? initial?.physicalLiters;
  const percentage=gas?null:clampPercent(liters,tank.capacityLiters);
  const date=reading?.date|| (initial?startDate:null);
  return <article className={`ivs-storage-card ${gas?'ivs-gnv-card':''}`} style={{'--ivs-accent':tone.color,'--ivs-soft':tone.shade}}>
    <div className="ivs-card-top"><span className="ivs-card-type"><i/>{gas?'CILINDRO GNV':sharedGas?'GASOLINAS · TANQUE COMPARTIDO':tone.name}</span><span className="ivs-id">{tank.name}</span></div>
    <div className="ivs-art-stage">
      {gas?<GnvCylinderArt name={tank.name}/>:<LiquidTankArt name={tank.name} tone={tone} percentage={percentage} mix={sharedGas?mix:null}/>}
    </div>
    <div className="ivs-card-reading">
      {gas?<>
        <span className="ivs-reading-kicker">CAPACIDAD GEOMÉTRICA</span>
        <div className="ivs-read-big">{visualFormat(tank.waterCapacityLiters)} <small>L agua</small></div>
        <p className="ivs-card-meta">{tank.bankName||'Sin banco asignado'}{tank.maxPressureBar?` · ${visualFormat(tank.maxPressureBar)} bar nominal`:''}</p>
      </>:<>
        <span className="ivs-reading-kicker">ÚLTIMO SALDO FÍSICO</span>
        <div className="ivs-read-big">{typeof liters==='number'?visualFormat(liters):'Sin lectura'} {typeof liters==='number'&&<small>L</small>}</div>
        <div className="ivs-track"><span style={{width:`${percentage??0}%`,background:sharedGas&&mix?.total>0?`linear-gradient(90deg,${GAS_COLOR.GE} ${mix.gePct}%,${GAS_COLOR.GE_PLUS} ${mix.gePct}%)`:undefined}}/></div>
        {sharedGas&&<div className="ivs-composition">{mix?.total>0?<><span style={{color:GAS_COLOR.GE}}>GE {mix.gePct.toFixed(1)}%</span><span style={{color:GAS_COLOR.GE_PLUS}}>GE+ {mix.plusPct.toFixed(1)}%</span><small>Composición teórica al cierre, no medición química</small></>:<small>Composición estimada sin datos suficientes</small>}</div>}
        <p className="ivs-card-meta">{percentage===null?'Volumen pendiente':`${visualFormat(percentage)}% de ${visualFormat(tank.capacityLiters)} L`}</p>
        <div className="ivs-last-date">{date?`${reading?'Cierre':'Saldo inicial'}: ${displayDate(date)}`:'Sin saldo registrado'}{reading?.heightMm!==undefined?` · ${visualFormat(reading.heightMm)} mm`:''}</div>
        {typeof liters==='number'&&Number(tank.capacityLiters)>0&&liters>Number(tank.capacityLiters)&&
          <p className="ivs-card-warning">Volumen superior a la capacidad configurada: revisar datos.</p>}
      </>}
    </div>
  </article>;
}

export function InventoryBook({stationId,uid,tanks,products=[],hoses=[],canManage,role}){
  const {items:calibrations}=useDocuments(()=>stationPath(stationId,'calibrations'),[stationId]);
  const {items:starting}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
  const {items:initialTanks}=useDocuments(()=>stationPath(stationId,'initialTanks'),[stationId]);
  const startDate=starting.find(x=>x.id==='start')?.date;
  const registered=useMemo(()=>sortRegistered(tanks.filter(t=>t.active!==false)),[tanks]);
  const dualGas=products.some(p=>p.code==='GE'&&p.active!==false)&&products.some(p=>p.code==='GE_PLUS'&&p.active!==false);
  const available=useMemo(()=>[...new Set(registered.map(t=>dualGas&&isGasoline(t.productCode)?'GE':t.productCode))].sort((a,b)=>{
    const order=['GE','GE_PLUS','DO','D_ULS','GNV'];
    return (order.indexOf(a)<0?100:order.indexOf(a))-(order.indexOf(b)<0?100:order.indexOf(b));
  }),[registered,dualGas]);
  const [prod,setProd]=useState(''),[viewDate,setViewDate]=useState(null);
  const product=available.includes(prod)?prod:available[0];
  const selected=useMemo(()=>registered.filter(t=>dualGas&&product==='GE'?isGasoline(t.productCode):t.productCode===product),[registered,product,dualGas]);
  const isGas=product==='GNV';
  // Consulta eficiente: última lectura real de cada tanque, independiente de su antigüedad.
  const {items:latest,loading:latestLoading,error:latestError}=useLatestTankReadings(stationId,registered);
  const currentDate=useMemo(()=>nextInventoryDate([...latest.values()],selected,startDate,localTodayISO()),
    [latest,selected,startDate]);
  const centerDate=viewDate||currentDate;
  const dates=useMemo(()=>inventoryWindow(centerDate),[centerDate]);
  const windowStart=dates[0],windowEnd=dates[8];
  const {items:windowEntries,error:windowError}=useDocuments(()=>query(
    stationPath(stationId,'inventoryReadings'),where('date','>=',windowStart),where('date','<=',windowEnd)
  ),[stationId,windowStart,windowEnd]);
  const lookup=useMemo(()=>new Map(windowEntries.map(e=>[`${e.date}_${e.tankId}`,e])),[windowEntries]);
  // Composición visual por fecha: siempre separada del inventario físico guardado.
  const latestGasDate=[windowEnd,...[...latest.values()].map(x=>x.date).filter(Boolean)].sort().at(-1)||windowEnd;
  const {items:gasReceipts,error:gasReceiptError}=useDocuments(()=>query(
    stationPath(stationId,'receptions'),where('date','<=',latestGasDate)
  ),[stationId,latestGasDate]);
  const {items:gasMeters,error:gasMeterError}=useDocuments(()=>query(
    stationPath(stationId,'meterShifts'),where('date','<=',latestGasDate)
  ),[stationId,latestGasDate]);
  const gasModels=useMemo(()=>!dualGas?[]:estimateTankComposition({
    tanks:registered.filter(t=>isGasoline(t.productCode)),initialTanks,
    receptions:gasReceipts,meterShifts:gasMeters,hoses,fromDate:startDate,untilDate:latestGasDate
  }),[dualGas,registered,initialTanks,gasReceipts,gasMeters,hoses,startDate,latestGasDate]);
  const gasModelsById=useMemo(()=>new Map(gasModels.map(m=>[m.tankId,m])),[gasModels]);
  const getMix=(tank,date)=>dualGas&&isGasoline(tank.productCode)?mixAtDate(gasModelsById.get(tank.id),initialTanks,date):null;
  const completed=selected.filter(t=>latest.get(t.id)?.date===currentDate).length;
  const [editing,setEditing]=useState(null),[height,setHeight]=useState(''),[reason,setReason]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const cal=editing?.tank&&calibrations.find(c=>c.id===(editing.previous?.calibrationId||editing.tank.activeCalibrationId));
  const physical=volumeForHeight(cal?.points,height);
  function open(date,tank){
    const previous=lookup.get(`${date}_${tank.id}`);
    if(!previous&&date!==currentDate)return;
    if(previous&&!canManage)return;
    if(!startDate||date<startDate||!initialTanks.some(x=>x.tankId===tank.id))return;
    if(!calibrations.some(c=>c.id===(previous?.calibrationId||tank.activeCalibrationId)))return;
    setEditing({date,tank,previous});
    setHeight(previous?.heightMm===undefined?'':String(previous.heightMm));
    setReason('');setError('');setMessage('');
  }
  async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      await saveInventoryReading(stationId,{date:editing.date,tank:editing.tank,
        calibration:cal,heightMm:height,uid,existing:editing.previous,reason});
      setMessage(`Medición del ${displayDate(editing.date)} guardada. La fecha avanzará al completar los tanques.`);
      setEditing(null);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  function selectProduct(code){setProd(code);setViewDate(null);setError('');setMessage('');}
  const tone=productTones[product]||productTones.GE;
  return <div className="ops-page ivs-page">
    <div className="ivs-titlebar"><div>
      <span className="ivs-overline">CONTROL OPERATIVO · INVENTARIOS</span>
      <h2>Inventario físico nocturno</h2>
      <p className="muted">Un solo saldo físico por tanque. GE y GE+ se muestran juntos con colores negro y café; la distribución es una estimación, no sustituye la medición.</p>
    </div><div className="ivs-role-indicator"><Droplets size={18}/> Lecturas físicas en {isGas?'m³ (pendiente)':'litros'}</div></div>
    {!registered.length?<section className="panel"><p>Primero registra los tanques de líquidos o cilindros GNV en Configuración.</p></section>:<>
      <section className="ivs-visual-section">
        <div className="ivs-section-heading"><div><h3>Tanques y cilindros del establecimiento</h3>
          <p>Las existencias líquidas corresponden al último inventario físico guardado. Los cilindros GNV muestran únicamente su configuración.</p></div>
          <span className="ivs-count"><Layers3 size={15}/> {registered.filter(t=>t.productCode!=='GNV').length} tanques · {registered.filter(t=>t.productCode==='GNV').length} cilindros</span></div>
        <div className="ivs-tank-grid">{registered.map(t=><StorageCard key={t.id} tank={t} reading={latest.get(t.id)} initial={initialTanks.find(x=>x.tankId===t.id)} startDate={startDate} dualGas={dualGas} mix={getMix(t,latest.get(t.id)?.date||startDate)}/>)}</div>
        {dualGas&&<p className="ivs-family-legend"><span><i style={{background:GAS_COLOR.GE}}/>Gasolina Especial · negro</span><span><i style={{background:GAS_COLOR.GE_PLUS}}/>Gasolina Especial Plus · café</span><span><i style={{background:GAS_COLOR.BLEND}}/>Estimación de mezcla · naranja</span></p>}
      </section>
      <div className="ivs-product-line"><span className="ivs-tab-label">Producto para el registro nocturno</span><ProductTabs products={available} code={product} onChange={selectProduct} dualGas={dualGas}/></div>
      {isGas?<section className="panel ivs-gnv-explainer"><Info size={22}/><div><h3>Inventario GNV pendiente de instrumentación</h3><p>Los cilindros y bancos se muestran según su configuración. La capacidad geométrica (litros de agua) no es el saldo de gas. El registro de existencias GNV y sus unidades quedará habilitado cuando definamos el método de medición correspondiente; los meters de venta se controlarán aparte.</p></div></section>:
      <section className="panel ivs-book-panel" style={{'--ivs-accent':tone.color,'--ivs-soft':tone.shade}}>
        <div className="ivs-book-heading"><div><span className="ivs-overline">LIBRO DE INVENTARIOS · {dualGas&&product==='GE'?'GASOLINAS (GE Y GE+)':tone.name.toUpperCase()}</span>
          <h3>Registro nocturno por tanque</h3><p>Ventana de nueve fechas: cinco anteriores, una activa y tres siguientes.</p></div>
          <span className="ivs-progress">{completed} / {selected.length} tanques registrados</span>
        </div>
        {!startDate&&<p className="alert error">Primero define la fecha de inicio en Datos iniciales.</p>}
        <div className="ivs-controlbar"><div className="ivs-focused-date"><CalendarDays size={18}/>
          <div><small>Fecha para registrar</small><strong>{displayDate(currentDate)}</strong></div></div>
          <div className="ivs-navigation">
            <button className="ivs-icon-button" type="button" aria-label="Ver nueve días anteriores" onClick={()=>setViewDate(addDaysISO(centerDate,-9))}><ChevronLeft size={18}/></button>
            <label className="ivs-history-date">Consultar fecha<input type="date" value={centerDate||''} onChange={e=>setViewDate(e.target.value||null)}/></label>
            <button className="ivs-icon-button" type="button" aria-label="Ver nueve días siguientes" onClick={()=>setViewDate(addDaysISO(centerDate,9))}><ChevronRight size={18}/></button>
            {viewDate&&<button className="ivs-return" type="button" onClick={()=>setViewDate(null)}><RotateCcw size={14}/> Volver al día activo</button>}
          </div>
        </div>
        <Feedback error={latestError||windowError||gasReceiptError||gasMeterError||error} success={message}/>
        {latestLoading&&<p className="ivs-loading-notice">Consultando los últimos inventarios de cada tanque…</p>}
        <div className="ivs-ledger-scroller" role="region" aria-label="Libro de inventarios, desplazar horizontalmente para ver nueve fechas" tabIndex={0}>
          <table className="ivs-ledger"><thead><tr><th className="ivs-first-col"><span>TANQUE / MEDICIÓN</span><small>Altura mm · saldo L</small></th>
            {dates.map((date,index)=><th key={date} className={`${date===currentDate?'ivs-active-col':date>currentDate?'ivs-future-col':'ivs-past-col'} ${isSundayISO(date)?'report-sunday-column':''}`}>
              <span className="ivs-dayname">{calendarLabel(date)}</span><strong>{date.slice(8,10)}</strong><small>{date.slice(5,7)}/{date.slice(0,4)}</small>
              <em>{date===currentDate?'REGISTRAR':date>currentDate?'PRÓXIMO':index===5&&viewDate?'CONSULTA':'HISTORIAL'}</em></th>)}
          </tr></thead><tbody>{selected.map(t=>{
            const activeCal=calibrations.find(c=>c.id===t.activeCalibrationId);
            const hasInitial=initialTanks.some(x=>x.tankId===t.id);
            return <tr key={t.id}><th scope="row" className="ivs-row-label"><span className="ivs-row-indicator"/><b>{t.name}</b><small>{dualGas&&isGasoline(t.productCode)?'GE / GE+ · misma medición':tone.name}</small></th>
              {dates.map(date=>{
                const reading=lookup.get(`${date}_${t.id}`);
                const active=date===currentDate;
                const canCreate=active&&!latestLoading&&!latestError&&!!startDate&&date>=startDate&&hasInitial&&!!activeCal&&(canManage||role==='operator');
                const canCorrect=!!reading&&canManage;
                return <td key={date} className={`${active?'ivs-active-col':''} ${reading?'ivs-filled-col':''} ${isSundayISO(date)?'report-sunday-column':''}`}>
                  {reading?<button type="button" className="ivs-reading-cell" disabled={!canCorrect} onClick={()=>open(date,t)} title={canCorrect?'Corregir lectura con justificación':'Lectura guardada'}>
                    <b>{visualFormat(reading.volumeLiters)} <small>L</small></b><span>{visualFormat(reading.heightMm)} mm</span>
                    {dualGas&&isGasoline(t.productCode)&&getMix(t,date)?.total>0&&<span className="ivs-day-mix" title="Proporción teórica, no medición química"><i style={{width:`${getMix(t,date).gePct}%`,background:GAS_COLOR.GE}}/><i style={{width:`${getMix(t,date).plusPct}%`,background:GAS_COLOR.GE_PLUS}}/></span>}
                    {canCorrect&&<i>Ver / editar</i>}
                  </button>:canCreate?<button type="button" className="ivs-register-cell" onClick={()=>open(date,t)}><b>＋ Registrar</b><span>{!activeCal?'Sin tabla':'Medición nocturna'}</span></button>:
                    <span className="ivs-empty-cell">{active&&!hasInitial?'Falta inicial':active&&!activeCal?'Sin tabla':date>currentDate?'Próximo':'—'}</span>}
                </td>;
              })}
            </tr>})}
            <tr className="ivs-total-row"><th scope="row" className="ivs-row-label"><b>Total físico</b><small>{dualGas&&product==='GE'?'GE / GE+ · misma medición':tone.name}</small></th>
              {dates.map(date=>{
                const values=selected.map(t=>lookup.get(`${date}_${t.id}`));
                const total=values.length&&values.every(Boolean)?values.reduce((sum,r)=>sum+r.volumeLiters,0):null;
                return <td key={date} className={`${date===currentDate?'ivs-active-col':''} ${isSundayISO(date)?'report-sunday-column':''}`}><span>{total===null?'Pendiente':`${visualFormat(total)} L`}</span></td>;
              })}
            </tr>
          </tbody></table>
        </div>
        <div className="ivs-book-footer"><span><CheckCircle2 size={15}/> El registro se hace en milímetros y se convierte a litros con la tabla volumétrica.</span><span>Desliza horizontalmente para ver las 9 fechas.</span></div>
        <p className="ivs-rule-note">Cuando todos los tanques del producto estén registrados, la fecha activa se recorrerá automáticamente al día siguiente. Los registros anteriores permanecen visibles; solo el administrador o propietario puede corregirlos con justificación. La conciliación contable se realizará en Movimientos.</p>
      </section>}
    </>}
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}>
      <section className="modal"><div className="modal-head"><h2>Medición nocturna · {editing.tank.name}</h2><button className="close" onClick={()=>setEditing(null)}>×</button></div>
        <p className="muted">{displayDate(editing.date)} · {label(editing.tank.productCode)}</p>
        <form className="form-stack" onSubmit={save}><label>Altura medida en milímetros<input autoFocus type="number" required min={cal?.minMm} max={cal?.maxMm} step="any" value={height} onChange={e=>setHeight(e.target.value)}/></label>
          <p className="ops-computed">Saldo físico calculado: <strong>{physical===null?'Medida fuera de escala':`${visualFormat(physical)} L`}</strong></p>
          {editing.previous&&<label>Motivo de corrección<input required minLength={5} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explica por qué se corrige"/></label>}
          <Feedback error={error} success={message}/>
          <div className="form-buttons"><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" disabled={busy||physical===null}>{busy?'Guardando…':'Guardar inventario'}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
