import clientes from './clientes.js'
import recetas from './recetas.js'
import integraciones from './integraciones.js'
import ingredientes from './ingredientes.js'
import comprasIngredientes from './compras-ingredientes.js'
import mermasIngredientes from './mermas-ingredientes.js'
import reservasEventos from './reservas-eventos.js'

// Agrupa modulos operativos poco usados para mantener el despliegue dentro del
// limite de funciones de Vercel sin cambiar las URLs que consume la aplicacion.
export default async function handler(req: any, res: any) {
  const modulo = (req.url || '').split('?')[0].split('/').filter(Boolean)[1]
  const handlers: Record<string, (req: any, res: any) => Promise<any>> = {
    clientes,
    recetas,
    integraciones,
    ingredientes,
    'compras-ingredientes': comprasIngredientes,
    'mermas-ingredientes': mermasIngredientes,
    reservas: reservasEventos,
    eventos: reservasEventos,
  }
  const moduloHandler = handlers[modulo]
  if (!moduloHandler) return res.status(404).json({ ok: false, msg: 'Modulo no encontrado' })
  return moduloHandler(req, res)
}
