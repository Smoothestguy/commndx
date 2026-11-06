import { describe, expect, test } from 'bun:test';
import { detectLang, pickLang } from './publicLang.tsx';
describe('public language', () => {
  test('Spanish devices get Spanish, others English', () => {
    expect(detectLang(['es-MX', 'en-US'])).toBe('es');
    expect(detectLang(['en-US', 'es'])).toBe('en');
    expect(detectLang(['fr-FR'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
  test('legacy bilingual strings show one language', () => {
    expect(pickLang('First name / Nombre', 'en')).toBe('First name');
    expect(pickLang('First name / Nombre', 'es')).toBe('Nombre');
  });
});
