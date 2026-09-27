import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadApi(fetch) {
  const storage = new Map();
  const events = [];
  const exports = {};
  const source = ts.transpileModule(
    readFileSync(new URL("../src/services/api.ts", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    fetch,
    AbortSignal,
    Event,
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
      dispatchEvent: (event) => events.push(event.type),
    },
  });
  return { ...exports, events };
}

test("GET, POST y PUT usan URL, JSON y Bearer del token real", async () => {
  const requests = [];
  const client = loadApi(async (url, options) => {
    requests.push({ url, options });
    return Response.json({ entity: { name: "Empresa real" } });
  });
  client.saveToken("test-token");
  for (const method of ["GET", "POST", "PUT"]) {
    const result = await client.api("/entities/me", {
      method,
      ...(method !== "GET" ? { body: { name: "Empresa real" } } : {}),
    });
    assert.equal(result.entity.name, "Empresa real");
  }
  assert.equal(requests.length, 3);
  for (const { url, options } of requests) {
    assert.equal(url, "http://localhost:3000/api/entities/me");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    if (options.method !== "GET") assert.equal(JSON.parse(options.body).name, "Empresa real");
  }
});

test("Login incorrecto no envía token ni invalida otra sesión", async () => {
  const client = loadApi(async (_, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ message: "Credenciales inválidas" }, { status: 401 });
  });
  client.saveToken("existing-token");
  await assert.rejects(
    client.api("/auth/login", { method: "POST", authenticated: false }),
    /Credenciales incorrectas/,
  );
  assert.equal(client.getToken(), "existing-token");
  assert.equal(client.events.length, 0);
});

test("401 protegido elimina token y notifica al store", async () => {
  const client = loadApi(async () => Response.json({ message: "Token inválido" }, { status: 401 }));
  client.saveToken("expired-token");
  await assert.rejects(client.api("/auth/profile"), /Token inválido/);
  assert.equal(client.getToken(), null);
  assert.deepEqual(client.events, ["donared-session-expired"]);
});

test("Una respuesta atrasada no borra el token de una nueva sesión", async () => {
  let finish;
  const client = loadApi(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  client.saveToken("old-token");
  const pending = client.api("/auth/profile");
  client.saveToken("new-token");
  finish(Response.json({ message: "Token inválido" }, { status: 401 }));
  await assert.rejects(pending);
  assert.equal(client.getToken(), "new-token");
  assert.equal(client.events.length, 0);
});

test("Errores de conexión, usuario inactivo, email duplicado y JSON inválido son claros", async () => {
  const offline = loadApi(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(offline.api("/auth/profile"), /Error de conexión con el servidor/);
  const inactive = loadApi(async () =>
    Response.json({ message: "Usuario inactivo" }, { status: 403 }),
  );
  await assert.rejects(inactive.api("/auth/login"), /Usuario inactivo/);
  const duplicate = loadApi(async () => Response.json({}, { status: 409 }));
  await assert.rejects(duplicate.api("/auth/register"), /Email ya registrado/);
  const invalid = loadApi(async () => new Response("<html>"));
  await assert.rejects(invalid.api("/auth/profile"), /respuesta inválida/);
});
