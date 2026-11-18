import { createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode } from 'react';
import { Router } from 'react-router-dom';
import { appHistory } from '@/lib/appHistory';
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel } from '@/components/ui/alert-dialog';
const GuardContext=createContext<{register:(id:symbol,dirty:boolean)=>void;request:(action:()=>void)=>void}>({register:()=>{},request:action=>action()});
export function AppNavigationRouter({children}:{children:ReactNode}) {
 const [state,setState]=useState({action:appHistory.action,location:appHistory.location});
 const dirty=useRef(new Set<symbol>()),pending=useRef<(()=>void)|null>(null),[confirm,setConfirm]=useState(false);
 const [dirtyCount,setDirtyCount]=useState(0);
 const register=useCallback((id:symbol,value:boolean)=>{if(value)dirty.current.add(id);else dirty.current.delete(id);setDirtyCount(dirty.current.size);},[]);
 const request=useCallback((action:()=>void)=>{if(dirty.current.size){pending.current=action;setConfirm(true);}else action();},[]);
 useEffect(()=>appHistory.listen(setState),[]);
 useEffect(()=>{
  let unblock=()=>{};
  if(dirtyCount>0)unblock=appHistory.block(tx=>{
   if(!dirty.current.size){unblock();tx.retry();return;}
   pending.current=()=>{unblock();tx.retry();};setConfirm(true);
  });
  const unload=(e:BeforeUnloadEvent)=>{if(dirty.current.size){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',unload);
  return ()=>{unblock();window.removeEventListener('beforeunload',unload);};
 },[dirtyCount]);
 return <GuardContext.Provider value={{register,request}}><Router location={state.location} navigationType={state.action} navigator={appHistory}>{children}</Router>
 <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="z-[100]" aria-describedby="navigation-leave-description"><AlertDialogHeader><AlertDialogTitle>You have unsaved changes — leave anyway?</AlertDialogTitle><AlertDialogDescription id="navigation-leave-description">Your unsaved edits will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>{pending.current=null;}}>Stay</AlertDialogCancel><AlertDialogAction onClick={()=>{const action=pending.current;pending.current=null;dirty.current.clear();setDirtyCount(0);setConfirm(false);action?.();}}>Leave anyway</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </GuardContext.Provider>;
}
export const useNavigationGuard=()=>useContext(GuardContext);