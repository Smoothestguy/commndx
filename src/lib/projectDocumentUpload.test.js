import { expect, it } from 'bun:test';
import { projectDocumentFileType } from './projectDocumentUpload';

it('keeps PDFs recognizable when the mobile file provider omits MIME', () => {
  expect(projectDocumentFileType({ name: 'inspection.PDF', type: '' })).toBe('application/pdf');
});
it('preserves supplied image MIME types', () => {
  expect(projectDocumentFileType({ name: 'photo.png', type: 'image/png' })).toBe('image/png');
});
it('resolves Word and image extensions without a MIME type', () => {
  expect(projectDocumentFileType({ name: 'scope.doc', type: '' })).toBe('application/msword');
  expect(projectDocumentFileType({ name: 'scope.docx', type: '' })).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(projectDocumentFileType({ name: 'photo.HEIC', type: '' })).toBe('image/heic');
});