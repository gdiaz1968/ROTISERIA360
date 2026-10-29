
import { useEffect, useMemo, useState } from 'react'
import './ReporteProductos.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

async function consultarProductos() {
  const respuesta = await fetch(`${API_BASE}/api/productos`)
  const contenido = await respuesta.text()

  let datos

  try {
    datos = contenido ? JSON.parse(contenido) : []
  } catch {
    throw new Error('El servidor devolvió una respuesta inválida.')
  }

  if (!respuesta.ok) {
    throw new Error(
      datos?.mensaje ||
        datos?.error ||
        `Error del servidor (${respuesta.status})`,
    )
  }

  if (!Array.isArray(datos)) {
    throw new Error('La API no devolvió un listado válido de productos.')
  }

  return datos
}

function ReporteProductos() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState('TODOS')
  const [estado, setEstado] = useState('TODOS')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError('')

      try {
        const datos = await consultarProductos()

        if (!cancelado) {
          setProductos(datos)
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'No se pudieron cargar los productos.')
        }
      } finally {
        if (!cancelado) {
          setCargando(false)
        }
      }
    }

    void cargar()

    return () => {
      cancelado = true
    }
  }, [])

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')

    return productos
      .filter((producto) => {
        const coincideBusqueda =
          !termino ||
          String(producto.codigo ?? '')
            .toLocaleLowerCase('es')
            .includes(termino) ||
          String(producto.nombre ?? '')
            .toLocaleLowerCase('es')
            .includes(termino)

        const coincideTipo =
          tipo === 'TODOS' || producto.tipo === tipo

        const coincideEstado =
          estado === 'TODOS' ||
          (estado === 'ACTIVO' && Boolean(producto.activo)) ||
          (estado === 'INACTIVO' && !producto.activo)

        return coincideBusqueda && coincideTipo && coincideEstado
      })
      .sort((a, b) =>
        String(a.codigo ?? '').localeCompare(
          String(b.codigo ?? ''),
          'es',
          { numeric: true, sensitivity: 'base' },
        ),
      )
  }, [productos, busqueda, tipo, estado])

  function imprimirReporte() {
    window.print()
  }

  return (
    <section className="reporte-productos">
      <div className="reporte-productos-cabecera">
        <div>
          <span className="reporte-eyebrow">ROTISERIA360</span>
          <h2>Reporte de productos</h2>
          <p>Listado de productos registrados en el sistema.</p>
        </div>

        <div className="reporte-acciones no-print">
          <button
            type="button"
            className="reporte-btn-secundario"
            onClick={imprimirReporte}
            disabled={cargando || Boolean(error)}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <div className="reporte-filtros no-print">
        <label>
          <span>Buscar producto</span>
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Código o nombre..."
          />
        </label>

        <label>
          <span>Tipo</span>
          <select
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value)}
          >
            <option value="TODOS">Todos</option>
            <option value="INSUMO">Insumo</option>
            <option value="ELABORADO">Elaborado</option>
          </select>
        </label>

        <label>
          <span>Estado</span>
          <select
            value={estado}
            onChange={(evento) => setEstado(evento.target.value)}
          >
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="reporte-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="reporte-resumen">
        <span>
          {cargando
            ? 'Cargando productos...'
            : `${productosFiltrados.length} productos`}
        </span>
        <span>
          Generado: {new Date().toLocaleString('es-AR')}
        </span>
      </div>

      <div className="reporte-tabla-contenedor">
        <table className="reporte-tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            {cargando && (
              <tr>
                <td colSpan={5} className="reporte-vacio">
                  Cargando productos...
                </td>
              </tr>
            )}

            {!cargando && !error && productosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="reporte-vacio">
                  No hay productos que coincidan con los filtros.
                </td>
              </tr>
            )}

            {!cargando &&
              productosFiltrados.map((producto) => (
                <tr key={producto.id}>
                  <td>{producto.codigo}</td>
                  <td>{producto.nombre}</td>
                  <td>{producto.tipo}</td>
                  <td>
                    {producto.unidad
                      ? `${producto.unidad} - ${producto.unidad_nombre ?? ''}`
                      : producto.unidad_nombre ?? '—'}
                  </td>
                  <td>{producto.activo ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="reporte-pie">
        ROTISERIA360 · Reporte de productos · Solo consulta
      </p>
    </section>
  )
}

export default ReporteProductos
