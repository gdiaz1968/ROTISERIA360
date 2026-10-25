
import { useCallback, useEffect, useMemo, useState } from 'react'
import './EstructuraProductos.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

const nuevaLinea = () => ({
  componente_id: '',
  cantidad: '1',
  merma: '0',
})

const estructuraVacia = {
  id: null,
  version: null,
  rendimiento: '1',
  unidad_rendimiento: '',
  detalle: [],
}

async function consultarApi(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })

  const texto = await respuesta.text()
  let resultado = {}

  if (texto) {
    try {
      resultado = JSON.parse(texto)
    } catch {
      throw new Error(
        `La API devolviÃ³ una respuesta no vÃ¡lida (${respuesta.status}).`,
      )
    }
  }

  if (!respuesta.ok) {
    throw new Error(
      resultado.error ||
        resultado.mensaje ||
        `Error HTTP ${respuesta.status}`,
    )
  }

  return resultado
}

export default function EstructuraProductos() {
  const [productos, setProductos] = useState([])
  const [componentes, setComponentes] = useState([])
  const [productoId, setProductoId] = useState('')
  const [estructura, setEstructura] = useState(estructuraVacia)
  const [modo, setModo] = useState('consulta')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const productoSeleccionado = useMemo(
    () => productos.find((p) => String(p.id) === String(productoId)),
    [productos, productoId],
  )


  useEffect(() => {
  let cancelado = false

  async function cargarInicial() {
    try {
      const [listaProductos, listaComponentes] = await Promise.all([
        consultarApi('/api/estructura/productos'),
        consultarApi('/api/estructura/componentes'),
      ])

      if (cancelado) return

      setProductos(Array.isArray(listaProductos) ? listaProductos : [])
      setComponentes(Array.isArray(listaComponentes) ? listaComponentes : [])
      setError('')
    } catch (err) {
      if (!cancelado) {
        setError(`No se pudieron cargar los catÃ¡logos. ${err.message}`)
      }
    }
  }

  cargarInicial()

  return () => {
    cancelado = true
  }
}, [])

  const consultarEstructura = useCallback(async (id) => {
    if (!id) return

    setCargando(true)
    setError('')
    setMensaje('')

    try {
      const datos = await consultarApi(
        `/api/estructura/producto/${encodeURIComponent(id)}`,
      )

      const cabecera = datos.estructura || {}

      setEstructura({
        id: cabecera.id,
        version: cabecera.version,
        rendimiento: String(cabecera.rendimiento ?? 1),
        unidad_rendimiento: cabecera.unidad_rendimiento ?? '',
        detalle: (datos.detalle || []).map((item) => ({
          componente_id: String(item.componente_id),
          cantidad: String(item.cantidad ?? 0),
          merma: String(item.merma ?? 0),
        })),
      })

      setModo('consulta')
      setMensaje(`Estructura activa: versiÃ³n ${cabecera.version}.`)
    } catch (err) {
      if (err.message.includes('no tiene una estructura activa')) {
        setEstructura({
          ...estructuraVacia,
          detalle: [],
        })
        setModo('nuevo')
        setMensaje('Este producto todavÃ­a no tiene una estructura activa.')
      } else {
        setError(`No se pudo consultar la estructura. ${err.message}`)
      }
    } finally {
      setCargando(false)
    }
  }, [])

  function seleccionarProducto(valor) {
    setProductoId(valor)
    setEstructura({ ...estructuraVacia, detalle: [] })
    setModo('consulta')
    setError('')
    setMensaje('')
    setBusqueda('')

    if (valor) {
      consultarEstructura(valor)
    }
  }

  function iniciarNueva() {
    if (!productoId) {
      setError('Seleccione primero un producto elaborado.')
      return
    }

    if (estructura.id) {
      setError(
        'Este producto ya tiene una estructura activa. Use Modificar para generar una nueva versiÃ³n.',
      )
      return
    }

    setEstructura({ ...estructuraVacia, detalle: [] })
    setModo('nuevo')
    setError('')
    setMensaje('')
  }

  function iniciarModificacion() {
    if (!estructura.id) {
      setError('No hay una estructura activa para modificar.')
      return
    }

    setModo('modificacion')
    setError('')
    setMensaje(
      'Al guardar, se generarÃ¡ una nueva versiÃ³n de la estructura.',
    )
  }

  function actualizarCabecera(campo, valor) {
    setEstructura((actual) => ({
      ...actual,
      [campo]: valor,
    }))
  }

  function actualizarLinea(indice, campo, valor) {
    setEstructura((actual) => ({
      ...actual,
      detalle: actual.detalle.map((item, i) =>
        i === indice ? { ...item, [campo]: valor } : item,
      ),
    }))
  }

  function agregarComponente() {
    setEstructura((actual) => ({
      ...actual,
      detalle: [...actual.detalle, nuevaLinea()],
    }))
  }

  function quitarComponente(indice) {
    setEstructura((actual) => ({
      ...actual,
      detalle: actual.detalle.filter((_, i) => i !== indice),
    }))
  }

  const componentesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')

    return componentes.filter((componente) => {
      if (!termino) return true

      return (
        String(componente.codigo ?? '')
          .toLocaleLowerCase('es')
          .includes(termino) ||
        String(componente.nombre ?? '')
          .toLocaleLowerCase('es')
          .includes(termino)
      )
    })
  }, [componentes, busqueda])

  async function guardarEstructura(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    if (!productoId) {
      setError('Seleccione un producto elaborado.')
      return
    }

    const rendimiento = Number(estructura.rendimiento)

    if (!Number.isFinite(rendimiento) || rendimiento <= 0) {
      setError('El rendimiento debe ser mayor que cero.')
      return
    }

    if (!estructura.unidad_rendimiento.trim()) {
      setError('Ingrese la unidad de rendimiento, por ejemplo KG o UN.')
      return
    }

    if (estructura.detalle.length === 0) {
      setError('Agregue al menos un componente.')
      return
    }

    const detalle = []

    for (const item of estructura.detalle) {
      const cantidad = Number(item.cantidad)
      const merma = Number(item.merma)
      const componenteId = Number(item.componente_id)

      if (!componenteId) {
        setError('Seleccione un componente en todas las lÃ­neas.')
        return
      }

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setError(
          'La cantidad de cada componente debe ser mayor que cero.',
        )
        return
      }

      if (
        !Number.isFinite(merma) ||
        merma < 0 ||
        merma > 100
      ) {
        setError('La merma debe estar entre 0 y 100%.')
        return
      }

      detalle.push({
        componente_id: componenteId,
        cantidad,
        merma,
      })
    }

    if (
      new Set(detalle.map((item) => item.componente_id)).size !==
      detalle.length
    ) {
      setError(
        'No repita un mismo componente. Corrija las lÃ­neas duplicadas.',
      )
      return
    }

    const datos = {
      rendimiento,
      unidad_rendimiento: estructura.unidad_rendimiento.trim(),
      detalle,
    }

    setGuardando(true)

    try {
      let resultado

      if (modo === 'modificacion') {
        resultado = await consultarApi(
          `/api/estructura/${estructura.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(datos),
          },
        )
      } else if (modo === 'nuevo') {
        resultado = await consultarApi('/api/estructura', {
          method: 'POST',
          body: JSON.stringify({
            producto_id: Number(productoId),
            ...datos,
          }),
        })
      } else {
        setError(
          'Seleccione Nueva estructura o Modificar antes de guardar.',
        )
        return
      }

      const mensajeGuardado =
        modo === 'modificacion'
          ? `Estructura modificada. VersiÃ³n anterior: ${resultado.version_anterior}. Nueva versiÃ³n: ${resultado.version}.`
          : `Estructura creada correctamente. VersiÃ³n: ${resultado.version}.`

      await consultarEstructura(productoId)

      // Se establece despuÃ©s de consultar para que no se borre el mensaje.
      setMensaje(mensajeGuardado)
    } catch (err) {
      setError(`No se pudo guardar la estructura. ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  async function darDeBaja() {
    if (!estructura.id) {
      setError('No hay una estructura activa para dar de baja.')
      return
    }

    const confirmar = window.confirm(
      `Â¿Dar de baja la estructura del producto ${productoSeleccionado?.nombre ?? ''}, versiÃ³n ${estructura.version}?\n\nLa baja es lÃ³gica; los registros no se borrarÃ¡n fÃ­sicamente.`,
    )

    if (!confirmar) return

    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      await consultarApi(`/api/estructura/${estructura.id}`, {
        method: 'DELETE',
      })

      setEstructura({ ...estructuraVacia, detalle: [] })
      setModo('nuevo')
      setMensaje('Estructura dada de baja correctamente.')
    } catch (err) {
      setError(`No se pudo dar de baja la estructura. ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const soloConsulta = modo === 'consulta'

  return (
    <section className="structure-page">
      <div className="structure-toolbar">
        <div>
          <h2>Estructura de productos</h2>
          <p>
            Defina los componentes, cantidades, merma y rendimiento de cada
            producto elaborado.
          </p>
        </div>

        <div className="structure-toolbar-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => productoId && consultarEstructura(productoId)}
            disabled={!productoId || cargando || guardando}
          >
            Consultar
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={iniciarNueva}
            disabled={
              !productoId || Boolean(estructura.id) || guardando
            }
          >
            Nueva estructura
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Cerrar error"
          >
            Ã—
          </button>
        </div>
      )}

      {mensaje && (
        <div className="alert alert-success">
          <span>{mensaje}</span>
          <button
            type="button"
            onClick={() => setMensaje('')}
            aria-label="Cerrar mensaje"
          >
            Ã—
          </button>
        </div>
      )}

      <form className="structure-panel" onSubmit={guardarEstructura}>
        <div className="structure-section-heading">
          <div>
            <h3>Datos de la receta</h3>
            <p>
              Seleccione el producto elaborado que desea administrar.
            </p>
          </div>

          {estructura.version != null && (
            <span className="structure-version">
              VersiÃ³n {estructura.version}
            </span>
          )}
        </div>

        <div className="structure-form-grid">
          <label className="form-field structure-product-field">
            <span>
              Producto elaborado <b>*</b>
            </span>
            <select
              value={productoId}
              onChange={(e) => seleccionarProducto(e.target.value)}
              disabled={guardando}
              required
            >
              <option value="">Seleccione un producto...</option>
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.codigo} - {producto.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>
              Rendimiento <b>*</b>
            </span>
            <input
              type="number"
              min="0.000001"
              step="any"
              value={estructura.rendimiento}
              onChange={(e) =>
                actualizarCabecera('rendimiento', e.target.value)
              }
              disabled={soloConsulta || guardando}
              required
            />
          </label>

          <label className="form-field">
            <span>
              Unidad de rendimiento <b>*</b>
            </span>
            <input
              type="text"
              maxLength="20"
              placeholder="Ej.: KG, UN, PORCIÃ“N"
              value={estructura.unidad_rendimiento}
              onChange={(e) =>
                actualizarCabecera('unidad_rendimiento', e.target.value)
              }
              disabled={soloConsulta || guardando}
              required
            />
          </label>
        </div>

        <div className="structure-section-heading structure-detail-heading">
          <div>
            <h3>Componentes de la receta</h3>
            <p>La cantidad y la merma se guardan por cada componente.</p>
          </div>

          {!soloConsulta && (
            <button
              type="button"
              className="btn-secondary"
              onClick={agregarComponente}
              disabled={guardando}
            >
              + Agregar componente
            </button>
          )}
        </div>

        <div className="products-table-wrap">
          <table className="products-table structure-table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Merma (%)</th>
                {!soloConsulta && <th>Accion</th>}
              </tr>
            </thead>

            <tbody>
              {estructura.detalle.map((item, indice) => {
                const componente = componentes.find(
                  (c) =>
                    String(c.id) === String(item.componente_id),
                )

                return (
                  <tr key={`${indice}-${item.componente_id}`}>
                    <td className="structure-component-cell">
                      {soloConsulta ? (
                        <span>
                          {componente
                            ? `${componente.codigo} - ${componente.nombre}`
                            : `Componente ID ${item.componente_id}`}
                        </span>
                      ) : (
                        <select
                          value={item.componente_id}
                          onChange={(e) =>
                            actualizarLinea(
                              indice,
                              'componente_id',
                              e.target.value,
                            )
                          }
                          required
                        >
                          <option value="">Seleccione...</option>
                          {componentesFiltrados.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td>
                      {componente?.tipo ? (
                        <span
                          className={`type-tag ${
                            componente.tipo === 'ELABORADO'
                              ? 'type-elaborado'
                              : 'type-insumo'
                          }`}
                        >
                          {componente.tipo}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td>
                      {soloConsulta ? (
                        item.cantidad
                      ) : (
                        <input
                          className="structure-number-input"
                          type="number"
                          min="0.000001"
                          step="any"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarLinea(
                              indice,
                              'cantidad',
                              e.target.value,
                            )
                          }
                          required
                        />
                      )}
                    </td>

                    <td>{componente?.unidad || '-'}</td>

                    <td>
                      {soloConsulta ? (
                        `${item.merma}%`
                      ) : (
                        <input
                          className="structure-number-input"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={item.merma}
                          onChange={(e) =>
                            actualizarLinea(
                              indice,
                              'merma',
                              e.target.value,
                            )
                          }
                          required
                        />
                      )}
                    </td>

                    {!soloConsulta && (
                      <td>
                        <button
                          type="button"
                          className="btn-table-delete"
                          onClick={() => quitarComponente(indice)}
                          disabled={guardando}
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}

              {estructura.detalle.length === 0 && (
                <tr>
                  <td
                    colSpan={soloConsulta ? 5 : 6}
                    className="table-message"
                  >
                    {productoId
                      ? 'No hay componentes cargados en esta estructura.'
                      : 'Seleccione un producto elaborado para comenzar.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {modo !== 'consulta' && (
          <div className="structure-component-search">
            <label className="search-field">
              <span>Buscar componente en los selectores</span>
              <input
                type="search"
                placeholder="Buscar por cÃ³digo o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <p>
              La bÃºsqueda filtra las opciones disponibles. Los componentes
              existentes no se modifican hasta guardar.
            </p>
          </div>
        )}

        <div className="structure-footer">
          <span>
            {productoSeleccionado
              ? `${productoSeleccionado.codigo} Â· ${productoSeleccionado.nombre}`
              : 'Sin producto seleccionado'}
          </span>

          <div className="structure-footer-actions">
            {estructura.id && soloConsulta && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={iniciarModificacion}
                  disabled={guardando || cargando}
                >
                  Modificar
                </button>
                <button
                  type="button"
                  className="btn-table-delete"
                  onClick={darDeBaja}
                  disabled={guardando || cargando}
                >
                  Dar de baja
                </button>
              </>
            )}

            {!soloConsulta && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    productoId && consultarEstructura(productoId)
                  }
                  disabled={!productoId || guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={guardando || cargando}
                >
                  {guardando
                    ? 'Guardando...'
                    : modo === 'modificacion'
                      ? 'Guardar nueva version'
                      : 'Crear estructura'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {cargando && (
        <p className="structure-loading">
          Consultando informaciÃ³n...
        </p>
      )}
    </section>
  )
}
