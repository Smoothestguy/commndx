import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { constructionModules } from '@/lib/appModules';
import { useAppModules } from '@/hooks/useAppModules';
export function ModulesCard() {
  const {flags,update,isLoading,error}=useAppModules();
  return <Card><CardHeader><CardTitle className="text-base">Modules</CardTitle></CardHeader><CardContent className="divide-y">{constructionModules.map(m=><div key={m.key} className="flex items-center justify-between gap-3 py-3"><Label htmlFor={`module-${m.key}`}>{m.label}</Label><Switch id={`module-${m.key}`} checked={flags[m.key]===true} disabled={isLoading||update.isPending||!!error} onCheckedChange={enabled=>update.mutate({module:m.key,enabled})}/></div>)}{error&&<p role="alert" className="text-sm text-destructive">Unable to load module settings.</p>}</CardContent></Card>;
}