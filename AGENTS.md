# UrbanIA Frontend Instructions

## Identidad institucional

UrbanIA debe respetar la identidad visual de la Municipalidad de San Miguel de Tucuman y tomar como referencia la web de Ciudad Digital: https://ciudaddigital.smt.gob.ar/

### Logo obligatorio

- Incluir siempre el logo de la Municipalidad de San Miguel de Tucuman en el componente de marca principal.
- El asset oficial usado por el proyecto esta en `public/brand/logo-municipalidad-smt.png`.
- El producto puede llamarse UrbanIA, pero visualmente debe quedar claro que pertenece a la Municipalidad SMT.
- No reemplazar el logo municipal por iconos genericos salvo en estados internos o placeholders secundarios.

### Paleta base

Usar esta paleta como base del sistema visual:

- Azul institucional: `#1f89f6`.
- Azul intenso auxiliar: `#0066ff`.
- Celeste municipal: `#35aeea`.
- Amarillo del isotipo: `#f6d500`.
- Verde acento Ciudad Digital: `#81fc87`.
- Fondo dark institucional: `#06121f`.
- Panel dark: `#0d1b2a`.
- Linea/borde: `#1f3550`.
- Texto principal: `#eef7ff`.

El azul debe ser el color primario. El verde queda como acento puntual para estados positivos, aprobaciones o indicadores, no como color dominante.

## Criterio frontend

Actuar como frontend developer senior para una plataforma GovTech real. UrbanIA debe sentirse como un sistema administrativo moderno para gabinete municipal, no como una landing generica ni como un mockup decorativo.

Priorizar:

- Interfaces responsive y operativas.
- Jerarquia clara para funcionarios y equipos tecnicos.
- Componentes reutilizables: `Brand`, `AppShell`, `PageHeader`, `FilterBar`, `StatusBadge`, `MetricCard`, `ActionPanel`, `EmptyState`.
- Filtros con etiquetas visibles.
- Cards con accion primaria clara.
- Estados hover y microinteracciones suaves.
- Textos concretos: gabinete, areas tecnicas, normativa, escenarios, trazabilidad, Cidituc como fuente ciudadana externa.

Evitar:

- Paletas dominadas por verde/teal.
- Iconos genericos sustituyendo identidad municipal.
- Componentes gigantes sin separacion de responsabilidades.
- Secciones que parezcan desconectadas entre si.
- Texto decorativo que no ayude a operar la plataforma.

## Organizacion funcional

Mantener separadas estas areas conceptuales:

- Gabinete: reuniones, decisiones, acuerdos y resumen ejecutivo.
- Propuestas: cartera oficial de iniciativas surgidas de gabinete, areas tecnicas, Concejo, audiencias o insumos externos.
- Participacion: insumos ciudadanos y futura conexion con Cidituc.
- Escenarios: simulacion conceptual y comparacion de alternativas.
- Asistente IA: apoyo transversal para normativa, resumen, trazabilidad y preparacion de informes.