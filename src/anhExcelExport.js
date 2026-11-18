// Exportador XLSX de informes ANH/Octano: sin dependencias adicionales ni datos manuales.
import {XlsxComposer,val,formula} from './anhXlsxCore.js';
const num=x=>Number.isFinite(x)?x:null;
const date=x=>x?`${x.slice(8,10)}/${x.slice(5,7)}/${x.slice(0,4)}`:'';
const descr=x=>`${x.station.name||'Establecimiento sin identificar'} · ${x.station.city||'Localidad pendiente'}`;
const status=x=>x.provisional?'PRELIMINAR · NO PRESENTAR SIN REVISIÓN':'PARA VALIDACIÓN INTERNA';
const total=arr=>arr.reduce((n,x)=>n+(num(x)||0),0);
function addOctano(w,r,code,e){
 const cols=['FECHA','SALDO INICIAL','RECEPCIÓN','DEMASÍA','TOTAL ING.','VENTA / SALIDAS','MERMA','TOTAL SAL.','SALDO FINAL','ESTADO'];
 const rows=e.rows.map((x,i)=>{const row=i+7,valid=x.physical!==null&&x.beginning!==null;
  return [date(x.date),num(x.beginning),num(x.receipt),num(x.plus),valid?formula(`C${row}+D${row}`,x.incoming):null,num(x.sale),num(x.loss),valid?formula(`F${row}+G${row}`,x.outgoing):null,valid?formula(`B${row}+E${row}-H${row}`,x.physical):null,x.status];});
 rows.push(['TOTAL',null,e.summary.receipt,e.summary.surplus,null,e.summary.sale,e.summary.loss]);
 w.add('Octano '+code,[17,20,18,18,18,22,16,18,19,38],`OCTANO VOLÚMENES · ${e.name}`,descr(r),r.month,status(r),cols,rows);
}
function addANH(w,r,code,e){
 const cols=['FECHA','SALDO INICIAL','RECEPCIÓN','DEMASÍA','OTROS INGRESOS','TOTAL ING.','VENTA','MERMA','TOTAL SAL.','SALDO FINAL FÍSICO','U.M.','ESTADO'];
 const rows=e.rows.map(x=>[date(x.date),num(x.beginning),num(x.receipt),num(x.plus),num(x.other),num(x.incoming),num(x.sale),num(x.loss),num(x.outgoing),num(x.physical),'L',x.status]);
 rows.push(['TOTAL',null,e.summary.receipt,e.summary.surplus,null,null,e.summary.sale,e.summary.loss]);
 w.add(`${r.type==='puesto'?'Puesto':'EESS'} ${code}`,[17,18,18,18,18,18,18,18,18,21,11,36],`ANH · ${r.type==='puesto'?'PUESTO DE VENTA':'ESTACIÓN DE SERVICIO'} · ${e.name}`,descr(r),r.month,status(r),cols,rows);
}
function addGnv(w,r){if(!r.gnv)return;
 const cols=['FECHA','VENTA / METERS','CONSUMO PROPIO','CALIBRACIÓN','PREPAGO','POSTPAGO','OTROS','SIN CLASIFICAR','TOTAL SALIDAS','PRM CORREGIDO','DIF. TÉCNICA','ESTADO'];
 const rows=r.gnv.map(x=>[date(x.date),num(x.counted),num(x.consumo),num(x.calibracion),num(x.prepago),num(x.postpago),num(x.otros),num(x.sinClasificar),num(x.venta),num(x.receivedCorrected),num(x.diferencia),x.status]);
 rows.push(['TOTAL',total(r.gnv.map(x=>x.venta))]);
 w.add('ANH GNV',[17,20,18,18,18,18,18,18,19,20,19,34],'ANH · GAS NATURAL VEHICULAR EN ESTACIÓN DE SERVICIO',descr(r),r.month,status(r),cols,rows);
}
function addFamilies(w,r){const cols=['FECHA','FAMILIA','SALDO ANTERIOR','RECEPCIONES','SALIDAS','CONTABLE','FÍSICO NOCTURNO','DIFERENCIA','ESTADO'];
 const rows=[];for(const [family,list] of Object.entries(r.family)){for(const x of list){rows.push([date(x.date),family==='gasolina'?'GE + GE+':'DO + D_ULS',num(x.beginning),num(x.receipt),num(x.sale),num(x.accounting),num(x.physical),num(x.delta),x.status]);}}
 w.add('Conciliación física',[17,23,19,19,19,19,19,19,35],'CONTROL DE SALDOS FÍSICOS CONJUNTOS',descr(r),r.month,status(r),cols,rows);
}
function addInternational(w,r){if(!r.international.docs.length)return;
 const cols=['FECHA','PRODUCTO','REFERENCIA FACTURA','PLACA','NIT CLIENTE','VOLUMEN','PRECIO INTERNAC.','MONTO FACTURADO','DIFERENCIAL YPFB','IMPORTE ESTACIÓN','VALIDACIÓN'];
 const rows=r.international.docs.map(x=>[date(x.date),x.productCode,x.reference,null,null,num(x.volume),x.volume>0?Number((x.amountBs/x.volume).toFixed(3)):null,num(x.amountBs),num(x.ypfbBs),num(x.stationBs),'COMPLETAR DESDE FACTURA XML']);
 w.add('ANH Internacional',[17,19,30,16,18,17,18,18,18,19,37],'CONTROL FACTURAS A PRECIO INTERNACIONAL · PRECONCILIACIÓN',descr(r),r.month,status(r),cols,rows);
}
export function createAnhExcelBytes(report){
 const w=new XlsxComposer();const rows=[['ESTABLECIMIENTO',report.station.name||'Sin nombre'],['TIPO',report.type],['MES',report.month],['ESTADO',report.provisional?'PRELIMINAR':'PARA VALIDACIÓN'],...report.issues.map(x=>['PENDIENTE',x]),['IMPORTANTE','No es formulario oficial ANH; sin firma, código ni QR. Validar antes de presentar.']];
 w.add('CONTROL Y ALERTAS',[23,105],'PENDIENTES DEL CIERRE ANH / OCTANO',descr(report),report.month,status(report),['CONTROL','RESULTADO'],rows);
 for(const code of report.active.filter(x=>x!=='GNV')){addOctano(w,report,code,report.liquids[code]);addANH(w,report,code,report.liquids[code]);}
 addGnv(w,report);addFamilies(w,report);addInternational(w,report);return w.bytes();
}
export async function downloadAnhExcel(report){
 const data=createAnhExcelBytes(report);
 const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=`Distrigas_ANH_Octano_${String(report.station.name||'estacion').replace(/[^a-z0-9_-]/gi,'_')}_${report.month}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),40000);
}
