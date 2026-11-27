# Spec Delta

## Purpose

Permitir a los clientes MCP descubrir y ejecutar operaciones SVN por stdio con un contrato estable.

## ADDED Requirements

### Requirement: Descubrimiento de herramientas SVN
El servidor SHALL exponer exactamente las 16 herramientas SVN existentes con sus nombres, descripciones, parámetros, tipos, obligatoriedad, valores predeterminados y descripciones de campos sin cambios.

#### Scenario: Listado de herramientas
- **WHEN** un cliente MCP conectado por stdio solicita `tools/list`
- **THEN** obtiene exactamente `svn_health_check`, `svn_diagnose`, `svn_info`, `svn_status`, `svn_log`, `svn_diff`, `svn_checkout`, `svn_update`, `svn_add`, `svn_commit`, `svn_delete`, `svn_revert`, `svn_cleanup`, `svn_cat`, `svn_list` y `svn_clear_credentials`
- **AND** los esquemas y textos coinciden con el contrato anterior a la migración

### Requirement: Respuestas compatibles
El servidor SHALL conservar el comportamiento y formato de las respuestas y errores de las herramientas existentes.

#### Scenario: Invocación de una herramienta
- **WHEN** un cliente invoca una herramienta con argumentos válidos o una operación falla
- **THEN** la respuesta conserva el formato y comportamiento anteriores a la migración

### Requirement: Arranque stdio y diagnósticos
El servidor SHALL comunicarse por stdio y conservar los avisos de configuración por stderr sin revelar contraseñas.

#### Scenario: Variables de configuración ausentes
- **WHEN** se inicia sin variables de configuración opcionales
- **THEN** los avisos y valores de respaldo existentes se mantienen en stderr y stdout queda disponible para MCP

#### Scenario: Contraseña configurada
- **WHEN** se inicia con una contraseña SVN
- **THEN** los diagnósticos no muestran su valor

### Requirement: Versión de ejecución
El paquete SHALL requerir Node.js 20 o posterior y declarar la versión 0.2.0 de forma coherente.

#### Scenario: Requisitos documentados
- **WHEN** un usuario consulta los metadatos o el README
- **THEN** encuentra Node.js 20 como versión mínima
