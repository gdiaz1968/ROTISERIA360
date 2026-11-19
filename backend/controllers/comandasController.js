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
    }

    const resultado = await pool.query(`
      SELECT
        c.id,
        c.numero_comanda,
        c.id_venta,
        v.numero AS numero_pedido,
        v.estado AS estado_pedido,
        v.modalidad,
        v.fecha AS fecha_pedido,
        s.nombre AS sector,
        c.estado,
        c.fecha_alta,
        c.fecha_inicio,
        c.fecha_lista,
        c.fecha_impresion,
        c.observaciones,
        c.fecha_anulacion,
        c.motivo_anulacion,
        c.usuario_anulacion,
        COALESCE(v.observaciones, '') AS observaciones_pedido,
        json_agg(
          json_build_object(
            'id_venta_detalle', vd.id,
            'producto', vd.nombre_producto,
            'cantidad', cd.cantidad,
            'observaciones', COALESCE(vd.observaciones, ''),
            'estado', vd.estado
          ) ORDER BY vd.id
        ) AS detalles
      FROM ventas_comandas c
      INNER JOIN ventas v ON v.id = c.id_venta
      INNER JOIN sectores_cocina s ON s.id = c.id_sector
      INNER JOIN ventas_comandas_detalle cd ON cd.id_comanda = c.id AND cd.id_venta = c.id_venta
      INNER JOIN ventas_detalle vd ON vd.id = cd.id_venta_detalle AND vd.id_venta = cd.id_venta
      ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""}
      GROUP BY c.id, v.numero, v.estado, v.modalidad, v.fecha, v.observaciones, s.nombre
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
  SET estado = $1::varchar,
      fecha_inicio = CASE WHEN $1::varchar = 'EN_PREPARACION' THEN COALESCE(fecha_inicio, NOW()) ELSE fecha_inicio END,
      fecha_lista = CASE WHEN $1::varchar = 'LISTA' THEN NOW() ELSE fecha_lista END,
      fecha_actualizacion = NOW()
  WHERE id = $2
`, [estado, id]);

    if (estado === "EN_PREPARACION") {
      await client.query(`
        UPDATE ventas
        SET estado = 'EN_PREPARACION', fecha_actualizacion = NOW()
        WHERE id = $1 AND estado = 'PENDIENTE'
      `, [comanda.id_venta]);
    }

    if (estado === "LISTA") {
      await client.query(`
        UPDATE ventas
        SET estado = 'LISTO_PARA_ENTREGAR', fecha_actualizacion = NOW()
        WHERE id = $1
          AND estado NOT IN ('ENTREGADO', 'ANULADO')
          AND EXISTS (
            SELECT 1 FROM ventas_comandas activas
            WHERE activas.id_venta = $1 AND activas.estado <> 'ANULADA'
          )
          AND NOT EXISTS (
            SELECT 1 FROM ventas_comandas pendientes
            WHERE pendientes.id_venta = $1
              AND pendientes.estado NOT IN ('LISTA', 'ANULADA')
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

async function previsualizarAnulacionComanda(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: "Identificador de comanda inválido." });
  }

  try {
    const cabecera = await pool.query(`
      SELECT
        c.id, c.id_venta, c.numero_comanda, c.estado,
        v.numero AS numero_pedido, v.estado AS estado_pedido,
        v.modalidad, v.total,
        COALESCE(p.pagado, 0)::numeric AS pagado
      FROM ventas_comandas c
      INNER JOIN ventas v ON v.id = c.id_venta
      LEFT JOIN LATERAL (
        SELECT SUM(importe) AS pagado
        FROM ventas_pagos
        WHERE id_venta = v.id AND estado = 'CONFIRMADO'
      ) p ON TRUE
      WHERE c.id = $1
    `, [id]);

    if (!cabecera.rowCount) return res.status(404).json({ mensaje: "No se encontró la comanda." });
    const comanda = cabecera.rows[0];

    if (comanda.estado === "ANULADA") {
      return res.status(409).json({ mensaje: "La comanda ya está anulada." });
    }
    if (["EN_REPARTO", "ENTREGADO", "ANULADO"].includes(comanda.estado_pedido)) {
      return res.status(409).json({ mensaje: "No se puede anular una comanda cuando el pedido ya salió a reparto, fue entregado o está anulado." });
    }

    const lineas = await pool.query(`
      SELECT
        vd.id AS id_venta_detalle,
        vd.nombre_producto AS producto,
        cd.cantidad,
        vd.precio_unitario,
        vd.subtotal,
        ROUND(vd.subtotal * cd.cantidad / NULLIF(vd.cantidad, 0), 2)::numeric AS importe
      FROM ventas_comandas_detalle cd
      INNER JOIN ventas_detalle vd
        ON vd.id = cd.id_venta_detalle AND vd.id_venta = cd.id_venta
      WHERE cd.id_comanda = $1
        AND cd.id_venta = $2
        AND vd.estado = 'ACTIVO'
      ORDER BY vd.id
    `, [id, comanda.id_venta]);

    if (!lineas.rowCount) {
      return res.status(409).json({ mensaje: "La comanda no tiene productos activos para quitar de la venta." });
    }

    const otrasActivas = await pool.query(`
      SELECT COUNT(*)::int AS cantidad
      FROM ventas_comandas
      WHERE id_venta = $1 AND estado <> 'ANULADA' AND id <> $2
    `, [comanda.id_venta, id]);

    if (otrasActivas.rows[0].cantidad === 0) {
      return res.status(409).json({ mensaje: "No se puede anular la última comanda activa del pedido. Para cancelar todo el pedido debe utilizarse la anulación de venta." });
    }

    const importeAnular = Math.round(lineas.rows.reduce((s, l) => s + Number(l.importe || 0), 0) * 100) / 100;
    const totalActual = Number(comanda.total);
    const idsDetalle = lineas.rows.map((l) => l.id_venta_detalle);
    const totalNuevoResult = await pool.query(`
      SELECT COALESCE(SUM(subtotal), 0)::numeric AS total
      FROM ventas_detalle
      WHERE id_venta = $1
        AND estado = 'ACTIVO'
        AND id <> ALL($2::bigint[])
    `, [comanda.id_venta, idsDetalle]);
    const nuevoTotal = Math.round((Number(totalNuevoResult.rows[0].total) + Number.EPSILON) * 100) / 100;
    const pagado = Number(comanda.pagado || 0);
    const excedenteCobrado = Math.max(0, Math.round((pagado - nuevoTotal + Number.EPSILON) * 100) / 100);

    res.json({
      comanda: {
        id: comanda.id,
        numero_comanda: comanda.numero_comanda,
        estado: comanda.estado
      },
      pedido: {
        id: comanda.id_venta,
        numero: comanda.numero_pedido,
        estado: comanda.estado_pedido,
        modalidad: comanda.modalidad
      },
      productos: lineas.rows.map((l) => ({
        id_venta_detalle: l.id_venta_detalle,
        producto: l.producto,
        cantidad: Number(l.cantidad),
        importe: Number(l.importe)
      })),
      resumen: {
        total_actual: totalActual,
        importe_a_descontar: importeAnular,
        nuevo_total: nuevoTotal,
        pagado,
        nuevo_saldo: Math.max(0, Math.round((nuevoTotal - pagado + Number.EPSILON) * 100) / 100),
        excedente_cobrado: excedenteCobrado
      },
      puede_confirmar: excedenteCobrado === 0
    });
  } catch (error) {
    console.error("Error al previsualizar anulación de comanda:", error);
    res.status(500).json({ mensaje: "No se pudo calcular el impacto de la anulación." });
  }
}

async function anularComanda(req, res) {
  const id = Number(req.params.id);
  const motivo = String(req.body?.motivo || "").trim().slice(0, 1000);
  const usuario = String(req.body?.usuario || "").trim().slice(0, 120);
  const totalEsperado = Number(req.body?.total_esperado);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: "Identificador de comanda inválido." });
  }
  if (!motivo) return res.status(400).json({ mensaje: "El motivo de anulación es obligatorio." });
  if (!usuario) return res.status(400).json({ mensaje: "Ingresá el nombre del operador que realiza la anulación." });
  if (!Number.isFinite(totalEsperado) || totalEsperado < 0) {
    return res.status(400).json({ mensaje: "No se recibió un total de revisión válido. Volvé a calcular el impacto." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ventaResult = await client.query(
      "SELECT id, numero, estado, total FROM ventas WHERE id = (SELECT id_venta FROM ventas_comandas WHERE id = $1) FOR UPDATE",
      [id]
    );
    if (!ventaResult.rowCount) throw Object.assign(new Error("No se encontró el pedido asociado."), { status: 404 });
    const venta = ventaResult.rows[0];

    if (["EN_REPARTO", "ENTREGADO", "ANULADO"].includes(venta.estado)) {
      throw Object.assign(new Error("No se puede anular una comanda cuando el pedido ya salió a reparto, fue entregado o está anulado."), { status: 409 });
    }

    const comandaResult = await client.query(
      "SELECT id, id_venta, numero_comanda, estado FROM ventas_comandas WHERE id = $1 AND id_venta = $2 FOR UPDATE",
      [id, venta.id]
    );
    if (!comandaResult.rowCount) throw Object.assign(new Error("No se encontró la comanda."), { status: 404 });
    const comanda = comandaResult.rows[0];
    if (comanda.estado === "ANULADA") throw Object.assign(new Error("La comanda ya está anulada."), { status: 409 });

    const lineas = await client.query(`
      SELECT vd.id,
             ROUND(vd.subtotal * cd.cantidad / NULLIF(vd.cantidad, 0), 2)::numeric AS importe
      FROM ventas_comandas_detalle cd
      INNER JOIN ventas_detalle vd
        ON vd.id = cd.id_venta_detalle AND vd.id_venta = cd.id_venta
      WHERE cd.id_comanda = $1
        AND cd.id_venta = $2
        AND vd.estado = 'ACTIVO'
      FOR UPDATE OF vd
    `, [id, venta.id]);
    if (!lineas.rowCount) throw Object.assign(new Error("La comanda no tiene productos activos para anular."), { status: 409 });

    const otrasActivas = await client.query(`
      SELECT COUNT(*)::int AS cantidad
      FROM ventas_comandas
      WHERE id_venta = $1 AND estado <> 'ANULADA' AND id <> $2
    `, [venta.id, id]);
    if (otrasActivas.rows[0].cantidad === 0) {
      throw Object.assign(new Error("No se puede anular la última comanda activa del pedido. Para cancelar todo el pedido debe utilizarse la anulación de venta."), { status: 409 });
    }

    const idsDetalle = lineas.rows.map((l) => l.id);
    const importeAnular = Math.round(lineas.rows.reduce((s, l) => s + Number(l.importe || 0), 0) * 100) / 100;
    const nuevoTotalResult = await client.query(`
      SELECT COALESCE(SUM(subtotal), 0)::numeric AS total
      FROM ventas_detalle
      WHERE id_venta = $1
        AND estado = 'ACTIVO'
        AND id <> ALL($2::bigint[])
    `, [venta.id, idsDetalle]);
    const nuevoTotal = Math.round((Number(nuevoTotalResult.rows[0].total) + Number.EPSILON) * 100) / 100;

    if (Math.abs(nuevoTotal - totalEsperado) > 0.009) {
      throw Object.assign(new Error("El pedido cambió desde que se mostró la revisión. No se aplicó ninguna modificación. Volvé a revisar el impacto económico."), { status: 409 });
    }

    const pagos = await client.query(
      "SELECT COALESCE(SUM(importe), 0)::numeric AS pagado FROM ventas_pagos WHERE id_venta = $1 AND estado = 'CONFIRMADO'",
      [venta.id]
    );
    const pagado = Number(pagos.rows[0].pagado || 0);
    if (pagado - nuevoTotal > 0.009) {
      const excedente = Math.round((pagado - nuevoTotal) * 100) / 100;
      throw Object.assign(new Error(`No se puede confirmar la anulación porque ya se cobraron ${excedente.toFixed(2)} más que el nuevo total. Primero debe resolverse ese excedente; los pagos no se borrarán ni modificarán automáticamente.`), { status: 409 });
    }

    await client.query(
      "UPDATE ventas_detalle SET estado = 'ANULADO' WHERE id = ANY($1::bigint[]) AND id_venta = $2",
      [idsDetalle, venta.id]
    );
    await client.query(`
      UPDATE ventas_comandas
      SET estado = 'ANULADA',
          fecha_anulacion = NOW(),
          motivo_anulacion = $1,
          usuario_anulacion = $2,
          fecha_actualizacion = NOW()
      WHERE id = $3
    `, [motivo, usuario, id]);

    const estadoComandas = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado <> 'ANULADA')::int AS activas,
        COUNT(*) FILTER (WHERE estado NOT IN ('LISTA', 'ANULADA'))::int AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'EN_PREPARACION')::int AS preparando
      FROM ventas_comandas
      WHERE id_venta = $1
    `, [venta.id]);

    const resumenEstados = estadoComandas.rows[0];
    if (!resumenEstados.activas) {
      throw Object.assign(new Error("El pedido quedaría sin comandas activas. No se aplicó la anulación."), { status: 409 });
    }

    const nuevoEstadoPedido = resumenEstados.pendientes === 0
      ? "LISTO_PARA_ENTREGAR"
      : resumenEstados.preparando > 0 ? "EN_PREPARACION" : "PENDIENTE";

    await client.query(
      "UPDATE ventas SET total = $1, estado = $2, fecha_actualizacion = NOW() WHERE id = $3",
      [nuevoTotal, nuevoEstadoPedido, venta.id]
    );

    await client.query("COMMIT");
    res.json({
      mensaje: `Comanda #${comanda.numero_comanda} anulada. El pedido #${venta.numero} continúa activo con las demás comandas.`,
      comanda: { id, estado: "ANULADA", motivo, usuario },
      pedido: { id: venta.id, numero: venta.numero, total_anterior: Number(venta.total), importe_descontado: importeAnular, total_nuevo: nuevoTotal, pagado, pendiente: Math.max(0, nuevoTotal - pagado), estado: nuevoEstadoPedido }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    console.error("Error al anular comanda:", error);
    res.status(500).json({ mensaje: "No se pudo anular la comanda. No se confirmaron cambios." });
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

module.exports = { consultarComandas, actualizarEstadoComanda, previsualizarAnulacionComanda, anularComanda, registrarSolicitudImpresion };
