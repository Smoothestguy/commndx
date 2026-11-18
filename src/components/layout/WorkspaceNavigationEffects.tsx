import { useEffect,useRef } from 'react';
import { useLocation,useNavigationType } from 'react-router-dom';
import { useAppTabs,shouldTrackWorkspace } from '@/hooks/useAppTabs';
import { useAuth } from '@/contexts/AuthContext';
export function WorkspaceNavigationEffects(){
 const tabs=useAppTabs(),location=useLocation(),action=useNavigationType(),{user}=useAuth();
 const scope=`workspaceScroll:${user?.id||'signed-out'}`;
 const positions=useRef<Record<string,{y:number;containers:Record<string,number>}>>({});
 const routeKey=useRef(location.key),restoring=useRef(false);
 useEffect(()=>{try{positions.current=JSON.parse(sessionStorage.getItem(scope)||'{}');}catch{}},[scope]);
 useEffect(()=>{
  const internal=(event:MouseEvent)=>{if(!event.ctrlKey&&!event.metaKey&&event.button!==1)return;const anchor=(event.target as Element)?.closest?.('a[href]');if(!anchor)return;const url=new URL(anchor.getAttribute('href')||'',window.location.href);if(url.origin!==window.location.origin||!shouldTrackWorkspace(url.pathname)||anchor.hasAttribute('download'))return;event.preventDefault();event.stopPropagation();tabs.openTab(url.pathname+url.search+url.hash);};
  document.addEventListener('click',internal,true);document.addEventListener('auxclick',internal,true);
  return ()=>{document.removeEventListener('click',internal,true);document.removeEventListener('auxclick',internal,true);};
 },[tabs.openTab]);
 useEffect(()=>{
  const save=()=>{if(restoring.current)return;const containers:Record<string,number>={};document.querySelectorAll<HTMLElement>('main [class*="overflow"], main [data-scroll-restoration]').forEach((el,i)=>{if(el.scrollHeight>el.clientHeight)containers[el.id||`${el.tagName}:${i}`]=el.scrollTop;});positions.current[routeKey.current]={y:window.scrollY,containers};try{sessionStorage.setItem(scope,JSON.stringify(positions.current));}catch{}};
  document.addEventListener('scroll',save,true);return ()=>document.removeEventListener('scroll',save,true);
 },[scope]);
 useEffect(()=>{
  routeKey.current=location.key;const saved=positions.current[location.key];let stopped=false,tries=0;restoring.current=true;
  const restore=()=>{if(stopped)return;const position=action==='POP'?saved:undefined;window.scrollTo(0,position?.y||0);if(position)document.querySelectorAll<HTMLElement>('main [class*="overflow"], main [data-scroll-restoration]').forEach((el,i)=>{const y=position.containers[el.id||`${el.tagName}:${i}`];if(y!==undefined)el.scrollTop=y;});if(tries++<25)timer=setTimeout(restore,100);else restoring.current=false;};
  let timer=setTimeout(restore,30);const stop=()=>{stopped=true;restoring.current=false;clearTimeout(timer);};window.addEventListener('wheel',stop,{once:true});window.addEventListener('touchstart',stop,{once:true});
  return ()=>{stop();window.removeEventListener('wheel',stop);window.removeEventListener('touchstart',stop);};
 },[location.key,action]);
 return null;
}
