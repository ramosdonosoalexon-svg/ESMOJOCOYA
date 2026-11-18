'use strict';
// DISTRIGAS LIQUIDOS v0.11.9d — ajuste de navegacion y visibilidad por rol.
// Conservador: modifica exclusivamente src/App.jsx; no toca Firebase ni libros.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(process.cwd(), 'src', 'App.jsx');
if (!fs.existsSync(target)) throw new Error('No se encontro src/App.jsx. Abre la carpeta raiz del proyecto.');
const original = fs.readFileSync(target, 'utf8');
const marker = 'V0119D: menu lateral y permisos de reportes';
if (original.includes(marker)) {
  console.log('v0.11.9d ya aplicada; ningun archivo modificado.');
  process.exit(0);
}
let s = original;
function once(before, after, name){
  const occurrences = s.split(before).length-1;
  if(occurrences!==1) throw new Error(`Parche cancelado: ${name}: esperada 1 coincidencia, encontradas ${occurrences}. No se modifico nada.`);
  s=s.replace(before,after);
}
function regexOnce(re, after, name){
  const matches=[...s.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))];
  if(matches.length!==1)throw new Error(`Parche cancelado: ${name}: esperada 1 coincidencia, encontradas ${matches.length}. No se modifico nada.`);
  s=s.replace(re,after);
}
// Los enlaces de reportes ya existen en el lateral; el piloto estaba solo en la tira horizontal.
// Solo propietario/administrador pueden ver el acceso a arqueos de revision.
const reportHeader='    <p className="sidebar-label sidebar-report-title">REPORTES</p>';
const reportNavOpen='    <nav className="sidebar-report-links" aria-label="Secciones de reportes">';
const reportNavClose='    </nav>';
const headerIndex=s.indexOf(reportHeader);
const navIndex=s.indexOf(reportNavOpen,headerIndex);
const navEnd=s.indexOf(reportNavClose,navIndex);
if(headerIndex<0 || navIndex<0 || navEnd<0 || s.indexOf(reportHeader,headerIndex+1)>=0)
  throw new Error('Parche cancelado: barra lateral no encontrada o ambigua. No se modifico nada.');
const navBlock=s.slice(headerIndex,navEnd+reportNavClose.length);
if(!navBlock.includes('reportLinks.map'))throw new Error('Parche cancelado: los reportes no se renderizan como se esperaba.');
const withPilot=`    {/* ${marker} */}\n    {canSeeManagement&&<button type="button" className={\`nav-static nav-button \${area==='operatorPilot'?'nav-active':''}\`} onClick={()=>openArea('operatorPilot')} aria-current={area==='operatorPilot'?'page':undefined}><ClipboardCheck size={18}/> Arqueos operadores · pruebas</button>}\n    {canSeeManagement&&<>\n${navBlock}\n    </>}`;
once(navBlock,withPilot,'barra lateral: piloto y bloqueo de reportes');

// Tras validar la cuenta activa, calcular permisos a partir del perfil real.
const activeGuard='  if(profile.active!==true)return <div className="center-page"><section className="auth-card compact"><LockKeyhole size={35}/><h2>Acceso desactivado</h2><p>Comunícate con el propietario de tu establecimiento.</p><button className="primary" onClick={()=>signOut(auth)}>Salir</button></section></div>;' ;
once(activeGuard,activeGuard+'\n  const canSeeManagement=profile.role===\'owner\'||profile.role===\'admin\';','permisos del lateral');

// Quitar enlaces duplicados de las pestañas de cada estacion. Los componentes
// existentes siguen disponibles por el menu lateral; no se borran importaciones.
const sectionsMatch=s.match(/const sections=\[[\s\S]*?\n\];/);
if(!sectionsMatch)throw new Error('Parche cancelado: lista sections no encontrada.');
const sectionsOriginal=sectionsMatch[0];
let sectionsNew=sectionsOriginal;
for (const id of ['anhReports','sustanciasReports','operatorPilot']) {
  const re=new RegExp('^[ \\t]*\\{id:\\s*[\'\"]'+id+'[\'\"][^\\r\\n]*\\r?\\n','gm');
  const found=[...sectionsNew.matchAll(re)];
  if(found.length!==1)throw new Error(`Parche cancelado: se esperaba la pestaña ${id} exactamente una vez; halladas ${found.length}. No se modifico nada.`);
  sectionsNew=sectionsNew.replace(re,'');
}
once(sectionsOriginal,sectionsNew,'pestanas de estacion');

