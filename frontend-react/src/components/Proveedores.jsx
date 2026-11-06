import { useCallback, useEffect, useMemo, useState } from 'react'
import './Proveedores.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

const proveedorVacio = {
  codigo: '',
  nombre: '',
  cuit: '',
  telefono: '',
  email: '',
  direccion: '',
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

function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('ACTIVOS')
  const [pagina, setPagina] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(10)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [proveedorEditando, setProveedorEditando] = useState(null)
  const [formulario, setFormulario] = useState({ ...proveedorVacio })

  const cargarProveedores = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const ruta =
        estadoFiltro === 'TODOS'
          ? '/api/proveedores?todos=true'
          : estadoFiltro === 'INACTIVOS'
            ? '/api/proveedores?todos=true'
            : '/api/proveedores'

      const datos = await consultarApi(ruta)
      const lista = Array.isArray(datos) ? datos : []

      setProveedores(
        estadoFiltro === 'INACTIVOS'
          ? lista.filter((proveedor) => !proveedor.activo)
          : lista,
      )
    } catch (err) {
      setError(`No se pudieron cargar los proveedores. ${err.message}`)
      setProveedores([])
    } finally {
      setCargando(false)
    }
  }, [estadoFiltro])

  useEffect(() => {
    void cargarProveedores()
  }, [cargarProveedores])

  const proveedoresFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')

    return proveedores
      .filter((proveedor) => {
        if (!termino) return true

        return [
          proveedor.codigo,
          proveedor.nombre,
          proveedor.cuit,
          proveedor.telefono,
          proveedor.email,
        ].some((valor) =>
          String(valor ?? '').toLocaleLowerCase('es').includes(termino),
        )
      })
      .sort((a, b) =>
        String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es', {
          sensitivity: 'base',
        }),
      )
  }, [proveedores, busqueda])

  const totalPaginas = Math.max(
    1,
    Math.ceil(proveedoresFiltrados.length / filasPorPagina),
  )
  const paginaActual = Math.min(pagina, totalPaginas)

  const proveedoresPagina = proveedoresFiltrados.slice(
    (paginaActual - 1) * filasPorPagina,
    paginaActual * filasPorPagina,
  )

  function abrirNuevo() {
    setProveedorEditando(null)
    setFormulario({ ...proveedorVacio })
    setError('')
    setMensaje('')
    setModalAbierto(true)
  }

  function abrirEdicion(proveedor) {
    setProveedorEditando(proveedor)
    setFormulario({
      codigo: proveedor.codigo ?? '',
      nombre: proveedor.nombre ?? '',
      cuit: proveedor.cuit ?? '',
      telefono: proveedor.telefono ?? '',
      email: proveedor.email ?? '',
      direccion: proveedor.direccion ?? '',
      activo: Boolean(proveedor.activo),
    })
    setError('')
    setMensaje('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (guardando) return
    setModalAbierto(false)
    setProveedorEditando(null)
  }

  function actualizarCampo(evento) {
    const { name, value, type, checked } = evento.target

    setFormulario((actual) => ({
      ...actual,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function guardarProveedor(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    const datos = {
      codigo: formulario.codigo.trim(),
      nombre: formulario.nombre.trim(),
      cuit: formulario.cuit.trim() || null,
      telefono: formulario.telefono.trim() || null,
      email: formulario.email.trim() || null,
      direccion: formulario.direccion.trim() || null,
    }

    if (!datos.codigo || !datos.nombre) {
      setError('El código y el nombre son obligatorios.')
      return
    }

    if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
      setError('Ingresá una dirección de email válida.')
      return
    }

    if (proveedorEditando) {
      datos.activo = formulario.activo
    }

    setGuardando(true)

    try {
      if (proveedorEditando) {
        await consultarApi(`/api/proveedores/${proveedorEditando.id}`, {
          method: 'PUT',
          body: JSON.stringify(datos),
        })
        setMensaje('Proveedor modificado correctamente.')
      } else {
        await consultarApi('/api/proveedores', {
          method: 'POST',
          body: JSON.stringify(datos),
        })
        setMensaje('Proveedor creado correctamente.')
      }

      setModalAbierto(false)
      setProveedorEditando(null)
      await cargarProveedores()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el proveedor.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(proveedor) {
    const nuevoEstado = !proveedor.activo
    const accion = nuevoEstado ? 'reactivar' : 'dar de baja'

    const confirmar = window.confirm(
      `¿Confirmás ${accion} al proveedor ${proveedor.codigo} - ${proveedor.nombre}?`,
    )

    if (!confirmar) return

    setError('')
    setMensaje('')

    try {
      await consultarApi(`/api/proveedores/${proveedor.id}`, {
        method: nuevoEstado ? 'PUT' : 'DELETE',
        ...(nuevoEstado
          ? {
              body: JSON.stringify({
                codigo: proveedor.codigo,
                nombre: proveedor.nombre,
                cuit: proveedor.cuit ?? '',
                telefono: proveedor.telefono ?? '',
                email: proveedor.email ?? '',
                direccion: proveedor.direccion ?? '',
                activo: true,
              }),
            }
          : {}),
      })

      setMensaje(
        nuevoEstado
          ? `El proveedor ${proveedor.codigo} fue reactivado.`
          : `El proveedor ${proveedor.codigo} fue dado de baja.`,
      )

      await cargarProveedores()
    } catch (err) {
      setError(err.message || `No se pudo ${accion} el proveedor.`)
    }
  }

  return (
    <section className="providers-page">
      <div className="products-toolbar">
        <div>
          <h2>Proveedores</h2>
          <p>Administración de proveedores y datos de contacto.</p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={abrirNuevo}
        >
          + Nuevo proveedor
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

      <div className="products-panel">
        <div className="products-filters providers-filters">
          <label className="search-field">
            <span>Buscar proveedor</span>
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value)
                setPagina(1)
              }}
              placeholder="Código, nombre, CUIT, teléfono o email..."
            />
          </label>

          <label className="provider-state-filter">
            <span>Estado</span>
            <select
              value={estadoFiltro}
              onChange={(evento) => {
                setEstadoFiltro(evento.target.value)
                setPagina(1)
              }}
            >
              <option value="ACTIVOS">Activos</option>
              <option value="INACTIVOS">Inactivos</option>
              <option value="TODOS">Todos</option>
            </select>
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
          <table className="products-table providers-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>CUIT</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Estado</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando && (
                <tr>
                  <td colSpan="7" className="table-message">
                    Cargando proveedores...
                  </td>
                </tr>
              )}

              {!cargando && proveedoresPagina.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-message">
                    {busqueda
                      ? 'No hay proveedores que coincidan con la búsqueda.'
                      : 'No hay proveedores para mostrar.'}
                  </td>
                </tr>
              )}

              {!cargando &&
                proveedoresPagina.map((proveedor) => (
                  <tr key={proveedor.id}>
                    <td className="product-code">{proveedor.codigo}</td>
                    <td>{proveedor.nombre}</td>
                    <td>{proveedor.cuit || '—'}</td>
                    <td>{proveedor.telefono || '—'}</td>
                    <td>{proveedor.email || '—'}</td>
                    <td>
                      <span
                        className={`state-tag ${
                          proveedor.activo ? 'state-active' : 'state-inactive'
                        }`}
                      >
                        {proveedor.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-table-edit"
                          onClick={() => abrirEdicion(proveedor)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className={
                            proveedor.activo
                              ? 'btn-table-delete'
                              : 'btn-table-reactivate'
                          }
                          onClick={() => cambiarEstado(proveedor)}
                        >
                          {proveedor.activo ? 'Dar de baja' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="products-pagination">
          <span>
            {proveedoresFiltrados.length === 0
              ? '0 proveedores'
              : `${(paginaActual - 1) * filasPorPagina + 1}–${Math.min(
                  paginaActual * filasPorPagina,
                  proveedoresFiltrados.length,
                )} de ${proveedoresFiltrados.length} proveedores`}
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
            className="product-modal provider-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">MAESTRO DE PROVEEDORES</span>
                <h2 id="provider-modal-title">
                  {proveedorEditando ? 'Modificar proveedor' : 'Nuevo proveedor'}
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

            <form onSubmit={guardarProveedor}>
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
                    CUIT
                  </span>
                  <input
                    name="cuit"
                    value={formulario.cuit}
                    onChange={actualizarCampo}
                    maxLength={20}
                    placeholder="Ej.: 30-12345678-9"
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>
                    Nombre / Razón social <b>*</b>
                  </span>
                  <input
                    name="nombre"
                    value={formulario.nombre}
                    onChange={actualizarCampo}
                    maxLength={200}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Teléfono</span>
                  <input
                    name="telefono"
                    value={formulario.telefono}
                    onChange={actualizarCampo}
                    maxLength={50}
                  />
                </label>

                <label className="form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    value={formulario.email}
                    onChange={actualizarCampo}
                    maxLength={150}
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>Dirección</span>
                  <input
                    name="direccion"
                    value={formulario.direccion}
                    onChange={actualizarCampo}
                    maxLength={250}
                  />
                </label>

                {proveedorEditando && (
                  <label className="active-checkbox">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formulario.activo}
                      onChange={actualizarCampo}
                    />
                    <span>Proveedor activo</span>
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
                    : proveedorEditando
                      ? 'Guardar cambios'
                      : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

export default Proveedores