# Auditoría de salida al público

Estado al **2026-08-19**. Verificado contra el código de ese día y contra
producción (`urbania.smt.gob.ar`), no de memoria.

**Veredicto: todavía no.** Nada roto de fondo; falta la capa que convierte un
sistema que funciona en un servicio público — lo legal, lo accesible y lo que
pasa cuando algo sale mal. Días de trabajo, no meses.

Marcar con `[x]` a medida que se resuelvan.

## Bloqueantes — antes de comunicar nada

- [ ] **1. No hay política de privacidad ni términos de uso.** UrbanIA guarda
  nombre, DNI y correo de cada vecino que participa y no hay ninguna pantalla que
  diga quién es el responsable, para qué se usan ni cómo se ejercen los derechos
  de acceso y supresión. Ley 25.326. No existe en el código.
  *Necesita una definición del municipio: responsable, finalidad y plazo de
  conservación. La pantalla se puede dejar armada esperando el texto.*

- [ ] **2. Cargar `AUTH_SECRET` en Vercel.** En `lib/auth/session.ts:67` el
  secreto que firma las sesiones cae a `OPENROUTER_API_KEY` y después al literal
  `"urbania-local-dev-secret"`.

  Al 2026-08-21 se planteó que probablemente no esté seteada. Los dos escenarios,
  y por qué en los dos hay que ponerla:

  - **Si `OPENROUTER_API_KEY` sí está** (tiene que estarlo: Migue responde en
    producción), entonces las sesiones se firman con la clave de la API de IA. No
    es forjable por quien lea el repositorio, pero: rotar esa clave desloguea a
    todos sin que nadie relacione una cosa con la otra, y el secreto de sesión
    pasa a ser un valor que además viaja como bearer token a un tercero.
  - **Si tampoco está**, el secreto es la cadena que está escrita en el
    repositorio y cualquiera que la lea puede fabricarse una sesión de
    administrador.

  No se puede distinguir desde afuera: con firma inválida o con usuario
  inexistente la aplicación responde igual, así que probarlo requeriría forjar una
  sesión de administrador real contra producción. Hay que mirarlo en el panel.

  El arreglo es el mismo en los dos casos y son dos minutos: definir `AUTH_SECRET`
  con un valor aleatorio. **Efecto:** al cambiar el secreto se invalidan las
  sesiones abiertas y todos vuelven a ingresar una vez.

  Relacionado: el token no lleva vencimiento (la cookie caduca a las 8 h, el token
  firmado vale para siempre si se filtra).

- [ ] **3. Las audiencias se publican solas.** `lib/hearings/public-data.ts:44`
  lista todo lo que tenga `kind: "PUBLIC_HEARING"`, sin filtro de publicación. Lo
  que el equipo crea aparece al instante en el sitio público.

  **Re-verificado el 2026-08-21, porque se planteó que solo se publican al
  publicar el resumen. No es así.** `components/public/public-hearings.tsx` filtra
  únicamente por `status` (próximas contra pasadas); `summaryUrl` se usa en la
  línea 134 y solo decide si aparece el enlace al PDF DENTRO de una audiencia que
  ya está listada. Publicar el resumen agrega el PDF, no la audiencia.

  Estado ese día: 9 audiencias visibles, 8 con resumen publicado, y "x Audiencia
  CPU" listada públicamente SIN resumen.

- [x] ~~**4. El portal público no tiene foco visible.**~~ **DESCARTADO el
  2026-08-21: la afirmación era falsa.** Se había deducido de que no hubiera
  clases `focus-visible:`, que es el test equivocado. Midiendo el elemento
  enfocado de verdad al tabular: 8/8 en la portada, 8/8 en la ayuda y 6/7 en la
  pantalla de ingreso muestran el anillo del navegador (`outline: auto 1px`),
  porque no hay ningún `outline: none` global que lo suprima. Cumple el criterio
  2.4.7 de WCAG 2.1 AA, que solo exige que el foco SEA visible.
  Queda como mejora, no como bloqueante: el anillo es el del navegador y no uno
  diseñado, fino sobre el tema oscuro, y hay un elemento en /ingresar que no lo
  muestra. Un indicador propio también cumpliría 2.4.11 (Focus Appearance).

- [x] ~~**5. El 404 está en inglés.**~~ **DECISIÓN DEL USUARIO 2026-08-21: se
  deja como está.** Queda anotado lo que no es cuestión de idioma: la pantalla de
  Next no tiene encabezado ni enlace de vuelta al portal, así que es un callejón
  sin salida. Si algún día molesta, es un `app/not-found.tsx` de veinte líneas.

## Importantes — primera semana

- [ ] **6. Sin etiquetas Open Graph.** Al compartir el link no aparece tarjeta:
  ni imagen ni título. Es lo más barato de arreglar y lo que más se nota en una
  campaña de comunicación.

- [ ] **7. Faltan cabeceras de seguridad.** En producción solo viaja
  `Strict-Transport-Security`, que la agrega Vercel. Falta CSP,
  `X-Frame-Options`, `X-Content-Type-Options` y `Referrer-Policy`.

- [ ] **8. El limitador de Migue es por instancia.** 10 consultas por minuto por
  IP, en memoria: en serverless cada instancia lleva su contador, así que el
  límite real se multiplica, y rotar IP lo esquiva. Cada consulta cuesta dinero.
  Migrar a Redis si se espera volumen.

- [ ] **9. El aporte ciudadano no tiene limitador** y hace dos llamadas de IA por
  envío (moderación de intención + clasificación de eje).

- [ ] **10. Nada se registra cuando algo falla.** 103 `console.error` que en
  producción se pierden, sin Sentry ni monitoreo, y `/api/health` se eliminó el
  13/08. Una caída de fin de semana se descubre cuando alguien avisa.

- [ ] **11. Borrar una audiencia no borra lo que Migue aprendió de ella.** Al
  19/08 había 4 fuentes huérfanas con 5 fragmentos vivos, de audiencias ya
  eliminadas (entre ellas "dasd" y "eeejejeje"). Migue puede citarlas.

- [ ] **12. Cero tests y cero CI.** Con la matriz de permisos editable desde una
  pantalla, no hay red que avise si un cambio abre un acceso.

## Menores

- [ ] Sin `robots.txt` ni sitemap.
- [ ] Sigue la cabecera de depuración `x-debug-retrieval` en
  `lib/ai/api/assistant-query.ts:299`.
- [ ] La descripción del sitio va sin acentos ("publicas", "analisis").
- [ ] No hay enlace de "saltar al contenido".

## Lo que sí está sólido

No hay que revisarlo de nuevo:

- El acceso pasa por Ciudadano Digital; no hay login propio que mantener.
- Los permisos se resuelven contra la base en cada request, no contra una copia.
- **Las pantallas públicas no exponen ningún dato personal** (verificado).
- Los aportes pasan por moderación léxica y por IA antes de guardarse.
- El conocimiento de Migue está completo: 2.588 fragmentos, ninguno sin vector.
