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

const moneda = (valor) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(valor || 0))

// Convierte importes escritos en formato argentino (3.500,00 o 3.500)
// o decimal internacional (3500.00) a centavos enteros.
const importeEnCentavos = (valor) => {
  let texto = String(valor ?? '0').trim().replace(/\s/g, '').replace(/^\$/, '')
  if (!texto) return 0

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else if ((texto.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(texto)) {
    texto = texto.replace(/\./g, '')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null
  const numero = Number(texto)
  return Number.isFinite(numero) ? Math.round((numero + Number.EPSILON) * 100) : null
}

const evaluarPagoEntrega = (pago, pendiente) => {
  const efectivoCentavos = importeEnCentavos(pago?.efectivo ?? '0')
  const transferenciaCentavos = importeEnCentavos(pago?.transferencia ?? '0')
  const saldoCentavos = importeEnCentavos(pendiente)

  if ([efectivoCentavos, transferenciaCentavos, saldoCentavos].some((n) => n === null) ||
      efectivoCentavos < 0 || transferenciaCentavos < 0 || saldoCentavos < 0) {
    return { valido: false, mensaje: 'Ingresá importes válidos, iguales o mayores a cero.' }
  }

  const totalCentavos = efectivoCentavos + transferenciaCentavos
  if (totalCentavos < saldoCentavos) {
    return {
      valido: false,
      mensaje: `Faltan cobrar ${moneda((saldoCentavos - totalCentavos) / 100)}.`,
    }
  }
  if (totalCentavos > saldoCentavos) {
    return {
      valido: false,
      mensaje: `El importe ingresado supera el saldo en ${moneda((totalCentavos - saldoCentavos) / 100)}.`,
    }
  }
  return { valido: true, mensaje: 'Importe correcto. Se puede confirmar la entrega.' }
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
  const [anulacionAbierta, setAnulacionAbierta] = useState(false)
  const [comandaAnular, setComandaAnular] = useState(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [operadorAnulacion, setOperadorAnulacion] = useState('')
  const [revisionAnulacion, setRevisionAnulacion] = useState(null)
  const [cargandoRevision, setCargandoRevision] = useState(false)
  const [confirmandoAnulacion, setConfirmandoAnulacion] = useState(false)

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
    ? comandas.filter((comanda) => comanda.estado !== 'ANULADA')
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

  function abrirAnulacion(comanda) {
    setError('')
    setMensaje('')
    setComandaAnular(comanda)
    setMotivoAnulacion('')
    setOperadorAnulacion('')
    setRevisionAnulacion(null)
    setAnulacionAbierta(true)
  }

  function cerrarAnulacion() {
    if (cargandoRevision || confirmandoAnulacion) return
    setAnulacionAbierta(false)
    setComandaAnular(null)
    setRevisionAnulacion(null)
  }

  async function revisarImpactoAnulacion() {
    if (!motivoAnulacion.trim()) {
      setError('Ingresá el motivo de anulación.')
      return
    }
    if (!operadorAnulacion.trim()) {
      setError('Ingresá el nombre del operador que realiza la anulación.')
      return
    }
    setError('')
    setCargandoRevision(true)
    try {
      const resultado = await api(`/api/comandas/${comandaAnular.id}/anulacion/preview`)
      setRevisionAnulacion(resultado)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargandoRevision(false)
    }
  }

  async function confirmarAnulacion() {
    if (!revisionAnulacion?.puede_confirmar || !comandaAnular) return
    setError('')
    setConfirmandoAnulacion(true)
    try {
      const resultado = await api(`/api/comandas/${comandaAnular.id}/anulacion`, {
        method: 'POST',
        body: JSON.stringify({
          motivo: motivoAnulacion.trim(),
          usuario: operadorAnulacion.trim(),
          total_esperado: revisionAnulacion.resumen.nuevo_total,
        }),
      })
      setMensaje(`${resultado.mensaje} Nuevo total: ${moneda(resultado.pedido.total_nuevo)} · Pagado: ${moneda(resultado.pedido.pagado)} · Saldo: ${moneda(resultado.pedido.pendiente)}.`)
      setAnulacionAbierta(false)
      setComandaAnular(null)
      setRevisionAnulacion(null)
      await cargar(true)
      await cargarEntregas(true)
    } catch (e) {
      setError(e.message)
      setRevisionAnulacion(null)
    } finally {
      setConfirmandoAnulacion(false)
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
          efectivo: importeEnCentavos(pago.efectivo || '0') / 100,
          transferencia: importeEnCentavos(pago.transferencia || '0') / 100,
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
    setMensaje('')
    setError('')
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
            <option value="ANULADA">Anuladas</option>
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
                <div className={`sc-ticket-line ${detalle.estado === 'ANULADO' ? 'sc-ticket-line-cancelled' : ''}`} key={detalle.id_venta_detalle}>
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
            {comanda.estado === 'ANULADA' && (
              <div className="sc-cancel-note">
                <strong>Comanda anulada</strong>
                <span>Fecha: {fechaHora(comanda.fecha_anulacion)}</span>
                <span>Operador: {comanda.usuario_anulacion || 'No informado'}</span>
                <span>Motivo: {comanda.motivo_anulacion || 'Sin motivo registrado'}</span>
              </div>
            )}

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
              {comanda.estado !== 'ANULADA' && !['EN_REPARTO', 'ENTREGADO', 'ANULADO'].includes(comanda.estado_pedido) && (
                <button type="button" className="sc-cancel-button" onClick={() => abrirAnulacion(comanda)} disabled={procesando === comanda.id}>
                  Anular comanda
                </button>
              )}
              {comanda.estado !== 'ANULADA' && (
                <button type="button" className="sc-print-button" onClick={() => imprimir(comanda)} disabled={procesando === comanda.id}>
                  {comanda.fecha_impresion ? 'Reimprimir ticket' : 'Imprimir ticket'}
                </button>
              )}
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
                const validacionPago = evaluarPagoEntrega(pago, pedido.pendiente)
                return <article className="sc-delivery-card" key={pedido.id}>
                  <header><div><span>PEDIDO</span><h4>#{pedido.numero}</h4></div><strong>{moneda(pedido.total)}</strong></header>
                  <p>{pedido.cliente || 'Consumidor final'} · {pedido.modalidad}</p>
                  <div className="sc-delivery-lines">{pedido.detalles.map((d, i) => <div key={i}>{Number(d.cantidad)} × {d.producto}</div>)}</div>
                  <div className="sc-delivery-balance">Saldo pendiente: <strong>{moneda(pedido.pendiente)}</strong></div>
                  <div className="sc-delivery-payments">
                    <label>Efectivo<input type="number" min="0" step="0.01" value={pago.efectivo} onChange={(e) => cambiarPagoEntrega(pedido.id, 'efectivo', e.target.value)} /></label>
                    <label>Transferencia<input type="number" min="0" step="0.01" value={pago.transferencia} onChange={(e) => cambiarPagoEntrega(pedido.id, 'transferencia', e.target.value)} /></label>
                  </div>
                  <small className={`sc-muted ${validacionPago.valido ? 'sc-payment-ok' : 'sc-payment-error'}`}>{validacionPago.mensaje}</small>
                  <button type="button" onClick={() => confirmarEntrega(pedido)} disabled={!validacionPago.valido}>Confirmar retiro y rendición</button>
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
                  const validacionPago = evaluarPagoEntrega(pago, pedido.pendiente)
                  return <article className="sc-delivery-card" key={pedido.id}>
                    <header><div><span>PEDIDO #{pedido.numero}</span><h4>{pedido.repartidor || 'Repartidor'}</h4></div><strong>{moneda(pedido.total)}</strong></header>
                    <p>{pedido.cliente || 'Consumidor final'} · {pedido.direccion_entrega || ''}, {pedido.localidad_entrega || ''}</p>
                    <small>Salida: {fechaHora(pedido.fecha_salida)}</small>
                    <div className="sc-delivery-lines">{pedido.detalles.map((d, i) => <div key={i}>{Number(d.cantidad)} × {d.producto}</div>)}</div>
                    <div className="sc-delivery-balance">
                      <div>Total del pedido: <strong>{moneda(pedido.total)}</strong></div>
                      <div>Ya cobrado en Ventas: <strong>{moneda(pedido.pagado)}</strong></div>
                      <div>Saldo que debe cobrar el repartidor: <strong>{moneda(pedido.pendiente)}</strong></div>
                    </div>
                    <div className="sc-delivery-payments">
                      <label>Efectivo<input type="text" inputMode="decimal" placeholder="0,00" value={pago.efectivo} onChange={(e) => cambiarPagoEntrega(pedido.id, 'efectivo', e.target.value)} /></label>
                      <label>Transferencia<input type="text" inputMode="decimal" placeholder="0,00" value={pago.transferencia} onChange={(e) => cambiarPagoEntrega(pedido.id, 'transferencia', e.target.value)} /></label>
                    </div>
                    <small className="sc-muted">Podés ingresar, por ejemplo, 3.500 o 3.500,00. El anticipo registrado en Ventas ya está descontado.</small>
                    <small className={`sc-muted ${validacionPago.valido ? 'sc-payment-ok' : 'sc-payment-error'}`}>{validacionPago.mensaje}</small>
                    <button type="button" onClick={() => confirmarEntrega(pedido)} disabled={!validacionPago.valido}>Confirmar entrega y rendición</button>
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
      {anulacionAbierta && comandaAnular && (
        <div className="sc-modal-overlay" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) cerrarAnulacion()
        }}>
          <section className="sc-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="sc-cancel-title">
            <header className="sc-cancel-modal-head">
              <div>
                <span className="sc-eyebrow">PEDIDO #{comandaAnular.numero_pedido}</span>
                <h3 id="sc-cancel-title">Anular comanda #{comandaAnular.numero_comanda}</h3>
                <p>Se anulará únicamente esta comanda. Las demás comandas del pedido seguirán su circuito.</p>
              </div>
              <button type="button" onClick={cerrarAnulacion} disabled={cargandoRevision || confirmandoAnulacion} aria-label="Cerrar">×</button>
            </header>

            {!revisionAnulacion ? (
              <div className="sc-cancel-form">
                <div className="sc-cancel-info">
                  <strong>Antes de continuar</strong>
                  <p>La comanda dejará de prepararse. En el siguiente paso vas a revisar qué productos se quitarán de la venta y cómo quedarán el total y el saldo. No se borrarán pagos ni registros históricos.</p>
                </div>
                <label>Motivo de anulación *
                  <textarea rows="3" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} maxLength={1000} placeholder="Ej.: se agregó un producto por error." />
                </label>
                <label>Nombre del operador *
                  <input value={operadorAnulacion} onChange={(e) => setOperadorAnulacion(e.target.value)} maxLength={120} placeholder="Quién realiza la operación" />
                </label>
                <small>El nombre se registra como dato declarado por el operador. Actualmente ROTISERIA360 no tiene autenticación individual para verificar su identidad.</small>
                <div className="sc-cancel-actions">
                  <button type="button" className="sc-secondary-button" onClick={cerrarAnulacion} disabled={cargandoRevision}>Cancelar</button>
                  <button type="button" className="sc-danger-button" onClick={revisarImpactoAnulacion} disabled={cargandoRevision || !motivoAnulacion.trim() || !operadorAnulacion.trim()}>
                    {cargandoRevision ? 'Calculando...' : 'Revisar impacto económico'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="sc-cancel-review">
                <div className="sc-cancel-info">
                  <strong>Revisión del pedido #{revisionAnulacion.pedido.numero}</strong>
                  <p>Estos productos se quitarán del detalle comercial de la venta. La comanda seleccionada quedará anulada y las demás continuarán activas.</p>
                </div>
                <h4>Productos que se quitarán de la venta</h4>
                <div className="sc-cancel-products">
                  {revisionAnulacion.productos.map((producto) => (
                    <div key={producto.id_venta_detalle}>
                      <span>{Number(producto.cantidad)} × {producto.producto}</span>
                      <strong>{moneda(producto.importe)}</strong>
                    </div>
                  ))}
                </div>
                <div className="sc-cancel-totals">
                  <div><span>Total actual</span><strong>{moneda(revisionAnulacion.resumen.total_actual)}</strong></div>
                  <div><span>Importe a descontar</span><strong className="sc-negative">{moneda(revisionAnulacion.resumen.importe_a_descontar)}</strong></div>
                  <div className="sc-new-total"><span>Nuevo total de venta</span><strong>{moneda(revisionAnulacion.resumen.nuevo_total)}</strong></div>
                  <div><span>Ya cobrado (se conserva)</span><strong>{moneda(revisionAnulacion.resumen.pagado)}</strong></div>
                  <div><span>Nuevo saldo pendiente</span><strong>{moneda(revisionAnulacion.resumen.nuevo_saldo)}</strong></div>
                </div>
                {revisionAnulacion.resumen.excedente_cobrado > 0 && (
                  <div className="sc-cancel-blocker">
                    <strong>No se puede confirmar esta anulación todavía.</strong>
                    <p>Ya se cobró {moneda(revisionAnulacion.resumen.excedente_cobrado)} por encima del nuevo total. Primero debe resolverse ese excedente mediante el procedimiento de devolución o ajuste correspondiente. Los pagos no se modificarán automáticamente.</p>
                  </div>
                )}
                <div className="sc-cancel-info">
                  <strong>Qué va a ocurrir al confirmar</strong>
                  <ul>
                    <li>La comanda quedará en estado ANULADA con fecha, motivo y operador.</li>
                    <li>Los productos indicados quedarán marcados como anulados en la venta; no se borrarán.</li>
                    <li>El total se actualizará a {moneda(revisionAnulacion.resumen.nuevo_total)}.</li>
                    <li>Los pagos existentes se conservarán sin cambios.</li>
                    <li>Las otras comandas del pedido no se modificarán.</li>
                  </ul>
                </div>
                <div className="sc-cancel-actions">
                  <button type="button" className="sc-secondary-button" onClick={() => setRevisionAnulacion(null)} disabled={confirmandoAnulacion}>Volver</button>
                  <button type="button" className="sc-danger-button" onClick={confirmarAnulacion} disabled={!revisionAnulacion.puede_confirmar || confirmandoAnulacion}>
                    {confirmandoAnulacion ? 'Confirmando...' : 'Confirmar anulación y ajuste'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
