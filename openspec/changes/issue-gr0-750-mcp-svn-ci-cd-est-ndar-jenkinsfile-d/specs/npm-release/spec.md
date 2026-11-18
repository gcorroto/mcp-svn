# Specification

## Requirement: Publicación npm desde CI

As a maintainer, I want npm releases managed through Jenkins, so that publication follows the shared release standard.

#### Scenario: Configuración del pipeline

- GIVEN el repositorio preparado para CI
- WHEN Jenkins lee el Jenkinsfile de la raíz
- THEN contiene exactamente `@Library('jenkins-voip-reporter@main') _` y `publishNpmLibrary()` en líneas consecutivas

#### Scenario: Patch automático

- GIVEN un push a `main`
- WHEN Jenkins procesa una publicación ordinaria
- THEN incrementa el patch, crea el commit `chore(release): vX.Y.Z [ci skip]` y el tag `vX.Y.Z`, y publica en npm

#### Scenario: Release minor o major

- GIVEN una persona mantenedora solicita una versión minor o major
- WHEN ejecuta respectivamente `npm run release:minor` o `npm run release:major`
- THEN el script ejecuta el correspondiente `version:*`, crea el commit `chore(release): vX.Y.0` sin `[ci skip]` y hace `git push`, sin publicar en npm
- AND Jenkins publica esa versión sin volver a incrementarla

#### Scenario: Scripts de publicación y comprobación

- GIVEN los scripts de `package.json`
- WHEN se inspeccionan
- THEN `postpublish`, `release:patch` y `prerelease` no existen, ningún script ejecuta `npm publish`, y `check` ejecuta `npm run build && npm test`
- AND los scripts `version:patch`, `version:minor` y `version:major` permanecen sin cambios

#### Scenario: Versión conservada en el cambio

- GIVEN la versión actual del paquete
- WHEN se aplica este cambio
- THEN el campo `version` de `package.json` permanece sin cambios

#### Scenario: Documentación de releases

- GIVEN la sección «Releasing» del README
- WHEN una persona mantenedora consulta el proceso
- THEN encuentra en cuatro líneas el patch automático en CI, los comandos minor y major y la publicación exclusiva desde CI, sin detalles internos del pipeline
