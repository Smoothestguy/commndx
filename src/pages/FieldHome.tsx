import {Link} from 'react-router-dom';
import {PageLayout} from '@/components/layout/PageLayout';
import {Button} from '@/components/ui/button';
import {useHomeLocations} from '@/hooks/useHomeOperations';
import {MapPin} from 'lucide-react';
export default function FieldHome() {
  const scope=useHomeLocations();
  return <PageLayout title="Field Mode"><ul className="divide-y">{scope.data?.projects.filter(p=>scope.data.locations.some(l=>l.project_id===p.id)).map(p=><li key={p.id} className="py-3"><Button asChild variant="ghost" className="h-auto min-h-12 justify-start whitespace-normal"><Link to={`/field/${p.id}`}><MapPin className="h-4 w-4 mr-2 shrink-0"/>{p.name}</Link></Button></li>)}</ul>{scope.isLoading&&<p>Loading locations…</p>}{scope.error&&<p role="alert" className="text-destructive">Locations could not be loaded.</p>}{scope.data&&!scope.data.locations.length&&<p className="text-muted-foreground">No active locations.</p>}</PageLayout>;
}