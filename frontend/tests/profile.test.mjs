import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const require = createRequire(import.meta.url);
const src = path.resolve("src");
const Context = React.createContext(null);
const notices = [];
let fetchHandler;

function loadModules() {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const source = ts.transpileModule(
      readFileSync(filename, "utf8").replace(/import\.meta\.env/g, "testEnv"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const resolve = (name) => {
      if (name === "sonner")
        return {
          toast: {
            success: (message) => notices.push(["success", message]),
            error: (message) => notices.push(["error", message]),
          },
        };
      if (name === "@/lib/store") return { useStore: () => React.useContext(Context) };
      if (name === "@/components/app-shell")
        return { AppShell: ({ children }) => React.createElement("main", null, children) };
      if (name === "@tanstack/react-router") return { createFileRoute: () => (options) => options };
      if (name.startsWith(".") || name.startsWith("@/")) {
        const base = name.startsWith("@/")
          ? path.join(src, name.slice(2))
          : path.resolve(path.dirname(filename), name);
        const file = [base + ".ts", base + ".tsx"].find(existsSync);
        assert.ok(file, name);
        return load(file);
      }
      return require(name);
    };
    vm.runInNewContext(
      source,
      {
        module,
        exports: module.exports,
        require: resolve,
        testEnv: {},
        window: dom.window,
        document: dom.window.document,
        fetch: (...args) => fetchHandler(...args),
        AbortSignal,
        Event: dom.window.Event,
        Error,
        console,
        setTimeout,
        clearTimeout,
      },
      { filename },
    );
    return module.exports;
  }
  return {
    Page: load(path.join(src, "routes/perfil.tsx")).Route.component,
    useSession: load(path.join(src, "hooks/use-auth-session.ts")).useAuthSession,
  };
}

test("Perfil: carga, edición y sesión mediante servicios reales con HTTP simulado", async (t) => {
  async function setup(role = "empresa", hasEntity = true) {
    notices.length = 0;
    window.localStorage.setItem("donared-auth-token", "session-token");
    let entity = {
      _id: "entity-1",
      name: "Entidad original",
      type: role,
      description: "Alimentos",
      email: "contacto@example.com",
      phone: "5551234567",
      address: { city: "Puebla", street: "Calle 1" },
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const user = {
      _id: "user-1",
      name: "Cuenta original",
      email: "cuenta@example.com",
      role,
      entityId: hasEntity ? entity._id : null,
      status: "active",
    };
    const calls = [];
    let failSave = false;
    let releaseSave;
    let pendingSave;
    fetchHandler = async (url, options) => {
      calls.push({ url, ...options });
      assert.equal(options.headers.Authorization, "Bearer session-token");
      if (url.endsWith("/auth/profile")) return Response.json({ user });
      assert.equal(url, "http://localhost:3000/api/entities/me");
      if (!hasEntity)
        return Response.json({ message: "No tienes una entidad asociada" }, { status: 404 });
      if (options.method === "PUT") {
        if (pendingSave) await pendingSave;
        if (failSave) return Response.json({ message: "No se pudo guardar" }, { status: 500 });
        const body = JSON.parse(options.body);
        entity = { ...entity, ...body, address: { ...entity.address, ...body.address } };
      }
      return Response.json({ entity });
    };
    const { Page, useSession } = loadModules();
    let session;
    function Harness() {
      session = useSession();
      return React.createElement(
        Context.Provider,
        {
          value: {
            ...session,
            hydrated: session.sessionReady,
            donations: [],
            requests: [],
          },
        },
        React.createElement(Page),
      );
    }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Harness)));
    return {
      container,
      calls,
      user,
      session: () => session,
      fail: () => {
        failSave = true;
      },
      pause: () => {
        pendingSave = new Promise((resolve) => {
          releaseSave = resolve;
        });
      },
      release: async () => act(async () => releaseSave()),
      close: async () => {
        await act(async () => root.unmount());
        container.remove();
      },
    };
  }
  const button = (view, label) =>
    [...view.container.querySelectorAll("button")].find((node) => node.textContent === label);
  const click = async (view, label) => {
    const node = button(view, label);
    assert.ok(node, label);
    await act(async () => node.click());
  };
  const change = async (view, name, value) => {
    const input = view.container.querySelector('input[name="' + name + '"]');
    assert.ok(input, name);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
        input,
        value,
      );
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  const submit = async (view) =>
    act(async () =>
      view.container
        .querySelector("form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
    );

  for (const role of ["empresa", "organizacion"]) {
    await t.test(role + ": carga, cancela y guarda entidad sin alterar cuenta ni JWT", async () => {
      const view = await setup(role);
      try {
        assert.match(view.container.textContent, /Entidad original/);
        assert.match(view.container.textContent, /Alimentos/);
        assert.match(view.container.textContent, /Puebla/);
        await click(view, "Editar perfil");
        assert.deepEqual(
          [...view.container.querySelectorAll("input")].map((n) => n.name),
          ["name", "description", "city", "email", "phone"],
        );
        await change(view, "name", "Cambio descartado");
        await click(view, "Cancelar");
        assert.match(view.container.textContent, /Entidad original/);
        assert.equal(view.calls.filter((c) => c.method === "PUT").length, 0);
        await click(view, "Editar perfil");
        assert.equal(view.container.querySelector('[name="name"]').value, "Entidad original");
        await change(view, "name", " Nueva entidad ");
        await change(view, "description", " Comercio ");
        await change(view, "city", " Monterrey ");
        await change(view, "email", "nuevo@example.com");
        await change(view, "phone", "5557654321");
        view.pause();
        await submit(view);
        assert.equal(view.container.querySelector("fieldset").disabled, true);
        await submit(view);
        assert.equal(view.calls.filter((c) => c.method === "PUT").length, 1);
        await view.release();
        assert.equal(view.container.querySelector("form"), null);
        assert.match(view.container.textContent, /Nueva entidad/);
        assert.match(view.container.textContent, /Comercio/);
        assert.match(view.container.textContent, /Monterrey/);
        assert.doesNotMatch(view.container.textContent, /Por definir/);
        assert.deepEqual(JSON.parse(view.calls.find((c) => c.method === "PUT").body), {
          name: "Nueva entidad",
          description: "Comercio",
          address: { city: "Monterrey" },
          email: "nuevo@example.com",
          phone: "5557654321",
        });
        assert.equal(view.session().currentEntity.address.street, "Calle 1");
        assert.equal(view.session().currentUser.entidad, "Nueva entidad");
        assert.equal(view.session().currentUser.nombre, "Cuenta original");
        assert.equal(view.session().currentUser.correo, "cuenta@example.com");
        assert.equal(view.session().currentUser.rol, role);
        assert.equal(window.localStorage.getItem("donared-auth-token"), "session-token");
        assert.ok(notices.some(([kind]) => kind === "success"));
      } finally {
        await view.close();
      }
    });
  }

  await t.test("Valida espacios, contacto y correo antes de enviar", async () => {
    const view = await setup();
    try {
      await click(view, "Editar perfil");
      for (const field of ["name", "description", "city"]) {
        const original = view.container.querySelector('[name="' + field + '"]').value;
        await change(view, field, "   ");
        await submit(view);
        await change(view, field, original);
      }
      await change(view, "email", "");
      await change(view, "phone", " ");
      await submit(view);
      await change(view, "email", "correo-invalido");
      await submit(view);
      assert.equal(view.calls.filter((c) => c.method === "PUT").length, 0);
      assert.equal(notices.filter(([kind]) => kind === "error").length, 5);
    } finally {
      await view.close();
    }
  });

  await t.test("Un error conserva el borrador, los valores originales y la sesión", async () => {
    const view = await setup();
    try {
      await click(view, "Editar perfil");
      await change(view, "city", "Guadalajara");
      view.fail();
      await submit(view);
      assert.equal(view.container.querySelector('[name="city"]').value, "Guadalajara");
      assert.equal(view.session().currentEntity.address.city, "Puebla");
      assert.equal(view.container.querySelector("fieldset").disabled, false);
      assert.ok(
        notices.some(([kind, message]) => kind === "error" && message === "No se pudo guardar"),
      );
      assert.equal(window.localStorage.getItem("donared-auth-token"), "session-token");
      await click(view, "Cancelar");
      assert.match(view.container.textContent, /Puebla/);
    } finally {
      await view.close();
    }
  });

  await t.test("Sin entityId no ofrece edición ni envía PUT", async () => {
    const view = await setup("organizacion", false);
    try {
      assert.equal(button(view, "Editar perfil"), undefined);
      assert.match(view.container.textContent, /No hay una entidad disponible para editar/);
      await assert.rejects(view.session().updateEntity({ name: "Otra" }), /No hay una entidad/);
      assert.equal(view.calls.filter((c) => c.method === "PUT").length, 0);
    } finally {
      await view.close();
    }
  });

  await t.test("Una respuesta de guardado tardía no restaura una sesión cerrada", async () => {
    const view = await setup();
    try {
      await click(view, "Editar perfil");
      view.pause();
      await submit(view);
      await act(async () => view.session().logout());
      await view.release();
      assert.equal(view.session().currentUser, null);
      assert.equal(view.session().currentEntity, null);
      assert.equal(window.localStorage.getItem("donared-auth-token"), null);
      assert.equal(notices.filter(([kind]) => kind === "success").length, 0);
    } finally {
      await view.close();
    }
  });
});
