import { useCallback, useEffect, useMemo, useState } from 'react'
import './Ventas.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

const mediosPago = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'QR', 'OTRO']

const moneda = (valor) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0))

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

const pagoVacio = { medio_pago: 'EFECTIVO', importe: '' }

export default function Ventas() {
  const [productos, setProductos] = useState([])
  const [productosSinSector, setProductosSinSector] = useState(0)
  const [ventas, setVentas] = useState([])
  const [carrito, setCarrito] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [canal, setCanal] = useState('MOSTRADOR')
  const [modalidad, setModalidad] = useState('MOSTRADOR')
  const [cliente, setCliente] = useState({ nombre: '', telefono: '' })
  const [direccion, setDireccion] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [referencia, setReferencia] = useState('')
  const [fechaProgramada, setFechaProgramada] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [pagos, setPagos] = useState([])
  const [nuevoPago, setNuevoPago] = useState(pagoVacio)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [comandasGeneradas, setComandasGeneradas] = useState([])
  const [modalComandasAbierto, setModalComandasAbierto] = useState(false)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const [catalogo, recientes] = await Promise.all([
        api('/api/productos-venta?pagina=1&limite=100'),
        api('/api/ventas'),
      ])
      const habilitados = (catalogo.productos || []).filter((p) =>
        p.habilitado_venta && p.configuracion_activa !== false && Number(p.precio_venta) >= 0
      )
      setProductos(habilitados)
      setProductosSinSector(habilitados.filter((p) => !p.id_sector).length)
      setVentas(Array.isArray(recientes.ventas) ? recientes.ventas : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  useEffect(() => {
    const actualizarEstados = async () => {
      try {
        const resultado = await api('/api/ventas')
        setVentas(Array.isArray(resultado.ventas) ? resultado.ventas : [])
      } catch (e) {
        setError(e.message)
      }
    }
    const intervalo = window.setInterval(actualizarEstados, 5000)
    return () => window.clearInterval(intervalo)
  }, [])

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    if (!termino) return productos
    return productos.filter((p) =>
      `${p.codigo} ${p.nombre}`.toLocaleLowerCase('es').includes(termino)
    )
  }, [productos, busqueda])

  const total = useMemo(
    () => Math.round((carrito.reduce((suma, item) => suma + item.cantidad * item.precio, 0) + Number.EPSILON) * 100) / 100,
    [carrito],
  )
  const totalPagado = useMemo(
    () => Math.round((pagos.reduce((suma, pago) => suma + Number(pago.importe), 0) + Number.EPSILON) * 100) / 100,
    [pagos],
  )
  const saldo = Math.max(0, Math.round((total - totalPagado + Number.EPSILON) * 100) / 100)

  function agregarProducto(producto) {
    setError('')
    setCarrito((actual) => {
      const existente = actual.find((item) => item.id_producto === producto.id_producto)
      if (existente) {
        return actual.map((item) => item.id_producto === producto.id_producto
          ? { ...item, cantidad: item.cantidad + 1 }
          : item)
      }
      return [...actual, {
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        tipo: producto.tipo,
        precio: Number(producto.precio_venta),
        cantidad: 1,
      }]
    })
  }

  function cambiarCantidad(id, valor) {
    const cantidad = Number(valor)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setCarrito((actual) => actual.filter((item) => item.id_producto !== id))
      return
    }
    setCarrito((actual) => actual.map((item) =>
      item.id_producto === id ? { ...item, cantidad } : item
    ))
  }

  function agregarPago() {
    const importe = Number(nuevoPago.importe)
    if (!Number.isFinite(importe) || importe <= 0) {
      setError('Ingresá un importe de pago mayor a cero.')
      return
    }
    if (importe - saldo > 0.009) {
      setError('El pago supera el saldo pendiente del pedido.')
      return
    }
    setPagos((actual) => [...actual, { medio_pago: nuevoPago.medio_pago, importe }])
    setNuevoPago(pagoVacio)
    setError('')
  }

  function limpiarPedido() {
    setCarrito([])
    setCliente({ nombre: '', telefono: '' })
    setDireccion('')
    setLocalidad('')
    setReferencia('')
    setFechaProgramada('')
    setObservaciones('')
    setPagos([])
    setNuevoPago(pagoVacio)
    setCanal('MOSTRADOR')
    setModalidad('MOSTRADOR')
  }

  async function registrarPedido(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    if (!carrito.length) {
      setError('Agregá productos antes de registrar el pedido.')
      return
    }
    if (totalPagado - total > 0.009) {
      setError('El importe cobrado supera el total.')
      return
    }

    setGuardando(true)
    try {
      const resultado = await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          canal,
          modalidad,
          cliente,
          direccion_entrega: direccion,
          localidad_entrega: localidad,
          referencia_entrega: referencia,
          fecha_entrega_programada: fechaProgramada
            ? new Date(fechaProgramada).toISOString()
            : null,
          observaciones,
          detalles: carrito.map((item) => ({
            id_producto: item.id_producto,
            cantidad: item.cantidad,
          })),
          pagos,
        }),
      })
      const venta = resultado.venta
      setComandasGeneradas(Array.isArray(resultado.comandas) ? resultado.comandas : [])
      setModalComandasAbierto(false)
      setMensaje(`Pedido #${venta.numero} registrado. Total: ${moneda(venta.total)}. Cobrado: ${moneda(venta.pagado)}. Pendiente: ${moneda(venta.pendiente)}.`)
      limpiarPedido()
      await cargarDatos()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="ventas-page">
      <div className="ventas-heading">
        <div>
          <span className="ventas-eyebrow">OPERACIÓN COMERCIAL</span>
          <h2>VENTAS</h2>
          <p>Tomá el pedido, definí cómo se entrega y registrá el cobro.</p>
        </div>
        <button type="button" className="ventas-secondary" onClick={cargarDatos} disabled={cargando}>
          Actualizar catálogo
        </button>
      </div>

      {error && <div className="ventas-alert ventas-error" role="alert">{error}</div>}
      {productosSinSector > 0 && (
        <div className="ventas-alert ventas-warning" role="status">
          Hay {productosSinSector} producto(s) habilitado(s) sin sector asignado. Configuralos en Productos para la venta para poder generar sus comandas.
        </div>
      )}
      {mensaje && (
        <div className="ventas-alert ventas-success ventas-success-row" role="status">
          <span>{mensaje}</span>
          {comandasGeneradas.length > 0 && (
            <button type="button" className="ventas-view-comandas" onClick={() => setModalComandasAbierto(true)}>
              Ver {comandasGeneradas.length} comandas
            </button>
          )}
        </div>
      )}

      <form className="ventas-layout" onSubmit={registrarPedido}>
        <div className="ventas-main-column">
          <section className="ventas-panel">
            <div className="ventas-panel-title">
              <div>
                <h3>1. Productos del pedido</h3>
                <p>Seleccioná los productos habilitados para la venta.</p>
              </div>
              <span className="ventas-count">{carrito.length} ítems</span>
            </div>
            <label className="ventas-search">
              <span>Buscar por código o nombre</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej.: muzzarella, empanada..."
              />
            </label>
            <div className="ventas-product-grid">
              {cargando && <div className="ventas-empty">Cargando productos...</div>}
              {!cargando && productosFiltrados.length === 0 && (
                <div className="ventas-empty">
                  {productos.length ? 'No hay coincidencias.' : 'No hay productos habilitados. Revisá Productos para la venta.'}
                </div>
              )}
              {!cargando && productosFiltrados.map((producto) => (
                <button
                  type="button"
                  className="ventas-product-card"
                  key={producto.id_producto}
                  disabled={!producto.id_sector}
                  onClick={() => agregarProducto(producto)}
                >
                  <span className="ventas-product-type">{producto.tipo}</span>
                  <strong>{producto.nombre}</strong>
                  <small>{producto.codigo}</small>
                  <b>{moneda(producto.precio_venta)}</b>
                  <span className="ventas-add">{producto.id_sector ? '+ Agregar' : 'Asignar sector en Productos para la venta'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ventas-panel">
            <div className="ventas-panel-title">
              <div>
                <h3>2. Detalle del pedido</h3>
                <p>Podés corregir cantidades antes de confirmar.</p>
              </div>
            </div>
            <div className="ventas-cart-wrap">
              <table className="ventas-cart">
                <thead>
                  <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th></th></tr>
                </thead>
                <tbody>
                  {carrito.length === 0 && (
                    <tr><td colSpan="5" className="ventas-empty">Todavía no agregaste productos.</td></tr>
                  )}
                  {carrito.map((item) => (
                    <tr key={item.id_producto}>
                      <td><strong>{item.nombre}</strong><small>{item.codigo}</small></td>
                      <td>
                        <input
                          className="ventas-quantity"
                          aria-label={`Cantidad de ${item.nombre}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.cantidad}
                          onChange={(e) => cambiarCantidad(item.id_producto, e.target.value)}
                        />
                      </td>
                      <td>{moneda(item.precio)}</td>
                      <td><strong>{moneda(item.cantidad * item.precio)}</strong></td>
                      <td>
                        <button
                          type="button"
                          className="ventas-remove"
                          onClick={() => setCarrito((actual) => actual.filter((p) => p.id_producto !== item.id_producto))}
                          aria-label={`Quitar ${item.nombre}`}
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ventas-total-line">
              <span>TOTAL DEL PEDIDO</span>
              <strong>{moneda(total)}</strong>
            </div>
          </section>
        </div>

        <aside className="ventas-side-column">
          <section className="ventas-panel">
            <h3>3. Datos del pedido</h3>
            <div className="ventas-form-grid">
              <label>
                <span>Canal de ingreso</span>
                <select value={canal} onChange={(e) => setCanal(e.target.value)}>
                  <option value="MOSTRADOR">Mostrador</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TELEFONO">Teléfono</option>
                </select>
              </label>
              <label>
                <span>Modalidad</span>
                <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                  <option value="MOSTRADOR">Venta en mostrador</option>
                  <option value="RETIRO">Retira el cliente</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </label>
            </div>
            <div className="ventas-form-grid">
              <label>
                <span>Cliente (opcional)</span>
                <input value={cliente.nombre} onChange={(e) => setCliente((c) => ({ ...c, nombre: e.target.value }))} placeholder="Nombre y apellido" />
              </label>
              <label>
                <span>Teléfono</span>
                <input value={cliente.telefono} onChange={(e) => setCliente((c) => ({ ...c, telefono: e.target.value }))} placeholder="Teléfono de contacto" />
              </label>
            </div>
            {modalidad === 'DELIVERY' && (
              <>
                <label className="ventas-field">
                  <span>Dirección de entrega *</span>
                  <input required value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, piso..." />
                </label>
                <div className="ventas-form-grid">
                  <label>
                    <span>Localidad</span>
                    <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
                  </label>
                  <label>
                    <span>Referencia</span>
                    <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Entre calles, timbre..." />
                  </label>
                </div>
              </>
            )}
            <label className="ventas-field">
              <span>Entrega programada (opcional)</span>
              <input type="datetime-local" value={fechaProgramada} onChange={(e) => setFechaProgramada(e.target.value)} />
            </label>
            <label className="ventas-field">
              <span>Observaciones del pedido</span>
              <textarea rows="2" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Indicaciones para preparar o entregar..." />
            </label>
          </section>

          <section className="ventas-panel">
            <h3>4. Cobro</h3>
            <div className="ventas-payment-summary">
              <div><span>Total</span><strong>{moneda(total)}</strong></div>
              <div><span>Registrado</span><strong>{moneda(totalPagado)}</strong></div>
              <div className="ventas-balance"><span>Saldo pendiente</span><strong>{moneda(saldo)}</strong></div>
            </div>
            <div className="ventas-add-payment">
              <label>
                <span>Medio de pago</span>
                <select value={nuevoPago.medio_pago} onChange={(e) => setNuevoPago((p) => ({ ...p, medio_pago: e.target.value }))}>
                  {mediosPago.map((medio) => <option key={medio} value={medio}>{medio.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label>
                <span>Importe</span>
                <input
                  type="number"
                  min="0.01"
                  max={saldo}
                  step="0.01"
                  value={nuevoPago.importe}
                  onChange={(e) => setNuevoPago((p) => ({ ...p, importe: e.target.value }))}
                  placeholder="0,00"
                />
              </label>
              <button type="button" className="ventas-add-payment-button" onClick={agregarPago} disabled={saldo <= 0}>Agregar pago</button>
              <button
                type="button"
                className="ventas-fill-payment"
                onClick={() => setNuevoPago((p) => ({ ...p, importe: saldo.toFixed(2) }))}
                disabled={saldo <= 0}
              >Completar saldo</button>
            </div>
            {pagos.length > 0 && (
              <div className="ventas-payment-list">
                {pagos.map((pago, index) => (
                  <div key={index}>
                    <span>{pago.medio_pago} · {moneda(pago.importe)}</span>
                    <button type="button" onClick={() => setPagos((actual) => actual.filter((_, i) => i !== index))}>Quitar</button>
                  </div>
                ))}
              </div>
            )}
            <p className="ventas-payment-note">Podés registrar un pago parcial, combinar medios de pago o guardar el pedido sin cobrar.</p>
            <button type="submit" className="ventas-submit" disabled={guardando || carrito.length === 0}>
              {guardando ? 'Registrando pedido...' : 'REGISTRAR PEDIDO'}
            </button>
            <button type="button" className="ventas-clear" onClick={limpiarPedido} disabled={guardando}>Limpiar pedido</button>
          </section>
        </aside>
      </form>

      <section className="ventas-panel ventas-recent">
        <div className="ventas-panel-title">
          <div><h3>Últimos pedidos registrados</h3><p>Los pedidos nuevos aparecen primero.</p></div>
          <button type="button" className="ventas-secondary" onClick={cargarDatos} disabled={cargando}>Actualizar</button>
        </div>
        <div className="ventas-cart-wrap">
          <table className="ventas-cart">
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Canal</th><th>Entrega</th><th>Estado</th><th>Cliente</th><th>Total</th><th>Pagado</th><th>Pendiente</th></tr></thead>
            <tbody>
              {ventas.length === 0 && <tr><td colSpan="9" className="ventas-empty">Todavía no hay pedidos registrados.</td></tr>}
              {ventas.map((venta) => (
                <tr key={venta.id}>
                  <td><strong>#{venta.numero}</strong></td>
                  <td>{new Date(venta.fecha).toLocaleString('es-AR')}</td>
                  <td>{venta.canal}</td>
                  <td>{venta.modalidad}</td>
                  <td><span className={`ventas-order-state ventas-order-state-${String(venta.estado || 'PENDIENTE').toLowerCase()}`}>{({
                    PENDIENTE: 'Pendiente',
                    EN_PREPARACION: 'En preparación',
                    LISTO_PARA_ENTREGAR: 'Listo para entregar',
                    EN_REPARTO: 'En reparto',
                    ENTREGADO: 'Entregado',
                    ANULADO: 'Anulado',
                  })[venta.estado] || venta.estado || 'Pendiente'}</span></td>
                  <td>{venta.cliente || 'Consumidor final'}</td>
                  <td>{moneda(venta.total)}</td>
                  <td>{moneda(venta.pagado)}</td>
                  <td>{moneda(venta.pendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalComandasAbierto && (
        <div className="ventas-comandas-overlay" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setModalComandasAbierto(false)
        }}>
          <section className="ventas-comandas-modal" role="dialog" aria-modal="true" aria-labelledby="ventas-comandas-title">
            <div className="ventas-comandas-modal-head">
              <div>
                <span className="ventas-eyebrow">PEDIDO CONFIRMADO</span>
                <h3 id="ventas-comandas-title">Comandas generadas</h3>
                <p>Los tickets están disponibles para el operador de comandas. No se imprimieron.</p>
              </div>
              <button type="button" className="ventas-comandas-close" onClick={() => setModalComandasAbierto(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="ventas-comandas-list">
              {comandasGeneradas.map((comanda) => (
                <article className="ventas-comanda-ticket" key={comanda.id}>
                  <div className="ventas-comanda-ticket-head">
                    <strong>COMANDA #{comanda.numero_comanda}</strong>
                    <span>{comanda.sector}</span>
                  </div>
                  <div className="ventas-comanda-pedido">Pedido #{comandasGeneradas[0]?.numero_pedido || ''}</div>
                  {comanda.detalles.map((detalle, index) => (
                    <div className="ventas-comanda-line" key={index}>
                      <strong>{Number(detalle.cantidad)} ×</strong>
                      <span>{detalle.producto}</span>
                      {detalle.observaciones && <small>{detalle.observaciones}</small>}
                    </div>
                  ))}
                  <div className="ventas-comanda-status">Pendiente de revisión e impresión autorizada</div>
                </article>
              ))}
            </div>
            <div className="ventas-comandas-modal-actions">
              <button type="button" className="ventas-secondary" onClick={() => setModalComandasAbierto(false)}>Cerrar</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
