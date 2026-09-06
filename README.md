# Barbería Elite — Gestión de citas y cursos

Aplicación web completa para una barbería: agenda de citas, escuela de cursos y
paneles diferenciados para **cliente**, **barbero** y **administrador**.

Está construida para poder **revisarse entera sin conectar Firebase**. Arranca en
modo demo con datos realistas y, cuando quieras pasar a producción, cambias una
variable de entorno y se conecta a Firebase sin tocar ni una sola vista.

---

## Stack

| Pieza | Tecnología |
|---|---|
| Build | Vite 5 |
| UI | React 18 (JavaScript puro, **sin TypeScript**) |
| Estilos | Tailwind CSS 3 |
| Rutas | React Router DOM 6 |
| Backend | Firebase (Authentication + Firestore + Storage) |
| Iconos | lucide-react |

---

## Arranque rápido (modo demo)

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>. No hace falta nada más: ni cuenta de Firebase, ni
credenciales, ni conexión a internet para la lógica de la app.

### Cuentas de prueba

Aparecen en un recuadro bajo el formulario de login. Basta con pulsarlas para
entrar directo:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@barberia.com` | `demo123` |
| Barbero | `barbero@barberia.com` | `demo123` |
| Cliente | `cliente@barberia.com` | `demo123` |

Hay dos barberos más (`sofia@barberia.com`, `diego@barberia.com`) y siete
clientes adicionales, todos con la misma contraseña.

> **Modo demo activo**: verás un indicador dorado abajo a la izquierda. Al
> desplegarlo puedes **reiniciar los datos de demostración** y volver al estado
> inicial cuando quieras.

---

## Cómo está organizado

```
src/
├── config/firebase.js       Inicialización perezosa de Firebase
├── constants/               Roles, estados, etiquetas y estilos
├── models/                  Fábricas que definen la forma de cada documento
├── data/seed.js             Datos semilla del modo demo
├── utils/
│   ├── date.js              Fechas y horas como texto (sin líos de zona horaria)
│   ├── format.js            Dinero, teléfonos, iniciales, clases CSS
│   ├── validation.js        Validación de todos los formularios
│   └── schedule.js          Motor de disponibilidad (funciones puras)
├── services/
│   ├── index.js             ← ÚNICA puerta de datos para los componentes
│   ├── statsCore.js         Cálculo de métricas, compartido por ambos modos
│   ├── mock/                Implementación en memoria + localStorage
│   └── firebase/            Implementación real con Firebase
├── context/                 AuthContext, BusinessContext, ToastContext
├── hooks/                   useAsync, useForm, useMediaQuery
├── components/
│   ├── ui/                  Botones, tarjetas, modales, skeletons, estados vacíos
│   ├── layout/              Sidebar, header, layouts públicos y de panel
│   ├── routes/              Rutas protegidas por rol
│   ├── appointments/        Tarjetas de cita
│   ├── courses/             Tarjetas de curso
│   ├── gallery/             Carrusel de fotos de trabajos
│   └── shared/              Cabeceras de página
└── pages/
    ├── public/              Landing, servicios, barberos, cursos, login, registro
    ├── client/              Panel de cliente
    ├── barber/              Panel de barbero
    ├── admin/               Panel de administrador
    └── Profile.jsx          Perfil, compartido por los tres roles
```

### La regla de oro de la arquitectura

**Ningún componente importa Firebase.** Todos los datos pasan por
`src/services/index.js`, que elige la implementación:

```js
// src/services/index.js
export const services = USE_MOCK ? mockServices : firebaseServices
```

Las dos implementaciones (`/services/mock` y `/services/firebase`) exponen
**exactamente las mismas funciones con las mismas firmas**:

```
services.auth          signIn, signUp, signOut, onAuthChanged,
                       getCurrentUser, createAccount, refresh
services.users         list, listBarbers, listClients, get, getMany,
                       update, setActive
services.services      list, get, create, update, setActive, remove
services.barberServices lo que ofrece cada barbero y a qué precio:
                       list, get, listOfferings, getOffering,
                       listBarbersForService, listBookableServices,
                       setCatalogOverride, createCustom, update, remove
services.appointments  list, get, create, update, setStatus, cancel,
                       reschedule, remove, getAvailableSlots,
                       getDaySlots, getAgendaDay
services.blocks        list, create, remove
services.courses       list, get, create, update, setStatus, remove
services.enrollments   list, get, enroll, cancel, setAttendance,
                       setPaymentStatus
services.gallery       list, get, create, update, setActive, remove,
                       reorder
