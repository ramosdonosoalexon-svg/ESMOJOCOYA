import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification,
  signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, configured, configError } from './firebase';
import { acceptInvitation } from './data';

const msg = e => {
  const c = e?.code || '';
  if (c.includes('email-already-in-use')) return 'Este correo ya tiene cuenta. Ingresa con tu contraseña.';
  if (c.includes('invalid-credential')) return 'Correo o contraseña incorrectos.';
  if (c.includes('weak-password')) return 'La contraseña es demasiado débil.';
  if (c.includes('permission-denied')) return 'Permiso denegado. Comprueba las reglas y la invitación.';
  return e?.message || 'Ocurrió un error. Vuelve a intentar.';
};
export function Login() {
  const [mode, setMode] = useState('login'), [email,setEmail]=useState(''),
    [password,setPassword]=useState(''),[busy,setBusy]=useState(false),
    [error,setError]=useState(''),[notice,setNotice]=useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'reset') { await sendPasswordResetEmail(auth,email.trim()); setNotice('Revisa tu correo para restablecer la contraseña.'); }
      else if (mode === 'register') {
        const r=await createUserWithEmailAndPassword(auth,email.trim().toLowerCase(),password);
        await sendEmailVerification(r.user);
        setNotice('Enviamos la verificación a tu correo. Después pulsa «Ya verifiqué» en la pantalla siguiente.');
      } else await signInWithEmailAndPassword(auth,email.trim(),password);
    } catch(e) {setError(msg(e));} finally {setBusy(false);}
  }
  return <div className="auth-page"><div className="auth-brand"><div className="brand-icon">▰</div>
    <h1>MOJOCOYA <span>SRL</span></h1><p>Control inteligente de estaciones de servicio y puestos de venta.</p>
    <div className="auth-feature">Inventarios físicos y contables · Recepciones · Meters · Conciliaciones</div></div>
    <section className="auth-card"><p className="eyebrow">ACCESO SEGURO</p>
    <h2>{mode==='login'?'Bienvenido': mode==='register'?'Activar invitación':'Recuperar contraseña'}</h2>
    <p className="muted">{mode==='register'?'Regístrate con el correo al que te invitaron.': 'Inicia sesión con tu correo autorizado.'}</p>
    {!configured && <p className="alert error">{configError}</p>}
    <form onSubmit={submit} className="form-stack"><label>Correo electrónico<input type="email" value={email} required autoComplete="email" placeholder="usuario@empresa.com" onChange={e=>setEmail(e.target.value)}/></label>
    {mode!=='reset'&&<label>Contraseña<input type="password" required minLength={6} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    {error&&<p className="alert error">{error}</p>}{notice&&<p className="alert success">{notice}</p>}
    <button className="primary full" disabled={busy||!configured}>{busy?'Procesando…':mode==='login'?'Ingresar':mode==='register'?'Crear mi cuenta':'Enviar enlace'}</button></form>
    <div className="auth-actions"><button className="link-btn" onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>{mode==='login'?'Tengo invitación: crear cuenta':'Volver a ingresar'}</button>
    <button className="link-btn" onClick={()=>{setMode('reset');setError('');}}>Olvidé mi contraseña</button></div>
    </section></div>;
}
export function Activate({user, onActivate}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function verify(){setBusy(true);setError('');setNotice('');try{await user.reload();await user.getIdToken(true);if(!user.emailVerified){setError('Todavía no está verificado. Revisa tu correo, incluida la carpeta spam.');return;}await acceptInvitation(user);setNotice('Invitación activada. Preparando tu panel…');onActivate();}catch(e){setError(msg(e));}finally{setBusy(false);}}
  return <div className="center-page"><div className="auth-card compact"><div className="circle-icon">✉</div><h2>Activación de acceso</h2><p className="muted">Sesión: <strong>{user.email}</strong></p><p>Para entrar, verifica tu correo y acepta la invitación del propietario o administrador.</p>
    {error&&<p className="alert error">{error}</p>}{notice&&<p className="alert success">{notice}</p>}
    <button className="primary full" disabled={busy} onClick={verify}>{busy?'Verificando…':'Ya verifiqué mi correo · Activar'}</button>
    <button className="secondary full" onClick={async()=>{try{await sendEmailVerification(user);setNotice('Correo de verificación reenviado.')}catch(e){setError(msg(e));}}}>Reenviar verificación</button>
    <button className="link-btn full" onClick={()=>auth.signOut()}>Salir y usar otra cuenta</button>
    <p className="small muted">El propietario inicial se habilita una sola vez desde la consola Firestore. Consulta INICIO.md.</p>
  </div></div>;
}
