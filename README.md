# GymPass

App móvil que conecta a empleados de empresas con una red de gimnasios, al estilo del beneficio corporativo "Gympass". Permite a los **usuarios** reservar pases y clases en gimnasios cercanos, a los **dueños de gimnasios** gestionar su local, clases y reservas, y a los **empleadores** contratar planes corporativos para sus empleados. Los pagos de suscripciones se hacen con **Mercado Pago**.

**Gestión del Desarrollo de Sistemas Informáticos — Cátedra Fontela — 1C2026 — Grupo 9**

Integrantes del grupo:
- Martino Nervi
- Tomas Pérez D'angelo
- Francisco Serrano
- Juan Ignacio Moore
- Juan Pablo Pessat
- Jeanne Lefrais

---

## Tecnologías usadas

| Capa | Tecnología |
|------|-----------|
| Lenguaje | JavaScript (JSX) |
| Framework | React Native + **Expo** |
| Backend / base de datos | **Firebase** (Firestore + Auth + Storage) |
| Servidor de pagos | Node.js + Express, desplegado en **Railway** |
| Pagos | Mercado Pago |
| Tests | Jest |

### Herramienta de desarrollo
El proyecto se desarrolló asistido con **Claude Code** (vibe coding) sobre un editor estándar, con Expo como entorno de ejecución. No se usó ninguna plataforma low-code / no-code: todo el código fuente es editable y está en este repositorio.

---

## Estructura del proyecto

```
gympass/
├── App.js                 # Punto de entrada y navegación principal
├── firebaseConfig.js      # Configuración de Firebase (cliente)
├── cloudinaryConfig.js    # Configuración de Cloudinary
├── app.json               # Configuración de Expo
├── screens/               # Pantallas de la app (usuario, gimnasio, empleador)
├── components/            # Componentes reutilizables
├── utils/                 # Lógica de negocio (planes, reservas, ganancias, etc.)
│   └── seedDatabase.js    # Script para poblar Firestore con datos de demo
├── src/                   # Utilidades varias (fetchGyms, etc.)
├── assets/                # Íconos, splash e imágenes
├── __tests__/             # Tests unitarios (Jest)
└── backend/               # Servidor de pagos Mercado Pago (Node + Express)
    ├── server.js
    └── package.json
```

### Roles de usuario
- **`usuario`** — empleado/cliente: explora gimnasios, reserva pases y clases.
- **`gimnasio`** — dueño de gimnasio: administra local, clases, reservas y reportes.
- **`empleador`** — empresa: contrata un plan corporativo y gestiona sus empleados.

### Planes
- **classic** — gimnasios básicos, 1 pase/día.
- **platinum** — classic + gimnasios premium + clases grupales.
- **black** — todos los gimnasios, pases ilimitados + clases.

---

## Base de datos

No usa una base SQL: los datos viven en **Cloud Firestore** (NoSQL). Colecciones principales:

- `usuarios/{uid}` — perfil del usuario (nombre, apellido, teléfono, rol, plan).
- `gimnasios/{id}` — datos del gimnasio (nombre, descripción, horarios, actividades, fotos, ubicación) y subcolección `clases`.
- `reservas/{id}` — reservas de pases y clases.
- `empleadores/{uid}` — datos de la empresa y su plan corporativo.

Para cargar **datos de demostración** en Firestore, el proyecto incluye el script `utils/seedDatabase.js` (función `ejecutarSeeding`), que crea gimnasios y clases de ejemplo. Se puede disparar desde la pantalla de configuración de demo dentro de la app.

---

## Cómo correr la app

### Requisitos
- [Node.js](https://nodejs.org/) (LTS).
- App **Expo Go** en el celular (Android/iOS) **o** un emulador (Android Studio / Xcode).

### Pasos
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Expo
npx expo start
```
Luego escaneá el código QR con **Expo Go** (o presioná `a` para Android / `i` para iOS en el emulador).

> La app ya apunta a un proyecto de Firebase y a un servidor de pagos desplegado, así que funciona sin configuración adicional.

---

## Cómo correr el servidor de pagos (opcional)

La app usa un backend ya desplegado en Railway (`https://gympass-production.up.railway.app`), por lo que **no hace falta levantarlo localmente** para probar la app. Si querés correrlo vos:

```bash
cd backend
npm install
npm start          # levanta Express en el puerto 3000
```

Requiere un archivo `backend/.env` con:
```
MP_ACCESS_TOKEN=<access token de Mercado Pago>
FIREBASE_SERVICE_ACCOUNT=<JSON de la service account de Firebase>
PORT=3000
```

Endpoints:
- `POST /crear-preferencia` — pago de plan individual de un usuario.
- `POST /crear-preferencia-empresa` — pago de plan corporativo de un empleador.
- `POST /webhook` — recibe la confirmación de Mercado Pago y actualiza Firestore.

---

## Credenciales de prueba — Mercado Pago

Cuentas de **test** (no son reales) para probar el flujo de pago:

**Comprador** (paga en el checkout)
- Usuario: `TESTUSER2643003190558805405`
- Email: `test_user_2643003190558805405@testuser.com`
- Contraseña: `NpCtXHvMqd`

**Vendedor** (ve los pagos recibidos)
- Usuario: `TESTUSER3119525246992088096`
- Email: `test_user_3119525246992088096@testuser.com`
- Contraseña: `Ws3JqaLoEO`

> Para el pago en sandbox usá tarjetas de prueba de Mercado Pago (ej. Mastercard `5031 7557 3453 0604`, venc. `11/30`, CVV `123`).

---

## Tests

```bash
npm test
```
Cubre validaciones de autenticación, usuarios, gimnasios, reservas, clases, planes, distancia y los flujos de acceso y reserva.
