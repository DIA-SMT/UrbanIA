# Permisos (RBAC)

Los chequeos del servidor consultan **permisos**, nunca roles. Un rol es un
conjunto de permisos, y ese conjunto lo editan los administradores desde
`/admin/configuracion/permisos`.

## Dónde vive cada cosa

| Qué | Dónde | Quién lo cambia |
|---|---|---|
| Qué permisos **existen** | `PERMISSION_CATALOG` en `lib/auth/permissions.ts` | un deploy |
| Qué rol **tiene** cada permiso | tabla `RolePermission` | un administrador, desde la UI |
| Qué rol tiene cada **persona** | columna `User.role` | un administrador, desde Usuarios |

El catálogo no vive en la base a propósito: `label`, `description` y `module` son
texto de interfaz, y llevarlos a la base obligaría a una migración por cada
retoque de copy y crearía una segunda fuente de verdad contra el tipo
`Permission` de TypeScript, que es lo que tipa los guards. Por eso tampoco hay
FK sobre `RolePermission.permission`: una fila con una clave que ya no está en el
catálogo se ignora al resolver, no rompe.

## Cómo se resuelven en runtime

`getSessionUser()` (`lib/auth/api.ts`) lee la cookie, resuelve los permisos del
rol desde la base **una sola vez por request** (envuelto en `cache()` de React) y
devuelve un `SessionUser` que ya trae su `Set` de permisos. Por eso los helpers
siguen siendo síncronos:

```ts
const session = await getSessionUser();
if (!session || !hasPermission(session, "hearings.edit")) return 403;
```

Reciben la **sesión**, no el rol. Un helper que recibiera el rol tendría que
consultar la base en cada llamada, y hay más de 70 en el repo.

## El middleware no chequea permisos

`middleware.ts` solo verifica que **exista una sesión válida**. No puede hacer
más: corre en el runtime Edge, donde Prisma no existe.

Una copia de la matriz en Edge sería una autoridad sombra que se desincroniza de
lo que muestra la pantalla de permisos, y falla **abierta** (dejaría pasar a un
rol al que le acaban de revocar el acceso). El permiso lo exige cada página y
cada ruta con su propio guard.

> Antes de este cambio, cuatro rutas dependían **solo** del middleware —`/admin`,
> `/consulta-cpu`, `/api/cpu` y `/admin/configuracion`— pese a que el propio
> archivo declaraba ser "la primera barrera, no la única". Hoy todas tienen guard
> propio. Si agregás una ruta bajo el matcher, **escribile su guard**: el
> middleware no te cubre.

## Si la tabla queda vacía, el sistema falla cerrado

Sin filas, nadie tiene permisos. No hay fallback al mapa hardcodeado, y es
deliberado:

- Un fallback disparado por conteo de filas tiene un acantilado en 1. Un dump
  restaurado a medias o un `DELETE` mal escrito dejan la tabla **parcial**, no
  vacía: el fallback no se activaría y el sistema quedaría casi cerrado igual.
- Peor: si un administrador revoca todo a propósito, el fallback convertiría esa
  decisión en "restaurar valores de fábrica". La pantalla mostraría cero permisos
  mientras el servidor se comporta como si estuvieran todos. Ese desacople entre
  lo que la UI dice y lo que el servidor hace es la peor falla posible en un
  módulo de permisos.

**Recuperación:** pegar
`prisma/migrations/20260813120000_permisos_por_rol/migration.sql` en el editor
SQL de Supabase. Ese archivo es también el script de recuperación: repuebla la
matriz si está vacía y no hace nada si ya está cargada (`WHERE NOT EXISTS`).

Tres situaciones que el código distingue y **no** hay que colapsar:

| Situación | Respuesta |
|---|---|
| La consulta devuelve filas | permisos del rol (cero para `CITIZEN`, y es legítimo) |
| La tabla está vacía | cero permisos + `console.error` con `[RBAC]` |
| La consulta **tira excepción** | se propaga → 500. **Nunca** `catch` que devuelva `[]` |

La última es la que más fácil se rompe: un `catch` "para que no explote"
convierte cualquier hipo de la base en una denegación masiva silenciosa,
indistinguible de un cambio deliberado de permisos.

## La única casilla que el sistema se niega a guardar

Todos los permisos son editables, con una excepción validada en el servidor
(`lib/settings/api/role-permissions.ts`): **no se puede guardar un cambio que
deje sin ninguna cuenta activa cuyo rol tenga `roles.manage`**. Después de ese
guardado nadie podría volver a abrir la pantalla de permisos: es una cerradura
que se traga la llave, y solo se sale tocando la base a mano.

Se chequea contra **usuarios reales**, no contra la configuración de roles, por
la misma razón que `user-actions.ts` cuenta administradores activos: lo que
importa es que exista alguien que efectivamente pueda entrar a arreglarlo.

