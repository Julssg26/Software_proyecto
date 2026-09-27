# CI/CD — DonaRed

Pipeline en `.github/workflows/ci.yml`, con 4 jobs. Corre en cada push/PR a `main`.

## 1. `backend` y `frontend` (siempre activos, bloquean el merge)

- **backend**: `npm ci` + `node --test` sobre `backend/`. No necesita una base de
  datos real: todas las pruebas mockean los métodos de Mongoose (mismo patrón
  que `backend/tests/donation.test.js`).
- **frontend**: `npm ci` + `tsc --noEmit` + `npm run lint` + `npm run build`
  sobre `frontend/`.

Estos dos jobs no requieren ningún secreto. Para que bloqueen el merge en
GitHub: **Settings → Branches → Branch protection rule** sobre `main` →
marcar *"Require status checks to pass before merging"* → seleccionar
`Backend (pruebas)` y `Frontend (tipos, lint y build)`.

## 2. `sonarqube` (se omite solo, sin fallar, hasta que lo configures)

1. Crea una cuenta en [SonarCloud](https://sonarcloud.io) (gratis para repos
   públicos) o levanta un SonarQube propio.
2. Da de alta el proyecto usando la clave `donared` (o cambia
   `sonar.projectKey` en `sonar-project.properties` si prefieres otra).
3. En GitHub: **Settings → Secrets and variables → Actions** → agrega:
   - `SONAR_TOKEN`: el token generado por Sonar.
   - `SONAR_HOST_URL`: `https://sonarcloud.io` (u otra URL si es on-premise).
4. Vuelve a correr el pipeline: el job dejará de mostrarse como omitido y
   generará el reporte en el dashboard de Sonar.

## 3. `owasp-zap` (se omite solo, sin fallar, hasta que lo configures)

Corre únicamente en push a `main` (no en cada PR, porque necesita un entorno
ya desplegado y accesible). Pasos:

1. Despliega un entorno de staging del **frontend** (ver la variable
   `VITE_API_URL` en `frontend/.env.example`) apuntando a un backend de
   staging con su propia base de datos, **separada de `donaciones_db`**.
2. En GitHub: agrega el secreto `STAGING_URL` con la URL pública de ese
   staging (ej. `https://donared-staging.vercel.app`).
3. El siguiente push a `main` correrá el
   [baseline scan de OWASP ZAP](https://www.zaproxy.org/docs/docker/baseline-scan/)
   contra esa URL y subirá el reporte como artefacto del run en GitHub
   Actions (pestaña *Actions* → el run correspondiente → *Artifacts*).

## Notas

- Ninguno de los dos jobs opcionales rompe el pipeline si falta su secreto:
  ambos imprimen un aviso (`::notice::`) y terminan en verde. Así el CI
  obligatorio (tests + build) no queda bloqueado por infraestructura que aún
  no existe.
- El checklist de aceptación del plan (7.3) pide "al menos un reporte de
  SonarQube y uno de OWASP ZAP antes de la entrega final": basta con
  configurar los secretos una vez y dejar correr el pipeline; no hace falta
  automatizar más que esto para cumplirlo.
