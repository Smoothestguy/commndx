import { createContext,createElement,useCallback,useContext,useEffect,useRef,useState,type ReactNode } from 'react';
import { useLocation,useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationGuard } from '@/contexts/NavigationGuardContext';
import { appHistory } from '@/lib/appHistory';
import { limitWorkspaceTabs,migrateWorkspaceTabs,type WorkspaceTab } from '@/lib/workspaceNavigation';
import { getPageName } from './useRecentPages';
export type AppTab=WorkspaceTab;
export const HOME_KEY='/';
export const shouldTrackWorkspace=(path:string)=>!['/vendors/onboarding','/auth','/unauthorized','/apply','/onboard','/portal','/subcontractor','/punch','/kiosk','/sign','/agency','/customer','/join'].some(p=>path===p||path.startsWith(p+'/'));
function useWorkspaceState(){
 const {user}=useAuth(),location=useLocation(),navigate=useNavigate(),guard=useNavigationGuard();
 const storageKey=`workspaceTabs:v2:${user?.id||'signed-out'}`;
 const read=()=>{try{const saved=sessionStorage.getItem(storageKey);return migrateWorkspaceTabs(JSON.parse(saved||sessionStorage.getItem('workspaceTabs')||'[]'));}catch{return migrateWorkspaceTabs([]);}};
 const [tabs,setTabs]=useState<AppTab[]>(read),[activeKey,setActiveKey]=useState(()=>{try{return sessionStorage.getItem(`${storageKey}:active`)||'/';}catch{return '/';}});
 const tabsRef=useRef(tabs),activeRef=useRef(activeKey),pending=useRef<{kind:'open'|'activate';key:string;path:string}|null>(null);
 const browserEntries=useRef([location.key]),browserIndex=useRef(0);
 const update=useCallback((next:AppTab[],active:string)=>{tabsRef.current=next;activeRef.current=active;setTabs(next);setActiveKey(active);try{sessionStorage.setItem(storageKey,JSON.stringify(next));sessionStorage.setItem(`${storageKey}:active`,active);}catch{}},[storageKey]);
 useEffect(()=>{let saved=read();let active='/';try{active=sessionStorage.getItem(`${storageKey}:active`)||'/';}catch{}
  const path=location.pathname+location.search+location.hash;
  if(path!=='/'&&active==='/'){active=saved.find(t=>t.path===path&&t.key!=='/')?.key||crypto.randomUUID();if(!saved.some(t=>t.key===active))saved=limitWorkspaceTabs([...saved,{key:active,path,label:getPageName(location.pathname),openedAt:Date.now(),lastUsed:Date.now(),pinned:false,entries:[location.key],index:0}]);}
  if(!saved.some(t=>t.key===active))active='/';update(saved,active);
 },[storageKey]);
 useEffect(()=>appHistory.listen(({location:loc,action})=>{
  const known=browserEntries.current.indexOf(loc.key);
  if(known>=0)browserIndex.current=known;
  else if(action==='REPLACE')browserEntries.current[browserIndex.current]=loc.key;
  else{browserEntries.current=[...browserEntries.current.slice(0,browserIndex.current+1),loc.key];browserIndex.current=browserEntries.current.length-1;}
  if(!shouldTrackWorkspace(loc.pathname))return;
  const path=loc.pathname+loc.search+loc.hash,now=Date.now();let next=tabsRef.current,active=activeRef.current;
  const intent=pending.current;pending.current=null;
  if(!intent&&action==='POP'){const owner=next.find(t=>t.entries.includes(loc.key));if(owner)active=owner.key;}
  if(intent){active=intent.key;if(intent.kind==='open')next=[...next,{key:active,path,label:getPageName(loc.pathname),openedAt:now,lastUsed:now,pinned:false,entries:[loc.key],index:0}];}
  if(active==='/'&&path!=='/'){active=crypto.randomUUID();next=[...next,{key:active,path,label:getPageName(loc.pathname),openedAt:now,lastUsed:now,pinned:false,entries:[loc.key],index:0}];}
  if(!next.some(t=>t.key===active))active=next[0]?.key||'/';
  next=next.map(t=>{if(t.key!==active)return t;let entries=t.entries,index=t.index;
   if(intent?.kind==='activate'){entries=[...entries.slice(0,index+1),loc.key];index=entries.length-1;}
   if(!intent){const found=entries.indexOf(loc.key);if(found>=0)index=found;else if(action==='REPLACE')entries=entries.map((v,i)=>i===index?loc.key:v);else {entries=[...entries.slice(0,index+1),loc.key];index=entries.length-1;}}
   return {...t,path,label:getPageName(loc.pathname),lastUsed:now,entries,index};});
  update(limitWorkspaceTabs(next),active);
 }),[update]);
 // Align direct loads with the saved current workspace without opening an extra tab.
 useEffect(()=>{if(!shouldTrackWorkspace(location.pathname))return;const path=location.pathname+location.search+location.hash;const active=activeRef.current;update(tabsRef.current.map(t=>t.key===active?{...t,path,label:getPageName(location.pathname),entries:t.entries.includes(location.key)?t.entries:[location.key],index:t.entries.includes(location.key)?t.entries.indexOf(location.key):0}:t),active);},[]);
 const openTab=useCallback((path:string)=>guard.request(()=>{const key=crypto.randomUUID();pending.current={kind:'open',key,path};navigate(path);}),[guard,navigate]);
 const activateTab=useCallback((key:string)=>guard.request(()=>{const tab=tabsRef.current.find(t=>t.key===key);if(!tab||key===activeRef.current)return;pending.current={kind:'activate',key,path:tab.path};navigate(tab.path);}),[guard,navigate]);
 const closeTab=useCallback((key:string)=>guard.request(()=>{if(key==='/')return;const next=tabsRef.current.filter(t=>t.key!==key);if(key===activeRef.current){const fallback=next[0];if(fallback){pending.current={kind:'activate',key:fallback.key,path:fallback.path};update(next,fallback.key);navigate(fallback.path);}}else update(next,activeRef.current);}),[guard,update,navigate]);
 const pinTab=useCallback((key:string)=>update(limitWorkspaceTabs(tabsRef.current.map(t=>t.key===key&&key!=='/'?{...t,pinned:!t.pinned}:t)),activeRef.current),[update]);
 const closeOthers=useCallback((key:string)=>guard.request(()=>{update(tabsRef.current.filter(t=>t.pinned||t.key===key),key);const tab=tabsRef.current.find(t=>t.key===key);if(tab)navigate(tab.path);}),[guard,update,navigate]);
 const closeAll=useCallback(()=>guard.request(()=>{const keep=tabsRef.current.filter(t=>t.pinned);update(keep,'/');pending.current={kind:'activate',key:'/',path:'/'};navigate('/');}),[guard,update,navigate]);
 const tab=tabs.find(t=>t.key===activeKey);
 const canGoBack=!!tab&&tab.index>0;
 const goBack=()=>{if(!tab||tab.index<1)return;const target=browserEntries.current.indexOf(tab.entries[tab.index-1]);if(target>=0)navigate(target-browserIndex.current);};
 return {tabs,activeKey,openTab,activateTab,closeTab,pinTab,closeOthers,closeAll,canGoBack,goBack};
}
const TabsContext=createContext<ReturnType<typeof useWorkspaceState>|null>(null);
export function WorkspaceNavigationProvider({children}:{children:ReactNode}){const value=useWorkspaceState();return createElement(TabsContext.Provider,{value},children);}
export function useAppTabs(){const value=useContext(TabsContext);if(!value)throw new Error('WorkspaceNavigationProvider required');return value;}
