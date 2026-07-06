# UrbanIA

UrbanIA es el MVP inicial de una plataforma GovTech para evolucionar hacia un Gemelo Digital Urbano de San Miguel de Tucuman.

## Objetivo

Centralizar normativa, mapas urbanos, casos de exito, ciudades comparables y un asistente IA con fuentes verificables para apoyar decisiones publicas.

## Stack inicial

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL + PostGIS
- Prisma
- OpenRouter para IA compatible con modelos tipo OpenAI

## Primeros comandos

```bash
npm install
npm run dev
```

## Variables IA

Para activar respuestas reales del asistente:

```bash
OPENROUTER_API_KEY=""
OPENROUTER_MODEL="openai/gpt-4o-mini"
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_APP_NAME="UrbanIA"
```

## Modulos MVP

- Landing GovTech
- Dashboard Smart City
- Mapa interactivo conceptual
- Normativa urbana
- Casos de exito
- Ciudades comparables
- Propuestas urbanas
- Asistente IA
- Registro de gabinete preparado en modelo de datos
