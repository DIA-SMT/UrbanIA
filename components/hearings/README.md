# Audiencias públicas

Registro y análisis de audiencias sobre el código nuevo (Fábrica de Normas).
Tres formas de crear una audiencia, todas terminan con el mismo macheo contra
las mininormas y el mismo detalle de consulta:

- **En vivo** (`/audiencias/nueva`): dictado con la Web Speech API del navegador,
  macheo en tiempo real. No necesita binarios.
- **Cargar** (`/audiencias/cargar`): audiencia ya ocurrida, macheo en lote.
  - Subir transcripción TXT/VTT/SRT → **sincrónico, sin binarios** (camino confiable).
  - YouTube o audio/video → transcripción con Whisper en **background**.

## Dependencias del entorno del job (no del build de Next)

El macheo de una transcripción subida corre en la request y no necesita nada
extra. La transcripción de **YouTube / audio** sí depende de binarios del
sistema, que son dependencias del **entorno donde corre el job**, no del build:

- **ffmpeg**: viene con `ffmpeg-static` (npm), no requiere instalación aparte.
- **yt-dlp**: se auto-descarga a `node_modules/.cache/urbania/` la primera vez,
  o fijá uno propio con `YTDLP_PATH`. (Requiere salida a internet.)
- **Whisper**:
  - Por defecto usa la **OPENROUTER_API_KEY** del proyecto (`openai/whisper-1`
    vía OpenRouter). Modelo configurable con `OPENROUTER_TRANSCRIPTION_MODEL`.
  - Alternativa local: `HEARING_WHISPER_PROVIDER=local` + `WHISPER_LOCAL_BIN`
    apuntando a un binario tipo `whisper.cpp` que emita `.srt` (opcional
    `WHISPER_LOCAL_MODEL`). No depende de una API paga.

## Aviso de infraestructura (importante)

Bajar y transcribir un video de 1–3 h **no entra en una función serverless de
Vercel** (límite de tiempo + binarios). Por eso:

- La ruta `POST /api/hearings/ingest` crea la audiencia en `hearingStatus:
  PROCESSING` y, para YouTube/audio, dispara el job **fire-and-forget en el
  mismo proceso**. Eso funciona en un servidor de larga vida (el `prod-server`
  del repo), pero en serverless el proceso se congela tras responder.
- El camino confiable en cualquier deploy es el **worker**:

  ```bash
  npm run hearings:ingest            # procesa la cola completa
  npm run hearings:ingest -- --probe <url>   # verifica yt-dlp + ffmpeg + Whisper
  ```

  Corrélo en el `prod-server` (idealmente en un timer/cron). Toma las audiencias
  encoladas (`status PENDING/ERROR` con `metadata.ingest`) y las procesa.
- La UI de `/audiencias/cargar` **pollea** `GET /api/hearings/[id]` hasta
  `COMPLETED`. Mientras tanto, la audiencia figura como "Procesando" en el board.

Si el entorno no tiene yt-dlp/Whisper, **subir transcripción** sigue funcionando
de forma sincrónica: es el fallback confiable.
