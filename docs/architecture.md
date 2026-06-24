# Arquitectura UrbanIA

UrbanIA arranca como un monolito modular en Next.js para reducir complejidad operativa y acelerar el MVP.

## Capas

1. UI GovTech y dashboard Smart City.
2. API interna Next.js.
3. Servicios de dominio: normativa, mapas, propuestas, gabinete, ciudades y casos.
4. PostgreSQL + PostGIS.
5. RAG con embeddings para normativa y documentos.

## Decision clave

Las simulaciones urbanas reales quedan fuera del MVP. Primero se construyen datos confiables, trazabilidad y consultas IA con fuentes.
