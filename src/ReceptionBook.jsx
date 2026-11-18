import React,{useMemo,useRef,useState} from 'react';
import {query,where} from 'firebase/firestore';
import {Truck,Plus,AlertTriangle,Info,ChevronLeft,ChevronRight,CheckCircle2,Trash2} from 'lucide-react';
import {stationPath} from './data';
import {useDocuments} from './hooks';
import {volumeForHeight,colorForProduct,sortRegistered} from './calibrationMath';
import {addDaysISO,inventoryWindow} from './inventoryWindow';
import {calculateReception,sameFamily,familyProducts,receiptDisplayStatus,calculateMeterLine} from './receptionMath';
import {createReception,voidReception} from './receptionData';
import {productOptions} from './receptionProductOptions.js';
import {productBeforeReception} from './receptionAccounting.js';
import './reception.css';
import {isSundayISO} from './reportCalendar';

const codeName={GE:'Gasolina Especial',GE_PLUS:'Gasolina Especial Plus',DO:'Diésel Oil',D_ULS:'Diésel ULS'};
const format=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('es-BO',{maximumFractionDigits:3}):'—';
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const displayDate=date=>date?`${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`:'—';
const inputTime=value=>typeof value==='string'&&value.includes('T')?value.slice(11,16):'';
const newDraft=date=>({date,tankId:'',productCode:'',priorProductCode:'',documentNumber:'',supplier:'',cisternPlate:'',
  startedAt:'',finishedAt:'',startHeightMm:'',endHeightMm:'',documentLiters:'',otherIncomeLiters:'0',otherIncomeDocument:'',
  changeReason:'',oldProductAccountingL:'',observation:'',meterMode:'none',meterCoverageComplete:false,meterRows:[]});
const types=h=>Array.isArray(h?.meterTypes)&&h.meterTypes.length?h.meterTypes:(h?.meterType?[h.meterType]:[]);

const toDatetime=(date,time,end=false,startTime='')=>!time?'':`${end&&time<startTime?addDaysISO(date,1):date}T${time}`;

class InlineGuard extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,details){console.error('Error en libro de recepciones:',error,details);}
  render(){return this.state.error?<tr><td colSpan={17}><div className="rec-sheet-error" role="alert"><b>No se pudo mostrar esta fila.</b><p>{String(this.state.error?.message||this.state.error)}</p><button type="button" className="secondary" onClick={()=>{this.setState({error:null});this.props.onRemove?.();}}>Quitar fila de edición</button></div></td></tr>:this.props.children;}
}

function MeterInput({hose,dispenser,row,onChange}){
  if(!hose)return <p className="rec-warning">La manguera ya no está disponible. Elimina su selección.</p>;
  const shared=(hose.feedTankIds?.length||0)>1;
  const meterTypes=types(hose);
  const field=(type,key,value)=>onChange({...row,readings:{...row.readings,[type]:{...(row.readings?.[type]||{}),[key]:value}}});
  let calc=null;
  try{calc=calculateMeterLine(row);}catch{}
  return <div className="rec-meter-row">
    <div className="rec-meter-head"><b>{dispenser?.name||'Dispenser'} · {hose.name}</b><small>{shared?'Alimentación compartida':'Tanque único'}</small></div>
    <div className="rec-meter-fields">
      {meterTypes.map(type=><React.Fragment key={type}>
        <label>{type==='mecanico'?'Mecánico':'Digital'} antes<input type="number" min="0" step="any" value={row.readings?.[type]?.initial??''} onChange={e=>field(type,'initial',e.target.value)}/></label>
        <label>{type==='mecanico'?'Mecánico':'Digital'} después<input type="number" min="0" step="any" value={row.readings?.[type]?.final??''} onChange={e=>field(type,'final',e.target.value)}/></label>
      </React.Fragment>)}
      <label>Producto despachado<select value={row.productCode||''} onChange={e=>onChange({...row,productCode:e.target.value})}>{familyProducts(hose.productCode||row.productCode||'').map(code=><option key={code} value={code}>{codeName[code]}</option>)}</select></label>
      {meterTypes.length===2&&<label>Usar para el cálculo<select value={row.primary} onChange={e=>onChange({...row,primary:e.target.value})}><option value="mecanico">Mecánico</option><option value="digital">Digital</option></select></label>}
      {shared&&<label>Litros de este tanque<input type="number" min="0" step="any" value={row.allocatedLiters??''} onChange={e=>onChange({...row,allocatedLiters:e.target.value})}/></label>}
      <div className="rec-meter-out"><small>Despacho considerado</small><b>{format(calc?.allocatedLiters)} L</b>
        {calc?.meterTotals?.mecanico!==undefined&&calc?.meterTotals?.digital!==undefined&&<small>Dif. mecánico/digital: {format(calc.meterTotals.mecanico-calc.meterTotals.digital)} L</small>}</div>
    </div>
  </div>;
}