## `internal.view` no da acceso a datos personales

Es una invariante deliberada, no una casualidad. `internal.view` habilita mapas,
normas, audiencias y documentos: exactamente lo que promete su etiqueta.

La bandeja de aportes ciudadanos —que muestra nombre, DNI, email y texto de cada
vecino— exige **`proposals.manage`**, tanto para leerla como para editarla, pese a
vivir dentro del sistema interno.

El motivo es que la matriz es editable. Conceder `internal.view` al rol Ciudadano
es un escenario contemplado (que los vecinos puedan mirar el mapa y las normas
desde adentro), y ese día esa casilla no puede significar además "leer los datos
personales de todos los que presentaron algo". Una casilla que hace más de lo que
dice es exactamente lo que este módulo vino a eliminar.

Consecuencia asumida: el rol Consulta no ve la bandeja. Su descripción habla de
proyectos, reuniones, documentos y mapas, no de aportes ciudadanos.

Si agregás una pantalla que muestre datos personales, colgala de un permiso
propio y no de `internal.view`. En el menú lateral eso se declara con el campo
`permission` de `SidebarSection` (`lib/data.ts`), que manda sobre los flags
`adminOnly` / `internalOnly` y es lo único que no se desincroniza del guard del
servidor.

## Agregar un permiso nuevo

1. Sumalo a `PERMISSION_CATALOG`.
2. Aparece solo en la matriz, **sin asignar a ningún rol**. Ese es el default
   correcto: agregar claves al catálogo nunca amplía privilegios, así que un
   merge distraído no puede conceder nada.
3. Concedelo desde la pantalla, o con un `INSERT` en la misma migración.

**El footgun:** si en el mismo deploy agregás la clave *y* ponés
`hasPermission(session, "la.clave")` delante de una función que ya existía, esa
función deja de funcionar para todos el día del deploy. La disciplina es sembrar
las concesiones **antes** de que el código las exija, o estrenar el permiso junto
con una funcionalidad que nadie tenía.

## Agregar un rol nuevo

`ALTER TYPE "UserRole" ADD VALUE` y el `INSERT` de sus permisos **no pueden ir en
la misma transacción**: Postgres no deja usar un valor de enum recién agregado
dentro de la transacción que lo agregó. El editor SQL de Supabase ejecuta el
script como un bloque, así que van en **dos migraciones**.

El rol nace con cero permisos y sin poder entrar al sistema interno. Es un camino
probado: `CITIZEN` ya es un rol con cero permisos desde el día uno.

## Deuda conocida

- **Banderas de UI por pantalla.** Algunas pantallas usan una sola bandera
  (`canEdit`) para habilitar botones que pegan contra handlers con permisos
  distintos. El servidor siempre valida bien, pero el usuario puede ver un botón
  que le va a devolver 403. Detalle en la sección de abajo.
- **`MigueRole`** (`lib/ai/assistant-access.ts`) sigue mirando `role === "ADMIN"`
  a propósito: no abre ni cierra datos —eso lo decide `mode`—, solo ajusta el
  registro de las respuestas del asistente.
- **El recorrido guiado** (`components/help/internal-tour-content.ts`) decide con
  `role === "ADMIN"` qué pasos mostrar. Es cosmético, pero quedó desalineado con
  el menú lateral, que ahora filtra por `users.manage`.

### Pantallas con banderas por partir

| Pantalla | Estado | Pendiente |
|---|---|---|
| `app/audiencias/[id]/page.tsx` | ✅ partida en `canEdit`, `canDelete`, `canRunAi`, `canPublish`, `canUploadDocs`, `canDeleteDocs` | — |
| `app/normas/[reformId]/page.tsx` | ⬜ una sola bandera `canEdit` = `norms.edit` | `documents.upload` (link Importar PDF), `norms.create` (link Nueva norma), `projects.edit` (apoyo/objeción), `documents.delete` (borrar antecedente) |
| `app/normas/[reformId]/[normId]/page.tsx` | ⬜ `canEdit` = `projects.edit` | `norms.edit` para los anclajes al código vigente |

La de audiencias se partió primero porque escondía `ai.execute` y
`content.publish` —los dos permisos que un administrador va a querer apagar
antes que ningún otro— detrás de "editar audiencias".

En las dos pantallas de `/normas` que quedan, el riesgo es de UX y no de
seguridad: el servidor rechaza igual, pero el usuario ve un botón que le va a
devolver 403, y en dos casos el error se traga en silencio
(`norm-editor.tsx:182` descarta la respuesta del autoguardado, y
`support-controls.tsx:55` no tiene rama de error), así que el trabajo se pierde
sin un solo cartel. Conviene resolverlo antes de que alguien separe de verdad
`norms.*` de `projects.*`.
