// Mobile file providers may omit MIME types, especially for PDFs and Word files.
export function projectDocumentFileType(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  };
  return types[extension ?? ''] ?? 'application/octet-stream';
}