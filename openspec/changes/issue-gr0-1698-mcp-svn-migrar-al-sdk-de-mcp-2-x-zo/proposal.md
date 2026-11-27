# Proposal

## Why

El servidor usa el SDK MCP 1.6.1 y Zod 3. La migración a MCP 2 permite actualizar la plataforma manteniendo el contrato de las herramientas SVN.

## What Changes

- Migrar el servidor stdio al SDK MCP 2 y Zod 4.2 o superior, conservando los contratos y avisos de arranque.
- **BREAKING**: elevar el mínimo de Node.js a 20 y publicar la versión del paquete 0.2.0.
- Añadir una prueba de humo MCP real y conservar las pruebas existentes; actualizar la documentación y dependencias.
- No añadir HTTP ni MCP Events ni modificar Jenkins o el flujo de publicación.

## Capabilities

### New Capabilities

- `svn-mcp-stdio`: Contrato público del servidor SVN por stdio, incluidos sus esquemas de herramientas y requisitos de ejecución.

### Modified Capabilities

Ninguna: no hay especificaciones principales existentes.

## Impact

Afecta a `index.ts`, dependencias y lockfile, versión compartida, README y pruebas Jest. Los clientes conservan las 16 herramientas y sus respuestas; los despliegues necesitan Node 20 o posterior.
