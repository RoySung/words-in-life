import { spawn } from 'node:child_process';
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
let server;
const run = script => new Promise(resolve => {
  const child = spawn(process.execPath, [`tests/${script}`], { stdio: 'inherit', env: { ...process.env, TEST_BASE_URL: baseURL } });
  child.on('exit', code => resolve(code ?? 1));
  child.on('error', error => { console.error(error); resolve(1); });
});
try {
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { stdio: 'inherit' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('Test server stopped before becoming ready');
      try { const response = await fetch(baseURL); if (response.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Test server did not start');
  }
  let failed = 0;
  for (const script of ['startup-transition.cjs', 'settings-flow.cjs', 'camera-flow.cjs', 'camera-photo-content.cjs', 'camera-zoom.cjs', 'home-rwd.cjs', 'ui-smoke.cjs', 'quiz-motion.cjs', 'photo-transitions.cjs', 'scene-photo.cjs', 'recognition-presentation.cjs', 'object-crops.cjs', 'photo-fallback.cjs', 'reliability-flow.cjs', 'storage-flow.cjs', 'gemini-contract.cjs', 'ai-missions-flow.cjs']) {
    console.log(`\nRunning ${script}`);
    failed += Number((await run(script)) !== 0);
  }
  process.exitCode = failed ? 1 : 0;
} finally { server?.kill(); }
