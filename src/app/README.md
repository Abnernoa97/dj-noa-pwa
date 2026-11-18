# Núcleo de la aplicación · DJ NOA

- `App.tsx`: coordinador de pantallas, acciones y estado; una única entrada de la app.
- `navigationBack.ts`: historial de gestos y botón Atrás nativo, compartido por todas las pantallas.
- `BottomNav.tsx`: barra de navegación.
- `HomeView.tsx`: pantalla principal.

`src/main.tsx` sigue siendo la entrada de React, servicio de PWA y orden de CSS.
Las reglas de Excel, Noah, eventos, finanzas y deportes permanecen en sus propios capítulos. No crear otra copia de `App` ni otra pila de navegación.

Pendiente dentro de P03: dividir el coordinador `App.tsx` según sus responsabilidades, con pruebas de estado y equivalencia. **Mover archivos no basta para cerrar P03.**
