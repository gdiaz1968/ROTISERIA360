import { useEffect, useMemo, useState } from 'react'
import './Presentaciones.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

const presentacionVacia = {
  nombre: '',
  cantidad_contenida: '1',
  id_unidad_contenido: '',
  activo: true,
}

async function consultarApi(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })

  const contenido = await respuesta.text()
  let datos = null

  if (contenido) {
    try {
      datos = JSON.parse(contenido)
    } catch {
      datos = { error: contenido }
    }
  }

  if (!respuesta.ok) {
    throw new Error(
      datos?.mensaje ||
        datos?.error ||
        `Error del servidor (${respuesta.status})`,
    )
  }

  return datos
}

function Presentaciones() {
  const [productos, setProductos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [productoId, setProductoId] = useState('')
  const [presentaciones, setPresentaciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(10)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [presentacionEditando, setPresentacionEditando] = useState(null)
  const [formulario, setFormulario] = useState(presentacionVacia)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let cancelado = false

    async function cargarDatosIniciales() {
      try {
        const [datosProductos, datosUnidades] = await Promise.all([
          consultarApi('/api/productos'),
          consultarApi('/api/unidades'),
        ])

        if (cancelado) return

        const insumos = (Array.isArray(datosProductos) ? datosProductos : [])
          .filter(
            (producto) =>
              producto.tipo === 'INSUMO' && producto.activo,
          )
          .sort((a, b) =>
            String(a.codigo ?? '').localeCompare(
              String(b.codigo ?? ''),
              'es',
              { numeric: true, sensitivity: 'base' },
            ),
          )

        setProductos(insumos)
        setUnidades(Array.isArray(datosUnidades) ? datosUnidades : [])
        setProductoId(insumos.length ? String(insumos[0].id) : '')
      } catch (err) {
        if (!cancelado) {
          setError(
            `No se pudieron cargar los productos o las unidades. ${err.message}`,
          )
        }
      }
    }

    void cargarDatosIniciales()

    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (!productoId) return

    let cancelado = false

    async function cargar() {
      try {
        const datos = await consultarApi(
          `/api/presentaciones/producto/${productoId}`,
        )

        if (cancelado) return

        setPresentaciones(Array.isArray(datos) ? datos : [])
        setError('')
      } catch (err) {
        if (cancelado) return

        setError(
          `No se pudieron cargar las presentaciones. ${err.message}`,
        )
        setPresentaciones([])
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    void cargar()

    return () => {
      cancelado = true
    }
  }, [productoId])

  async function recargarPresentaciones(id = productoId) {
    if (!id) {
      setPresentaciones([])
      setCargando(false)
      return
    }

    setCargando(true)

    try {
      const datos = await consultarApi(
        `/api/presentaciones/producto/${id}`,
      )
      setPresentaciones(Array.isArray(datos) ? datos : [])
      setError('')
    } catch (err) {
      setError(
        `No se pudieron cargar las presentaciones. ${err.message}`,
      )
      setPresentaciones([])
    } finally {
      setCargando(false)
    }
  }

  const productoSeleccionado = productos.find(
    (producto) => String(producto.id) === productoId,
  )

  const presentacionesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')

    return presentaciones
      .filter((presentacion) => {
        if (!termino) return true

        return (
          String(presentacion.nombre ?? '')
            .toLocaleLowerCase('es')
            .includes(termino) ||
          String(presentacion.unidad ?? '')
            .toLocaleLowerCase('es')
            .includes(termino) ||
          String(presentacion.unidad_nombre ?? '')
            .toLocaleLowerCase('es')
            .includes(termino)
        )
      })
      .sort((a, b) =>
        String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es', {
          numeric: true,
          sensitivity: 'base',
        }),
      )
  }, [presentaciones, busqueda])

  const totalPaginas = Math.max(
    1,
    Math.ceil(presentacionesFiltradas.length / filasPorPagina),
  )
  const paginaActual = Math.min(pagina, totalPaginas)
  const presentacionesPagina = presentacionesFiltradas.slice(
    (paginaActual - 1) * filasPorPagina,
    paginaActual * filasPorPagina,
  )

  function abrirNuevaPresentacion() {
    setPresentacionEditando(null)
    setFormulario({
      ...presentacionVacia,
      id_unidad_contenido: unidades.length ? String(unidades[0].id) : '',
    })
    setError('')
    setMensaje('')
    setModalAbierto(true)
  }

  function abrirEdicion(presentacion) {
    setPresentacionEditando(presentacion)
    setFormulario({
      nombre: presentacion.nombre ?? '',
      cantidad_contenida: String(presentacion.cantidad_contenida ?? ''),
      id_unidad_contenido: String(presentacion.id_unidad_contenido ?? ''),
      activo: Boolean(presentacion.activo),
    })
    setError('')
    setMensaje('')
    setModalAbierto(true)
  }

  function actualizarCampo(evento) {
    const { name, value, type, checked } = evento.target
    setFormulario((actual) => ({
      ...actual,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function cerrarModal() {
    if (guardando) return
    setModalAbierto(false)
    setPresentacionEditando(null)
  }

  async function guardarPresentacion(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    const nombre = formulario.nombre.trim()
    const cantidad = Number(formulario.cantidad_contenida)
    const idUnidad = Number(formulario.id_unidad_contenido)

    if (!productoId) {
      setError('Seleccioná un producto insumo.')
      return
    }

    if (!nombre || !Number.isFinite(cantidad) || cantidad <= 0 || !idUnidad) {
      setError('Completá el nombre, una cantidad mayor que cero y la unidad.')
      return
    }

    const datos = {
      nombre,
      cantidad_contenida: cantidad,
      id_unidad_contenido: idUnidad,
    }

    if (presentacionEditando) {
      datos.activo = formulario.activo
    } else {
      datos.id_producto = Number(productoId)
      datos.activo = formulario.activo
    }

    setGuardando(true)

    try {
      if (presentacionEditando) {
        await consultarApi(
          `/api/presentaciones/${presentacionEditando.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(datos),
          },
        )
        setMensaje('Presentación modificada correctamente.')
      } else {
        await consultarApi('/api/presentaciones', {
          method: 'POST',
          body: JSON.stringify(datos),
        })
        setMensaje('Presentación creada correctamente.')
      }

      setModalAbierto(false)
      setPresentacionEditando(null)
      await recargarPresentaciones()
    } catch (err) {
      setError(err.message || 'No se pudo guardar la presentación.')
    } finally {
      setGuardando(false)
    }
  }

  async function darDeBaja(presentacion) {
    const confirmar = window.confirm(
      `¿Confirmás dar de baja la presentación "${presentacion.nombre}"?\n\nEl registro se conservará en la base de datos.`,
    )

    if (!confirmar) return

    setError('')
    setMensaje('')

    try {
      await consultarApi(`/api/presentaciones/${presentacion.id}`, {
        method: 'DELETE',
      })
      setMensaje(`La presentación "${presentacion.nombre}" fue dada de baja.`)
      await recargarPresentaciones()
    } catch (err) {
      setError(err.message || 'No se pudo dar de baja la presentación.')
    }
  }

  return (
    <section className="presentaciones-page">
      <div className="presentaciones-toolbar">
        <div>
          <h2>Presentaciones de productos</h2>
          <p>Administración de envases, formatos y cantidades de los insumos.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={abrirNuevaPresentacion}
          disabled={!productoId || unidades.length === 0}
        >
          + Nueva presentación
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Cerrar error">
            ×
          </button>
        </div>
      )}

      {mensaje && (
        <div className="alert alert-success" role="status">
          <span>{mensaje}</span>
          <button type="button" onClick={() => setMensaje('')} aria-label="Cerrar mensaje">
            ×
          </button>
        </div>
      )}

      <div className="presentaciones-panel">
        <div className="presentaciones-producto">
          <label className="form-field">
            <span>Producto insumo</span>
            <select
              value={productoId}
              onChange={(evento) => {
                const nuevoProductoId = evento.target.value
                setProductoId(nuevoProductoId)
                setPagina(1)
                setBusqueda('')
                setError('')
                setMensaje('')
                if (!nuevoProductoId) {
                  setPresentaciones([])
                  setCargando(false)
                } else {
                  setCargando(true)
                }
              }}
            >
              <option value="">Seleccionar producto...</option>
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.codigo} - {producto.nombre}
                </option>
              ))}
            </select>
          </label>

          {productoSeleccionado && (
            <div className="presentaciones-producto-info">
              <span>Producto seleccionado</span>
              <strong>
                {productoSeleccionado.codigo} - {productoSeleccionado.nombre}
              </strong>
            </div>
          )}
        </div>

        {!productos.length && (
          <p className="presentaciones-empty">
            No hay productos insumo activos para seleccionar.
          </p>
        )}

        <div className="products-filters">
          <label className="search-field">
            <span>Buscar presentación</span>
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value)
                setPagina(1)
              }}
              placeholder="Nombre o unidad..."
            />
          </label>

          <label className="page-size-field">
            <span>Filas por página</span>
            <select
              value={filasPorPagina}
              onChange={(evento) => {
                setFilasPorPagina(Number(evento.target.value))
                setPagina(1)
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>Presentación</th>
                <th>Cantidad contenida</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan="5" className="table-message">
                    Cargando presentaciones...
                  </td>
                </tr>
              )}

              {!cargando && presentacionesPagina.length === 0 && (
                <tr>
                  <td colSpan="5" className="table-message">
                    {productoId
                      ? 'No hay presentaciones para mostrar.'
                      : 'Seleccioná un producto insumo.'}
                  </td>
                </tr>
              )}

              {!cargando &&
                presentacionesPagina.map((presentacion) => (
                  <tr key={presentacion.id}>
                    <td>{presentacion.nombre}</td>
                    <td>{presentacion.cantidad_contenida}</td>
                    <td>
                      {presentacion.unidad
                        ? `${presentacion.unidad} - ${presentacion.unidad_nombre ?? ''}`
                        : presentacion.unidad_nombre ?? '—'}
                    </td>
                    <td>
                      <span
                        className={`state-tag ${
                          presentacion.activo ? 'state-active' : 'state-inactive'
                        }`}
                      >
                        {presentacion.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-table-edit"
                          onClick={() => abrirEdicion(presentacion)}
                        >
                          Editar
                        </button>
                        {presentacion.activo && (
                          <button
                            type="button"
                            className="btn-table-delete"
                            onClick={() => darDeBaja(presentacion)}
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="products-pagination">
          <span>
            {presentacionesFiltradas.length === 0
              ? '0 presentaciones'
              : `${(paginaActual - 1) * filasPorPagina + 1}–${Math.min(
                  paginaActual * filasPorPagina,
                  presentacionesFiltradas.length,
                )} de ${presentacionesFiltradas.length} presentaciones`}
          </span>

          <div className="pagination-buttons">
            <button
              type="button"
              disabled={paginaActual <= 1}
              onClick={() => setPagina((actual) => actual - 1)}
            >
              Anterior
            </button>
            <span>
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina((actual) => actual + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <div
          className="modal-overlay"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModal()
          }}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="presentacion-modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">MAESTRO DE PRESENTACIONES</span>
                <h2 id="presentacion-modal-title">
                  {presentacionEditando ? 'Modificar presentación' : 'Nueva presentación'}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={cerrarModal}
                disabled={guardando}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarPresentacion}>
              {error && (
                <div className="alert alert-error modal-error" role="alert">
                  {error}
                </div>
              )}

              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <span>Producto insumo</span>
                  <input
                    value={
                      productoSeleccionado
                        ? `${productoSeleccionado.codigo} - ${productoSeleccionado.nombre}`
                        : ''
                    }
                    readOnly
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>Nombre de la presentación *</span>
                  <input
                    name="nombre"
                    value={formulario.nombre}
                    onChange={actualizarCampo}
                    maxLength={200}
                    placeholder="Ej.: Bolsa de 25 kg"
                    required
                    autoFocus
                  />
                </label>

                <label className="form-field">
                  <span>Cantidad contenida *</span>
                  <input
                    name="cantidad_contenida"
                    type="number"
                    min="0.000001"
                    step="any"
                    value={formulario.cantidad_contenida}
                    onChange={actualizarCampo}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Unidad de contenido *</span>
                  <select
                    name="id_unidad_contenido"
                    value={formulario.id_unidad_contenido}
                    onChange={actualizarCampo}
                    required
                  >
                    <option value="">Seleccionar unidad...</option>
                    {unidades.map((unidad) => (
                      <option key={unidad.id} value={unidad.id}>
                        {unidad.codigo} - {unidad.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                {presentacionEditando && (
                  <label className="active-checkbox">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formulario.activo}
                      onChange={actualizarCampo}
                    />
                    <span>Presentación activa</span>
                  </label>
                )}
              </div>

              <p className="required-note">* Campos obligatorios</p>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando...'
                    : presentacionEditando
                      ? 'Guardar cambios'
                      : 'Crear presentación'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

export default Presentaciones
