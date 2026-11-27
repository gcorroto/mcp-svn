# Tasks

## 1. Migración y dependencias

- [x] 1.1 Ejecutar `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` desde la raíz y resolver cada marca; verificar que no quede ninguna marca `@mcp-codemod-error`.
- [x] 1.2 Sustituir el SDK por `@modelcontextprotocol/server` ^2.4.0, añadir `@modelcontextprotocol/client` ^2.4.0 como dependencia de desarrollo y usar Zod ^4.2.0; buscar imports de `zod-to-json-schema` y retirarlo si no se usa. Actualizar el lockfile e instalar con npm; verificar la instalación.
- [x] 1.3 Establecer Node >=20 y versión 0.2.0 en paquete, lockfile y `common/version.ts`; actualizar el README y comprobar que declara Node 20 mínimo.

## 2. Servidor y compatibilidad

- [x] 2.1 Extraer `buildServer()` y usar `serveStdio(() => buildServer())` desde el subpath stdio sin await ni then; conservar avisos de arranque por stderr y contraseña enmascarada, y verificar su comportamiento.
- [x] 2.2 Revisar los 16 registros y esquemas convertidos frente al original, incluidos textos `.describe()`, parámetros, valores por defecto y respuestas; adaptar donde sea necesario `z.record`, `ZodTypeDef` y `optional`/`default` para Zod 4 y verificar la compatibilidad.
- [x] 2.3 Añadir `tests/server-smoke.test.ts`: compilar con `execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'])`, arrancar `dist/index.js` con Client y StdioClientTransport, variables SVN falsas y timeout de 30 s; comprobar el conjunto exacto de 16 nombres y textos exactos `Local path, full URL, or repo-relative path like '/trunk/foo'` de `svn_info.path` y `Also show remote status` de `svn_status.showAll`, y cerrar recursos.
- [x] 2.4 Mantener todos los tests existentes y adaptar solo lo necesario para la migración; ejecutar la suite incluyendo el test de humo y comprobar que pasa.

## 3. Verificación integral

- [x] 3.1 Ejecutar `npm run build`, `npm test` y `npm run check`; comprobar que todos pasan con las dependencias instaladas.
- [x] 3.2 Buscar referencias al SDK anterior en código, tests, scripts y package.json y marcas del codemod; verificar su ausencia y que Jenkinsfile y publicación no se hayan modificado.
- [x] 3.3 Preparar el resumen final para la issue con lo que hizo el codemod, ajustes manuales y sorpresas de Zod 4, ts-jest y tests; verificar que refleja los resultados reales.

## Verificación tras el despliegue

- [ ] Comprobar el arranque y descubrimiento de herramientas en el entorno desplegado después de la integración, cuando dicho entorno esté disponible.
