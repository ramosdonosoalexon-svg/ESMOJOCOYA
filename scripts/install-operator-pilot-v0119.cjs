// Instalador conservador del módulo Arqueos Operadores v0.11.9.
// No modifica Meters, Movimientos ni datos de Firebase.
const fs=require('fs'),path=require('path');
const file=path.join(process.cwd(),'src','App.jsx');
if(!fs.existsSync(file))throw Error('No se encontró src/App.jsx. Abre la carpeta del proyecto.');
const original=fs.readFileSync(file,'utf8');let text=original;
const hasPilot=text.includes("tab==='operatorPilot'")&&text.includes("profile.role==='operator')return <OperatorPilot");
if(!hasPilot){
 const edits=[
  ["import MeterBook from './MeterBook';",`import MeterBook from './MeterBook';
import OperatorPilot from './OperatorPilot.jsx';
import {resolveLegacyHoses} from './hoseCompat';`],
  ["  {id:'movements',label:'Movimientos',icon:Table2},",`  {id:'movements',label:'Movimientos',icon:Table2},
  {id:'operatorPilot',label:'Arqueos operadores · pruebas',icon:ClipboardCheck},`],
  ["    {tab==='movements'&&<MovementBook stationId={stationId} uid={user.uid} products={products} tanks={tanks} hoses={hoses} canManage={canManage}/>} ".trim(), `    {tab==='movements'&&<MovementBook stationId={stationId} uid={user.uid} products={products} tanks={tanks} hoses={hoses} canManage={canManage}/>}
    {tab==='operatorPilot'&&<OperatorPilot stationId={stationId} stationName={station.name} uid={user.uid} profile={{...profile,email:user.email}} canManage={canManage} hoses={resolveLegacyHoses(hoses,tanks)}/>} `],
  ["  if(!station)return <Alert>La estación no existe o no tienes acceso. Si el problema persiste revisa tus permisos.</Alert>;",`  if(!station)return <Alert>La estación no existe o no tienes acceso. Si el problema persiste revisa tus permisos.</Alert>;
  if(profile.role==='operator')return <OperatorPilot stationId={stationId} stationName={station.name} uid={user.uid} profile={{...profile,email:user.email}} canManage={false} hoses={resolveLegacyHoses(hoses.length?hoses:cachedOperatorHoses(stationId),tanks)}/>;`],
  ["function StationDashboard({stationId,profile,user,onBack}){",`function cachedOperatorHoses(stationId){try{return JSON.parse(localStorage.getItem('pilot-hoses-cache:'+stationId)||'[]');}catch{return [];}}
function StationDashboard({stationId,profile,user,onBack}){`],
  ["  const {items:hoses}=useDocuments(()=>stationPath(stationId,'hoses'),[stationId]);",`  const {items:hoses}=useDocuments(()=>stationPath(stationId,'hoses'),[stationId]);
  useEffect(()=>{if(hoses.length)localStorage.setItem('pilot-hoses-cache:'+stationId,JSON.stringify(hoses));},[stationId,hoses]);`],
  ["  useEffect(()=>{if(!id)return;setLoading(true);return onSnapshot(doc(db,'stations',id),snap=>{setData(snap.exists()?{id:snap.id,...snap.data()}:null);setLoading(false);},()=>setLoading(false));},[id]);",`  useEffect(()=>{if(!id)return;const key='pilot-station-cache:'+id;let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||'null');}catch{}setData(cached);setLoading(!cached);return onSnapshot(doc(db,'stations',id),snap=>{const station=snap.exists()?{id:snap.id,...snap.data()}:null;setData(station||cached);if(station)localStorage.setItem(key,JSON.stringify(station));setLoading(false);},()=>{setData(old=>old||cached);setLoading(false);});},[id]);`],
  ["    return onSnapshot(doc(db,'users',user.uid),snap=>setProfile(snap.exists()?snap.data():null),()=>setProfile(null));",`    const key='pilot-profile-cache:'+user.uid;let cached=null;try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x?.role==='operator')cached=x;}catch{}
    setProfile(cached||undefined);
    return onSnapshot(doc(db,'users',user.uid),snap=>{const value=snap.exists()?snap.data():null;setProfile(value);if(value?.role==='operator')localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);},()=>setProfile(cached));`],
 ];
 for(const [from] of edits)if(!text.includes(from))throw Error('Estructura de App.jsx distinta a la versión prevista. No se modificó nada; falta '+from.slice(0,130));
 for(const [from,to] of edits)text=text.replace(from,to);
 fs.copyFileSync(file,file+'.backup-before-operator-pilot-v0119');fs.writeFileSync(file,text,'utf8');
 console.log('Pestaña de pruebas y acceso de operadores instalados. Respaldo creado.');
}else console.log('Acceso a operadores ya instalado; no se duplica.');
const html=path.join(process.cwd(),'index.html');
if(fs.existsSync(html)){const src=fs.readFileSync(html,'utf8');if(!src.includes('operator-manifest.webmanifest')){
 if(!src.includes('</head>'))throw Error('index.html no contiene </head>.');
 fs.copyFileSync(html,html+'.backup-before-operator-pilot-v0119');
 fs.writeFileSync(html,src.replace('</head>','<link rel="manifest" href="/operator-manifest.webmanifest"/></head>'));
}}
