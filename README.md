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
- Cambia entre **Entrevista esencial** (14 preguntas guía) y **Diagnóstico completo**. Las preguntas condicionales se aplican según su respuesta y las respuestas previas se conservan al cambiar de modo.
- En **Resumen** revisa cobertura, respuestas pendientes y separa hechos confirmados, declaraciones y validaciones por realizar. El borrador ejecutivo solo se comparte en el informe después de marcarlo como revisado.
- En **Diagnóstico**, registra por criterio el resultado, la evidencia, la justificación, el estado y la confianza. Las cinco etapas (Exploración, Activación, Tracción, Optimización y Escalamiento) usan criterios secuenciales por dimensión, no promedios; el nivel permanece provisional hasta que el asesor lo aprueba.
- El estado **Declarado** no confirma un requisito. Para marcar **No cumplido** o **Confirmado** registra un resultado, evidencia y justificación. Las preguntas relacionadas de la entrevista permiten añadir una referencia a la evidencia del criterio; si cambia la respuesta origen, el criterio queda pendiente de revisión y se invalida la aprobación previa.
- Los servicios potenciales aparecen solo ante brechas documentadas o evidencia para explorar apoyo en la siguiente etapa. Son sugerencias, no una propuesta comercial; precios, plazos y garantías no se generan.
- **Preparar propuesta** abre un espacio comercial aparte. Las tres alternativas (Esencial, Recomendada e Integral) empiezan vacías y no heredan automáticamente las sugerencias ni las respuestas negativas del diagnóstico. El asesor debe seleccionar cada servicio y justificar su alcance.
- El catálogo comercial versionado contiene ocho fichas con objetivos, actividades, entregables, aceptación, responsabilidades, exclusiones, dependencias, riesgos, métricas y estimaciones bottom-up optimista/base/conservadora. Las horas son de trabajo; los días calendario se muestran por separado. La ficha de cada servicio se guarda como copia dentro de la propuesta para conservar la versión cotizada.
- El catálogo no contiene tarifas predeterminadas. El asesor define cada precio según el alcance y las condiciones de la propuesta. Los costos horarios internos, costos indirectos, contingencia, margen objetivo, margen mínimo e impuestos comienzan sin configurar. Mientras falte cualquiera de estos datos, la rentabilidad se indica como indeterminada y la aprobación queda bloqueada.
- La fórmula muestra el costo laboral por perfil, suma costos directos, asigna indirectos y contingencia, y calcula el precio objetivo como `costo total / (1 - margen sobre precio de venta)`. Los descuentos de 10 %, 15 % y 20 % solo afectan servicios elegibles; no descuentan gastos externos. Una tarifa por debajo del margen mínimo requiere aprobación y justificación explícitas.
- Las actividades compartidas entre servicios solo se descuentan si el asesor registra la misma clave, perfil, cantidad y estimación de horas, y documenta una justificación. No se descuentan sinergias automáticamente.
- La propuesta imprimible para el cliente se habilita después de la aprobación interna y no contiene costos horarios, costos internos, márgenes ni notas privadas. La aprobación interna no significa que el cliente la haya aceptado. El informe de diagnóstico se conserva independiente y sin precios.
- Cada servicio conserva la versión del catálogo usada para cotizar. Se pueden guardar y restaurar versiones; restaurar una versión revoca la aprobación previa y exige nueva revisión. El informe de diagnóstico, la propuesta y el PDF combinado se imprimen de forma independiente desde sus respectivas vistas.
- Para completar una cotización, el asesor configura explícitamente costos horarios y porcentajes (incluyendo 0 cuando corresponda), costos directos y externos, supuestos, dependencias, alcance, impuestos y condiciones de pago. La configuración fiscal debe validarse antes de compartir; la herramienta no determina el tratamiento tributario.
- La escala complementaria de 0–3 se conserva separada y no determina los cinco niveles de crecimiento. Las preguntas pendientes nunca se convierten en cero.
- Agrega acciones con horizonte de 7 o 30 días (también 60/90) para incluir responsables y evidencia esperada en el informe.
- IndexedDB guarda las sesiones en el navegador. Exporta respaldos JSON para transferir o recuperar información.
- El informe de cliente utiliza el mismo modelo de cobertura, evaluación y ruta; incluye gráfico vectorial de cobertura, requisitos del siguiente nivel y servicios potenciales. Usa **Vista previa / Guardar como PDF** y el diálogo de impresión del navegador para obtener el documento A4. Las notas privadas solo están disponibles en el informe interno.
- En Inicio, usa **Ver informe de ejemplo (ficticio)** para abrir un reporte completo de muestra; queda guardado localmente y cada página indica que sus datos son simulados.
- No guardes contraseñas ni datos sensibles. Borrar datos del navegador elimina también las sesiones locales.

La metodología de cinco etapas está propuesta y versionada como `1.0.0`; no es una clasificación científica validada ni una promesa de crecimiento. El modelo complementario 0–3 se mantiene únicamente como registro independiente para compatibilidad con diagnósticos existentes.

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` ejecuta pruebas, compila con el `base-href` del repositorio y publica `dist/metamag-discovery/browser`. En GitHub, habilita **Settings → Pages → Build and deployment → GitHub Actions**. El workflow despliega al hacer push a `main` o `master`, y también se puede iniciar manualmente. El enrutamiento hash evita depender de rewrites del servidor estático.

La URL depende del propietario y nombre del repositorio; no se considera publicado hasta que el despliegue de Actions finalice y la URL de Pages responda.

## Arquitectura

- Angular standalone, Reactive Forms, TypeScript estricto y Router con hash.
- `src/app/core/domain.ts`: entidades versionables de sesiones, respuestas, evidencias, dimensiones, servicios y roadmap.
- `src/app/core/form-engine.ts`: preguntas condicionales declaradas por datos.
- `src/app/core/assessment.ts`: cálculo determinista, rango provisional, brechas y controles para nivel manual.
- `src/app/core/growth-model.ts`: metodología versionada, criterios observables, clasificación secuencial y catálogo de servicios guiado por evidencias.
- `src/app/core/services.catalog.ts`: catálogo configurable independiente de la madurez.
- `src/app/core/commercial-model.ts` y `commercial-catalog.ts`: modelo de propuesta versionada, perfiles internos y catálogo de ocho servicios.
- `src/app/core/commercial-calculator.ts`: escenarios de horas, costos, precio objetivo, descuentos, impuestos, rentabilidad y controles previos a aprobación.
- `src/app/core/interview-progress.ts`: ruta esencial, aplicabilidad, cobertura y estados de información.
- `src/app/core/report.ts`: proyección para cliente sin notas privadas.
- IndexedDB nativo, sin backend y sin dependencias de persistencia.

Las definiciones privadas se excluyen del repositorio y del build de GitHub Pages. El asset público de demostración utiliza datos ficticios. El cliente y los antecedentes importados solo se guardan en la sesión local del navegador y en los respaldos JSON que el asesor decida exportar.
