import { useCallback, useEffect, useMemo, useState } from 'react'
import './ProductosVenta.css'

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:3032' : '')

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: { ...(opciones.body ? { 'Content-Type': 'application/json' } : {}), ...opciones.headers },
  })
  const texto = await respuesta.text()
  let datos = null
  try { datos = texto ? JSON.parse(texto) : null } catch { datos = { mensaje: texto } }
  if (!respuesta.ok) throw new Error(datos?.mensaje || `Error del servidor (${respuesta.status})`)
  return datos
}

export default function ProductosVenta() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try { setProductos(await api('/api/productos-venta')) }
    catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es')
    return productos.filter(p => !q || `${p.codigo} ${p.nombre} ${p.tipo}`.toLocaleLowerCase('es').includes(q))
  }, [productos, busqueda])

  function cambiar(id, campo, valor) {
    setProductos(actuales => actuales.map(p => p.id_producto === id ? { ...p, [campo]: valor } : p))
  }

  async function guardar(producto) {
    setError('')
    setMensaje('')
    setGuardando(producto.id_producto)
    try {
      await api(`/api/productos-venta/${producto.id_producto}`, {
        method: 'PUT',
        body: JSON.stringify({
          precio_venta: Number(producto.precio_venta),
          habilitado_venta: Boolean(producto.habilitado_venta),
          controla_stock: Boolean(producto.controla_stock),
        }),
      })
      setMensaje(`Se guardó la configuración de ${producto.nombre}.`)
      await cargar()
    } catch (e) { setError(e.message) }
    finally { setGuardando(null) }
  }

  return (
    <section className="pv-page">
      <div className="pv-heading">
        <div><h2>Productos para la venta</h2><p>Configurá qué productos se ofrecen al cliente y su precio de venta.</p></div>
        <div className="pv-counter">{productos.filter(p => p.habilitado_venta && p.configuracion_activa).length} habilitados</div>
      </div>
      {error && <div className="pv-alert pv-error" role="alert">{error}</div>}
      {mensaje && <div className="pv-alert pv-success" role="status">{mensaje}</div>}
      <label className="pv-search">Buscar producto
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Código o nombre..." />
      </label>
      <div className="pv-table-wrap">
        <table className="pv-table">
          <thead><tr><th>Producto</th><th>Tipo</th><th>Precio de venta</th><th>Habilitado</th><th>Controla stock</th><th>Acción</th></tr></thead>
          <tbody>
            {cargando && <tr><td colSpan="6" className="pv-empty">Cargando catálogo...</td></tr>}
            {!cargando && filtrados.length === 0 && <tr><td colSpan="6" className="pv-empty">No hay productos para mostrar.</td></tr>}
            {!cargando && filtrados.map(p => (
              <tr key={p.id_producto}>
                <td><strong>{p.nombre}</strong><small>{p.codigo}</small></td>
                <td>{p.tipo}</td>
                <td><div className="pv-price"><span>$</span><input type="number" min="0" step="0.01" value={p.precio_venta} onChange={e => cambiar(p.id_producto, 'precio_venta', e.target.value)} /></div></td>
                <td><input aria-label={`Habilitar ${p.nombre} para la venta`} type="checkbox" checked={Boolean(p.habilitado_venta)} onChange={e => cambiar(p.id_producto, 'habilitado_venta', e.target.checked)} /></td>
                <td><input aria-label={`Controlar stock de ${p.nombre}`} type="checkbox" checked={Boolean(p.controla_stock)} onChange={e => cambiar(p.id_producto, 'controla_stock', e.target.checked)} /></td>
                <td><button className="pv-save" type="button" disabled={guardando === p.id_producto} onClick={() => guardar(p)}>{guardando === p.id_producto ? 'Guardando...' : 'Guardar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pv-note">El precio de venta es independiente del costo. Cada cambio de precio queda registrado en el historial. El control de stock queda configurado, pero todavía no descuenta existencias.</p>
    </section>
  )
}