// Quitar los dos reportes administrativos de la vista por estacion.
// El arqueo piloto se mantiene: se muestra al entrar desde el nuevo lateral.
for(const id of ['anhReports','sustanciasReports']){
  const re=new RegExp('^    \\{tab===\\\''+id+'\\\'&&<[^\\r\\n]+\\r?\\n','m');
  regexOnce(re,'','componente duplicado '+id);
}

// Abrir desde el lateral el arqueo piloto de una estacion elegida por Gerencia,
// o la estacion propia del administrador sin ampliar permisos de Firestore.
once('function OwnerDashboard({user}){',"function OwnerDashboard({user,initialTab='general'}){",'propietario: parametro de apertura');
const ownerToStation='if(selected)return <StationDashboard stationId={selected} profile={{role:\'owner\'}} user={user} onBack={()=>setSelected(null)}/>';
once(ownerToStation,"if(selected)return <StationDashboard stationId={selected} profile={{role:'owner'}} user={user} initialTab={initialTab} onBack={()=>setSelected(null)}/>",'propietario: arqueo de estacion');
once('function StationDashboard({stationId,profile,user,onBack}){','function StationDashboard({stationId,profile,user,onBack,initialTab=\'general\'}){','estacion: parametro inicial');
once("  const [tab,setTab]=useState('general');","  const [tab,setTab]=useState(initialTab);",'estacion: abrir modulo seleccionado');

// Reemplazar exclusivamente la expresion principal de navegacion, preservando
// las rutas ANH/Sustancias/Impuestos y sin exponerlas a un operador via area.
const mainRe=/  <main className="content">\{area==='platform'\?[\s\S]*?<\/main><\/div><\/div>;/g;
const mainMatch=[...s.matchAll(mainRe)];
if(mainMatch.length!==1 || !mainMatch[0][0].includes('AnhReportsAccess') || !mainMatch[0][0].includes('SustanciasReportsAccess'))
  throw new Error('Parche cancelado: la ruta de reportes es diferente a v0.11.8 o posteriores. No se modifico nada.');
const newMain=`  <main className="content">{profile.role==='operator'
    ? <StationDashboard stationId={profile.stationId} profile={profile} user={user}/>
    : area==='platform'
      ? (profile.role==='owner'?<OwnerDashboard user={user}/>:<StationDashboard stationId={profile.stationId} profile={profile} user={user}/>)
      : area==='operatorPilot'
        ? (profile.role==='owner'?<OwnerDashboard key="pilot" user={user} initialTab="operatorPilot"/>:<StationDashboard key="pilot" stationId={profile.stationId} profile={profile} user={user} initialTab="operatorPilot"/>)
        : area==='anh'
          ? <AnhReportsAccess profile={profile}/>
          : area==='sustancias'
            ? <SustanciasReportsAccess profile={profile} user={user}/>
            : <ReportPlaceholder item={reportLinks.find(item=>item.id===area)||reportLinks[0]} onBack={()=>openArea('platform')}/>}
  </main></div></div>;`;
s=s.replace(mainRe,newMain);
// Validacion final antes de tocar disco.
if (!s.includes(marker) || !s.includes("{tab==='operatorPilot'&&<OperatorPilot") || !s.includes('canSeeManagement&&<>'))
  throw new Error('Parche cancelado: falto confirmar el modulo de arqueos o el menu. No se modifico nada.');
const backup=target+'.before-v0119d';
if(fs.existsSync(backup))throw new Error('Ya existe '+backup+'. Para evitar sobrescribir el respaldo, no se modifico App.jsx.');
fs.writeFileSync(backup,original,'utf8');
try { fs.writeFileSync(target,s,'utf8'); }
catch(e){ fs.writeFileSync(target,original,'utf8');throw e; }
console.log('V0119D instalada. Respaldo: src/App.jsx.before-v0119d');
console.log('Arqueos ahora en menu lateral; ANH/Sustancias/Impuestos ocultos a operadores y sin pestanas duplicadas.');
console.log('No se modificaron Firestore, los modulos de reportes ni los libros de combustibles.');