function DraftRow({rowNumber,date,product,enabledCodes,stationId,uid,tanks,hoses,dispensers,calibrations,initialTanks,initialDate,canManage,onSaved,onRemove,receptions=[],historicalLoading=false,historicalError=''}){
  const [form,setForm]=useState(()=>newDraft(date));
  const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const allLiquidTanks=useMemo(()=>sortRegistered(tanks.filter(t=>t&&t.active!==false&&t.productCode!=='GNV')),[tanks]);
  // Solo tanques activos vinculados a una familia de producto habilitada en Configuración.
  // GE y GE+ pueden usar el mismo tanque; el saldo físico sigue siendo único.
  const availableTanks=allLiquidTanks.filter(t=>
    enabledCodes.some(code=>sameFamily(t.productCode,code))&&
    (product==='todos'||sameFamily(t.productCode,product))
  );
  const tank=availableTanks.find(t=>t.id===form.tankId);
  const startTimeForBalance=inputTime(form.startedAt);
  const priorProductCode=productBeforeReception({tank,initialTanks,receptions,date,time:startTimeForBalance});
  const changingProduct=Boolean(form.productCode&&priorProductCode&&form.productCode!==priorProductCode);
  const calibration=calibrations.find(c=>c.id===tank?.activeCalibrationId);
  const before=calibration?volumeForHeight(calibration.points,form.startHeightMm):null;
  const after=calibration?volumeForHeight(calibration.points,form.endHeightMm):null;
  const hosesForTank=sortRegistered(hoses.filter(h=>h?.active!==false&&types(h).length>0&&Array.isArray(h.feedTankIds)&&h.feedTankIds.includes(form.tankId)&&sameFamily(h.productCode||tank?.productCode,tank?.productCode)));
  const coversAll=hosesForTank.length>0&&hosesForTank.every(h=>form.meterRows.some(r=>r.hoseId===h.id));
  const measuredCoverage=coversAll&&form.meterCoverageComplete;
  let calculated=null,calculationError='';
  if(before!==null&&after!==null&&form.documentLiters!==''&&form.otherIncomeLiters!==''){
    try{calculated=calculateReception({startVolumeL:before,endVolumeL:after,documentLiters:Number(form.documentLiters),
      otherIncomeLiters:Number(form.otherIncomeLiters),meterMode:form.meterMode,
      meterRows:form.meterRows,meterCoverageComplete:measuredCoverage});}
    catch(err){calculationError=err.message;}
  }
  const change=(name,value)=>setForm(f=>({...f,[name]:value}));
  const chooseTank=(id)=>{
    const selected=availableTanks.find(t=>t.id===id);
    const choices=productOptions(selected,enabledCodes);
    const previousGrade=productBeforeReception({tank:selected,initialTanks,receptions,date,time:inputTime(form.startedAt)});
    const incoming=selected&&(product!=='todos'&&choices.includes(product)
      ?product:choices.includes(selected.productCode)?selected.productCode:choices[0]);
    setExpanded(Boolean(incoming&&selected&&incoming!==previousGrade));
    setForm(f=>({...f,tankId:id,productCode:incoming||'',priorProductCode:previousGrade||'',
      startHeightMm:'',endHeightMm:'',meterRows:[],meterMode:'none',meterCoverageComplete:false,changeReason:'',oldProductAccountingL:''}));
  };
  function toggleHose(hose,checked){
    setForm(f=>({...f,meterCoverageComplete:false,meterRows:checked?[...f.meterRows,{
      hoseId:hose.id,hoseName:hose.name,dispenserName:dispensers.find(d=>d.id===hose.dispenserId)?.name||'',
      productCode:hose.productCode||tank?.productCode,primary:types(hose)[0]||'mecanico',
      shared:(hose.feedTankIds?.length||0)>1,allocatedLiters:'',
      readings:Object.fromEntries(types(hose).map(type=>[type,{initial:'',final:''}]))
    }]:f.meterRows.filter(r=>r.hoseId!==hose.id)}));
  }
  function changeHose(hoseId,row){setForm(f=>({...f,meterRows:f.meterRows.map(r=>r.hoseId===hoseId?row:r)}));}
  const disabled=!canManage||busy;
  async function save(){
    setError('');setBusy(true);
    try{
      if(!tank)throw new Error('Selecciona un tanque activo vinculado a un producto habilitado en Configuración.');
      if(!productOptions(tank,enabledCodes).includes(form.productCode))throw new Error('Activa el producto recibido en Configuración antes de registrar la descarga.');
      if(!calibration)throw new Error('Importa primero la tabla volumétrica vigente de este tanque.');
      if(!initialDate||!initialTanks.some(t=>t.tankId===tank.id||t.id===tank.id))throw new Error('Configura la fecha y el saldo inicial de este tanque en Datos iniciales.');
      if(historicalLoading||historicalError)throw new Error('No se cargó el historial de recepciones para identificar el producto anterior. '+(historicalError||'Actualiza la página.'));
      if(!calculated)throw new Error(calculationError||'Completa las alturas inicial y final y los litros documentados.');
      const startTime=inputTime(form.startedAt),endTime=inputTime(form.finishedAt);
      if(!startTime||!endTime)throw new Error('Ingresa la hora inicial y la hora final de la descarga.');
      // La referencia de Recepciones ES la medición física antes de descargar
      // (form.startHeightMm -> startVolumeL); no es el saldo de medianoche.
      // Si hay GE y GE+ en el mismo tanque, esta medida NO indica su composición.
      // No inventar un remanente contable por producto ni bloquear el guardado por ello.
      await createReception(stationId,{...form,priorProductCode,
        oldProductAccountingL:null,
        startedAt:toDatetime(date,startTime),
        finishedAt:toDatetime(date,endTime,true,startTime),meterCoverageComplete:measuredCoverage},tank,calibration,uid);
      onSaved('Descarga guardada. Puedes registrar otra en la misma fecha.');
    }catch(err){setError(err.message||String(err));}finally{setBusy(false);}
  }
  const initialValue=inputTime(form.startedAt),finalValue=inputTime(form.finishedAt);
  const selectProps={disabled};
  return <>
    <tr className="rec-sheet-entry">
      <th scope="row" className="rec-sheet-sticky"><b>{rowNumber}</b><span className="rec-sheet-unsaved">Pendiente</span></th>
      <td><select aria-label="Tanque" {...selectProps} value={form.tankId} onChange={e=>chooseTank(e.target.value)}><option value="">Elegir tanque</option>{availableTanks.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></td>
      <td><select aria-label="Producto recibido" {...selectProps} disabled={disabled||!tank} value={form.productCode} onChange={e=>{change('productCode',e.target.value);if(e.target.value!==form.priorProductCode)setExpanded(true);}}>{productOptions(tank,enabledCodes).map(p=><option key={p} value={p}>{codeName[p]}</option>)}</select></td>
      <td><input aria-label="Factura o documento" {...selectProps} value={form.documentNumber} maxLength={100} placeholder="N.º factura" onChange={e=>change('documentNumber',e.target.value)}/></td>
      <td><input aria-label="Proveedor" {...selectProps} value={form.supplier} maxLength={150} placeholder="Planta / proveedor" onChange={e=>change('supplier',e.target.value)}/></td>
      <td><input aria-label="Hora antes" {...selectProps} type="time" value={initialValue} onChange={e=>change('startedAt',`${date}T${e.target.value}`)}/></td>
      <td><input aria-label="Altura antes en milímetros" {...selectProps} type="number" min="0" step="any" value={form.startHeightMm} placeholder="mm" onChange={e=>change('startHeightMm',e.target.value)}/></td>
      <td className="rec-sheet-calculated">{format(before)}</td>
      <td><input aria-label="Hora después" {...selectProps} type="time" value={finalValue} onChange={e=>change('finishedAt',`${date}T${e.target.value}`)}/></td>
      <td><input aria-label="Altura después en milímetros" {...selectProps} type="number" min="0" step="any" value={form.endHeightMm} placeholder="mm" onChange={e=>change('endHeightMm',e.target.value)}/></td>
      <td className="rec-sheet-calculated">{format(after)}</td>
      <td><input aria-label="Litros documentados" {...selectProps} type="number" min="0" step="any" value={form.documentLiters} placeholder="Litros" onChange={e=>change('documentLiters',e.target.value)}/></td>
      <td className="rec-sheet-calculated">{calculated?.salesDuringReceptionL==null?'Sin verificar':format(calculated.salesDuringReceptionL)}</td>
      <td className="rec-sheet-calculated">{format(calculated?.physicalReceivedL)}</td>
      <td className={`rec-sheet-calculated ${calculated?.transportDifferenceL<0?'rec-negative':calculated?.transportDifferenceL>0?'rec-positive':''}`}>{format(calculated?.transportDifferenceL)}</td>
      <td><span className="rec-status tentative">{calculated?.quality==='verificable_con_meters'?'Con meters':'Provisional'}</span></td>
      <td><div className="rec-sheet-actions"><button type="button" className="secondary rec-small-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Ocultar':'Detalle'}</button><button type="button" className="primary rec-small-button" disabled={disabled||!calculated} onClick={save}>{busy?'Guardando…':'Guardar'}</button><button type="button" className="secondary rec-small-button" title="Quitar fila sin guardar" aria-label="Quitar fila sin guardar" onClick={onRemove}><Trash2 size={14}/></button></div></td>
    </tr>
    {(expanded||error||(!calibration&&form.tankId))&&<tr className="rec-sheet-detail-row"><td colSpan={17}>
      {!calibration&&form.tankId&&<p className="alert error">Falta importar la tabla volumétrica en Configuración para el tanque seleccionado.</p>}
      {error&&<p className="alert error" role="alert">{error}</p>}
      {expanded&&<div className="rec-sheet-details">
        <div className="rec-sheet-detail-head"><b>Complementos de esta descarga</b><small>Complementos opcionales; la medición antes de descargar se registra arriba</small></div>
        <div className="rec-sheet-extra-grid">
          <label>Placa cisterna<input disabled={disabled} value={form.cisternPlate} maxLength={60} onChange={e=>change('cisternPlate',e.target.value)}/></label>
          <label>Otros ingresos (L)<input disabled={disabled} type="number" min="0" step="any" value={form.otherIncomeLiters} onChange={e=>change('otherIncomeLiters',e.target.value)}/></label>
          <label>Documento de otros ingresos<input disabled={disabled} value={form.otherIncomeDocument} maxLength={100} onChange={e=>change('otherIncomeDocument',e.target.value)}/></label>
          <label>Observaciones<input disabled={disabled} value={form.observation} maxLength={1000} onChange={e=>change('observation',e.target.value)}/></label>
          <div className="rec-sheet-readonly"><small>Producto anterior detectado</small><b>{codeName[priorProductCode]||'Pendiente'}</b></div>
        </div>
        {changingProduct&&<div className="rec-sheet-transition">
          <p><AlertTriangle size={16}/> Cambio de combustible: el saldo antes de descargar es el FÍSICO medido en este momento, después de las ventas anteriores. No es el saldo inicial del día y NO se le restan de nuevo las ventas. En un tanque compartido no representa por sí solo los litros contables de GE o GE+.</p>
          <div className="rec-sheet-extra-grid">
            <div className="rec-sheet-readonly"><small>Saldo físico del tanque ANTES de descargar (L) · desde {form.startHeightMm||'—'} mm</small><b>{before===null?'Pendiente de medida':`${format(before)} L`}</b>
              <small>Lectura del tanque antes de la descarga, basada en la tabla de calibración. No es una estimación desde Datos iniciales.</small></div>
            <label>Observación o autorización (opcional)<input disabled={disabled} maxLength={700} value={form.changeReason} placeholder="Puedes dejarlo vacío" onChange={e=>change('changeReason',e.target.value)}/></label>
          </div>
        </div>}
        <label className="rec-sheet-meter-toggle"><input type="checkbox" disabled={disabled} checked={form.meterMode==='meters'} onChange={e=>setForm(f=>({...f,meterMode:e.target.checked?'meters':'none',meterRows:[],meterCoverageComplete:false}))}/> Registrar lecturas de mangueras durante la descarga (opcional)</label>
        {form.meterMode==='meters'&&<div className="rec-sheet-meter-area"><p className="rec-note">Anota lecturas antes y después. Si una manguera tiene medidor mecánico y digital, se guardan ambos, pero solo uno se usa para el despacho.</p>
          {!hosesForTank.length?<p className="rec-warning">No hay mangueras asociadas al tanque. Desmarca meters para guardar como provisional.</p>:
            <div className="rec-hose-checks">{hosesForTank.map(h=><label key={h.id}><input type="checkbox" disabled={disabled} checked={form.meterRows.some(r=>r.hoseId===h.id)} onChange={e=>toggleHose(h,e.target.checked)}/>{dispensers.find(d=>d.id===h.dispenserId)?.name||'Dispenser'} · {h.name}</label>)}</div>}
          {form.meterRows.map(r=><MeterInput key={r.hoseId} hose={hoses.find(h=>h.id===r.hoseId)} dispenser={dispensers.find(d=>d.name===r.dispenserName)} row={r} onChange={row=>changeHose(r.hoseId,row)}/>) }
          <label className="rec-sheet-meter-toggle"><input type="checkbox" disabled={disabled||!coversAll} checked={measuredCoverage} onChange={e=>change('meterCoverageComplete',e.target.checked)}/> Confirmo que todas las mangueras de este tanque y sus despachos fueron registrados.</label>
          {changingProduct&&<p className="rec-warning">Si se despacharon dos tipos de combustible en una manguera, deben existir lecturas separadas para cada producto. No repartir litros sin evidencia.</p>}
        </div>}
        {calculationError&&<p className="rec-warning">{calculationError}</p>}
        {calculated&&<p className="rec-equation">Recibido físico = saldo DESPUÉS de descargar − saldo ANTES de descargar + despachos SOLO durante la descarga − otros ingresos. Diferencia de transporte = recibido físico − litros documentados. {calculated.quality==='provisional'?'Resultado provisional: no equivale a merma definitiva.':''}</p>}
      </div>}
    </td></tr>}
  </>;
}

function SavedRow({receipt,index,canManage,onVoid}){
  const [expanded,setExpanded]=useState(false);
  return <>
    <tr className={`rec-sheet-saved ${receipt.status==='anulada'?'rec-voided':''}`}>
      <th scope="row" className="rec-sheet-sticky">{index+1} <CheckCircle2 size={14}/></th>
      <td>{receipt.tankName||'—'}</td>
      <td><span className="ops-dot" style={{background:colorForProduct(receipt.productCode)}}/> {codeName[receipt.productCode]||receipt.productCode}</td>
      <td>{receipt.documentNumber||'—'}</td><td>{receipt.supplier||'—'}</td>
      <td>{inputTime(receipt.startedAt)||'—'}</td><td>{format(receipt.startHeightMm)}</td><td>{format(receipt.startVolumeL)}</td>
      <td>{inputTime(receipt.finishedAt)||'—'}</td><td>{format(receipt.endHeightMm)}</td><td>{format(receipt.endVolumeL)}</td>
      <td>{format(receipt.documentLiters)}</td><td>{receipt.salesDuringReceptionL==null?'Sin verificar':format(receipt.salesDuringReceptionL)}</td>
      <td>{format(receipt.physicalReceivedL)}</td><td className={receipt.transportDifferenceL<0?'rec-negative':receipt.transportDifferenceL>0?'rec-positive':''}>{format(receipt.transportDifferenceL)}</td>
      <td><span className={`rec-status ${receipt.status==='vigente'&&receipt.quality==='verificable_con_meters'?'verified':'tentative'}`}>{receiptDisplayStatus(receipt)}</span></td>
      <td><div className="rec-sheet-actions"><button type="button" className="secondary rec-small-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Ocultar':'Ver'}</button>{canManage&&receipt.status==='vigente'&&<button type="button" className="secondary rec-small-button" onClick={()=>onVoid(receipt)}>Anular</button>}</div></td>
    </tr>
    {expanded&&<tr className="rec-sheet-detail-row"><td colSpan={17}><b>Detalle registrado</b><p>Placa: {receipt.cisternPlate||'—'} · Otros ingresos: {format(receipt.otherIncomeLiters)} L · Observaciones: {receipt.observation||'—'}</p>
      {receipt.priorProductCode!==receipt.productCode&&<p>Producto anterior: {codeName[receipt.priorProductCode]} · Saldo físico del tanque antes de descargar: {format(receipt.startVolumeL)} L · Observación: {receipt.changeReason||'Sin observación adjunta'}</p>}
      {(receipt.meterLines||[]).map((m,i)=><p key={`${m.hoseId}-${i}`}>{m.dispenserName} · {m.hoseName}: {format(m.allocatedLiters)} L ({m.primary}).</p>)}
    </td></tr>}
  </>;
}

export default function ReceptionBook({stationId,uid,tanks=[],dispensers=[],hoses=[],products:configuredProducts=[],canManage}){
  const [day,setDay]=useState(localDate),[product,setProduct]=useState('todos');
  const [drafts,setDrafts]=useState([1]),nextId=useRef(2);
  const [notice,setNotice]=useState(''),[error,setError]=useState('');
  const [voiding,setVoiding]=useState(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false);
  const dates=useMemo(()=>inventoryWindow(day),[day]);
  const {items:calibrations}=useDocuments(()=>stationPath(stationId,'calibrations'),[stationId]);
  const {items:settings}=useDocuments(()=>stationPath(stationId,'initialSettings'),[stationId]);
  const {items:initialTanks}=useDocuments(()=>stationPath(stationId,'initialTanks'),[stationId]);
  const {items:receipts,loading,error:loadError}=useDocuments(()=>query(stationPath(stationId,'receptions'),where('date','>=',dates[0]),where('date','<=',dates[8])),[stationId,dates[0],dates[8]]);
  const initialDate=settings.find(x=>x.id==='start')?.date;
  // Historial desde el arranque: evita calcular remanentes solo con la ventana visible de 9 días.
  const {items:historicalReceptions,loading:receptionsLoading,error:receptionsError}=useDocuments(
    ()=>query(stationPath(stationId,'receptions'),where('date','>=',initialDate),where('date','<=',day)),
    [stationId,initialDate,day]);
  // La barra nace de los productos realmente ACTIVADOS, no de toda la familia del tanque.
  const enabledCodes=useMemo(()=>configuredProducts.filter(p=>p.active===true).map(p=>p.code).filter(Boolean),[configuredProducts]);
  const active=sortRegistered(tanks.filter(t=>t?.active!==false&&t.productCode!=='GNV'&&
    enabledCodes.some(code=>sameFamily(t.productCode,code))));
  const products=enabledCodes.filter(code=>code!=='GNV'&&active.some(t=>sameFamily(t.productCode,code)));
  // Si se desactiva un producto mientras se mira la página, vuelve a "Todos" sin perder historial.
  const selectedProduct=product==='todos'||products.includes(product)?product:'todos';
  const visible=useMemo(()=>receipts.filter(r=>selectedProduct==='todos'||r.productCode===selectedProduct).sort((a,b)=>a.date.localeCompare(b.date)||String(a.startedAt).localeCompare(String(b.startedAt))),[receipts,selectedProduct]);
  const chosen=visible.filter(r=>r.date===day);
  const totals=chosen.filter(r=>r.status==='vigente');
  const documentTotal=totals.reduce((s,r)=>s+(Number(r.documentLiters)||0),0);
  const receivedTotal=totals.reduce((s,r)=>s+(Number(r.physicalReceivedL)||0),0);
  const confirmed=totals.filter(r=>r.quality==='verificable_con_meters');
  const confirmedDifference=confirmed.reduce((s,r)=>s+(Number(r.transportDifferenceL)||0),0);
  const dayIsValid=!initialDate||day>=initialDate;
  function navigate(date){if(!date)return;setDay(date);setDrafts([nextId.current++]);setNotice('');setError('');}
  function newLine(){setDrafts(ids=>ids.length>=8?ids:[...ids,nextId.current++]);}
  function removeLine(id){setDrafts(ids=>ids.length===1?[nextId.current++]:ids.filter(x=>x!==id));}
  function onSaved(message,id){setNotice(message);setError('');removeLine(id);}
  async function cancel(){setError('');setBusy(true);try{await voidReception(stationId,voiding,uid,reason);setNotice('Recepción anulada; su historial se conserva.');setVoiding(null);setReason('');}catch(e){setError(e.message||String(e));}finally{setBusy(false);}}
  const countFor=date=>visible.filter(r=>r.date===date&&r.status==='vigente').length;
  return <div className="ops-page rec-page rec-sheet-page">
    <header className="rec-sheet-title"><div><span className="ivs-overline">CONTROL OPERATIVO · RECEPCIONES</span><h2><Truck size={22}/> Libro de recepción de combustibles</h2><p>Una fila por descarga. Completa las celdas y los litros se calculan con la tabla volumétrica; registra varias descargas sin abrir formularios.</p></div></header>
    <div className="ops-product-tabs rec-sheet-products"><button type="button" className={`ops-product ${selectedProduct==='todos'?'picked':''}`} onClick={()=>setProduct('todos')}>Todos los líquidos</button>{products.map(p=><button type="button" key={p} className={`ops-product ${selectedProduct===p?'picked':''}`} style={{'--product':colorForProduct(p)}} onClick={()=>setProduct(p)}>{codeName[p]}</button>)}</div>
    <section className="panel rec-sheet-period"><div className="rec-sheet-period-top"><div><b>Fecha de registro</b><p>5 días anteriores · fecha seleccionada · 3 días siguientes. Varias descargas pueden compartir la misma fecha.</p></div><div className="rec-sheet-date-tools"><button type="button" className="secondary" aria-label="Día anterior" onClick={()=>navigate(addDaysISO(day,-1))}><ChevronLeft size={16}/></button><input type="date" aria-label="Fecha de registro" value={day} onChange={e=>navigate(e.target.value)}/><button type="button" className="secondary" aria-label="Día siguiente" onClick={()=>navigate(addDaysISO(day,1))}><ChevronRight size={16}/></button></div></div>
      <div className="rec-sheet-days">{dates.map((date,i)=><div key={date} className={`rec-sheet-day ${date===day?'active':i>5?'future':'past'} ${isSundayISO(date)?'report-sunday-day':''}`}><span>{displayDate(date)}</span><strong>{date===day?'REGISTRAR':i>5?'PRÓXIMO':'HISTORIAL'}</strong><small>{countFor(date)} recepciones</small>{isSundayISO(date)&&<em className="report-sunday-label">DOM</em>}</div>)}</div>
    </section>
    {notice&&<p className="alert success">{notice}</p>}{(error||loadError)&&<p className="alert error">{error||loadError}</p>}
    {!active.length&&<p className="alert error">Configura primero los tanques de líquidos de la estación.</p>}
    {!initialDate&&<p className="alert error">Para registrar recepciones, primero configura la fecha de inicio y los saldos en Datos iniciales.</p>}
    {!dayIsValid&&<p className="alert error">La fecha seleccionada es anterior al inicio de operaciones configurado.</p>}
    <section className="panel rec-sheet-panel"><div className="rec-sheet-panel-title"><div><h3>Descargas del {displayDate(day)}</h3><p>La diferencia se presenta como provisional cuando no se verificaron los despachos durante la descarga.</p></div><span className="rec-sheet-record-count">{totals.length} registros guardados</span></div>
      <div className="rec-sheet-scroll" role="region" aria-label="Planilla horizontal de recepciones; desliza hacia los lados" tabIndex={0}>
        <table className="rec-sheet-table"><thead>
          <tr className="rec-sheet-groups"><th colSpan={5}>IDENTIFICACIÓN</th><th colSpan={3}>ANTES DE DESCARGAR</th><th colSpan={3}>DESPUÉS DE DESCARGAR</th><th colSpan={5}>CONCILIACIÓN AUTOMÁTICA · LITROS</th><th>CONTROL</th></tr>
          <tr><th>#</th><th>Tanque</th><th>Producto recibido</th><th>N.º factura</th><th>Proveedor</th><th>Hora</th><th>Medida mm</th><th>Saldo L</th><th>Hora</th><th>Medida mm</th><th>Saldo L</th><th>Documento L</th><th>Despachos L</th><th>Recibido L</th><th>Merma / demasía L</th><th>Estado</th><th>Acciones</th></tr>
        </thead><tbody>
          {chosen.map((receipt,index)=><SavedRow key={receipt.id} receipt={receipt} index={index} canManage={canManage} onVoid={r=>{setVoiding(r);setReason('');setError('');}} />)}
          {canManage&&dayIsValid&&active.length>0&&drafts.map((id,index)=><InlineGuard key={`${day}-${id}`} onRemove={()=>removeLine(id)}><DraftRow rowNumber={chosen.length+index+1} date={day} product={selectedProduct} enabledCodes={enabledCodes} stationId={stationId} uid={uid} tanks={tanks} hoses={hoses} dispensers={dispensers} calibrations={calibrations} initialTanks={initialTanks} initialDate={initialDate} receptions={historicalReceptions} historicalLoading={receptionsLoading} historicalError={receptionsError} canManage={canManage} onSaved={message=>onSaved(message,id)} onRemove={()=>removeLine(id)}/></InlineGuard>)}
          {!chosen.length&&!canManage&&<tr><td colSpan={17} className="rec-empty">{loading?'Cargando…':'Sin recepciones guardadas para esta fecha.'}</td></tr>}
        </tbody></table>
      </div>
      {canManage&&dayIsValid&&<div className="rec-sheet-bottom"><button type="button" className="secondary" onClick={newLine}><Plus size={16}/> Agregar otra fila de descarga</button><span>Cada fila se guarda independientemente. No se borran los registros anteriores.</span></div>}
    </section>
    <section className="rec-summary"><div><small>Descargas del día</small><b>{totals.length}</b></div><div><small>Litros documentados</small><b>{format(documentTotal)} L</b></div><div><small>Volumen físico recibido*</small><b>{format(receivedTotal)} L</b></div><div><small>Diferencia verificable con meters</small><b>{format(confirmedDifference)} L</b></div></section>
    <section className="panel rec-help"><Info size={20}/><div><b>Recepciones y cambios de producto</b><p>*Los resultados sin meters completos son provisionales. Cuando se cambia de GE a GE+ o de DO a ULS, el saldo físico pertenece al tanque completo; el desglose contable por combustible se conciliará en Movimientos. No sumes metros mecánicos y digitales como despachos diferentes.</p></div></section>
    {voiding&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setVoiding(null)}}><section className="modal"><div className="modal-head"><h2>Anular recepción</h2><button className="close" type="button" onClick={()=>setVoiding(null)}>×</button></div><p>Documento {voiding.documentNumber} del {voiding.date}. La operación no se borrará; quedará marcada anulada para auditoría.</p><label>Motivo de anulación<textarea rows={3} minLength={8} required value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="alert error">{error}</p>}<div className="form-buttons"><button type="button" className="secondary" onClick={()=>setVoiding(null)}>Cancelar</button><button type="button" className="primary" disabled={busy||reason.trim().length<8} onClick={cancel}>{busy?'Anulando…':'Anular con justificación'}</button></div></section></div>}
  </div>;
}
