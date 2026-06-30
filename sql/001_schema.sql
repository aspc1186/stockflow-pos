CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  nit VARCHAR(30), telefono VARCHAR(30), email VARCHAR(150),
  direccion TEXT, ciudad VARCHAR(100), pais VARCHAR(100) DEFAULT 'Colombia',
  logo_url TEXT, tipo VARCHAR(30) DEFAULT 'restaurante',
  activa BOOLEAN NOT NULL DEFAULT true,
  licencia_inicio DATE, licencia_fin DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT
);

INSERT INTO roles (nombre, descripcion) VALUES
  ('superadmin','Administrador global'),('admin','Admin empresa'),
  ('supervisor','Supervisor'),('mesero','Mesero'),('bartender','Bartender'),
  ('cocinero','Cocinero'),('cajero','Cajero'),('bodeguero','Bodeguero'),('consulta','Solo lectura');

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  rol_id INTEGER REFERENCES roles(id),
  nombre VARCHAR(150) NOT NULL, email VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL, password_hash TEXT NOT NULL,
  telefono VARCHAR(30), activo BOOLEAN DEFAULT true,
  ultimo_acceso TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, email), UNIQUE(empresa_id, username)
);
CREATE UNIQUE INDEX idx_superadmin_email ON usuarios(email) WHERE empresa_id IS NULL;

CREATE TABLE sesiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  token_jti VARCHAR(200), ip VARCHAR(60), user_agent TEXT,
  login_at TIMESTAMPTZ DEFAULT NOW(), logout_at TIMESTAMPTZ, activa BOOLEAN DEFAULT true
);

CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  accion VARCHAR(100) NOT NULL, tabla VARCHAR(100), registro_id UUID,
  datos_antes JSONB, datos_nuevo JSONB, ip VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zonas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, descripcion TEXT, orden INTEGER DEFAULT 0, activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mesas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  zona_id UUID REFERENCES zonas(id) ON DELETE SET NULL,
  numero VARCHAR(20) NOT NULL, nombre VARCHAR(80), capacidad INTEGER DEFAULT 4,
  pos_x INTEGER DEFAULT 0, pos_y INTEGER DEFAULT 0,
  estado VARCHAR(30) DEFAULT 'libre', activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(empresa_id, numero)
);

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, descripcion TEXT, icono VARCHAR(50), color VARCHAR(20),
  tipo VARCHAR(20) DEFAULT 'ambos', orden INTEGER DEFAULT 0, activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nombre VARCHAR(200) NOT NULL, descripcion TEXT, codigo VARCHAR(80),
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0, precio_costo NUMERIC(12,2) DEFAULT 0,
  impuesto_pct NUMERIC(5,2) DEFAULT 0, unidad_medida VARCHAR(30) DEFAULT 'unidad',
  imagen_url TEXT, disponible BOOLEAN DEFAULT true, controla_stock BOOLEAN DEFAULT true,
  destino VARCHAR(20) DEFAULT 'ambos',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
);

CREATE TABLE inventario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  stock_actual NUMERIC(12,3) DEFAULT 0, stock_minimo NUMERIC(12,3) DEFAULT 0,
  stock_maximo NUMERIC(12,3) DEFAULT 0, punto_reorden NUMERIC(12,3) DEFAULT 0,
  ubicacion VARCHAR(100), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, producto_id)
);

CREATE TABLE movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL, cantidad NUMERIC(12,3) NOT NULL,
  stock_antes NUMERIC(12,3), stock_despues NUMERIC(12,3), costo_unit NUMERIC(12,2),
  referencia_id UUID, referencia_tipo VARCHAR(50), notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL, nit VARCHAR(30), telefono VARCHAR(30),
  email VARCHAR(150), direccion TEXT, contacto VARCHAR(150), activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordenes_compra (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  numero VARCHAR(50), estado VARCHAR(30) DEFAULT 'pendiente',
  subtotal NUMERIC(12,2) DEFAULT 0, impuestos NUMERIC(12,2) DEFAULT 0, total NUMERIC(12,2) DEFAULT 0,
  notas TEXT, fecha_esperada DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordenes_compra_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,3) NOT NULL, precio_unit NUMERIC(12,2) NOT NULL, subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL, telefono VARCHAR(30), email VARCHAR(150),
  documento VARCHAR(30), notas TEXT, visitas INTEGER DEFAULT 0,
  total_gastado NUMERIC(14,2) DEFAULT 0, ultima_visita TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  numero SERIAL, estado VARCHAR(30) DEFAULT 'abierto',
  subtotal NUMERIC(12,2) DEFAULT 0, impuestos NUMERIC(12,2) DEFAULT 0,
  descuento NUMERIC(12,2) DEFAULT 0, propina NUMERIC(12,2) DEFAULT 0, total NUMERIC(12,2) DEFAULT 0,
  notas TEXT, tipo VARCHAR(30) DEFAULT 'mesa',
  apertura_at TIMESTAMPTZ DEFAULT NOW(), cierre_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pedido_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1, precio_unit NUMERIC(12,2) NOT NULL,
  impuesto_pct NUMERIC(5,2) DEFAULT 0, descuento NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL, observaciones TEXT, estado VARCHAR(30) DEFAULT 'pendiente',
  destino VARCHAR(20) DEFAULT 'ambos',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cajas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  estado VARCHAR(20) DEFAULT 'abierta',
  saldo_inicial NUMERIC(12,2) DEFAULT 0, saldo_final NUMERIC(12,2),
  total_ventas NUMERIC(12,2) DEFAULT 0, total_ingresos NUMERIC(12,2) DEFAULT 0,
  total_egresos NUMERIC(12,2) DEFAULT 0,
  apertura_at TIMESTAMPTZ DEFAULT NOW(), cierre_at TIMESTAMPTZ, notas TEXT
);

CREATE TABLE caja_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  caja_id UUID NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL, metodo_pago VARCHAR(30) DEFAULT 'efectivo',
  monto NUMERIC(12,2) NOT NULL, descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(200) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX idx_pedidos_estado ON pedidos(empresa_id, estado);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX idx_inventario_empresa ON inventario(empresa_id);
CREATE INDEX idx_mesas_empresa ON mesas(empresa_id);
CREATE INDEX idx_productos_empresa ON productos(empresa_id);
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_caja_empresa ON cajas(empresa_id);
CREATE INDEX idx_auditoria_empresa ON auditoria(empresa_id);
