# Integración con Cidituc

Cidituc (Ciudadano Digital, Municipalidad de San Miguel de Tucumán) es la **única**
puerta de acceso a UrbanIA. El login por contraseña se eliminó y el seed no crea
usuarios: si Cidituc falla, no hay entrada alternativa.

Este documento reemplaza a la pantalla *Configuración > Cidituc*, que era de solo
lectura y se eliminó del panel.

## Las tres piezas

| Pieza | Dónde vive |
|---|---|
| Derivador (la pantalla de login) | `cidituc.smt.gob.ar` — lo sirve el repo `derivador` |
| Backend de Cidituc | `https://estadisticas.smt.gob.ar:5000` |
| UrbanIA | este repo: botón de ingreso + callback |

Los nombres de los repos están cruzados: el repo llamado `cidituc` sirve
`ciudaddigital.smt.gob.ar`, que **no** es a donde se manda a la gente. Tocar el repo
equivocado despliega en un dominio al que nadie llega.

## Flujo de acceso

1. **La identidad nace en Cidituc.** Toda persona se autentica primero en el sistema de
   identidad municipal. UrbanIA nunca recibe su contraseña.
2. **UrbanIA valida el token.** Llega por `?auth=<token>` al callback. Se verifica la
   firma localmente y se consulta `GET {CIDITUC_API_URL}/usuarios/authStatus` con el
   header `Authorization: <token>` **crudo, sin `Bearer`** (con prefijo da 401 siempre).
3. **La cuenta se crea o se vincula.** En el primer ingreso se crea automáticamente una
   cuenta con rol `CITIZEN`; si ya existe por DNI o correo, se vincula sin duplicarla.
4. **UrbanIA conserva los permisos.** Cidituc dice *quién es* cada persona; UrbanIA
   decide *qué puede hacer*. Roles, permisos, suspensiones y auditoría no salen de acá.

Un usuario nuevo entra pero queda en `/`: el rol `CITIZEN` no tiene ningún permiso y
`/admin` le devuelve 307. Promover el rol se hace desde Configuración > Usuarios.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `CIDITUC_ENABLED` | habilita la integración (`"true"`) |
| `CIDITUC_DERIVADOR_URL` | derivador al que apunta el botón de ingreso |
| `CIDITUC_API_URL` | API contra la que se valida el token |
| `CIDITUC_CALLBACK_URL` | URL de retorno |
| `CIDITUC_CA_PEM` | override del intermedio de la cadena TLS (ver abajo) |

En un `.env`, la URL del derivador va **entre comillas**: lleva un `#` (HashRouter) y sin
comillas abre un comentario que se come el resto de la línea.

## Prueba de conexión a mano

Esto es lo que hacía el diagnóstico de la pantalla eliminada. Se le manda al backend un
token inválido a propósito: si todo está bien, tiene que rechazarlo con **401**. Ese 401
*es* la validación funcionando.

```bash
curl -i -H "Authorization: token-invalido-de-prueba" https://estadisticas.smt.gob.ar:5000/usuarios/authStatus
```

Cómo leer la respuesta:

- **401 o 403** → todo bien: la URL es correcta, hay conexión y el backend valida.
- **404** → el servidor responde pero ahí no está el endpoint: `CIDITUC_API_URL` apunta a
  un host que no sirve la API de Cidituc.
- **Sin respuesta** → firewall que no deja salir hacia ese host o puerto desde donde corre
  la app, o el servidor apagado.
- **Otro código** → el backend tiene un problema propio.

Contra la propia app, sin necesidad de una persona real: pedir el `state` en
`/api/auth?action=cidituc-start`, mandarlo al callback con un token basura y mirar el
código de error del redirect. Distingue "no llegué al backend" de "el backend contestó".

## La trampa del certificado

El backend manda **un solo certificado** (la hoja `*.smt.gob.ar`), sin el intermedio
"Sectigo Public Server Authentication CA DV R36". Windows completa la cadena con su store,
así que **desde una máquina de desarrollo todo da verde**; el runtime Linux de Vercel solo
tiene raíces de Mozilla y el handshake muere con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Probar desde la laptop no prueba nada, y `curl -k` lo tapa por completo. Para
reproducirlo: `tls.connect({ host, port, ca: tls.rootCertificates })` — si eso falla y un
fetch normal anda, es este caso. O contar bloques con `openssl s_client -showcerts`
(uno solo = cadena incompleta).

Está resuelto en `lib/auth/identity/cidituc-https.ts`, que aporta el intermedio como CA
(`ca: [...tls.rootCertificates, intermedio]`). **Nunca** `rejectUnauthorized: false` ni
`NODE_TLS_REJECT_UNAUTHORIZED=0`: el token viajaría a un servidor sin verificar.

## Dónde está el código

| Qué | Archivo |
|---|---|
| Transporte HTTPS con la CA | `lib/auth/identity/cidituc-https.ts` |
| Validación del token y parseo de la persona | `lib/auth/identity/cidituc.ts` |
| Verificación local de la firma | `lib/auth/identity/cidituc-jwt.ts` |
| Flujo start/callback con `state` en cookie | `lib/auth/api/cidituc.ts` |
| Estado de configuración (lo usa Solicitudes) | `ciditucIntegrationStatus()` |

## Detalles que ya costaron horas

- **Cada endpoint envuelve distinto.** `/usuarios/authStatus` (ciudadanos) devuelve
  `{ usuarioSinContraseña: {...} }`; `/usuarios/authStatusIA` (empleados municipales, le
  da 401 a cualquier vecino) devuelve `{ user: {...} }`. Se aceptan las dos y la plana.
- **Los tipos llegan de MySQL crudo.** El backend hace `SELECT p.*`: los campos vienen
  como **número** si la columna es numérica y como **null** si está vacía. Exigir `string`
  descarta personas válidas en silencio.
- **El registro en el derivador necesita el respaldo hardcodeado.** Vite hornea las
  variables `VITE_*` al compilar y el `.env.production` no las tiene, así que el bundle
  sale con `callbackUrl: void 0` y vive del mapa `RESPALDO_CALLBACK`. Después de mergear
  en el derivador, verificar el bundle real:
  `curl -s https://cidituc.smt.gob.ar/ | grep -oE '/assets/index-[^"]+\.js'` y buscar el
  dominio adentro.
- **No pedir la clave de firma.** Es HS256: tenerla permite fabricar tokens válidos para
  cualquier persona de cualquier app. La consulta a `authStatus` ya *es* la validación.
