import { describe, expect, it } from 'vitest';

const {
  LIST_SPORTS,
  buildSportsArtifact,
  classFromLetters,
  createMatcher,
  looseKey,
  normalizeName,
  parseSchoolPage,
  parseSportDistrictPage,
  validateExtract,
  validateSportsArtifact,
} = require('../scripts/lib/pa-sports');
const { crawl } = require('../scripts/refresh-pa-sports');

/** A PIAA directory page in the shape of piaa.org's (no contacts kept). */
const schoolPage = ({
  name = 'Carlisle High School',
  district = 3,
  schoolDistrict = 'Carlisle Area',
  type = 'Public Senior High School',
  total = '1,330',
  boys = '677',
  football = '<td>AAAAAA </td> <td></td>',
}: Partial<Record<string, string | number>> = {}) => `
<h1>School Details:<br> <span id="SchoolName">${name}</span> </h1>
<div id="schoolDetails">
  <strong>PIAA District</strong> &nbsp; <a href="list.aspx?district=${district}" id="PIAADistrict">PIAA District ${district}</a><br>
  <strong>School District</strong> &nbsp; <span id="SchoolDistrict">${schoolDistrict}</span><br>
  <strong>School Type</strong> &nbsp; <span id="SchoolType">${type}</span><br>
  <span id="EnrollmentDate">Wednesday, October 15, 2025 (26/27 classification season)</span>
  <span id="EnrollmentTotal">${total}</span>
  <span id="EnrollmentMale">${boys}</span>
</div>
<div class="title">Athletic Director</div><a href="mailto:someone@example.org">someone@example.org</a>
<table class="borderless"><thead><tr><th>Boys Sports</th><th>Class</th><th>Co-op?</th></tr></thead>
<tr class="odd"> <td><a href="/schools/classifications/classlist.aspx?sportID=3">Boys Basketball</a></td> <td>AAAAAA </td> <td></td> </tr>
${
  football
    ? `<tr class="even"> <td><a href="/schools/classifications/classlist.aspx?sportID=10">Football</a></td> ${football} </tr>`
    : ''
}
</table>`;

const listPage = (ids: number[]) => `
<table><caption id="SchoolList_caption">District 3 Football (Classification Season: 26/27)</caption>
<tbody>${ids
  .map(
    (id) =>
      `<tr><td class="title"><a href="/schools/directory/details.aspx?ID=${id}">School ${id}</a></td><td>AAA</td><td class="enrollment">200 </td></tr>`,
  )
  .join('')}</tbody></table>`;

const pasda = [
  {
    NAME: 'Carlisle Area',
    SCHOOL_NAM: 'Carlisle Area',
    SCHOOL_DIS: 'Carlisle Area SD',
    AUN_NUM: '115211603',
  },
  {
    NAME: 'Pittsburgh',
    SCHOOL_NAM: 'Pittsburgh',
    SCHOOL_DIS: 'Pittsburgh SD',
    AUN_NUM: '102027451',
  },
  {
    NAME: 'Mt Lebanon',
    SCHOOL_NAM: 'Mt Lebanon',
    SCHOOL_DIS: 'Mt Lebanon SD',
    AUN_NUM: '103026852',
  },
  {
    NAME: 'Philadelphia City',
    SCHOOL_NAM: 'Philadelphia City',
    SCHOOL_DIS: 'Philadelphia City SD',
    AUN_NUM: '126515001',
  },
  {
    NAME: 'Blue Ridge',
    SCHOOL_NAM: 'Blue Ridge',
    SCHOOL_DIS: 'Blue Ridge SD',
    AUN_NUM: '119581003',
  },
  // Two districts share the loose key "york", so it must never loose-match.
  {
    NAME: 'York City',
    SCHOOL_NAM: 'York City',
    SCHOOL_DIS: 'York City SD',
    AUN_NUM: '112679002',
  },
  {
    NAME: 'York Suburban',
    SCHOOL_NAM: 'York Suburban',
    SCHOOL_DIS: 'York Suburban SD',
    AUN_NUM: '112679403',
  },
  {
    NAME: 'West York Area',
    SCHOOL_NAM: 'West York Area',
    SCHOOL_DIS: 'West York Area SD',
    AUN_NUM: '112679803',
  },
  {
    NAME: 'York Area',
    SCHOOL_NAM: 'York Area',
    SCHOOL_DIS: 'York Area SD',
    AUN_NUM: '199999999',
  },
];

