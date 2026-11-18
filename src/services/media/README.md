# Servicios de medios

`photoOptimization.ts` realiza tareas de mantenimiento de fotografías almacenadas manualmente. **No es Noah Visión** y no debe activar guardado de fotos analizadas por IA. Se mantiene separado de los módulos de negocio y de la base local.

- `photoPreviews.ts`: único ciclo de vida de previsualizaciones `blob:` entre Eventos y Excel, con revocación de URLs y sustitución de listas. No guarda fotografías ni altera Noah Visión.
