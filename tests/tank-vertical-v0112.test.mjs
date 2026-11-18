import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tankLiquidLayers,TANK_GAS_COLORS} from '../src/tankVisualMath.js';
import {mixAtDate} from '../src/gasolineVisual.js';

function close(actual,expected,delta=0.001){assert.ok(Math.abs(actual-expected)<delta,`${actual} != ${expected}`)}

test('llenado 62% y mezcla GE 30.9%, GE+ 69.1%: rojo abajo, café arriba',()=>{
  const r=tankLiquidLayers(62,{GE:3090,GE_PLUS:6910,total:10000});
  assert.equal(r.known,true);close(r.totalHeight,96.72);close(r.top,87.28);
  close(r.geHeight,96.72*.309);close(r.plusHeight,96.72*.691);
  close(r.geTop,184-r.geHeight);close(r.plusTop+r.plusHeight,r.geTop);
  close(r.geHeight+r.plusHeight,r.totalHeight);
});
test('100% GE => todo rojo, 0% GE+; solo Plus => todo café',()=>{
  const a=tankLiquidLayers(50,{GE:10000,GE_PLUS:0,total:10000});
  const b=tankLiquidLayers(50,{GE:0,GE_PLUS:10000,total:10000});
  close(a.plusHeight,0);close(a.geHeight,78);close(b.geHeight,0);close(b.plusHeight,78);
});
test('dinámico: recepción de 12.000 y luego 10.000 L GE+ aumenta altura café',()=>{
  const model={tankId:'T',sourceProduct:'GE',timeline:[
    {at:'2026-11-09T20:00',balances:{GE:9000,GE_PLUS:12000}},
    {at:'2026-11-10T20:00',balances:{GE:3000,GE_PLUS:22000}}
  ]};
  const initial=[{tankId:'T',productCode:'GE',accountingLiters:17000}];
  const day8=tankLiquidLayers(60,mixAtDate(model,initial,'2026-11-08'));
  const day9=tankLiquidLayers(60,mixAtDate(model,initial,'2026-11-09'));
  const day10=tankLiquidLayers(60,mixAtDate(model,initial,'2026-11-10'));
  close(day8.plusHeight,0);
  assert.ok(day9.plusHeight>day8.plusHeight);
  assert.ok(day10.plusHeight>day9.plusHeight);
});
test('el porcentaje físico cambia la altura total sin alterar mezcla',()=>{
  const mix={GE:200,GE_PLUS:800,total:1000};
  const low=tankLiquidLayers(25,mix),high=tankLiquidLayers(80,mix);
  close(low.fillPercent,25);close(high.fillPercent,80);
  close(low.geRatio,high.geRatio);close(low.plusRatio,high.plusRatio);
  close(high.totalHeight/low.totalHeight,80/25);
});
test('sin estimación válida no se inventa una proporción de producto',()=>{
  for(const mix of [null,undefined,{}, {total:0,GE:0,GE_PLUS:0},{total:20,GE:-5,GE_PLUS:25}]){
    assert.equal(tankLiquidLayers(65,mix).known,false);
  }
});
test('nivel vacío o fuera de rango no desborda el depósito',()=>{
  close(tankLiquidLayers(0,{GE:100,GE_PLUS:100,total:200}).totalHeight,0);
  close(tankLiquidLayers(110,{GE:100,GE_PLUS:100,total:200}).top,28);
  close(tankLiquidLayers(-10,{GE:100,GE_PLUS:100,total:200}).totalHeight,0);
});
test('barra inferior, colores numéricos y medidores no cambian',()=>{
  const source=readFileSync(new URL('../src/Operations.jsx',import.meta.url),'utf8');
  assert.match(source,/tankLiquidLayers\(percentage,sharedGas\?mix:null\)/);
  assert.match(source,/fill={`url\(#\$\{regularId\}\)`}/);
  assert.match(source,/fill={`url\(#\$\{plusId\}\)`}/);
  assert.match(source,/className="ivs-track"/);
  assert.match(source,/linear-gradient\(90deg,\$\{GAS_COLOR\.GE\}/);
  assert.equal(TANK_GAS_COLORS.GE,'#be413c');
});