const school = (over: Record<string, unknown>) => ({
  id: 1,
  name: 'School',
  piaaDistrict: 3,
  schoolDistrict: 'Carlisle Area',
  type: 'Public Senior High School',
  enrollmentSeason: '26/27',
  enrollmentDate: 'October 15, 2025',
  total: 300,
  boys: 150,
  football: '4A',
  footballCoop: false,
  ...over,
});

const source = {
  publisher: 'PIAA',
  url: 'https://www.piaa.org/schools/classifications/default.aspx',
  season: '2026-27 and 2027-28',
  enrollmentDate: 'October 2025',
  retrievedAt: '2026-11-18T00:00:00.000Z',
  terms: 'Facts only.',
};

describe('PIAA page parsing', () => {
  it('reads a school page and ignores its contacts', () => {
    const parsed = parseSchoolPage(schoolPage(), 11090);
    expect(parsed).toEqual({
      id: 11090,
      name: 'Carlisle High School',
      piaaDistrict: 3,
      schoolDistrict: 'Carlisle Area',
      type: 'Public Senior High School',
      enrollmentSeason: '26/27',
      enrollmentDate: 'October 15, 2025',
      total: 1330,
      boys: 677,
      football: '6A',
      footballCoop: false,
    });
    expect(JSON.stringify(parsed)).not.toContain('example.org');
  });

  it('reads a co-op football team and a school without football', () => {
    const coop = parseSchoolPage(
      schoolPage({ football: '<td>AAAA </td> <td><strong>Yes</strong></td>' }),
      13453,
    );
    expect(coop).toMatchObject({ football: '4A', footballCoop: true });
    const none = parseSchoolPage(schoolPage({ football: '' }), 11048);
    expect(none).toMatchObject({ football: null, footballCoop: false });
  });

  it('rejects a page without a school name', () => {
    expect(() => parseSchoolPage('<html></html>', 1)).toThrow(/no school name/);
  });

  it('lists school ids and the season of a classification page', () => {
    expect(parseSportDistrictPage(listPage([3, 1, 3]))).toEqual({
      season: '26/27',
      ids: [3, 1],
    });
  });

  it('maps PIAA letters to classes', () => {
    expect(classFromLetters('A')).toBe('1A');
    expect(classFromLetters('AAAAAA ')).toBe('6A');
    expect(classFromLetters('AAAAAAA')).toBeNull();
    expect(classFromLetters('')).toBeNull();
  });
});

describe('district matching', () => {
  it('normalizes punctuation, Mount and the SD suffix', () => {
    expect(normalizeName('Mt. Lebanon')).toBe('mt lebanon');
    expect(normalizeName('Mount Lebanon SD')).toBe('mt lebanon');
    expect(looseKey('Philadelphia City')).toBe('philadelphia');
  });

  it('matches exactly, then by a unique loose key, then not at all', () => {
    const match = createMatcher(pasda);
    expect(match('Carlisle Area')).toEqual({
      district: 'Carlisle Area',
      how: 'exact',
    });
    expect(match('Mount Lebanon')).toEqual({
      district: 'Mt Lebanon',
      how: 'exact',
    });
    expect(match('Philadelphia')).toEqual({
      district: 'Philadelphia City',
      how: 'loose',
    });
    // "York" is ambiguous (York City, York Area): never guessed.
    expect(match('York')).toEqual({ district: null, how: 'unmatched' });
    expect(match('Zzprivate Schools(16)')).toEqual({
      district: null,
      how: 'unmatched',
    });
  });

  it('applies reviewed overrides first and rejects unknown AUNs', () => {
    const match = createMatcher(pasda, { York: 'York City', 'Some IU': null });
    expect(match('York')).toEqual({ district: 'York City', how: 'override' });
    expect(match('Some IU')).toEqual({ district: null, how: 'excluded' });
    expect(() => createMatcher(pasda, { York: 'Nowhere' })).toThrow(
      /unknown district/,
    );
  });
});

