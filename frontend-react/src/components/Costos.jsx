
import { useCallback, useEffect, useMemo, useState } from 'react'
import './Costos.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

async function consultarApi(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })

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

function fecha(valor) {
  if (!valor) return '—'

  const fechaObj = new Date(valor)
  if (Number.isNaN(fechaObj.getTime())) return String(valor)

  return fechaObj.toLocaleString('es-AR')
}

function mensajeError(error) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}

export default function Costos() {
  const [vista, setVista] = useState('insumos')
  const [insumos, setInsumos] = useState([])
  const [elaborados, setElaborados] = useState([])
  const [presentaciones, setPresentaciones] = useState([])
  const [idInsumo, setIdInsumo] = useState('')
  const [idPresentacion, setIdPresentacion] = useState('')
  const [precio, setPrecio] = useState('')
  const [factor, setFactor] = useState('1.15')
  const [costoActual, setCostoActual] = useState(null)
  const [historial, setHistorial] = useState([])
  const [idElaborado, setIdElaborado] = useState('')
  const [calculoElaborado, setCalculoElaborado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const insumoSeleccionado = useMemo(
    () => insumos.find((item) => String(item.id) === String(idInsumo)),
    [insumos, idInsumo],
  )

  const presentacionSeleccionada = useMemo(
    () => presentaciones.find(
      (item) => String(item.id) === String(idPresentacion),
    ),
    [presentaciones, idPresentacion],
  )

  const precioNumero = precio === '' ? NaN : Number(precio)
  const factorNumero = factor === '' ? NaN : Number(factor)
  const cantidadPresentacion = Number(
    presentacionSeleccionada?.cantidad_contenida ?? 0,
  )

  const costoBasePrevio =
    Number.isFinite(precioNumero) &&
    precioNumero >= 0 &&
    cantidadPresentacion > 0
      ? precioNumero / cantidadPresentacion
      : null

  const costoAjustadoPrevio =
    costoBasePrevio !== null &&
    Number.isFinite(factorNumero) &&
    factorNumero > 0
      ? costoBasePrevio * factorNumero
      : null

  const cargarInsumos = useCallback(async () => {
    const datos = await consultarApi('/api/costos/insumos')
    setInsumos(obtenerLista(datos, ['insumos', 'resultado']))
  }, [])

  const cargarElaborados = useCallback(async () => {
    const datos = await consultarApi('/api/estructura/productos')
    setElaborados(
      obtenerLista(datos, ['productos', 'elaborados', 'resultado']),
    )
  }, [])

  const cargarDatosInsumo = useCallback(async (id) => {
    if (!id) {
      setPresentaciones([])
      setIdPresentacion('')
      setCostoActual(null)
      setHistorial([])
      return
    }

    setCargando(true)
    setError('')
    setMensaje('')

    try {
      const [datosPresentaciones, datosCosto, datosHistorial] =
        await Promise.all([
          consultarApi(`/api/presentaciones/producto/${id}`),
          consultarApi(`/api/costos/insumo/${id}`),
          consultarApi(`/api/costos/insumo/${id}/historial`),
        ])

      const listaPresentaciones = obtenerLista(
        datosPresentaciones,
        ['presentaciones', 'resultado', 'datos'],
      )

      setPresentaciones(listaPresentaciones)
      setCostoActual(datosCosto.resultado ?? null)
      setHistorial(obtenerLista(datosHistorial, ['historial', 'resultado']))

      setIdPresentacion((actual) =>
        listaPresentaciones.some((p) => String(p.id) === String(actual))
          ? actual
          : '',
      )
    } catch (err) {
      setError(mensajeError(err))
      setPresentaciones([])
      setCostoActual(null)
      setHistorial([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    async function iniciar() {
      setCargando(true)
      setError('')

      try {
        await Promise.all([cargarInsumos(), cargarElaborados()])
      } catch (err) {
        setError(mensajeError(err))
      } finally {
        setCargando(false)
      }
    }

    iniciar()
  }, [cargarInsumos, cargarElaborados])

  useEffect(() => {
    cargarDatosInsumo(idInsumo)
  }, [idInsumo, cargarDatosInsumo])

  async function registrarCosto(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    if (!idInsumo) {
      setError('Seleccioná un insumo.')
      return
    }

    if (!idPresentacion) {
      setError('Seleccioná una presentación.')
      return
    }

    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      setError('Ingresá un precio de compra válido, igual o mayor que cero.')
      return
    }

    if (!Number.isFinite(factorNumero) || factorNumero <= 0) {
      setError('El factor de ajuste debe ser mayor que cero.')
      return
    }

    const confirmado = window.confirm(
      `Vas a registrar un nuevo costo para ${insumoSeleccionado?.nombre ?? 'el insumo'}.\n\n` +
      `Precio de compra: ${moneda(precioNumero)}\n` +
      `Costo base por ${insumoSeleccionado?.unidad ?? 'unidad'}: ${moneda(costoBasePrevio)}\n` +
      `Costo ajustado: ${moneda(costoAjustadoPrevio)}\n\n` +
      'El costo vigente anterior quedará inactivo. ¿Confirmás el registro?',
    )

    if (!confirmado) return

    setGuardando(true)

    try {
      const datos = await consultarApi('/api/costos/insumo', {
        method: 'POST',
        body: JSON.stringify({
          id_producto: Number(idInsumo),
          id_presentacion: Number(idPresentacion),
          costo: precioNumero,
          factor_ajuste: factorNumero,
        }),
      })

      setMensaje(datos.mensaje || 'Costo registrado correctamente.')
      await Promise.all([
        cargarInsumos(),
        cargarDatosInsumo(idInsumo),
      ])
      setPrecio('')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function consultarCostoElaborado() {
    if (!idElaborado) {
      setError('Seleccioná un producto elaborado.')
      return
    }

    setError('')
    setMensaje('')
    setCalculoElaborado(null)
    setCargando(true)

    try {
      const datos = await consultarApi(
        `/api/costos/estructura/${idElaborado}/costos`,
      )
      setCalculoElaborado(datos.resultado ?? null)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <section className="costos-page">
      <div className="costos-heading">
        <div>
          <span className="costos-eyebrow">ROTISERIA360 · GESTIÓN</span>
          <h2>Costos</h2>
          <p>
            Registrá precios de compra, consultá costos vigentes y calculá
            cuánto cuesta producir cada elaboración.
          </p>
        </div>
        <button
          className="costos-button secondary"
          type="button"
          onClick={() => {
            setError('')
            setMensaje('')
            if (vista === 'insumos') {
              cargarDatosInsumo(idInsumo)
              cargarInsumos().catch((err) => setError(mensajeError(err)))
            } else {
              cargarElaborados().catch((err) => setError(mensajeError(err)))
            }
          }}
          disabled={cargando || guardando}
        >
          Actualizar datos
        </button>
      </div>

      <div className="costos-tabs" role="tablist" aria-label="Secciones de costos">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'insumos'}
          className={vista === 'insumos' ? 'active' : ''}
          onClick={() => {
            setVista('insumos')
            setError('')
            setMensaje('')
          }}
        >
          Costos de insumos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'elaborados'}
          className={vista === 'elaborados' ? 'active' : ''}
          onClick={() => {
            setVista('elaborados')
            setError('')
            setMensaje('')
          }}
        >
          Productos elaborados
        </button>
      </div>

      {error && <div className="costos-alert error" role="alert">{error}</div>}
      {mensaje && <div className="costos-alert success" role="status">{mensaje}</div>}
      {cargando && <p className="costos-loading">Consultando datos...</p>}

      {vista === 'insumos' && (
        <div className="costos-layout">
          <div className="costos-card">
            <h3>Registrar costo de compra</h3>
            <p className="costos-help">
              Elegí un insumo y una presentación. El cálculo se actualiza
              antes de guardar; consultar esta pantalla no modifica datos.
            </p>

            <form onSubmit={registrarCosto}>
              <label htmlFor="costo-insumo">Insumo</label>
              <select
                id="costo-insumo"
                value={idInsumo}
                onChange={(e) => {
                  setIdInsumo(e.target.value)
                  setIdPresentacion('')
                  setPrecio('')
                }}
                required
              >
                <option value="">Seleccionar insumo...</option>
                {insumos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} — {item.nombre}
                  </option>
                ))}
              </select>

              <label htmlFor="costo-presentacion">Presentación de compra</label>
              <select
                id="costo-presentacion"
                value={idPresentacion}
                onChange={(e) => setIdPresentacion(e.target.value)}
                required
                disabled={!idInsumo || presentaciones.length === 0}
              >
                <option value="">Seleccionar presentación...</option>
                {presentaciones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} ({item.cantidad_contenida} {item.unidad_presentacion ?? item.unidad ?? ''})
                  </option>
                ))}
              </select>

              {idInsumo && presentaciones.length === 0 && !cargando && (
                <p className="costos-field-note">
                  Este insumo no tiene presentaciones activas disponibles.
                </p>
              )}

              <label htmlFor="costo-precio">Precio de compra de la presentación ($)</label>
              <input
                id="costo-precio"
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="Ej.: 20000"
                required
              />

              <label htmlFor="costo-factor">Factor de ajuste</label>
              <input
                id="costo-factor"
                type="number"
                min="0.0001"
                step="0.01"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                required
              />

              <div className="costos-formula">
                <h4>Vista previa del cálculo</h4>
                <div className="costos-formula-row">
                  <span>Precio de compra</span>
                  <strong>{moneda(precioNumero)}</strong>
                </div>
                <div className="costos-formula-row">
                  <span>Contenido de la presentación</span>
                  <strong>
                    {cantidadPresentacion > 0
                      ? `${cantidadPresentacion} ${presentacionSeleccionada?.unidad_presentacion ?? presentacionSeleccionada?.unidad ?? ''}`
                      : '—'}
                  </strong>
                </div>
                <p>
                  <strong>Paso 1:</strong> precio de compra ÷ contenido =
                  costo base por unidad.
                </p>
                <div className="costos-formula-row">
                  <span>Costo base unitario</span>
                  <strong>{costoBasePrevio === null ? '—' : moneda(costoBasePrevio)}</strong>
                </div>
                <p>
                  <strong>Paso 2:</strong> costo base × factor de ajuste =
                  costo ajustado.
                </p>
                <div className="costos-formula-row result">
                  <span>Costo ajustado unitario</span>
                  <strong>{costoAjustadoPrevio === null ? '—' : moneda(costoAjustadoPrevio)}</strong>
                </div>
              </div>

              <button
                className="costos-button primary"
                type="submit"
                disabled={
                  guardando ||
                  cargando ||
                  !idInsumo ||
                  !idPresentacion ||
                  costoBasePrevio === null ||
                  costoAjustadoPrevio === null
                }
              >
                {guardando ? 'Registrando...' : 'Registrar costo'}
              </button>
            </form>
          </div>

          <div className="costos-card">
            <h3>Costo vigente</h3>
            {!insumoSeleccionado ? (
              <p className="costos-empty">Seleccioná un insumo para consultar su costo actual.</p>
            ) : (
              <>
                <p className="costos-product-name">
                  {insumoSeleccionado.codigo} — {insumoSeleccionado.nombre}
                </p>
                <div className="costos-current-value">
                  <span>Costo ajustado por {insumoSeleccionado.unidad || 'unidad'}</span>
                  <strong>
                    {costoActual?.costo
                      ? moneda(
                          costoActual.costo.costo_ajustado ??
                          Number(costoActual.costo.costo) *
                            Number(costoActual.costo.factor_ajuste ?? 1),
                        )
                      : 'Sin costo vigente'}
                  </strong>
                </div>
                {costoActual?.costo && (
                  <div className="costos-summary">
                    <div><span>Costo base</span><strong>{moneda(costoActual.costo.costo)}</strong></div>
                    <div><span>Factor aplicado</span><strong>{Number(costoActual.costo.factor_ajuste).toLocaleString('es-AR')}</strong></div>
                    <div><span>Vigente desde</span><strong>{fecha(costoActual.costo.fecha_desde)}</strong></div>
                  </div>
                )}
              </>
            )}

            <h3 className="costos-history-title">Historial de costos</h3>
            {historial.length === 0 ? (
              <p className="costos-empty">No hay registros de costos para mostrar.</p>
            ) : (
              <div className="costos-table-wrap">
                <table className="costos-table">
                  <thead>
                    <tr>
                      <th>Desde</th>
                      <th>Base</th>
                      <th>Factor</th>
                      <th>Ajustado</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((item) => (
                      <tr key={item.id}>
                        <td>{fecha(item.fecha_desde)}</td>
                        <td>{moneda(item.costo)}</td>
                        <td>{Number(item.factor_ajuste).toLocaleString('es-AR')}</td>
                        <td>{moneda(item.costo_ajustado ?? Number(item.costo) * Number(item.factor_ajuste ?? 1))}</td>
                        <td>
                          <span className={`costos-status ${item.activo ? 'vigente' : 'historico'}`}>
                            {item.activo ? 'Vigente' : 'Histórico'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {vista === 'elaborados' && (
        <div className="costos-card">
          <h3>Calcular costo de un producto elaborado</h3>
          <p className="costos-help">
            El sistema calcula el costo de cada componente, incorpora la merma
            en la cantidad utilizada y divide el costo total por el rendimiento
            de la estructura activa.
          </p>

          <div className="costos-elaborado-selector">
            <div>
              <label htmlFor="costo-elaborado">Producto elaborado</label>
              <select
                id="costo-elaborado"
                value={idElaborado}
                onChange={(e) => {
                  setIdElaborado(e.target.value)
                  setCalculoElaborado(null)
                }}
              >
                <option value="">Seleccionar producto...</option>
                {elaborados.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} — {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="costos-button primary"
              type="button"
              onClick={consultarCostoElaborado}
              disabled={cargando || !idElaborado}
            >
              Calcular costo
            </button>
          </div>

          {calculoElaborado && (
            <>
              <div className="costos-elaborado-result">
                <div>
                  <span>Costo total de la estructura</span>
                  <strong>{moneda(calculoElaborado.costo_total)}</strong>
                </div>
                <div>
                  <span>Rendimiento</span>
                  <strong>
                    {calculoElaborado.rendimiento ?? calculoElaborado.estructura?.rendimiento ?? '—'}{' '}
                    {calculoElaborado.unidad_rendimiento ?? ''}
                  </strong>
                </div>
                <div>
                  <span>Costo por unidad de rendimiento</span>
                  <strong>{moneda(calculoElaborado.costo_unitario)}</strong>
                </div>
              </div>

              <h4>Detalle del cálculo</h4>
              {!calculoElaborado.detalle?.length ? (
                <p className="costos-empty">El cálculo no devolvió componentes para mostrar.</p>
              ) : (
                <div className="costos-table-wrap">
                  <table className="costos-table">
                    <thead>
                      <tr>
                        <th>Componente</th>
                        <th>Cantidad</th>
                        <th>Merma</th>
                        <th>Cantidad efectiva</th>
                        <th>Costo unitario</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculoElaborado.detalle.map((item) => (
                        <tr key={item.id}>
                          <td>{item.codigo} — {item.nombre}</td>
                          <td>{Number(item.cantidad).toLocaleString('es-AR')} {item.unidad ?? ''}</td>
                          <td>{Number(item.merma).toLocaleString('es-AR')}%</td>
                          <td>{Number(item.cantidad_efectiva).toLocaleString('es-AR', { maximumFractionDigits: 4 })} {item.unidad ?? ''}</td>
                          <td>{moneda(item.costo_unitario)}</td>
                          <td>{moneda(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
