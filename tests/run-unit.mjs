import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const outdir = await mkdtemp(join(tmpdir(), 'words-in-life-tests-'));
try {
  const entries = (await readdir('tests/unit')).filter(file => file.endsWith('.test.ts')).map(file => `tests/unit/${file}`);
  await build({ entryPoints: entries, outdir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' } });
  const result = spawnSync(process.execPath, ['--test', ...entries.map(file => join(outdir, file.split('/').at(-1).replace('.ts', '.mjs')))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await rm(outdir, { recursive: true, force: true }); }
