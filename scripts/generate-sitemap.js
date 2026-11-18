const fs = require('fs');
const path = require('path');
const manifest = require('../data/historical-manifest.json');

const baseUrl = 'https://historicborders.app';
const lastModified = manifest.source.commitDate;
const urls = [
  { path: '/', priority: '1.0' },
  { path: '/pa/school-districts', priority: '0.8' },
  ...manifest.years.map((year) => ({ path: `/year/${year}`, priority: '0.8' })),
];

const entries = urls
  .map(
    ({ path: urlPath, priority }) => `  <url>
    <loc>${baseUrl}${urlPath}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

const destination = path.join(__dirname, '../public/sitemap.xml');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(destination)
    ? fs.readFileSync(destination, 'utf8')
    : '';
  if (current !== sitemap) {
    console.error(
      'public/sitemap.xml is stale. Run `yarn sitemap:generate` and commit it.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Sitemap is current (${urls.length} URLs)`);
  }
} else {
  fs.writeFileSync(destination, sitemap);
  console.log(`Generated ${destination} with ${urls.length} URLs`);
}
