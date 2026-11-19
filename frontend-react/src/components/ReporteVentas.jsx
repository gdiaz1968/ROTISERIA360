import { useCallback, useEffect, useMemo, useState } from 'react'
import './ReporteVentas.css'

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:3032' : '')
const moneda = (valor) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(valor || 0))
const numero = (valor, decimales = 2) => Number(valor || 0).toLocaleString('es-AR', { maximumFractionDigits: decimales })
const fechaLocal = (fecha) => {
  const d = new Date(fecha)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR')
}
const fechaInput = (fecha) => {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const hoy = new Date()
const primerDiaMes = fechaInput(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
const hoyTexto = fechaInput(hoy)

async function consultar(ruta) {
  const respuesta = await fetch(`${API_BASE}${ruta}`)
  const texto = await respuesta.text()
  let datos
  try { datos = texto ? JSON.parse(texto) : {} } catch { throw new Error('El servidor devolvió una respuesta inválida.') }
  if (!respuesta.ok) throw new Error(datos?.mensaje || `Error del servidor (${respuesta.status})`)
  return datos
}

function csvCelda(valor) {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`
}

export default function ReporteVentas() {
  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoyTexto)
  const [datos, setDatos] = useState(null)
  const [pestana, setPestana] = useState('resumen')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [actualizacion, setActualizacion] = useState('')

  const cargar = useCallback(async () => {
    if (desde && hasta && desde > hasta) {
      setError('La fecha desde no puede ser posterior a la fecha hasta.')
      return
    }
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const resultado = await consultar(`/api/reportes/ventas?${params.toString()}`)
      setDatos(resultado)
      setActualizacion(new Date().toLocaleString('es-AR'))
    } catch (e) {
      setError(e.message || 'No se pudo cargar el reporte.')
      setDatos(null)
    } finally {
      setCargando(false)
    }
  }, [desde, hasta])

  useEffect(() => { void cargar() }, [cargar])

  const maxVendido = useMemo(() => Math.max(1, ...(datos?.evolucion || []).map((x) => Number(x.vendido || 0))), [datos])

  function exportarCsv() {
    if (!datos) return
    let nombre = 'reporte-ventas'
    let filas = []
    if (pestana === 'productos') {
      nombre += '-productos'
      filas = [['Producto', 'Cantidad', 'Importe'], ...(datos.productos || []).map((x) => [x.producto, x.cantidad, x.importe])]
    } else if (pestana === 'pagos') {
      nombre += '-medios-pago'
      filas = [['Medio de pago', 'Operaciones', 'Importe'], ...(datos.pagos || []).map((x) => [x.medio_pago, x.operaciones, x.importe])]
    } else {
      nombre += '-ventas'
      filas = [['Pedido', 'Fecha', 'Cliente', 'Modalidad', 'Canal', 'Estado', 'Total', 'Cobrado', 'Pendiente'], ...(datos.ventas || []).map((x) => [x.numero, x.fecha, x.cliente, x.modalidad, x.canal, x.estado, x.total, x.pagado, x.pendiente])]
    }
    const contenido = '\uFEFF' + filas.map((fila) => fila.map(csvCelda).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `${nombre}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  const resumen = datos?.resumen || {}
  const tabs = [
    ['resumen', 'Resumen'],
    ['detalle', 'Detalle de ventas'],
    ['productos', 'Productos vendidos'],
    ['pagos', 'Medios de pago'],
  ]

  return (
    <section className="rv-page">
      <header className="rv-header">
        <div>
          <span className="rv-eyebrow">ROTISERIA360 · REPORTES</span>
          <h2>Reportes de ventas</h2>
          <p>Control de operaciones, importes vendidos, cobranzas y productos.</p>
        </div>
        <div className="rv-actions">
          <button type="button" className="rv-button secondary" onClick={() => window.print()} disabled={!datos}>Imprimir / PDF</button>
          <button type="button" className="rv-button" onClick={exportarCsv} disabled={!datos}>Exportar CSV</button>
        </div>
      </header>

      <div className="rv-filters">
        <label>Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <button type="button" className="rv-button" onClick={cargar} disabled={cargando}>{cargando ? 'Consultando...' : 'Consultar'}</button>
      </div>

      {error && <div className="rv-error" role="alert">{error}<button type="button" onClick={cargar}>Reintentar</button></div>}
      {cargando && !datos && <div className="rv-empty">Cargando información de ventas...</div>}

      {datos && (
        <>
          <nav className="rv-tabs" aria-label="Tipos de reporte">
            {tabs.map(([id, etiqueta]) => <button type="button" key={id} className={pestana === id ? 'active' : ''} onClick={() => setPestana(id)}>{etiqueta}</button>)}
          </nav>

          {pestana === 'resumen' && (
            <>
              <div className="rv-cards">
                <article><span>Total vendido</span><strong>{moneda(resumen.total_vendido)}</strong></article>
                <article><span>Operaciones</span><strong>{numero(resumen.operaciones, 0)}</strong></article>
                <article><span>Promedio por venta</span><strong>{moneda(resumen.promedio_venta)}</strong></article>
                <article><span>Total cobrado</span><strong>{moneda(resumen.total_cobrado)}</strong></article>
                <article><span>Saldo pendiente</span><strong>{moneda(resumen.saldo_pendiente)}</strong></article>
                <article><span>Ventas anuladas</span><strong>{numero(resumen.operaciones_anuladas, 0)}</strong></article>
              </div>
              <section className="rv-panel">
                <div className="rv-panel-title"><h3>Evolución diaria</h3><span>Importes de ventas no anuladas</span></div>
                {!datos.evolucion?.length ? <p className="rv-empty">No hay ventas en el período seleccionado.</p> : (
                  <div className="rv-bars">
                    {datos.evolucion.map((dia) => (
                      <div className="rv-bar-item" key={dia.fecha} title={`${fechaLocal(dia.fecha)}: ${moneda(dia.vendido)}`}>
                        <strong>{moneda(dia.vendido)}</strong>
                        <div className="rv-bar-track"><i style={{ height: `${Math.max(3, Number(dia.vendido) / maxVendido * 100)}%` }} /></div>
                        <span>{fechaLocal(dia.fecha)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {pestana === 'detalle' && (
            <section className="rv-panel">
              <div className="rv-panel-title"><h3>Operaciones registradas</h3><span>{datos.ventas?.length || 0} registros · máximo 500</span></div>
              <div className="rv-table-wrap"><table className="rv-table">
                <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Modalidad</th><th>Canal</th><th>Estado</th><th className="num">Total</th><th className="num">Cobrado</th><th className="num">Pendiente</th></tr></thead>
                <tbody>{datos.ventas?.map((v) => <tr key={v.id} className={v.estado === 'ANULADO' ? 'cancelled' : ''}>
                  <td>#{v.numero}</td><td>{fechaLocal(v.fecha)}</td><td>{v.cliente}</td><td>{v.modalidad}</td><td>{v.canal}</td><td>{v.estado}</td><td className="num">{moneda(v.total)}</td><td className="num">{moneda(v.pagado)}</td><td className="num">{moneda(v.pendiente)}</td>
                </tr>)}</tbody>
              </table></div>
              {!datos.ventas?.length && <p className="rv-empty">No hay operaciones para este período.</p>}
            </section>
          )}

          {pestana === 'productos' && (
            <section className="rv-panel">
              <div className="rv-panel-title"><h3>Productos vendidos</h3><span>Solo renglones activos de ventas vigentes</span></div>
              <div className="rv-table-wrap"><table className="rv-table">
                <thead><tr><th>Producto</th><th className="num">Cantidad</th><th className="num">Importe vendido</th></tr></thead>
                <tbody>{datos.productos?.map((p, i) => <tr key={`${p.producto}-${i}`}><td>{p.producto}</td><td className="num">{numero(p.cantidad, 3)}</td><td className="num">{moneda(p.importe)}</td></tr>)}</tbody>
              </table></div>
              {!datos.productos?.length && <p className="rv-empty">No hay productos vendidos en este período.</p>}
            </section>
          )}

          {pestana === 'pagos' && (
            <section className="rv-panel">
              <div className="rv-panel-title"><h3>Cobros por medio de pago</h3><span>Pagos confirmados de ventas vigentes</span></div>
              <div className="rv-table-wrap"><table className="rv-table">
                <thead><tr><th>Medio de pago</th><th className="num">Movimientos</th><th className="num">Importe cobrado</th></tr></thead>
                <tbody>{datos.pagos?.map((p) => <tr key={p.medio_pago}><td>{p.medio_pago}</td><td className="num">{numero(p.operaciones, 0)}</td><td className="num">{moneda(p.importe)}</td></tr>)}</tbody>
              </table></div>
              {!datos.pagos?.length && <p className="rv-empty">No hay pagos confirmados en este período.</p>}
            </section>
          )}
          <footer className="rv-footer">Período: {desde || 'Sin límite'} al {hasta || 'Sin límite'} · Actualizado: {actualizacion} · ROTISERIA360</footer>
        </>
      )}
    </section>
  )
}
