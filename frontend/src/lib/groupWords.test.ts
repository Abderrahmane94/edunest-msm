import { describe, it, expect, beforeAll } from 'vitest';
import i18next, { type TFunction } from 'i18next';
import fr from '@/i18n/locales/fr/common.json';
import ar from '@/i18n/locales/ar/common.json';
import { GROUP_TERMS, MEMBER_TERMS, groupWords } from './groupWords';

let tFr: TFunction;
let tAr: TFunction;

beforeAll(async () => {
  const make = async (lng: string, resources: object) => {
    const instance = i18next.createInstance();
    await instance.init({ lng, resources: { [lng]: { translation: resources } }, interpolation: { escapeValue: false } });
    return instance.t;
  };
  tFr = await make('fr', fr);
  tAr = await make('ar', ar);
});

describe('a group’s own words, in sentences that stay correct', () => {
  it('speaks of an association and its clubs to that client', () => {
    const w = groupWords(tFr, 'association', 'club', 3);
    expect(tFr('schoolSettings.association.title', { ...w, name: 'Les Petits' })).toBe("Ce club fait partie de l'association « Les Petits »");
    expect(tFr('associationDashboard.description', { ...w, count: 3 })).toBe('Les chiffres de vos clubs (3)');
    expect(tFr('associationDashboard.byClub', w)).toBe('Club par club');
    expect(tFr('associationDashboard.evolution.all', w)).toBe("Toute l'association");
    expect(tFr('associationDashboard.xlsx.collectedByClub', w)).toBe('Encaissé par club');
  });

  it('agrees in gender and number: a group and its nurseries, one or several', () => {
    expect(tFr('schoolSettings.association.title', { ...groupWords(tFr, 'group', 'nursery'), name: 'Kids' })).toBe('Cette crèche fait partie du groupe « Kids »');
    expect(tFr('associationDashboard.totals', { ...groupWords(tFr, 'group', 'nursery', 1), count: 1 })).toBe('Total (1 crèche)');
    expect(tFr('associationDashboard.totals', { ...groupWords(tFr, 'group', 'nursery', 4), count: 4 })).toBe('Total (4 crèches)');
  });

  it('says it in Arabic too', () => {
    expect(tAr('schoolSettings.association.title', { ...groupWords(tAr, 'association', 'club'), name: 'الصغار' })).toBe('هذا النادي تابع لجمعية «الصغار»');
    expect(tAr('schoolSettings.association.title', { ...groupWords(tAr, 'group', 'nursery'), name: 'الصغار' })).toBe('هذه الروضة تابعة لمجموعة «الصغار»');
  });

  it('has every word for every choice, in both languages, and falls back on group and nurseries', () => {
    for (const t of [tFr, tAr]) {
      for (const g of GROUP_TERMS) for (const m of MEMBER_TERMS) {
        for (const [piece, text] of Object.entries(groupWords(t, g, m))) {
          expect(text, `${g}/${m}/${piece}`).not.toMatch(/Terms\./);
        }
      }
    }
    expect(groupWords(tFr, 'unknown', null).group).toBe('Groupe');
    expect(groupWords(tFr, undefined, 'unknown').member).toBe('Crèche');
  });
});
