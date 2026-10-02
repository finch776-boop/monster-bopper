const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const requestURL = request => typeof request === 'string' ? request : request.url || request.href;

function workerHarness(workerURL = 'https://finch776-boop.github.io/monster-bopper/sw.js') {
  const handlers = new Map(), stores = new Map(), fetches = [], deleted = [], installs = [];
  const calls = {skipWaiting: 0, claim: 0, globalMatch: 0};
  let network = async () => { throw new Error('Offline'); };
  function cacheFor(name) {
    if (!stores.has(name)) stores.set(name, {entries: new Map(), matches: [], puts: []});
    const store = stores.get(name);
    return {
      async addAll(requests) { installs.push(...requests); },
      async match(request) {
        const url = requestURL(request); store.matches.push(url);
        return store.entries.get(url)?.clone();
      },
      async put(request, response) {
        const url = requestURL(request); store.puts.push({url, status: response.status});
        store.entries.set(url, response.clone());
      }
    };
  }
  const location = new URL(workerURL);
  const context = vm.createContext({URL, Request, Response,
    self: {location, addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: async () => { calls.skipWaiting++; },
      clients: {claim: async () => { calls.claim++; }}},
    caches: {open: async name => cacheFor(name), keys: async () => [...stores.keys()],
      delete: async name => { deleted.push(name); return stores.delete(name); },
      match: async () => { calls.globalMatch++; throw new Error('Cross-cache lookup is forbidden'); }},
    fetch: async request => { fetches.push(request); return network(request); }
  });
  vm.runInContext(source, context);
  const cacheName = vm.runInContext('CACHE', context);
  const base = new URL('./', workerURL);
  return {base, cacheName, stores, fetches, deleted, installs, calls,
    url: relative => new URL(relative, base).href,
    network: handler => { network = handler; },
    seed(name, url, body, status = 200) {
      cacheFor(name); stores.get(name).entries.set(url, new Response(body, {status}));
    },
    async lifecycle(type) {
      const pending = [];
      handlers.get(type)({waitUntil: promise => pending.push(promise)});
      await Promise.all(pending);
    },
    async fetch(url, {mode = 'navigate', method = 'GET'} = {}) {
      let intercepted = false, response;
      handlers.get('fetch')({request: {url, method, mode}, respondWith(promise) {
        assert.equal(intercepted, false, 'Each request receives at most one response');
        intercepted = true; response = promise;
      }});
      return {intercepted, response: await response};
    }
  };
}

