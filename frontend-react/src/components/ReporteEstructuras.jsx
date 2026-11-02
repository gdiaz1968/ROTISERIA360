import { useEffect, useMemo, useState } from 'react'
import './ReporteEstructuras.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

function valorEscalar(valor) {
  return typeof valor === 'string' || typeof valor === 'number'
    ? valor
    : null
}

function normalizarEstructuras(estructuras) {
  return estructuras.map((estructura, indice) => {
    if (
      !estructura ||
      typeof estructura !== 'object' ||
      Array.isArray(estructura) ||
      (typeof estructura.id !== 'string' &&
        typeof estructura.id !== 'number') ||
      String(estructura.id).trim() === '' ||
      typeof estructura.activo !== 'boolean'
    ) {
      throw new Error(
        `La estructura en la posición ${indice + 1} tiene datos inválidos.`,
      )
    }

    const detalle = Array.isArray(estructura.detalle)
      ? estructura.detalle
          .filter(
            (componente) =>
              componente &&
              typeof componente === 'object' &&
              !Array.isArray(componente),
          )
          .map((componente, indiceComponente) => ({
            id:
              valorEscalar(componente.id) ??
              `${estructura.id}-componente-${indiceComponente}`,
            componente_codigo: valorEscalar(componente.componente_codigo),
            componente_nombre: valorEscalar(componente.componente_nombre),
            componente_tipo: valorEscalar(componente.componente_tipo),
            componente_unidad: valorEscalar(componente.componente_unidad),
            componente_unidad_nombre: valorEscalar(
              componente.componente_unidad_nombre,
            ),
            cantidad: valorEscalar(componente.cantidad),
            merma: valorEscalar(componente.merma),
          }))
      : []

    return {
      id: estructura.id,
      producto_codigo: valorEscalar(estructura.producto_codigo),
      producto_nombre: valorEscalar(estructura.producto_nombre),
      version: valorEscalar(estructura.version),
      activo: estructura.activo,
      rendimiento: valorEscalar(estructura.rendimiento),
      unidad_rendimiento: valorEscalar(estructura.unidad_rendimiento),
      detalle,
    }
  })
}

