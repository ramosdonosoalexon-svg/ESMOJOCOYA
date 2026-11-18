import AnhReports from './AnhReports.jsx';
import SustanciasReports from './SustanciasReports.jsx';
import React, {useEffect, useState} from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { manageStaff, sendRecoveryEmail } from './staff';
import {useDocuments} from './hooks';
import Config from './Config';
import {InitialData,InventoryBook} from './Operations';
import ReceptionBook from './ReceptionBook';
import MeterBook from './MeterBook';
import OperatorPilot from './OperatorPilot.jsx';
import {resolveLegacyHoses} from './hoseCompat';
import MovementBook from './MovementBook';
import {sortRegistered} from './calibrationMath';
import './ops.css';
import { Login, Activate } from './auth';
import {
  createStation, inviteOperator, inviteAdministrator, toggleActive, toggleProduct,
  productCatalog, stationPath
} from './data';
import { Building2, Fuel, UsersRound, ChartColumn, LogOut, Plus, ArrowLeft,
  Cylinder, Gauge, Settings2, Inbox, Table2, ClipboardCheck, Boxes, Menu,
  CircleAlert, Check, AlertTriangle, ChevronRight, UserRound, RefreshCw, LockKeyhole, FileText, ShieldCheck, ReceiptText
} from 'lucide-react';

function useStation(id){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{if(!id)return;const key='pilot-station-cache:'+id;let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||'null');}catch{}setData(cached);setLoading(!cached);return onSnapshot(doc(db,'stations',id),snap=>{const station=snap.exists()?{id:snap.id,...snap.data()}:null;setData(station||cached);if(station)localStorage.setItem(key,JSON.stringify(station));setLoading(false);},()=>{setData(old=>old||cached);setLoading(false);});},[id]);
  return {data,loading};
}
function Alert({children,type='error'}){return <p className={`alert ${type}`}>{children}</p>}
function Loading(){return <div className="loading"><span className="spinner"/> Cargando información...</div>}
function Empty({title,desc}){return <div className="empty"><Inbox size={29}/><b>{title}</b><p>{desc}</p></div>}
function Notice({error,notice}){return <>{error&&<Alert>{error}</Alert>}{notice&&<Alert type="success">{notice}</Alert>}</>}
function Status({active}){return <span className={`status ${active?'enabled':'disabled'}`}>{active?'Activo':'Inactivo'}</span>}
function PageHeader({label,title,description,children}){return <div className="page-head"><div><div className="eyebrow">{label}</div><h1>{title}</h1><p className="muted">{description}</p></div>{children&&<div className="page-actions">{children}</div>}</div>}
const getError=e=>e?.code==='permission-denied'?'Permiso denegado. Revisa Firestore y tu rol.':e?.message || 'No fue posible guardar.';

