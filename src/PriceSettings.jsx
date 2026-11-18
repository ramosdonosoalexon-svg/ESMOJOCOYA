import React,{useMemo,useState} from 'react';
import {useDocuments} from './hooks';
import {stationPath,productCatalog} from './data';
import {activePriceAt,isISODate} from './priceMath';
import {saveEffectivePrice} from './meterData';
import './meter.css';
const fmt=n=>Number(n).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:3});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function PriceRow({p,entries,date,stationId,uid,canManage}){
  const [effectiveTime,setEffectiveTime]=useState('00:00'),[effectiveDate,setEffectiveDate]=useState(date),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const price=activePriceAt(entries,p.code,date);
  const hist=entries.filter(e=>e.productCode===p.code).sort((a,b)=>`${b.effectiveDate}T${b.effectiveTime||'00:00'}`.localeCompare(`${a.effectiveDate}T${a.effectiveTime||'00:00'}`));
  const duplicate=hist.some(e=>e.effectiveDate===effectiveDate&&e.effectiveTime===effectiveTime);
  const save=async e=>{e.preventDefault();setMessage('');setBusy(true);try{
    if(!isISODate(effectiveDate))throw Error('Fecha inválida.');
    if(duplicate)throw Error('Ya hay un precio para esa fecha y hora. Selecciona una nueva fecha de vigencia.');
    await saveEffectivePrice(stationId,p.code,effectiveDate,effectiveTime,amount,uid);setAmount('');setMessage('Precio guardado; las operaciones anteriores conservan su precio original.');
  }catch(err){setMessage(err.message||'No se pudo registrar el precio.');}finally{setBusy(false);}};
  return <div className="meter-price-item"><div className="meter-price-identity"><strong>{p.name}</strong><small>{p.unit} · {price?`Precio para ${date}: Bs ${fmt(price.priceBs)} (vigente desde ${price.effectiveDate} ${price.effectiveTime||"00:00"})`:'Sin precio vigente configurado'}</small>{hist.length>0&&<details><summary>Historial de precios ({hist.length})</summary><div className="meter-price-history">{hist.map(v=><span key={v.id}>{v.effectiveDate} {v.effectiveTime||"00:00"}: Bs {fmt(v.priceBs)}</span>)}</div></details>}</div>
    {canManage&&<form onSubmit={save} className="meter-price-form"><label>Vigente desde<input type="date" value={effectiveDate} required onChange={e=>setEffectiveDate(e.target.value)}/></label><label>Hora<input type="time" value={effectiveTime} required onChange={e=>setEffectiveTime(e.target.value)}/></label><label>Precio Bs / {p.unit}<input required type="number" min="0.001" max="1000" step="0.001" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="secondary" disabled={busy||duplicate}>{busy?'Guardando…':'Guardar nuevo precio'}</button>{duplicate&&<small className="meter-price-msg">Ya existe precio para esta fecha y hora</small>}{message&&<small className="meter-price-msg">{message}</small>}</form>}
  </div>;
}
export default function PriceSettings({stationId,uid,products,canManage}){
 const {items:entries,error}=useDocuments(()=>stationPath(stationId,'priceHistory'),[stationId]);
 const [date,setDate]=useState(today());
 const enabled=useMemo(()=>productCatalog.filter(p=>products.find(x=>x.code===p.code)?.active),[products]);
 return <section className="panel"><div className="section-title"><div><h2>Precios vigentes por producto</h2><p>Se registra el precio de cada combustible en bolivianos por litro o m³. Un cambio tiene fecha de vigencia y NO cambia el valor de los arqueos anteriores.</p></div></div>
 <label className="meter-price-date">Consultar precio al día <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 {error&&<p className="alert error">{error}</p>}
 {!enabled.length&&<p className="muted">Activa los combustibles que comercializa la estación para registrar sus precios.</p>}
 {enabled.map(p=><PriceRow key={p.code} p={p} entries={entries} date={date} stationId={stationId} uid={uid} canManage={canManage}/>)}
 <p className="form-help">Al guardar un meter, el precio vigente en su fecha se copia a ese registro. La clasificación prepago y postpago describe el despacho; no significa que el dinero haya sido cobrado.</p></section>;
}
