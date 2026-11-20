import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("service worker activation removes the previous static asset cache", async () => {
  const source = await readFile(new URL("./sw.js", import.meta.url), "utf8");
  const handlers = {};
  const removedCaches = [];
  let activation;
  const self = {
    addEventListener(name, handler) {
      handlers[name] = handler;
    },
    clients: { claim: () => Promise.resolve() },
  };
  const caches = {
    keys: () => Promise.resolve(["barangay-connect-v1"]),
    delete: (name) => {
      removedCaches.push(name);
      return Promise.resolve();
    },
  };

  vm.runInNewContext(source, { self, caches, Promise });
  handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;

  assert.deepEqual(removedCaches, ["barangay-connect-v1"]);
});

test("static assets refresh from the network before using the cached copy", async () => {
  const source = await readFile(new URL("./sw.js", import.meta.url), "utf8");
  const handlers = {};
  const cache = {
    match: () => Promise.resolve(new Response("stale script")),
    put: () => Promise.resolve(),
  };
  const self = {
    addEventListener(name, handler) {
      handlers[name] = handler;
    },
  };
  const caches = { open: () => Promise.resolve(cache) };

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: () => Promise.resolve(new Response("fresh script")),
    Promise,
    Request,
    Response,
    URL,
  });

  let responsePromise;
  handlers.fetch({
    request: new Request("https://example.test/script.js"),
    respondWith(response) {
      responsePromise = Promise.resolve(response);
    },
  });

  assert.equal(await (await responsePromise).text(), "fresh script");
});
