import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { usePersonnelAssignedAssets } from "@/integrations/supabase/hooks/usePortalAssets";
import { PortalAssetCard } from "@/components/portal/PortalAssetCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

export default function PortalAssets() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: assets, isLoading: assetsLoading } = usePersonnelAssignedAssets(personnel?.id);

  const isLoading = personnelLoading || assetsLoading;

  // Group assets by project
  const assetsByProject = (assets || []).reduce((acc, asset) => {
    const projectName = asset.project?.name || "Unassigned";
    const projectId = asset.project?.id || "unassigned";
    if (!acc[projectId]) {
      acc[projectId] = { name: projectName, assets: [] };
    }
    acc[projectId].assets.push(asset);
    return acc;
  }, {} as Record<string, { name: string; assets: typeof assets }>);

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Assets</h1>
          <p className="text-muted-foreground">
            Equipment, vehicles, and resources assigned to you
          </p>
        </div>

        {!assets || assets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Assets Assigned</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                You don't have any equipment, vehicles, or resources currently assigned to you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(assetsByProject).map(([projectId, { name, assets: projectAssets }]) => (
              <Card key={projectId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{name}</CardTitle>
                  <CardDescription>
                    {projectAssets?.length} asset{projectAssets?.length !== 1 ? "s" : ""} assigned
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {projectAssets?.map((assignment) => (
                    <PortalAssetCard 
                      key={assignment.id} 
                      assignment={assignment}
                      showProject={false}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
