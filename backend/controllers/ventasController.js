const pool = require("../db");
const { registrarActividad } = require("../services/auditoriaService");

async function auditarVenta(req, { accion, resultado = "OK", entidadId = null, detalle = {} }) {
  await registrarActividad({
    modulo: "VENTAS",
    pantalla: "VENTAS",
    accion,
    entidad: "VENTA",
    entidadId: entidadId == null ? null : String(entidadId),
    metodoHttp: req.method,
    ruta: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
    resultado,
    detalle
  });
}

function errorValidacion(mensaje) {
  return Object.assign(new Error(mensaje), { esValidacion: true });
}

const CANALES = ["MOSTRADOR", "WHATSAPP", "TELEFONO"];
const MODALIDADES = ["MOSTRADOR", "RETIRO", "DELIVERY"];
const MEDIOS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "DEBITO", "CREDITO", "QR", "OTRO"];

function texto(valor, maximo = 500) {
  return String(valor ?? "").trim().slice(0, maximo);
}

function numeroPositivo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function listarVentas(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT
        v.id, v.numero, v.fecha, v.canal, v.modalidad, v.estado,
        v.total, v.fecha_entrega_programada,
        COALESCE(c.nombre, '') AS cliente,
        COALESCE(pagos.pagado, 0)::numeric AS pagado,
        GREATEST(v.total - COALESCE(pagos.pagado, 0), 0)::numeric AS pendiente
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.id_cliente
      LEFT JOIN LATERAL (
        SELECT SUM(importe) AS pagado
        FROM ventas_pagos
        WHERE id_venta = v.id AND estado = 'CONFIRMADO'
      ) pagos ON TRUE
      ORDER BY v.fecha_alta DESC, v.id DESC
      LIMIT 12
    `);
    res.json({ ventas: resultado.rows });
  } catch (error) {
    console.error("Error al listar ventas:", error);
    res.status(500).json({ mensaje: "No se pudieron consultar las ventas." });
  }
}

async function crearVenta(req, res) {
  const body = req.body || {};
  const canal = texto(body.canal, 20).toUpperCase();
  const modalidad = texto(body.modalidad, 20).toUpperCase();
  const items = Array.isArray(body.detalles) ? body.detalles : [];
  const pagos = Array.isArray(body.pagos) ? body.pagos : [];
  const nombreCliente = texto(body.cliente?.nombre, 150);
  const telefonoCliente = texto(body.cliente?.telefono, 50);
  const direccion = texto(body.direccion_entrega, 250);
  const localidad = texto(body.localidad_entrega, 120);
  const referencia = texto(body.referencia_entrega, 500);
  const observaciones = texto(body.observaciones, 2000);

  if (!CANALES.includes(canal)) {
    await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "CANAL_INVALIDO" } });
    return res.status(400).json({ mensaje: "El canal del pedido no es válido." });
  }
  if (!MODALIDADES.includes(modalidad)) {
    await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "MODALIDAD_INVALIDA" } });
    return res.status(400).json({ mensaje: "La modalidad de entrega no es válida." });
  }
  if (!items.length) {
    await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "SIN_PRODUCTOS" } });
    return res.status(400).json({ mensaje: "Agregá al menos un producto al pedido." });
  }
  if (modalidad === "DELIVERY" && !direccion) {
    await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "DELIVERY_SIN_DIRECCION" } });
    return res.status(400).json({ mensaje: "Para un delivery tenés que indicar la dirección de entrega." });
  }
  if (pagos.length > 5) {
    await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "DEMASIADOS_MEDIOS_PAGO", cantidad: pagos.length } });
    return res.status(400).json({ mensaje: "Se permiten hasta cinco medios de pago por pedido." });
  }

  const fechaProgramada = body.fecha_entrega_programada
    ? new Date(body.fecha_entrega_programada)
    : null;
  if (fechaProgramada && Number.isNaN(fechaProgramada.getTime())) {
    await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "FECHA_PROGRAMADA_INVALIDA" } });
    return res.status(400).json({ mensaje: "La fecha programada no es válida." });
  }

  const pagosValidados = [];
  for (const pago of pagos) {
    const medio = texto(pago.medio_pago, 20).toUpperCase();
    const importe = numeroPositivo(pago.importe);
    if (!MEDIOS_PAGO.includes(medio) || !importe) {
      await auditarVenta(req, { accion: "PEDIDO_CREAR", resultado: "ADVERTENCIA", detalle: { motivo: "PAGO_INVALIDO", medio_pago: medio } });
      return res.status(400).json({ mensaje: "Revisá los medios e importes de pago ingresados." });
    }
    pagosValidados.push({ medio, importe });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Serializa la numeración para evitar números de pedido duplicados si ingresan dos ventas juntas.
    await client.query("SELECT pg_advisory_xact_lock(360202611)");
    const numeroResult = await client.query("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM ventas");
    const numero = Number(numeroResult.rows[0].numero);

    let idCliente = null;
    if (nombreCliente) {
      if (telefonoCliente) {
        const existente = await client.query(
          "SELECT id FROM clientes WHERE activo = TRUE AND telefono = $1 ORDER BY id LIMIT 1",
          [telefonoCliente]
        );
        if (existente.rowCount) idCliente = existente.rows[0].id;
      }
      if (idCliente) {
        await client.query(
          "UPDATE clientes SET nombre = $1, fecha_actualizacion = NOW() WHERE id = $2",
          [nombreCliente, idCliente]
        );
      } else {
        const nuevoCliente = await client.query(
          "INSERT INTO clientes (nombre, telefono) VALUES ($1, $2) RETURNING id",
          [nombreCliente, telefonoCliente || null]
        );
        idCliente = nuevoCliente.rows[0].id;
      }
    }

    const lineas = [];
    let total = 0;
    for (const item of items) {
      const idProducto = Number(item.id_producto);
      const cantidad = numeroPositivo(item.cantidad);
      if (!Number.isSafeInteger(idProducto) || idProducto <= 0 || !cantidad) {
        throw errorValidacion("Hay un producto o una cantidad inválida en el pedido.");
      }

      const productoResult = await client.query(`
        SELECT p.id, p.nombre, p.tipo, pv.precio_venta,
               pv.id_sector, sc.nombre AS sector_nombre
        FROM productos p
        INNER JOIN productos_venta pv ON pv.id_producto = p.id
        INNER JOIN sectores_cocina sc ON sc.id = pv.id_sector AND sc.activo = TRUE
        WHERE p.id = $1
          AND p.activo = TRUE
          AND pv.activo = TRUE
          AND pv.habilitado_venta = TRUE
        FOR SHARE OF p, pv
      `, [idProducto]);

      if (!productoResult.rowCount) {
        throw errorValidacion("Uno de los productos no está habilitado para la venta o no tiene un sector activo asignado. Revisá Productos para la venta.");
      }

      const producto = productoResult.rows[0];
      const precio = Number(producto.precio_venta);
      const subtotal = Math.round((cantidad * precio + Number.EPSILON) * 100) / 100;
      total += subtotal;
      lineas.push({
        id_producto: idProducto,
        id_sector: producto.id_sector,
        sector: producto.sector_nombre,
        nombre: producto.nombre,
        cantidad,
        precio,
        subtotal,
        observaciones: texto(item.observaciones, 500)
      });
    }
    total = Math.round((total + Number.EPSILON) * 100) / 100;

    const totalPagado = Math.round((pagosValidados.reduce((suma, pago) => suma + pago.importe, 0) + Number.EPSILON) * 100) / 100;
    if (totalPagado - total > 0.009) {
      throw errorValidacion("El importe cobrado no puede superar el total del pedido.");
    }

    const ventaResult = await client.query(`
      INSERT INTO ventas (
        numero, id_cliente, canal, modalidad, estado, fecha_entrega_programada,
        total, observaciones, direccion_entrega, localidad_entrega, referencia_entrega
      )
      VALUES ($1, $2, $3, $4, 'PENDIENTE', $5, $6, $7, $8, $9, $10)
      RETURNING id, numero, fecha, fecha_alta, canal, modalidad, estado, total
    `, [
      numero, idCliente, canal, modalidad, fechaProgramada, total,
      observaciones || null, direccion || null, localidad || null, referencia || null
    ]);

    const venta = ventaResult.rows[0];
    for (const linea of lineas) {
      const detalleResult = await client.query(`
        INSERT INTO ventas_detalle
          (id_venta, id_producto, nombre_producto, cantidad, precio_unitario, descuento, subtotal, observaciones)
        VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
        RETURNING id
      `, [
        venta.id, linea.id_producto, linea.nombre, linea.cantidad,
        linea.precio, linea.subtotal, linea.observaciones || null
      ]);
      linea.id_venta_detalle = detalleResult.rows[0].id;
    }

    // Una comanda por sector. Todo se guarda dentro de la misma transacción de la venta.
    const lineasPorSector = new Map();
    for (const linea of lineas) {
      const clave = String(linea.id_sector);
      if (!lineasPorSector.has(clave)) lineasPorSector.set(clave, []);
      lineasPorSector.get(clave).push(linea);
    }

    const comandasGeneradas = [];
    for (const [idSector, lineasSector] of lineasPorSector.entries()) {
      const comandaResult = await client.query(`
        INSERT INTO ventas_comandas (id_venta, id_sector, observaciones)
        VALUES ($1, $2, $3)
        RETURNING id, numero_comanda, id_sector, fecha_alta
      `, [venta.id, Number(idSector), observaciones || null]);

      const comanda = comandaResult.rows[0];
      for (const linea of lineasSector) {
        await client.query(`
          INSERT INTO ventas_comandas_detalle
            (id_comanda, id_venta, id_venta_detalle, cantidad)
          VALUES ($1, $2, $3, $4)
        `, [comanda.id, venta.id, linea.id_venta_detalle, linea.cantidad]);
      }

      comandasGeneradas.push({
        id: comanda.id,
        numero_comanda: comanda.numero_comanda,
        numero_pedido: venta.numero,
        sector: lineasSector[0].sector,
        estado: "PENDIENTE",
        fecha_alta: comanda.fecha_alta,
        detalles: lineasSector.map((linea) => ({
          producto: linea.nombre,
          cantidad: linea.cantidad,
          observaciones: linea.observaciones
        }))
      });
    }

    for (const pago of pagosValidados) {
      await client.query(`
        INSERT INTO ventas_pagos (id_venta, medio_pago, importe, estado)
        VALUES ($1, $2, $3, 'CONFIRMADO')
      `, [venta.id, pago.medio, pago.importe]);
    }

    await client.query("COMMIT");
    await auditarVenta(req, {
      accion: "PEDIDO_CREADO",
      resultado: "OK",
      entidadId: venta.id,
      detalle: {
        numero_pedido: venta.numero,
        canal,
        modalidad,
        total,
        total_pagado: totalPagado,
        saldo_pendiente: Math.max(0, Math.round((total - totalPagado + Number.EPSILON) * 100) / 100),
        cantidad_productos: lineas.length,
        cantidad_comandas: comandasGeneradas.length,
        pagos: pagosValidados.map((pago) => ({ medio_pago: pago.medio, importe: pago.importe }))
      }
    });
    res.status(201).json({
      mensaje: "Pedido registrado y comandas generadas correctamente.",
      comandas: comandasGeneradas,
      venta: {
        ...venta,
        total: Number(venta.total),
        pagado: totalPagado,
        pendiente: Math.max(0, Math.round((total - totalPagado + Number.EPSILON) * 100) / 100),
        cliente: nombreCliente
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear venta:", error);
    const esValidacion = Boolean(error.esValidacion);
    await auditarVenta(req, {
      accion: "PEDIDO_CREAR",
      resultado: esValidacion ? "ADVERTENCIA" : "ERROR",
      detalle: {
        motivo: esValidacion ? "VALIDACION_RECHAZADA" : "ERROR_INTERNO",
        mensaje: error.message || "Error no identificado"
      }
    });
    const mensaje = esValidacion ? error.message : "No se pudo registrar el pedido.";
    res.status(esValidacion ? 400 : 500).json({ mensaje });
  } finally {
    client.release();
  }
}

module.exports = { listarVentas, crearVenta };
