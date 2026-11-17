import { useCallback, useEffect, useMemo, useState } from 'react'
import './ProductosVenta.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })

  const texto = await respuesta.text()
  let datos = null

  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    datos = { mensaje: texto }
  }

  if (!respuesta.ok) {
    throw new Error(datos?.mensaje || `Error del servidor (${respuesta.status})`)
  }

  return datos
}

const moneda = (valor) => {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
    return '—'
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor))
}

export default function ProductosVenta() {
  const [productos, setProductos] = useState([])
  const [recargoPredeterminado, setRecargoPredeterminado] = useState('100')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(null)
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const [lista, parametros] = await Promise.all([
        api('/api/productos-venta'),
        api('/api/productos-venta/configuracion'),
      ])

      setProductos(Array.isArray(lista) ? lista : [])
      setRecargoPredeterminado(String(parametros.recargo_predeterminado_elaborados ?? 100))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es')

    return productos.filter((p) =>
      !q || `${p.codigo} ${p.nombre} ${p.tipo}`
        .toLocaleLowerCase('es')
        .includes(q),
    )
  }, [productos, busqueda])

  function cambiar(id, campo, valor) {
    setProductos((actuales) =>
      actuales.map((p) =>
        p.id_producto === id ? { ...p, [campo]: valor } : p,
      ),
    )
  }

  async function guardar(producto, opciones = {}) {
    setError('')
    setMensaje('')
    setGuardando(producto.id_producto)

    const precio = opciones.precioVenta !== undefined
      ? Number(opciones.precioVenta)
      : Number(producto.precio_venta)

    const datos = {
      precio_venta: precio,
      habilitado_venta: Boolean(producto.habilitado_venta),
      controla_stock: Boolean(producto.controla_stock),
      confirmar_costo_actual: opciones.confirmarCostoActual === true,
    }

    if (producto.tipo === 'ELABORADO') {
      datos.recargo_porcentaje = Number(producto.recargo_porcentaje)
    }

    try {
      await api(`/api/productos-venta/${producto.id_producto}`, {
        method: 'PUT',
        body: JSON.stringify(datos),
      })

      setMensaje(`Se guardó la configuración de ${producto.nombre}.`)
      await cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(null)
    }
  }

  async function guardarRecargoPredeterminado(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')
    setGuardandoConfiguracion(true)

    try {
      const resultado = await api('/api/productos-venta/configuracion', {
        method: 'PUT',
        body: JSON.stringify({
          recargo_predeterminado_elaborados: Number(recargoPredeterminado),
        }),
      })

      const nuevoValor = resultado.configuracion.recargo_predeterminado_elaborados
      setRecargoPredeterminado(String(nuevoValor))
      setMensaje('Se actualizó el recargo predeterminado. Los recargos individuales existentes no se modificaron.')
      await cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardandoConfiguracion(false)
    }
  }

  const habilitados = productos.filter(
    (p) => p.habilitado_venta && p.configuracion_activa,
  ).length

  return (
    <section className="pv-page">
      <div className="pv-heading">
        <div>
          <h2>Productos para la venta</h2>
          <p>Administrá los precios comerciales de elaborados y productos de reventa.</p>
        </div>
        <div className="pv-counter">{habilitados} habilitados</div>
      </div>

      {error && <div className="pv-alert pv-error" role="alert">{error}</div>}
      {mensaje && <div className="pv-alert pv-success" role="status">{mensaje}</div>}

      <form className="pv-default-panel" onSubmit={guardarRecargoPredeterminado}>
        <div>
          <strong>Recargo predeterminado para nuevos elaborados</strong>
          <p>Se usa cuando un elaborado todavía no tiene un recargo propio. No reemplaza los recargos individuales ya configurados.</p>
        </div>
        <label>
          <span>Recargo (%)</span>
          <input
            type="number"
            min="0"
            max="10000"
            step="0.01"
            value={recargoPredeterminado}
            onChange={(e) => setRecargoPredeterminado(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="pv-save" disabled={guardandoConfiguracion}>
          {guardandoConfiguracion ? 'Guardando...' : 'Guardar predeterminado'}
        </button>
      </form>

      <label className="pv-search">
        Buscar producto
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Código o nombre..."
        />
      </label>

      <div className="pv-table-wrap">
        <table className="pv-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Costo actual</th>
              <th>Recargo</th>
              <th>Precio sugerido</th>
              <th>Precio de venta vigente</th>
              <th>Estado del costo</th>
              <th>Habilitado</th>
              <th>Controla stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan="10" className="pv-empty">Cargando catálogo...</td></tr>
            )}

            {!cargando && filtrados.length === 0 && (
              <tr><td colSpan="10" className="pv-empty">No hay elaborados ni productos de reventa para mostrar.</td></tr>
            )}

            {!cargando && filtrados.map((p) => (
              <tr key={p.id_producto}>
                <td>
                  <strong>{p.nombre}</strong>
                  <small>{p.codigo}</small>
                </td>
                <td>
                  <span className={`pv-type ${p.tipo === 'ELABORADO' ? 'pv-type-elaborado' : 'pv-type-reventa'}`}>
                    {p.tipo}
                  </span>
                </td>
                <td>{p.tipo === 'ELABORADO' ? moneda(p.costo_actual) : 'Manual'}</td>
                <td>
                  {p.tipo === 'ELABORADO' ? (
                    <div className="pv-percent">
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="0.01"
                        aria-label={`Recargo de ${p.nombre}`}
                        value={p.recargo_porcentaje}
                        onChange={(e) => cambiar(p.id_producto, 'recargo_porcentaje', e.target.value)}
                      />
                      <span>%</span>
                    </div>
                  ) : '—'}
                </td>
                <td className="pv-suggested">
                  {p.tipo === 'ELABORADO' ? moneda(p.precio_sugerido) : 'Manual'}
                </td>
                <td>
                  <div className="pv-price">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`Precio de venta de ${p.nombre}`}
                      value={p.precio_venta}
                      onChange={(e) => cambiar(p.id_producto, 'precio_venta', e.target.value)}
                    />
                  </div>
                </td>
                <td>
                  {p.tipo === 'REVENTA' ? (
                    <span className="pv-status pv-status-manual">Precio manual</span>
                  ) : p.estado_costo === 'SIN_COSTO' ? (
                    <span className="pv-status pv-status-missing" title={p.costo_error || ''}>Sin costo calculable</span>
                  ) : p.costo_modificado ? (
                    <span className="pv-status pv-status-warning">Costo cambiado: revisar</span>
                  ) : (
                    <span className="pv-status pv-status-ok">Costo revisado</span>
                  )}
                  {p.costo_error && <small className="pv-cost-error">{p.costo_error}</small>}
                </td>
                <td>
                  <input
                    aria-label={`Habilitar ${p.nombre} para la venta`}
                    type="checkbox"
                    checked={Boolean(p.habilitado_venta)}
                    onChange={(e) => cambiar(p.id_producto, 'habilitado_venta', e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Controlar stock de ${p.nombre}`}
                    type="checkbox"
                    checked={Boolean(p.controla_stock)}
                    onChange={(e) => cambiar(p.id_producto, 'controla_stock', e.target.checked)}
                  />
                </td>
                <td>
                  <div className="pv-actions">
                    <button
                      className="pv-save"
                      type="button"
                      disabled={guardando === p.id_producto}
                      onClick={() => guardar(p)}
                    >
                      {guardando === p.id_producto ? 'Guardando...' : 'Guardar'}
                    </button>

                    {p.tipo === 'ELABORADO' && p.costo_modificado && p.precio_sugerido !== null && (
                      <>
                        <button
                          className="pv-apply"
                          type="button"
                          disabled={guardando === p.id_producto}
                          onClick={() => guardar(p, {
                            precioVenta: p.precio_sugerido,
                            confirmarCostoActual: true,
                          })}
                        >
                          Aplicar sugerido
                        </button>
                        <button
                          className="pv-keep"
                          type="button"
                          disabled={guardando === p.id_producto}
                          onClick={() => guardar(p, {
                            precioVenta: p.precio_venta,
                            confirmarCostoActual: true,
                          })}
                        >
                          Mantener precio
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pv-note">
        En los elaborados, el costo y el precio sugerido se obtienen del cálculo de Costos y del recargo configurado. Si cambia el costo, el precio vigente no se modifica: queda una advertencia hasta que se aplique el sugerido o se confirme que se mantiene el precio actual. En REVENTA, el precio se carga manualmente. Los cambios de precio quedan registrados en el historial.
      </p>
    </section>
  )
}
