// Exportador de la primera parte: reutiliza íntegramente el libro Excel aportado
// por la estación (hojas, impresiones, imágenes, estilos y nombres).
// No crea números de factura ni autorizaciones inexistentes.
const enc=new TextEncoder(),dec=new TextDecoder();
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const monthName=m=>['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][Number(m.slice(5))-1]||m;
const serial=date=>Math.floor((Date.parse(`${date}T00:00:00Z`)-Date.UTC(1899,11,30))/86400000);
const safeNumber=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n):null;
const colToNumber=col=>[...col].reduce((n,x)=>n*26+x.charCodeAt(0)-64,0);
const coord=(address)=>{const m=/^([A-Z]+)(\d+)$/.exec(address);return {col:m[1],row:Number(m[2])};};
const entry=(set,address,value)=>set.set(address,value);
function node(address,value,existing=''){
 const style=/\bs="(\d+)"/.exec(existing)?.[1];const s=style?` s="${style}"`:'';
 if(value===undefined||value===null||value==='')return `<c r="${address}"${s}/>`;
 const num=safeNumber(value);
 const formula=/<f(?: [^>]*)?>([\s\S]*?)<\/f>/.exec(existing);
 if(formula&&num!==null)return `<c r="${address}"${s}><f>${formula[1]}</f><v>${num}</v></c>`;
 if(typeof value==='number'&&num!==null)return `<c r="${address}"${s}><v>${num}</v></c>`;
 return `<c r="${address}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}
function shiftSaleFooter(xml,lastRow,extra){
 if(extra<=0)return xml;
 const firstFooter=lastRow+1;
 const originalRow=new RegExp(`<row\\b[^>]*\\br="${lastRow}"[^>]*>[\\s\\S]*?<\\/row>`).exec(xml)?.[0];
 if(!originalRow)throw new Error('Falta fila de ventas en la plantilla.');
 const blank=(r)=>originalRow.replace(/<row\b([^>]*)\br="\d+"([^>]*)>/,(_,a,b)=>`<row${a}r="${r}"${b}>`)
    .replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,c=>{
      const addr=/\br="([A-Z]+)\d+"/.exec(c)?.[1];const s=/\bs="(\d+)"/.exec(c)?.[1];
      return addr?`<c r="${addr}${r}"${s?` s="${s}"`:''}/>`:'';
    });
 const added=Array.from({length:extra},(_,i)=>blank(firstFooter+i)).join('');
 xml=xml.replace(/<row\b[^>]*\br="\d+"[^>]*>[\s\S]*?<\/row>/g,line=>{
   const rn=Number(/<row\b[^>]*\br="(\d+)"/.exec(line)?.[1]);
   if(!Number.isFinite(rn)||rn<firstFooter)return line;
   return line.replace(/(<row\b[^>]*\br=")(\d+)(")/,(_,a,r,b)=>a+(Number(r)+extra)+b)
     .replace(/(<c\b[^>]*\br=")([A-Z]+)(\d+)(")/g,(_,a,c,r,b)=>a+c+(Number(r)+extra)+b);
 });
 xml=xml.replace(new RegExp(`(?=<row\\b[^>]*\\br="${firstFooter+extra}")`),added);
 xml=xml.replace(/(<dimension ref="[A-Z]+\d+:[A-Z]+)(\d+)(")/,(_,a,n,b)=>a+(Number(n)+extra)+b);
 xml=xml.replace(/(<mergeCell ref=")([A-Z]+)(\d+):([A-Z]+)(\d+)(")/g,(_,a,c1,n1,c2,n2,b)=>a+c1+(Number(n1)>=firstFooter?Number(n1)+extra:n1)+':'+c2+(Number(n2)>=firstFooter?Number(n2)+extra:n2)+b);
 xml=xml.replace(new RegExp(`SUM\\(C10:C${lastRow}\\)`,'g'),`SUM(C10:C${lastRow+extra})`);
 return xml;
}
function expandAcquisitionRows(xml, first, last, count, quantityColumn){
 const extra=Math.max(0,count-(last-first+1));
 if(!extra)return {xml,extra};
 xml=shiftSaleFooter(xml,last,extra);
 const footer=last+1;
 xml=xml.replace(/<f(?: [^>]*)?>[\s\S]*?<\/f>/g,part=>{
  let updated=part.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g,(_whole,col,row)=>col+(Number(row)>=footer?Number(row)+extra:Number(row)));
  const oldRange=`SUM(${quantityColumn}${first}:${quantityColumn}${last})`;
  return updated.replace(oldRange,`SUM(${quantityColumn}${first}:${quantityColumn}${last+extra})`);
 });
 return {xml,extra};
}
function updateSheet(xml,changes){
 const grouped=new Map();for(const [address,value] of changes){const {row}=coord(address);if(!grouped.has(row))grouped.set(row,new Map());grouped.get(row).set(address,value);}
 xml=xml.replace(/<row\b[^>]*\br="\d+"[^>]*>[\s\S]*?<\/row>/g,rowXML=>{
  const row=Number(/<row\b[^>]*\br="(\d+)"/.exec(rowXML)?.[1]);const changesRow=grouped.get(row);if(!changesRow)return rowXML;
  const tag=/<row\b[^>]*>/.exec(rowXML)[0],end='</row>';let body=rowXML.slice(tag.length,-end.length);
  const cells=new Map();body=body.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,m=>{const ref=/\br="([A-Z]+\d+)"/.exec(m)?.[1];if(ref)cells.set(ref,m);return '';});
  for(const [address,value] of changesRow)cells.set(address,node(address,value,cells.get(address)||''));
  return tag+[...cells.entries()].sort(([a],[b])=>colToNumber(coord(a).col)-colToNumber(coord(b).col)).map(([,c])=>c).join('')+body+end;
 });
 return xml;
}
// ZIP/OOXML sin dependencias y sin transcodificar las imágenes EMF del modelo.
export function readStoredZip(buffer){const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map();let pos=0;
 while(pos+30<=bytes.length&&view.getUint32(pos,true)===0x04034b50){
  const flags=view.getUint16(pos+6,true),method=view.getUint16(pos+8,true),size=view.getUint32(pos+18,true),nlen=view.getUint16(pos+26,true),elen=view.getUint16(pos+28,true);
  if(method!==0||(flags&8))throw new Error('La plantilla incorporada requiere ZIP sin compresión ni descriptores.');
  const name=dec.decode(bytes.subarray(pos+30,pos+30+nlen)),start=pos+30+nlen+elen;
  files.set(name,bytes.slice(start,start+size));pos=start+size;
 }
 return files;
}
let crcTable=null;
function crc32(data){if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{let v=n;for(let i=0;i<8;i++)v=(v&1)?(0xedb88320^(v>>>1)):(v>>>1);return v>>>0;});let c=0xffffffff;for(const b of data)c=(c>>>8)^crcTable[(c^b)&255];return (c^0xffffffff)>>>0;}
function merge(parts){const sum=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(sum);let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;}
function w16(d,o,n){d.setUint16(o,n,true);}function w32(d,o,n){d.setUint32(o,n>>>0,true);}
export function writeStoredZip(files){const local=[],central=[];let offset=0;
 for(const [name,data] of files){const n=enc.encode(name),crc=crc32(data),h=new Uint8Array(30),v=new DataView(h.buffer);
  w32(v,0,0x04034b50);w16(v,4,20);w32(v,14,crc);w32(v,18,data.length);w32(v,22,data.length);w16(v,26,n.length);local.push(h,n,data);
  const c=new Uint8Array(46),cv=new DataView(c.buffer);w32(cv,0,0x02014b50);w16(cv,4,20);w16(cv,6,20);w32(cv,16,crc);w32(cv,20,data.length);w32(cv,24,data.length);w16(cv,28,n.length);w32(cv,42,offset);central.push(c,n);offset+=h.length+n.length+data.length;
 }
 const dir=merge(central),end=new Uint8Array(22),e=new DataView(end.buffer);w32(e,0,0x06054b50);w16(e,8,files.size);w16(e,10,files.size);w32(e,12,dir.length);w32(e,16,offset);return merge([...local,dir,end]);
}
const settings={
 GE:{acq:2,sales:7,acqFirst:16,acqLast:25,acqCols:['A','B','C','D','E','F'],acqTotal:26,adjust:27,total:28,period:33,periodTotal:35,prior:40,local:42,tempPlus:46,demasia:47,incomeTotal:47,output:49,loss:56,tempMinus:58,outputTotal:58,closing:59,salesLast:21,salesTotal:22,meta:{name:'D3',reg:'F3',legal:'D5',month:'F5',year:'F7',city:'D11',date:'B63'}},
 DO:{acq:3,sales:4,acqFirst:16,acqLast:42,acqCols:['B','C','D','E','F','G'],acqTotal:43,adjust:44,total:45,period:50,periodTotal:52,prior:57,local:59,tempPlus:63,demasia:64,incomeTotal:64,output:66,loss:73,tempMinus:75,outputTotal:75,closing:76,salesLast:40,salesTotal:41,meta:{name:'E3',reg:'G3',legal:'E5',month:'G5',year:'G7',city:'E11',date:'C84'}},
 GE_PLUS:{acq:6,sales:5,acqFirst:16,acqLast:37,acqCols:['A','B','C','D','E','F'],acqTotal:38,adjust:39,total:40,period:45,periodTotal:47,prior:52,local:54,tempPlus:58,demasia:59,incomeTotal:59,output:61,loss:68,tempMinus:70,outputTotal:70,closing:71,salesLast:33,salesTotal:34,meta:{name:'D3',reg:'F3',legal:'D5',month:'F5',year:'F7',city:'D11',date:'B75'}}};
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;
const presentDay=(date,city)=>`${city||'Localidad'}, ${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`;
export function createSustanciasExcelBytes(model,templateBytes){
 const files=readStoredZip(templateBytes),sheets=new Map();
 for(let j=1;j<=7;j++)sheets.set(j,new Map());
 const p=model.profile,month=monthName(model.month),year=Number(model.month.slice(0,4));
 const expandedAcquisitions={},expandedSales={};
 const summary=sheets.get(1);entry(summary,'A18','DIESEL');entry(summary,'B15',model.provisional?'PRELIMINAR · PARA REVISIÓN':'PARA REVISIÓN');entry(summary,'B6',p.registration||'');entry(summary,'B8',p.legalName||'');entry(summary,'B10',p.legalRepresentative||'');entry(summary,'B12',p.city||'');entry(summary,'F14',month);
 entry(summary,'B14',presentDay(model.cutoff,p.city));entry(summary,'C34',p.responsible||'');
 for(const [code,row] of [['DO',18],['GE',19],['GE_PLUS',20]]){
  const obj=model.periods[code];const first=obj?obj.opening:null;entry(summary,`C${row}`,first);
  entry(summary,`D${row}`,obj?r2(obj.purchases+obj.other+obj.plus):null);
  entry(summary,`E${row}`,obj?r2(obj.out+obj.loss):null);
  entry(summary,`F${row}`,obj?obj.closing:null);
 }
 for(const code of ['GE','GE_PLUS','DO']){
  const cfg=settings[code],obj=model.periods[code],m=cfg.meta,ws=sheets.get(cfg.acq),vs=sheets.get(cfg.sales);
  const key=`xl/worksheets/sheet${cfg.acq}.xml`,count=obj?.incoming.length||0;
  const {xml:expandedXml,extra:added}=expandAcquisitionRows(dec.decode(files.get(key)),cfg.acqFirst,cfg.acqLast,count,code==='DO'?'C':'B');
  files.set(key,enc.encode(expandedXml));expandedAcquisitions[code]=added;
  const mr=r=>r>cfg.acqLast?r+added:r;
  const mrAddress=addr=>addr.replace(/([A-Z]+)(\d+)/,(_,col,r)=>col+mr(Number(r)));
  for(const [cell,value] of [[m.name,p.legalName||''],[m.reg,p.registration||''],[m.legal,p.legalRepresentative||''],[m.month,month],[m.year,year],[m.city,p.city||''],[mrAddress(m.date),presentDay(model.cutoff,p.city)]])entry(ws,cell,value);
  if(code==='GE'||code==='GE_PLUS')entry(ws,`A${mr(cfg.period)}`,month);
  else entry(ws,`B${mr(cfg.period)}`,month);
  for(let row=cfg.acqFirst;row<=cfg.acqLast+added;row++){
   const rec=obj?.incoming[row-cfg.acqFirst];const [dateCol,qtyCol,unitCol,supplierCol,routeCol,authCol]=cfg.acqCols;
   entry(ws,`${dateCol}${row}`,rec?serial(rec.date):null);entry(ws,`${qtyCol}${row}`,rec?rec.volume:null);
   entry(ws,`${unitCol}${row}`,rec?'LITROS':null);entry(ws,`${supplierCol}${row}`,rec?.supplier||null);
   entry(ws,`${routeCol}${row}`,rec?.route||null);entry(ws,`${authCol}${row}`,rec?.authorization||null);
  }
  const amountCol=code==='DO'?'C':'B',otherCol=code==='DO'?'F':'E',totalCol=code==='DO'?'G':'F';
  for(const [r,v] of [[cfg.acqTotal,obj?.purchases],[cfg.adjust,obj?.other],[cfg.total,obj?r2(obj.purchases+obj.other):null],[cfg.period,obj?.out],[cfg.periodTotal,obj?.out]])entry(ws,`${amountCol}${mr(r)}`,v);
  for(const [r,v] of [[cfg.prior,obj?.opening],[cfg.incomeTotal,obj?r2(obj.purchases+obj.other+obj.plus):null],[cfg.outputTotal,obj?r2(obj.out+obj.loss):null],[cfg.closing,obj?.closing]])entry(ws,`${totalCol}${mr(r)}`,v);
  for(const [r,v] of [[cfg.local,obj?.purchases],[cfg.tempPlus,0],[cfg.demasia,obj?r2(obj.other+obj.plus):null],[cfg.output,obj?.out],[cfg.loss,obj?.loss],[cfg.tempMinus,0]])entry(ws,`${otherCol}${mr(r)}`,v);
  // Borrar ajustes de temperatura del ejemplo anterior. No se deducen de 'otros ingresos'.
  entry(ws,`${amountCol}${mr(code==='DO'?51:code==='GE'?34:46)}`,0);
  // GE+ / GE comparten físicamente el tanque: el saldo por producto es contable estimado.
  entry(vs,'C3',p.legalName||'');entry(vs,'F3',p.registration||'');entry(vs,'F5',month);entry(vs,'F7',year);
  const sales=obj?.sales||[];const lines=Math.max(cfg.salesLast-9,sales.length);const extra=lines-(cfg.salesLast-9);
  const baseTotal=cfg.salesTotal,actualTotal=baseTotal+extra;expandedSales[code]=extra;
  for(let j=0;j<lines;j++){const r=10+j,one=sales[j];entry(vs,`A${r}`,one?serial(one.date):null);entry(vs,`B${r}`,null);entry(vs,`C${r}`,one?one.amount:null);
   entry(vs,`D${r}`,one?'Litros':null);entry(vs,`E${r}`,one?'Varios':null);entry(vs,`F${r}`,null);}
  entry(vs,`C${actualTotal}`,obj?.out??null);
  const footerDate=(code==='DO'?45:code==='GE'?26:38)+extra;
  entry(vs,`B${footerDate}`,presentDay(model.cutoff,p.city));
  const original=dec.decode(files.get(`xl/worksheets/sheet${cfg.sales}.xml`));
  files.set(`xl/worksheets/sheet${cfg.sales}.xml`,enc.encode(updateSheet(shiftSaleFooter(original,cfg.salesLast,extra),vs)));
  // El resto de los metadatos del formulario se conserva de la plantilla original.
 }
 for(let j=1;j<=7;j++){
  if([4,5,7].includes(j))continue;
  const key=`xl/worksheets/sheet${j}.xml`;
  files.set(key,enc.encode(updateSheet(dec.decode(files.get(key)),sheets.get(j))));
 }
 // Actualizar referencias en RESUMEN cuando la plantilla creció en compras.
 const linked={GE:{name:'DETALLE ADQ. GE',refs:[40,47,58]},DO:{name:'DETALLE ADQ. DO',refs:[57,64,75]},GE_PLUS:{name:'DETALLE ADQ. G.E. +',refs:[52,59,70]}};
 const summaryKey='xl/worksheets/sheet1.xml';let summaryXML=dec.decode(files.get(summaryKey));
 for(const [code,extra] of Object.entries(expandedAcquisitions))if(extra){
  const {name,refs}=linked[code],col=code==='DO'?'G':'F';
  for(const row of refs)summaryXML=summaryXML.replaceAll(`'${name}'!${col}${row}`,`'${name}'!${col}${row+extra}`);
 }
 files.set(summaryKey,enc.encode(summaryXML));
 // Actualizar áreas de impresión predefinidas en adquisiciones.
 let workbookXml=dec.decode(files.get('xl/workbook.xml'));
 const area={GE:{name:'DETALLE ADQ. GE',last:64},DO:{name:'DETALLE ADQ. DO',last:87},GE_PLUS:{name:'DETALLE ADQ. G.E. +',last:76}};
 for(const [code,extra] of Object.entries(expandedAcquisitions))if(extra){
  const {name,last}=area[code],col=code==='DO'?'G':'F';
  workbookXml=workbookXml.replace(`${name}'!$A$1:$${col}$${last}`,`${name}'!$A$1:$${col}$${last+extra}`);
 }
 files.set('xl/workbook.xml',enc.encode(workbookXml));
 // Formato de impresión preparado para las siete hojas del modelo.
 for(let j=1;j<=7;j++){
  const key=`xl/worksheets/sheet${j}.xml`;let x=dec.decode(files.get(key));
  if(!x.includes('<pageSetup'))x=x.replace(/<pageMargins\b[^>]*\/>/,found=>found+'<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>');
  files.set(key,enc.encode(x));
 }
 const names=['RESUMEN','DETALLE ADQ. GE','DETALLE ADQ. DO','DETALLE CON SUS-DO',
  'DETALLE CON SUST- G.ESPECIAL +','DETALLE ADQ. G.E. +','DETALLE CON SUST- G.ESPECIA '];
 const ends=[49,64+(expandedAcquisitions.GE||0),87+(expandedAcquisitions.DO||0),
  46+(expandedSales.DO||0),40+(expandedSales.GE_PLUS||0),76+(expandedAcquisitions.GE_PLUS||0),28+(expandedSales.GE||0)];
 let wbPrint=dec.decode(files.get('xl/workbook.xml'));
 const areas=names.map((name,j)=>`<definedName name="_xlnm.Print_Area" localSheetId="${j}">'${esc(name)}'!$A$1:$${j===2?'G':'F'}$${ends[j]}</definedName>`).join('');
 if(!wbPrint.includes('<definedNames>'))wbPrint=wbPrint.replace('</workbook>',`<definedNames>${areas}</definedNames></workbook>`);
 files.set('xl/workbook.xml',enc.encode(wbPrint));
 // Forzar recálculo en Excel sin tocar las fórmulas y estilos originales.
 const wb='xl/workbook.xml';files.set(wb,enc.encode(dec.decode(files.get(wb)).replace(/<calcPr\b[^>]*\/>/g,'<calcPr calcId="191029" fullCalcOnLoad="1"/>')));
 return writeStoredZip(files);
}
export async function downloadSustanciasExcel(model){
 const response=await fetch(`${import.meta.env.BASE_URL}templates/sustancias-controladas-parte1.xlsx`);
 if(!response.ok)throw new Error('No se encontró la plantilla original de Sustancias Controladas.');
 const result=createSustanciasExcelBytes(model,await response.arrayBuffer());
 const u=URL.createObjectURL(new Blob([result],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=u;a.download=`SUSTANCIAS_PRIMERA_PARTE_${model.month}_${String(model.profile.legalName||'ESTACION').replace(/[^\w-]/g,'_').slice(0,30)}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),40000);
}
