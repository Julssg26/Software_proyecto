# DonaRed

Plataforma universitaria para gestionar donaciones entre empresas y organizaciones sociales.

## Estructura

```text
share-sustain-thrive/
├── frontend/        # React + TypeScript + Vite (con TanStack)
├── backend/         # Node.js + Express (con Mongoose)
├── .gitignore
└── README.md
```

La metadata del repositorio (`.git/`) permanece en la raíz.
Cada aplicación tiene su propio `package.json` y sus propias dependencias.

## Requisitos

- Node.js 22.14 o superior compatible y npm.
- Acceso a MongoDB Atlas para ejecutar el backend.
- Base de datos: MongoDB Atlas, base `donaciones_db`.

## Backend

En una terminal, desde la raíz del repositorio:

```powershell
cd backend
npm install
npm run dev
```

Antes del primer inicio, copia `backend/.env.example` a `backend/.env` si todavía no existe. Configura localmente `MONGODB_URI`, `JWT_SECRET` y `PORT=3000`. No sobrescribas un `.env` existente ni compartas credenciales en Git.

El backend usa explícitamente la base `donaciones_db` y escucha en `http://localhost:3000`.

Para crear el administrador inicial, configura también `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `backend/.env` y ejecuta desde `backend/`:

```powershell
npm run create-admin
```

El registro público solo permite `empresa` y `organizacion`. Un administrador existente inicia sesión desde el mismo formulario normal. Los roles del sistema son `admin`, `empresa` y `organizacion`.

El seed es opcional y añade documentos de prueba sin borrar datos ni crear usuarios:

```powershell
npm run seed-db
```

Requiere una empresa y una organización existentes. Cada ejecución añade un conjunto nuevo de datos de prueba.

## Frontend

En otra terminal, desde la raíz del repositorio:

```powershell
cd frontend
npm install
npm run dev
```

Abre la URL que indique Vite. Para mantener siempre el mismo origen durante las pruebas locales:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

La API permanece configurada en `frontend/src/services/api.ts` como `http://localhost:3000/api`. Actualmente no requiere un `.env` del frontend ni utiliza `VITE_API_URL`. Nunca copies las variables privadas del backend al frontend.

El frontend genera su HTML mediante `frontend/src/routes/__root.tsx`; no utiliza `index.html`.

## Verificaciones

Desde `frontend/`:

```powershell
npx tsc --noEmit
node --test tests/api.test.mjs
npm run build
```

Desde `backend/`:

```powershell
node --test tests/*.test.js
```

Las pruebas existentes de backend usan persistencia simulada y no modifican Atlas.

## Estado funcional

- Autenticación, sesión, perfil y Entity están conectados al backend real.
- Los listados administrativos de usuarios, empresas y organizaciones consultan datos reales del backend y requieren el rol `admin`.
- Donaciones, solicitudes, entregas y reportes conservan su comportamiento simulado en el frontend.
- El backend incluye los modelos Donation, Request, Delivery y Notification; todavía no tiene endpoints para esos módulos.
- Los directorios de dependencias, compilación, cachés y archivos `.env` están ignorados por Git. Los `.env.example` pueden versionarse.

## CI/CD

GitHub Actions ejecuta [.github/workflows/ci.yml](.github/workflows/ci.yml) en cada
push a `main` y pull request hacia `main`, con dos jobs independientes:

- `backend-tests`: instala con `npm ci` y ejecuta todas las pruebas de node:test
  con persistencia simulada, sin MongoDB real.
- `frontend-checks`: instala con `npm ci` y ejecuta pruebas, TypeScript, lint y build.

Ambos usan Node.js 22 y caché npm separada por lockfile. No existen scripts
`test` o `typecheck`: se ejecutan directamente `node --test` y el compilador
TypeScript instalado. Lint y build usan sus scripts existentes.

Solo se utilizan valores ficticios: `JWT_SECRET=ci_test_secret`,
`DB_NAME=donaciones_ci` y `VITE_API_URL=https://example.invalid/api`.
Este workflow no despliega ni requiere secretos. Ambos jobs deben pasar;
para exigirlo antes de fusionar, configura los checks `backend-tests` y
`frontend-checks` como obligatorios en la protección de `main`.
