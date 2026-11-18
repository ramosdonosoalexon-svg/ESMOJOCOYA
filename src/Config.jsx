import React,{useState} from 'react';
import {Fuel,Cylinder,Gauge,Plus} from 'lucide-react';
import {createTank,createCylinder,createDispenser,createHose,updateHoseMeters,toggleProduct,productCatalog} from './data';
import {sortRegistered,colorForProduct} from './calibrationMath';
import {CalibrationManager} from './Operations';
import PriceSettings from './PriceSettings';
import InternationalPriceSettings from './InternationalPriceSettings.jsx';
const types = h => Array.isArray(h.meterTypes) && h.meterTypes.length?h.meterTypes:(h.meterType?[h.meterType]:[]);
const selection=types=>types.length===2?'ambos':types[0]||'mecanico';
const selectedTypes=v=>v==='ambos'?['mecanico','digital']:[v];
function Feedback({error,notice}){return <>{error&&<p className="alert error">{error}</p>}{notice&&<p className="alert success">{notice}</p>}</>}
export default function Config({stationId,uid,canManage,products,tanks,dispensers,hoses}){
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [tankName,setTankName]=useState(''),[tankProduct,setTankProduct]=useState(''),[capacity,setCapacity]=useState('');
  const [bank,setBank]=useState(''),[cylinderName,setCylinderName]=useState(''),[waterVolume,setWaterVolume]=useState(''),[pressure,setPressure]=useState('');
  const [dispenserName,setDispenserName]=useState('');
  const [hoseName,setHoseName]=useState(''),[hoseDispenser,setHoseDispenser]=useState(''),[hoseProduct,setHoseProduct]=useState(''),[feedTankIds,setFeedTankIds]=useState([]),[meterTypes,setMeterTypes]=useState(['mecanico','digital']);
  const enabled=products.filter(p=>p.active), orderedTanks=sortRegistered(tanks), orderedDisp=sortRegistered(dispensers), orderedHoses=sortRegistered(hoses);
  const availableTanks=orderedTanks.filter(t=>hoseProduct!=='GNV'&&t.productCode===hoseProduct);
  const maxHoses=hoses.filter(h=>h.dispenserId===hoseDispenser).length>=2;
  const run=async(fn,msg)=>{setError('');setNotice('');setBusy(true);try{await fn();setNotice(msg);}catch(e){setError(e?.message||'Error al guardar.');}finally{setBusy(false)}};
  return <div className="ops-page"><div className="section-intro"><h2>Configuración física del establecimiento</h2><p className="muted">Los equipos aparecen por orden de registro. Las gasolinas y diéseles utilizan tanques de líquidos; el GNV se configura con cilindros y mangueras propios.</p></div>
    <Feedback error={error} notice={notice}/>
    <section className="panel"><div className="section-title"><div><h2>1. Productos comercializados</h2><p>Activa los productos que operan en esta estación.</p></div></div>
      <div className="product-grid">{productCatalog.map(p=>{const active=products.find(x=>x.code===p.code)?.active;return <div className="product-option" key={p.code}><span className="ops-dot" style={{background:colorForProduct(p.code)}}/><div><b>{p.name}</b><small>{p.code.replace('_','-')} · {p.unit}</small></div><button type="button" disabled={!canManage||busy} className={`switch ${active?'on':''}`} aria-label={`${active?'Desactivar':'Activar'} ${p.name}`} onClick={()=>run(()=>toggleProduct(stationId,p,!active),`Producto ${p.name} actualizado.`)}><span/></button></div>})}</div>
    </section>
    <PriceSettings stationId={stationId} uid={uid} products={products} canManage={canManage}/>
    <InternationalPriceSettings stationId={stationId} uid={uid} products={products} canManage={canManage}/>
    <div className="two-col"><section className="panel"><div className="section-title"><h2>2. Tanques de líquidos</h2><span className="mini-count">{tanks.filter(t=>t.productCode!=='GNV').length} registrados</span></div>
      <div className="item-list">{orderedTanks.filter(t=>t.productCode!=='GNV').map(t=><div key={t.id} className="item"><span className="ops-dot" style={{background:colorForProduct(t.productCode)}}/><div><b>{t.name}</b><small>{t.productCode} · {t.capacityLiters?.toLocaleString('es-BO')} L · {t.activeCalibrationId?'Calibrado':'Sin tabla volumétrica'}</small></div></div>)}{!orderedTanks.some(t=>t.productCode!=='GNV')&&<p className="muted small">Todavía no hay tanques de líquidos.</p>}</div>
      {canManage&&<form className="mini-form" onSubmit={e=>{e.preventDefault();if(tanks.filter(t=>t.productCode===tankProduct).length>=10){setError('Máximo 10 tanques por producto.');return;}run(async()=>{await createTank(stationId,tankName,tankProduct,capacity);setTankName('');setCapacity('');},'Tanque registrado.');}}>
        <input required placeholder="Ej. Tanque 01" value={tankName} onChange={e=>setTankName(e.target.value)}/><select required value={tankProduct} onChange={e=>setTankProduct(e.target.value)}><option value="">Producto del tanque</option>{enabled.filter(p=>p.code!=='GNV').map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select><input required type="number" min="1" step="any" placeholder="Capacidad (L)" value={capacity} onChange={e=>setCapacity(e.target.value)}/><button className="secondary" disabled={busy}><Plus size={15}/> Crear tanque</button></form>}
    </section><section className="panel"><div className="section-title"><h2>3. Dispensers</h2><span className="mini-count">{dispensers.length} registrados</span></div>
      <div className="item-list">{orderedDisp.map((d,i)=><div key={d.id} className="item"><Fuel size={18}/><div><b>{i+1}. {d.name}</b><small>{hoses.filter(h=>h.dispenserId===d.id).length} manguera(s)</small></div></div>)}{!dispensers.length&&<p className="muted small">Sin dispensers.</p>}</div>
      {canManage&&<form className="mini-form" onSubmit={e=>{e.preventDefault();run(async()=>{await createDispenser(stationId,dispenserName);setDispenserName('');},'Dispenser registrado.');}}><input required placeholder="Ej. Dispenser 01" value={dispenserName} onChange={e=>setDispenserName(e.target.value)}/><button className="secondary" disabled={busy}><Plus size={15}/> Crear dispenser</button></form>}
    </section></div>
    {products.some(p=>p.code==='GNV'&&p.active)&&<section className="panel"><div className="section-title"><div><h2>Cilindros y bancos de GNV</h2><p>Registra tantos cilindros como tenga la instalación; su capacidad geométrica se expresa en litros de agua, no en m³ de gas comercializable.</p></div></div>
      <div className="item-list">{orderedTanks.filter(t=>t.productCode==='GNV').map(t=><div key={t.id} className="item"><Cylinder size={18}/><div><b>{t.name}</b><small>{t.bankName||'Sin banco'} · {t.waterCapacityLiters} L capacidad geométrica{t.maxPressureBar?` · ${t.maxPressureBar} bar nominal`:''}</small></div></div>)}{!tanks.some(t=>t.productCode==='GNV')&&<p className="muted">Sin cilindros GNV.</p>}</div>
      {canManage&&<form className="mini-form" onSubmit={e=>{e.preventDefault();run(async()=>{await createCylinder(stationId,{name:cylinderName,bankName:bank,waterCapacityLiters:waterVolume,maxPressureBar:pressure});setCylinderName('');setWaterVolume('');setPressure('');},'Cilindro de GNV registrado.');}}>
        <input required placeholder="Ej. Cilindro 01" value={cylinderName} onChange={e=>setCylinderName(e.target.value)}/><input placeholder="Banco (ej. Banco A)" value={bank} onChange={e=>setBank(e.target.value)}/><input required type="number" min="0.01" step="any" placeholder="Capacidad geométrica (L)" value={waterVolume} onChange={e=>setWaterVolume(e.target.value)}/><input type="number" min="0" step="any" placeholder="Presión nominal (bar), opcional" value={pressure} onChange={e=>setPressure(e.target.value)}/><button className="secondary" disabled={busy}>Agregar cilindro</button></form>}
    </section>}
    <section className="panel"><div className="section-title"><div><h2>4. Mangueras y alimentación</h2><p>Se ordenan por fecha de registro y, dentro de cada dispenser, por orden de creación.</p></div><span className="mini-count">{hoses.length} mangueras</span></div>
      <div className="item-list wide-list">{orderedDisp.map(d=>{const ds=orderedHoses.filter(h=>h.dispenserId===d.id);return <div className="ops-dispenser-group" key={d.id}><h3><Fuel size={15}/> {d.name} · {ds.length} manguera(s)</h3>{ds.map((h,i)=>{const code=h.productCode||tanks.find(t=>t.id===h.feedTankIds?.[0])?.productCode;
        return <div key={h.id} className="item"><span className="ops-dot" style={{background:colorForProduct(code)}}/><div><b>{i+1}. {h.name}</b><small>{code||'Producto por definir'} · {types(h).length===2?'Mecánico + digital':types(h)[0]||'Sin meter'} · {h.feedTankIds?.length?h.feedTankIds.map(id=>tanks.find(t=>t.id===id)?.name||id).join(', '):code==='GNV'?'Línea GNV':'Sin alimentación'}</small></div>
          {canManage&&<label className="meter-edit-label">Meters<select disabled={busy} value={selection(types(h))} onChange={e=>run(()=>updateHoseMeters(stationId,h.id,selectedTypes(e.target.value)),`Medidores de ${h.name} actualizados.`)}><option value="ambos">Mecánico + digital</option><option value="mecanico">Mecánico</option><option value="digital">Digital</option></select></label>}
        </div>})}{!ds.length&&<p className="small muted">Sin mangueras.</p>}</div>})}{!dispensers.length&&<p className="muted">Crea un dispenser para habilitar sus mangueras.</p>}</div>
      {canManage&&<form className="hose-form" onSubmit={e=>{e.preventDefault();if(maxHoses){setError('Máximo 2 mangueras por dispenser.');return;}run(async()=>{await createHose(stationId,{name:hoseName,dispenserId:hoseDispenser,feedTankIds:hoseProduct==='GNV'?[]:feedTankIds,meterTypes,productCode:hoseProduct});setHoseName('');setFeedTankIds([]);},'Manguera registrada.');}}>
        <label>Nombre<input required placeholder="Ej. D01-M01" value={hoseName} onChange={e=>setHoseName(e.target.value)}/></label>
        <label>Dispenser<select required value={hoseDispenser} onChange={e=>setHoseDispenser(e.target.value)}><option value="">Seleccionar dispenser</option>{orderedDisp.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Producto de la manguera<select required value={hoseProduct} onChange={e=>{setHoseProduct(e.target.value);setFeedTankIds([]);}}><option value="">Seleccionar producto</option>{enabled.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
        <label>Medidores<select value={selection(meterTypes)} onChange={e=>setMeterTypes(selectedTypes(e.target.value))}><option value="ambos">Mecánico + digital</option><option value="mecanico">Solo mecánico</option><option value="digital">Solo digital</option></select></label>
        {hoseProduct==='GNV'?<p className="form-help">El GNV se alimenta mediante la línea/banco de gas: esta manguera no requiere asociar un tanque de líquidos.</p>:<div className="tank-selector"><b>Tanques que alimentan la manguera</b><p className="form-help">Selecciona uno o varios tanques del mismo producto.</p><div className="checks">{availableTanks.map(t=><label key={t.id}><input type="checkbox" checked={feedTankIds.includes(t.id)} onChange={e=>setFeedTankIds(prev=>e.target.checked?[...prev,t.id]:prev.filter(id=>id!==t.id))}/>{t.name}</label>)}</div>{hoseProduct&&!availableTanks.length&&<p className="small muted">Todavía no hay tanques de este producto.</p>}</div>}
        <button className="primary" disabled={busy||!hoseDispenser||!hoseProduct||(hoseProduct!=='GNV'&&!feedTankIds.length)||maxHoses}><Plus size={16}/> Agregar manguera</button>
        {maxHoses&&<p className="alert error">El dispenser seleccionado ya tiene 2 mangueras.</p>}
      </form>}
    </section>
    <CalibrationManager stationId={stationId} uid={uid} tanks={tanks} canManage={canManage}/>
  </div>;
}
