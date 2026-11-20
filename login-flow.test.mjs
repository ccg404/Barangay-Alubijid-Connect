import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./script.js", import.meta.url), "utf8");

function getFunction(name) {
  const found = source.match(
    new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`),
  );
  assert.ok(found, `${name} function is missing`);
  return found[0];
}

test("resident demo login renders the resident portal and account menu", () => {
  const household = {
    id: "h1",
    accountNumber: "0231-4470",
    password: "resident123",
    headName: "Juan Dela Cruz",
  };
  const app = { innerHTML: "" };
  const document = {
    title: "",
    getElementById(id) {
      return id === "app" ? app : null;
    },
  };

  const result = vm.runInNewContext(
    [
      getFunction("handleLogin"),
      getFunction("renderPortal"),
      getFunction("isResident"),
      getFunction("renderResident"),
      getFunction("topbar"),
      getFunction("appMenuMarkup"),
      `handleLogin({
        preventDefault() {},
        currentTarget: {},
      });
      ({
        title: document.title,
        content: document.getElementById("app").innerHTML,
        role: session.user?.role,
      });`,
    ].join("\n"),
    {
      document,
      FormData: class {
        get(name) {
          return { account: "0231-4470", password: "resident123" }[name];
        }
      },
      state: { households: [household], staff: [] },
      session: { user: null, view: "home" },
      commitState: () => true,
      currentHousehold: () => household,
      residentNavigation: () => [],
      portalNavigation: () => "",
      portalHeader: () => "",
      renderStaleIndicator: () => "",
      residentView: () => "resident-content",
      residentAside: () => "",
      updateStaleIndicator() {},
      localStorage: { getItem: () => null },
      escapeHtml: (value) => value,
      initials: () => "JD",
      renderLogin() {},
      renderStaff() {},
    },
  );

  assert.equal(result.title, "Juan Dela Cruz · Barangay Connect");
  assert.equal(result.role, "resident");
  assert.match(result.content, /resident-content/);
  assert.match(result.content, /data-action="open-menu"/);
  assert.match(result.content, /id="app-menu"/);
});
