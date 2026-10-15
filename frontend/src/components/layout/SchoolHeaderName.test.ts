import { describe, it, expect } from 'vitest';
import { nameInLanguage } from './SchoolHeaderName';

describe('nameInLanguage', () => {
  it('keeps the part of a bilingual name in the reader language', () => {
    expect(nameInLanguage('روضة النور / Maternelle An-Nour', 'ar')).toBe('روضة النور');
    expect(nameInLanguage('روضة النور / Maternelle An-Nour', 'fr')).toBe('Maternelle An-Nour');
    expect(nameInLanguage('Crèche Les Lutins - روضة الأقزام', 'ar')).toBe('روضة الأقزام');
  });

  it('leaves any other name as it is', () => {
    expect(nameInLanguage('Maternelle An-Nour', 'ar')).toBe('Maternelle An-Nour');
    expect(nameInLanguage('روضة النور', 'fr')).toBe('روضة النور');
    expect(nameInLanguage('École A / École B', 'ar')).toBe('École A / École B');
  });
});
