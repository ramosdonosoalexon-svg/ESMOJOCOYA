/* Interfaz de pruebas disponible sin red tras una primera visita ONLINE.
   No se interceptan peticiones a Firebase ni se actualizan libros oficiales. */
const CACHE='distrigas-operator-pilot-v0119';
async function cacheShell(){
 const cache=await caches.open(CACHE);
 const response=await fetch('/',{cache:'no-store'});
 if(!response.ok)throw Error('Inicio no disponible');
 await cache.put('/',response.clone());
 const text=await response.text(),assets=[];
 for(const match of text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))assets.push(match[1]);
 await Promise.all(assets.map(url=>cache.add(url).catch(()=>{})));
}
self.addEventListener('install',event=>event.waitUntil(cacheShell().then(()=>self.skipWaiting()).catch(()=>{})));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('distrigas-operator-pilot-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('/',copy));}return res;}).catch(async()=>await caches.match('/')||Response.error()));return;
 }
 if(!/\.(?:js|css|png|svg|webmanifest)$/i.test(new URL(req.url).pathname))return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));
});
