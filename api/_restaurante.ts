import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'

let schemaReady: Promise<void> | null = null

export function ensureRestaurantSchema() {
  if (!schemaReady) schemaReady = query(`
    CREATE TABLE IF NOT EXISTS ingredientes (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, codigo VARCHAR(50), nombre VARCHAR(160) NOT NULL,
      descripcion TEXT, categoria VARCHAR(80), unidad_compra VARCHAR(30) NOT NULL DEFAULT 'unidad',
      unidad_consumo VARCHAR(30) NOT NULL DEFAULT 'unidad', factor_conversion NUMERIC(14,4) NOT NULL DEFAULT 1,
      stock_actual NUMERIC(14,3) NOT NULL DEFAULT 0, stock_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
      stock_maximo NUMERIC(14,3), punto_reorden NUMERIC(14,3), costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
      merma_pct NUMERIC(6,3) NOT NULL DEFAULT 0, rendimiento NUMERIC(8,4) NOT NULL DEFAULT 1,
      proveedor_principal VARCHAR(160), activo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(empresa_id,codigo)
    );
    CREATE TABLE IF NOT EXISTS compras_ingredientes (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, proveedor VARCHAR(160), numero_factura VARCHAR(100), fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, impuestos NUMERIC(14,2) NOT NULL DEFAULT 0, descuentos NUMERIC(14,2) NOT NULL DEFAULT 0,
      transporte NUMERIC(14,2) NOT NULL DEFAULT 0, total NUMERIC(14,2) NOT NULL DEFAULT 0, observaciones TEXT, soporte_url TEXT, usuario_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS compra_ingrediente_items (
      id UUID PRIMARY KEY, compra_id UUID NOT NULL, empresa_id UUID NOT NULL, ingrediente_id UUID NOT NULL,
      cantidad_compra NUMERIC(14,3) NOT NULL, factor_conversion NUMERIC(14,4) NOT NULL DEFAULT 1, cantidad_recibida NUMERIC(14,3) NOT NULL,
      precio_unitario_compra NUMERIC(14,4) NOT NULL, impuestos NUMERIC(14,2) NOT NULL DEFAULT 0, descuentos NUMERIC(14,2) NOT NULL DEFAULT 0,
      costo_adicional NUMERIC(14,2) NOT NULL DEFAULT 0, costo_total NUMERIC(14,2) NOT NULL, lote VARCHAR(80), vencimiento DATE
    );
    CREATE TABLE IF NOT EXISTS movimientos_ingredientes (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, ingrediente_id UUID NOT NULL, usuario_id UUID,
      tipo VARCHAR(30) NOT NULL, entrada NUMERIC(14,3) NOT NULL DEFAULT 0, salida NUMERIC(14,3) NOT NULL DEFAULT 0,
      saldo NUMERIC(14,3) NOT NULL, costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0, costo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      proveedor VARCHAR(160), documento VARCHAR(100), pedido_id UUID, pedido_item_id UUID, motivo VARCHAR(120), observaciones TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ingrediente_costos (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, ingrediente_id UUID NOT NULL, costo_anterior NUMERIC(14,4) NOT NULL, costo_nuevo NUMERIC(14,4) NOT NULL,
      motivo VARCHAR(80), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS recetas_restaurante (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, producto_id UUID NOT NULL, nombre VARCHAR(160) NOT NULL,
      porciones NUMERIC(12,3) NOT NULL DEFAULT 1, costos_adicionales NUMERIC(14,2) NOT NULL DEFAULT 0,
      costo_ingredientes NUMERIC(14,2) NOT NULL DEFAULT 0, costo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      costo_por_porcion NUMERIC(14,4) NOT NULL DEFAULT 0, activa BOOLEAN NOT NULL DEFAULT true, version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS recetas_restaurante_activa_unica ON recetas_restaurante(empresa_id,producto_id) WHERE activa=true;
    CREATE TABLE IF NOT EXISTS receta_ingredientes (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, receta_id UUID NOT NULL, ingrediente_id UUID NOT NULL,
      cantidad_neta NUMERIC(14,3) NOT NULL, unidad VARCHAR(30) NOT NULL DEFAULT 'unidad', merma_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
      cantidad_bruta NUMERIC(14,3) NOT NULL, costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0, costo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      UNIQUE(receta_id,ingrediente_id)
    );
  `).then(() => query(`
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS producto_tipo VARCHAR(30) NOT NULL DEFAULT 'simple';
    ALTER TABLE compras_ingredientes ADD COLUMN IF NOT EXISTS soporte_url TEXT;
    ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE recetas_restaurante ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE recetas_restaurante ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE movimientos_ingredientes ADD COLUMN IF NOT EXISTS pedido_item_id UUID
  `)).then(() => query(`CREATE UNIQUE INDEX IF NOT EXISTS movimientos_ingredientes_venta_unica ON movimientos_ingredientes(pedido_item_id,ingrediente_id,tipo) WHERE pedido_item_id IS NOT NULL AND tipo='venta'`)).then(() => undefined)
  return schemaReady
}

