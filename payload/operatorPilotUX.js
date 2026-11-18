// Funciones puras de la interfaz de operadores (piloto, sin modificar Meters oficiales).
export const localDateTime=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
export const operativeDate=(d=new Date())=>localDateTime(d).slice(0,10);
const validValue = v => v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0;

// Jamás utiliza eventos futuros para completar un turno retroactivo.
export function suggestedOpening({hoseId,meterType,at,events=[],initialMeters=[]}){
 const end=String(at||'9999-12-31T23:59');
 const prior=(events||[]).filter(e=>{
   const observed=String(e.observedAt||'');
   // Con fecha sin hora se puede usar un cierre de DÍAS ANTERIORES.
   // Nunca suponer cuál fue el último cierre dentro del mismo día retroactivo.
   const dayOnly=/^\d{4}-\d{2}-\d{2}$/.test(observed);
   return e.hoseId===hoseId&&e.meterType===meterType&&
    ['final','medianoche'].includes(e.phase)&&validValue(e.reading)&&observed&&
    observed<=end&&(!dayOnly||observed<end.slice(0,10));
 })
   .sort((a,b)=>String(a.observedAt).localeCompare(String(b.observedAt))||String(a.id||'').localeCompare(String(b.id||''))).at(-1);
 if(prior)return {value:String(prior.reading),source:prior.phase==='medianoche'?'Corte anterior':'Último arqueo piloto',observedAt:prior.observedAt};
 const initial=(initialMeters||[]).find(r=>r.hoseId===hoseId)?.readings?.[meterType];
 if(validValue(initial))return {value:String(initial),source:'Dato inicial',observedAt:null};
 return {value:'',source:'Sin lectura anterior',observedAt:null};
}
const pick=(search,keys)=>{
 for(const key of keys){const v=search.get(key);if(v&&v.trim())return v.trim();}
 for(const [k,v] of search){if(keys.includes(k.toLowerCase())&&v?.trim())return v.trim();}
 return '';
};
const nitOk=v=>/^\d{5,15}$/.test(v);
const cufOk=v=>/^[a-f\d]{20,160}$/i.test(v);
const numberOk=v=>/^\d{1,18}$/.test(v);
// QR SIAT = referencia fiscal. No trae obligatoriamente cliente, litros, producto ni modalidad del vale.
export function parseInvoiceQR(text){
 const raw=String(text||'').trim();
 if(raw.length>2048)throw new Error('QR demasiado largo.');
 let nit='',cuf='',number='',origin='';
 if(raw.startsWith('{')){
   let x;try{x=JSON.parse(raw);}catch{throw new Error('El QR no contiene datos JSON válidos.');}
   nit=String(x.nitEmisor??x.nit??'');cuf=String(x.cuf??x.CUF??'');number=String(x.numeroFactura??x.numero??x.nroFactura??'');origin='Datos QR';
 }else{
   let url;try{url=new URL(raw);}catch{throw new Error('QR no reconocido: se esperaba enlace SIAT o identificadores de factura.');}
   if(!['https:','http:'].includes(url.protocol))throw new Error('Formato de QR no permitido.');
   const q=url.searchParams;
   // Formato SIN reciente (nit,cuf,numero) y antiguo var1=CUF,var2=NIT,var3=Nro.
   nit=pick(q,['nit','nitemisor','nit_emisor'])||pick(q,['var2']);
   cuf=pick(q,['cuf','cufdocumento'])||pick(q,['var1']);
   number=pick(q,['numero','numerofactura','nrofactura','nro','numero_factura'])||pick(q,['var3']);
   origin=url.hostname.toLowerCase().endsWith('impuestos.gob.bo')?'QR SIAT':'QR de proveedor';
 }
 if(!nitOk(nit)||!cufOk(cuf)||!numberOk(number))throw new Error('QR leído, pero faltan NIT, CUF o número de factura válidos.');
 return {issuerNit:nit,cuf:cuf.toUpperCase(),invoiceNumber:number,source:origin};
}
export function shiftDateChange(entry,newDate,today=operativeDate()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)||newDate>today)throw new Error('Fecha posterior a hoy no permitida.');
 if(newDate===entry.date)return entry;
 // Retroactivo: registrar solo la fecha, nunca inventar horas.
 // Al volver a hoy, el inicio se toma del reloj en ese mismo momento.
 return {...entry,date:newDate,startedAt:newDate<today?'':localDateTime(),endedAt:''};
}
