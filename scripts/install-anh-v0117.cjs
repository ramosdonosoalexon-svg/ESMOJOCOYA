// Instalación conservadora: modifica únicamente tres puntos de App.jsx.
// Ante un anclaje desconocido aborta sin tocar el proyecto.
const fs=require('fs'),path=require('path');const root=process.cwd(),file=path.join(root,'src','App.jsx');
let original=fs.readFileSync(file,'utf8'),s=original;
const imp="import AnhReports from './AnhReports.jsx';\n";
if(!s.includes(imp))s=imp+s;
const anchor="  {id:'movements',label:'Movimientos',icon:Table2},";
if(!s.includes("{id:'anhReports'")){
 if(!s.includes(anchor))throw Error('No encontré el menú esperado. No se modificó App.jsx.');
 s=s.replace(anchor,anchor+"\n  {id:'anhReports',label:'Reportes ANH',icon:FileText},");
}
const marker="    {tab==='movements'&&<MovementBook stationId={stationId} uid={user.uid} products={products} tanks={tanks} hoses={hoses} canManage={canManage}/>}";
if(!s.includes("{tab==='anhReports'")){
 if(!s.includes(marker))throw Error('No encontré el panel de Movimientos. No se modificó App.jsx.');
 s=s.replace(marker,marker+"\n    {tab==='anhReports'&&<AnhReports stationId={stationId} station={station}/>} ");
}
const target="<ReportPlaceholder item={reportLinks.find(item=>item.id===area)||reportLinks[0]} onBack={()=>openArea('platform')}/>";
if(!s.includes("area==='anh'?<AnhReportsAccess")){
 if(!s.includes(target))throw Error('No encontré la ruta de Reportes de la barra lateral. No se modificó App.jsx.');
 s=s.replace(target,"(area==='anh'?<AnhReportsAccess profile={profile}/>:"+target+")");
}
if(!s.includes('function AnhReportsAccess(')){
 const access=`function AnhReportsAccess({profile}){\n  const owner=profile.role==='owner';\n  const [selected,setSelected]=useState('');\n  const {items:stations,error}=useDocuments(()=>collection(db,'stations'),[owner?'owner':null]);\n  const id=owner?selected:profile.stationId;\n  const {data:station}=useStation(id);\n  return <div className="anh-access">\n    {owner&&<section className="panel"><h2>Reportes ANH por establecimiento</h2><p>Selecciona una estación o puesto de venta.</p>\n      <label>Establecimiento <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona...</option>{stations.map(x=><option key={x.id} value={x.id}>{x.name} ({x.type==='puesto'?'puesto':'estación'})</option>)}</select></label>\n      {error&&<div className="alert error">{error}</div>}</section>}\n    {id&&station&&<AnhReports stationId={id} station={station}/>}\n    {!id&&<section className="panel">Selecciona una estación o puesto para consultar y exportar los reportes.</section>}\n  </div>;\n}\n`;
 const before='export default function App(){';
 if(!s.includes(before))throw Error('No encontré el componente principal. No se modificó App.jsx.');
 s=s.replace(before,access+before);
}
if(s===original){console.log('Instalación ya aplicada. Sin cambios.');process.exit(0);}
fs.writeFileSync(file+'.respaldo-v0116',original,'utf8');fs.writeFileSync(file,s,'utf8');
console.log('Instalados accesos ANH en barra lateral y pestaña de la estación. Respaldo: src/App.jsx.respaldo-v0116');
