export function authorizationAlerts(levels: {line_kind:string;authorized:number}[], people:number, assets:number) {
  const positions=levels.filter(l=>l.line_kind==='position').reduce((n,l)=>n+Number(l.authorized),0);
  const equipment=levels.filter(l=>l.line_kind==='asset').reduce((n,l)=>n+Number(l.authorized),0);
  const under=Math.max(0,positions-people), over=Math.max(0,people-positions), assetUnder=Math.max(0,equipment-assets), assetOver=Math.max(0,assets-equipment);
  return [
    ...(under||assetUnder?[{kind:'under_auth',detail:[under?`${under} under authorized`:null,assetUnder?`${assetUnder} assets under authorized`:null].filter(Boolean).join(' · ')}]:[]),
    ...(over||assetOver?[{kind:'over_auth',detail:[over?`${over} over authorized`:null,assetOver?`${assetOver} assets over authorized`:null].filter(Boolean).join(' · ')}]:[]),
  ];
}
// The nullable personnel unique key does not dedupe location-only alerts.
export async function authorizationAlertId(location:string,day:string,kind:string) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`location-authorization:${location}:${day}:${kind}`));
  const bytes=new Uint8Array(digest).slice(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}