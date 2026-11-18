import test from 'node:test';
import assert from 'node:assert/strict';
import {volumeForHeight,extractCalibrationPoints,sortRegistered} from '../src/calibrationMath.js';
test('interpolación y límites en mm/litros',()=>{
 const p=[{mm:0,liters:0},{mm:10,liters:110},{mm:20,liters:220}];
 assert.equal(volumeForHeight(p,5),55);
 assert.equal(volumeForHeight(p,10),110);
 assert.equal(volumeForHeight(p,-1),null);
 assert.equal(volumeForHeight(p,21),null);
});
test('extrae columnas D y E de la matriz con cabeceras',()=>{
 const rows=Array.from({length:30},()=>Array(10).fill(null));
 rows[10][3]='ALTURA DESDE EL PUNTO DE MEDICION (mm)';rows[10][4]='VOLUMEN (l)';
 for(let i=0;i<14;i++){rows[12+i][3]=i;rows[12+i][4]=i*11;}
 const points=extractCalibrationPoints(rows);
 assert.equal(points.length,14);
 assert.deepEqual(points[13],{mm:13,liters:143});
});
test('orden de registro estable',()=>{
 const a={id:'z',name:'Dispenser 10',createdAt:{toMillis:()=>100}};
 const b={id:'a',name:'Dispenser 2',createdAt:{toMillis:()=>10}};
 assert.deepEqual(sortRegistered([a,b]).map(x=>x.id),['a','z']);
});
