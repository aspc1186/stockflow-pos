# POS Manager — SaaS para Restaurantes, Bares y Discotecas

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Serverless Functions (Vercel)
- **Base de datos**: PostgreSQL (Neon)
- **Auth**: JWT
- **Real-time**: Socket.io

## Primeros pasos

### 1. Configurar base de datos (Neon)
1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto nuevo
3. Abrir SQL Editor → ejecutar `sql/001_schema.sql`
4. Ejecutar `sql/002_seed.sql`
5. Copiar la connection string

### 2. Instalar dependencias
```bash
npm install
cp .env.example .env
# Editar .env con tu DATABASE_URL y JWT_SECRET
npm run dev
```

### 3. Desplegar en Vercel
1. Subir a GitHub
2. Importar en [vercel.com](https://vercel.com) → New Project
3. Variables de entorno en Vercel:
   - `DATABASE_URL` → Connection string de Neon
   - `JWT_SECRET` → Cadena aleatoria segura (min. 32 chars)
4. Deploy automático

## Credenciales iniciales
| Campo | Valor |
|-------|-------|
| URL | `/login` |
| Usuario | `superadmin` |
| Contraseña | `Admin@2024` |

> ⚠️ **Cambiar la contraseña inmediatamente en producción**

## Módulos
| Módulo | URL | Acceso |
|--------|-----|--------|
| Dashboard | `/app/dashboard` | Todos |
| Mesas | `/app/mesas` | Todos |
| Pedidos | `/app/pedidos` | Todos |
| Caja | `/app/caja` | Cajero, Supervisor, Admin |
| Productos | `/app/productos` | Supervisor, Admin |
| Inventario | `/app/inventario` | Bodeguero, Supervisor, Admin |
| Compras | `/app/compras` | Bodeguero, Supervisor, Admin |
| Clientes | `/app/clientes` | Todos |
| Usuarios | `/app/usuarios` | Supervisor, Admin |
| Reportes | `/app/reportes` | Supervisor, Admin |
| Configuración | `/app/configuracion` | Admin |
| **Cocina KDS** | `/cocina` | Cocinero, Supervisor, Admin |
| **Barra KDS** | `/barra` | Bartender, Supervisor, Admin |
| **Mesero móvil** | `/mesero` | Mesero |
| **Super Admin** | `/superadmin` | Solo SuperAdmin |

## Roles del sistema
`superadmin` → `admin` → `supervisor` → `cajero` / `mesero` / `bartender` / `cocinero` / `bodeguero` / `consulta`

## WebSocket (tiempo real)
En Vercel (serverless) configura `VITE_SOCKET_URL` con un servicio externo de WebSocket:
- [Pusher](https://pusher.com) — plan gratis disponible
- [Ably](https://ably.com) — plan gratis disponible
- [Socket.io con Railway](https://railway.app) — servidor dedicado

## Estructura
```
saas-pos/
├── api/              ← Serverless Functions (Vercel)
│   ├── _db.ts        ← Pool PostgreSQL
│   ├── _auth.ts      ← JWT helpers
│   ├── auth/         ← login, me, forgot/reset password
│   ├── mesas/        ← CRUD mesas
│   ├── pedidos/      ← CRUD pedidos + items
│   ├── productos/    ← CRUD productos
│   ├── inventario/   ← Control de stock
│   ├── caja/         ← Apertura/cierre/movimientos
│   ├── compras/      ← Órdenes de compra
│   ├── clientes/     ← CRM básico
│   ├── reportes/     ← Ventas exportables
│   └── superadmin/   ← Gestión multiempresa
├── src/
│   ├── pages/app/    ← Módulos del sistema
│   ├── pages/mesero/ ← Vista móvil mesero
│   ├── pages/superadmin/ ← Panel super admin
│   └── pages/auth/   ← Login y recuperación
├── sql/
│   ├── 001_schema.sql ← Esquema completo
│   └── 002_seed.sql   ← SuperAdmin inicial
└── vercel.json
```
