import { ProjectPersonnelSection } from "./ProjectPersonnelSection";
import { ProjectHotelAssignmentsSection } from "./ProjectHotelAssignmentsSection";
import { ProjectRoomsSection } from "./rooms/ProjectRoomsSection";
import { ProjectAssetAssignmentsSection } from "./ProjectAssetAssignmentsSection";
import { ProjectTimekeepingCard } from "./ProjectTimekeepingCard";

interface Props {
  projectId: string;
  projectName: string;
}

export function ProjectCrewTab({ projectId, projectName }: Props) {
  return (
    <div className="space-y-8">
      <ProjectPersonnelSection projectId={projectId} projectName={projectName} />
      <ProjectHotelAssignmentsSection projectId={projectId} projectName={projectName} />
      <ProjectRoomsSection projectId={projectId} />
      <ProjectAssetAssignmentsSection projectId={projectId} projectName={projectName} />
      <ProjectTimekeepingCard projectId={projectId} />
    </div>
  );
}
