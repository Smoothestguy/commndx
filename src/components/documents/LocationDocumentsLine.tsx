import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
import type { DocumentSignature } from '@/integrations/supabase/hooks/useDocumentSignatures';
export function LocationDocumentsLine({ projectId, locationId, documents, signatures }: { projectId: string; locationId: string; documents: ProjectDocument[]; signatures: DocumentSignature[] }) {
  const docs = documents.filter(d => d.location_id === locationId || d.location_ids?.includes(locationId));
  if (!docs.length) return null;
  const ids = new Set(docs.filter(d => d.requires_signature).map(d => d.id));
  const rows = signatures.filter(s => ids.has(s.document_id));
  return <Link to={`/projects/${projectId}/locations/${locationId}?tab=documents`} className="flex flex-wrap items-center gap-2 text-xs text-primary hover:underline"><FileText className="h-3.5 w-3.5" />Documents ({docs.length}){ids.size > 0 && <Badge variant="outline" className="text-xs">Signatures {rows.filter(s => s.status === 'signed').length}/{rows.length}</Badge>}</Link>;
}
