const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'firestore.rules');
if(!fs.existsSync(file))throw Error('No existe firestore.rules en esta carpeta.');
let body=fs.readFileSync(file,'utf8');
const sentinel='match /reportSettings/{reportId}';
if(body.includes(sentinel)){console.log('Reglas Sustancias Controladas ya incorporadas; no se duplica.');process.exit(0);}
const pivot='      match /products/{productId} {';
if(!body.includes(pivot))throw Error('No se encontró el punto de inserción seguro. No se modificó firestore.rules.');
const rules=`      // Metadatos declarativos por estación. Solo propietarios y administradores.
      match /reportSettings/{reportId} {
        allow read: if (isOwner() || isMember(sid)) && reportId == 'sustancias';
        allow create, update: if reportId == 'sustancias' && isManager(sid) &&
          request.resource.data.keys().hasOnly([
            'registration','legalName','legalRepresentative','city','address',
            'responsible','telephone','updatedBy','updatedAt'
          ]) && request.resource.data.keys().hasAll([
            'registration','legalName','legalRepresentative','city','address',
            'responsible','telephone','updatedBy','updatedAt'
          ]) &&
          request.resource.data.registration is string && request.resource.data.registration.size() <= 150 &&
          request.resource.data.legalName is string && request.resource.data.legalName.size() <= 150 &&
          request.resource.data.legalRepresentative is string && request.resource.data.legalRepresentative.size() <= 150 &&
          request.resource.data.city is string && request.resource.data.city.size() <= 150 &&
          request.resource.data.address is string && request.resource.data.address.size() <= 240 &&
          request.resource.data.responsible is string && request.resource.data.responsible.size() <= 150 &&
          request.resource.data.telephone is string && request.resource.data.telephone.size() <= 150 &&
          request.resource.data.updatedBy == request.auth.uid &&
          request.resource.data.updatedAt == request.time;
        allow delete: if false;
      }
`;
body=body.replace(pivot,rules+pivot);
fs.copyFileSync(file,file+'.backup-before-sustancias-v0118');
fs.writeFileSync(file,body,'utf8');
console.log('Bloque reportSettings agregado conservando todas las reglas previas. Verifica git diff antes del deploy.');
