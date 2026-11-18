# Dominio Finanzas USD

- `financialOverview.ts`: honorarios contratados, pagos recibidos, por cobrar, anticipos y cuentas ambiguas.
- `moneyIntegrity.ts`: agrupaciones y formatos de moneda sin sumar unidades diferentes ni cambiar registros históricos.
- La clasificación histórica por categorías de `finance.ts` fue retirada: no tenía consumidores en la PWA ni en el Worker. Los cálculos válidos viven solo en `financialOverview.ts` y `moneyIntegrity.ts`.

**Reglas:** USD es la única moneda operativa para nuevas escrituras. MXN histórico se conserva sin conversión y se excluye de los totales USD. Un anticipo no aumenta el honorario contratado. Las fórmulas no se copian a Excel/Calendario.
