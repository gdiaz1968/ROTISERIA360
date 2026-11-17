import { useCallback, useEffect, useMemo, useState } from 'react'
import './SeguimientoComandas.css'

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
  if (!respuesta.ok) throw new Error(datos?.mensaje || `Error del servidor (${respuesta.status})`)
  return datos
}

const fechaHora = (valor) => valor
  ? new Date(valor).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  : '—'

const tiempoTranscurrido = (valor) => {
  if (!valor) return '—'
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(valor).getTime()) / 60000))
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

const estadoTexto = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  LISTA: 'Lista',
  ANULADA: 'Anulada',
}

const estadoPedidoTexto = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  LISTO_PARA_ENTREGAR: 'Listo para entregar',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
}

export default function SeguimientoComandas() {
  const [comandas, setComandas] = useState([])
  const [filtro, setFiltro] = useState('TODAS')
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [procesando, setProcesando] = useState(null)
  const [imprimiendo, setImprimiendo] = useState(null)
  const [vista, setVista] = useState('PREPARACION')
  const [subVista, setSubVista] = useState('MOSTRADOR')
  const [pedidosEntrega, setPedidosEntrega] = useState([])
  const [repartidores, setRepartidores] = useState([])
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState('')
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState([])
  const [nuevoRepartidor, setNuevoRepartidor] = useState({ nombre: '', telefono: '' })
  const [pagosEntrega, setPagosEntrega] = useState({})
  const [cargandoEntregas, setCargandoEntregas] = useState(false)

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    else setActualizando(true)
    try {
      const resultado = await api('/api/comandas')
      setComandas(Array.isArray(resultado.comandas) ? resultado.comandas : [])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
      setActualizando(false)
    }
  }, [])

  const cargarEntregas = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargandoEntregas(true)
    try {
      const [resultado, listaRepartidores] = await Promise.all([
        api('/api/entregas/pedidos'),
        api('/api/entregas/repartidores'),
      ])
      setPedidosEntrega(Array.isArray(resultado.pedidos) ? resultado.pedidos : [])
      setRepartidores(Array.isArray(listaRepartidores.repartidores) ? listaRepartidores.repartidores : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setCargandoEntregas(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    cargarEntregas()
    const intervalo = window.setInterval(() => {
      cargar(true)
      cargarEntregas(true)
    }, 5000)
    return () => window.clearInterval(intervalo)
  }, [cargar, cargarEntregas])

  useEffect(() => {
    const finalizarImpresion = () => {
      document.body.classList.remove('imprimiendo-comanda')
      setImprimiendo(null)
    }
    window.addEventListener('afterprint', finalizarImpresion)
    return () => {
      window.removeEventListener('afterprint', finalizarImpresion)
      document.body.classList.remove('imprimiendo-comanda')
    }
  }, [])

  const visibles = useMemo(() => filtro === 'TODAS'
    ? comandas
    : comandas.filter((comanda) => comanda.estado === filtro), [comandas, filtro])

  const contadores = useMemo(() => ({
    pendientes: comandas.filter((c) => c.estado === 'PENDIENTE').length,
    preparando: comandas.filter((c) => c.estado === 'EN_PREPARACION').length,
    listas: comandas.filter((c) => c.estado === 'LISTA').length,
  }), [comandas])

  async function cambiarEstado(comanda, estado) {
    setError('')
    setMensaje('')
    setProcesando(comanda.id)
    try {
      await api(`/api/comandas/${comanda.id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      })
      setMensaje(`La comanda #${comanda.numero_comanda} pasó a ${estadoTexto[estado].toLowerCase()}.`)
      await cargar(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setProcesando(null)
    }
  }

  async function imprimir(comanda) {
    setError('')
    setMensaje('')
    setProcesando(comanda.id)
    try {
      await api(`/api/comandas/${comanda.id}/imprimir`, { method: 'POST' })
      setMensaje(`Se registró la solicitud de impresión de la comanda #${comanda.numero_comanda}.`)
      setImprimiendo(comanda.id)
      document.body.classList.add('imprimiendo-comanda')
      window.setTimeout(() => window.print(), 120)
      await cargar(true)
    } catch (e) {
      document.body.classList.remove('imprimiendo-comanda')
      setImprimiendo(null)
      setError(e.message)
    } finally {
      setProcesando(null)
    }
  }

  async function agregarRepartidor(evento) {
    evento.preventDefault()
    setError('')
    try {
      await api('/api/entregas/repartidores', {
        method: 'POST',
        body: JSON.stringify(nuevoRepartidor),
      })
      setNuevoRepartidor({ nombre: '', telefono: '' })
      setMensaje('Repartidor registrado.')
      await cargarEntregas(true)
    } catch (e) {
      setError(e.message)
    }
  }

  function seleccionarPedido(id, marcado) {
    setPedidosSeleccionados((actual) => marcado
      ? [...new Set([...actual, id])]
      : actual.filter((item) => item !== id))
  }

  async function registrarSalida() {
    if (!repartidorSeleccionado || pedidosSeleccionados.length === 0) {
      setError('Seleccioná un repartidor y al menos un pedido.')
      return
    }
    setError('')
    try {
      const resultado = await api('/api/entregas/repartos', {
        method: 'POST',
        body: JSON.stringify({
          id_repartidor: Number(repartidorSeleccionado),
          ids_ventas: pedidosSeleccionados,
        }),
      })
      setMensaje(resultado.mensaje)
      setPedidosSeleccionados([])
      setRepartidorSeleccionado('')
      await cargarEntregas(true)
    } catch (e) {
      setError(e.message)
      await cargarEntregas(true)
    }
  }

  async function confirmarEntrega(pedido) {
    const pago = pagosEntrega[pedido.id] || { efectivo: '0', transferencia: '0' }
    setError('')
    try {
      const resultado = await api(`/api/entregas/${pedido.id}/confirmar`, {
        method: 'POST',
        body: JSON.stringify({
          efectivo: Number(pago.efectivo || 0),
          transferencia: Number(pago.transferencia || 0),
        }),
      })
      const r = resultado.rendicion
      setMensaje(`${resultado.mensaje} Esperado: ${moneda(r.esperado)} · Rendido: ${moneda(r.efectivo + r.transferencia)} · Diferencia: ${moneda(r.diferencia)}.`)
      await cargarEntregas(true)
      await cargar(true)
    } catch (e) {
      setError(e.message)
    }
  }

  function cambiarPagoEntrega(id, campo, valor) {
    setPagosEntrega((actual) => ({
      ...actual,
      [id]: { efectivo: '0', transferencia: '0', ...actual[id], [campo]: valor },
    }))
  }

  const pedidosMostrador = pedidosEntrega.filter((p) =>
    p.modalidad !== 'DELIVERY' && p.estado === 'LISTO_PARA_ENTREGAR')
  const deliveryListos = pedidosEntrega.filter((p) =>
    p.modalidad === 'DELIVERY' && p.estado === 'LISTO_PARA_ENTREGAR')
  const deliveryEnReparto = pedidosEntrega.filter((p) =>
    p.modalidad === 'DELIVERY' && p.estado === 'EN_REPARTO')
  const entregados = pedidosEntrega.filter((p) => p.estado === 'ENTREGADO')

  return (
    <section className="sc-page">
      <header className="sc-heading no-print">
        <div>
          <span className="sc-eyebrow">OPERACIÓN DE COCINA</span>
          <h2>Seguimiento de comandas</h2>
          <p>Visualizá los tickets y actualizá la preparación. La impresión siempre requiere autorización del operador.</p>
        </div>
        <button type="button" className="sc-refresh" onClick={() => cargar()} disabled={cargando}>
          {actualizando || cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error && <div className="sc-alert sc-error no-print" role="alert">{error}</div>}
      {mensaje && <div className="sc-alert sc-success no-print" role="status">{mensaje}</div>}

      <nav className="sc-main-tabs no-print">
        <button type="button" className={vista === 'PREPARACION' ? 'active' : ''} onClick={() => setVista('PREPARACION')}>PREPARACIÓN</button>
        <button type="button" className={vista === 'ENTREGAS' ? 'active' : ''} onClick={() => { setVista('ENTREGAS'); cargarEntregas(true) }}>ENTREGAS <span>{pedidosMostrador.length + deliveryListos.length + deliveryEnReparto.length}</span></button>
      </nav>

      {vista === 'PREPARACION' ? (
        <>
      <div className="sc-summary no-print">
        <article><strong>{contadores.pendientes}</strong><span>Pendientes</span></article>
        <article><strong>{contadores.preparando}</strong><span>En preparación</span></article>
        <article><strong>{contadores.listas}</strong><span>Listas</span></article>
      </div>

      <div className="sc-toolbar no-print">
        <label>
          Estado
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="TODAS">Todas las activas</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="EN_PREPARACION">En preparación</option>
            <option value="LISTA">Listas</option>
          </select>
        </label>
        <span>Actualización automática cada 5 segundos</span>
      </div>

      {cargando && <div className="sc-empty">Cargando comandas...</div>}
      {!cargando && visibles.length === 0 && (
        <div className="sc-empty">No hay comandas para mostrar con este filtro.</div>
      )}

      <div className="sc-grid">
        {visibles.map((comanda) => (
          <article
            className={`sc-ticket ${imprimiendo === comanda.id ? 'sc-ticket-printing' : ''}`}
            data-print={imprimiendo === comanda.id ? 'true' : 'false'}
            key={comanda.id}
          >
            <header className="sc-ticket-head">
              <div>
                <span>COMANDA #{comanda.numero_comanda}</span>
                <h3>{comanda.sector}</h3>
              </div>
              <span className={`sc-state sc-state-${comanda.estado.toLowerCase()}`}>{estadoTexto[comanda.estado] || comanda.estado}</span>
            </header>

            <div className="sc-ticket-meta">
              <strong>Pedido #{comanda.numero_pedido}</strong>
              <span>{comanda.modalidad}</span>
              <span className={`sc-state sc-order-state sc-state-${String(comanda.estado_pedido || 'PENDIENTE').toLowerCase()}`}>
                Pedido: {estadoPedidoTexto[comanda.estado_pedido] || comanda.estado_pedido || 'Pendiente'}
              </span>
              <span>Ingresó: {fechaHora(comanda.fecha_pedido)}</span>
              <span>Comanda: {fechaHora(comanda.fecha_alta)}</span>
              <strong className="sc-elapsed">Transcurrido: {tiempoTranscurrido(comanda.fecha_alta)}</strong>
            </div>

            <div className="sc-ticket-lines">
              {comanda.detalles.map((detalle) => (
                <div className="sc-ticket-line" key={detalle.id_venta_detalle}>
                  <strong>{Number(detalle.cantidad)} ×</strong>
                  <span>{detalle.producto}</span>
                  {detalle.observaciones && <small>{detalle.observaciones}</small>}
                </div>
              ))}
            </div>

            {comanda.observaciones_pedido && (
              <div className="sc-ticket-observations">
                <strong>Observaciones del pedido</strong>
                <p>{comanda.observaciones_pedido}</p>
              </div>
            )}

            <div className="sc-ticket-times">
              <span>Inicio: {fechaHora(comanda.fecha_inicio)}</span>
              <span>Lista: {fechaHora(comanda.fecha_lista)}</span>
            </div>

            <footer className="sc-ticket-actions no-print">
              {comanda.estado === 'PENDIENTE' && (
                <button type="button" onClick={() => cambiarEstado(comanda, 'EN_PREPARACION')} disabled={procesando === comanda.id}>
                  Iniciar preparación
                </button>
              )}
              {comanda.estado === 'EN_PREPARACION' && (
                <button type="button" onClick={() => cambiarEstado(comanda, 'LISTA')} disabled={procesando === comanda.id}>
                  Marcar lista
                </button>
              )}
              <button type="button" className="sc-print-button" onClick={() => imprimir(comanda)} disabled={procesando === comanda.id}>
                {comanda.fecha_impresion ? 'Reimprimir ticket' : 'Imprimir ticket'}
              </button>
            </footer>
            {comanda.fecha_impresion && (
              <div className="sc-print-note no-print">Última solicitud de impresión: {fechaHora(comanda.fecha_impresion)}</div>
            )}
          </article>
        ))}
      </div>
        </>
      ) : (
        <section className="sc-delivery no-print">
          <div className="sc-delivery-head">
            <div><span className="sc-eyebrow">DESPACHO Y RETIRO</span><h3>Gestión de entregas</h3><p>Los pedidos aparecen aquí cuando todas sus comandas están listas.</p></div>
            <button type="button" className="sc-refresh" onClick={() => cargarEntregas()} disabled={cargandoEntregas}>{cargandoEntregas ? 'Actualizando...' : 'Actualizar'}</button>
          </div>
          <nav className="sc-sub-tabs">
            <button type="button" className={subVista === 'MOSTRADOR' ? 'active' : ''} onClick={() => setSubVista('MOSTRADOR')}>MOSTRADOR ({pedidosMostrador.length})</button>
            <button type="button" className={subVista === 'DELIVERY' ? 'active' : ''} onClick={() => setSubVista('DELIVERY')}>DELIVERY ({deliveryListos.length + deliveryEnReparto.length})</button>
            <button type="button" className={subVista === 'HISTORIAL' ? 'active' : ''} onClick={() => setSubVista('HISTORIAL')}>ENTREGADOS ({entregados.length})</button>
          </nav>

          {subVista === 'MOSTRADOR' && (
            <div className="sc-delivery-grid">
              {pedidosMostrador.length === 0 && <div className="sc-empty">No hay pedidos de mostrador listos para retirar.</div>}
              {pedidosMostrador.map((pedido) => {
                const pago = pagosEntrega[pedido.id] || { efectivo: '0', transferencia: '0' }
                return <article className="sc-delivery-card" key={pedido.id}>
                  <header><div><span>PEDIDO</span><h4>#{pedido.numero}</h4></div><strong>{moneda(pedido.total)}</strong></header>
                  <p>{pedido.cliente || 'Consumidor final'} · {pedido.modalidad}</p>
                  <div className="sc-delivery-lines">{pedido.detalles.map((d, i) => <div key={i}>{Number(d.cantidad)} × {d.producto}</div>)}</div>
                  <div className="sc-delivery-balance">Saldo pendiente: <strong>{moneda(pedido.pendiente)}</strong></div>
                  <div className="sc-delivery-payments">
                    <label>Efectivo<input type="number" min="0" step="0.01" value={pago.efectivo} onChange={(e) => cambiarPagoEntrega(pedido.id, 'efectivo', e.target.value)} /></label>
                    <label>Transferencia<input type="number" min="0" step="0.01" value={pago.transferencia} onChange={(e) => cambiarPagoEntrega(pedido.id, 'transferencia', e.target.value)} /></label>
                  </div>
                  <button type="button" onClick={() => confirmarEntrega(pedido)}>Confirmar retiro y rendición</button>
                </article>
              })}
            </div>
          )}

          {subVista === 'DELIVERY' && (
            <div className="sc-delivery-content">
              <section className="sc-delivery-panel">
                <h4>Pedidos listos para salir</h4>
                {deliveryListos.length === 0 && <p className="sc-muted">No hay pedidos delivery pendientes de salida.</p>}
                {deliveryListos.map((pedido) => (
                  <label className="sc-dispatch-row" key={pedido.id}>
                    <input type="checkbox" checked={pedidosSeleccionados.includes(pedido.id)} onChange={(e) => seleccionarPedido(pedido.id, e.target.checked)} />
                    <span><strong>Pedido #{pedido.numero} · {pedido.cliente || 'Consumidor final'}</strong><small>{pedido.direccion_entrega || ''}, {pedido.localidad_entrega || ''} · {moneda(pedido.total)}</small></span>
                  </label>
                ))}
                <div className="sc-dispatch-form">
                  <label>Repartidor<select value={repartidorSeleccionado} onChange={(e) => setRepartidorSeleccionado(e.target.value)}><option value="">Seleccionar...</option>{repartidores.map((r) => <option key={r.id} value={r.id}>{r.nombre}{r.telefono ? ` · ${r.telefono}` : ''}</option>)}</select></label>
                  <button type="button" onClick={registrarSalida} disabled={!pedidosSeleccionados.length || !repartidorSeleccionado}>Registrar salida ({pedidosSeleccionados.length})</button>
                </div>
              </section>

              <section className="sc-delivery-panel">
                <h4>Pedidos en reparto</h4>
                {deliveryEnReparto.length === 0 && <p className="sc-muted">No hay pedidos en reparto.</p>}
                {deliveryEnReparto.map((pedido) => {
                  const pago = pagosEntrega[pedido.id] || { efectivo: '0', transferencia: '0' }
                  return <article className="sc-delivery-card" key={pedido.id}>
                    <header><div><span>PEDIDO #{pedido.numero}</span><h4>{pedido.repartidor || 'Repartidor'}</h4></div><strong>{moneda(pedido.total)}</strong></header>
                    <p>{pedido.cliente || 'Consumidor final'} · {pedido.direccion_entrega || ''}, {pedido.localidad_entrega || ''}</p>
                    <small>Salida: {fechaHora(pedido.fecha_salida)}</small>
                    <div className="sc-delivery-lines">{pedido.detalles.map((d, i) => <div key={i}>{Number(d.cantidad)} × {d.producto}</div>)}</div>
                    <div className="sc-delivery-balance">Saldo esperado: <strong>{moneda(pedido.pendiente)}</strong></div>
                    <div className="sc-delivery-payments">
                      <label>Efectivo<input type="number" min="0" step="0.01" value={pago.efectivo} onChange={(e) => cambiarPagoEntrega(pedido.id, 'efectivo', e.target.value)} /></label>
                      <label>Transferencia<input type="number" min="0" step="0.01" value={pago.transferencia} onChange={(e) => cambiarPagoEntrega(pedido.id, 'transferencia', e.target.value)} /></label>
                    </div>
                    <button type="button" onClick={() => confirmarEntrega(pedido)}>Confirmar entrega y rendición</button>
                  </article>
                })}
              </section>

              <section className="sc-delivery-panel">
                <h4>Administrar repartidores</h4>
                <form className="sc-rider-form" onSubmit={agregarRepartidor}>
                  <label>Nombre<input required value={nuevoRepartidor.nombre} onChange={(e) => setNuevoRepartidor((v) => ({ ...v, nombre: e.target.value }))} placeholder="Nombre del repartidor" /></label>
                  <label>Teléfono<input value={nuevoRepartidor.telefono} onChange={(e) => setNuevoRepartidor((v) => ({ ...v, telefono: e.target.value }))} placeholder="Teléfono (opcional)" /></label>
                  <button type="submit">Agregar repartidor</button>
                </form>
                <div className="sc-rider-list">{repartidores.map((r) => <span key={r.id}>{r.nombre}{r.telefono ? ` · ${r.telefono}` : ''}</span>)}</div>
              </section>
            </div>
          )}

          {subVista === 'HISTORIAL' && (
            <div className="sc-delivery-grid">
              {entregados.length === 0 && <div className="sc-empty">Todavía no hay pedidos entregados en el historial reciente.</div>}
              {entregados.map((pedido) => <article className="sc-delivery-card" key={pedido.id}>
                <header><div><span>PEDIDO ENTREGADO</span><h4>#{pedido.numero}</h4></div><strong>{moneda(pedido.total)}</strong></header>
                <p>{pedido.cliente || 'Consumidor final'} · {pedido.modalidad} · {fechaHora(pedido.fecha_entrega)}</p>
                {pedido.rendicion_esperada !== null && pedido.rendicion_esperada !== undefined && <div className="sc-delivery-balance">Esperado: {moneda(pedido.rendicion_esperada)} · Efectivo: {moneda(pedido.rendicion_efectivo)} · Transferencia: {moneda(pedido.rendicion_transferencia)} · Diferencia: <strong>{moneda(pedido.rendicion_diferencia)}</strong></div>}
              </article>)}
            </div>
          )}
        </section>
      )}
    </section>
  )
}
