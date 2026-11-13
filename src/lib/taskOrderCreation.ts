import type { AuthorizationLevel, TaskOrderKind } from './locationAuthorization';
export type OrderLineDraft = {id:string;line_kind:'position'|'asset';label:string;qty:string;rate?:string};
export const deductive = (kind:string) => kind==='decrease'||kind==='demobilization';
export const blankOrderLine = ():OrderLineDraft => ({id:crypto.randomUUID(),line_kind:'position',label:'',qty:'1'});
export function deductionDrafts(levels:AuthorizationLevel[]):OrderLineDraft[] {
  return levels.filter(l=>l.authorized>0).map(l=>({id:`${l.line_kind}:${l.label}`,line_kind:l.line_kind==='asset'?'asset':'position',label:l.label,qty:'0'}));
}
export function currentLevel(levels:AuthorizationLevel[],line:Pick<OrderLineDraft,'line_kind'|'label'>) {
  return levels.filter(l=>l.line_kind===line.line_kind&&l.label.trim().toLowerCase()===line.label.trim().toLowerCase()).reduce((n,l)=>n+Number(l.authorized),0);
}
export function creationLines(kind:TaskOrderKind,drafts:OrderLineDraft[],levels:AuthorizationLevel[],wholeNumbers=true) {
  const down=deductive(kind);
  const lines=drafts.flatMap(l=>{
    const qty=Number(l.qty);
    if(!Number.isFinite(qty)||(wholeNumbers&&!Number.isSafeInteger(qty))||qty<0||(!down&&qty===0))throw new Error(wholeNumbers?'Enter a valid whole-number quantity':'Enter a valid quantity');
    if(down&&qty>currentLevel(levels,l))throw new Error(`${l.label}: deduction exceeds current authorization`);
    if(down&&qty===0)return [];
    if(!l.label.trim())throw new Error('Complete each label');
    return [{line_kind:l.line_kind,label:l.label.trim(),qty_delta:down?-qty:qty}];
  });
  if(!lines.length)throw new Error(down?'Enter at least one deduction':'Add at least one line');
  return lines;
}
export function needsDemobePrompt(kind:TaskOrderKind,lines:ReturnType<typeof creationLines>,levels:AuthorizationLevel[]) {
  return kind==='demobilization'||kind==='decrease'&&lines.some(l=>-l.qty_delta>=currentLevel(levels,l));
}
export function nextTaskOrderNumber(numbers:string[]) {
  return `TO-${Math.max(0,...numbers.map(n=>/^(?:TO-)?(\d+)$/i.exec(n.trim())).map(m=>m?Number(m[1]):0))+1}`;
}
export function editableLevels(levels:AuthorizationLevel[],oldLines:{line_kind:string;label:string;qty_delta:number}[]) {
 const result=levels.map(l=>({...l}));
 for(const l of oldLines){const found=result.find(r=>r.line_kind===l.line_kind&&r.label===l.label);if(found)found.authorized-=l.qty_delta;else result.push({line_kind:l.line_kind,label:l.label,authorized:-l.qty_delta});}
 return result.map(l=>({...l,authorized:Math.max(0,l.authorized)}));
}
