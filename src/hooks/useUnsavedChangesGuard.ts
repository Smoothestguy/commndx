import { useEffect,useRef } from 'react';
import { useNavigationGuard } from '@/contexts/NavigationGuardContext';
export function useUnsavedChangesGuard(isDirty:boolean) {
 const id=useRef(Symbol('unsaved')),guard=useNavigationGuard();
 useEffect(()=>{guard.register(id.current,isDirty);return ()=>guard.register(id.current,false);},[guard.register,isDirty]);
 return guard.request;
}