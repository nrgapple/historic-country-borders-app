export const dates = [
  -2000,
  -1000,
  -500,
  -323,
  -200,
  -1,
  400,
  600,
  800,
  1000,
  1279,
  1492,
  1530,
  1650,
  1715,
  1783,
  1815,
  1880,
  1914,
  1920,
  1938,
  1945,
  1994,
];

export const convertYearString = (
  format: (value: number) => string,
  year: number,
) => {
  if (year < 0) {
    return format(year);
  }
  return year.toString();
};

export const mapBCFormat = (value: number) => `bc${(value * -1).toString()}`;

export const timelineBCFormat = (value: number) =>
  `${(value * -1).toString()} BC`;

export const mod = (n: number, m: number) => {
  return ((n % m) + m) % m;
};