const reportLinks = [
  {id:'anh',label:'REPORTES ANH',title:'Reportes ANH',icon:FileText,description:'Apartado reservado para los formatos requeridos por la ANH.'},
  {id:'sustancias',label:'REPORTES SUSTANCIAS CONTROLADAS',title:'Reportes Sustancias Controladas',icon:ShieldCheck,description:'Apartado reservado para los reportes de sustancias controladas.'},
  {id:'impuestos',label:'REPORTES IMPUESTOS NACIONALES',title:'Reportes Impuestos Nacionales',icon:ReceiptText,description:'Apartado reservado para los reportes tributarios.'},
];
function ReportPlaceholder({item,onBack}){
  const Icon=item.icon;
  return <div className="report-placeholder-page">
    <PageHeader label="REPORTES · MOJOCOYA SRL" title={item.title} description={item.description}>
      <button type="button" className="secondary" onClick={onBack}><ArrowLeft size={16}/> Volver al panel</button>
    </PageHeader>
    <section className="panel report-placeholder-panel"><Icon size={27}/>
      <h2>Sección preparada para desarrollo</h2>
      <p>Antes de emitir documentos oficiales definiremos los formatos, campos y períodos de presentación aplicables a cada establecimiento. No se generan reportes ficticios.</p>
      <p>La información operativa de Inventarios, Recepciones, Meters y Movimientos permanece en el Panel de estación.</p>
    </section>
  </div>;
}
function SustanciasReportsAccess({profile,user}){
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
function AnhReportsAccess({profile}){
  const owner=profile.role==='owner';
  const [selected,setSelected]=useState('');
  const {items:stations,error}=useDocuments(()=>collection(db,'stations'),[owner?'owner':null]);
  const id=owner?selected:profile.stationId;
  const {data:station}=useStation(id);
  return <div className="anh-access">
    {owner&&<section className="panel"><h2>Reportes ANH por establecimiento</h2><p>Selecciona una estación o puesto de venta.</p>
      <label>Establecimiento <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona...</option>{stations.map(x=><option key={x.id} value={x.id}>{x.name} ({x.type==='puesto'?'puesto':'estación'})</option>)}</select></label>
      {error&&<div className="alert error">{error}</div>}</section>}
    {id&&station&&<AnhReports stationId={id} station={station}/>}
    {!id&&<section className="panel">Selecciona una estación o puesto para consultar y exportar los reportes.</section>}
  </div>;
}
export default function App(){
  const [user,setUser]=useState(undefined),[profile,setProfile]=useState(undefined),[refresh,setRefresh]=useState(0),[showMenu,setShowMenu]=useState(false);
  const [area,setArea]=useState('platform');
  const openArea=id=>{setArea(id);setShowMenu(false);};
  useEffect(()=>onAuthStateChanged(auth,u=>setUser(u)),[]);
  useEffect(()=>{
    if(!user){setProfile(null);return;}
    setProfile(undefined);
    const key='pilot-profile-cache:'+user.uid;let cached=null;try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x?.role==='operator')cached=x;}catch{}
    setProfile(cached||undefined);
    return onSnapshot(doc(db,'users',user.uid),snap=>{const value=snap.exists()?snap.data():null;setProfile(value);if(value?.role==='operator')localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);},()=>setProfile(cached));
  },[user,refresh]);
  if(user===undefined || (user&&profile===undefined))return <Loading/>;
  if(!user)return <Login/>;
  if(!profile)return <Activate user={user} onActivate={()=>setRefresh(x=>x+1)}/>;
  if(profile.active!==true)return <div className="center-page"><section className="auth-card compact"><LockKeyhole size={35}/><h2>Acceso desactivado</h2><p>Comunícate con el propietario de tu establecimiento.</p><button className="primary" onClick={()=>signOut(auth)}>Salir</button></section></div>;
  const canSeeManagement=profile.role==='owner'||profile.role==='admin';
  return <div className="shell"><aside className={`sidebar ${showMenu?'open':''}`}>
    <div className="logo"><div className="logo-square"><Fuel size={22}/></div><div><strong>MOJOCOYA</strong><span>SRL</span></div></div>
    <p className="sidebar-label">PLATAFORMA</p>
    <button type="button" className={`nav-static nav-button ${area==='platform'?'nav-active':''}`} onClick={()=>openArea('platform')} aria-current={area==='platform'?'page':undefined}><ChartColumn size={18}/> {profile.role==='owner'?'Panel del propietario':profile.role==='admin'?'Panel de estación':'Panel operativo'}</button>
    {/* V0119D: menu lateral y permisos de reportes */}
    {canSeeManagement&&<button type="button" className={`nav-static nav-button ${area==='operatorPilot'?'nav-active':''}`} onClick={()=>openArea('operatorPilot')} aria-current={area==='operatorPilot'?'page':undefined}><ClipboardCheck size={18}/> Arqueos operadores · pruebas</button>}
    {canSeeManagement&&<>
    <p className="sidebar-label sidebar-report-title">REPORTES</p>
    <nav className="sidebar-report-links" aria-label="Secciones de reportes">
      {reportLinks.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={`nav-static nav-button nav-report ${area===item.id?'nav-active':''}`} aria-current={area===item.id?'page':undefined} onClick={()=>openArea(item.id)}><Icon size={18}/><span>{item.label}</span></button>;})}
    </nav>
    </>}
    <div className="sidebar-bottom"><div className="identity"><div className="avatar">{(profile.displayName||user.email||'U')[0].toUpperCase()}</div><div><b>{profile.displayName||'Usuario'}</b><small>{profile.role==='owner'?'Propietario':profile.role==='admin'?'Administrador':'Operador'}</small></div></div>
    <button className="signout" onClick={()=>signOut(auth)}><LogOut size={16}/> Cerrar sesión</button></div>
  </aside><div className="workspace"><header className="topbar"><button className="mobile-menu" onClick={()=>setShowMenu(!showMenu)}><Menu size={20}/></button><span>Control de combustibles líquidos</span><div className="top-profile"><span>{user.email}</span><span className="top-dot"/></div></header>
  <main className="content">{profile.role==='operator'
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
  </main></div></div>;
}
function OwnerDashboard({user,initialTab='general'}){
  const {items:stations,loading,error}=useDocuments(()=>collection(db,'stations'),[]);
  const {items:people}=useDocuments(()=>collection(db,'users'),[]);
  const {items:invites}=useDocuments(()=>collection(db,'invitations'),[]);
  const [selected,setSelected]=useState(null),[showCreate,setShowCreate]=useState(false),[submitError,setSubmitError]=useState(''),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({name:'',type:'estacion',city:'',adminName:'',adminEmail:''});
  async function save(e){e.preventDefault();setBusy(true);setSubmitError('');try{
    const id=await createStation({...form,uid:user.uid});setShowCreate(false);setForm({name:'',type:'estacion',city:'',adminName:'',adminEmail:''});setSelected(id);
  }catch(e){setSubmitError(getError(e));}finally{setBusy(false);}}
  if(selected)return <StationDashboard stationId={selected} profile={{role:'owner'}} user={user} initialTab={initialTab} onBack={()=>setSelected(null)}/>;
  return <>
    <PageHeader label="ADMINISTRACIÓN CENTRAL" title="Panel del propietario" description="Todos los establecimientos y sus administradores, desde un solo lugar.">
      <button className="primary" onClick={()=>setShowCreate(true)}><Plus size={17}/> Crear establecimiento</button></PageHeader>
    <div className="stat-grid"><div className="stat"><span>Establecimientos</span><strong>{stations.length}</strong><small>Estaciones y puestos</small><Building2/></div>
    <div className="stat"><span>Estaciones</span><strong>{stations.filter(s=>s.type==='estacion').length}</strong><small>Configuradas</small><Fuel/></div>
    <div className="stat"><span>Puestos de venta</span><strong>{stations.filter(s=>s.type==='puesto').length}</strong><small>Configurados</small><Boxes/></div>
    <div className="stat"><span>Usuarios activos</span><strong>{people.filter(x=>x.active).length}</strong><small>En toda la red</small><UsersRound/></div></div>
    <section className="panel"><div className="section-title"><div><h2>Mis establecimientos</h2><p>Selecciona uno para entrar a su administración.</p></div></div>
    {error&&<Alert>{error}</Alert>}{loading?<Loading/>:stations.length===0?<Empty title="Todavía no hay establecimientos" desc="Crea la primera estación o puesto y asigna un correo al administrador."/>:
      <div className="stations-grid">{stations.map(s=><button className="station-card" key={s.id} onClick={()=>setSelected(s.id)}><span className="station-icon">{s.type==='estacion'?<Fuel/>:<Building2/>}</span><strong>{s.name}</strong><small>{s.type==='estacion'?'Estación de servicio':'Puesto de venta'}{s.city?` · ${s.city}`:''}</small><div className="station-footer"><Status active={s.active}/><ChevronRight size={18}/></div></button>)}</div>}</section>
    <section className="panel"><div className="section-title"><h2>Administradores e invitaciones</h2></div><div className="table-wrap"><table><thead><tr><th>Correo</th><th>Rol</th><th>Establecimiento</th><th>Estado</th></tr></thead>
    <tbody>{invites.length?invites.map(i=><tr key={i.id}><td>{i.email}</td><td>{i.role==='admin'?'Administrador':'Operador'}</td><td>{stations.find(s=>s.id===i.stationId)?.name||i.stationId}</td><td><Status active={i.status==='accepted'}/><small className="subtext">{i.status==='accepted'?'Activado':'Invitación pendiente'}</small></td></tr>):<tr><td colSpan="4">Sin invitaciones todavía</td></tr>}</tbody></table></div></section>
    {showCreate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><section className="modal"><div className="modal-head"><h2>Crear establecimiento</h2><button className="close" onClick={()=>setShowCreate(false)}>×</button></div><p className="muted">Se creará la estación y la invitación de su administrador en una sola operación.</p>
    <form className="form-stack" onSubmit={save}><label>Nombre de estación / puesto<input autoFocus required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej. Estación Central"/></label>
    <label>Tipo<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="estacion">Estación de servicio</option><option value="puesto">Puesto de venta</option></select></label>
    <label>Localidad (opcional)<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="Ej. Cochabamba"/></label>
    <div className="form-divider">DATOS DEL ADMINISTRADOR</div>
    <label>Nombre del administrador<input required value={form.adminName} onChange={e=>setForm({...form,adminName:e.target.value})}/></label>
    <label>Correo del administrador<input type="email" required value={form.adminEmail} onChange={e=>setForm({...form,adminEmail:e.target.value})} placeholder="admin@dominio.com"/></label>
    <p className="form-help">Se reservará el correo del administrador. Después abre la pestaña Personal para asignar una contraseña inicial, cambiarla o quitar al administrador. La asignación directa necesita Cloud Functions.</p>
    <Notice error={submitError}/><div className="form-buttons"><button className="secondary" type="button" onClick={()=>setShowCreate(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Creando…':'Crear e invitar administrador'}</button></div></form></section></div>}
  </>;
}
const sections=[
  {id:'general',label:'Resumen',icon:ChartColumn},
  {id:'config',label:'Configuración',icon:Settings2},
  {id:'initial',label:'Datos iniciales',icon:ClipboardCheck},
  {id:'team',label:'Personal',icon:UsersRound},
  {id:'inventory',label:'Inventarios',icon:Cylinder},
  {id:'receipts',label:'Recepciones',icon:Inbox},
  {id:'meters',label:'Meters / arqueos',icon:Gauge},
  {id:'movements',label:'Movimientos',icon:Table2},
];
function cachedOperatorHoses(stationId){try{return JSON.parse(localStorage.getItem('pilot-hoses-cache:'+stationId)||'[]');}catch{return [];}}
function StationDashboard({stationId,profile,user,onBack,initialTab='general'}){
  const {data:station,loading}=useStation(stationId);
  const [tab,setTab]=useState(initialTab);
  // Conservar el día operativo al pasar por otros módulos sin volver a hoy.
  const [meterDate,setMeterDate]=useState('');
  const selectTab=id=>{setTab(id);window.scrollTo({top:0,behavior:'auto'});};
  const canManage=profile.role==='owner'||profile.role==='admin';
  const {items:products}=useDocuments(()=>stationPath(stationId,'products'),[stationId]);
  const {items:tanks}=useDocuments(()=>stationPath(stationId,'tanks'),[stationId]);
  const {items:dispensers}=useDocuments(()=>stationPath(stationId,'dispensers'),[stationId]);
  const {items:hoses}=useDocuments(()=>stationPath(stationId,'hoses'),[stationId]);
  useEffect(()=>{if(hoses.length)localStorage.setItem('pilot-hoses-cache:'+stationId,JSON.stringify(hoses));},[stationId,hoses]);
  const {items:invitations}=useDocuments(()=>query(collection(db,'invitations'),where('stationId','==',stationId)),[stationId]);
  const {items:teamMembers,error:teamError}=useDocuments(()=> profile.role==='owner'
    ? query(collection(db,'users'),where('stationId','==',stationId))
    : query(collection(db,'users'),where('stationId','==',stationId),where('role','==','operator')),[canManage?stationId:null,profile.role]);
  if(loading)return <Loading/>;
  if(!station)return <Alert>La estación no existe o no tienes acceso. Si el problema persiste revisa tus permisos.</Alert>;
  if(profile.role==='operator')return <OperatorPilot stationId={stationId} stationName={station.name} uid={user.uid} profile={{...profile,email:user.email}} canManage={false} hoses={resolveLegacyHoses(hoses.length?hoses:cachedOperatorHoses(stationId),tanks)}/>;
  return <>
    {onBack&&<button className="back-link" onClick={onBack}><ArrowLeft size={17}/> Volver a establecimientos</button>}
    <PageHeader label={station.type==='estacion'?'ESTACIÓN DE SERVICIO':'PUESTO DE VENTA'} title={station.name} description={`${station.city||'Sin localidad registrada'} · ${profile.role==='owner'?'Vista del propietario':profile.role==='admin'?'Administración de la estación':'Panel de operador'}`}><Status active={station.active}/></PageHeader>
    <nav className="tab-strip" aria-label="Módulos de la estación">{sections.map(t=><button type="button" key={t.id} className={`tab ${tab===t.id?'selected':''}`} aria-current={tab===t.id?'page':undefined} onClick={()=>selectTab(t.id)}><t.icon size={17}/>{t.label}</button>)}</nav>
    {tab==='general'&&<><div className="stat-grid"><div className="stat"><span>Productos activos</span><strong>{products.filter(p=>p.active).length}</strong><small>Comercializados</small><Boxes/></div><div className="stat"><span>Tanques</span><strong>{tanks.length}</strong><small>Configurados</small><Cylinder/></div><div className="stat"><span>Dispensers</span><strong>{dispensers.length}</strong><small>Configurados</small><Fuel/></div><div className="stat"><span>Mangueras</span><strong>{hoses.length}</strong><small>Configuradas</small><Gauge/></div></div>
    <div className="two-col"><section className="panel"><h2>Preparación operativa</h2><p className="muted">Completa la configuración y después entra a Datos iniciales para registrar los saldos y meters de partida.</p><div className="check-list"><div><Check/> Establecimiento creado</div><div className={products.some(p=>p.active)?'':'pending'}><Check/> Productos activos</div><div className={tanks.length?'':'pending'}><Check/> Tanques o cilindros configurados</div><div className={dispensers.length?'':'pending'}><Check/> Dispensers configurados</div><div className={hoses.length?'':'pending'}><Check/> Mangueras configuradas</div></div>
    {canManage&&<button className="secondary" onClick={()=>setTab('config')}>Abrir configuración <ChevronRight size={16}/></button>}</section>
    <section className="panel"><h2>Estado de los módulos</h2><div className="module-line"><Cylinder/> Inventarios <span>Registro físico por tanque</span></div><div className="module-line"><Inbox/> Recepciones <span>Registro por tanque / cisterna</span></div><div className="module-line"><Gauge/> Meters y arqueos <span>Lecturas y clasificación por producto</span></div><div className="module-line"><Table2/> Movimientos <span>Libro mensual automático y conciliaciones</span></div><p className="small muted">Todavía no mostramos saldos o ventas porque no hay movimientos registrados.</p></section></div></>}
    {tab==='config'&&<Config stationId={stationId} uid={user.uid} canManage={canManage} products={products} tanks={tanks} dispensers={dispensers} hoses={hoses}/>}
    {tab==='team'&&<Team stationId={stationId} uid={user.uid} currentEmail={user.email} invitations={invitations} members={teamMembers} teamError={teamError} canManage={canManage} owner={profile.role==='owner'}/>}
    {tab==='initial'&&<InitialData stationId={stationId} uid={user.uid} canManage={canManage} tanks={tanks} dispensers={dispensers} hoses={hoses}/>}
    {tab==='inventory'&&<InventoryBook stationId={stationId} uid={user.uid} canManage={canManage} role={profile.role} tanks={tanks} products={products} hoses={hoses}/>}
    {tab==='receipts'&&<ReceptionBook stationId={stationId} uid={user.uid} canManage={canManage} products={products} tanks={tanks} dispensers={dispensers} hoses={hoses}/>}
    {tab==='meters'&&<MeterBook stationId={stationId} uid={user.uid} products={products} tanks={tanks} hoses={hoses} dispensers={dispensers} canManage={canManage} operationalDate={meterDate} onOperationalDateChange={setMeterDate}/>}
        {tab==='movements'&&<MovementBook stationId={stationId} uid={user.uid} products={products} tanks={tanks} hoses={hoses} canManage={canManage}/>}
    {tab==='operatorPilot'&&<OperatorPilot stationId={stationId} stationName={station.name} uid={user.uid} profile={{...profile,email:user.email}} canManage={canManage} hoses={resolveLegacyHoses(hoses,tanks)}/>} 
  </>;
}
function Team({stationId,uid,currentEmail,invitations,members,teamError,canManage,owner}) { // V0119C: cuentas e invitaciones
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [role,setRole]=useState('operator');
  const [mode,setMode]=useState('invite');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [editing,setEditing]=useState(null),[newPassword,setNewPassword]=useState('');
  const adminActive=members.some(m=>m.role==='admin'&&m.active);
  const normalizedEmail=email.trim().toLowerCase();
  const run=async(task,success,{isInvitation=false}={})=>{
    setBusy(true);setError('');setNotice('');
    try{await task();setNotice(success);return true;}
    catch(e){let msg=getError(e);
      if(e?.code==='permission-denied'&&isInvitation) msg='La invitación fue rechazada: comprueba que uses otro correo, que no exista una invitación anterior y que las reglas actualizadas estén publicadas. La presencia del administrador no bloquea operadores.';
      if(['functions/not-found','functions/unavailable'].includes(e?.code)) msg='La administración directa de contraseñas requiere publicar Cloud Functions (plan Blaze). Mientras tanto puedes invitar por correo y desactivar accesos desde Firestore.';
      setError(msg);return false;
    }finally{setBusy(false);}
  };
  async function add(e){
    e.preventDefault();
    const ok=await run(async()=>{
      if(normalizedEmail === String(currentEmail||'').trim().toLowerCase()) throw new Error('Este es el correo con el que ingresaste. La cuenta de Gerencia o Administración ya existe; para un operador utiliza otro correo.');
      if(members.some(m=>String(m.email||'').toLowerCase()===normalizedEmail)) throw new Error('Ese correo ya pertenece a un empleado de esta estación. Usa otra dirección.');
      if(invitations.some(i=>String(i.email||'').toLowerCase()===normalizedEmail)) throw new Error('Ese correo ya tiene una invitación en esta estación. Revisa Invitaciones pendientes; no se puede crear otra encima.');
      if(mode==='direct'){
        if(password.length<6) throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');
        await manageStaff({action:'create',stationId,role,name,email:normalizedEmail,password});
      }else if(role==='admin'){
        if(!owner)throw new Error('Solo Gerencia puede nombrar al administrador.');
        if(adminActive)throw new Error('Primero desactiva al administrador saliente. Gerencia continuará administrando la estación mientras tanto.');
        await inviteAdministrator({email:normalizedEmail,name,stationId,uid});
      }else{
        await inviteOperator({email:normalizedEmail,name,stationId,uid,preflight:owner});
      }
    },mode==='direct'?'Acceso creado. Entrega la contraseña por un canal seguro y solicita que la cambien al ingresar.':role==='admin'?'Invitación del nuevo administrador creada. Puede activar su cuenta; Gerencia conserva el control.':'Invitación creada. El operador podrá activar su cuenta con su propio correo.',{isInvitation:mode==='invite'});
    if(ok){setName('');setEmail('');setPassword('');}
  }
  async function passwordChange(e){
    e.preventDefault();
    const ok=await run(()=>manageStaff({action:'password',stationId,targetUid:editing.id,password:newPassword}),
      `Contraseña actualizada para ${editing.displayName||editing.email}. Comunícasela de forma privada.`);
    if(ok){setEditing(null);setNewPassword('');}
  }
  const changeAccess=async(m,active)=>{
    if(m.role==='admin'&&!owner){setError('Solo Gerencia puede cambiar el acceso de otro administrador.');return;}
    if(!active&&m.role==='admin'&&members.some(x=>x.id!==m.id&&x.role==='admin'&&x.active)){
      setError('Ya existe otro administrador activo. No reactives dos administradores de la misma estación.');return;
    }
    if(!window.confirm(`${active?'Desactivar':'Reactivar'} el acceso de ${m.displayName||m.email}?`))return;
    // La habilitación y deshabilitación de Firestore no necesita Cloud Functions.
    await run(()=>toggleActive(m.id,active),active?'Acceso desactivado. Gerencia puede seguir administrando esta estación. La cuenta Auth permanece, pero las reglas bloquean los datos.':'Acceso reactivado.');
  };
  if(!canManage)return <section className="panel"><h2>Personal</h2><p>Solo propietarios y administradores pueden gestionar usuarios.</p></section>;
  return <>
    <section className="panel"><div className="section-title"><div><h2>Administración de cuentas</h2><p>El propietario puede asignar y quitar administradores, cambiar contraseñas y revisar el personal de todas las estaciones. Los administradores solo gestionan operadores de su establecimiento.</p></div></div>
      <p className="form-help">Gerencia siempre administra la estación, con o sin administrador contratado. Tener un administrador activo nunca impide invitar operadores. Una cuenta desactivada deja de consultar datos, pero su historial permanece.</p>
      <Notice error={error} notice={notice}/>
      {teamError&&<Alert>{teamError}</Alert>}
    </section>
    <div className="two-col">
      <section className="panel"><h2>Crear acceso</h2><p className="muted">Genera una cuenta con contraseña inicial o invita al empleado para que active la suya.</p>
        <div className="staff-mode"><button type="button" className={`secondary ${mode==='direct'?'chosen':''}`} onClick={()=>setMode('direct')}>Asignar contraseña</button><button type="button" className={`secondary ${mode==='invite'?'chosen':''}`} onClick={()=>{setMode('invite');setRole('operator');}}>Invitar por correo</button></div>
        <form className="form-stack" onSubmit={add}>
          {owner&&<label>Rol del nuevo usuario<select value={role} onChange={e=>setRole(e.target.value)}><option value="operator">Operador de dispenser</option><option value="admin">Administrador (reemplazo)</option></select></label>}
          {role==='admin'&&adminActive&&<Alert>Para nombrar otro administrador, primero desactiva al saliente desde Empleados. Mientras tanto, Gerencia controla la estación. Esto no afecta las invitaciones de operadores.</Alert>}
          <label>Nombre completo<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del empleado"/></label>
          <label>Correo de acceso<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@empresa.com"/></label>
          {mode==='direct'&&<label>Contraseña inicial<input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"/></label>}
          <button className="primary" disabled={busy||(role==='admin'&&adminActive)}>{busy?'Guardando…':mode==='direct'?'Crear cuenta y asignar contraseña':'Crear invitación'}</button>
          <p className="form-help">Invita al operador usando un correo propio y diferente del de Gerencia. Las invitaciones no necesitan Cloud Functions. «Asignar contraseña» y cambiar contraseñas sí requieren desplegar la función manageStaff.</p>
        </form>
      </section>
      <section className="panel"><h2>Empleados de esta estación</h2><p className="muted">Desactiva el acceso antes de reemplazar a un administrador. No se elimina su historial.</p>
        <div className="item-list">{members.map(m=><div className="item staff-user" key={m.id}>
          <UserRound size={18}/><div><b>{m.displayName||m.email}</b><small>{m.email} · {m.role==='admin'?'Administrador':'Operador'}</small></div>
          <Status active={m.active}/>
          <div className="staff-actions"><button type="button" className="secondary" disabled={busy||!m.active} onClick={()=>{setEditing(m);setNewPassword('');setError('');setNotice('');}}>Contraseña</button>
            <button type="button" className="secondary" disabled={busy} onClick={()=>changeAccess(m,m.active)}>{m.active?'Quitar acceso':'Reactivar'}</button>
            <button type="button" className="link-btn" onClick={()=>run(()=>sendRecoveryEmail(m.email),'Se solicitó un correo para restablecer la contraseña, si esa dirección tiene una cuenta.')}>Enviar recuperación</button>
          </div>
        </div>)}{!members.length&&<Empty title="Sin usuarios activos o registrados" desc="Las cuentas creadas aparecerán aquí después de registrarse."/>}</div>
      </section>
    </div>
    <section className="panel"><h2>Invitaciones pendientes</h2><div className="item-list">{invitations.filter(i=>i.status==='pending').map(i=><div className="item" key={i.id}><UserRound size={18}/><div><b>{i.name||i.email}</b><small>{i.email} · {i.role==='admin'?'Administrador':'Operador'}</small></div><Status active={false}/></div>)}{!invitations.some(i=>i.status==='pending')&&<p className="muted">Sin invitaciones pendientes.</p>}</div></section>
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}>
      <section className="modal"><div className="modal-head"><h2>Cambiar contraseña</h2><button className="close" onClick={()=>setEditing(null)}>×</button></div>
        <p className="muted">{editing.displayName||editing.email} · {editing.email}</p>
        <form className="form-stack" onSubmit={passwordChange}><label>Nueva contraseña temporal<input autoFocus type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
          <p className="form-help">Mínimo 6 caracteres. No se almacena en Firestore. El cambio solicita revocar sesiones anteriores; algunos tokens pueden permanecer válidos durante un corto período.</p>
          <div className="form-buttons"><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" disabled={busy}>Guardar nueva contraseña</button></div></form>
      </section></div>}
  </>;
}
