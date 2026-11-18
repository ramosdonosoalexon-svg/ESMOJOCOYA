// IndexedDB: cola local persistente. Por diseño, sin importación a libros oficiales.
const NAME='mojocoya-operadores-pruebas',STORE='arqueos',VERSION=1;
function connect(){return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('Este navegador no ofrece IndexedDB. No se puede garantizar guardado offline.'));return;}
  const request=indexedDB.open(NAME,VERSION);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
function txn(mode,action){return connect().then(db=>new Promise((resolve,reject)=>{
  const t=db.transaction(STORE,mode),req=action(t.objectStore(STORE));
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  t.oncomplete=()=>db.close();t.onabort=()=>{db.close();reject(t.error);};
}));}
export const putLocalPilot = entry =>txn('readwrite',store=>store.put(entry));
export const getLocalPilot = id =>txn('readonly',store=>store.get(id));
export const listLocalPilots = async (stationId,uid)=> (await txn('readonly',s=>s.getAll())).filter(x=>x.stationId===stationId&&x.operatorUid===uid);
export const deleteLocalPilot = id =>txn('readwrite',s=>s.delete(id));
