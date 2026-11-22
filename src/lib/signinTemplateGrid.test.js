import { it, expect } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import { cleanSigninTemplateGrid } from './signinTemplateGrid';

it('leaves unrelated customer PDF bytes unchanged', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]).drawText('Original customer evidence');
  const bytes = await pdf.save();
  const original = bytes.slice();
  expect(await cleanSigninTemplateGrid(bytes.buffer)).toEqual(original);
  expect(bytes).toEqual(original);
});