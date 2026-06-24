# API REST inicial

## Normativa

- GET /api/regulations
- POST /api/regulations
- GET /api/regulations/:id
- POST /api/regulations/:id/process
- GET /api/regulations/search?q=

## Asistente IA

- POST /api/assistant/query
- POST /api/assistant/generate-impact-brief

## Propuestas

- GET /api/proposals
- POST /api/proposals
- GET /api/proposals/:id
- POST /api/proposals/:id/comments
- POST /api/proposals/:id/vote

## GIS

- GET /api/map/layers
- GET /api/map/features?layer=

## Gabinete

- GET /api/cabinet-meetings
- POST /api/cabinet-meetings
- POST /api/cabinet-ideas/:id/convert-to-proposal
