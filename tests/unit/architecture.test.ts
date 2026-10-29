import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
}
test('domain, repository and usecases obey dependency boundaries including type-only and dynamic imports', () => {
  for (const file of files('src')) {
    const source = fs.readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const imported of imports) {
      const target = imported.startsWith('.') ? path.resolve(path.dirname(file), imported) : imported;
      if (file.startsWith('src/domain/')) assert(imported.startsWith('.') && target.startsWith(path.resolve('src/domain') + path.sep), `${file} depends on ${imported}`);
      if (file.startsWith('src/usecases/')) assert(imported.startsWith('.') && (target.startsWith(path.resolve('src/domain') + path.sep) || target.startsWith(path.resolve('src/usecases') + path.sep) || /repository\/(LibraryRepository|RecognitionRepository|MissionGenerationRepository)$/.test(target)), `${file} depends on implementation ${imported}`);
      if (file.startsWith('src/repository/')) assert(!/\/(features|hooks|components|usecases)\//.test(target) && !/^react/.test(imported), `${file} depends on UI/usecases`);
      if (imported === '@google/genai') assert(file.startsWith('src/repository/gemini/'), `SDK leaked to ${file}`);
    }
    if (file.startsWith('src/domain/')) assert(!/\b(window|document|localStorage|indexedDB|HTMLImageElement|Blob)\b/.test(source), `browser API in ${file}`);
  }
});
