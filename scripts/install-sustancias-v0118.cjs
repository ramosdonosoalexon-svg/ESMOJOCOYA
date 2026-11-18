const fs=require('fs');
const path=require('path');
const target=path.join(process.cwd(),'src','App.jsx');
if(!fs.existsSync(target))throw new Error('No se encontró src/App.jsx. Abre la carpeta del proyecto.');
let s=fs.readFileSync(target,'utf8');
if(s.includes('SustanciasReportsAccess(')&&s.includes("tab==='sustanciasReports'")){
 console.log('Sustancias Controladas v0.11.8 ya integrado.');process.exit(0);
}
const edits=[
 ["import AnhReports from './AnhReports.jsx';","import AnhReports from './AnhReports.jsx';\nimport SustanciasReports from './SustanciasReports.jsx';"],
 ['function AnhReportsAccess({profile}){',`function SustanciasReportsAccess({profile,user}){
  const owner=profile.role==='owner';
  const [selected,setSelected]=useState('');
  const {items:stations,error}=useDocuments(()=>collection(db,'stations'),[owner?'owner':null]);
  const id=owner?selected:profile.stationId;
  const {data:station}=useStation(id);
  return <div className="anh-access">
    {owner&&<section className="panel"><h2>Sustancias Controladas · Establecimiento</h2><label>Estación <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona...</option>{stations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{error&&<div className="alert error">{error}</div>}</section>}
    {id&&station&&<SustanciasReports stationId={id} station={station} uid={user.uid} canManage={owner||profile.role==='admin'}/>}
    {!id&&<section className="panel">Selecciona una estación o puesto para generar su informe.</section>}
  </div>;
}
function AnhReportsAccess({profile}){`],
 ["(area==='anh'?<AnhReportsAccess profile={profile}/>:<ReportPlaceholder item={reportLinks.find(item=>item.id===area)||reportLinks[0]} onBack={()=>openArea('platform')}/>)", "(area==='anh'?<AnhReportsAccess profile={profile}/>:area==='sustancias'?<SustanciasReportsAccess profile={profile} user={user}/>:<ReportPlaceholder item={reportLinks.find(item=>item.id===area)||reportLinks[0]} onBack={()=>openArea('platform')}/>)"],
 ["  {id:'anhReports',label:'Reportes ANH',icon:FileText},", "  {id:'anhReports',label:'Reportes ANH',icon:FileText},\n  {id:'sustanciasReports',label:'Sustancias Controladas',icon:ShieldCheck},"],
 ["    {tab==='anhReports'&&<AnhReports stationId={stationId} station={station}/>} ", "    {tab==='anhReports'&&<AnhReports stationId={stationId} station={station}/>} \n    {tab==='sustanciasReports'&&<SustanciasReports stationId={stationId} station={station} uid={user.uid} canManage={canManage}/>} "]
];
for(const [before] of edits)if(!s.includes(before))throw new Error('La aplicación local tiene una estructura diferente. No se ha modificado App.jsx; envíanos la versión local para adaptar el parche. Falta: '+before.slice(0,95));
for(const [before,after] of edits)s=s.replace(before,after);
fs.copyFileSync(target,target+'.backup-before-sustancias-v0118');
fs.writeFileSync(target,s,'utf8');
console.log('Menú y acceso por estación integrados, con respaldo de App.jsx.');
