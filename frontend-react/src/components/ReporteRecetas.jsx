import { useEffect, useMemo, useState } from 'react'
import './ReporteRecetas.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

function valorEscalar(valor) {
  return typeof valor === 'string' || typeof valor === 'number'
    ? valor
    : null
}

function normalizarRecetas(recetas) {
  return recetas.map((receta, indice) => {
    if (
      !receta ||
      typeof receta !== 'object' ||
      Array.isArray(receta) ||
      (typeof receta.id !== 'string' &&
        typeof receta.id !== 'number') ||
      String(receta.id).trim() === '' ||
      typeof receta.activo !== 'boolean'
    ) {
      throw new Error(
        `La receta en la posición ${indice + 1} tiene datos inválidos.`,
      )
    }

    const detalle = Array.isArray(receta.detalle)
      ? receta.detalle
          .filter(
            (componente) =>
              componente &&
              typeof componente === 'object' &&
              !Array.isArray(componente),
          )
          .map((componente, indiceComponente) => ({
            id:
              valorEscalar(componente.id) ??
              `${receta.id}-componente-${indiceComponente}`,
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
      id: receta.id,
      producto_codigo: valorEscalar(receta.producto_codigo),
      producto_nombre: valorEscalar(receta.producto_nombre),
      version: valorEscalar(receta.version),
      activo: receta.activo,
      rendimiento: valorEscalar(receta.rendimiento),
      unidad_rendimiento: valorEscalar(receta.unidad_rendimiento),
      detalle,
    }
  })
}

async function consultarRecetas() {
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
    throw new Error('La API no devolvió un listado válido de recetas.')
  }

  return normalizarRecetas(datos.estructuras)
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

export default function ReporteRecetas() {
  const [recetas, setRecetas] = useState([])
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
        const datos = await consultarRecetas()

        if (!cancelado) {
          setRecetas(datos)
          setError('')
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'No se pudieron cargar las recetas.')
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

  const recetasFiltradas = useMemo(() => {
    const terminoCodigo = codigo.trim().toLocaleLowerCase('es')
    const terminoNombre = nombre.trim().toLocaleLowerCase('es')

    return recetas.filter((receta) => {
      const coincideCodigo = String(receta.producto_codigo ?? '')
        .toLocaleLowerCase('es')
        .includes(terminoCodigo)
      const coincideNombre = String(receta.producto_nombre ?? '')
        .toLocaleLowerCase('es')
        .includes(terminoNombre)
      const coincideEstado =
        estado === 'TODAS' ||
        (estado === 'ACTIVAS' && receta.activo) ||
        (estado === 'INACTIVAS' && !receta.activo)

      return coincideCodigo && coincideNombre && coincideEstado
    })
  }, [recetas, codigo, nombre, estado])

  function imprimirReporte() {
    window.print()
  }

  function reintentar() {
    setCargando(true)
    setError('')
    setIntento((actual) => actual + 1)
  }

  return (
    <section className="reporte-recetas">
      <header className="reporte-recetas-cabecera">
        <div>
          <span className="reporte-recetas-eyebrow">ROTISERIA360</span>
          <h2>Reporte de recetas</h2>
          <p>
            Recetas y componentes registrados, incluidas todas sus versiones.
          </p>
        </div>
        <div className="reporte-recetas-acciones reporte-recetas-no-print">
          <button
            type="button"
            className="reporte-recetas-boton"
            onClick={imprimirReporte}
            disabled={cargando || Boolean(error) || recetasFiltradas.length === 0}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </header>

      <div className="reporte-recetas-filtros reporte-recetas-no-print">
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
          <span>Estado de la receta</span>
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
        <div className="reporte-recetas-error reporte-recetas-no-print" role="alert">
          <span>{error}</span>
          <button type="button" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}

      <div className="reporte-recetas-resumen">
        <span>
          {cargando
            ? 'Cargando recetas...'
            : `${recetasFiltradas.length} de ${recetas.length} recetas`}
        </span>
        <span>Impreso: {new Date().toLocaleString('es-AR')}</span>
      </div>

      {cargando && (
        <p className="reporte-recetas-vacio" role="status">
          Consultando recetas guardadas...
        </p>
      )}

      {!cargando && !error && recetasFiltradas.length === 0 && (
        <p className="reporte-recetas-vacio">
          No hay recetas que coincidan con los filtros.
        </p>
      )}

      {!cargando && !error && recetasFiltradas.length > 0 && (
        <div className="reporte-recetas-lista">
          {recetasFiltradas.map((receta) => (
            <article className="reporte-receta" key={receta.id}>
              <header className="reporte-receta-cabecera">
                <div>
                  <span className="reporte-receta-codigo">
                    {texto(receta.producto_codigo)}
                  </span>
                  <h3>{texto(receta.producto_nombre)}</h3>
                </div>
                <span
                  className={`reporte-receta-estado ${
                    receta.activo ? 'activa' : 'inactiva'
                  }`}
                >
                  {receta.activo ? 'Activa' : 'Inactiva'}
                </span>
              </header>

              <dl className="reporte-receta-datos">
                <div>
                  <dt>Versión</dt>
                  <dd>{texto(receta.version)}</dd>
                </div>
                <div>
                  <dt>Rendimiento</dt>
                  <dd>
                    {cantidad(receta.rendimiento)}{' '}
                    {texto(receta.unidad_rendimiento)}
                  </dd>
                </div>
                <div>
                  <dt>Componentes</dt>
                  <dd>{receta.detalle.length}</dd>
                </div>
              </dl>

              <div className="reporte-receta-tabla-contenedor">
                <table className="reporte-receta-tabla">
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
                    {receta.detalle.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="reporte-receta-sin-componentes">
                          Esta versión no tiene componentes registrados.
                        </td>
                      </tr>
                    ) : (
                      receta.detalle.map((componente) => (
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

      <footer className="reporte-recetas-pie">
        ROTISERIA360 · Reporte de recetas · Todas las versiones registradas
      </footer>
    </section>
  )
}
