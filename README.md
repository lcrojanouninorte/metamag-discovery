# Metamag Discovery

Herramienta local-first para que asesores conduzcan entrevistas consultivas, documenten evidencia y validen un diagnóstico comercial y operativo. Las preguntas se cargan desde definiciones JSON; no están escritas en componentes.

## Desarrollo

Requisitos: Node.js 24 LTS y npm.

```powershell
npm ci
npm start
```

La aplicación se sirve en `http://localhost:4200`. Ejecuta pruebas unitarias con `npm test` y el build de producción con `npm run build`.

## Uso y datos

- La web pública carga un formulario ficticio. Para trabajar con una definición privada, impórtala desde un archivo JSON con **Cargar definición JSON** antes de crear la sesión; el archivo se lee localmente y no se sube a ningún servidor.
- Cada sesión guarda una copia de su definición en IndexedDB, así puede retomarse después de recargar aunque el formulario importado ya no esté en memoria.
- La entrevista admite preguntas condicionales declaradas en JSON y registra estado, respuesta, evidencia y notas privadas.
- El asesor puntúa manualmente cada dimensión; respuestas pendientes nunca se convierten en cero.
- La evaluación de madurez y la selección de servicios son decisiones distintas.
- IndexedDB guarda las sesiones en el navegador. Exporta respaldos JSON para transferir o recuperar información.
- El informe de cliente tiene vista previa de impresión y permite usar “Guardar como PDF” desde el navegador. Las notas privadas solo están disponibles en el informe interno.
- No guardes contraseñas ni datos sensibles. Borrar datos del navegador elimina también las sesiones locales.

El modelo de bandas es una hipótesis operativa configurable, no una prueba psicométrica ni una promesa de crecimiento. El informe del cliente comunica limitaciones y datos pendientes.

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` ejecuta pruebas, compila con el `base-href` del repositorio y publica `dist/metamag-discovery/browser`. En GitHub, habilita **Settings → Pages → Build and deployment → GitHub Actions**. El workflow despliega al hacer push a `main` o `master`, y también se puede iniciar manualmente. El enrutamiento hash evita depender de rewrites del servidor estático.

La URL depende del propietario y nombre del repositorio; no se considera publicado hasta que el despliegue de Actions finalice y la URL de Pages responda.

## Arquitectura

- Angular standalone, Reactive Forms, TypeScript estricto y Router con hash.
- `src/app/core/domain.ts`: entidades versionables de sesiones, respuestas, evidencias, dimensiones, servicios y roadmap.
- `src/app/core/form-engine.ts`: preguntas condicionales declaradas por datos.
- `src/app/core/assessment.ts`: cálculo determinista, rango provisional, brechas y controles para nivel manual.
- `src/app/core/services.catalog.ts`: catálogo configurable independiente de la madurez.
- `src/app/core/report.ts`: proyección para cliente sin notas privadas.
- IndexedDB nativo, sin backend y sin dependencias de persistencia.

Las definiciones privadas se excluyen del repositorio y del build de GitHub Pages. El asset público de demostración utiliza datos ficticios. El cliente y los antecedentes importados solo se guardan en la sesión local del navegador y en los respaldos JSON que el asesor decida exportar.
