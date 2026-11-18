import { useEffect,useRef,useState } from 'react';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
/** Baseline after editor initialization; saves/closing disable the guard. */
export function useUnsavedFormGuard(value:unknown,enabled:boolean,ready=true) {
 const serialized=JSON.stringify(value),latest=useRef(serialized),[baseline,setBaseline]=useState<string|null>(null);
 latest.current=serialized;
 useEffect(()=>{
  setBaseline(null);
  if(!enabled||!ready)return;
  const timer=setTimeout(()=>setBaseline(latest.current),0);
  return ()=>clearTimeout(timer);
 },[enabled,ready]);
 return useUnsavedChangesGuard(enabled&&baseline!==null&&baseline!==serialized);
}