export async function esRestaurante(empresaId: string) {
  const empresa = await queryOne(`SELECT LOWER(TRIM(tipo)) as tipo FROM empresas WHERE id=$1`, [empresaId]) as any
  return empresa?.tipo === 'restaurante'
}

export async function recalcularReceta(recetaId: string, empresaId: string) {
  const lineas = await query(`SELECT ri.*,i.costo_unitario FROM receta_ingredientes ri JOIN ingredientes i ON i.id=ri.ingrediente_id WHERE ri.receta_id=$1 AND ri.empresa_id=$2`, [recetaId,empresaId]) as any[]
  let ingredientes = 0
  for (const linea of lineas) {
    const costo = Number(linea.cantidad_bruta || 0) * Number(linea.costo_unitario || 0)
    ingredientes += costo
    await query(`UPDATE receta_ingredientes SET costo_unitario=$1,costo_total=$2 WHERE id=$3`, [linea.costo_unitario || 0,costo,linea.id])
  }
  const receta = await queryOne(`SELECT producto_id,porciones,costos_adicionales FROM recetas_restaurante WHERE id=$1 AND empresa_id=$2`, [recetaId,empresaId]) as any
  if (!receta) return
  const total = ingredientes + Number(receta.costos_adicionales || 0)
  const porcion = total / Math.max(1, Number(receta.porciones || 1))
  await query(`UPDATE recetas_restaurante SET costo_ingredientes=$1,costo_total=$2,costo_por_porcion=$3,updated_at=NOW() WHERE id=$4`, [ingredientes,total,porcion,recetaId])
  await query(`UPDATE productos SET precio_costo=$1,producto_tipo='receta',updated_at=NOW() WHERE id=$2 AND empresa_id=$3`, [porcion,receta.producto_id,empresaId])
}

export async function recalcularRecetasIngrediente(ingredienteId: string, empresaId: string) {
  const recetas = await query(`SELECT DISTINCT receta_id FROM receta_ingredientes WHERE ingrediente_id=$1 AND empresa_id=$2`, [ingredienteId,empresaId]) as any[]
  for (const receta of recetas) await recalcularReceta(receta.receta_id,empresaId)
}

export async function movimientoIngrediente(args: { empresaId:string; ingredienteId:string; usuarioId:string; tipo:string; entrada?:number; salida?:number; proveedor?:string; documento?:string; pedidoId?:string; pedidoItemId?:string; motivo?:string; observaciones?:string }) {
  const { empresaId, ingredienteId } = args
  const ingrediente = await queryOne(`SELECT * FROM ingredientes WHERE id=$1 AND empresa_id=$2 AND activo=true`, [ingredienteId,empresaId]) as any
  if (!ingrediente) throw new Error('Ingrediente no encontrado')
  if (args.pedidoItemId && args.tipo === 'venta') {
    const previo = await queryOne(`SELECT id FROM movimientos_ingredientes WHERE pedido_item_id=$1 AND ingrediente_id=$2 AND tipo='venta'`, [args.pedidoItemId,ingredienteId])
    if (previo) return { repetido:true, saldo:Number(ingrediente.stock_actual) }
  }
  const entrada = Math.max(0, Number(args.entrada || 0)); const salida = Math.max(0, Number(args.salida || 0))
  const anterior = Number(ingrediente.stock_actual || 0); const saldo = anterior + entrada - salida
  if (saldo < -0.0001) throw new Error(`Stock insuficiente de ${ingrediente.nombre}. Disponible: ${anterior}, requerido: ${salida}`)
  const costo = Number(ingrediente.costo_unitario || 0)
  await query(`UPDATE ingredientes SET stock_actual=$1,updated_at=NOW() WHERE id=$2 AND empresa_id=$3`, [saldo,ingredienteId,empresaId])
  await query(`INSERT INTO movimientos_ingredientes (id,empresa_id,ingrediente_id,usuario_id,tipo,entrada,salida,saldo,costo_unitario,costo_total,proveedor,documento,pedido_id,pedido_item_id,motivo,observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [uuid(),empresaId,ingredienteId,args.usuarioId,args.tipo,entrada,salida,saldo,costo,costo*(entrada||salida),args.proveedor||null,args.documento||null,args.pedidoId||null,args.pedidoItemId||null,args.motivo||null,args.observaciones||null])
  return { saldo, costo }
}
