import readWorkbook from 'read-excel-file/browser';
import {extractCalibrationPoints} from './calibrationMath';

export async function loadVolumetricWorkbook(file) {
  if (!file || !/\.(xlsx|xlsm)$/i.test(file.name))
    throw new Error('Selecciona un archivo .xlsx o .xlsm. El formato .xls antiguo debe convertirse a .xlsx.');
  if(file.size > 15*1024*1024) throw new Error('El Excel supera 15 MB. Exporta solo las tablas de calibración.');
  let sheets;
  try { sheets = await readWorkbook(file); }
  catch { throw new Error('No se pudo leer el Excel. Si es .xlsm, guarda una copia como .xlsx y vuelve a cargarla.'); }
  return sheets.map(s=>{
    try {return {name:s.sheet,points:extractCalibrationPoints(s.data),error:null};}
    catch(err){return {name:s.sheet,points:[],error:err.message};}
  });
}
