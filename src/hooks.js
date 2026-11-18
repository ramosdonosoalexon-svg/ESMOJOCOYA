import {useEffect,useState} from 'react';
import {onSnapshot} from 'firebase/firestore';
export function useDocuments(refFactory,deps){
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    if(deps.some(x=>!x)){setItems([]);setLoading(false);return;}
    setLoading(true);setError('');
    const unsubscribe=onSnapshot(refFactory(), snap=>{
      setItems(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);
    },err=>{setError(err.message);setLoading(false);});
    return ()=>unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },deps);
  return {items,loading,error};
}
