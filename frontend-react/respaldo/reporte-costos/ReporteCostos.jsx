import { useCallback, useEffect, useState } from 'react'
import './ReporteCostos.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

async function consultarApi(ruta) {
  const respuesta = await fetch(`${API_BASE}${ruta}`)
  const datos = await respuesta.json().catch(() => ({}))

  if (!respuesta.ok || datos.ok === false) {
    throw new Error(datos.mensaje || `Error HTTP ${respuesta.status}`)
  }

  return datos
}

function obtenerLista(datos, claves = []) {
  if (Array.isArray(datos)) return datos

  for (const clave of claves) {
    if (Array.isArray(datos?.[clave])) return datos[clave]
  }

  return []
}

function moneda(valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'

  return numero.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function numero(valor) {
  const resultado = Number(valor)
  if (!Number.isFinite(resultado)) return '—'

  return resultado.toLocaleString('es-AR', {
    maximumFractionDigits: 4,
  })
}

function fecha(valor) {
  if (!valor) return '—'

  const resultado = new Date(valor)
  if (Number.isNaN(resultado.getTime())) return String(valor)

  return resultado.toLocaleString('es-AR')
}

function DetalleEstructuraCostos({ detalle, ruta = 'principal' }) {
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return <p className="reporte-costos-empty">La estructura no tiene componentes.</p>
  }

  return (
    <ol className="reporte-costos-list">
      {detalle.map((item, indice) => {
        const calculo = item.calculo
        const esInsumo = calculo?.tipo_calculo === 'INSUMO'
        const esElaborado = calculo?.tipo_calculo === 'ELABORADO'
        const unidad = item.unidad || 'unidad'

        let formacionCostoUnitario = `${moneda(item.costo_unitario)} / ${unidad}`

        if (esInsumo) {
          formacionCostoUnitario =
            `${moneda(calculo.costo_base)} × ${numero(calculo.factor_ajuste)} ` +
            `= ${moneda(calculo.costo_ajustado)} / ${unidad}`
        } else if (esElaborado) {
          formacionCostoUnitario =
            `${moneda(calculo.costo_total)} ÷ ${numero(calculo.rendimiento)} ` +
            `${calculo.unidad_rendimiento || ''} = ${moneda(item.costo_unitario)} / ${unidad}`
        }

        return (
          <li
            key={`${ruta}-${item.id ?? indice}`}
            className="reporte-costos-item"
          >
            <article>
              <header className="reporte-costos-item-heading">
                <div>
                  <span className="reporte-costos-code">{item.codigo}</span>
                  <h5>{item.nombre}</h5>
                </div>
                <span className="reporte-costos-type">{item.tipo}</span>
              </header>

              <dl className="reporte-costos-values">
                <div>
                  <dt>Cantidad en estructura</dt>
                  <dd>{numero(item.cantidad)} {unidad}</dd>
                </div>

                <div>
                  <dt>Merma aplicada</dt>
                  <dd>{numero(item.merma)}%</dd>
                  <small>
                    La merma incrementa la cantidad necesaria del componente.
                  </small>
                </div>

                <div>
                  <dt>Cantidad efectiva</dt>
                  <dd>{numero(item.cantidad_efectiva)} {unidad}</dd>
                  <small>
                    Cantidad original ajustada por el porcentaje de merma.
                  </small>
                </div>

                <div>
                  <dt>Formación del costo unitario</dt>
                  <dd>{formacionCostoUnitario}</dd>
                  {esInsumo && (
                    <small>
                      Costo vigente desde: {fecha(calculo.fecha_costo)}
                    </small>
                  )}
                </div>

                <div className="reporte-costos-subtotal">
                  <dt>Subtotal del componente</dt>
                  <dd>{moneda(item.subtotal)}</dd>
                  <small>
                    Importe que aporta este componente al costo de la estructura.
                  </small>
                </div>
              </dl>

              {esElaborado && (
                <section className="reporte-costos-nested">
                  <div className="reporte-costos-nested-summary">
                    <strong>
                      Estructura de {calculo.producto?.codigo} — {calculo.producto?.nombre}
                    </strong>
                    <span>
                      Versión {calculo.estructura?.version ?? '—'}
                    </span>
                    <span>
                      Costo del lote: {moneda(calculo.costo_total)} ·
                      {' '}Rendimiento: {numero(calculo.rendimiento)}
                      {' '}{calculo.unidad_rendimiento || ''}
                    </span>
                    <span>
                      Costo unitario: {moneda(calculo.costo_unitario)}
                    </span>
                  </div>

                  <DetalleEstructuraCostos
                    detalle={calculo.detalle}
                    ruta={`${ruta}-${item.id ?? indice}`}
                  />
                </section>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}

export default function ReporteCostos() {
  const [elaborados, setElaborados] = useState([])
  const [idElaborado, setIdElaborado] = useState('')
  const [calculo, setCalculo] = useState(null)
  const [fechaReporte, setFechaReporte] = useState(null)
  const [cargandoProductos, setCargandoProductos] = useState(false)
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [error, setError] = useState('')

  const cargarElaborados = useCallback(async () => {
    setCargandoProductos(true)
    setError('')

    try {
      const datos = await consultarApi('/api/estructura/productos')
      const productos = obtenerLista(datos, [
        'productos',
        'elaborados',
        'resultado',
      ])

      setElaborados(
        productos.filter((item) => item.tipo === 'ELABORADO'),
      )
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los productos elaborados.')
    } finally {
      setCargandoProductos(false)
    }
  }, [])

  useEffect(() => {
    void cargarElaborados()
  }, [cargarElaborados])

  async function consultarCostoElaborado() {
    if (!idElaborado) {
      setError('Seleccioná un producto elaborado.')
      return
    }

    setError('')
    setCalculo(null)
    setFechaReporte(null)
    setCargandoReporte(true)

    try {
      const datos = await consultarApi(
        `/api/costos/estructura/${idElaborado}/costos`,
      )

      setCalculo(datos.resultado ?? null)
      setFechaReporte(new Date())
    } catch (err) {
      setError(err.message || 'No se pudo calcular el costo del producto.')
    } finally {
      setCargandoReporte(false)
    }
  }

  return (
    <section className="reporte-costos-page">
      <div className="reporte-costos-heading">
        <div>
          <span className="reporte-costos-eyebrow">
            ROTISERIA360 · REPORTES
          </span>
          <h2>Reporte de costos</h2>
          <p>
            Consultá cómo se forma el costo de producción de cada producto
            elaborado, desde sus insumos hasta el costo unitario final.
          </p>
        </div>

        <button
          className="reporte-costos-button secondary"
          type="button"
          onClick={() => {
            setCalculo(null)
            setError('')
            void cargarElaborados()
          }}
          disabled={cargandoProductos || cargandoReporte}
        >
          Actualizar productos
        </button>
      </div>

      <section className="reporte-costos-card reporte-costos-controls">
        <h3>Seleccionar producto</h3>
        <p>
          Elegí un producto elaborado para consultar su estructura de costos
          y los componentes que determinan su importe.
        </p>

        <div className="reporte-costos-selector">
          <div>
            <label htmlFor="reporte-costo-producto">
              Producto elaborado
            </label>
            <select
              id="reporte-costo-producto"
              value={idElaborado}
              onChange={(evento) => {
                setIdElaborado(evento.target.value)
                setCalculo(null)
                setFechaReporte(null)
                setError('')
              }}
              disabled={cargandoProductos}
            >
              <option value="">
                {cargandoProductos
                  ? 'Cargando productos...'
                  : 'Seleccionar producto...'}
              </option>

              {elaborados.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo} — {item.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            className="reporte-costos-button primary"
            type="button"
            onClick={consultarCostoElaborado}
            disabled={cargandoReporte || cargandoProductos || !idElaborado}
          >
            {cargandoReporte ? 'Calculando...' : 'Calcular costo'}
          </button>
        </div>

        {!cargandoProductos && elaborados.length === 0 && (
          <p className="reporte-costos-empty">
            No se encontraron productos elaborados disponibles.
          </p>
        )}
      </section>

      {error && (
        <div className="reporte-costos-alert" role="alert">
          {error}
        </div>
      )}

      {cargandoReporte && (
        <p className="reporte-costos-loading">
          Calculando estructura de costos...
        </p>
      )}

      {calculo && (
        <article className="reporte-costos-card reporte-costos-print-area">
          <header className="reporte-costos-report-heading">
            <div>
              <span className="reporte-costos-eyebrow">
                ROTISERIA360 · REPORTE DE COSTOS
              </span>
              <h3>
                {calculo.producto?.codigo} — {calculo.producto?.nombre}
              </h3>
              <p>
                Estructura versión {calculo.estructura?.version ?? '—'}
                {' '}· Generado: {fecha(fechaReporte)}
              </p>
            </div>

            <button
              className="reporte-costos-button secondary reporte-costos-print-action"
              type="button"
              onClick={() => window.print()}
            >
              Imprimir / Guardar PDF
            </button>
          </header>

          <section className="reporte-costos-explanation">
            <h4>Cómo se forma el costo</h4>
            <ol>
              <li>
                <strong>Costo base:</strong> precio de compra dividido por
                el contenido de la presentación.
              </li>
              <li>
                <strong>Costo ajustado:</strong> costo base multiplicado
                por el factor de ajuste registrado.
              </li>
              <li>
                <strong>Cantidad efectiva:</strong> cantidad de receta
                incrementada según la merma configurada.
              </li>
              <li>
                <strong>Subtotal:</strong> importe que aporta cada componente
                a la estructura.
              </li>
              <li>
                <strong>Costo total:</strong> suma de los subtotales de
                los componentes.
              </li>
              <li>
                <strong>Costo unitario:</strong> costo total dividido por
                el rendimiento de la estructura.
              </li>
            </ol>
          </section>

          <section className="reporte-costos-summary">
            <div>
              <span>Costo total de la estructura</span>
              <strong>{moneda(calculo.costo_total)}</strong>
            </div>

            <div>
              <span>Rendimiento</span>
              <strong>
                {numero(
                  calculo.rendimiento ??
                  calculo.estructura?.rendimiento,
                )}{' '}
                {calculo.unidad_rendimiento ?? ''}
              </strong>
            </div>

            <div>
              <span>Costo por unidad de rendimiento</span>
              <strong>{moneda(calculo.costo_unitario)}</strong>
            </div>
          </section>

          <div className="reporte-costos-unit-formula">
            <strong>Fórmula del costo unitario:</strong>
            {' '}Costo total ÷ rendimiento = costo por unidad.
          </div>

          <h4 className="reporte-costos-detail-title">
            Desglose completo de la estructura
          </h4>

          <DetalleEstructuraCostos detalle={calculo.detalle} />

          <p className="reporte-costos-disclaimer">
            Este reporte refleja los costos y la estructura devueltos por
            el sistema al momento de la consulta. No representa por sí mismo
            una copia histórica inalterable de los costos anteriores.
          </p>
        </article>
      )}
    </section>
  )
}