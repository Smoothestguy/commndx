import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ParticleBackground } from "@/components/ui/particle-background";
import { ShieldX, LogOut, ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";

const Unauthorized = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleReturnToLogin = () => {
    navigate("/auth");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <SEO 
        title="Access Denied"
        description="You do not have permission to access this application"
        noIndex={true}
      />
      
      {/* Aurora Background Waves */}
      <div className="aurora-bg absolute inset-0 z-0" />
      
      {/* Additional floating elements for depth */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-destructive/10 rounded-full blur-3xl animate-aurora-float-1" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-aurora-float-2" />
      </div>

      {/* Particle Animation Layer */}
      <ParticleBackground className="z-[1]" particleCount={40} />

      <Card className="relative z-10 w-full max-w-md glass">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-destructive/10 border border-destructive/20">
              <ShieldX className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="text-base">
            You don't have permission to access this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2 text-muted-foreground">
            <p>
              This application is invite-only. If you believe you should have access, 
              please contact an administrator.
            </p>
          </div>

          <div className="space-y-3">
            {user ? (
              <Button 
                onClick={handleSignOut} 
                variant="outline" 
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            ) : (
              <Button 
                onClick={handleReturnToLogin} 
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Login
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unauthorized;
