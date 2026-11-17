const pool = require("../db");
const { calcularCostoProducto } = require("../services/costosService");

const redondearPrecio = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

const obtenerRecargoPredeterminado = async (db = pool) => {
  const resultado = await db.query(`
    SELECT recargo_predeterminado_elaborados
    FROM configuracion_comercial
    WHERE id = 1
  `);
  if (resultado.rowCount === 0) {
    throw new Error("No está configurado el recargo predeterminado comercial.");
  }
  return Number(resultado.rows[0].recargo_predeterminado_elaborados);
};

const obtenerConfiguracionComercial = async (req, res) => {
  try {
    const recargo = await obtenerRecargoPredeterminado();
    res.json({ recargo_predeterminado_elaborados: recargo });
  } catch (error) {
    console.error("Error al consultar configuración comercial:", error);
    res.status(500).json({ mensaje: "No se pudo consultar la configuración comercial." });
  }
};

const actualizarConfiguracionComercial = async (req, res) => {
  const recargo = Number(req.body.recargo_predeterminado_elaborados);

  if (!Number.isFinite(recargo) || recargo < 0 || recargo > 10000) {
    return res.status(400).json({
      mensaje: "El recargo predeterminado debe estar entre 0 y 10000."
    });
  }

  try {
    const resultado = await pool.query(`
      UPDATE configuracion_comercial
      SET recargo_predeterminado_elaborados = $1,
          fecha_actualizacion = NOW()
      WHERE id = 1
      RETURNING recargo_predeterminado_elaborados
    `, [recargo]);

    if (resultado.rowCount === 0) {
      return res.status(500).json({ mensaje: "No existe la configuración comercial inicial." });
    }

    res.json({
      mensaje: "Recargo predeterminado actualizado.",
      configuracion: {
        recargo_predeterminado_elaborados: Number(resultado.rows[0].recargo_predeterminado_elaborados)
      }
    });
  } catch (error) {
    console.error("Error al actualizar configuración comercial:", error);
    res.status(500).json({ mensaje: "No se pudo actualizar el recargo predeterminado." });
  }
};

