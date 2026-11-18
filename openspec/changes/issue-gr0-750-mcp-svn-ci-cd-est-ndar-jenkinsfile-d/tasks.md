# Tasks

## 1. Configuración y documentación

- [ ] 1.1 Crear el `Jenkinsfile` raíz con exactamente las dos líneas indicadas en la incidencia (escenario: Configuración del pipeline).
- [ ] 1.2 Actualizar `package.json`: quitar `postpublish`, `release:patch` y `prerelease`; añadir `check` y establecer `release:minor` y `release:major` con los comandos exactos de la incidencia, conservando `version:*` y el campo `version` (escenarios: Release minor o major, Scripts de publicación y comprobación, Versión conservada en el cambio).
- [ ] 1.3 Actualizar «Releasing» del README en cuatro líneas según la incidencia (escenario: Documentación de releases).

## 2. Verificación local

- [ ] 2.1 Revisar el contenido exacto del Jenkinsfile y de los scripts, la ausencia de `npm publish`, la conservación de los scripts `version:*` y del campo `version`, y el README (escenarios: Configuración del pipeline, Release minor o major, Scripts de publicación y comprobación, Versión conservada en el cambio, Documentación de releases).
- [ ] 2.2 Ejecutar `npm run check` y documentar cualquier comprobación que no pueda ejecutarse en el entorno (escenario: Scripts de publicación y comprobación).

## Verificación tras el despliegue

- [ ] Confirmar en Jenkins que un push ordinario a `main` incrementa el patch, crea el commit con `[ci skip]` y el tag, y publica en npm (escenario: Patch automático).
- [ ] Confirmar en una release minor o major autorizada que Jenkins publica la versión existente sin incrementarla de nuevo (escenario: Release minor o major).
