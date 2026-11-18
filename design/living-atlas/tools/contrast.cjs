/** Prints WCAG 2.2 contrast ratios for each direction's text/background pairs.  node tools/contrast.cjs */
const lum = (hex) => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const PAIRS = {
  'A · Classic atlas': [
    ['ink on paper', '#2A2017', '#F1E9D6'], ['ink-2 on paper', '#554536', '#F1E9D6'], ['ink-2 on fact box', '#554536', '#E8DDC4'],
    ['ink-2 on sheet', '#554536', '#FBF6EA'], ['accent (Medieval) on paper', '#8B2A2A', '#F1E9D6'], ['accent on Medieval wash (active era)', '#8B2A2A', '#E6C2BC'],
    ['ink on Prehistory wash', '#2A2017', '#E7D3AE'], ['ink on Modern wash', '#2A2017', '#C7D3E2'], ['sheet on accent (button)', '#FBF6EA', '#8B2A2A'],
    ['sea/river names on water', '#2F5960', '#BFD2D0'], ['state names on land', '#2A2017', '#F1E8D0'], ['state names on darkest wash (smalt)', '#2A2017', '#BBC7DE'],
    ['selected name on selected fill', '#6E1F1F', '#E4ADA0'],
  ],
  'B · Modern textbook': [
    ['ink on white', '#14202B', '#FFFFFF'], ['ink-2 on white', '#47535F', '#FFFFFF'], ['ink-2 on surface', '#47535F', '#F3F5F7'],
    ['white on Prehistory', '#FFFFFF', '#8C5300'], ['white on Ancient', '#FFFFFF', '#B0362A'], ['white on Medieval', '#FFFFFF', '#1B5CA6'],
    ['white on Early modern', '#FFFFFF', '#23743A'], ['white on Modern', '#FFFFFF', '#94335F'],
    ['Prehistory on its wash', '#8C5300', '#F7EBD9'], ['Ancient on its wash', '#B0362A', '#F8E3E0'], ['Early modern on its wash', '#23743A', '#E0F1E4'], ['Modern on its wash', '#94335F', '#F6E3EC'],
    ['accent on accent wash (fact box)', '#1B5CA6', '#E2ECF8'], ['ink-2 on accent wash', '#47535F', '#E2ECF8'],
    ['sea/river names on water', '#1A5675', '#BCDDEB'], ['state names on darkest fill (iris)', '#14202B', '#C8BCEB'], ['selected name (accent) on white halo', '#1B5CA6', '#FFFFFF'],
  ],
  'C · Museum exhibit': [
    ['on-wall on wall', '#F2EEE6', '#1D2226'], ['on-wall-2 on wall', '#BCC3C9', '#1D2226'],
    ['Prehistory on wall', '#E2A75C', '#1D2226'], ['Ancient on wall', '#EB977F', '#1D2226'], ['Medieval on wall', '#9DBDE6', '#1D2226'], ['Early modern on wall', '#93CBAE', '#1D2226'], ['Modern on wall', '#DDA6C3', '#1D2226'],
    ['card ink on card', '#1D2226', '#F4F1EA'], ['card ink-2 on card', '#4D545B', '#F4F1EA'], ['accent-deep on card', '#2C5A8F', '#F4F1EA'], ['card on card ink (button)', '#F4F1EA', '#1D2226'],
    ['sea/river names on water', '#3B5960', '#D3DCDB'], ['state names (#3A3F44) on land', '#3A3F44', '#F1EEE7'], ['selected name on selected fill', '#111417', '#D3B07E'],
    ['minor ticks on wall (graphic, 3:1)', '#7D868E', '#1D2226'],
  ],
};
for (const [dir, pairs] of Object.entries(PAIRS)) {
  console.log(`\n${dir}`);
  for (const [name, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    console.log(`  ${r.toFixed(2).padStart(5)}:1  ${r >= 4.5 ? 'AA ' : r >= 3 ? 'AA-large/graphic' : 'FAIL'}  ${name} (${fg} on ${bg})`);
  }
}
