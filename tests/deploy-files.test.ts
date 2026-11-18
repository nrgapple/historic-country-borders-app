import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  checkDeployableFiles,
  listDeployableFiles,
} = require('../scripts/lib/deploy-files');

const fixture = (files: Record<string, string | number>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-files-'));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof content === 'number' ? Buffer.alloc(content) : content,
    );
  }
  return root;
};

describe('deployable file budget', () => {
  it('counts uploaded files, not wrangler configuration', () => {
    const root = fixture({
      'index.html': '<!doctype html>',
      'year/1492.html': 'x',
      '_next/static/chunks/app.js': 'x',
      _headers: '/*',
      _redirects: '/a /b',
    });
    expect(
      listDeployableFiles(root)
        .map(({ file }: { file: string }) => file)
        .sort(),
    ).toEqual(['_next/static/chunks/app.js', 'index.html', 'year/1492.html']);
  });

  it('honours .assetsignore patterns', () => {
    const root = fixture({
      'index.html': 'x',
      'maps/a.map': 'x',
      'drafts/one.json': 'x',
      '.assetsignore': '# comment\n*.map\n**/*.map\ndrafts/\n',
    });
    expect(
      listDeployableFiles(root).map(({ file }: { file: string }) => file),
    ).toEqual(['index.html']);
  });

  it('fails above the file-count budget and the per-file size limit', () => {
    const root = fixture({ 'a.txt': 'x', 'b.txt': 'x', 'big.bin': 2048 });
    const result = checkDeployableFiles(root, {
      maxFiles: 2,
      maxFileBytes: 1024,
    });
    expect(result.count).toBe(3);
    expect(result.largest.file).toBe('big.bin');
    expect(result.errors).toEqual([
      expect.stringMatching(/Deployable files: 3 exceeds the budget of 2/),
      expect.stringMatching(/big\.bin/),
    ]);
    expect(checkDeployableFiles(root).errors).toEqual([]);
  });
});
