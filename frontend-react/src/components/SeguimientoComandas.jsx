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

export default function SeguimientoComandas() {
  const [comandas, setComandas] = useState([])
  const [filtro, setFiltro] = useState('TODAS')
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [procesando, setProcesando] = useState(null)
  const [imprimiendo, setImprimiendo] = useState(null)

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

  useEffect(() => {
    cargar()
    const intervalo = window.setInterval(() => cargar(true), 5000)
    return () => window.clearInterval(intervalo)
  }, [cargar])

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
    </section>
  )
}
