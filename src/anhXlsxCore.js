// Generador mínimo de Excel XLSX compatible con navegadores modernos.
// OOXML + ZIP sin compresión, sin bibliotecas de terceros; no modifica datos fuente.
const encoder=new TextEncoder();
const bytes=x=>encoder.encode(x);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&apos;'}[c]));
const concat=parts=>{const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
let crcTable=null;
function crc32(a){if(!crcTable){crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);return c>>>0;});}let crc=0xffffffff;for(const x of a)crc=crcTable[(crc^x)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const w16=(d,o,v)=>d.setUint16(o,v,true),w32=(d,o,v)=>d.setUint32(o,v>>>0,true);
function zip(files){const locals=[],central=[];let offset=0;
 for(const [filename,content] of Object.entries(files)){const name=bytes(filename),data=bytes(content),checksum=crc32(data);
  const lh=new Uint8Array(30);const l=new DataView(lh.buffer);w32(l,0,0x04034b50);w16(l,4,20);w32(l,14,checksum);w32(l,18,data.length);w32(l,22,data.length);w16(l,26,name.length);locals.push(lh,name,data);
  const ch=new Uint8Array(46);const c=new DataView(ch.buffer);w32(c,0,0x02014b50);w16(c,4,20);w16(c,6,20);w32(c,16,checksum);w32(c,20,data.length);w32(c,24,data.length);w16(c,28,name.length);w32(c,42,offset);central.push(ch,name);offset+=lh.length+name.length+data.length;
 }
 const table=concat(central),end=new Uint8Array(22),e=new DataView(end.buffer);
 w32(e,0,0x06054b50);w16(e,8,Object.keys(files).length);w16(e,10,Object.keys(files).length);w32(e,12,table.length);w32(e,16,offset);
 return concat([...locals,table,end]);}
const colLabel=i=>{let s='';for(let x=i+1;x;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s;};
const val=(v,style)=>({v,style});
const formula=(f,result,style)=>({formula:f,result,style});
const styleBy=(r,c,v)=>v?.style??(r===6?1:r===1?5:r===2?2:r===4?4:typeof v?.v==='number'?3:0);
function cellXml(col,row,input){if(input===null||input===undefined)return '';
 const o=(typeof input==='object'&&('v' in input||'formula' in input))?input:{v:input};const s=styleBy(row,col,o),ref=`${colLabel(col-1)}${row}`;
 if(o.formula){return `<c r="${ref}" s="${s}"><f>${esc(o.formula.replace(/^=/,''))}</f>${Number.isFinite(o.result)?`<v>${o.result}</v>`:''}</c>`;}
 if(o.v===null||o.v===undefined)return '';
 if(typeof o.v==='number'&&Number.isFinite(o.v))return `<c r="${ref}" s="${s}"><v>${o.v}</v></c>`;
 const text=String(o.v);return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}
function worksheetXml(sheet){const count=sheet.widths.length;
 const cols=`<cols>${sheet.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
 const rows=[...sheet.rows.entries()].sort(([a],[b])=>a-b).map(([r,cells])=>`<row r="${r}"${[1,2,6].includes(r)?' ht="27" customHeight="1"':''}>${cells.map((v,i)=>cellXml(i+1,r,v)).join('')}</row>`).join('');
 const merge=`<mergeCells count="4"><mergeCell ref="A1:${colLabel(count-1)}1"/><mergeCell ref="A2:${colLabel(count-1)}2"/><mergeCell ref="A3:${colLabel(count-1)}3"/><mergeCell ref="A4:${colLabel(count-1)}4"/></mergeCells>`;
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView tabSelected="0" workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${rows}</sheetData>${merge}<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red](#,##0.00);0.00"/></numFmts><fonts count="4"><font><sz val="10"/><color rgb="FF1E4050"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF1E4050"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFAD322F"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF246840"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
export class XlsxComposer{
 constructor(){this.sheets=[];}
 add(name,widths,title,subtitle,period,status,header,rows){const sheet={name:name.slice(0,31).replace(/[\\/?*\[\]:]/g,'_'),widths,rows:new Map()};const put=(r,x)=>sheet.rows.set(r,x);
  const span=t=>[val(t)];put(1,span('DISTRIGAS LÍQUIDOS  |  PRECONCILIACIÓN ANH / OCTANO'));put(2,span(title));put(3,span(`${subtitle} · ${period}`));put(4,[val(status,4)]);
  put(6,header.map(x=>val(x,1)));rows.forEach((a,i)=>put(i+7,a));this.sheets.push(sheet);return sheet;
 }
 bytes(){const files={};let rels='',list='',contentTypes='';this.sheets.forEach((s,i)=>{const j=i+1;list+=`<sheet name="${esc(s.name)}" sheetId="${j}" r:id="rId${j}"/>`;rels+=`<Relationship Id="rId${j}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${j}.xml"/>`;contentTypes+=`<Override PartName="/xl/worksheets/sheet${j}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;files[`xl/worksheets/sheet${j}.xml`]=worksheetXml(s);});
  const n=this.sheets.length;rels+=`<Relationship Id="rId${n+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  files['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentTypes}</Types>`;
  files['_rels/.rels']=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  files['xl/_rels/workbook.xml.rels']=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
  files['xl/styles.xml']=styles;
  return zip(files);
 }
}
export {val,formula};
