// Recepciones de líquidos. La medición física pertenece al TANQUE;
// el desglose comercial/contable pertenece al PRODUCTO.
export const RECEPTION_FAMILIES = Object.freeze({
  GE:'gasolina', GE_PLUS:'gasolina', DO:'diesel', D_ULS:'diesel'
});
export const sameFamily=(a,b)=>Boolean(RECEPTION_FAMILIES[a]&&RECEPTION_FAMILIES[a]===RECEPTION_FAMILIES[b]);
export const familyProducts=code=>Object.keys(RECEPTION_FAMILIES).filter(x=>sameFamily(x,code));
export const roundL=value=>Math.round((value + Number.EPSILON)*1000)/1000;
const finiteNonNegative=n=>typeof n==='number' && Number.isFinite(n) && n>=0;

// Los meters mecánico y digital son dos representaciones del MISMO despacho:
// nunca se suman entre sí. En alimentación compartida se utiliza la asignación.
export function calculateMeterLine(row){
  const primary=row.primary;
  if(!['mecanico','digital'].includes(primary))throw new Error('Selecciona el medidor usado para contabilizar el despacho.');
  const meterTotals={};
  const normalizedReadings={};
  for(const type of ['mecanico','digital']){
    const values=row.readings?.[type];
    if(!values)continue;
    const initial=Number(values.initial), final=Number(values.final);
    if(values.initial===''||values.final===''||!finiteNonNegative(initial)||!finiteNonNegative(final)||final<initial)
      throw new Error(`Lecturas inválidas del meter ${type} en ${row.hoseName||'la manguera'}.`);
    meterTotals[type]=roundL(final-initial);
    normalizedReadings[type]={initial,final};
  }
  if(!Object.hasOwn(meterTotals,primary))throw new Error('Falta la lectura del meter principal.');
  const metersLiters=meterTotals[primary];
  const shared=Boolean(row.shared);
  const allocated=shared?Number(row.allocatedLiters):metersLiters;
  if(shared&&(row.allocatedLiters===''||!finiteNonNegative(allocated)||allocated>metersLiters))
    throw new Error('Indica los litros atribuibles a este tanque para la manguera de alimentación compartida.');
  return {
    hoseId:row.hoseId, hoseName:row.hoseName, dispenserName:row.dispenserName,
    productCode:row.productCode, primary, shared,
    readings:normalizedReadings,
    meterTotals, liters:metersLiters, allocatedLiters:roundL(allocated)
  };
}
export function calculateReception({startVolumeL,endVolumeL,documentLiters,otherIncomeLiters=0,meterMode='none',meterRows=[],meterCoverageComplete=false}){
  const numbers=[startVolumeL,endVolumeL,documentLiters,otherIncomeLiters].map(Number);
  if(numbers.some(n=>!finiteNonNegative(n)))throw new Error('Los volúmenes deben ser números válidos y no negativos.');
  const [before,after,doc,other]=numbers;
  if(!['none','meters'].includes(meterMode))throw new Error('Modo de meters inválido.');
  if(meterMode==='meters'&&meterRows.length===0)throw new Error('Selecciona al menos una manguera para registrar el despacho durante la recepción.');
  const checked=meterMode==='meters'?meterRows.map(calculateMeterLine):[];
  const meterLiters=roundL(checked.reduce((sum,r)=>sum+r.allocatedLiters,0));
  const salesByProductL={};
  for(const line of checked){
    if(!RECEPTION_FAMILIES[line.productCode])throw new Error('Selecciona el combustible despachado por cada manguera.');
    salesByProductL[line.productCode]=roundL((salesByProductL[line.productCode]||0)+line.allocatedLiters);
  }
  const physicalIncrease=roundL(after-before);
  const physicalReceived=roundL(physicalIncrease+meterLiters-other);
  const difference=roundL(physicalReceived-doc);
  const fullyMeasured=meterMode==='meters'&&meterCoverageComplete&&checked.every(r=>!r.shared || Number.isFinite(r.allocatedLiters));
  if(fullyMeasured&&physicalReceived<0)throw new Error('El cálculo da un volumen recibido negativo. Revisa las lecturas y las asignaciones de mangueras.');
  return {
    physicalIncreaseL:physicalIncrease,
    salesDuringReceptionL:meterMode==='meters'?meterLiters:null,
    physicalReceivedL:physicalReceived,
    transportDifferenceL:difference,
    quality:fullyMeasured?'verificable_con_meters':'provisional',
    meterLines:checked, salesByProductL
  };
}
export function receiptDisplayStatus(receipt){
  if(receipt.status==='anulada')return 'Anulada';
  return receipt.quality==='verificable_con_meters'?'Con meters':'Provisional';
}
