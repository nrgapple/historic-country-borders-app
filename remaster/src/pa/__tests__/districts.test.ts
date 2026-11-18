import { describe, expect, it } from 'vitest';
import {
  COUNTY_PREFIX,
  countyBounds,
  districtFacts,
  districtFullName,
  finderOptions,
  formatVintage,
  titleCase,
} from '../districts';
import { searchPlaces } from '../../lib/places';

// Ported from the current app's components/__tests__/panels.test.tsx.
describe('school district details', () => {
  it('formats school district details', () => {
    const properties = {
      NAME: 'Pen Argyl Area',
      SCHOOL_DIS: 'Pen Argyl Area SD',
      CTY_NAME: 'NORTHAMPTON',
      IU_NAME: 'COLONIAL IU 20',
      AVTS: 'CAREER INSTITUTE OF TECHNOLOGY',
      AUN_NUM: '120483007',
    };
    expect(districtFullName(properties)).toBe('Pen Argyl Area School District');
    expect(districtFacts(properties)).toEqual([
      { label: 'County', value: 'Northampton' },
      { label: 'Intermediate unit', value: 'Colonial IU 20' },
      {
        label: 'Career & technical school',
        value: 'Career Institute of Technology',
      },
      { label: 'Administrative unit number (AUN)', value: '120483007' },
    ]);
  });

  it('keeps official acronyms in district details', () => {
    expect(titleCase('PHILADELPHIA IU 26')).toBe('Philadelphia IU 26');
    expect(titleCase('PHILADELPHIA AVTS')).toBe('Philadelphia AVTS');
    expect(titleCase('KEYSTONE CENTRAL CTC')).toBe('Keystone Central CTC');
    expect(titleCase('CTC OF LACKAWANNA COUNTY')).toBe(
      'CTC of Lackawanna County',
    );
    expect(titleCase('CENTRAL PA INSTITUTE OF SCIENCE & TECHNOLOGY')).toBe(
      'Central PA Institute of Science & Technology',
    );
    expect(titleCase('PITTSBURGH-MT OLIVER IU 2')).toBe(
      'Pittsburgh-Mt Oliver IU 2',
    );
    expect(titleCase('MCKEAN')).toBe('McKean');
    expect(titleCase('BLAST IU 17')).toBe('BLaST IU 17');
    expect(districtFacts({ AVTS: 'NULL', CTY_NAME: 'ADAMS' })).toEqual([
      { label: 'County', value: 'Adams' },
    ]);
  });

  it('prints the PASDA vintage', () => {
    expect(formatVintage('2025-10')).toBe('October 2025');
    expect(formatVintage('2025-10', 'short')).toBe('Oct 2025');
    expect(formatVintage('unknown')).toBe('unknown');
  });
});

describe('district and county finder', () => {
  const box = (w: number): [number, number, number, number] => [
    w,
    40,
    w + 0.2,
    40.2,
  ];
  const districts = [
    {
      NAME: 'Pen Argyl Area',
      SCHOOL_DIS: 'Pen Argyl Area SD',
      CTY_NAME: 'NORTHAMPTON',
      bbox: box(-75.3),
    },
    {
      NAME: 'Bangor Area',
      SCHOOL_DIS: 'Bangor Area SD',
      CTY_NAME: 'NORTHAMPTON',
      bbox: box(-75.2),
    },
    {
      NAME: 'Abington',
      SCHOOL_DIS: 'Abington SD',
      CTY_NAME: 'MONTGOMERY',
      bbox: box(-75.1),
    },
  ];

  it('matches districts by county and shows the county', () => {
    const options = finderOptions(districts);
    const results = searchPlaces(options, 'northampton');
    expect(results.map((r) => r.label)).toEqual([
      'Northampton County',
      'Bangor Area School District',
      'Pen Argyl Area School District',
    ]);
    expect(results[1].detail).toBe('Northampton County');
  });

  it('lists each county once and frames all of its districts', () => {
    const counties = finderOptions(districts).filter((o) =>
      o.name.startsWith(COUNTY_PREFIX),
    );
    expect(counties.map((c) => [c.label, c.detail])).toEqual([
      ['Northampton County', '2 districts'],
      ['Montgomery County', '1 district'],
    ]);
    expect(countyBounds(districts, 'Northampton County')).toEqual([
      -75.3, 40, -75, 40.2,
    ]);
    expect(countyBounds(districts, 'Nowhere County')).toBeUndefined();
  });
});
