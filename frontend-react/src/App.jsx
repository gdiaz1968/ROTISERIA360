
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import EstructuraProductos from './components/EstructuraProductos'
import Costos from './components/Costos'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

const modulos = [
  { codigo: 'dashboard', nombre: 'Inicio', icono: '⌂' },
  { codigo: 'productos', nombre: 'Productos', icono: '▦' },
  { codigo: 'proveedores', nombre: 'Proveedores', icono: '♧' },
  { codigo: 'estructura', nombre: 'Estructura de productos', icono: '⚙' },
  { codigo: 'costos', nombre: 'Costos', icono: '$' },
  { codigo: 'ventas', nombre: 'Ventas de mostrador', icono: '▤' },
]

const productoVacio = {
  codigo: '',
  nombre: '',
  tipo: 'INSUMO',
  id_unidad: '',
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

function App() {
  const [moduloActivo, setModuloActivo] = useState('dashboard')
  const [productos, setProductos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(10)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)
  const [formulario, setFormulario] = useState(productoVacio)
  const [guardando, setGuardando] = useState(false)

  const cargarProductos = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const datos = await consultarApi('/api/productos')
      setProductos(Array.isArray(datos) ? datos : [])
    } catch (err) {
      setError(`No se pudieron cargar los productos. ${err.message}`)
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarUnidades = useCallback(async () => {
    try {
      const datos = await consultarApi('/api/unidades')
      setUnidades(Array.isArray(datos) ? datos : [])
    } catch (err) {
      setError(`No se pudieron cargar las unidades de medida. ${err.message}`)
    }
  }, [])

  // Cargar los datos al entrar en Productos.
  // La tarea se difiere a una microtarea para evitar ejecutar
  // las actualizaciones de estado durante la ejecución síncrona del efecto.
  useEffect(() => {
    if (moduloActivo !== 'productos') return undefined

    let cancelado = false

    const cargarDatos = async () => {
      if (cancelado) return

      await Promise.all([cargarProductos(), cargarUnidades()])
    }

    queueMicrotask(() => {
      if (!cancelado) {
        void cargarDatos()
      }
    })

    return () => {
      cancelado = true
    }
  }, [moduloActivo, cargarProductos, cargarUnidades])

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')

    return productos
      .filter((producto) => {
        if (!termino) return true

        return (
          String(producto.codigo ?? '')
            .toLocaleLowerCase('es')
            .includes(termino) ||
          String(producto.nombre ?? '')
            .toLocaleLowerCase('es')
            .includes(termino)
        )
      })
      .sort((a, b) => {
        const porCodigo = String(a.codigo ?? '').localeCompare(
          String(b.codigo ?? ''),
          'es',
          { numeric: true, sensitivity: 'base' },
        )

        return (
          porCodigo ||
          String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es', {
            sensitivity: 'base',
          })
        )
      })
  }, [productos, busqueda])

  const totalPaginas = Math.max(
    1,
    Math.ceil(productosFiltrados.length / filasPorPagina),
  )

  // Mantener la página dentro de los límites sin otro useEffect.
  const paginaActual = Math.min(pagina, totalPaginas)

  const productosPagina = productosFiltrados.slice(
    (paginaActual - 1) * filasPorPagina,
    paginaActual * filasPorPagina,
  )

  function abrirNuevoProducto() {
    setProductoEditando(null)
    setFormulario({ ...productoVacio })
    setError('')
    setMensaje('')
    setModalAbierto(true)
  }

  function abrirEdicion(producto) {
    setProductoEditando(producto)
    setFormulario({
      codigo: producto.codigo ?? '',
      nombre: producto.nombre ?? '',
      tipo: producto.tipo ?? 'INSUMO',
      id_unidad: String(producto.id_unidad ?? ''),
      activo: Boolean(producto.activo),
    })
    setError('')
    setMensaje('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (guardando) return
    setModalAbierto(false)
    setProductoEditando(null)
  }

  function actualizarCampo(evento) {
    const { name, value, type, checked } = evento.target

    setFormulario((actual) => ({
      ...actual,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function guardarProducto(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    const codigo = formulario.codigo.trim()
    const nombre = formulario.nombre.trim()
    const idUnidad = Number(formulario.id_unidad)

    if (!codigo || !nombre || !idUnidad || !formulario.tipo) {
      setError(
        'Completá el código, el nombre, el tipo y la unidad de medida.',
      )
      return
    }

    const datos = {
      codigo,
      nombre,
      tipo: formulario.tipo,
      id_unidad: idUnidad,
    }

    if (productoEditando) {
      datos.activo = formulario.activo
    }

    setGuardando(true)

    try {
      if (productoEditando) {
        await consultarApi(`/api/productos/${productoEditando.id}`, {
          method: 'PUT',
          body: JSON.stringify(datos),
        })
        setMensaje('Producto modificado correctamente.')
      } else {
        await consultarApi('/api/productos', {
          method: 'POST',
          body: JSON.stringify(datos),
        })
        setMensaje('Producto creado correctamente.')
      }

      setModalAbierto(false)
      setProductoEditando(null)
      await cargarProductos()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el producto.')
    } finally {
      setGuardando(false)
    }
  }

  async function darDeBaja(producto) {
    const confirmar = window.confirm(
      `¿Confirmás la baja del producto ${producto.codigo} - ${producto.nombre}?\n\nEl registro no se eliminará de la base de datos.`,
    )

    if (!confirmar) return

    setError('')
    setMensaje('')

    try {
      await consultarApi(`/api/productos/${producto.id}`, {
        method: 'DELETE',
      })

      setMensaje(`El producto ${producto.codigo} fue dado de baja.`)
      await cargarProductos()
    } catch (err) {
      setError(err.message || 'No se pudo dar de baja el producto.')
    }
  }

  function seleccionarModulo(codigo) {
    setModuloActivo(codigo)
    setError('')
    setMensaje('')
  }

  const nombreModulo =
    modulos.find((modulo) => modulo.codigo === moduloActivo)?.nombre ?? 'Inicio'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R360</div>
          <div>
            <strong>ROTISERIA360</strong>
            <span>Sistema de gestión</span>
          </div>
        </div>

        <div className="menu-caption">MENÚ PRINCIPAL</div>

        <nav className="menu">
          {modulos.map((modulo) => (
            <button
              key={modulo.codigo}
              className={`menu-item ${
                moduloActivo === modulo.codigo ? 'selected' : ''
              }`}
              type="button"
              onClick={() => seleccionarModulo(modulo.codigo)}
            >
              <span className="menu-icon">{modulo.icono}</span>
              <span>{modulo.nombre}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          ROTISERIA360
          <span>Versión de desarrollo</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Sistema / {nombreModulo}</span>
            <h1>
              {moduloActivo === 'productos'
                ? 'Gestión de productos'
                : moduloActivo === 'dashboard'
                  ? 'Panel de gestión'
                  : nombreModulo}
            </h1>
          </div>

          <div className="user-info">
            <div className="user-avatar">GD</div>
            <div>
              <strong>Administrador</strong>
              <span>Usuario del sistema</span>
            </div>
          </div>
        </header>

        <section className="content">
          {moduloActivo === 'dashboard' && (
            <>
              <div className="welcome">
                <div>
                  <span className="eyebrow">ROTISERIA360 · REACT</span>
                  <h2>Bienvenido al sistema</h2>
                  <p>
                    Desde aquí vamos a administrar los productos, proveedores,
                    costos y las ventas de mostrador.
                  </p>
                </div>
                <div className="welcome-mark">360</div>
              </div>

              <div className="section-heading">
                <div>
                  <h2>Acceso a módulos</h2>
                  <p>Seleccioná el área que querés utilizar.</p>
                </div>
              </div>

              <div className="module-grid">
                {modulos.slice(1).map((modulo) => (
                  <button
                    type="button"
                    className="module-card"
                    key={modulo.codigo}
                    onClick={() => seleccionarModulo(modulo.codigo)}
                  >
                    <div className="module-icon">{modulo.icono}</div>
                    <strong>{modulo.nombre}</strong>
                    <span>
                      Ingresar al módulo <span aria-hidden="true">→</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="status-panel">
                <div className="status-dot" />
                <div>
                  <strong>Interfaz React iniciada</strong>
                  <p>
                    El módulo Productos ya está conectado a las API existentes.
                  </p>
                </div>
              </div>
            </>
          )}

          {moduloActivo === 'productos' && (
            <section className="products-page">
              <div className="products-toolbar">
                <div>
                  <h2>Productos</h2>
                  <p>Administración de insumos y productos elaborados.</p>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={abrirNuevoProducto}
                >
                  + Nuevo producto
                </button>
              </div>

              {error && (
                <div className="alert alert-error" role="alert">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError('')}
                    aria-label="Cerrar error"
                  >
                    ×
                  </button>
                </div>
              )}

              {mensaje && (
                <div className="alert alert-success" role="status">
                  <span>{mensaje}</span>
                  <button
                    type="button"
                    onClick={() => setMensaje('')}
                    aria-label="Cerrar mensaje"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="products-panel">
                <div className="products-filters">
                  <label className="search-field">
                    <span>Buscar</span>
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(evento) => {
                        setBusqueda(evento.target.value)
                        setPagina(1)
                      }}
                      placeholder="Código o nombre del producto..."
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
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th>Unidad</th>
                        <th>Estado</th>
                        <th className="actions-column">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargando && (
                        <tr>
                          <td colSpan="6" className="table-message">
                            Cargando productos...
                          </td>
                        </tr>
                      )}

                      {!cargando && productosPagina.length === 0 && (
                        <tr>
                          <td colSpan="6" className="table-message">
                            {busqueda
                              ? 'No hay productos que coincidan con la búsqueda.'
                              : 'No hay productos activos para mostrar.'}
                          </td>
                        </tr>
                      )}

                      {!cargando &&
                        productosPagina.map((producto) => (
                          <tr key={producto.id}>
                            <td className="product-code">{producto.codigo}</td>
                            <td>{producto.nombre}</td>
                            <td>
                              <span
                                className={`type-tag ${
                                  producto.tipo === 'ELABORADO'
                                    ? 'type-elaborado'
                                    : 'type-insumo'
                                }`}
                              >
                                {producto.tipo}
                              </span>
                            </td>
                            <td>
                              {producto.unidad
                                ? `${producto.unidad} - ${producto.unidad_nombre ?? ''}`
                                : producto.unidad_nombre ?? '—'}
                            </td>
                            <td>
                              <span
                                className={`state-tag ${
                                  producto.activo
                                    ? 'state-active'
                                    : 'state-inactive'
                                }`}
                              >
                                {producto.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn-table-edit"
                                  onClick={() => abrirEdicion(producto)}
                                >
                                  Editar
                                </button>
                                {producto.activo && (
                                  <button
                                    type="button"
                                    className="btn-table-delete"
                                    onClick={() => darDeBaja(producto)}
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
                    {productosFiltrados.length === 0
                      ? '0 productos'
                      : `${(paginaActual - 1) * filasPorPagina + 1}–${Math.min(
                          paginaActual * filasPorPagina,
                          productosFiltrados.length,
                        )} de ${productosFiltrados.length} productos`}
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
            </section>
          )}

          {moduloActivo === 'estructura' && <EstructuraProductos />}

          {moduloActivo === 'costos' && <Costos />}

          {moduloActivo !== 'dashboard' &&
            moduloActivo !== 'productos' &&
            moduloActivo !== 'estructura' &&
            moduloActivo !== 'costos' && (
              <div className="coming-soon">
                <div className="coming-soon-icon">
                  {modulos.find((modulo) => modulo.codigo === moduloActivo)?.icono}
                </div>
                <h2>{nombreModulo}</h2>
                <p>Este módulo se incorporará progresivamente a React.</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => seleccionarModulo('dashboard')}
                >
                  Volver al inicio
                </button>
              </div>
            )}
        </section>
      </main>

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
            aria-labelledby="product-modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">MAESTRO DE PRODUCTOS</span>
                <h2 id="product-modal-title">
                  {productoEditando ? 'Modificar producto' : 'Nuevo producto'}
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

            <form onSubmit={guardarProducto}>
              {error && (
                <div className="alert alert-error modal-error" role="alert">
                  {error}
                </div>
              )}

              <div className="form-grid">
                <label className="form-field">
                  <span>
                    Código <b>*</b>
                  </span>
                  <input
                    name="codigo"
                    value={formulario.codigo}
                    onChange={actualizarCampo}
                    maxLength={50}
                    required
                    autoFocus
                  />
                </label>

                <label className="form-field">
                  <span>
                    Tipo de producto <b>*</b>
                  </span>
                  <select
                    name="tipo"
                    value={formulario.tipo}
                    onChange={actualizarCampo}
                    required
                  >
                    <option value="INSUMO">INSUMO</option>
                    <option value="ELABORADO">ELABORADO</option>
                  </select>
                </label>

                <label className="form-field form-field-wide">
                  <span>
                    Nombre <b>*</b>
                  </span>
                  <input
                    name="nombre"
                    value={formulario.nombre}
                    onChange={actualizarCampo}
                    maxLength={200}
                    required
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>
                    Unidad de medida <b>*</b>
                  </span>
                  <select
                    name="id_unidad"
                    value={formulario.id_unidad}
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

                {productoEditando && (
                  <label className="active-checkbox">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formulario.activo}
                      onChange={actualizarCampo}
                    />
                    <span>Producto activo</span>
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
                    : productoEditando
                      ? 'Guardar cambios'
                      : 'Crear producto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
