import { describe, it, expect } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx, columnName } from './xlsx';

const read = (bytes: Uint8Array) => {
  const files = unzipSync(bytes);
  return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, strFromU8(data)]));
};

describe('xlsx — a workbook Excel opens', () => {
  it('names the columns A…Z, AA…', () => {
    expect([0, 25, 26, 27, 51, 52].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  it('has the parts Excel needs, one sheet file per sheet', () => {
    const files = read(buildXlsx([{ name: 'Synthèse', rows: [['a']] }, { name: 'Évolution', rows: [[1]] }]));
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
      expect(files[part], part).toBeDefined();
    }
    expect(files['xl/workbook.xml']).toContain('name="Synthèse"');
    expect(files['xl/workbook.xml']).toContain('name="Évolution"');
  });

  it('writes numbers as numbers and text escaped, with the styles asked', () => {
    const sheet = read(
      buildXlsx([{ name: 'S', rtl: true, frozenRows: 1, widths: [20], rows: [[{ value: 'Club <A> & "B"', style: 'header' }, { value: 1500.5, style: 'money' }, null, 'جمعية']] }]),
    )['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Club &lt;A&gt; &amp; &quot;B&quot;</t></is></c>');
    expect(sheet).toContain('<c r="B1" s="2"><v>1500.5</v></c>');
    expect(sheet).not.toContain('r="C1"');
    expect(sheet).toContain('جمعية');
  });

  it('keeps sheet names Excel accepts', () => {
    const files = read(buildXlsx([{ name: 'A/B: very long name for a sheet, longer than allowed', rows: [] }, { name: 'a/b: very long name for a sheet, longer than allowed', rows: [] }]));
    const names = [...files['xl/workbook.xml'].matchAll(/name="([^"]*)"/g)].map((m) => m[1]);
    expect(names.every((n) => n.length <= 31 && !/[[\]:*?/\\]/.test(n))).toBe(true);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(2);
  });
});
