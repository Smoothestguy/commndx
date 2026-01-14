import { SEO } from "@/components/SEO";
import NetworkMapHeader from "@/components/NetworkMapHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NetworkMapDemo = () => {
  return (
    <>
      <SEO 
        title="Network Map Demo" 
        description="Interactive 3D network visualization"
      />
      
      <div className="min-h-screen bg-background">
        {/* 3D Network Map Header */}
        <NetworkMapHeader 
          title="Nationwide Network"
          subtitle="Connected Solutions Across America"
          height="600px"
        />

        {/* Content Section */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>About This Visualization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  This interactive 3D globe visualization showcases a network of connections 
                  across major US cities. The map features:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Real-time animated connections between network nodes</li>
                  <li>Interactive globe that can be rotated and zoomed</li>
                  <li>Glowing markers representing major city hubs</li>
                  <li>Dynamic arc animations showing data flow</li>
                  <li>Beautiful night-time earth texture</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How to Use</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-muted-foreground">
                  <div>
                    <strong className="text-foreground">Rotate:</strong> Click and drag to rotate the globe
                  </div>
                  <div>
                    <strong className="text-foreground">Zoom:</strong> Use mouse wheel or pinch to zoom in/out
                  </div>
                  <div>
                    <strong className="text-foreground">Pan:</strong> Right-click and drag to pan the view
                  </div>
                  <div>
                    <strong className="text-foreground">Hover:</strong> Hover over cities to see their names
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customization Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  The NetworkMapHeader component is highly customizable:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Adjust height and styling</li>
                  <li>Customize title and subtitle text</li>
                  <li>Modify network nodes and connections</li>
                  <li>Change colors and animation speeds</li>
                  <li>Add custom city locations</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default NetworkMapDemo;
