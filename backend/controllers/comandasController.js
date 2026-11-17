const pool = require("../db");

async function consultarComandas(req, res) {
  const id = req.params.id ? Number(req.params.id) : null;
  const estado = String(req.query.estado || "").trim().toUpperCase();
  const estadosValidos = ["PENDIENTE", "EN_PREPARACION", "LISTA", "ANULADA"];

  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) {
    return res.status(400).json({ mensaje: "Identificador de comanda inválido." });
  }
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ mensaje: "El filtro de estado no es válido." });
  }

  try {
    const parametros = [];
    const condiciones = [];
    if (id !== null) {
      parametros.push(id);
      condiciones.push(`c.id = $${parametros.length}`);
    }
    if (estado) {
      parametros.push(estado);
      condiciones.push(`c.estado = $${parametros.length}`);
    } else if (id === null) {
      condiciones.push("c.estado <> 'ANULADA'");
    }

    const resultado = await pool.query(`
      SELECT
        c.id,
        c.numero_comanda,
        c.id_venta,
        v.numero AS numero_pedido,
        v.modalidad,
        v.fecha AS fecha_pedido,
        s.nombre AS sector,
        c.estado,
        c.fecha_alta,
        c.fecha_inicio,
        c.fecha_lista,
        c.fecha_impresion,
        c.observaciones,
        COALESCE(v.observaciones, '') AS observaciones_pedido,
        json_agg(
          json_build_object(
            'id_venta_detalle', vd.id,
            'producto', vd.nombre_producto,
            'cantidad', cd.cantidad,
            'observaciones', COALESCE(vd.observaciones, '')
          ) ORDER BY vd.id
        ) AS detalles
      FROM ventas_comandas c
      INNER JOIN ventas v ON v.id = c.id_venta
      INNER JOIN sectores_cocina s ON s.id = c.id_sector
      INNER JOIN ventas_comandas_detalle cd ON cd.id_comanda = c.id AND cd.id_venta = c.id_venta
      INNER JOIN ventas_detalle vd ON vd.id = cd.id_venta_detalle AND vd.id_venta = cd.id_venta
      ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""}
      GROUP BY c.id, v.numero, v.modalidad, v.fecha, v.observaciones, s.nombre
      ORDER BY
        CASE c.estado WHEN 'PENDIENTE' THEN 1 WHEN 'EN_PREPARACION' THEN 2 WHEN 'LISTA' THEN 3 ELSE 4 END,
        c.fecha_alta ASC, c.numero_comanda ASC
      ${id !== null ? "LIMIT 1" : ""}
    `, parametros);

    if (id !== null && !resultado.rowCount) {
      return res.status(404).json({ mensaje: "No se encontró la comanda." });
    }
    res.json(id !== null ? { comanda: resultado.rows[0] } : { comandas: resultado.rows });
  } catch (error) {
    console.error("Error al consultar comandas:", error);
    res.status(500).json({ mensaje: "No se pudieron consultar las comandas." });
  }
}

async function actualizarEstadoComanda(req, res) {
  const id = Number(req.params.id);
  const estado = String(req.body?.estado || "").trim().toUpperCase();

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: "Identificador de comanda inválido." });
  }
  if (!["EN_PREPARACION", "LISTA"].includes(estado)) {
    return res.status(400).json({ mensaje: "El estado solicitado no está permitido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actual = await client.query(
      "SELECT id, id_venta, estado FROM ventas_comandas WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!actual.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "No se encontró la comanda." });
    }

    const comanda = actual.rows[0];
    const transicionValida =
      (comanda.estado === "PENDIENTE" && estado === "EN_PREPARACION") ||
      (comanda.estado === "PENDIENTE" && estado === "LISTA") ||
      (comanda.estado === "EN_PREPARACION" && estado === "LISTA");

    if (!transicionValida) {
      await client.query("ROLLBACK");
      return res.status(409).json({ mensaje: `No se puede cambiar una comanda de ${comanda.estado} a ${estado}.` });
    }

    await client.query(`
      UPDATE ventas_comandas
      SET estado = $1,
          fecha_inicio = CASE WHEN $1 = 'EN_PREPARACION' THEN COALESCE(fecha_inicio, NOW()) ELSE fecha_inicio END,
          fecha_lista = CASE WHEN $1 = 'LISTA' THEN NOW() ELSE fecha_lista END,
          fecha_actualizacion = NOW()
      WHERE id = $2
    `, [estado, id]);

    if (estado === "LISTA") {
      await client.query(`
        UPDATE ventas
        SET estado = 'LISTO_PARA_ENTREGAR', fecha_actualizacion = NOW()
        WHERE id = $1
          AND estado NOT IN ('ENTREGADO', 'ANULADO')
          AND NOT EXISTS (
            SELECT 1 FROM ventas_comandas pendientes
            WHERE pendientes.id_venta = $1 AND pendientes.estado <> 'LISTA'
          )
      `, [comanda.id_venta]);
    }

    await client.query("COMMIT");
    res.json({ mensaje: "Estado de la comanda actualizado.", id, estado });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al actualizar estado de comanda:", error);
    res.status(500).json({ mensaje: "No se pudo actualizar el estado de la comanda." });
  } finally {
    client.release();
  }
}

async function registrarSolicitudImpresion(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: "Identificador de comanda inválido." });
  }

  try {
    const resultado = await pool.query(`
      UPDATE ventas_comandas
      SET fecha_impresion = NOW(), fecha_actualizacion = NOW()
      WHERE id = $1 AND estado <> 'ANULADA'
      RETURNING id, numero_comanda, fecha_impresion
    `, [id]);

    if (!resultado.rowCount) {
      return res.status(404).json({ mensaje: "No se encontró una comanda activa para imprimir." });
    }

    res.json({
      mensaje: "Se registró la solicitud de impresión autorizada por el operador.",
      comanda: resultado.rows[0]
    });
  } catch (error) {
    console.error("Error al registrar impresión de comanda:", error);
    res.status(500).json({ mensaje: "No se pudo registrar la solicitud de impresión." });
  }
}

module.exports = { consultarComandas, actualizarEstadoComanda, registrarSolicitudImpresion };
