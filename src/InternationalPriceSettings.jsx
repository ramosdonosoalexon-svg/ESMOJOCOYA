import React,{useMemo,useState} from 'react';
import {useDocuments} from './hooks';
import {stationPath,productCatalog} from './data';
import {effectiveInternationalRate} from './internationalPricing.js';
import {registerInternationalRate} from './internationalData.js';
import {activePriceAt} from './priceMath.js';
import './international.css';
const fmt=n=>Number(n).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:3});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function RateRow({p,entries,national,date,stationId,uid,canManage}){
 const [when,setWhen]=useState(date),[time,setTime]=useState('00:00'),[price,setPrice]=useState(''),[diff,setDiff]=useState(''),[resolution,setResolution]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const active=effectiveInternationalRate(entries,p.code,date);const domestic=activePriceAt(national,p.code,date);
 const hist=entries.filter(e=>e.productCode===p.code).sort((a,b)=>`${b.effectiveDate}T${b.effectiveTime}`.localeCompare(`${a.effectiveDate}T${a.effectiveTime}`));
 async function save(e){e.preventDefault();setMessage('');setBusy(true);try{
   await registerInternationalRate(stationId,uid,{productCode:p.code,effectiveDate:when,effectiveTime:time,
     internationalPriceBs:price,differentialBs:diff,resolutionNumber:resolution,sourceUrl:url});
   setPrice('');setDiff('');setResolution('');setUrl('');setMessage('Tarifa registrada. Las facturas y arqueos anteriores no se modificaron.');
 }catch(err){setMessage(err.message||'No se pudo guardar.');}finally{setBusy(false)}}
 return <div className="intl-rate-row">
   <div className="intl-rate-header"><strong>{p.name}</strong><small>{p.unit} · Nacional: {domestic?`Bs ${fmt(domestic.priceBs)}`:'sin configurar'} · Internacional: {active?`Bs ${fmt(active.internationalPriceBs)}`:'sin vigencia'} · Diferencial ANH: {active?`Bs ${fmt(active.differentialBs)}`:'sin vigencia'} / {p.unit}</small></div>
   {active&&domestic&&Math.abs((active.internationalPriceBs-active.differentialBs)-domestic.priceBs)>0.015&&<p className="intl-guidance">Atención: el precio internacional menos el diferencial ANH da Bs {fmt(active.internationalPriceBs-active.differentialBs)}, distinto del precio nacional configurado (Bs {fmt(domestic.priceBs)}). Comprueba la resolución y la modalidad aplicable antes de contabilizar la parte de la estación.</p>}
   {hist.length>0&&<details><summary>Resoluciones registradas ({hist.length})</summary><div className="intl-rate-history">{hist.map(r=><div key={r.id}><b>{r.effectiveDate} {r.effectiveTime}</b> · Internacional Bs {fmt(r.internationalPriceBs)} · diferencial ANH Bs {fmt(r.differentialBs)} · {r.resolutionNumber}{r.sourceUrl&&<a target="_blank" rel="noreferrer" href={r.sourceUrl}>Consultar resolución</a>}</div>)}</div></details>}
   {canManage&&<form className="intl-rate-form" onSubmit={save}>
    <label>Vigente desde<input required type="date" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    <label>Hora<input required type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
    <label>Precio internacional Bs/{p.unit}<input required type="number" step="0.001" min="0.001" max="1000" value={price} onChange={e=>setPrice(e.target.value)}/></label>
    <label>Diferencial oficial ANH Bs/{p.unit}<input required type="number" step="0.001" min="0" value={diff} onChange={e=>setDiff(e.target.value)}/></label>
    <label>Resolución ANH<input required maxLength={120} placeholder="RAR-ANH-..." value={resolution} onChange={e=>setResolution(e.target.value)}/></label>
    <label>Enlace a la resolución (opcional)<input type="url" maxLength={500} placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/></label>
    <button type="submit" className="secondary" disabled={busy}>{busy?'Guardando…':'Registrar vigencia internacional'}</button>
    {message&&<small className="intl-feedback" role="status">{message}</small>}
   </form>}
 </div>;
}
export default function InternationalPriceSettings({stationId,uid,products,canManage}){
 const {items:entries,error}=useDocuments(()=>stationPath(stationId,'internationalPriceHistory'),[stationId]);
 const {items:national}=useDocuments(()=>stationPath(stationId,'priceHistory'),[stationId]);
 const [date,setDate]=useState(today());
 const enabled=useMemo(()=>productCatalog.filter(p=>products.some(x=>x.code===p.code&&x.active)),[products]);
 return <section className="panel intl-settings">
  <div className="section-title"><div><h2>Precio internacional y diferencial ANH</h2><p>Registra el precio final internacional y el diferencial oficial por producto y fecha de vigencia. No reemplaza el precio nacional.</p></div></div>
  <label className="meter-price-date">Consultar tarifas al día <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  {error&&<p className="alert error">No se pudieron cargar los precios internacionales: {error}</p>}
  <p className="intl-guidance">El diferencial publicado en la resolución puede ser 0,00 y no debe calcularse siempre como una simple resta. Solo las facturas marcadas como venta internacional generan un importe pendiente de conciliación con YPFB. Verifica el régimen aplicable a GNV y la vigencia oficial antes de registrar.</p>
  {enabled.map(p=><RateRow key={p.code} p={p} entries={entries} national={national} date={date} stationId={stationId} uid={uid} canManage={canManage}/>)}
  {!enabled.length&&<p className="muted">Activa al menos un producto en la estación.</p>}
 </section>;
}
