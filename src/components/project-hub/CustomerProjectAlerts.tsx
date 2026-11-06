import {Link} from 'react-router-dom';
import {useCustomerProjectCounts} from '@/hooks/useCustomerProject';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {MessageSquare,ListChecks} from 'lucide-react';
export function CustomerProjectAlerts({projectId,locations}:{projectId:string;locations:{id:string;name:string}[]}){
 const {data}=useCustomerProjectCounts(projectId,locations.map(l=>l.id));if(!data?.orders.length&&!data?.unread)return null;
 return <div role="status" className="flex flex-wrap items-center gap-2 border rounded-md px-2 py-1">{data.orders.length>0&&<Button size="sm" variant="ghost" className="text-warning" asChild><Link to={`/projects/${projectId}?tab=locations&location=${data.orders[0].location_id}&taskOrders=1`}><ListChecks className="h-4 w-4 mr-2"/>{data.orders.length} submitted task order{data.orders.length===1?'':'s'}<Badge variant="outline" className="ml-2 text-warning">Pending acceptance</Badge></Link></Button>}{data.unread>0&&<Button size="sm" variant="ghost" asChild><Link to={`/projects/${projectId}?tab=docs#customer-messages`}><MessageSquare className="h-4 w-4 mr-2"/>Customer messages<Badge variant="secondary" className="ml-2">{data.unread} unread</Badge></Link></Button>}</div>;
}