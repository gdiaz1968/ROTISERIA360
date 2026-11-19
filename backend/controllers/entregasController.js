const pool = require("../db");

function enteroPositivo(valor) {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function importe(valor) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.round((n + Number.EPSILON) * 100) / 100 : null;
}

async function listarPedidosEntrega(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT
        v.id, v.numero, v.modalidad, v.estado, v.fecha, v.fecha_entrega_programada,
        v.fecha_entrega, v.total, v.direccion_entrega, v.localidad_entrega,
        v.referencia_entrega, v.observaciones,
        COALESCE(c.nombre, '') AS cliente,
        v.id_repartidor,
        COALESCE(r.nombre, '') AS repartidor,
        rp.id_reparto,
        rep.fecha_salida,
        COALESCE(p.pagado, 0)::numeric AS pagado,
        GREATEST(v.total - COALESCE(p.pagado, 0), 0)::numeric AS pendiente,
        rend.importe_esperado AS rendicion_esperada,
        rend.importe_efectivo AS rendicion_efectivo,
        rend.importe_transferencia AS rendicion_transferencia,
        rend.diferencia AS rendicion_diferencia,
        rend.fecha_rendicion,
        COALESCE(det.detalles, '[]'::json) AS detalles
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.id_cliente
      LEFT JOIN repartidores r ON r.id = v.id_repartidor
      LEFT JOIN repartos_pedidos rp ON rp.id_venta = v.id
      LEFT JOIN repartos rep ON rep.id = rp.id_reparto
      LEFT JOIN LATERAL (
        SELECT SUM(importe) AS pagado
        FROM ventas_pagos vp
        WHERE vp.id_venta = v.id AND vp.estado = 'CONFIRMADO'
      ) p ON TRUE
      LEFT JOIN ventas_rendiciones rend ON rend.id_venta = v.id
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'producto', nombre_producto,
          'cantidad', cantidad,
          'observaciones', COALESCE(observaciones, '')
        ) ORDER BY id) AS detalles
        FROM ventas_detalle
        WHERE id_venta = v.id
          AND estado = 'ACTIVO'
      ) det ON TRUE
      WHERE v.estado IN ('LISTO_PARA_ENTREGAR', 'EN_REPARTO', 'ENTREGADO')
      ORDER BY
        CASE v.estado WHEN 'LISTO_PARA_ENTREGAR' THEN 1 WHEN 'EN_REPARTO' THEN 2 ELSE 3 END,
        v.fecha DESC, v.numero DESC
      LIMIT 200
    `);
    res.json({ pedidos: resultado.rows });
  } catch (error) {
    console.error("Error al listar pedidos para entrega:", error);
    res.status(500).json({ mensaje: "No se pudieron consultar los pedidos de entrega. Verificá que esté aplicada la migración de delivery." });
  }
}

async function listarRepartidores(req, res) {
  try {
    const resultado = await pool.query(
      "SELECT id, nombre, telefono FROM repartidores WHERE activo = TRUE ORDER BY nombre"
    );
    res.json({ repartidores: resultado.rows });
  } catch (error) {
    console.error("Error al listar repartidores:", error);
    res.status(500).json({ mensaje: "No se pudieron consultar los repartidores." });
  }
}

async function crearRepartidor(req, res) {
  const nombre = String(req.body?.nombre || "").trim().slice(0, 150);
  const telefono = String(req.body?.telefono || "").trim().slice(0, 50);
  if (!nombre) return res.status(400).json({ mensaje: "Ingresá el nombre del repartidor." });
  try {
    const resultado = await pool.query(
      "INSERT INTO repartidores (nombre, telefono) VALUES ($1, $2) RETURNING id, nombre, telefono",
      [nombre, telefono || null]
    );
    res.status(201).json({ repartidor: resultado.rows[0], mensaje: "Repartidor registrado." });
  } catch (error) {
    console.error("Error al crear repartidor:", error);
    res.status(500).json({ mensaje: "No se pudo registrar el repartidor." });
  }
}

async function crearReparto(req, res) {
  const idRepartidor = enteroPositivo(req.body?.id_repartidor);
  const ids = Array.isArray(req.body?.ids_ventas)
    ? [...new Set(req.body.ids_ventas.map(enteroPositivo).filter(Boolean))]
    : [];
  if (!idRepartidor) return res.status(400).json({ mensaje: "Seleccioná un repartidor válido." });
  if (!ids.length) return res.status(400).json({ mensaje: "Seleccioná al menos un pedido delivery listo." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const repartidor = await client.query(
      "SELECT id FROM repartidores WHERE id = $1 AND activo = TRUE FOR SHARE",
      [idRepartidor]
    );
    if (!repartidor.rowCount) throw Object.assign(new Error("El repartidor no existe o está inactivo."), { status: 400 });

    const pedidos = await client.query(
      "SELECT id, numero FROM ventas WHERE id = ANY($1::bigint[]) AND modalidad = 'DELIVERY' AND estado = 'LISTO_PARA_ENTREGAR' FOR UPDATE",
      [ids]
    );
    if (pedidos.rowCount !== ids.length) {
      throw Object.assign(new Error("Algún pedido ya no está disponible para salir o no corresponde a delivery. Actualizá la pantalla."), { status: 409 });
    }

    const reparto = await client.query(
      "INSERT INTO repartos (id_repartidor) VALUES ($1) RETURNING id, fecha_salida",
      [idRepartidor]
    );
    const idReparto = reparto.rows[0].id;
    for (const pedido of pedidos.rows) {
      await client.query(
        "INSERT INTO repartos_pedidos (id_reparto, id_venta) VALUES ($1, $2)",
        [idReparto, pedido.id]
      );
      await client.query(
        "UPDATE ventas SET estado = 'EN_REPARTO', id_repartidor = $1, fecha_actualizacion = NOW() WHERE id = $2",
        [idRepartidor, pedido.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      mensaje: `Salida registrada para ${pedidos.rowCount} pedido(s).`,
      reparto: { id: idReparto, fecha_salida: reparto.rows[0].fecha_salida, numero_pedidos: pedidos.rowCount }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    console.error("Error al registrar salida de reparto:", error);
    res.status(500).json({ mensaje: "No se pudo registrar la salida. Verificá que esté aplicada la migración de delivery." });
  } finally {
    client.release();
  }
}

async function confirmarEntrega(req, res) {
  const idVenta = enteroPositivo(req.params.id);
  const efectivo = importe(req.body?.efectivo);
  const transferencia = importe(req.body?.transferencia);
  const observaciones = String(req.body?.observaciones || "").trim().slice(0, 1000);
  const usuario = String(req.body?.usuario || "OPERADOR").trim().slice(0, 120) || "OPERADOR";
  if (!idVenta) return res.status(400).json({ mensaje: "Pedido inválido." });
  if (efectivo === null || transferencia === null) {
    return res.status(400).json({ mensaje: "Los importes de efectivo y transferencia deben ser cero o mayores." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ventaResult = await client.query(
      "SELECT id, numero, modalidad, estado, total FROM ventas WHERE id = $1 FOR UPDATE",
      [idVenta]
    );
    if (!ventaResult.rowCount) throw Object.assign(new Error("No se encontró el pedido."), { status: 404 });
    const venta = ventaResult.rows[0];
    const estadoEsperado = venta.modalidad === "DELIVERY" ? "EN_REPARTO" : "LISTO_PARA_ENTREGAR";
    if (venta.estado !== estadoEsperado) {
      throw Object.assign(new Error(`El pedido #${venta.numero} no está en estado válido para confirmar su entrega.`), { status: 409 });
    }

    const rendicionExistente = await client.query(
      "SELECT id FROM ventas_rendiciones WHERE id_venta = $1",
      [idVenta]
    );
    if (rendicionExistente.rowCount) throw Object.assign(new Error("Este pedido ya tiene una rendición registrada."), { status: 409 });

    const pagos = await client.query(
      "SELECT COALESCE(SUM(importe), 0)::numeric AS pagado FROM ventas_pagos WHERE id_venta = $1 AND estado = 'CONFIRMADO'",
      [idVenta]
    );
    const esperado = Math.max(0, Math.round((Number(venta.total) - Number(pagos.rows[0].pagado) + Number.EPSILON) * 100) / 100);
    const totalRendido = Math.round((efectivo + transferencia + Number.EPSILON) * 100) / 100;
    const centavosEsperados = Math.round(esperado * 100);
    const centavosRendidos = Math.round(totalRendido * 100);

    // Regla de negocio A: la entrega solo se confirma si se cobra el saldo completo.
    if (centavosRendidos !== centavosEsperados) {
      const diferenciaPendiente = Math.max(0, esperado - totalRendido);
      const excedente = Math.max(0, totalRendido - esperado);
      const detalle = diferenciaPendiente > 0
        ? `Faltan cobrar ${diferenciaPendiente.toFixed(2)}.`
        : `El importe ingresado supera el saldo en ${excedente.toFixed(2)}.`;
      throw Object.assign(
        new Error(`No se puede confirmar la entrega. El saldo pendiente es ${esperado.toFixed(2)} y efectivo más transferencia deben sumar exactamente ese importe. ${detalle}`),
        { status: 400 }
      );
    }

    const diferencia = 0;

    if (efectivo > 0) {
      await client.query(
        "INSERT INTO ventas_pagos (id_venta, medio_pago, importe, estado, observaciones) VALUES ($1, 'EFECTIVO', $2, 'CONFIRMADO', $3)",
        [idVenta, efectivo, "Cobro registrado al confirmar la entrega."]
      );
    }
    if (transferencia > 0) {
      await client.query(
        "INSERT INTO ventas_pagos (id_venta, medio_pago, importe, estado, observaciones) VALUES ($1, 'TRANSFERENCIA', $2, 'CONFIRMADO', $3)",
        [idVenta, transferencia, "Cobro registrado al confirmar la entrega."]
      );
    }

    const reparto = await client.query(
      "SELECT id_reparto FROM repartos_pedidos WHERE id_venta = $1",
      [idVenta]
    );
    await client.query(`
      INSERT INTO ventas_rendiciones
        (id_venta, id_reparto, importe_esperado, importe_efectivo, importe_transferencia, diferencia, observaciones, usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [idVenta, reparto.rows[0]?.id_reparto || null, esperado, efectivo, transferencia, diferencia, observaciones || null, usuario]);

    await client.query(
      "UPDATE ventas SET estado = 'ENTREGADO', fecha_entrega = NOW(), usuario_entrega = $1, fecha_actualizacion = NOW() WHERE id = $2",
      [usuario, idVenta]
    );

    if (reparto.rowCount) {
      await client.query(`
        UPDATE repartos
        SET estado = 'FINALIZADO', fecha_cierre = NOW()
        WHERE id = $1
          AND NOT EXISTS (
            SELECT 1 FROM repartos_pedidos rp
            INNER JOIN ventas v ON v.id = rp.id_venta
            WHERE rp.id_reparto = $1 AND v.estado <> 'ENTREGADO'
          )
      `, [reparto.rows[0].id_reparto]);
    }

    await client.query("COMMIT");
    res.json({
      mensaje: `Pedido #${venta.numero} confirmado como entregado.`,
      rendicion: { esperado, efectivo, transferencia, diferencia }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    console.error("Error al confirmar entrega:", error);
    res.status(500).json({ mensaje: "No se pudo confirmar la entrega. Verificá que esté aplicada la migración de delivery." });
  } finally {
    client.release();
  }
}

module.exports = {
  listarPedidosEntrega,
  listarRepartidores,
  crearRepartidor,
  crearReparto,
  confirmarEntrega
};
