import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserCheck, MapPin, Loader2 } from "lucide-react";

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
  type: 'applicant';
}

type LocationData = PersonnelLocation | ApplicantLocation;

interface PersonnelApplicantMapProps {
  mapboxToken: string;
}

export function PersonnelApplicantMap({ mapboxToken }: PersonnelApplicantMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [personnel, setPersonnel] = useState<PersonnelLocation[]>([]);
  const [applicants, setApplicants] = useState<ApplicantLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<LocationData | null>(null);
  const [filter, setFilter] = useState<'all' | 'personnel' | 'applicants'>('all');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch personnel with locations
      const { data: personnelData } = await supabase
        .from('personnel')
        .select('id, first_name, last_name, email, phone, photo_url, home_lat, home_lng, status')
        .not('home_lat', 'is', null)
        .not('home_lng', 'is', null);
      
      // Fetch applicants with locations
      const { data: applicantsData } = await supabase
        .from('applicants')
        .select('id, first_name, last_name, email, phone, photo_url, home_lat, home_lng, status')
        .not('home_lat', 'is', null)
        .not('home_lng', 'is', null);
      
      if (personnelData) {
        setPersonnel(personnelData.map(p => ({ 
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.phone,
          photo_url: p.photo_url,
          home_lat: p.home_lat!,
          home_lng: p.home_lng!,
          status: p.status,
          type: 'personnel' as const 
        })));
      }
      if (applicantsData) {
        setApplicants(applicantsData.map(a => ({ 
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          email: a.email,
          phone: a.phone,
          photo_url: a.photo_url,
          home_lat: a.home_lat!,
          home_lng: a.home_lng!,
          status: a.status,
          type: 'applicant' as const 
        })));
      }
      
      setLoading(false);
    };
    
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const totalCount = filter === 'all' 
    ? personnel.length + applicants.length
    : filter === 'personnel' 
      ? personnel.length 
      : applicants.length;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)]">
      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border">
        {loading && (
          <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Personnel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Applicants</span>
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
              
              <div className="space-y-2 text-sm">
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
                <div>
                  <span className="text-muted-foreground">Location:</span>
                  <p className="font-medium">
                    {selectedPerson.home_lat.toFixed(4)}, {selectedPerson.home_lng.toFixed(4)}
                  </p>
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
