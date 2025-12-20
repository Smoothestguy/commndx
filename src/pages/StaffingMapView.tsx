import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PersonnelApplicantMap } from "@/components/staffing/PersonnelApplicantMap";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, Map } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";

export default function StaffingMapView() {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const { isAdmin: isAdminRole, isManager } = useUserRole();

  const isAdmin = isAdminRole || isManager;

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Try to get the token from edge function that reads the secret
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error("Error fetching Mapbox token:", error);
          setError("Could not fetch Mapbox token from server");
        } else if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError("Mapbox token not configured");
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load map configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, []);

  const handleManualToken = () => {
    if (manualToken.startsWith('pk.')) {
      setMapboxToken(manualToken);
      setError(null);
    }
  };

  if (loading) {
    return (
      <PageLayout title="Map View">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (error && !mapboxToken) {
    return (
      <PageLayout title="Map View">
        <div className="max-w-lg mx-auto mt-12">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Map Configuration Required</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Enter Mapbox Token
              </CardTitle>
              <CardDescription>
                Enter your Mapbox public token to view the map. Get your token from{" "}
                <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  mapbox.com
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Mapbox Public Token</Label>
                <Input
                  id="token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="pk.eyJ1I..."
                />
              </div>
              <Button onClick={handleManualToken} disabled={!manualToken.startsWith('pk.')}>
                Load Map
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Personnel & Applicant Map" 
      description="View personnel and applicant locations on a map"
    >
      {mapboxToken && <PersonnelApplicantMap mapboxToken={mapboxToken} isAdmin={isAdmin} />}
    </PageLayout>
  );
}
