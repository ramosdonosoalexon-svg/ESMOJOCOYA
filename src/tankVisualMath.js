/**
 * Representación del inventario físico con composición CONTABLE estimada.
 * El nivel viene exclusivamente del volumen físico / capacidad del tanque.
 * Las proporciones GE/GE+ provienen del modelo contable por fecha.
 * Las franjas horizontales NO representan estratificación química real.
 */
export const TANK_GAS_COLORS = Object.freeze({
  GE: '#be413c',        // rojo visible en el gráfico del tanque; los números siguen negros
  GE_DARK: '#922926',
  GE_PLUS: '#89502b',   // café de gasolina plus
  GE_PLUS_LIGHT: '#b47b4c',
  UNKNOWN: '#879eac'
});

export function tankLiquidLayers(physicalPercent, mix, bottomY=184, fullHeight=156){
  const percent=Number(physicalPercent);
  const fillPercent=Number.isFinite(percent)?Math.min(100,Math.max(0,percent)):0;
  const totalHeight=fullHeight*fillPercent/100;
  const top=bottomY-totalHeight;
  const ge=Number(mix?.GE);
  const plus=Number(mix?.GE_PLUS);
  const known=Boolean(mix) && Number.isFinite(ge) && Number.isFinite(plus) &&
    ge>=0 && plus>=0 && ge+plus>0 && Number(mix.total)>0;
  // Fracciones medidas sobre la parte LLENA, nunca sobre la altura total del tanque.
  const geRatio=known?ge/(ge+plus):null;
  const geHeight=known?totalHeight*geRatio:0;
  const plusHeight=known?totalHeight-geHeight:0;
  return {
    fillPercent,totalHeight,top,bottom:bottomY,known,
    geRatio,plusRatio:known?1-geRatio:null,
    geTop:bottomY-geHeight,geHeight,
    plusTop:top,plusHeight,
    boundaryY:bottomY-geHeight
  };
}
