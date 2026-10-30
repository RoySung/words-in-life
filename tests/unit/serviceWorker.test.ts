import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const origin = 'https://app.example';
const source = readFileSync('scripts/service-worker.js', 'utf8')
  .replace('__CACHE_NAME__', JSON.stringify('words-in-life-shell-test'))
  .replace('__PRECACHE_URLS__', JSON.stringify(['/index.html', '/assets/app.js']));

function redirectedResponse(body = '<html>app</html>') {
  const response = new Response(body, {
    status: 200, statusText: 'OK', headers: { 'Content-Type': 'text/html', 'X-App-Version': '1' },
  });
  // Model the metadata retained by Cache Storage after fetch follows a redirect.
  Object.defineProperty(response, 'redirected', { value: true });
  return response;
}

function worker(cached?: Response, network = new Response('network')) {
  const handlers: Record<string, (event: any) => void> = {};
  const entries = new Map<string, Response>();
  if (cached) entries.set('/index.html', cached);
  let fetches = 0;
  const cache = {
    addAll: async () => { entries.set('/index.html', redirectedResponse()); },
    match: async (url: string) => entries.get(url),
    put: async (url: string, response: Response) => { entries.set(url, response); },
  };
  runInNewContext(source, {
    Response,
    Request: class extends Request {
      constructor(url: string, options?: RequestInit) { super(new URL(url, origin), options); }
    },
    URL,
    self: { location: { origin }, addEventListener: (name: string, fn: any) => { handlers[name] = fn; } },
    caches: { open: async () => cache },
    fetch: async () => { fetches++; return network; },
  });
  return {
    entries,
    get fetches() { return fetches; },
    install: () => {
      let pending!: Promise<void>;
      handlers.install({ waitUntil: (promise: Promise<void>) => { pending = promise; } });
      return pending;
    },
    navigate: (pathname = '/') => {
      let pending: Promise<Response> | undefined;
      handlers.fetch({
        request: { url: origin + pathname, method: 'GET', mode: 'navigate' },
        respondWith: (promise: Promise<Response>) => { pending = promise; },
      });
      return pending;
    },
  };
}

async function assertSafeShell(response: Response | undefined) {
  assert(response);
  assert.equal(response.redirected, false);
  assert.equal(response.status, 200);
  assert.equal(response.statusText, 'OK');
  assert.equal(response.headers.get('Content-Type'), 'text/html');
  assert.equal(response.headers.get('X-App-Version'), '1');
  assert.equal(await response.text(), '<html>app</html>');
}

test('precache strips redirect history from the HTML shell', async () => {
  const sw = worker();
  await sw.install();
  await assertSafeShell(sw.entries.get('/index.html'));
});

for (const pathname of ['/', '/index.html', '/?launch=pwa']) {
  test(`navigation to ${pathname} can serve an existing redirected cache entry offline`, async () => {
    const sw = worker(redirectedResponse());
    await assertSafeShell(await sw.navigate(pathname));
    assert.equal(sw.fetches, 0);
  });
}

test('cache miss strips redirect history from the network response', async () => {
  const sw = worker(undefined, redirectedResponse());
  await assertSafeShell(await sw.navigate());
  assert.equal(sw.fetches, 1);
});

test('ordinary cached responses pass through unchanged', async () => {
  const response = new Response('cached');
  const sw = worker(response);
  assert.equal(await sw.navigate(), response);
  assert.equal(sw.fetches, 0);
});

test('unrelated navigation is not intercepted', () => {
  assert.equal(worker().navigate('/docs/'), undefined);
});
