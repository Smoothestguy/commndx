import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
export function EventGrid({headers,rows,mobile=false,empty='No records yet.'}:{headers:string[];rows:{id:string;cells:ReactNode[];sort?:string[]}[];empty?:string;mobile?:boolean}) {
 const [sort,setSort]=useState({index:-1,reverse:false});
 const ordered=[...rows].sort((a,b)=>{
  if(sort.index<0)return 0;
  const left=a.sort?.[sort.index]??String(a.cells[sort.index]);
  const right=b.sort?.[sort.index]??String(b.cells[sort.index]);
  return left.localeCompare(right,undefined,{numeric:true})*(sort.reverse?-1:1);
 });
 return <><div className={`${mobile?'hidden md:block ':''}overflow-x-auto border border-border rounded-md`}><table className="w-full text-sm"><thead className="bg-muted/60"><tr>{headers.map((h,i)=><th key={h} className="text-left px-3 py-2 whitespace-nowrap border-b border-border"><Button variant="ghost" size="sm" className="h-7 px-0 gap-1" onClick={()=>setSort({index:i,reverse:sort.index===i?!sort.reverse:false})}>{h}<ArrowUpDown className="h-3 w-3 text-muted-foreground"/></Button></th>)}</tr></thead><tbody>{ordered.map(r=><tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">{r.cells.map((c,i)=><td key={i} className="px-3 py-2 align-middle whitespace-nowrap">{c}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={headers.length} className="p-8 text-center text-muted-foreground">{empty}</td></tr>}</tbody></table></div>{mobile&&<div className="md:hidden divide-y divide-border border-y border-border">{ordered.map(r=><div key={r.id} className="py-3 space-y-2 text-sm"><div className="flex justify-between items-start gap-3"><div className="min-w-0"><p className="font-semibold break-words">{r.cells[0]}</p><p className="text-muted-foreground break-words">{r.cells[1]}</p></div><div className="shrink-0">{r.cells[r.cells.length-1]}</div></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{r.cells.slice(2,-1).map((c,i)=><span key={i} className="flex gap-1 items-center"><span className="text-muted-foreground">{headers[i+2]}:</span>{c}</span>)}</div></div>)}{!rows.length&&<p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>}</div>}</>;
}