(async () => {
  // Exercise both a GitHub Pages project path and the local root deployment.
  for (const workerURL of ['https://finch776-boop.github.io/monster-bopper/sw.js', 'http://localhost:8091/sw.js']) {
    const worker = workerHarness(workerURL), prefix = 'monster-bopper:' + worker.base.pathname + ':';
    assert.ok(worker.cacheName.startsWith(prefix), 'Cache identity includes this exact deployment path');
    const oldCache = prefix + 'old-release';
    const otherScope = worker.base.pathname === '/' ? '/monster-bopper/' : '/';
    const retained = [worker.cacheName, 'other-family-game-v4', 'monster-bopper:' + otherScope + ':v10',
      'monster-bopper:/monster-bopper-extra/:v10', 'monster-bopper:/games/family/:v10'];
    for (const name of [oldCache, ...retained]) worker.seed(name, worker.url('index.html'), name);
    await worker.lifecycle('activate');
    assert.deepEqual(worker.deleted, [oldCache], 'Only this app/path namespace loses its obsolete cache');
    retained.forEach(name => assert.equal(worker.stores.has(name), true, 'Retains cache ' + name));
    assert.equal(worker.calls.claim, 1);
    await worker.lifecycle('install');
    assert.deepEqual(worker.installs.map(request => request.url).sort(),
      ['./', './index.html', './three.module.js', './manifest.json', './icon-192.png', './icon-512.png'].map(p => worker.url(p)).sort());
    worker.installs.forEach(request => {
      assert.equal(request.cache, 'reload', 'Install fetches bypass stale browser HTTP-cache responses');
      assert.equal(request.method, 'GET');
    });
    assert.equal(worker.calls.skipWaiting, 1);
  }
  console.log('PASS: root/subpath cache namespaces preserve other apps/scopes; install requests bypass old HTTP cache');

  const navigation = workerHarness(), canonical = navigation.url('index.html');
  navigation.seed(navigation.cacheName, canonical, 'healthy cached game');
  for (const status of [404, 500, 503]) {
    navigation.network(async () => new Response('temporary failure', {status}));
    const result = await navigation.fetch(canonical + '?release-check=' + status);
    assert.equal(result.intercepted, true);
    assert.equal(result.response.status, 200);
    assert.equal(await result.response.text(), 'healthy cached game');
    assert.equal(navigation.stores.get(navigation.cacheName).puts.length, 0, 'Failed navigation never overwrites a healthy offline page');
  }
  navigation.network(async () => { throw new TypeError('Network unavailable'); });
  for (const address of [navigation.url('./'), canonical, canonical + '?campaign=2']) {
    const result = await navigation.fetch(address);
    assert.equal(await result.response.text(), 'healthy cached game', 'Offline navigation resolves to this scope’s canonical page');
  }
  navigation.network(async () => new Response('new healthy game', {status: 200}));
  const fresh = await navigation.fetch(navigation.url('./') + '?update=next');
  assert.equal(await fresh.response.text(), 'new healthy game');
  assert.deepEqual(navigation.stores.get(navigation.cacheName).puts, [{url: canonical, status: 200}]);
  navigation.network(async () => { throw new TypeError('Offline after update'); });
  assert.equal(await (await navigation.fetch(canonical)).response.text(), 'new healthy game');
  assert.equal(navigation.calls.globalMatch, 0);
  console.log('PASS: HTTP failures keep the healthy page, offline routes fall back, and successful navigation updates one canonical entry');

  const ignored = workerHarness();
  const nonGame = [new URL('/api/room', ignored.base).href, ignored.url('api/room'), ignored.url('api/status'),
    ignored.url('tests/revamp_browser_checks.html'), ignored.url('README.txt'), ignored.url('sw.js'),
    ignored.url('missing.html'), new URL('/another-game/index.html', ignored.base).href,
    'https://elsewhere.example/index.html', ignored.url('index.html/extra')];
  for (const url of nonGame) {
    for (const mode of ['navigate', 'cors']) assert.equal((await ignored.fetch(url, {mode})).intercepted, false, 'Does not intercept ' + url);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) assert.equal((await ignored.fetch(ignored.url('index.html'), {method})).intercepted, false);
  assert.equal(ignored.fetches.length, 0); assert.equal(ignored.stores.size, 0);
  console.log('PASS: API, test pages, non-game paths, external origins and non-GET requests bypass the worker');

  const assets = workerHarness(), library = assets.url('three.module.js');
  assets.seed('other-app-cache', library, 'wrong library from another cache');
  assets.seed(assets.cacheName, library, 'this release library');
  const own = await assets.fetch(library + '?version=10', {mode: 'cors'});
  assert.equal(await own.response.text(), 'this release library');
  assert.equal(assets.fetches.length, 0, 'A same-release cached asset works offline');
  assets.stores.get(assets.cacheName).entries.delete(library);
  assets.network(async () => new Response('fresh library', {status: 200}));
  const downloaded = await assets.fetch(library + '?version=11', {mode: 'cors'});
  assert.equal(await downloaded.response.text(), 'fresh library', 'Another cache cannot satisfy a miss in this release');
  assert.equal(assets.fetches.length, 1);
  assert.deepEqual(assets.stores.get(assets.cacheName).puts, [{url: library, status: 200}]);
  assert.equal(await assets.stores.get('other-app-cache').entries.get(library).clone().text(), 'wrong library from another cache');
  const icon = assets.url('icon-192.png');
  assets.network(async () => new Response('not found', {status: 404}));
  assert.equal((await assets.fetch(icon, {mode: 'cors'})).response.status, 404);
  assert.equal(assets.stores.get(assets.cacheName).entries.has(icon), false, 'Missing assets are not cached');
  assert.equal(assets.calls.globalMatch, 0);
  console.log('PASS: assets read only their own release cache, normalize query keys and never cache failed downloads');
})().catch(error => { console.error(error); process.exitCode = 1; });
