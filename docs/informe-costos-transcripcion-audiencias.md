# Informe de gastos: transcripción de audiencias públicas

**Fecha:** 2026-07-17
**Estado:** para evaluación. No implementado.

Todos los números de este informe son **medidos**, no estimados, salvo donde se indica lo contrario. Salen de procesar una audiencia real completa: *Ciclo de audiencias públicas para la reforma del Código de Planeamiento Urbano*, 27-05-26, del canal del Concejo Deliberante de SMT (`youtube.com/watch?v=zqs3mDLCFms`), de 67:52 de duración.

---

## 1. Costo unitario medido

| Concepto | Costo | Detalle |
|---|---|---|
| Pasada 1: audio → texto con hablantes | $0,1422 | 14 tramos de 5 min, `google/gemini-3-flash-preview`, 14/14 sin error |
| Pasada 2: atribución de nombres | $0,0875 | 1 llamada, `google/gemini-3.1-pro-preview`, 13.496 tokens de **texto** |
| **Total por audiencia de 68 min** | **$0,2297** | ~2 minutos de reloj |

**Costo por minuto de audiencia: $0,0034. Por hora: $0,203.**

El costo escala con la **duración del audio**, no con el tamaño del archivo ni la calidad del video. El video nunca se envía: se descarta al extraer la pista de audio.

### Comparación con las alternativas evaluadas

| Enfoque | Costo 68 min | Resultado |
|---|---|---|
| **Dos pasadas (recomendado)** | **$0,23** | Funciona. 5 personas identificadas con cita probatoria |
| Pro, una sola llamada | $0,99 | **Falla.** Transcribe 5 min y degenera en basura |
| Pro por tramos | ~$0,95 | Funcionaría, 4x más caro, sin propagación de nombres entre tramos |
| AssemblyAI / Deepgram | ~$0,40–1,10 + clave nueva | Innecesario. La clave de OpenRouter existente alcanza |

---

## 2. Proyección operativa

Supuesto: audiencias de ~70 min promedio, una corrida por audiencia.

| Escenario | Audiencias | Costo |
|---|---|---|
| Lo que resta del ciclo CPU (supuesto: 12) | 12 | ~$2,80 |
| Un año, una audiencia por semana | 52 | ~$12 |
| Un año, dos por semana | 104 | ~$24 |

**El costo de API no es una restricción del proyecto.** Menos de 25 dólares al año en el escenario más intenso.

---

## 3. Costos que no aparecen en la tabla

Estos son los que conviene mirar, porque el costo por corrida no es el problema.

### Recorridas repetidas
Cada clic vuelve a gastar. Si alguien reanaliza tres veces, son tres veces $0,23. **Recomendación:** guardar la transcripción apenas se genera y que "reanalizar" reuse el texto en vez de volver a transcribir el audio. La pasada 2 sobre texto cuesta $0,09; rehacer todo cuesta $0,23.

### Reintentos por fallas de descarga
Durante la prueba, `yt-dlp` devolvió **HTTP 403** al elegir el formato webm automáticamente. Se resolvió fijando el formato m4a (`-f 140`). Si no se fija, las fallas son intermitentes y cada reintento cuesta.

### Almacenamiento de audio
Una audiencia son 14,5 MB a 16 kHz mono (62 MB en el original m4a). Cincuenta audiencias con audio guardado son ~725 MB, cerca del límite del plan gratuito de Supabase Storage.

**Recomendación: no guardar el audio.** El video ya está publicado en el canal del Concejo. Los timestamps pueden enlazar directo a YouTube (`&t=NNNs`), que da hosting gratis y verificación pública. Se guarda el link, no el archivo.

### Crédito de OpenRouter
Durante esta evaluación el crédito quedó bajo y una llamada falló con **HTTP 402**. Conviene un alerta de saldo antes de poner esto en manos de varias personas.

---

## 4. Bloqueante técnico detectado

**La transcripción de esta audiencia ocupa 58.568 caracteres. `analyze-transcript` acepta un máximo de 60.000** (`app/api/hearings/analyze-transcript/route.ts:6`).

Pasó por 1.432 caracteres, un 2,4% de margen.

A 840 caracteres por minuto de audiencia, **el límite se supera a partir de los ~71 minutos**. Una audiencia de 3 horas generaría ~151.000 caracteres: dos veces y media el máximo.

Esto no es un costo, es un tope. Hay que resolverlo antes de que esto sea útil para audiencias reales, que rara vez duran menos de una hora. Opciones: subir el límite, resumir por tramos antes de analizar, o alimentar a Migue con la transcripción ya estructurada en vez del texto plano.

---

## 5. Lo que este informe NO cubre

- **Horas de desarrollo.** No las estimo: no conozco la disponibilidad del equipo.
- **Infraestructura del worker.** La transcripción tarda ~2 minutos y `yt-dlp` es un binario de Python: no entra en un API route. Necesita un proceso en background con cola. `MeetingMedia` ya tiene los estados (`PENDING → PROCESSING → READY → ERROR`) previstos para eso.
- **Docker.** `yt-dlp` y `ffmpeg` tienen que sumarse a la imagen o la función anda en desarrollo y falla en el servidor.
- **La base de datos.** Sin `Meeting` + `HearingRecord` aplicados, la transcripción no tiene dónde guardarse. La migración está escrita y sin aplicar, esperando a que Lucas commitee su Fábrica de Normas.

---

## 6. Riesgos de calidad, no de plata

Dos hallazgos de la evaluación que importan más que el costo:

**El fallo de la llamada única es silencioso.** Arranca con formato correcto y nombres bien atados, y degenera 160.000 caracteres después en sílabas sueltas con caracteres árabes. Quien mire la primera pantalla diría que funcionó. Cualquier pipeline debe **validar la salida**: que el último timestamp se acerque a la duración real y que exista la sección de participantes.

**Abaratar bajando el razonamiento hace que el modelo invente.** Con `reasoning: {effort: "low"}`, Pro escribió **"Lobo Chacrián"** en vez de "Chaklián". No falló avisando: falló produciendo un apellido plausible y equivocado. En un acta de audiencia pública eso es peor que un "Hablante 2" honesto. El razonamiento **es** la atribución de nombres: recortarlo elimina la función, no el gasto.

---

## 7. Conclusión

El costo de API es despreciable: **$0,23 por audiencia, menos de $25 al año** en el escenario más intenso. La decisión de implementar esto no debería tomarse por plata.

Lo que sí hay que resolver antes: el tope de 60.000 caracteres, el worker en background, y `yt-dlp`/`ffmpeg` en el deploy.

Ver también: `docs/` no existía antes de este informe; los scripts de la evaluación quedaron en el scratchpad de la sesión y no en el repo.
