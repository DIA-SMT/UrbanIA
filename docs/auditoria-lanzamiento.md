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

- [ ] **2. Verificar que `AUTH_SECRET` esté cargado en Vercel.** En
  `lib/auth/session.ts:67` el secreto de firma cae a `OPENROUTER_API_KEY` y
  después al literal `"urbania-local-dev-secret"`. Si no está seteado, cualquiera
  que lea el repositorio puede fabricarse una sesión de administrador. **No se
  puede verificar desde el código: hay que mirarlo en el panel de Vercel.**
  Relacionado: el token no lleva vencimiento (la cookie caduca a las 8 h, el
  token firmado vale para siempre si se filtra).

- [ ] **3. Las audiencias se publican solas.** `lib/hearings/public-data.ts:44`
  lista todo lo que tenga `kind: "PUBLIC_HEARING"`, sin filtro de publicación. Lo
  que el equipo crea aparece al instante en el sitio público. Al 19/08 estaba
  listada "x Audiencia CPU", una prueba.

- [ ] **4. El portal público no tiene foco visible.** `:focus-visible` existe
  solo en la matriz de permisos del admin. Quien navega con teclado no ve dónde
  está. WCAG 2.1 AA, criterio 2.4.7.

- [ ] **5. El 404 está en inglés.** No hay `app/not-found.tsx`; Next sirve
  "404: This page could not be found." Verificado en producción.

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
