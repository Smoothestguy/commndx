import { ProjectPersonnelSection } from "./ProjectPersonnelSection";
import { ProjectHotelAssignmentsSection } from "./ProjectHotelAssignmentsSection";
import { ProjectRoomsSection } from "./rooms/ProjectRoomsSection";
import { ProjectAssetAssignmentsSection } from "./ProjectAssetAssignmentsSection";

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
    </div>
  );
}
