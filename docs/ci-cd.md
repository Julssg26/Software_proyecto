# CI/CD — DonaRed

El workflow `.github/workflows/ci.yml` valida cada push a `main` y cada pull
request hacia `main`. No realiza despliegues ni escaneos de servicios externos.

| Job | Directorio | Comandos |
| --- | --- | --- |
| backend-tests | backend/ | `npm ci`, `node --test tests/*.test.js` |
| frontend-checks | frontend/ | `npm ci`, `node --test tests/*.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `npm run lint`, `npm run build` |

Los jobs son independientes y usan Ubuntu, Node.js 22 y caché npm con el
lockfile de cada aplicación. Los scripts package.json no se modifican.

Las pruebas backend usan persistencia simulada. Solo se definen
`JWT_SECRET=ci_test_secret` y `DB_NAME=donaciones_ci`. El frontend compila con
`VITE_API_URL=https://example.invalid/api`. No se necesita MongoDB ni secretos.

Ambos jobs deben pasar. Para bloquear merges cuando fallen, configura
`backend-tests` y `frontend-checks` como checks obligatorios en la protección
de `main`. El workflow no modifica esa configuración del repositorio.