const listarProductosVenta = async (req, res) => {
  const paginaSolicitada = Number.parseInt(req.query.pagina, 10);
  const limiteSolicitado = Number.parseInt(req.query.limite, 10);
  const pagina = Number.isInteger(paginaSolicitada) && paginaSolicitada > 0
    ? paginaSolicitada
    : 1;
  const limite = [10, 20, 50, 100].includes(limiteSolicitado)
    ? limiteSolicitado
    : 20;
  const busqueda = String(req.query.busqueda || "").trim();
  const tipo = String(req.query.tipo || "").trim().toUpperCase();

  if (tipo && !["ELABORADO", "REVENTA"].includes(tipo)) {
    return res.status(400).json({ mensaje: "El filtro de tipo no es válido." });
  }

  const parametros = [];
  const condiciones = [
    "p.activo = TRUE",
    "p.tipo IN ('ELABORADO', 'REVENTA')"
  ];

  if (busqueda) {
    parametros.push(`%${busqueda}%`);
    condiciones.push(`(p.codigo ILIKE $1 OR p.nombre ILIKE $1)`);
  }

  if (tipo) {
    parametros.push(tipo);
    condiciones.push(`p.tipo = $${parametros.length}`);
  }

  const where = condiciones.join(" AND ");
  const offset = (pagina - 1) * limite;

  try {
    const [conteo, resultado, recargoPredeterminado] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::INTEGER AS total,
          COUNT(*) FILTER (
            WHERE COALESCE(pv.habilitado_venta, FALSE) = TRUE
              AND COALESCE(pv.activo, TRUE) = TRUE
          )::INTEGER AS habilitados
        FROM productos p
        LEFT JOIN productos_venta pv ON pv.id_producto = p.id
        WHERE ${where}
      `, parametros),
      pool.query(`
        SELECT
          p.id AS id_producto,
          p.codigo,
          p.nombre,
          p.tipo,
          p.id_unidad,
          um.codigo AS unidad,
          um.nombre AS unidad_nombre,
          COALESCE(pv.habilitado_venta, FALSE) AS habilitado_venta,
          COALESCE(pv.precio_venta, 0) AS precio_venta,
          COALESCE(pv.controla_stock, FALSE) AS controla_stock,
          COALESCE(pv.activo, TRUE) AS configuracion_activa,
          pv.recargo_porcentaje,
          pv.costo_referencia
        FROM productos p
        LEFT JOIN unidades_medida um ON um.id = p.id_unidad
        LEFT JOIN productos_venta pv ON pv.id_producto = p.id
        WHERE ${where}
        ORDER BY p.codigo, p.nombre
        LIMIT $${parametros.length + 1}
        OFFSET $${parametros.length + 2}
      `, [...parametros, limite, offset]),
      obtenerRecargoPredeterminado()
    ]);

    const productos = await Promise.all(resultado.rows.map(async (producto) => {
      const base = {
        ...producto,
        precio_venta: Number(producto.precio_venta),
        recargo_porcentaje: producto.tipo === "ELABORADO"
          ? (producto.recargo_porcentaje === null
              ? recargoPredeterminado
              : Number(producto.recargo_porcentaje))
          : null
      };

      if (producto.tipo !== "ELABORADO") {
        return {
          ...base,
          costo_actual: null,
          precio_sugerido: null,
          costo_referencia: null,
          costo_modificado: false,
          estado_costo: "MANUAL",
          costo_error: null
        };
      }

      try {
        const calculo = await calcularCostoProducto(producto.id_producto);
        const costoActual = Number(calculo.costo_unitario);
        const recargo = base.recargo_porcentaje;
        const precioSugerido = redondearPrecio(costoActual * (1 + recargo / 100));
        const costoReferencia = producto.costo_referencia === null
          ? null
          : Number(producto.costo_referencia);
        const costoModificado = costoReferencia === null ||
          Math.abs(costoActual - costoReferencia) > 0.0001;

        return {
          ...base,
          costo_actual: costoActual,
          precio_sugerido: precioSugerido,
          costo_referencia: costoReferencia,
          costo_modificado: costoModificado,
          estado_costo: costoModificado ? "REVISAR" : "ACTUALIZADO",
          costo_error: null
        };
      } catch (error) {
        return {
          ...base,
          costo_actual: null,
          precio_sugerido: null,
          costo_referencia: producto.costo_referencia === null
            ? null
            : Number(producto.costo_referencia),
          costo_modificado: false,
          estado_costo: "SIN_COSTO",
          costo_error: error.message
        };
      }
    }));

    const total = Number(conteo.rows[0].total);
    const totalPaginas = Math.max(1, Math.ceil(total / limite));

    res.json({
      productos,
      paginacion: {
        pagina,
        limite,
        total,
        total_paginas: totalPaginas,
        habilitados: Number(conteo.rows[0].habilitados)
      }
    });
  } catch (error) {
    console.error("Error al listar catálogo de venta:", error);
    res.status(500).json({ mensaje: "No se pudo consultar el catálogo de venta." });
  }
};

const configurarProductoVenta = async (req, res) => {
  const idProducto = Number(req.params.idProducto);
  const precio = Number(req.body.precio_venta);
  const habilitado = req.body.habilitado_venta;
  const controlaStock = req.body.controla_stock === true;
  const confirmarCostoActual = req.body.confirmar_costo_actual === true;

  if (!Number.isSafeInteger(idProducto) || idProducto <= 0) {
    return res.status(400).json({ mensaje: "Identificador de producto inválido." });
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return res.status(400).json({ mensaje: "El precio de venta debe ser un número mayor o igual a cero." });
  }
  if (typeof habilitado !== "boolean") {
    return res.status(400).json({ mensaje: "Debe indicar si el producto está habilitado para la venta." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productoResultado = await client.query(
      "SELECT id, tipo FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE",
      [idProducto]
    );
    if (productoResultado.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El producto no existe o está inactivo." });
    }

    const producto = productoResultado.rows[0];
    if (!["ELABORADO", "REVENTA"].includes(producto.tipo)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: "Solo se pueden configurar productos ELABORADO o REVENTA para la venta." });
    }

    const anterior = await client.query(
      "SELECT precio_venta, recargo_porcentaje, costo_referencia FROM productos_venta WHERE id_producto = $1 FOR UPDATE",
      [idProducto]
    );

    const precioAnterior = anterior.rowCount
      ? Number(anterior.rows[0].precio_venta)
      : null;
    const cambioPrecio = precioAnterior === null
      ? precio > 0
      : Math.abs(precioAnterior - precio) > 0.000001;

    let recargo = null;
    let costoActual = null;

    if (producto.tipo === "ELABORADO") {
      const recargoEnviado = req.body.recargo_porcentaje;
      if (recargoEnviado !== undefined && recargoEnviado !== null && recargoEnviado !== "") {
        recargo = Number(recargoEnviado);
      } else if (anterior.rowCount && anterior.rows[0].recargo_porcentaje !== null) {
        recargo = Number(anterior.rows[0].recargo_porcentaje);
      } else {
        recargo = await obtenerRecargoPredeterminado(client);
      }

      if (!Number.isFinite(recargo) || recargo < 0 || recargo > 10000) {
        await client.query("ROLLBACK");
        return res.status(400).json({ mensaje: "El recargo del producto debe estar entre 0 y 10000." });
      }

      try {
        const calculo = await calcularCostoProducto(idProducto);
        costoActual = Number(calculo.costo_unitario);
      } catch (error) {
        // Se permite guardar precio y configuración aunque todavía no exista una receta costeable.
        console.info("El elaborado todavía no tiene costo calculable:", idProducto, error.message);
      }
    }

    const referenciaAnterior = anterior.rowCount && anterior.rows[0].costo_referencia !== null
      ? Number(anterior.rows[0].costo_referencia)
      : null;
    const debeMarcarCostoRevisado = producto.tipo === "ELABORADO" &&
      costoActual !== null &&
      (confirmarCostoActual || cambioPrecio);
    const costoReferencia = producto.tipo === "ELABORADO"
      ? (debeMarcarCostoRevisado ? costoActual : referenciaAnterior)
      : null;

    const guardado = await client.query(`
      INSERT INTO productos_venta
        (id_producto, habilitado_venta, precio_venta, controla_stock, activo,
         fecha_actualizacion, recargo_porcentaje, costo_referencia)
      VALUES ($1, $2, $3, $4, TRUE, NOW(), $5, $6)
      ON CONFLICT (id_producto)
      DO UPDATE SET
        habilitado_venta = EXCLUDED.habilitado_venta,
        precio_venta = EXCLUDED.precio_venta,
        controla_stock = EXCLUDED.controla_stock,
        activo = TRUE,
        fecha_actualizacion = NOW(),
        recargo_porcentaje = EXCLUDED.recargo_porcentaje,
        costo_referencia = EXCLUDED.costo_referencia
      RETURNING id, id_producto, habilitado_venta, precio_venta,
                controla_stock, activo, recargo_porcentaje, costo_referencia
    `, [idProducto, habilitado, precio, controlaStock, recargo, costoReferencia]);

    if (cambioPrecio) {
      await client.query(`
        INSERT INTO historial_precios_venta
          (id_producto, precio_anterior, precio_nuevo, observaciones)
        VALUES ($1, $2, $3, $4)
      `, [
        idProducto,
        precioAnterior,
        precio,
        precioAnterior === null
          ? "Configuración inicial del precio de venta"
          : "Actualización manual del precio de venta"
      ]);
    }

    await client.query("COMMIT");
    res.json({
      mensaje: "Configuración comercial guardada.",
      producto: guardado.rows[0],
      costo_actual: costoActual,
      costo_revisado: debeMarcarCostoRevisado
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al configurar producto para la venta:", error);
    res.status(500).json({ mensaje: "No se pudo guardar la configuración comercial." });
  } finally {
    client.release();
  }
};

module.exports = {
  listarProductosVenta,
  configurarProductoVenta,
  obtenerConfiguracionComercial,
  actualizarConfiguracionComercial
};
