-- Extensión para normalizar tildes en la búsqueda full-text del RAG
-- (el usuario escribe "automoviles", el texto dice "Automóviles").
CREATE EXTENSION IF NOT EXISTS unaccent;
