import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("sign-in view provides the skip link target", async () => {
  const source = await readFile(new URL("./script.js", import.meta.url), "utf8");
  const renderLogin = source.match(
    /function renderLogin\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(renderLogin, "renderLogin function is missing");

  const app = { innerHTML: "" };
  const loginForm = { addEventListener() {} };
  const document = {
    title: "",
    getElementById(id) {
      return id === "app" ? app : loginForm;
    },
  };
  vm.runInNewContext(`${renderLogin}; renderLogin();`, {
    document,
    handleLogin() {},
  });

  assert.match(app.innerHTML, /<main id="main-content"[^>]*tabindex="-1"/);
});
