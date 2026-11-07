import * as React from "react";

import { cn } from "@/lib/utils";
import { clockValue, militaryDigits, normalizeMilitary, validMilitary } from '@/lib/militaryTime';

const inputClass = "flex h-[var(--density-input-height)] w-full rounded-[var(--density-radius-md)] border border-input bg-background px-3 py-2 text-[length:var(--density-font-base)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const MilitaryInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({value, defaultValue, onChange, onBlur, onPaste, className, placeholder, ...props}, ref) => {
  const [draft,setDraft] = React.useState(()=>militaryDigits(String(value ?? defaultValue ?? '')));
  const [touched,setTouched] = React.useState(false);
  const emitted = React.useRef(String(value ?? defaultValue ?? ''));
  const local = React.useRef<HTMLInputElement | null>(null);
  const id = React.useId();
  React.useEffect(()=>{const next=String(value ?? '');if(value !== undefined && next!==emitted.current){setDraft(militaryDigits(next));emitted.current=next;setTouched(false);}},[value]);
  const invalid = !!draft && (touched || draft.length>=4) && !validMilitary(draft);
  React.useEffect(()=>{local.current?.setCustomValidity(draft && !validMilitary(draft) ? 'Enter a valid military time from 0000 to 2359.' : '');},[draft]);
  const change=(next:string,event:React.ChangeEvent<HTMLInputElement>,finish=false)=>{
    const display=finish?normalizeMilitary(next):militaryDigits(next);
    setDraft(display);const canonical=validMilitary(display)&&display.length===4?clockValue(display):display;
    emitted.current=canonical;
    onChange?.({...event,target:{...event.target,value:canonical},currentTarget:{...event.currentTarget,value:canonical}});
  };
  return <div className="min-w-0"><input {...props} ref={node=>{local.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}} type="text" inputMode="numeric" value={draft} placeholder={placeholder?militaryDigits(placeholder):'HHmm'} className={cn(inputClass,className)} aria-invalid={invalid || undefined} aria-describedby={invalid?id:props['aria-describedby']} onChange={e=>change(e.target.value,e)} onBlur={e=>{setTouched(true);change(draft,e as unknown as React.ChangeEvent<HTMLInputElement>,true);onBlur?.(e);}} onPaste={e=>{onPaste?.(e);if(e.defaultPrevented)return;const pasted=e.clipboardData.getData('text').trim();if(validMilitary(pasted)){e.preventDefault();change(pasted,e as unknown as React.ChangeEvent<HTMLInputElement>,true);}}}/>{invalid&&<p id={id} role="alert" className="text-xs text-destructive mt-1">Enter a valid military time from 0000 to 2359.</p>}</div>;
});
MilitaryInput.displayName='MilitaryInput';

const DateMilitaryInput=React.forwardRef<HTMLInputElement,React.ComponentProps<'input'>>(({value,onChange,className,...props},ref)=>{
  const text=String(value??''),[day='',time='']=text.split('T');
  const emit=(event:React.ChangeEvent<HTMLInputElement>,d:string,t:string)=>onChange?.({...event,target:{...event.target,value:d?`${d}T${t}`:''},currentTarget:{...event.currentTarget,value:d?`${d}T${t}`:''}});
  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,0.6fr)] gap-2"><input {...props} ref={ref} type="date" value={day} className={cn(inputClass,className)} onChange={e=>emit(e,e.target.value,time)}/><MilitaryInput aria-label={props['aria-label']?`${props['aria-label']} time`:'Time'} disabled={props.disabled} required={props.required} value={time} onChange={e=>emit(e,day,e.target.value)} className={className}/></div>;
});
DateMilitaryInput.displayName='DateMilitaryInput';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if(type==='time')return <MilitaryInput {...props} ref={ref} className={className}/>;
    if(type==='datetime-local')return <DateMilitaryInput {...props} ref={ref} className={className}/>;
    return (
      <input
        type={type}
        className={cn(
          "flex h-[var(--density-input-height)] w-full rounded-[var(--density-radius-md)] border border-input bg-background px-3 py-2 text-[length:var(--density-font-base)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
