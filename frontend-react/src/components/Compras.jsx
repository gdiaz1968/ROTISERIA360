
import { useCallback, useEffect, useMemo, useState } from 'react'
import './Compras.css'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? 'http://localhost:3032' : '')

const FACTOR_PREDETERMINADO = 1.15

function extraerLista(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.datos)) return data.datos
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.compras)) return data.compras
  if (Array.isArray(data?.productos)) return data.productos
  if (Array.isArray(data?.proveedores)) return data.proveedores
  if (Array.isArray(data?.stock)) return data.stock
  if (Array.isArray(data?.movimientos)) return data.movimientos
  return []
}

async function consultarApi(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  })

  const texto = await respuesta.text()
  let resultado = {}

  try {
    resultado = texto ? JSON.parse(texto) : {}
  } catch {
    resultado = { mensaje: texto }
  }

  if (!respuesta.ok) {
    throw new Error(
      resultado.error ||
      resultado.mensaje ||
      `Error HTTP ${respuesta.status}`
    )
  }

  return resultado
}

function fechaActual() {
  const fecha = new Date()
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function formatoImporte(valor) {
  return Number(valor || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatoFecha(valor) {
  if (!valor) return '-'

  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor

  return fecha.toLocaleDateString('es-AR')
}

function obtenerIdProducto(producto) {
  return producto.id_producto ?? producto.id
}

function obtenerIdProveedor(proveedor) {
  return proveedor.id_proveedor ?? proveedor.id
}

function obtenerIdUnidad(producto) {
  return producto.id_unidad ?? producto.id_unidad_base
}

function nombreProducto(producto) {
  return producto.nombre || producto.descripcion || 'Producto sin nombre'
}

function nombreProveedor(proveedor) {
  return proveedor.nombre || proveedor.razon_social || proveedor.descripcion || 'Proveedor'
}

function estadoTexto(estado) {
  const estados = {
    PENDIENTE_PRECIO: 'Pendiente de precio',
    PENDIENTE_REVISION: 'Pendiente de confirmación',
    CONFIRMADA: 'Confirmada',
    ANULADA: 'Anulada',
  }

  return estados[estado] || estado || 'Sin estado'
}

function estadoClase(estado) {
  if (estado === 'CONFIRMADA') return 'confirmada'
  if (estado === 'ANULADA') return 'anulada'
  if (estado === 'PENDIENTE_PRECIO') return 'pendiente-precio'
  return 'pendiente'
}

function nuevaLinea() {
  return {
    id_producto: '',
    cantidad: '1',
    modalidad_precio: 'TOTAL',
    importe_informado: '',
    factor_ajuste: String(FACTOR_PREDETERMINADO),
  }
}

export default function Compras() {
  const [seccion, setSeccion] = useState('nueva')

  const [productos, setProductos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [unidades, setUnidades] = useState([])
  const [compras, setCompras] = useState([])
  const [stock, setStock] = useState([])
  const [movimientos, setMovimientos] = useState([])

  const [proveedorId, setProveedorId] = useState('')
  const [fechaCompra, setFechaCompra] = useState(fechaActual())
  const [tipoComprobante, setTipoComprobante] = useState('')
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState([nuevaLinea()])

  const [compraSeleccionada, setCompraSeleccionada] = useState(null)
  const [filtroMovimiento, setFiltroMovimiento] = useState('')

  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const productosActivos = useMemo(
    () => productos.filter((p) => p.activo !== false),
    [productos]
  )

  const proveedoresActivos = useMemo(
    () => proveedores.filter((p) => p.activo !== false),
    [proveedores]
  )

  // ======================================================
  // CARGAR CATALOGOS
  // Cada catálogo se procesa independientemente.
  // ======================================================

  const cargarCatalogos = useCallback(async () => {
    const resultados = await Promise.allSettled([
      consultarApi('/api/productos'),
      consultarApi('/api/proveedores'),
      consultarApi('/api/unidades'),
    ])

    const errores = []

    if (resultados[0].status === 'fulfilled') {
      setProductos(extraerLista(resultados[0].value))
    } else {
      setProductos([])
      errores.push(
        `Productos: ${resultados[0].reason?.message || 'Error desconocido'}`
      )
    }

    if (resultados[1].status === 'fulfilled') {
      setProveedores(extraerLista(resultados[1].value))
    } else {
      setProveedores([])
      errores.push(
        `Proveedores: ${resultados[1].reason?.message || 'Error desconocido'}`
      )
    }

    if (resultados[2].status === 'fulfilled') {
      setUnidades(extraerLista(resultados[2].value))
    } else {
      setUnidades([])
      errores.push(
        `Unidades: ${resultados[2].reason?.message || 'Error desconocido'}`
      )
    }

    if (errores.length > 0) {
      throw new Error(errores.join(' | '))
    }
  }, [])

  // ======================================================
  // CARGAR COMPRAS
  // ======================================================

  const cargarCompras = useCallback(async () => {
    const data = await consultarApi('/api/compras')
    setCompras(extraerLista(data))
  }, [])

  // ======================================================
  // CARGAR STOCK
  // ======================================================

  const cargarStock = useCallback(async () => {
    const data = await consultarApi('/api/compras/stock')
    setStock(extraerLista(data))
  }, [])

  // ======================================================
  // CARGAR MOVIMIENTOS
  // ======================================================

  const cargarMovimientos = useCallback(async () => {
    const ruta = filtroMovimiento
      ? `/api/compras/movimientos?id_producto=${encodeURIComponent(filtroMovimiento)}`
      : '/api/compras/movimientos'

    const data = await consultarApi(ruta)
    setMovimientos(extraerLista(data))
  }, [filtroMovimiento])

  // ======================================================
  // CARGA INICIAL
  // ======================================================

  const cargarDatosIniciales = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      await Promise.all([
        cargarCatalogos(),
        cargarCompras(),
        cargarStock(),
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [cargarCatalogos, cargarCompras, cargarStock])

  useEffect(() => {
    cargarDatosIniciales()
  }, [cargarDatosIniciales])

  useEffect(() => {
    if (seccion === 'movimientos') {
      cargarMovimientos().catch((err) => setError(err.message))
    }
  }, [seccion, cargarMovimientos])

  // ======================================================
  // ACTUALIZAR LINEAS
  // ======================================================

  function actualizarLinea(indice, campo, valor) {
    setDetalles((actuales) =>
      actuales.map((linea, i) =>
        i === indice ? { ...linea, [campo]: valor } : linea
      )
    )
  }

  function agregarLinea() {
    setDetalles((actuales) => [...actuales, nuevaLinea()])
  }

  function quitarLinea(indice) {
    setDetalles((actuales) =>
      actuales.length === 1
        ? actuales
        : actuales.filter((_, i) => i !== indice)
    )
  }

  // ======================================================
  // BUSCAR PRODUCTO Y UNIDAD
  // ======================================================

  function buscarProducto(id) {
    return productos.find(
      (p) => String(obtenerIdProducto(p)) === String(id)
    )
  }

  function buscarUnidad(id) {
    return unidades.find(
      (u) => String(u.id_unidad ?? u.id) === String(id)
    )
  }

  function descripcionUnidad(producto) {
    const unidad = buscarUnidad(obtenerIdUnidad(producto))

    return (
      unidad?.codigo ||
      unidad?.nombre ||
      producto.codigo_unidad ||
      producto.unidad ||
      '-'
    )
  }

  // ======================================================
  // TOTAL ESTIMADO
  // ======================================================

  const totalEstimado = useMemo(() => {
    return detalles.reduce((total, linea) => {
      const cantidad = Number(linea.cantidad)
      const importe = Number(linea.importe_informado)

      if (
        !Number.isFinite(cantidad) ||
        !Number.isFinite(importe) ||
        cantidad <= 0 ||
        importe < 0 ||
        linea.importe_informado === ''
      ) {
        return total
      }

      return total + (
        linea.modalidad_precio === 'UNITARIO'
          ? cantidad * importe
          : importe
      )
    }, 0)
  }, [detalles])

  // ======================================================
  // GUARDAR COMPRA
  // ======================================================

  async function guardarCompra(evento) {
    evento.preventDefault()
    setMensaje('')
    setError('')

    if (!proveedorId) {
      setError('Seleccioná un proveedor.')
      return
    }

    if (detalles.length === 0) {
      setError('Agregá al menos un producto.')
      return
    }

    const detallesPreparados = []

    for (let i = 0; i < detalles.length; i += 1) {
      const linea = detalles[i]
      const producto = buscarProducto(linea.id_producto)

      if (!producto) {
        setError(`Seleccioná un producto válido en el renglón ${i + 1}.`)
        return
      }

      const cantidad = Number(linea.cantidad)
      const factor = Number(linea.factor_ajuste)

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setError(`La cantidad del renglón ${i + 1} debe ser mayor que cero.`)
        return
      }

      if (!Number.isFinite(factor) || factor <= 0) {
        setError(`El factor de ajuste del renglón ${i + 1} debe ser mayor que cero.`)
        return
      }

      const tienePrecio = linea.importe_informado !== ''
      const importe = tienePrecio ? Number(linea.importe_informado) : null

      if (
        tienePrecio &&
        (!Number.isFinite(importe) || importe < 0)
      ) {
        setError(`El importe del renglón ${i + 1} no es válido.`)
        return
      }

      detallesPreparados.push({
        id_producto: Number(obtenerIdProducto(producto)),
        cantidad,
        id_unidad: Number(obtenerIdUnidad(producto)),
        modalidad_precio: tienePrecio ? linea.modalidad_precio : null,
        importe_informado: importe,
        factor_ajuste: factor,
      })
    }

    const datos = {
      id_proveedor: Number(proveedorId),
      fecha_compra: fechaCompra,
      tipo_comprobante: tipoComprobante || null,
      numero_comprobante: numeroComprobante || null,
      observaciones: observaciones || null,
      detalles: detallesPreparados,
    }

    setGuardando(true)

    try {
      await consultarApi('/api/compras', {
        method: 'POST',
        body: JSON.stringify(datos),
      })

      setMensaje('Compra registrada correctamente.')
      setProveedorId('')
      setFechaCompra(fechaActual())
      setTipoComprobante('')
      setNumeroComprobante('')
      setObservaciones('')
      setDetalles([nuevaLinea()])

      await Promise.all([cargarCompras(), cargarStock()])
      setSeccion('listado')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // ======================================================
  // VER DETALLE
  // ======================================================

  async function verDetalle(id) {
    setError('')
    setMensaje('')

    try {
      const data = await consultarApi(`/api/compras/${id}`)
      setCompraSeleccionada(data.compra || data)
    } catch (err) {
      setError(err.message)
    }
  }

  // ======================================================
  // CONFIRMAR COMPRA
  // ======================================================

  async function confirmarCompra(id) {
    const aceptar = window.confirm(
      '¿Confirmás esta compra? Esta operación generará los movimientos de entrada y actualizará el stock.'
    )

    if (!aceptar) return

    setError('')
    setMensaje('')

    try {
      await consultarApi(`/api/compras/${id}/confirmar`, {
        method: 'POST',
      })

      setMensaje('Compra confirmada. Se generaron los movimientos de stock.')
      setCompraSeleccionada(null)

      await Promise.all([
        cargarCompras(),
        cargarStock(),
        cargarMovimientos(),
      ])
    } catch (err) {
      setError(err.message)
    }
  }

  // ======================================================
  // ANULAR COMPRA
  // ======================================================

  async function anularCompra(id) {
    const aceptar = window.confirm(
      '¿Querés anular esta compra pendiente?'
    )

    if (!aceptar) return

    setError('')
    setMensaje('')

    try {
      await consultarApi(`/api/compras/${id}/anular`, {
        method: 'POST',
      })

      setMensaje('Compra anulada correctamente.')
      setCompraSeleccionada(null)
      await cargarCompras()
    } catch (err) {
      setError(err.message)
    }
  }

  // ======================================================
  // NUEVA COMPRA
  // ======================================================

  function renderNuevaCompra() {
    return (
      <form className="compras-formulario" onSubmit={guardarCompra}>
        <div className="compras-panel">
          <div className="compras-panel-titulo">
            <div>
              <h3>Datos de la compra</h3>
              <p>Ingresá los datos del comprobante y el proveedor.</p>
            </div>
          </div>

          <div className="compras-campos-cabecera">
            <label>
              Proveedor *
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                required
              >
                <option value="">Seleccionar proveedor</option>
                {proveedoresActivos.map((proveedor) => (
                  <option
                    key={obtenerIdProveedor(proveedor)}
                    value={obtenerIdProveedor(proveedor)}
                  >
                    {nombreProveedor(proveedor)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha *
              <input
                type="date"
                value={fechaCompra}
                onChange={(e) => setFechaCompra(e.target.value)}
                required
              />
            </label>

            <label>
              Tipo de comprobante
              <select
                value={tipoComprobante}
                onChange={(e) => setTipoComprobante(e.target.value)}
              >
                <option value="">Sin especificar</option>
                <option value="FACTURA A">Factura A</option>
                <option value="FACTURA B">Factura B</option>
                <option value="FACTURA C">Factura C</option>
                <option value="TICKET">Ticket</option>
                <option value="REMITO">Remito</option>
                <option value="OTRO">Otro</option>
              </select>
            </label>

            <label>
              Número de comprobante
              <input
                type="text"
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
                maxLength={80}
                placeholder="Ej.: 0001-00001234"
              />
            </label>

            <label className="compras-campo-ancho">
              Observaciones
              <textarea
                rows="2"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones de la compra..."
              />
            </label>
          </div>
        </div>

        <div className="compras-panel">
          <div className="compras-panel-titulo compras-titulo-lineas">
            <div>
              <h3>Productos recibidos</h3>
              <p>La unidad utilizada será la unidad base definida en el producto.</p>
            </div>

            <button
              type="button"
              className="compras-boton secundario"
              onClick={agregarLinea}
            >
              + Agregar producto
            </button>
          </div>

          <div className="compras-tabla-contenedor">
            <table className="compras-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>Modalidad</th>
                  <th>Importe</th>
                  <th>Factor</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {detalles.map((linea, indice) => {
                  const producto = buscarProducto(linea.id_producto)

                  return (
                    <tr key={indice}>
                      <td className="compras-producto-columna">
                        <select
                          value={linea.id_producto}
                          onChange={(e) =>
                            actualizarLinea(indice, 'id_producto', e.target.value)
                          }
                          required
                        >
                          <option value="">Seleccionar producto</option>
                          {productosActivos.map((p) => (
                            <option
                              key={obtenerIdProducto(p)}
                              value={obtenerIdProducto(p)}
                            >
                              {(p.codigo ? `${p.codigo} - ` : '') + nombreProducto(p)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>{producto?.tipo || '-'}</td>
                      <td>{producto ? descripcionUnidad(producto) : '-'}</td>

                      <td>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={linea.cantidad}
                          onChange={(e) =>
                            actualizarLinea(indice, 'cantidad', e.target.value)
                          }
                          required
                        />
                      </td>

                      <td>
                        <select
                          value={linea.modalidad_precio}
                          onChange={(e) =>
                            actualizarLinea(indice, 'modalidad_precio', e.target.value)
                          }
                        >
                          <option value="TOTAL">Total renglón</option>
                          <option value="UNITARIO">Precio unitario</option>
                        </select>
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={linea.importe_informado}
                          onChange={(e) =>
                            actualizarLinea(indice, 'importe_informado', e.target.value)
                          }
                          placeholder="Sin precio"
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={linea.factor_ajuste}
                          onChange={(e) =>
                            actualizarLinea(indice, 'factor_ajuste', e.target.value)
                          }
                          required
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className="compras-boton-icono"
                          onClick={() => quitarLinea(indice)}
                          disabled={detalles.length === 1}
                          title="Quitar producto"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="compras-resumen-formulario">
            <span>Total informado estimado</span>
            <strong>$ {formatoImporte(totalEstimado)}</strong>
          </div>

          <p className="compras-ayuda">
            El total es orientativo. Los renglones sin precio quedan pendientes
            y no se podrán confirmar hasta completar sus importes.
          </p>
        </div>

        <div className="compras-acciones">
          <button
            type="submit"
            className="compras-boton principal"
            disabled={guardando || cargando}
          >
            {guardando ? 'Guardando...' : 'Guardar compra'}
          </button>
        </div>
      </form>
    )
  }

  // ======================================================
  // LISTADO DE COMPRAS
  // ======================================================

  function renderListado() {
    return (
      <div className="compras-panel">
        <div className="compras-panel-titulo">
          <div>
            <h3>Compras registradas</h3>
            <p>Consultá, revisá y confirmá las compras ingresadas.</p>
          </div>

          <button
            type="button"
            className="compras-boton secundario"
            onClick={cargarCompras}
          >
            Actualizar
          </button>
        </div>

        <div className="compras-tabla-contenedor">
          <table className="compras-tabla">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Comprobante</th>
                <th>Renglones</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {compras.length === 0 ? (
                <tr>
                  <td colSpan="8" className="compras-vacio">
                    No hay compras registradas.
                  </td>
                </tr>
              ) : (
                compras.map((compra) => (
                  <tr key={compra.id_compra ?? compra.id}>
                    <td>{compra.id_compra ?? compra.id}</td>
                    <td>{formatoFecha(compra.fecha_compra)}</td>
                    <td>{compra.proveedor || '-'}</td>
                    <td>
                      {[compra.tipo_comprobante, compra.numero_comprobante]
                        .filter(Boolean)
                        .join(' ') || '-'}
                    </td>
                    <td>{compra.cantidad_detalles ?? '-'}</td>
                    <td>$ {formatoImporte(compra.total)}</td>
                    <td>
                      <span className={`compras-estado ${estadoClase(compra.estado)}`}>
                        {estadoTexto(compra.estado)}
                      </span>
                    </td>
                    <td>
                      <div className="compras-acciones-tabla">
                        <button
                          type="button"
                          className="compras-boton pequeno secundario"
                          onClick={() => verDetalle(compra.id_compra ?? compra.id)}
                        >
                          Ver
                        </button>

                        {compra.estado !== 'CONFIRMADA' &&
                          compra.estado !== 'ANULADA' && (
                            <>
                              <button
                                type="button"
                                className="compras-boton pequeno principal"
                                onClick={() =>
                                  confirmarCompra(compra.id_compra ?? compra.id)
                                }
                              >
                                Confirmar
                              </button>

                              <button
                                type="button"
                                className="compras-boton pequeno peligro"
                                onClick={() =>
                                  anularCompra(compra.id_compra ?? compra.id)
                                }
                              >
                                Anular
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ======================================================
  // STOCK
  // ======================================================

  function renderStock() {
    return (
      <div className="compras-panel">
        <div className="compras-panel-titulo">
          <div>
            <h3>Existencias actuales</h3>
            <p>Stock calculado a partir de los movimientos registrados.</p>
          </div>

          <button
            type="button"
            className="compras-boton secundario"
            onClick={cargarStock}
          >
            Actualizar
          </button>
        </div>

        <div className="compras-tabla-contenedor">
          <table className="compras-tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Unidad</th>
                <th className="texto-derecha">Existencia</th>
              </tr>
            </thead>

            <tbody>
              {stock.length === 0 ? (
                <tr>
                  <td colSpan="5" className="compras-vacio">
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                stock.map((item) => (
                  <tr key={item.id_producto}>
                    <td>{item.codigo || '-'}</td>
                    <td>{item.nombre || '-'}</td>
                    <td>{item.tipo || '-'}</td>
                    <td>{item.unidad || item.codigo_unidad || '-'}</td>
                    <td className="texto-derecha">
                      <strong>{formatoImporte(item.stock ?? item.existencia)}</strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ======================================================
  // MOVIMIENTOS
  // ======================================================

  function renderMovimientos() {
    return (
      <div className="compras-panel">
        <div className="compras-panel-titulo">
          <div>
            <h3>Movimientos de stock</h3>
            <p>Historial de entradas, salidas y ajustes registrados.</p>
          </div>

          <div className="compras-filtro-movimientos">
            <select
              value={filtroMovimiento}
              onChange={(e) => setFiltroMovimiento(e.target.value)}
            >
              <option value="">Todos los productos</option>
              {productosActivos.map((producto) => (
                <option
                  key={obtenerIdProducto(producto)}
                  value={obtenerIdProducto(producto)}
                >
                  {(producto.codigo ? `${producto.codigo} - ` : '') +
                    nombreProducto(producto)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="compras-boton secundario"
              onClick={cargarMovimientos}
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="compras-tabla-contenedor">
          <table className="compras-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Movimiento</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Referencia</th>
              </tr>
            </thead>

            <tbody>
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="compras-vacio">
                    No hay movimientos para mostrar.
                  </td>
                </tr>
              ) : (
                movimientos.map((movimiento, indice) => (
                  <tr key={movimiento.id_movimiento ?? indice}>
                    <td>{formatoFecha(movimiento.fecha_movimiento || movimiento.fecha)}</td>
                    <td>{movimiento.producto || movimiento.nombre || '-'}</td>
                    <td>{movimiento.tipo_movimiento || movimiento.tipo || '-'}</td>
                    <td>{formatoImporte(movimiento.cantidad)}</td>
                    <td>{movimiento.unidad || movimiento.codigo_unidad || '-'}</td>
                    <td>{movimiento.referencia || movimiento.id_compra || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ======================================================
  // DETALLE DE COMPRA
  // ======================================================

  function renderDetalleCompra() {
    if (!compraSeleccionada) return null

    const cabecera = compraSeleccionada
    const lineas = cabecera.detalles || []

    return (
      <div className="compras-modal-fondo" onClick={() => setCompraSeleccionada(null)}>
        <div
          className="compras-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="compras-modal-cabecera">
            <div>
              <h3>Detalle de compra #{cabecera.id_compra ?? cabecera.id}</h3>
              <span className={`compras-estado ${estadoClase(cabecera.estado)}`}>
                {estadoTexto(cabecera.estado)}
              </span>
            </div>

            <button
              type="button"
              className="compras-boton-icono"
              onClick={() => setCompraSeleccionada(null)}
            >
              ×
            </button>
          </div>

          <div className="compras-detalle-datos">
            <div><strong>Proveedor:</strong> {cabecera.proveedor || '-'}</div>
            <div><strong>Fecha:</strong> {formatoFecha(cabecera.fecha_compra)}</div>
            <div><strong>Comprobante:</strong> {cabecera.tipo_comprobante || '-'} {cabecera.numero_comprobante || ''}</div>
            <div><strong>Observaciones:</strong> {cabecera.observaciones || '-'}</div>
          </div>

          <div className="compras-tabla-contenedor">
            <table className="compras-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Modalidad</th>
                  <th>Importe informado</th>
                  <th>Factor</th>
                  <th>Costo ajustado unitario</th>
                </tr>
              </thead>

              <tbody>
                {lineas.map((linea, indice) => (
                  <tr key={linea.id_detalle ?? indice}>
                    <td>{linea.producto || linea.nombre || '-'}</td>
                    <td>{formatoImporte(linea.cantidad)}</td>
                    <td>{linea.unidad || linea.codigo_unidad || '-'}</td>
                    <td>{linea.modalidad_precio || '-'}</td>
                    <td>
                      {linea.importe_informado == null
                        ? 'Pendiente'
                        : `$ ${formatoImporte(linea.importe_informado)}`}
                    </td>
                    <td>{linea.factor_ajuste ?? '-'}</td>
                    <td>
                      {linea.costo_unitario_ajustado == null
                        ? '-'
                        : `$ ${formatoImporte(linea.costo_unitario_ajustado)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="compras-modal-pie">
            <strong>Total: $ {formatoImporte(cabecera.total)}</strong>

            {cabecera.estado !== 'CONFIRMADA' &&
              cabecera.estado !== 'ANULADA' && (
                <div className="compras-acciones-tabla">
                  <button
                    type="button"
                    className="compras-boton principal"
                    onClick={() => confirmarCompra(cabecera.id_compra ?? cabecera.id)}
                  >
                    Confirmar compra
                  </button>

                  <button
                    type="button"
                    className="compras-boton peligro"
                    onClick={() => anularCompra(cabecera.id_compra ?? cabecera.id)}
                  >
                    Anular compra
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>
    )
  }

  // ======================================================
  // RENDER PRINCIPAL
  // ======================================================

  return (
    <section className="compras-modulo">
      <div className="compras-encabezado">
        <div>
          <h2>Compras y Stock</h2>
          <p>Registro de mercadería recibida, confirmación y control de existencias.</p>
        </div>
      </div>

      {(mensaje || error) && (
        <div className={`compras-alerta ${error ? 'error' : 'exito'}`}>
          <span>{error || mensaje}</span>
          <button
            type="button"
            onClick={() => {
              setError('')
              setMensaje('')
            }}
          >
            ×
          </button>
        </div>
      )}

      <nav className="compras-pestanas">
        <button
          type="button"
          className={seccion === 'nueva' ? 'activa' : ''}
          onClick={() => setSeccion('nueva')}
        >
          Nueva compra
        </button>

        <button
          type="button"
          className={seccion === 'listado' ? 'activa' : ''}
          onClick={() => setSeccion('listado')}
        >
          Compras registradas
        </button>

        <button
          type="button"
          className={seccion === 'stock' ? 'activa' : ''}
          onClick={() => setSeccion('stock')}
        >
          Stock
        </button>

        <button
          type="button"
          className={seccion === 'movimientos' ? 'activa' : ''}
          onClick={() => setSeccion('movimientos')}
        >
          Movimientos
        </button>
      </nav>

      {cargando && (
        <div className="compras-cargando">Cargando información...</div>
      )}

      {!cargando && seccion === 'nueva' && renderNuevaCompra()}
      {!cargando && seccion === 'listado' && renderListado()}
      {!cargando && seccion === 'stock' && renderStock()}
      {!cargando && seccion === 'movimientos' && renderMovimientos()}

      {renderDetalleCompra()}
    </section>
  )
}
