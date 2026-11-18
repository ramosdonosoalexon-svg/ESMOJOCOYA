// Compatibilidad con mangueras creadas en las primeras versiones del sistema.
// Aquellas guardaban feedTankIds pero no productCode. La reconstrucción es
// únicamente en memoria: no altera ni reescribe los documentos de Firestore.
export function resolveHoseProductCode(hose, tanks = []) {
  if (typeof hose?.productCode === 'string' && hose.productCode.trim()) {
    return hose.productCode.trim();
  }
  const tankIds = Array.isArray(hose?.feedTankIds)
    ? hose.feedTankIds
    : hose?.tankId ? [hose.tankId] : [];
  for (const tankId of tankIds) {
    const tank = tanks.find(item => item.id === tankId);
    if (typeof tank?.productCode === 'string' && tank.productCode.trim()) {
      return tank.productCode.trim();
    }
  }
  return null;
}

export function resolveLegacyHoses(hoses = [], tanks = []) {
  return hoses.map(hose => {
    const resolved = resolveHoseProductCode(hose, tanks);
    return hose.productCode || !resolved ? hose : {...hose, productCode: resolved};
  });
}
