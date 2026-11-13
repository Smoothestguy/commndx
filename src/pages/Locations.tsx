import {Link} from 'react-router-dom';
import {useMemo} from 'react';
import {PageLayout} from '@/components/layout/PageLayout';
import {EnhancedDataTable,type EnhancedColumn} from '@/components/shared/EnhancedDataTable';
import {Input} from '@/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Badge} from '@/components/ui/badge';
import {useSessionState} from '@/hooks/useSessionState';
import {useGlobalLocations,useGlobalLocationStaffing} from '@/hooks/useGlobalLocations';
import {useLocationCommandCenter} from '@/hooks/useLocationCommandCenter';
import {useLocationAuthorization} from '@/hooks/useLocationAuthorization';
import {useProjectTypes} from '@/hooks/useProjectEvent';
import {useCustomers} from '@/integrations/supabase/hooks/useCustomers';
import {getCustomerDisplayName} from '@/utils/customerDisplayName';
import {ProjectTypeChip} from '@/components/projects/EventCustomers';
import {locationHref} from '@/lib/navigationState';

export default function Locations() {
  const index=useGlobalLocations(),types=useProjectTypes(),customers=useCustomers();
  const locations=index.data?.locations??[],projects=index.data?.projects??[];
  const [project,setProject]=useSessionState('global-locations:project','all');
  const [status,setStatus]=useSessionState('global-locations:status','active');
  const [customer,setCustomer]=useSessionState('global-locations:customer','all');
  const [search,setSearch]=useSessionState('global-locations:search','');
  const scope=useMemo(()=>locations.filter(l=>(project==='all'||l.project_id===project)&&(status==='all'||l.status===status)),[locations,project,status]);
  const staffing=useGlobalLocationStaffing(scope.map(l=>l.id));
  const authorization=useLocationAuthorization(scope);
  const ops=useLocationCommandCenter([...new Set(scope.map(l=>l.project_id))],scope);
  const rows=scope.map(l=>{
    const p=projects.find(p=>p.id===l.project_id),customerId=l.customer_id||p?.customer_id;
    const c=customers.data?.find(c=>c.id===customerId),type=types.data?.find(t=>t.id===p?.type_id);
    return {...l,projectName:p?.name??'—',type,customerId,customerName:c?getCustomerDisplayName(c):'—',
      staffed:authorization.data?.[l.id]?.actual??staffing.data?.[l.id]?.assigned,
      authorized:authorization.data?.[l.id]?.positions??staffing.data?.[l.id]?.needed,
      onSite:ops.data?.[l.id]?.onSite};
  }).filter(r=>(customer==='all'||r.customerId===customer)&&[r.name,r.projectName,r.customerName].join(' ').toLowerCase().includes(search.toLowerCase()));
  type Row=typeof rows[number];
  const columns:EnhancedColumn<Row>[]=[
    {key:'name',header:'Location',width:220,render:r=><Link className="truncate block font-semibold hover:underline" title={r.name} to={locationHref(r.project_id,r.id)}>{r.name}</Link>},
    {key:'projectName',header:'Project',width:240,render:r=><Link className="truncate block hover:underline" title={r.projectName} to={`/projects/${r.project_id}`}>{r.projectName}</Link>},
    {key:'type',header:'Type',getValue:r=>r.type?.code??'',render:r=><ProjectTypeChip type={r.type}/>},
    {key:'status',header:'Status',render:r=><Badge variant="outline">{r.status}</Badge>},
    {key:'staffed',header:'Staffed / Auth',getValue:r=>r.staffed??0,render:r=><span className="tabular-nums">{r.staffed??'…'} / {r.authorized??'…'}</span>},
    {key:'onSite',header:'On-site now',getValue:r=>r.onSite??0,render:r=><span className="tabular-nums">{r.onSite??'…'}</span>},
    {key:'customerName',header:'Customer',width:240,render:r=>r.customerId?<Link className="block truncate hover:underline" title={r.customerName} to={`/customers/${r.customerId}`}>{r.customerName}</Link>:'—'},
  ];
  return <PageLayout title="Locations" desktopCompact><div data-viewport-list className="desktop-list-page space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Search locations" placeholder="Search locations" className="w-full sm:w-64" value={search} onChange={e=>setSearch(e.target.value)}/>
      <Select value={project} onValueChange={setProject}><SelectTrigger aria-label="Filter by project" className="w-full sm:w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filter by status" className="w-full sm:w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{['active','on_hold','complete','closed'].map(s=><SelectItem key={s} value={s}>{s==='on_hold'?'On hold':s}</SelectItem>)}</SelectContent></Select>
      <Select value={customer} onValueChange={setCustomer}><SelectTrigger aria-label="Filter by customer" className="w-full sm:w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All customers</SelectItem>{customers.data?.filter(c=>locations.some(l=>(l.customer_id||projects.find(p=>p.id===l.project_id)?.customer_id)===c.id)).map(c=><SelectItem key={c.id} value={c.id}>{getCustomerDisplayName(c)}</SelectItem>)}</SelectContent></Select>
    </div>
    {(index.error||staffing.error||authorization.error||ops.error)&&<p role="alert" className="text-destructive">Some location details could not be loaded.</p>}
    <EnhancedDataTable fillViewport tableId="global-locations" data={rows} columns={columns} rowHref={r=>locationHref(r.project_id,r.id)} exportName="locations" emptyText={index.isLoading?"Loading locations…":"No locations match."}/>
  </div></PageLayout>;
}