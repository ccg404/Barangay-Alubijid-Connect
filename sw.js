/**
 * Service Worker for Barangay Alubijid Connect
 * Provides offline caching and background sync for mutations
 */

const CACHE_NAME = 'barangay-connect-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/styles.css',
  '/script.js',
  '/portal-state.mjs',
  '/billing.mjs',
];

const CACHE_STRATEGIES = {
  // Refresh static assets when online, with a cached fallback.
  static: 'network-first',
  // Network first for API/data requests
  data: 'network-first',
  // Stale while revalidate for HTML
  html: 'stale-while-revalidate',
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine strategy based on request type
  const isStaticAsset = STATIC_ASSETS.some((asset) => url.pathname.endsWith(asset.replace('/', '')));
  const isHTML = request.headers.get('accept')?.includes('text/html');
  const isDataRequest = url.pathname.includes('/api/') || url.searchParams.has('format=json');

  let strategy = CACHE_STRATEGIES.static;
  if (isHTML) strategy = CACHE_STRATEGIES.html;
  if (isDataRequest) strategy = CACHE_STRATEGIES.data;

  event.respondWith(handleRequest(request, strategy));
});

async function handleRequest(request, strategy) {
  const cache = await caches.open(CACHE_NAME);

  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request, cache);
    case 'network-first':
      return networkFirst(request, cache);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, cache);
    default:
      return networkFirst(request, cache);
  }
}

// Cache first - good for static assets
async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network first - good for data requests
async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Stale while revalidate - good for HTML
async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Background sync for mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(syncMutations());
  }
});

async function syncMutations() {
  const db = await openIndexedDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');
  const mutations = await getAll(store);

  for (const mutation of mutations) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });

      if (response.ok) {
        await deleteFromStore(store, mutation.id);
        // Notify client of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'mutation-synced',
            mutationId: mutation.id,
            success: true,
          });
        });
      }
    } catch (error) {
      // Keep mutation for next sync attempt
      console.log('Sync failed for mutation:', mutation.id, error);
    }
  }
}

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BarangayConnectDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cachedData')) {
        db.createObjectStore('cachedData', { keyPath: 'key' });
      }
    };
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteFromStore(store, id) {
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'queue-mutation') {
    queueMutation(event.data.mutation);
  } else if (event.data.type === 'get-cached-data') {
    getCachedData(event.data.key).then((data) => {
      event.ports[0].postMessage({ data });
    });
  } else if (event.data.type === 'set-cached-data') {
    setCachedData(event.data.key, event.data.value);
  }
});

async function queueMutation(mutation) {
  const db = await openIndexedDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');
  await new Promise((resolve, reject) => {
    const request = store.add(mutation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  // Register for background sync
  if ('serviceWorker' in navigator && 'sync' in self.registration) {
    self.registration.sync.register('sync-mutations');
  }
}

async function getCachedData(key) {
  const db = await openIndexedDB();
  const tx = db.transaction('cachedData', 'readonly');
  const store = tx.objectStore('cachedData');
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

async function setCachedData(key, value) {
  const db = await openIndexedDB();
  const tx = db.transaction('cachedData', 'readwrite');
  const store = tx.objectStore('cachedData');
  return new Promise((resolve, reject) => {
    const request = store.put({ key, value, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}