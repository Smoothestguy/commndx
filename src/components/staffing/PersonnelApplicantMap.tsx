import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, MapPin, Loader2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface PersonnelLocation {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  home_lat: number;
  home_lng: number;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  geocoded_at: string | null;
  geocode_source: string | null;
  type: 'personnel';
}

interface ApplicantLocation {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  home_lat: number;
  home_lng: number;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  geocoded_at: string | null;
  geocode_source: string | null;
  type: 'applicant';
}

type LocationData = PersonnelLocation | ApplicantLocation;

interface PersonnelApplicantMapProps {
  mapboxToken: string;
  isAdmin?: boolean;
}

interface BackfillResults {
  ok: boolean;
  results?: {
    personnel: { processed: number; success: number; failed: number; skipped: number };
    applicants: { processed: number; success: number; failed: number; skipped: number };
  };
  summary?: {
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
    totalSkipped: number;
  };
  error?: string;
}

interface RecordCounts {
  personnelTotal: number;
  personnelGeocoded: number;
  applicantsTotal: number;
  applicantsGeocoded: number;
}

export function PersonnelApplicantMap({ mapboxToken, isAdmin = false }: PersonnelApplicantMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [personnel, setPersonnel] = useState<PersonnelLocation[]>([]);
  const [applicants, setApplicants] = useState<ApplicantLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<LocationData | null>(null);
  const [filter, setFilter] = useState<'all' | 'personnel' | 'applicants'>('all');
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [counts, setCounts] = useState<RecordCounts>({ personnelTotal: 0, personnelGeocoded: 0, applicantsTotal: 0, applicantsGeocoded: 0 });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    
    // Fetch personnel with locations
    const { data: personnelData } = await supabase
      .from('personnel')
      .select('id, first_name, last_name, email, phone, photo_url, home_lat, home_lng, status, address, city, state, zip, geocoded_at, geocode_source')
      .not('home_lat', 'is', null)
      .not('home_lng', 'is', null) as { data: any[] | null };
    
    // Fetch applicants with locations
    const { data: applicantsData } = await supabase
      .from('applicants')
      .select('id, first_name, last_name, email, phone, photo_url, home_lat, home_lng, status, address, city, state, home_zip, geocoded_at, geocode_source')
      .not('home_lat', 'is', null)
      .not('home_lng', 'is', null);

    // Fetch total counts for empty state display
    const { count: personnelTotal } = await supabase.from('personnel').select('id', { count: 'exact', head: true });
    const { count: applicantsTotal } = await supabase.from('applicants').select('id', { count: 'exact', head: true });
    
    if (personnelData) {
      setPersonnel(personnelData.map((p: any) => ({ 
        ...p,
        type: 'personnel' as const 
      })));
    }
    if (applicantsData) {
      setApplicants(applicantsData.map((a: any) => ({ 
        ...a,
        type: 'applicant' as const 
      })));
    }

    setCounts({
      personnelTotal: personnelTotal || 0,
      personnelGeocoded: personnelData?.length || 0,
      applicantsTotal: applicantsTotal || 0,
      applicantsGeocoded: applicantsData?.length || 0,
    });
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      zoom: 4,
      center: [-98.5795, 39.8283], // Center of US
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Update markers when data or filter changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const filteredData: LocationData[] = [];
    if (filter === 'all' || filter === 'personnel') {
      filteredData.push(...personnel);
    }
    if (filter === 'all' || filter === 'applicants') {
      filteredData.push(...applicants);
    }

    // Add markers
    filteredData.forEach(person => {
      const el = document.createElement('div');
      el.className = 'marker-container';
      el.innerHTML = `
        <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 ${
          person.type === 'personnel' 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-amber-500 text-white'
        }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedPerson(person);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([person.home_lng, person.home_lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds if we have data
    if (filteredData.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredData.forEach(person => {
        bounds.extend([person.home_lng, person.home_lat]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
    }
  }, [personnel, applicants, filter]);

  const handleRunBackfill = async () => {
    setBackfillRunning(true);
    toast.info("Running geocode backfill...", { duration: 3000 });

    try {
      const { data, error } = await supabase.functions.invoke<BackfillResults>('run-geocode-backfill');
      
      if (error) {
        console.error("Backfill error:", error);
        toast.error("Backfill failed: " + error.message);
        return;
      }

      if (data?.ok && data.summary) {
        const { totalSuccess, totalFailed, totalSkipped } = data.summary;
        toast.success(`Backfill complete: ${totalSuccess} geocoded, ${totalFailed} failed, ${totalSkipped} skipped`);
        // Refresh the data
        await fetchData();
      } else if (data?.error) {
        toast.error("Backfill error: " + data.error);
      }
    } catch (err) {
      console.error("Backfill error:", err);
      toast.error("Failed to run backfill");
    } finally {
      setBackfillRunning(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatAddress = (person: LocationData): string | null => {
    const parts: string[] = [];
    
    if (person.address) parts.push(person.address);
    
    const cityState: string[] = [];
    if (person.city) cityState.push(person.city);
    if (person.state) cityState.push(person.state);
    if (cityState.length > 0) parts.push(cityState.join(', '));
    
    const zip = person.type === 'applicant' ? person.home_zip : person.zip;
    if (zip) parts.push(zip);
    
    return parts.length > 0 ? parts.join('\n') : null;
  };

  const totalCount = filter === 'all' 
    ? personnel.length + applicants.length
    : filter === 'personnel' 
      ? personnel.length 
      : applicants.length;

  const hasNoGeocodedData = !loading && personnel.length === 0 && applicants.length === 0;
  const pendingGeocode = (counts.personnelTotal - counts.personnelGeocoded) + (counts.applicantsTotal - counts.applicantsGeocoded);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)]">
      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border">
        {loading && (
          <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {/* Empty state overlay */}
        {hasNoGeocodedData && (
          <div className="absolute inset-0 bg-background/90 z-10 flex flex-col items-center justify-center text-center p-6">
            <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Geocoded Records Found</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              {counts.personnelTotal + counts.applicantsTotal > 0 ? (
                <>
                  You have <strong>{counts.personnelTotal} personnel</strong> and <strong>{counts.applicantsTotal} applicants</strong> in the system, 
                  but none have been geocoded yet. Address coordinates are needed to display locations on the map.
                </>
              ) : (
                <>
                  No personnel or applicants exist in the system yet. Once records with address 
                  information are added, they will appear on this map.
                </>
              )}
            </p>
            
            {pendingGeocode > 0 && isAdmin && (
              <Button 
                onClick={handleRunBackfill} 
                disabled={backfillRunning}
                className="gap-2"
              >
                {backfillRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Backfill...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Run Geocode Backfill ({pendingGeocode} records)
                  </>
                )}
              </Button>
            )}
            
            {pendingGeocode > 0 && !isAdmin && (
              <p className="text-sm text-muted-foreground mt-2">
                Contact an administrator to run the geocode backfill.
              </p>
            )}
          </div>
        )}
        
        <div ref={mapContainer} className="absolute inset-0" />
        
        {/* Filter controls */}
        <div className="absolute top-4 left-4 z-10">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-background/95 backdrop-blur">
              <TabsTrigger value="all" className="gap-2">
                <Users className="h-4 w-4" />
                All ({personnel.length + applicants.length})
              </TabsTrigger>
              <TabsTrigger value="personnel" className="gap-2">
                <UserCheck className="h-4 w-4" />
                Personnel ({personnel.length})
              </TabsTrigger>
              <TabsTrigger value="applicants" className="gap-2">
                <MapPin className="h-4 w-4" />
                Applicants ({applicants.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Backfill button for admins when there's data but also pending records */}
        {!hasNoGeocodedData && pendingGeocode > 0 && isAdmin && (
          <div className="absolute top-4 right-16 z-10">
            <Button 
              size="sm"
              variant="outline"
              onClick={handleRunBackfill} 
              disabled={backfillRunning}
              className="gap-2 bg-background/95 backdrop-blur"
            >
              {backfillRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Backfill ({pendingGeocode})
                </>
              )}
            </Button>
          </div>
        )}
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Personnel ({counts.personnelGeocoded}/{counts.personnelTotal})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Applicants ({counts.applicantsGeocoded}/{counts.applicantsTotal})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <Card className="w-full lg:w-80 flex-shrink-0 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Details</span>
            <Badge variant="secondary">{totalCount} on map</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[calc(100%-4rem)]">
          {selectedPerson ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedPerson.photo_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {getInitials(selectedPerson.first_name, selectedPerson.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedPerson.first_name} {selectedPerson.last_name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedPerson.type === 'personnel' ? 'default' : 'secondary'}>
                      {selectedPerson.type === 'personnel' ? 'Personnel' : 'Applicant'}
                    </Badge>
                    <Badge variant="outline">{selectedPerson.status}</Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{selectedPerson.email}</p>
                </div>
                {selectedPerson.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium">{selectedPerson.phone}</p>
                  </div>
                )}
                
                {/* Address */}
                {formatAddress(selectedPerson) && (
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium whitespace-pre-line">{formatAddress(selectedPerson)}</p>
                  </div>
                )}
                
                {/* Coordinates */}
                <div>
                  <span className="text-muted-foreground">Coordinates:</span>
                  <p className="font-medium font-mono text-xs">
                    {selectedPerson.home_lat.toFixed(6)}, {selectedPerson.home_lng.toFixed(6)}
                  </p>
                </div>

                {/* Geocode metadata */}
                {selectedPerson.geocoded_at && (
                  <div>
                    <span className="text-muted-foreground">Geocoded:</span>
                    <p className="font-medium text-xs">
                      {new Date(selectedPerson.geocoded_at).toLocaleDateString()} 
                      {selectedPerson.geocode_source && ` (${selectedPerson.geocode_source})`}
                    </p>
                  </div>
                )}

                {/* Link to full profile */}
                <div className="pt-2">
                  <Link 
                    to={selectedPerson.type === 'personnel' 
                      ? `/personnel/${selectedPerson.id}` 
                      : `/staffing/applicants/${selectedPerson.id}`
                    }
                  >
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" />
                      View Full Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Click a marker on the map to view details</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
