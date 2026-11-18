// STAND-IN for T1's metadata until the real pipeline lands: a few hand-made
// dependency links, capitals and archaeological sites, so the Classic-atlas
// style can render and be reviewed now. Not sourced; do not publish.
// Overlord and territory names must match the year's NAME values exactly.

const UK = 'United Kingdom of Great Britain and Ireland';
export const DEPENDENCIES = {
  1492: { 'Crimean Khanate': 'Ottoman Empire' },
  1914: {
    'British Raj': UK,
    Nigeria: UK,
    'Gold Coast': UK,
    'British East Africa': UK,
    'Anglo-Egyption Sudan': UK,
    Egypt: UK,
    Rhodesia: UK,
    'Sierra Leone': UK,
    Malaya: UK,
    Ceylon: UK,
    Uganda: UK,
    'British Somaliland': UK,
    Algeria: 'France',
    'French West Africa': 'France',
    'French Equatorial Africa': 'France',
    'Madagascar (France)': 'France',
    'French Indochina': 'France',
    Tunisia: 'France',
    Morocco: 'France',
    Libya: 'Kingfom of Italy',
    Eritrea: 'Kingfom of Italy',
    'Italian Somaliland': 'Kingfom of Italy',
    'Belgian Congo': 'Belgium',
    Angola: 'Portugal',
    Mozambique: 'Portugal',
    'German South-West Africa': 'German Empire',
    'German E. Africa (Tanganyika)': 'German Empire',
    Togoland: 'German Empire',
  },
};

// [capital name, territory name, lon, lat]. Wikidata QIDs are left null in the stub.
export const CAPITALS = {
  1492: [
    ['Constantinople', 'Ottoman Empire', 28.98, 41.01],
    ['Cairo', 'Mamluke Sultanate', 31.24, 30.04],
    ['Moscow', 'Grand Duchy of Moscow', 37.62, 55.75],
    ['Kraków', 'Poland-Lithuania', 19.94, 50.06],
    ['Paris', 'France', 2.35, 48.86],
    ['London', 'England', -0.13, 51.51],
    ['Lisbon', 'Portugal', -9.14, 38.72],
    ['Venice', 'Venice', 12.32, 45.44],
    ['Rome', 'Papal States', 12.5, 41.9],
    ['Buda', 'Imperial Hungary', 19.04, 47.5],
  ],
  1914: [
    ['London', UK, -0.13, 51.51],
    ['Paris', 'France', 2.35, 48.86],
    ['Berlin', 'German Empire', 13.4, 52.52],
    ['Saint Petersburg', 'Russian Empire', 30.32, 59.94],
    ['Constantinople', 'Ottoman Empire', 28.98, 41.01],
    ['Rome', 'Kingfom of Italy', 12.5, 41.9],
    ['Madrid', 'Spain', -3.7, 40.42],
    ['Lisbon', 'Portugal', -9.14, 38.72],
    ['Brussels', 'Belgium', 4.35, 50.85],
    ['Cairo', 'Egypt', 31.24, 30.04],
    ['Delhi', 'British Raj', 77.21, 28.61],
    ['Algiers', 'Algeria', 3.06, 36.75],
    ['Dakar', 'French West Africa', -17.45, 14.69],
    ['Hanoi', 'French Indochina', 105.85, 21.03],
    ['Lagos', 'Nigeria', 3.38, 6.45],
    ['Nairobi', 'British East Africa', 36.82, -1.29],
    ['Khartoum', 'Anglo-Egyption Sudan', 32.53, 15.5],
    ['Tripoli', 'Libya', 13.19, 32.89],
    ['Luanda', 'Angola', 13.23, -8.84],
    ['Athens', 'Greece', 23.73, 37.98],
    ['Belgrade', 'Serbia', 20.46, 44.82],
    ['Sofia', 'Bulgaria', 23.32, 42.7],
    ['Bucharest', 'Romania', 26.1, 44.43],
    ['Tehran', 'Persia', 51.39, 35.69],
    ['Stockholm', 'Sweden', 18.07, 59.33],
    ['Kristiania', 'Norway', 10.75, 59.91],
  ],
};

// Place names (as in the year's places) to mark as archaeological sites.
export const SITES = new Set([
  'Kaneš',
  'Lambaesa',
  'Siga',
  'Cumbe Mayo',
  'Cirta',
]);
