import {useEffect,useState} from 'react';
import {limit,onSnapshot,orderBy,query,where} from 'firebase/firestore';
import {stationPath} from './data';

/** Una lectura por tanque: evita descargar años de inventarios solo para dibujar el nivel. */
export function useLatestTankReadings(stationId,tanks) {
  const ids=(tanks||[]).filter(t=>t.productCode!=='GNV'&&t.active!==false).map(t=>t.id).sort().join('|');
  const [state,setState]=useState({items:new Map(),loading:true,error:''});
  useEffect(()=>{
    const tankIds=ids?ids.split('|'):[];
    setState({items:new Map(),loading:tankIds.length>0,error:''});
    if(!stationId||tankIds.length===0)return;
    let cancelled=false;
    const pending=new Set(tankIds);
    const unsubs=tankIds.map(tankId=>onSnapshot(query(
      stationPath(stationId,'inventoryReadings'),
      where('tankId','==',tankId),
      orderBy('date','desc'),
      limit(1)
    ),snap=>{
      if(cancelled)return;
      pending.delete(tankId);
      setState(old=>{
        const items=new Map(old.items);
        const entry=snap.docs[0];
        if(entry)items.set(tankId,{id:entry.id,...entry.data()});
        else items.delete(tankId);
        return {items,loading:pending.size>0,error:old.error};
      });
    },err=>{
      if(cancelled)return;
      pending.delete(tankId);
      setState(old=>({...old,loading:pending.size>0,
        error:err.code==='failed-precondition'
          ? 'Falta crear el índice de inventarios de Firebase. Publica firestore:indexes antes de utilizar el libro.'
          : err.message}));
    }));
    return ()=>{cancelled=true;unsubs.forEach(unsub=>unsub());};
  },[stationId,ids]);
  return state;
}
