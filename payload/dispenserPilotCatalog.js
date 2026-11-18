// Catálogo visual: no determina mangueras físicas ni crea datos en Firebase.
export const MODEL_PARTS = Object.freeze({
  gasolina: {dispenser:'Dispensador_Gasolina_Rojo',hose:'Manguera_Gasolina_Roja',label:'Gasolina'},
  diesel: {dispenser:'Dispensador_Diesel_Azul',hose:'Manguera_Diesel_Azul',label:'Diésel'},
  gnv: {dispenser:'Dispensador_GNV_Plomo',hose:'Manguera_GNV_Naranja',label:'GNV'},
});
export const PRM_NAME='PRM_Puente_Regulacion_Medicion_Amarillo';
export const FAMILY_ORDER=['gasolina','diesel','gnv'];
export function hoseFamily(productCode){
  switch(String(productCode||'').toUpperCase()){
    case 'GE':case 'GE_PLUS':return 'gasolina';
    case 'DO':case 'D_ULS':return 'diesel';
    case 'GNV':return 'gnv';
    default:return null;
  }
}
export function availableDispenserFamilies(hoses=[]){
  const set=new Set((Array.isArray(hoses)?hoses:[]).filter(h=>h&&h.active!==false).map(h=>hoseFamily(h.productCode)).filter(Boolean));
  return FAMILY_ORDER.filter(f=>set.has(f));
}
export function familyFromModelName(name){
  for(const [f,parts] of Object.entries(MODEL_PARTS))if(parts.dispenser===name||parts.hose===name)return f;
  return null;
}
export function candidateHoses(hoses=[],family,chosen=[]){
  const ids=new Set(chosen);
  return (Array.isArray(hoses)?hoses:[]).filter(h=>h&&h.active!==false&&hoseFamily(h.productCode)===family&&!ids.has(h.id));
}

// Sólo elementos del combustible elegido, sin eliminar registros de otros sectores.
export function familyHoses(hoses=[],selectedFamily=null){
 return (Array.isArray(hoses)?hoses:[]).filter(h=>h&&h.active!==false&&(!selectedFamily||hoseFamily(h.productCode)===selectedFamily));
}
// Conservar el índice original al modificar o quitar un meter filtrado.
export function familyReadingRows(readings=[],selectedFamily=null){
 return (Array.isArray(readings)?readings:[]).map((row,index)=>({row,index})).filter(({row})=>!selectedFamily||hoseFamily(row.productCode)===selectedFamily);
}
