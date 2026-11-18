const fs=require('fs'),path=require('path');const f=path.join(process.cwd(),'firestore.rules');
if(!fs.existsSync(f))throw Error('No hay firestore.rules en esta carpeta');
let body=fs.readFileSync(f,'utf8');
if(body.includes('match /operatorPilotShifts/{shiftId}')){console.log('Permisos de pruebas ya instalados');process.exit(0);}
const anchor='      match /products/{productId} {';
if(!body.includes(anchor))throw Error('No se encontró la sección segura de reglas. Se aborta sin modificaciones.');
const block=`      // Pruebas de arqueos: JAMÁS escribe en meterShifts, movimientos o caja.
      // La habilitación solo la decide Administración o Gerencia.
      function pilotEnabled() {
        return exists(/databases/$(database)/documents/stations/$(sid)/operatorPilotSettings/control) &&
          get(/databases/$(database)/documents/stations/$(sid)/operatorPilotSettings/control).data.enabled == true;
      }
      function pilotOperator() {return isMember(sid) && profile().role == 'operator';}
      match /operatorPilotSettings/{configId} {
        allow read: if isOwner() || isMember(sid);
        allow create, update: if configId == 'control' && isManager(sid) &&
          request.resource.data.keys().hasOnly(['enabled','updatedBy','updatedAt']) &&
          request.resource.data.keys().hasAll(['enabled','updatedBy','updatedAt']) &&
          request.resource.data.enabled is bool &&
          request.resource.data.updatedBy == request.auth.uid &&
          request.resource.data.updatedAt == request.time;
        allow delete: if false;
      }
      match /operatorPilotShifts/{shiftId} {
        allow read: if isManager(sid) ||
          (pilotOperator() && resource.data.operatorUid == request.auth.uid);
        function validPilot() {
          return request.resource.data.keys().hasOnly([
            'stationId','operatorUid','operatorName','kind','date','startedAt',
            'endedAt','status','readings','allocations','payments','note',
            'createdLocalAt','updatedAt','reviewStatus','reviewNote','reviewBy','reviewedAt'
          ]) && request.resource.data.keys().hasAll([
            'stationId','operatorUid','operatorName','kind','date','startedAt',
            'endedAt','status','readings','allocations','payments','note','createdLocalAt','updatedAt'
          ]) &&
          request.resource.data.stationId == sid &&
          request.resource.data.operatorUid == request.auth.uid &&
          request.resource.data.operatorName is string && request.resource.data.operatorName.size() <= 120 &&
          request.resource.data.kind in ['turno','medianoche'] &&
          request.resource.data.status in ['borrador','enviado'] &&
          request.resource.data.date is string && request.resource.data.date.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$') &&
          request.resource.data.startedAt is string && request.resource.data.startedAt.size() <= 25 &&
          request.resource.data.endedAt is string && request.resource.data.endedAt.size() <= 25 &&
          request.resource.data.note is string && request.resource.data.note.size() <= 500 &&
          request.resource.data.createdLocalAt is string && request.resource.data.createdLocalAt.size() <= 40 &&
          request.resource.data.readings is list && request.resource.data.readings.size() <= 40 &&
          request.resource.data.allocations is list && request.resource.data.allocations.size() <= 70 &&
          request.resource.data.payments is map &&
          request.resource.data.updatedAt == request.time;
        }
        allow create: if pilotOperator() && pilotEnabled() &&
          shiftId.matches('^pilot_[A-Za-z0-9_-]{12,100}$') && validPilot() &&
          !request.resource.data.keys().hasAny(['reviewStatus','reviewNote','reviewBy','reviewedAt']);
        allow update: if (
            pilotOperator() && pilotEnabled() && resource.data.operatorUid == request.auth.uid &&
            resource.data.status == 'borrador' && validPilot() &&
            request.resource.data.kind == resource.data.kind &&
            request.resource.data.operatorUid == resource.data.operatorUid &&
            request.resource.data.stationId == resource.data.stationId &&
            request.resource.data.createdLocalAt == resource.data.createdLocalAt &&
            !request.resource.data.keys().hasAny(['reviewStatus','reviewNote','reviewBy','reviewedAt'])
          ) || (
            isManager(sid) && resource.data.status == 'enviado' &&
            request.resource.data.diff(resource.data).affectedKeys().hasOnly([
              'reviewStatus','reviewNote','reviewBy','reviewedAt'
            ]) &&
            request.resource.data.reviewStatus in ['revisado','observado'] &&
            request.resource.data.reviewNote is string && request.resource.data.reviewNote.size() <= 500 &&
            request.resource.data.reviewBy == request.auth.uid &&
            request.resource.data.reviewedAt == request.time
          );
        allow delete: if false;
      }
      // Lecturas compartidas entre compañeros: sin información de caja.
      match /operatorPilotReadings/{readingId} {
        allow read: if isOwner() || isMember(sid);
        function validReading() {
          return request.resource.data.keys().hasOnly([
            'shiftId','operatorUid','operatorName','stationId','hoseId','hoseName',
            'meterType','phase','reading','observedAt','day','updatedAt'
          ]) && request.resource.data.keys().hasAll([
            'shiftId','operatorUid','stationId','hoseId','meterType','phase',
            'reading','observedAt','day','updatedAt'
          ]) &&
          request.resource.data.stationId == sid &&
          request.resource.data.operatorUid == request.auth.uid &&
          request.resource.data.shiftId is string &&
          request.resource.data.hoseId is string &&
          request.resource.data.meterType in ['mecanico','digital'] &&
          request.resource.data.phase in ['inicio','final','medianoche'] &&
          request.resource.data.reading is number && request.resource.data.reading >= 0 &&
          request.resource.data.observedAt is string && request.resource.data.observedAt.size() <= 25 &&
          request.resource.data.day is string && request.resource.data.day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$') &&
          request.resource.data.updatedAt == request.time;
        }
        allow create: if pilotOperator() && pilotEnabled() && validReading();
        allow update: if pilotOperator() && pilotEnabled() &&
          resource.data.operatorUid == request.auth.uid && validReading() &&
          request.resource.data.shiftId == resource.data.shiftId &&
          request.resource.data.hoseId == resource.data.hoseId &&
          request.resource.data.phase == resource.data.phase &&
          request.resource.data.meterType == resource.data.meterType;
        allow delete: if false;
      }
`;
body=body.replace(anchor,()=>block+anchor);
fs.copyFileSync(f,f+'.backup-before-operator-pilot-v0119');fs.writeFileSync(f,body);
console.log('Reglas restringidas del piloto agregadas. Verificar el diff antes del despliegue.');
