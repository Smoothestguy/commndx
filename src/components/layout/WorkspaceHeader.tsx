import { useEffect,useState } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft,ChevronRight,Clock,PanelTopOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover,PopoverContent,PopoverTrigger } from '@/components/ui/popover';
import { useAppTabs } from '@/hooks/useAppTabs';
import { useRecentPages } from '@/hooks/useRecentPages';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
export function WorkspaceHeader(){
 const tabs=useAppTabs(),location=useLocation(),query=useQueryClient(),crumbs=useBreadcrumbs(),recent=useRecentPages(),[open,setOpen]=useState(false);
 const [labels,setLabels]=useState<Record<string,string>>({});
 useEffect(()=>{
  const collect=()=>{const next:Record<string,string>={};
   const visit=(data:unknown,depth=0)=>{if(!data||depth>3)return;if(Array.isArray(data)){data.forEach(v=>visit(v,depth+1));return;}if(typeof data==='object'){const r=data as Record<string,unknown>;if(typeof r.id==='string'){const title=typeof r.name==='string'?r.name:typeof r.title==='string'?r.title:typeof r.first_name==='string'?`${r.first_name} ${r.last_name||''}`.trim():null;if(title)next[r.id]=title;}Object.values(r).forEach(v=>{if(v&&typeof v==='object')visit(v,depth+1);});}};
   query.getQueryCache().getAll().forEach(q=>visit(q.state.data));setLabels(next);
  };collect();return query.getQueryCache().subscribe(collect);
 },[query,location.pathname]);
 const label=(path:string,fallback:string)=>labels[path.split('/').at(-1)||'']||fallback;
 return <div data-workspace-header className="flex min-h-11 items-center gap-2 border-b border-border bg-background px-3 py-1">
  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Back" title="Back" disabled={!tabs.canGoBack} onClick={tabs.goBack}><ArrowLeft className="h-4 w-4"/></Button>
  <nav aria-label="Page breadcrumbs" className="min-w-0 flex-1"><ol className="flex items-center gap-1 text-sm min-w-0">{crumbs.map((c,i)=><li key={c.path} className={`${i===crumbs.length-1?'flex min-w-0':'hidden md:flex'} items-center gap-1`}>{i>0&&<ChevronRight className="hidden md:block h-3 w-3 shrink-0 text-muted-foreground"/>}<Link to={c.path} title={label(c.path,c.label)} aria-current={i===crumbs.length-1?'page':undefined} className="truncate hover:underline">{label(c.path,c.label)}</Link></li>)}</ol></nav>
  <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Recent pages" title="Recent pages"><Clock className="h-4 w-4"/></Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-2"><p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Recent pages</p>{recent.map(r=><Link key={r.path} to={r.path} onClick={()=>setOpen(false)} className="flex items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"><span className="truncate">{label(r.path.split('?')[0],r.name)}</span><time className="shrink-0 text-xs text-muted-foreground" dateTime={new Date(r.visitedAt).toISOString()}>{new Date(r.visitedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></Link>)}</PopoverContent></Popover>
  <Button variant="ghost" size="icon" className="hidden md:inline-flex h-10 w-10 shrink-0" aria-label="Open in new tab" title="Open in new tab" onClick={()=>tabs.openTab(location.pathname+location.search+location.hash)}><PanelTopOpen className="h-4 w-4"/></Button>
 </div>;
}
