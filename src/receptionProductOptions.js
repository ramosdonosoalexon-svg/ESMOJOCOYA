import {familyProducts} from './receptionMath.js';

/**
 * Las opciones nuevas se limitan a los productos habilitados.
 * El producto ANTERIOR puede ser cualquiera de la familia del tanque:
 * por eso el segundo argumento es opcional al mostrar el historial.
 */
export function productOptions(tank, enabledCodes) {
  if (!tank) return [];
  const products = familyProducts(tank.productCode);
  return Array.isArray(enabledCodes)
    ? products.filter(code => enabledCodes.includes(code))
    : products;
}
