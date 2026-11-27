# Design

## Context

`index.ts` registra 16 herramientas con el SDK 1 y crea el servicio SVN de forma diferida. Los avisos de configuración van a stderr. El proyecto usa ESM, TypeScript Node16 y Jest con ts-jest ESM. Hay 10 archivos de pruebas existentes; `common/version.ts` contiene actualmente 0.1.0 aunque el paquete indica 0.1.5.

## Goals / Non-Goals

**Goals:** Mantener los contratos observables de `svn-mcp-stdio` durante la migración y comprobar el descubrimiento mediante un cliente real.

**Non-Goals:** Cambiar la lógica SVN, añadir transportes o extensiones, ni modificar Jenkins o publicación.

## Decisions

- Ejecutar primero el codemod oficial y revisar todas sus marcas. Usar `registerTool` con `z.object` y mantener intactos descripciones, validaciones, valores por defecto, callbacks y respuestas. La conversión manual completa se descarta porque la issue requiere el codemod.
- Construir y registrar el servidor en `buildServer()` y arrancar con `serveStdio(() => buildServer())` desde `@modelcontextprotocol/server/stdio`, sin tratar su manejador como promesa. Conservar diagnósticos y enmascaramiento de contraseña; no mantener la conexión manual antigua como arranque principal.
- Usar server y client ^2.4.0, Zod ^4.2.0 y Node >=20; retirar `zod-to-json-schema` solo después de buscar importaciones. Actualizar lockfile, paquete y `common/version.ts` a 0.2.0. Revisar `z.record`, `ZodTypeDef` y la semántica de `optional`/`default` donde existan.
- Probar `dist/index.js` con cliente y transporte stdio reales, compilando con `execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'])`. Aislar variables de entorno pertinentes y cerrar el transporte. Verificar las 16 herramientas y las descripciones exactas de `svn_info.path` y `svn_status.showAll`; un test de unidad aislado no detectaría fallos reales de `tools/list`.

## Risks / Trade-offs

- [Zod 4 cambia valores predeterminados o esquemas] → comparar contratos y revisar las combinaciones `optional`/`default`, además del listado real.
- [Las descripciones desaparecen silenciosamente] → exigir Zod >=4.2 y comprobar dos descripciones exactas en herramientas distintas.
- [Jest ESM o el proceso hijo no terminan] → adaptar solo lo exigido por la migración, cerrar recursos y limitar el test a 30 segundos.
- [Avisos o secretos en el canal MCP] → preservar stderr y no registrar contraseñas.

## Migration Plan

Aplicar codemod, ajustes manuales y dependencias; ejecutar build, suite y check antes de integrar. Si fuera necesario revertir tras integrar, restaurar conjuntamente código, dependencias, lockfile y versión anteriores. La validación en un entorno desplegado queda fuera de este workspace.