describe('the sports artifact', () => {
  const extract = {
    schemaVersion: 1,
    source,
    schools: [
      school({
        id: 1,
        name: 'Carlisle High School',
        football: '6A',
        total: 1330,
        boys: 677,
      }),
      // A multi-school district: the colour takes the largest class.
      school({
        id: 2,
        name: 'Allderdice High School',
        schoolDistrict: 'Pittsburgh',
        piaaDistrict: 8,
        football: '4A',
        total: 900,
        boys: 450,
      }),
      school({
        id: 3,
        name: 'Milliones',
        schoolDistrict: 'Pittsburgh',
        piaaDistrict: 8,
        football: '4A',
        footballCoop: true,
        total: 124,
        boys: 64,
      }),
      school({
        id: 4,
        name: 'Brashear High School',
        schoolDistrict: 'Pittsburgh',
        piaaDistrict: 8,
        football: '5A',
        total: 700,
        boys: 374,
      }),
      school({
        id: 5,
        name: 'Obama Academy',
        schoolDistrict: 'Pittsburgh',
        piaaDistrict: 8,
        football: null,
        total: 400,
        boys: 190,
      }),
      // No football at all.
      school({
        id: 6,
        name: 'Blue Ridge High School',
        schoolDistrict: 'Blue Ridge',
        piaaDistrict: 2,
        football: null,
        total: 249,
        boys: 126,
      }),
      // Private and charter schools are not in a PASDA district.
      school({
        id: 7,
        name: 'Bishop McDevitt',
        schoolDistrict: 'Zzprivate Schools(16)',
        type: 'Private High School',
        football: '6A',
      }),
      school({
        id: 8,
        name: 'A Charter School',
        schoolDistrict: 'Somewhere Charter',
        type: 'Public Charter School',
      }),
      school({
        id: 9,
        name: 'York High',
        schoolDistrict: 'York',
        piaaDistrict: 3,
      }),
    ],
  };

  it('groups schools by AUN with the largest class and summed enrollment', () => {
    const artifact = buildSportsArtifact({ extract, pasdaDistricts: pasda });
    expect(artifact.districts['Pittsburgh']).toEqual({
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
    });
    expect(artifact.districts['Blue Ridge']).toMatchObject({
      piaa: 2,
      football: null,
      footballSchools: 0,
    });
  });

  it('reports skipped and unmatched schools instead of dropping them', () => {
    const artifact = buildSportsArtifact({ extract, pasdaDistricts: pasda });
    expect(artifact.coverage).toMatchObject({
      districtsWithSchools: 3,
      districtsWithFootball: 2,
      multiSchoolDistricts: 1,
      nonPublicSchoolsSkipped: 1,
    });
    expect(
      artifact.coverage.unmatched.map((s: { name: string }) => s.name),
    ).toEqual(['A Charter School', 'York High']);
  });

  it('records every PIAA district a district plays in', () => {
    const split = {
      ...extract,
      schools: [
        school({ id: 1, schoolDistrict: 'Pittsburgh', piaaDistrict: 8 }),
        school({ id: 2, schoolDistrict: 'Pittsburgh', piaaDistrict: 8 }),
        school({ id: 3, schoolDistrict: 'Pittsburgh', piaaDistrict: 7 }),
      ],
    };
    const d = buildSportsArtifact({ extract: split, pasdaDistricts: pasda })
      .districts['Pittsburgh'];
    expect(d.piaa).toBe(8);
    expect(d.piaaAll).toEqual([7, 8]);
  });

  it('validates the extract schema', () => {
    const many = {
      ...extract,
      schools: Array.from({ length: 500 }, (_, i) => school({ id: i + 1 })),
    };
    expect(validateExtract(many)).toEqual({ schools: 500 });
    expect(() => validateExtract({ ...many, schemaVersion: 2 })).toThrow(
      /schemaVersion/,
    );
    expect(() =>
      validateExtract({
        ...many,
        schools: [...many.schools.slice(1), school({ id: 2 })],
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      validateExtract({
        ...many,
        schools: [school({ id: 1, football: '7A' }), ...many.schools.slice(1)],
      }),
    ).toThrow(/football class/);
    expect(() =>
      validateExtract({
        ...many,
        schools: [
          school({ id: 1, piaaDistrict: 13 }),
          ...many.schools.slice(1),
        ],
      }),
    ).toThrow(/PIAA district/);
    expect(() =>
      validateExtract({
        ...many,
        schools: [
          school({ id: 1, boys: 400, total: 300 }),
          ...many.schools.slice(1),
        ],
      }),
    ).toThrow(/more boys/);
    expect(() =>
      validateExtract({ ...many, source: { ...source, terms: '' } }),
    ).toThrow(/terms/);
  });

  it('validates the artifact against PASDA and the coverage floors', () => {
    const artifact = buildSportsArtifact({ extract, pasdaDistricts: pasda });
    // Three districts are far under the 480 floor.
    expect(() => validateSportsArtifact(artifact, pasda)).toThrow(/floor/);
    const stray = {
      ...artifact,
      districts: {
        ...artifact.districts,
        Nowhere: artifact.districts['Carlisle Area'],
      },
    };
    expect(() => validateSportsArtifact(stray, pasda)).toThrow(
      /not a PASDA district/,
    );
    const wrong = {
      ...artifact,
      districts: {
        ...artifact.districts,
        Pittsburgh: { ...artifact.districts['Pittsburgh'], football: '6A' },
      },
    };
    expect(() => validateSportsArtifact(wrong, pasda)).toThrow(
      /largest school class/,
    );
  });
});

describe('the PIAA refresh', () => {
  it('crawls list pages then school pages, without live network', async () => {
    const pages: Record<string, string> = {};
    const requested: string[] = [];
    const fetchImpl = async (
      url: string,
      init: { headers: Record<string, string> },
    ) => {
      requested.push(url);
      expect(init.headers['user-agent']).toMatch(/HistoricBorders/);
      const id = /[?&]ID=(\d+)/.exec(url)?.[1];
      const body = id
        ? (pages[id] ?? schoolPage({ name: `School ${id}` }))
        : listPage(url.includes('sportID=10') ? [10, 11] : [11, 12]);
      return { ok: true, status: 200, text: async () => body };
    };
    pages['12'] = schoolPage({ name: 'Blue Ridge High School', football: '' });
    const extract = await crawl({
      fetchImpl,
      pause: 0,
      log: () => undefined,
      now: new Date('2026-11-18T00:00:00Z'),
    });
    expect(requested.filter((u) => u.includes('sportDistrict'))).toHaveLength(
      LIST_SPORTS.length * 12,
    );
    expect(extract.schools.map((s: { id: number }) => s.id)).toEqual([
      10, 11, 12,
    ]);
    expect(extract.source).toMatchObject({
      season: '2026-27 and 2027-28',
      classificationSeason: '26/27',
      enrollmentDate: 'October 2025',
      retrievedAt: '2026-11-18T00:00:00.000Z',
    });
    expect(extract.schools[2]).toMatchObject({
      name: 'Blue Ridge High School',
      football: null,
    });
  });

  it('fails instead of writing when PIAA is unavailable', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 503,
      text: async () => '',
    });
    await expect(
      crawl({ fetchImpl, pause: 0, log: () => undefined }),
    ).rejects.toThrow(/HTTP 503/);
  }, 60_000);
});
