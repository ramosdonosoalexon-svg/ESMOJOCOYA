import React,{useEffect,useRef,useState} from 'react';
import {parseInvoiceQR} from './operatorPilotUX';
import './operatorPilot.css';

// ZXing se importa únicamente al abrir la cámara. Sin subir imágenes a terceros.
export default function OperatorQRScanner({onResult,onClose}){
 const video=useRef(null),controls=useRef(null),stopped=useRef(false);
 const [err,setErr]=useState(''),[loading,setLoading]=useState(true),[manual,setManual]=useState('');
 const decode=raw=>{try{onResult(parseInvoiceQR(raw));}catch(e){setErr(e.message);}};
 useEffect(()=>{
  stopped.current=false;let active=true;
  (async()=>{
   try{
    if(!window.isSecureContext)throw Error('La cámara requiere HTTPS (Firebase Hosting) o localhost.');
    const {BrowserQRCodeReader}=await import('@zxing/browser');
    if(!active)return;
    const reader=new BrowserQRCodeReader();
    const c=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},video.current,(result,_error,control)=>{
      if(result&&!stopped.current){stopped.current=true;control.stop();decode(result.getText());}
    });
    if(!active){c.stop();return;}controls.current=c;setLoading(false);
   }catch(e){if(active){setLoading(false);setErr(e?.message||'No se pudo acceder a la cámara.');}}
  })();
  return ()=>{active=false;stopped.current=true;controls.current?.stop();controls.current=null;};
 },[]);
 const photo=async e=>{
   const file=e.target.files?.[0];if(!file)return;
   setErr('');const url=URL.createObjectURL(file);
   try{
     const {BrowserQRCodeReader}=await import('@zxing/browser');
     const reader=new BrowserQRCodeReader();
     const img=new Image();
     img.src=url;await img.decode();
     const result=await reader.decodeFromImageElement(img);
     decode(result.getText());
   }catch{setErr('No se detectó un QR en la foto. Intenta acercar la cámara.');}
   finally{URL.revokeObjectURL(url);e.target.value='';}
 };
 return <div className="pilot-qr-overlay" role="dialog" aria-modal="true" aria-label="Escanear factura QR">
   <div className="pilot-qr-modal">
     <div className="pilot-between"><h3>Escanear QR</h3><button type="button" className="secondary" onClick={onClose}>✕</button></div>
     <video ref={video} className="pilot-qr-video" muted playsInline autoPlay aria-label="Cámara de lectura QR"/>
     {loading&&<small>Activando cámara…</small>}
     {err&&<p className="pilot-guidance" role="alert">{err}</p>}
     <label className="pilot-qr-photo">Foto de factura<input type="file" accept="image/*" capture="environment" onChange={photo}/></label>
     <details><summary>Pegar QR manualmente</summary><textarea rows={2} value={manual} onChange={e=>setManual(e.target.value)} placeholder="Enlace del QR"/><button className="secondary" onClick={()=>decode(manual)}>Leer</button></details>
     <small>NIT, CUF y factura; verifica los demás datos antes de guardar.</small>
   </div>
 </div>;
}
