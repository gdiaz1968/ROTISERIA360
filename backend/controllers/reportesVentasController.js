const pool = require("../db");

function fechaValida(valor) {
  return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(valor || ""));
}

async function reporteVentas(req, res) {
  const desde = String(req.query.desde || "").trim();
  const hasta = String(req.query.hasta || "").trim();

  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) {
    return res.status(400).json({ mensaje: "Las fechas del reporte deben tener formato AAAA-MM-DD." });
  }
  if (desde && hasta && desde > hasta) {
    return res.status(400).json({ mensaje: "La fecha desde no puede ser posterior a la fecha hasta." });
  }

  const parametros = [];
  const condiciones = [];
  if (desde) {
    parametros.push(desde);
    condiciones.push(`v.fecha >= $${parametros.length}::date`);
  }
  if (hasta) {
    parametros.push(hasta);
    condiciones.push(`v.fecha < ($${parametros.length}::date + INTERVAL '1 day')`);
  }
  const whereFecha = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  try {
    const [resumen, ventas, productos, pagos, evolucion] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE v.estado <> 'ANULADO')::int AS operaciones,
          COALESCE(SUM(v.total) FILTER (WHERE v.estado <> 'ANULADO'), 0)::numeric AS total_vendido,
          COALESCE(AVG(v.total) FILTER (WHERE v.estado <> 'ANULADO'), 0)::numeric AS promedio_venta,
          COALESCE(SUM(COALESCE(pg.pagado, 0)) FILTER (WHERE v.estado <> 'ANULADO'), 0)::numeric AS total_cobrado,
          COALESCE(SUM(GREATEST(v.total - COALESCE(pg.pagado, 0), 0)) FILTER (WHERE v.estado <> 'ANULADO'), 0)::numeric AS saldo_pendiente,
          COALESCE(SUM(GREATEST(COALESCE(pg.pagado, 0) - v.total, 0)) FILTER (WHERE v.estado <> 'ANULADO'), 0)::numeric AS excedente_cobrado,
          COUNT(*) FILTER (WHERE v.estado = 'ANULADO')::int AS operaciones_anuladas
        FROM ventas v
        LEFT JOIN LATERAL (
          SELECT SUM(vp.importe) AS pagado
          FROM ventas_pagos vp
          WHERE vp.id_venta = v.id AND vp.estado = 'CONFIRMADO'
        ) pg ON TRUE
        ${whereFecha}
      `, parametros),
      pool.query(`
        SELECT v.id, v.numero, v.fecha, v.canal, v.modalidad, v.estado, v.total,
          COALESCE(c.nombre, 'Consumidor final') AS cliente,
          COALESCE(pg.pagado, 0)::numeric AS pagado,
          GREATEST(v.total - COALESCE(pg.pagado, 0), 0)::numeric AS pendiente,
          GREATEST(COALESCE(pg.pagado, 0) - v.total, 0)::numeric AS excedente
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.id_cliente
        LEFT JOIN LATERAL (
          SELECT SUM(vp.importe) AS pagado
          FROM ventas_pagos vp
          WHERE vp.id_venta = v.id AND vp.estado = 'CONFIRMADO'
        ) pg ON TRUE
        ${whereFecha}
        ORDER BY v.fecha DESC, v.numero DESC
        LIMIT 500
      `, parametros),
      pool.query(`
        SELECT vd.nombre_producto AS producto,
          COALESCE(SUM(vd.cantidad), 0)::numeric AS cantidad,
          COALESCE(SUM(vd.subtotal), 0)::numeric AS importe
        FROM ventas_detalle vd
        INNER JOIN ventas v ON v.id = vd.id_venta
        ${whereFecha ? whereFecha + " AND " : "WHERE "}v.estado <> 'ANULADO' AND vd.estado = 'ACTIVO'
        GROUP BY vd.nombre_producto
        ORDER BY SUM(vd.subtotal) DESC, vd.nombre_producto
        LIMIT 100
      `, parametros),
      pool.query(`
        SELECT vp.medio_pago,
          COALESCE(SUM(vp.importe), 0)::numeric AS importe,
          COUNT(*)::int AS operaciones
        FROM ventas_pagos vp
        INNER JOIN ventas v ON v.id = vp.id_venta
        ${whereFecha ? whereFecha + " AND " : "WHERE "}v.estado <> 'ANULADO' AND vp.estado = 'CONFIRMADO'
        GROUP BY vp.medio_pago
        ORDER BY SUM(vp.importe) DESC, vp.medio_pago
      `, parametros),
      pool.query(`
        SELECT TO_CHAR(v.fecha::date, 'YYYY-MM-DD') AS fecha,
          COALESCE(SUM(v.total) FILTER (WHERE v.estado <> 'ANULADO'), 0)::numeric AS vendido,
          COUNT(*) FILTER (WHERE v.estado <> 'ANULADO')::int AS operaciones
        FROM ventas v
        ${whereFecha}
        GROUP BY v.fecha::date
        ORDER BY v.fecha::date
      `, parametros)
    ]);

    res.json({
      filtros: { desde: desde || null, hasta: hasta || null },
      resumen: resumen.rows[0],
      ventas: ventas.rows,
      productos: productos.rows,
      pagos: pagos.rows,
      evolucion: evolucion.rows
    });
  } catch (error) {
    console.error("Error al generar reportes de ventas:", error);
    res.status(500).json({ mensaje: "No se pudieron generar los reportes de ventas." });
  }
}

module.exports = { reporteVentas };
