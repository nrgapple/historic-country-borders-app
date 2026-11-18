import { describe, expect, it } from 'vitest';
import {
  CLASS_PREFIX,
  COUNTY_PREFIX,
  countyBounds,
  districtFacts,
  districtFullName,
  finderOptions,
  formatVintage,
  groupMembers,
  PIAA_PREFIX,
  sportsFacts,
  sportsLabelLines,
  titleCase,
  unionBounds,
} from '../districts';
import type { DistrictSports } from '../usePASchoolDistricts';
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

describe('PIAA sports facts', () => {
  const source = {
    season: '2026-27 and 2027-28',
    enrollmentDate: 'October 2025',
  };
  const carlisle: DistrictSports = {
    piaa: 3,
    football: '6A',
    footballSchools: 1,
    enrollment: 1330,
    boys: 677,
    schools: [
      {
        id: 11090,
        name: 'Carlisle High School',
        football: '6A',
        total: 1330,
        boys: 677,
      },
    ],
  };
  const pittsburgh: DistrictSports = {
    piaa: 8,
    football: '5A',
    footballSchools: 3,
    enrollment: 2124,
    boys: 1078,
    schools: [
      {
        id: 2,
        name: 'Allderdice High School',
        football: '4A',
        total: 900,
        boys: 450,
      },
      {
        id: 4,
        name: 'Brashear High School',
        football: '5A',
        total: 700,
        boys: 374,
      },
      {
        id: 3,
        name: 'Milliones',
        football: '4A',
        coop: true,
        total: 124,
        boys: 64,
      },
      { id: 5, name: 'Obama Academy', football: null, total: 400, boys: 190 },
    ],
  };
  const blueRidge: DistrictSports = {
    piaa: 2,
    football: null,
    footballSchools: 0,
    enrollment: 249,
    boys: 126,
    schools: [
      {
        id: 11048,
        name: 'Blue Ridge High School',
        football: null,
        total: 249,
        boys: 126,
      },
    ],
  };

  it('shows a one-school district’s class, PIAA district and enrollment', () => {
    expect(sportsFacts(carlisle, source)).toEqual([
      {
        label: 'PIAA district',
        value: 'District III',
        detail: undefined,
        source: 'PIAA',
      },
      {
        label: 'Football class',
        value: '6A',
        detail: 'Carlisle High School · 2026-27 and 2027-28 seasons',
        source: 'PIAA',
      },
      {
        label: 'High-school enrollment, grades 9–11',
        value: '1,330',
        detail: '677 boys · 1 public high school · reported October 2025',
        source: 'PIAA',
      },
    ]);
  });

  it('marks a multi-school district by its largest class', () => {
    const facts = sportsFacts(pittsburgh, source);
    expect(facts[1]).toMatchObject({
      value: 'Up to 5A',
      detail: '3 high school teams, listed below · 2026-27 and 2027-28 seasons',
    });
    expect(sportsLabelLines(pittsburgh)).toEqual({
      sf: 'Up to 5A · 3 schools',
      sp: 'District VIII',
      se: '2,124 students',
    });
  });

  it('says so when a district has no football or no PIAA high school', () => {
    expect(sportsFacts(blueRidge, source)[1]).toMatchObject({
      value: 'No PIAA football team',
    });
    expect(sportsLabelLines(blueRidge).sf).toBe('No PIAA football');
    expect(sportsFacts(null, source)).toEqual([
      expect.objectContaining({
        label: 'PIAA high school',
        value: 'None listed',
      }),
    ]);
    // An index built before the sports facts adds nothing.
    expect(sportsFacts(undefined, source)).toEqual([]);
    expect(sportsLabelLines(null)).toEqual({});
  });

  it('notes schools in a second PIAA district', () => {
    expect(
      sportsFacts({ ...pittsburgh, piaaAll: [7, 8] }, source)[0].detail,
    ).toBe('Some schools: District VII');
  });

  it('finds districts by class, and PIAA districts and classes as groups', () => {
    const box = (w: number): [number, number, number, number] => [
      w,
      40,
      w + 0.2,
      40.2,
    ];
    const districts = [
      {
        NAME: 'Carlisle Area',
        SCHOOL_DIS: 'Carlisle Area SD',
        CTY_NAME: 'CUMBERLAND',
        bbox: box(-77.3),
        sports: carlisle,
      },
      {
        NAME: 'Pittsburgh',
        SCHOOL_DIS: 'Pittsburgh SD',
        CTY_NAME: 'ALLEGHENY',
        bbox: box(-80),
        sports: pittsburgh,
      },
      {
        NAME: 'Blue Ridge',
        SCHOOL_DIS: 'Blue Ridge SD',
        CTY_NAME: 'SUSQUEHANNA',
        bbox: box(-75.7),
        sports: blueRidge,
      },
      {
        NAME: 'Big Spring',
        SCHOOL_DIS: 'Big Spring SD',
        CTY_NAME: 'CUMBERLAND',
        bbox: box(-77.5),
        sports: { ...carlisle, football: '4A' },
      },
    ];
    const options = finderOptions(districts);
    const sixA = searchPlaces(options, '6A');
    expect(sixA.map((o) => o.label)).toEqual([
      '6A football',
      'Carlisle Area School District',
    ]);
    expect(sixA[0]).toMatchObject({
      name: `${CLASS_PREFIX}6A`,
      detail: '1 school district · colours by football class',
    });
    const d3 = searchPlaces(options, 'District III');
    expect(d3[0]).toMatchObject({
      name: `${PIAA_PREFIX}3`,
      label: 'PIAA District III',
    });
    expect(searchPlaces(options, 'District 8')[0].name).toBe(`${PIAA_PREFIX}8`);
    expect(
      groupMembers(districts, `${PIAA_PREFIX}3`).map((d) => d.NAME),
    ).toEqual(['Carlisle Area', 'Big Spring']);
    expect(
      groupMembers(districts, `${CLASS_PREFIX}6A`).map((d) => d.NAME),
    ).toEqual(['Carlisle Area']);
    expect(
      unionBounds(
        groupMembers(districts, `${PIAA_PREFIX}3`).map((d) => d.bbox),
      ),
    ).toEqual([-77.5, 40, -77.1, 40.2]);
    expect(unionBounds([])).toBeUndefined();
  });
});
