import { useEffect, useMemo, useState } from 'react'
import './ReportePresentaciones.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

async function consultarPresentaciones() {
  const respuesta = await fetch(`${API_BASE}/api/presentaciones/reporte`)
  const contenido = await respuesta.text()
  let datos

  try {
    datos = contenido ? JSON.parse(contenido) : null
  } catch {
    throw new Error('El servidor devolvió una respuesta inválida.')
  }

  if (!respuesta.ok) {
    throw new Error(datos?.mensaje || datos?.error || `Error del servidor (${respuesta.status})`)
  }
  if (!Array.isArray(datos?.productos)) {
    throw new Error('La API no devolvió un listado válido de presentaciones.')
  }
  return datos.productos
}

function texto(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : String(valor)
}

function cantidad(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  const numero = Number(valor)
  return Number.isFinite(numero)
    ? numero.toLocaleString('es-AR', { maximumFractionDigits: 6 })
    : '—'
}

export default function ReportePresentaciones() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('TODAS')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      try {
        const datos = await consultarPresentaciones()
        if (!cancelado) {
          setProductos(datos)
          setError('')
        }
      } catch (err) {
        if (!cancelado) setError(err.message || 'No se pudieron cargar las presentaciones.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    void cargar()
    return () => { cancelado = true }
  }, [intento])

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    return productos
      .map((producto) => ({
        ...producto,
        presentaciones: producto.presentaciones.filter((presentacion) => {
          const coincideBusqueda =
            !termino ||
            [producto.codigo, producto.nombre, presentacion.nombre, presentacion.unidad, presentacion.unidad_nombre]
              .some((valor) => String(valor ?? '').toLocaleLowerCase('es').includes(termino))
          const coincideEstado =
            estado === 'TODAS' ||
            (estado === 'ACTIVAS' && presentacion.activo) ||
            (estado === 'INACTIVAS' && !presentacion.activo)
          return coincideBusqueda && coincideEstado
        }),
      }))
      .filter((producto) => producto.presentaciones.length > 0)
  }, [productos, busqueda, estado])

  const totalPresentaciones = productosFiltrados.reduce(
    (total, producto) => total + producto.presentaciones.length, 0,
  )

  function reintentar() {
    setCargando(true)
    setError('')
    setIntento((actual) => actual + 1)
  }

  return (
    <section className="reporte-presentaciones">
      <header className="reporte-presentaciones-cabecera">
        <div>
          <span className="reporte-presentaciones-eyebrow">ROTISERIA360</span>
          <h2>Reporte de presentaciones</h2>
          <p>Presentaciones registradas para cada producto insumo.</p>
        </div>
        <div className="reporte-presentaciones-acciones reporte-presentaciones-no-print">
          <button type="button" className="reporte-presentaciones-boton"
            onClick={() => window.print()}
            disabled={cargando || Boolean(error) || totalPresentaciones === 0}>
            Imprimir / Guardar PDF
          </button>
        </div>
      </header>

      <div className="reporte-presentaciones-filtros reporte-presentaciones-no-print">
        <label>
          <span>Buscar producto o presentación</span>
          <input type="search" value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Código, producto, presentación o unidad..." />
        </label>
        <label>
          <span>Estado de la presentación</span>
          <select value={estado} onChange={(evento) => setEstado(evento.target.value)}>
            <option value="TODAS">Todas</option>
            <option value="ACTIVAS">Activas</option>
            <option value="INACTIVAS">Inactivas</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="reporte-presentaciones-error reporte-presentaciones-no-print" role="alert">
          <span>{error}</span>
          <button type="button" onClick={reintentar}>Reintentar</button>
        </div>
      )}

      <div className="reporte-presentaciones-resumen">
        <span>{cargando ? 'Cargando presentaciones...' : `${totalPresentaciones} presentaciones en ${productosFiltrados.length} productos`}</span>
        <span>Generado: {new Date().toLocaleString('es-AR')}</span>
      </div>

      {cargando && <p className="reporte-presentaciones-vacio" role="status">Consultando presentaciones guardadas...</p>}
      {!cargando && !error && totalPresentaciones === 0 && (
        <p className="reporte-presentaciones-vacio">No hay presentaciones que coincidan con los filtros.</p>
      )}

      {!cargando && !error && totalPresentaciones > 0 && (
        <div className="reporte-presentaciones-lista">
          {productosFiltrados.map((producto) => (
            <article className="reporte-presentaciones-producto" key={producto.id}>
              <header className="reporte-presentaciones-producto-cabecera">
                <div>
                  <span className="reporte-presentaciones-codigo">{texto(producto.codigo)}</span>
                  <h3>{texto(producto.nombre)}</h3>
                </div>
                <span className={`reporte-presentaciones-estado-producto ${producto.activo ? 'activo' : 'inactivo'}`}>
                  {producto.activo ? 'Producto activo' : 'Producto inactivo'}
                </span>
              </header>
              <div className="reporte-presentaciones-datos">
                <div><dt>Presentaciones</dt><dd>{producto.presentaciones.length}</dd></div>
                <div><dt>Activas</dt><dd>{producto.presentaciones.filter((item) => item.activo).length}</dd></div>
                <div><dt>Inactivas</dt><dd>{producto.presentaciones.filter((item) => !item.activo).length}</dd></div>
              </div>
              <div className="reporte-presentaciones-tabla-contenedor">
                <table className="reporte-presentaciones-tabla">
                  <thead><tr><th>Presentación</th><th>Cantidad contenida</th><th>Unidad</th><th>Estado</th></tr></thead>
                  <tbody>
                    {producto.presentaciones.map((presentacion) => (
                      <tr key={presentacion.id}>
                        <td>{texto(presentacion.nombre)}</td>
                        <td>{cantidad(presentacion.cantidad_contenida)}</td>
                        <td>{presentacion.unidad ? `${presentacion.unidad} - ${presentacion.unidad_nombre ?? ''}` : texto(presentacion.unidad_nombre)}</td>
                        <td><span className={`reporte-presentaciones-estado ${presentacion.activo ? 'activa' : 'inactiva'}`}>{presentacion.activo ? 'Activa' : 'Inactiva'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="reporte-presentaciones-pie">
        ROTISERIA360 · Reporte de presentaciones · Incluye registros activos e inactivos
      </footer>
    </section>
  )
}