async function consultarEstructuras() {
  const respuesta = await fetch(`${API_BASE}/api/estructura/reporte`)
  const contenido = await respuesta.text()

  let datos

  try {
    datos = contenido ? JSON.parse(contenido) : null
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

  if (!Array.isArray(datos?.estructuras)) {
    throw new Error('La API no devolvió un listado válido de estructuras.')
  }

  return normalizarEstructuras(datos.estructuras)
}

function texto(valor) {
  return valor === null || valor === undefined || valor === ''
    ? '—'
    : String(valor)
}

function cantidad(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'

  const numero = Number(valor)

  return Number.isFinite(numero)
    ? numero.toLocaleString('es-AR', { maximumFractionDigits: 6 })
    : '—'
}

export default function ReporteEstructuras() {
  const [estructuras, setEstructuras] = useState([])
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [estado, setEstado] = useState('TODAS')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      try {
        const datos = await consultarEstructuras()

        if (!cancelado) {
          setEstructuras(datos)
          setError('')
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'No se pudieron cargar las estructuras.')
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
  }, [intento])

  const estructurasFiltradas = useMemo(() => {
    const terminoCodigo = codigo.trim().toLocaleLowerCase('es')
    const terminoNombre = nombre.trim().toLocaleLowerCase('es')

    return estructuras.filter((estructura) => {
      const coincideCodigo = String(estructura.producto_codigo ?? '')
        .toLocaleLowerCase('es')
        .includes(terminoCodigo)
      const coincideNombre = String(estructura.producto_nombre ?? '')
        .toLocaleLowerCase('es')
        .includes(terminoNombre)
      const coincideEstado =
        estado === 'TODAS' ||
        (estado === 'ACTIVAS' && estructura.activo) ||
        (estado === 'INACTIVAS' && !estructura.activo)

      return coincideCodigo && coincideNombre && coincideEstado
    })
  }, [estructuras, codigo, nombre, estado])

  function imprimirReporte() {
    window.print()
  }

  function reintentar() {
    setCargando(true)
    setError('')
    setIntento((actual) => actual + 1)
  }

  return (
    <section className="reporte-estructuras">
      <header className="reporte-estructuras-cabecera">
        <div>
          <span className="reporte-estructuras-eyebrow">ROTISERIA360</span>
          <h2>Reporte de estructuras de productos</h2>
          <p>
            Recetas y componentes registrados, incluidas todas sus versiones.
          </p>
        </div>
        <div className="reporte-estructuras-acciones reporte-estructuras-no-print">
          <button
            type="button"
            className="reporte-estructuras-boton"
            onClick={imprimirReporte}
            disabled={cargando || Boolean(error) || estructurasFiltradas.length === 0}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </header>

      <div className="reporte-estructuras-filtros reporte-estructuras-no-print">
        <label>
          <span>Código del producto</span>
          <input
            type="search"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
            placeholder="Buscar por código..."
          />
        </label>
        <label>
          <span>Nombre del producto</span>
          <input
            type="search"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Buscar por nombre..."
          />
        </label>
        <label>
          <span>Estado de la estructura</span>
          <select
            value={estado}
            onChange={(evento) => setEstado(evento.target.value)}
          >
            <option value="TODAS">Todas</option>
            <option value="ACTIVAS">Activas</option>
            <option value="INACTIVAS">Inactivas</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="reporte-estructuras-error reporte-estructuras-no-print" role="alert">
          <span>{error}</span>
          <button type="button" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}

      <div className="reporte-estructuras-resumen">
        <span>
          {cargando
            ? 'Cargando estructuras...'
            : `${estructurasFiltradas.length} de ${estructuras.length} estructuras`}
        </span>
        <span>Impreso: {new Date().toLocaleString('es-AR')}</span>
      </div>

      {cargando && (
        <p className="reporte-estructuras-vacio" role="status">
          Consultando estructuras guardadas...
        </p>
      )}

      {!cargando && !error && estructurasFiltradas.length === 0 && (
        <p className="reporte-estructuras-vacio">
          No hay estructuras que coincidan con los filtros.
        </p>
      )}

      {!cargando && !error && estructurasFiltradas.length > 0 && (
        <div className="reporte-estructuras-lista">
          {estructurasFiltradas.map((estructura) => (
            <article className="reporte-estructura" key={estructura.id}>
              <header className="reporte-estructura-cabecera">
                <div>
                  <span className="reporte-estructura-codigo">
                    {texto(estructura.producto_codigo)}
                  </span>
                  <h3>{texto(estructura.producto_nombre)}</h3>
                </div>
                <span
                  className={`reporte-estructura-estado ${
                    estructura.activo ? 'activa' : 'inactiva'
                  }`}
                >
                  {estructura.activo ? 'Activa' : 'Inactiva'}
                </span>
              </header>

              <dl className="reporte-estructura-datos">
                <div>
                  <dt>Versión</dt>
                  <dd>{texto(estructura.version)}</dd>
                </div>
                <div>
                  <dt>Rendimiento</dt>
                  <dd>
                    {cantidad(estructura.rendimiento)}{' '}
                    {texto(estructura.unidad_rendimiento)}
                  </dd>
                </div>
                <div>
                  <dt>Componentes</dt>
                  <dd>{estructura.detalle.length}</dd>
                </div>
              </dl>

              <div className="reporte-estructura-tabla-contenedor">
                <table className="reporte-estructura-tabla">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Componente</th>
                      <th>Tipo</th>
                      <th>Unidad</th>
                      <th>Cantidad</th>
                      <th>Merma %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estructura.detalle.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="reporte-estructura-sin-componentes">
                          Esta versión no tiene componentes registrados.
                        </td>
                      </tr>
                    ) : (
                      estructura.detalle.map((componente) => (
                        <tr key={componente.id}>
                          <td>{texto(componente.componente_codigo)}</td>
                          <td>{texto(componente.componente_nombre)}</td>
                          <td>{texto(componente.componente_tipo)}</td>
                          <td>
                            {componente.componente_unidad
                              ? `${componente.componente_unidad} - ${componente.componente_unidad_nombre ?? ''}`
                              : texto(componente.componente_unidad_nombre)}
                          </td>
                          <td>{cantidad(componente.cantidad)}</td>
                          <td>{cantidad(componente.merma)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="reporte-estructuras-pie">
        ROTISERIA360 · Reporte de estructuras · Todas las versiones registradas
      </footer>
    </section>
  )
}
