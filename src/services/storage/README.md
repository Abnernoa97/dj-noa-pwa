# Servicios de almacenamiento

- `dataBackup.ts`: exportación/restauración de datos del usuario con el contrato existente.
- La base `dj-noa-local` y sus índices/versiones son **contratos protegidos**. No editar ni resetear el esquema como parte de reorganizar carpetas.
- La ubicación del código no afecta los datos IndexedDB guardados bajo el mismo origen.
