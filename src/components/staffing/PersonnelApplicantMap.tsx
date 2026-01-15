import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, MapPin, Loader2, RefreshCw, AlertCircle, ExternalLink, Activity, Clock, Coffee, AlertTriangle } from "lucide-react";
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

interface ActiveClockLocation {
  id: string;
  personnel_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  project_id: string;
  project_name: string;
  clock_in_at: string;
  current_lat: number;
  current_lng: number;
  last_location_check_at: string | null;
  is_on_lunch: boolean;
  type: 'active';
}

type LocationData = PersonnelLocation | ApplicantLocation | ActiveClockLocation;
type FilterType = 'all' | 'personnel' | 'applicants' | 'active';

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
  const [activeClocks, setActiveClocks] = useState<ActiveClockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<LocationData | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [counts, setCounts] = useState<RecordCounts>({ personnelTotal: 0, personnelGeocoded: 0, applicantsTotal: 0, applicantsGeocoded: 0 });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch active clock data - faster refresh for real-time tracking
  const fetchActiveClocks = useCallback(async () => {
    const { data: activeClocksData, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        personnel_id,
        clock_in_at,
        clock_in_lat,
        clock_in_lng,
        last_location_lat,
        last_location_lng,
        last_location_check_at,
        is_on_lunch,
        personnel!inner(id, first_name, last_name, email, phone, photo_url),
        projects!inner(id, name)
      `)
      .is('clock_out_at', null)
      .not('clock_in_at', 'is', null);

    if (error) {
      console.error('Error fetching active clocks:', error);
      return;
    }

    if (activeClocksData) {
      const mappedClocks: ActiveClockLocation[] = activeClocksData
        .filter((entry: any) => {
          // Must have either clock_in location or last_location
          return (entry.clock_in_lat && entry.clock_in_lng) || 
                 (entry.last_location_lat && entry.last_location_lng);
        })
        .map((entry: any) => {
          // Prefer last_location if available, otherwise use clock_in location
          const lat = entry.last_location_lat || entry.clock_in_lat;
          const lng = entry.last_location_lng || entry.clock_in_lng;
          
          return {
            id: entry.id,
            personnel_id: entry.personnel_id,
            first_name: entry.personnel.first_name,
            last_name: entry.personnel.last_name,
            email: entry.personnel.email,
            phone: entry.personnel.phone,
            photo_url: entry.personnel.photo_url,
            project_id: entry.projects.id,
            project_name: entry.projects.name,
            clock_in_at: entry.clock_in_at,
            current_lat: lat,
            current_lng: lng,
            last_location_check_at: entry.last_location_check_at,
            is_on_lunch: entry.is_on_lunch || false,
            type: 'active' as const,
          };
        });
      
      setActiveClocks(mappedClocks);
    }
  }, []);

  // Fetch home address data - slower refresh
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    
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
    
    // Also fetch active clocks
    await fetchActiveClocks();
    
    setLoading(false);
    setLastRefresh(new Date());
  }, [fetchActiveClocks]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData();

    // Home address refresh every 10 minutes
    const homeRefreshInterval = setInterval(() => {
      fetchData(true);
    }, 600000); // 10 minutes

    // Active clock refresh every 2 minutes for more real-time tracking
    const activeRefreshInterval = setInterval(() => {
      fetchActiveClocks();
      setLastRefresh(new Date());
    }, 120000); // 2 minutes

    return () => {
      clearInterval(homeRefreshInterval);
      clearInterval(activeRefreshInterval);
    };
  }, [fetchData, fetchActiveClocks]);

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
    
    if (filter === 'all' || filter === 'active') {
      filteredData.push(...activeClocks);
    }
    if (filter === 'all' || filter === 'personnel') {
      filteredData.push(...personnel);
    }
    if (filter === 'all' || filter === 'applicants') {
      filteredData.push(...applicants);
    }

    // Add markers - active clocks first so they render on top
    filteredData.forEach(person => {
      const el = document.createElement('div');
      el.className = 'marker-container';
      
      if (person.type === 'active') {
        const activeEntry = person as ActiveClockLocation;
        const isOnLunch = activeEntry.is_on_lunch;
        const staleness = getStalenessInfo(activeEntry.last_location_check_at);
        
        // Color based on staleness and lunch status
        let bgColor = 'bg-green-500';
        let pingColor = 'bg-green-500/30';
        let showPing = true;
        
        if (isOnLunch) {
          bgColor = 'bg-yellow-500';
          pingColor = 'bg-yellow-500/30';
        } else if (staleness.level === 'very-stale') {
          bgColor = 'bg-gray-400';
          pingColor = 'bg-gray-400/30';
          showPing = false; // No pulse for very stale
        } else if (staleness.level === 'stale') {
          bgColor = 'bg-amber-500';
          pingColor = 'bg-amber-500/30';
        }
        
        el.innerHTML = `
          <div class="relative">
            ${showPing ? `<div class="absolute inset-0 w-10 h-10 -ml-1 -mt-1 rounded-full ${pingColor} animate-ping"></div>` : ''}
            <div class="relative w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 ${bgColor} text-white border-2 border-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5"/>
              </svg>
            </div>
          </div>
        `;
      } else {
        // Regular markers for home addresses
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
      }

      el.addEventListener('click', () => {
        setSelectedPerson(person);
      });

      const lat = person.type === 'active' 
        ? (person as ActiveClockLocation).current_lat 
        : (person as PersonnelLocation | ApplicantLocation).home_lat;
      const lng = person.type === 'active' 
        ? (person as ActiveClockLocation).current_lng 
        : (person as PersonnelLocation | ApplicantLocation).home_lng;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds if we have data
    if (filteredData.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredData.forEach(person => {
        const lat = person.type === 'active' 
          ? (person as ActiveClockLocation).current_lat 
          : (person as PersonnelLocation | ApplicantLocation).home_lat;
        const lng = person.type === 'active' 
          ? (person as ActiveClockLocation).current_lng 
          : (person as PersonnelLocation | ApplicantLocation).home_lng;
        bounds.extend([lng, lat]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
    }
  }, [personnel, applicants, activeClocks, filter]);

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
    if (person.type === 'active') return null;
    
    const parts: string[] = [];
    const p = person as PersonnelLocation | ApplicantLocation;
    
    if (p.address) parts.push(p.address);
    
    const cityState: string[] = [];
    if (p.city) cityState.push(p.city);
    if (p.state) cityState.push(p.state);
    if (cityState.length > 0) parts.push(cityState.join(', '));
    
    const zip = p.type === 'applicant' ? p.home_zip : p.zip;
    if (zip) parts.push(zip);
    
    return parts.length > 0 ? parts.join('\n') : null;
  };

  const formatDuration = (clockInAt: string): string => {
    const start = new Date(clockInAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTimeAgo = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  // Calculate staleness level for active clocks
  const getStalenessInfo = (lastCheckAt: string | null): { level: 'fresh' | 'stale' | 'very-stale'; minutes: number } => {
    if (!lastCheckAt) return { level: 'very-stale', minutes: 999 };
    const date = new Date(lastCheckAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    
    if (minutes <= 15) return { level: 'fresh', minutes };
    if (minutes <= 60) return { level: 'stale', minutes };
    return { level: 'very-stale', minutes };
  };

  const totalCount = (() => {
    switch (filter) {
      case 'all':
        return personnel.length + applicants.length + activeClocks.length;
      case 'personnel':
        return personnel.length;
      case 'applicants':
        return applicants.length;
      case 'active':
        return activeClocks.length;
      default:
        return 0;
    }
  })();

  const hasNoGeocodedData = !loading && personnel.length === 0 && applicants.length === 0 && activeClocks.length === 0;
  const pendingGeocode = (counts.personnelTotal - counts.personnelGeocoded) + (counts.applicantsTotal - counts.applicantsGeocoded);

  const renderSidebarContent = () => {
    if (!selectedPerson) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Click a marker on the map to view details</p>
        </div>
      );
    }

    if (selectedPerson.type === 'active') {
      const active = selectedPerson as ActiveClockLocation;
      const staleness = getStalenessInfo(active.last_location_check_at);
      
      const getStatusBadge = () => {
        if (active.is_on_lunch) {
          return (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <Coffee className="h-3 w-3 mr-1" />
              On Lunch
            </Badge>
          );
        }
        if (staleness.level === 'very-stale') {
          return (
            <Badge variant="destructive" className="bg-gray-500 hover:bg-gray-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Stale Location
            </Badge>
          );
        }
        if (staleness.level === 'stale') {
          return (
            <Badge className="bg-amber-500 hover:bg-amber-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Location Aging
            </Badge>
          );
        }
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <Activity className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      };

      const getLocationBox = () => {
        if (staleness.level === 'very-stale') {
          return (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />
                Stale Location Data
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Last GPS update: {formatTimeAgo(active.last_location_check_at)}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Location may be inaccurate. User may have left the site.
              </p>
            </div>
          );
        }
        if (staleness.level === 'stale') {
          return (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-1">
                <Clock className="h-4 w-4" />
                Location Aging
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Last GPS update: {formatTimeAgo(active.last_location_check_at)}
              </p>
            </div>
          );
        }
        return (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-1">
              <Clock className="h-4 w-4" />
              Real-Time Location
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Last GPS update: {formatTimeAgo(active.last_location_check_at)}
            </p>
          </div>
        );
      };

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SecureAvatar
              bucket="personnel-photos"
              photoUrl={active.photo_url}
              className="h-16 w-16"
              fallback={<span className="text-lg">{getInitials(active.first_name, active.last_name)}</span>}
              alt={`${active.first_name} ${active.last_name}`}
            />
            <div>
              <h3 className="font-semibold text-lg">
                {active.first_name} {active.last_name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge()}
              </div>
            </div>
          </div>
          
          <div className="space-y-3 text-sm">
            {getLocationBox()}

            <div>
              <span className="text-muted-foreground">Project:</span>
              <p className="font-medium">{active.project_name}</p>
            </div>
            
            <div>
              <span className="text-muted-foreground">Clocked In:</span>
              <p className="font-medium">
                {new Date(active.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <span className="text-muted-foreground ml-2">({formatDuration(active.clock_in_at)})</span>
              </p>
            </div>

            <div>
              <span className="text-muted-foreground">Email:</span>
              <p className="font-medium">{active.email}</p>
            </div>
            
            {active.phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{active.phone}</p>
              </div>
            )}
            
            <div>
              <span className="text-muted-foreground">Current Coordinates:</span>
              <p className="font-medium font-mono text-xs">
                {active.current_lat.toFixed(6)}, {active.current_lng.toFixed(6)}
              </p>
            </div>

            <div className="pt-2">
              <Link to={`/personnel/${active.personnel_id}`}>
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View Full Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Personnel or Applicant
    const person = selectedPerson as PersonnelLocation | ApplicantLocation;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <SecureAvatar
            bucket="personnel-photos"
            photoUrl={person.photo_url}
            className="h-16 w-16"
            fallback={<span className="text-lg">{getInitials(person.first_name, person.last_name)}</span>}
            alt={`${person.first_name} ${person.last_name}`}
          />
          <div>
            <h3 className="font-semibold text-lg">
              {person.first_name} {person.last_name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant={person.type === 'personnel' ? 'default' : 'secondary'}>
                {person.type === 'personnel' ? 'Personnel' : 'Applicant'}
              </Badge>
              <Badge variant="outline">{person.status}</Badge>
            </div>
          </div>
        </div>
        
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>
            <p className="font-medium">{person.email}</p>
          </div>
          {person.phone && (
            <div>
              <span className="text-muted-foreground">Phone:</span>
              <p className="font-medium">{person.phone}</p>
            </div>
          )}
          
          {formatAddress(person) && (
            <div>
              <span className="text-muted-foreground">Home Address:</span>
              <p className="font-medium whitespace-pre-line">{formatAddress(person)}</p>
            </div>
          )}
          
          <div>
            <span className="text-muted-foreground">Home Coordinates:</span>
            <p className="font-medium font-mono text-xs">
              {person.home_lat.toFixed(6)}, {person.home_lng.toFixed(6)}
            </p>
          </div>

          {person.geocoded_at && (
            <div>
              <span className="text-muted-foreground">Geocoded:</span>
              <p className="font-medium text-xs">
                {new Date(person.geocoded_at).toLocaleDateString()} 
                {person.geocode_source && ` (${person.geocode_source})`}
              </p>
            </div>
          )}

          <div className="pt-2">
            <Link 
              to={person.type === 'personnel' 
                ? `/personnel/${person.id}` 
                : `/staffing/applicants/${person.id}`
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
    );
  };

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
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="bg-background/95 backdrop-blur">
              <TabsTrigger value="all" className="gap-2">
                <Users className="h-4 w-4" />
                All ({personnel.length + applicants.length + activeClocks.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <Activity className="h-4 w-4" />
                Active ({activeClocks.length})
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-500/30 animate-pulse" />
                <span>Active (&lt;15m)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Aging (15-60m)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>Stale (&gt;60m)</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Personnel ({counts.personnelGeocoded}/{counts.personnelTotal})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Applicants ({counts.applicantsGeocoded}/{counts.applicantsTotal})</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()} • Active locations refresh every 2 min
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
          {renderSidebarContent()}
        </CardContent>
      </Card>
    </div>
  );
}