services.business      get, update
services.storage       uploadImage, remove
services.stats         getAdminStats, getBarberStats, getClientStats
```

Por eso pasar de demo a real **no requiere tocar ninguna vista**.

---

## Roles y permisos

### Cliente (rol por defecto)
El registro público **siempre** crea cuentas de cliente. Puede agendar citas,
verlas, cancelarlas y reagendarlas; explorar el catálogo de cursos, inscribirse,
consultar sus próximas sesiones y cancelar antes del inicio; y editar su perfil.

### Barbero (lo crea el administrador)
No existe registro público de barberos. Ve su agenda semanal con citas, bloqueos
y clases juntos; cambia el estado de sus citas; bloquea horarios; crea, edita,
publica y cancela **sus propios** cursos; pasa lista a sus alumnos; **fija sus
propios precios y añade servicios que solo hace él**; y consulta sus estadísticas
personales.

### Administrador
Métricas del negocio, alta y baja de barberos, CRUD de servicios, gestión de
todas las citas y de todos los cursos, directorio de clientes y configuración del
negocio (nombre, logo, horarios, contacto).

El **login es único**: no hay selector de rol. Se lee el campo `role` del perfil
y se redirige a `/cliente`, `/barbero` o `/admin` según corresponda.

---

## Reglas de negocio implementadas

Todas funcionan **igual en modo demo y en modo Firebase**, porque el motor de
validación (`src/utils/schedule.js`) es código puro compartido.

**Disponibilidad de citas**
- Nunca hay doble reserva del mismo barbero.
- No se puede agendar sobre un horario bloqueado por el barbero.
- **Las clases de un curso publicado bloquean la agenda de su instructor.**
- Solo se ofrecen horarios dentro del horario de apertura del negocio.
- No se agenda en fechas pasadas ni en días cerrados.
- Cancelar o reagendar exige al menos 2 horas de antelación.

**Cupo de cursos**
- No se admiten inscripciones por encima de `capacity`.
- Un cliente no puede inscribirse dos veces al mismo curso.
- Cancelar una inscripción libera el lugar y actualiza `enrolledCount`.
- La cancelación solo se permite antes de la fecha de inicio.
- Finalizar un curso marca sus inscripciones como completadas; cancelarlo las
  cancela y marca los pagos para reembolso.
- En Firebase, inscripción y cancelación van dentro de una **transacción**, para
  que dos personas simultáneas no superen el cupo.

---

## Precios por barbero

El catálogo de servicios lo define el **administrador** (nombre, descripción y
precio de referencia de la casa). A partir de ahí, **cada barbero pone lo suyo**
desde **Barbero → Mis servicios**:

| Puede | Cómo |
|---|---|
| Cobrar más o menos que la casa | Editar el precio del servicio |
| Tardar más o menos | Editar su duración (cambia los huecos que ve el cliente) |
| Dejar de ofrecer algo | **No lo hago** |
| Volver a la tarifa de la casa | **Precio de la casa** |
| Añadir un servicio suyo | **Servicio propio**, con su nombre y precio |

Solo el barbero (y el administrador) ven estas tarifas.

**Herencia:** un barbero que no toca nada ofrece todo el catálogo al precio de la
casa, así que un barbero recién creado ya se puede reservar sin configurar nada.

### El cliente no compara precios

Decisión de negocio deliberada: **el cliente nunca ve las tarifas del equipo una
al lado de otra**. Ponerlas juntas empuja a elegir siempre al más barato y presiona
al equipo a bajarse los precios entre sí.

| Dónde | Qué se ve |
|---|---|
| Portada, "Esto es lo que hacemos" | Servicio y duración. **Sin precio** |
| Reserva, paso 1 (servicio) | Duración orientativa y cuántos barberos lo hacen. **Sin precio** |
| Reserva, paso 2 (barbero) | Nombre, especialidades y biografía. **Sin precio**, y sin poder ordenar por precio |
| Reserva, paso 5 (confirmar) | **Aquí sí**: el total, y solo el del barbero elegido |

El precio y la duración que se guardan en la cita son siempre los del barbero
elegido, nunca los del catálogo.

> **Alcance real de la privacidad.** El ocultamiento es de producto, no de
> seguridad: la app corre entera en el navegador, así que las funciones que el
> cliente puede llamar devuelven solo lo justo (`listBarbersForService` y
> `listBookableServices` no incluyen importes, y `getQuote` devuelve un único
> precio ya elegido el barbero). Aun así, con Firestore las reglas no filtran por
> campo: alguien con conocimientos técnicos podría leer la colección directamente.
> Para privacidad estricta haría falta mover la resolución de precios a Cloud
> Functions. Dímelo si quieres que lo montemos.

---

## Galería de fotos (carruseles)

**Todas las fotos del sitio público se cambian desde el panel**, sin tocar código.
Hay **tres galerías independientes**, cada una con sus propias fotos:

| Galería | Dónde sale | Cuántas se ven |
|---|---|---|
| **Portada principal** | Las dos fotos grandes del hero, lo primero que se ve | Exactamente 2 (tope) |
| **Carrusel de inicio** | A mitad de la portada | Todas las visibles |
| **Carrusel de servicios** | La página de Servicios | Todas las visibles |

> Las fotos de perfil de clientes y barberos **no** están aquí: cada persona
> gestiona la suya desde su perfil (y el admin puede cambiar la de un barbero
> desde Admin → Barberos).

Se administran desde **Admin → Galería de fotos**, con una pestaña por zona. **Cada foto se añade a la pestaña en la que estés**, y solo a esa: no hay selector de destino, para que no acaben todas en el mismo sitio.

| Acción | Cómo |
|---|---|
| Añadir una foto | Botón **Subir foto**, eliges la imagen y en qué página se muestra |
| Cambiar el orden | Flechas ← → de cada tarjeta; el carrusel respeta ese orden |
| Quitarla temporalmente | **Ocultar** (sigue guardada, pero no sale en el carrusel) |
| Cambiarla de página | Editar la foto y cambiar el campo **Dónde se muestra** |
| Borrarla | **Eliminar** (definitivo) |

El carrusel avanza solo cada 4,5 s, se pausa al pasar el ratón, se arrastra con
el dedo en móvil y muestra 1, 2 o 3 tarjetas según el ancho de pantalla. Al pulsar
una foto se abre a pantalla completa, con navegación por teclado. Si el sistema
del visitante pide reducir animaciones, el avance automático se desactiva.

> La página de Servicios es **solo** el carrusel: los precios de cada servicio
> siguen visibles en la portada y durante el proceso de reserva.

---

## Pasar de modo demo a Firebase real

### 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> y pulsa **Agregar proyecto**.
2. Ponle nombre (por ejemplo `barberia-elite`) y termina el asistente.
   Google Analytics es opcional.

### 2. Registrar la aplicación web

1. En la pantalla principal del proyecto, pulsa el icono **`</>`** (Web).
2. Dale un apodo, por ejemplo `barberia-web`. **No** marques Firebase Hosting
   todavía.
3. Copia el objeto `firebaseConfig` que te muestra. Lo necesitas en el paso 5.

### 3. Activar Authentication

1. Menú lateral → **Compilación → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**.
3. Guarda.

### 4. Crear Firestore y Storage

**Firestore**
1. Menú lateral → **Compilación → Firestore Database → Crear base de datos**.
2. Elige **Modo de producción** (las reglas de este repositorio ya lo cubren).
3. Selecciona la región más cercana, por ejemplo `us-central1` o `southamerica-east1`.

> Ojo con no confundirse de producto: si la pantalla de reglas que ves tiene
> esta forma, estás en **Realtime Database**, que esta aplicación **no usa**.
>
> ```json
> { "rules": { ".read": false, ".write": false } }
> ```
>
> Las de Firestore empiezan por `rules_version = '2'`.

**Storage (opcional)**

Cloud Storage ya **no está en el plan gratuito**: exige el plan Blaze con
tarjeta. No hace falta activarlo.

Si no lo activas, al subir una foto la aplicación la **comprime en el navegador**
(900 px, ~150 KB) y la guarda dentro del propio documento de Firestore. Se sube
igual desde el móvil o el ordenador y el plan gratuito Spark sobra.

Si algún día activas Blaze, `uploadImage` intenta Cloud Storage **primero** y
solo recurre a la compresión cuando no está disponible, así que empezará a
usarlo sin tocar una línea de código. Ver
[`src/services/firebase/catalog.js`](src/services/firebase/catalog.js) y
[`src/utils/image.js`](src/utils/image.js).

Para activarlo, si te interesa:
1. Menú lateral → **Compilación → Storage → Comenzar**.
2. Acepta la configuración por defecto y elige la misma región.

### 5. Rellenar el `.env`

Copia la plantilla y pega tus credenciales:

```bash
cp .env.example .env
```

```env
# El interruptor principal
VITE_USE_MOCK=false

VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXX
```

> Vite solo lee el `.env` al arrancar: **reinicia `npm run dev`** después de
> editarlo.

**Alternativa sin tocar el `.env`.** El repositorio incluye `.env.firebase`, que
solo cambia el interruptor. Así puedes dejar `VITE_USE_MOCK=true` como valor por
defecto y arrancar contra Firebase cuando quieras:

```bash
npm run dev            # modo demo (mock)
npm run dev:firebase   # contra el Firebase real

npm run build          # compilado en modo demo
npm run build:firebase # compilado contra el Firebase real
```

Las credenciales siguen viviendo solo en `.env`, que git ignora.

> **No uses `npm run dev -- --mode firebase`.** En Windows npm se queda con
> `--mode` como opción suya y le pasa a Vite solo `firebase`, que Vite
> interpreta como la carpeta raíz a servir. El resultado es un 404 y el aviso
> `Could not auto-determine entry point`. Para eso existen los scripts
> `dev:firebase` y `build:firebase`.

### 6. Publicar las reglas de seguridad

Las reglas están en `firestore.rules` y `storage.rules`. Puedes subirlas de dos
formas.

**Opción A — copiar y pegar (rápida)**
1. Firestore Database → pestaña **Reglas** → pega el contenido de
   `firestore.rules` → **Publicar**.
2. Storage → pestaña **Reglas** → pega el contenido de `storage.rules` →
   **Publicar**.

**Opción B — Firebase CLI (recomendada)**

El repositorio ya trae `firebase.json`, `.firebaserc` y `firestore.indexes.json`,
así que no hace falta `firebase init`:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Si **no** has activado Storage (ver arriba), despliega solo las reglas de
Firestore como en el ejemplo: un `firebase deploy` a secas intentaría subir
también las de Storage y fallaría. Con Storage activado:

```bash
firebase deploy --only firestore:rules,storage
```

> Índices: todas las consultas de la aplicación usan solo filtros de igualdad y
> ninguna ordena por otro campo, así que Firestore las resuelve con sus índices
> automáticos. Por eso `firestore.indexes.json` está vacío.

### 7. Crear el primer administrador

Es el paso que engancha todo: sin un admin no puedes dar de alta barberos.

1. Arranca la app (`npm run dev`) y **regístrate** desde `/registro` con el correo
   que quieras usar como administrador. Se creará como **cliente**.
2. Ve a Firebase Console → **Firestore Database → colección `users`**.
3. Abre el documento cuyo `email` sea el tuyo (el id del documento es el `uid`).
4. Cambia el campo `role` de `"cliente"` a `"admin"` y guarda.
5. Cierra sesión y vuelve a entrar: ya aterrizas en `/admin`.

Desde ahí puedes crear barberos con **Barberos → Nuevo barbero**, que crea la
cuenta de acceso y su perfil en un solo paso.

> Detalle técnico: `createUserWithEmailAndPassword` inicia sesión automáticamente
> con la cuenta recién creada. Para que el administrador **no pierda su sesión**,
> `src/config/firebase.js` levanta una app secundaria desechable
> (`withSecondaryApp`) donde se aísla ese efecto.

### 8. Cargar datos iniciales

Con un proyecto vacío no hay servicios ni horarios. Tienes dos caminos:

- **Desde la app**: entra como admin y crea los servicios en **Servicios** y los
  horarios en **Mi negocio**. El documento `business/config` se crea solo la
  primera vez que se consulta.
- **A mano**: crea los documentos desde la consola de Firebase siguiendo el
  esquema de la siguiente sección.

---

## Colecciones de Firestore

| Colección | Id del documento | Campos |
|---|---|---|
| `users` | el `uid` de Authentication | `name`, `email`, `phone`, `role`, `photoURL`, `bio`, `specialties[]`, `active`, `createdAt` |
| `services` | auto | `name`, `description`, `duration` (min), `price`, `active`, `createdAt` |
| `barberServices` | auto | `barberId`, `serviceId` (vacío = servicio propio), `name`, `description`, `price`, `duration`, `active`, `createdAt`, `updatedAt` |
| `appointments` | auto | `clientId`, `barberId`, `serviceId`, `serviceName` (congelado), `date` (`YYYY-MM-DD`), `startTime` (`HH:mm`), `endTime`, `status`, `notes`, `price`, `createdAt`, `updatedAt` |
| `blocks` | auto | `barberId`, `date`, `startTime`, `endTime`, `reason`, `createdAt` |
| `courses` | auto | `title`, `description`, `syllabus[]`, `requirements[]`, `coverURL`, `instructorId`, `level`, `modality`, `price`, `capacity`, `enrolledCount`, `startDate`, `endDate`, `schedule{days[],startTime,endTime}`, `location`, `status`, `createdAt`, `updatedAt` |
| `enrollments` | auto | `courseId`, `clientId`, `status`, `attendance[{date,present}]`, `paymentStatus`, `enrolledAt`, `updatedAt` |
| `gallery` | auto | `title`, `description`, `imageURL`, `location`, `order`, `active`, `createdAt`, `updatedAt` |
| `business` | `config` (fijo) | `name`, `logoURL`, `phone`, `email`, `address`, `description`, `openingHours`, `social{}`, `updatedAt` |

**Valores permitidos**

- `role`: `cliente` · `barbero` · `admin`
- `appointments.status`: `pendiente` · `confirmada` · `completada` · `cancelada` · `no-show`
- `courses.status`: `borrador` · `publicado` · `en curso` · `finalizado` · `cancelado`
- `courses.level`: `principiante` · `intermedio` · `avanzado`
- `courses.modality`: `presencial` · `online`
- `enrollments.status`: `inscrito` · `cancelado` · `completado`
- `enrollments.paymentStatus`: `pendiente` · `pagado` · `reembolsado`
- `gallery.location`: `hero` · `inicio` · `servicios` (una galería independiente por zona)
- `schedule.days`: índices de día de la semana, **0 = domingo**
- `openingHours`: claves `dom`,`lun`,`mar`,`mie`,`jue`,`vie`,`sab`, cada una con
  `{ open: "10:00", close: "20:00", closed: false }`

Las fechas se guardan como **texto** (`"2026-09-04"`, `"14:30"`), no como
`Timestamp`. Es deliberado: evita por completo los desfases de zona horaria entre
navegador, servidor y modo demo.

---

## Índices de Firestore

Las consultas están diseñadas para **no exigir índices compuestos**: se envía un
único filtro de igualdad al servidor y el resto se afina en el cliente. Si en
algún momento Firestore te pide un índice, la propia consola te da un enlace
directo para crearlo con un clic.

---

## Notas sobre el modo demo

- Los datos viven en `localStorage`, bajo la clave `barberia_demo_db_v1`.
  Sobreviven a un refresco del navegador.
- Las llamadas tienen **retardos simulados** (140–360 ms) para que se vean los
  skeletons y los estados de carga reales.
- Las imágenes que subas se comprimen en el navegador (máx. 900 px, JPEG 0.75) y
  se guardan como *data URL*, para no reventar la cuota de `localStorage`.
- El seed se genera **en relación a la fecha de hoy**: siempre hay citas hoy,
  esta semana y en las próximas dos semanas, un curso en marcha, otro por empezar
  y otro ya finalizado. Los tableros nunca muestran ceros.
- Contenido sembrado: 12 usuarios (1 admin, 3 barberos, 8 clientes), 6 servicios,
  30 citas repartidas entre los cinco estados, 4 bloqueos, 6 cursos (publicados,
  en curso, finalizado y borrador), 18 inscripciones y 17 fotos de galería
  (2 en el hero, 6 en el carrusel de inicio y 8 en el de servicios, todas distintas).

---

## Comandos

```bash
npm run dev       # servidor de desarrollo en http://localhost:5173
npm run build     # compilación de producción en /dist
npm run preview   # sirve /dist para comprobar el build
```

---

## Detalles de rendimiento

Cuando `VITE_USE_MOCK=true`, el SDK de Firebase **ni siquiera se descarga**:
`src/services/index.js` lo carga con un `import()` dinámico, así que el
empaquetador lo deja en un chunk aparte que nunca se pide en modo demo.

```
Modo demo   →  ~100 kB + 164 kB (vendor)   ≈ 83 kB gzip
Modo real   →  + 518 kB del SDK de Firebase (chunk aparte, bajo demanda)
```

---

## Solución de problemas

**«Faltan las variables VITE_FIREBASE_… en tu archivo .env»**
Tienes `VITE_USE_MOCK=false` pero el `.env` está incompleto. Rellénalo y
reinicia el servidor de desarrollo.

**«Tu cuenta no tiene un perfil asociado»**
Existe el usuario en Authentication pero no su documento en `users/{uid}`.
Créalo a mano en la consola siguiendo el esquema de arriba.

**«No tienes permisos para realizar esta acción»**
Las reglas de seguridad están rechazando la operación. Comprueba que el campo
`role` de tu documento en `users` es el correcto y que `active` es `true`.

**Las imágenes de la demo no cargan**
Las fotos de ejemplo vienen de Unsplash y necesitan internet. Sin conexión, los
componentes `Avatar` y `CourseCover` muestran su respaldo con iniciales y
degradado: no se rompe nada.

**Después de cambiar el `.env` no pasa nada**
Vite lee las variables al arrancar. Detén el proceso y vuelve a lanzar
`npm run dev`.
