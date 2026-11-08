import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
export function EventGrid({headers,rows,empty='No records yet.'}:{headers:string[];rows:{id:string;cells:ReactNode[];sort?:string[]}[];empty?:string}) {
 const [sort,setSort]=useState({index:-1,reverse:false});
 const ordered=[...rows].sort((a,b)=>sort.index<0?0:(a.sort?.[sort.index]??String(a.cells[sort.index])).localeCompare(b.sort?.[sort.index]??String(b.cells[sort.index])),undefined,{numeric:true})*(sort.reverse?-1:1));
 return <div className="overflow-x-auto border border-border rounded-md"><table className="w-full text-sm"><thead className="bg-muted/60"><tr>{headers.map((h,i)=><th key={h} className="text-left px-3 py-2 whitespace-nowrap border-b border-border"><Button variant="ghost" size="sm" className="h-7 px-0 gap-1" onClick={()=>setSort({index:i,reverse:sort.index===i?!sort.reverse:false})}>{h}<ArrowUpDown className="h-3 w-3 text-muted-foreground"/></Button></th>)}</tr></thead><tbody>{ordered.map(r=><tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">{r.cells.map((c,i)=><td key={i} className="px-3 py-2 align-middle whitespace-nowrap">{c}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={headers.length} className="p-8 text-center text-muted-foreground">{empty}</td></tr>}</tbody></table></div>;
}
