import { SEO } from "@/components/SEO";
import USANetworkMap from "@/components/USANetworkMap";
import USANetworkMapV2 from "@/components/USANetworkMapV2";
import USANetworkMapFinal from "@/components/USANetworkMapFinal";
import USA3DNetworkMap from "@/components/USA3DNetworkMap";
import USA3DMapSimple from "@/components/USA3DMapSimple";
import USAMapProper from "@/components/USAMapProper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const USANetworkMapDemo = () => {
  return (
    <>
      <SEO 
        title="USA Network Map Demo" 
        description="Flat 2D USA network visualization matching reference design"
      />
      
      <div className="min-h-screen bg-background">
        {/* USA Network Map Header - Matching Reference */}
        <USAMapProper 
          title="Nationwide"
          subtitle="On-Demand"
          tagline="Waste Solutions."
          description="Same-Day, Pay-On-Demand, Nationwide"
          height="600px"
          showButton={true}
        />

        {/* Content Section */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>✅ Corrected Implementation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  This is the <strong>flat 2D USA map</strong> visualization that matches your reference image:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>✅ Flat 2D view (not 3D globe)</li>
                  <li>✅ USA-focused network layout</li>
                  <li>✅ Glowing orange/yellow city nodes</li>
                  <li>✅ Blue connection lines creating mesh network</li>
                  <li>✅ Animated particle effects</li>
                  <li>✅ Dark blue/black background</li>
                  <li>✅ Text overlay on left side</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
{`import USANetworkMap from '@/components/USANetworkMap';

<USANetworkMap 
  title="Nationwide"
  subtitle="On-Demand"
  tagline="One Network. Every Solution."
  height="600px"
/>`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-muted-foreground">
                  <div>
                    <strong className="text-foreground">Title & Subtitle:</strong> Change the main heading text
                  </div>
                  <div>
                    <strong className="text-foreground">Tagline:</strong> Update the yellow tagline text
                  </div>
                  <div>
                    <strong className="text-foreground">Height:</strong> Adjust component height (default: 600px)
                  </div>
                  <div>
                    <strong className="text-foreground">Cities:</strong> Edit the cities array in USANetworkMap.tsx
                  </div>
                  <div>
                    <strong className="text-foreground">Colors:</strong> Modify glow colors and connection line colors
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">❌ Previous (Wrong)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 3D rotating globe</li>
                      <li>• Full Earth view</li>
                      <li>• 3D perspective arcs</li>
                      <li>• Interactive rotation</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-green-600">✅ Current (Correct)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Flat 2D map view</li>
                      <li>• USA-focused layout</li>
                      <li>• Flat network lines</li>
                      <li>• Static with animations</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default USANetworkMapDemo;
