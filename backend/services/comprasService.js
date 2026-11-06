
const pool = require("../db");

const FACTOR_PREDETERMINADO = 1.15;

function numeroValido(valor) {
  return valor !== null && valor !== undefined && valor !== "" &&
    Number.isFinite(Number(valor));
}

function redondear6(valor) {
  return Number(Number(valor).toFixed(6));
}

async function listarCompras() {
  const { rows } = await pool.query(`
    SELECT
      c.id,
      c.id_proveedor,
      p.nombre AS proveedor,
      c.fecha_compra,
      c.tipo_comprobante,
      c.numero_comprobante,
      c.observaciones,
      c.estado,
      c.fecha_alta,
      c.fecha_confirmacion,
      COUNT(d.id)::int AS cantidad_detalles,
      COALESCE(SUM(d.subtotal), 0)::numeric(18,6) AS total
    FROM compras c
    INNER JOIN proveedores p ON p.id = c.id_proveedor
    LEFT JOIN compras_detalle d ON d.id_compra = c.id
    GROUP BY c.id, p.nombre
    ORDER BY c.fecha_compra DESC, c.id DESC
  `);

  return rows;
}

async function obtenerCompra(id) {
  const compra = await pool.query(`
    SELECT
      c.*,
      p.nombre AS proveedor
    FROM compras c
    INNER JOIN proveedores p ON p.id = c.id_proveedor
    WHERE c.id = $1
  `, [id]);

  if (!compra.rowCount) {
    const error = new Error("La compra no existe.");
    error.status = 404;
    throw error;
  }

  const detalles = await pool.query(`
    SELECT
      d.*,
      p.codigo AS codigo_producto,
      p.nombre AS producto,
      p.tipo AS tipo_producto,
      u.codigo AS unidad
    FROM compras_detalle d
    INNER JOIN productos p ON p.id = d.id_producto
    INNER JOIN unidades_medida u ON u.id = d.id_unidad
    WHERE d.id_compra = $1
    ORDER BY d.id
  `, [id]);

  return {
    ...compra.rows[0],
    detalles: detalles.rows
  };
}

async function crearCompra(datos) {
  const {
    id_proveedor,
    fecha_compra,
    tipo_comprobante,
    numero_comprobante,
    observaciones,
    detalles
  } = datos;

  if (!numeroValido(id_proveedor)) {
    throw new Error("Debe seleccionar un proveedor válido.");
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new Error("La compra debe contener al menos un producto.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const proveedor = await client.query(`
      SELECT id
      FROM proveedores
      WHERE id = $1 AND activo = TRUE
      FOR SHARE
    `, [id_proveedor]);

    if (!proveedor.rowCount) {
      throw new Error("El proveedor no existe o está inactivo.");
    }

    let faltaPrecio = false;

    const compraResult = await client.query(`
      INSERT INTO compras (
        id_proveedor,
        fecha_compra,
        tipo_comprobante,
        numero_comprobante,
        observaciones,
        estado
      )
      VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5,
              'PENDIENTE_REVISION')
      RETURNING id
    `, [
      id_proveedor,
      fecha_compra || null,
      tipo_comprobante || null,
      numero_comprobante || null,
      observaciones || null
    ]);

    const idCompra = compraResult.rows[0].id;

    for (const detalle of detalles) {
      const {
        id_producto,
        cantidad,
        id_unidad,
        modalidad_precio,
        importe_informado
      } = detalle;

      const factor = detalle.factor_ajuste === undefined ||
        detalle.factor_ajuste === null ||
        detalle.factor_ajuste === ""
          ? FACTOR_PREDETERMINADO
          : Number(detalle.factor_ajuste);

      if (!numeroValido(id_producto) ||
          !numeroValido(cantidad) ||
          Number(cantidad) <= 0 ||
          !numeroValido(id_unidad)) {
        throw new Error("Hay un detalle con producto, cantidad o unidad inválidos.");
      }

      if (!Number.isFinite(factor) || factor <= 0) {
        throw new Error("El factor de ajuste debe ser mayor que cero.");
      }

      const producto = await client.query(`
        SELECT id, nombre, tipo, id_unidad
        FROM productos
        WHERE id = $1 AND activo = TRUE
        FOR SHARE
      `, [id_producto]);

      if (!producto.rowCount) {
        throw new Error(`El producto ${id_producto} no existe o está inactivo.`);
      }

      if (producto.rows[0].id_unidad === null ||
          Number(producto.rows[0].id_unidad) !== Number(id_unidad)) {
        throw new Error(
          `La unidad indicada no coincide con la unidad base del producto ${producto.rows[0].nombre}.`
        );
      }

      const tienePrecio = importe_informado !== null &&
        importe_informado !== undefined &&
        importe_informado !== "";

      let modalidad = null;
      let importe = null;
      let subtotal = null;
      let costoUnitario = null;
      let costoAjustado = null;

      if (tienePrecio) {
        const valor = Number(importe_informado);

        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error("El importe informado debe ser un número mayor o igual a cero.");
        }

        if (!["TOTAL", "UNITARIO"].includes(modalidad_precio)) {
          throw new Error("La modalidad de precio debe ser TOTAL o UNITARIO.");
        }

        modalidad = modalidad_precio;
        importe = redondear6(valor);

        if (modalidad === "TOTAL") {
          subtotal = importe;
          costoUnitario = redondear6(importe / Number(cantidad));
        } else {
          costoUnitario = importe;
          subtotal = redondear6(importe * Number(cantidad));
        }

        costoAjustado = redondear6(costoUnitario * factor);
      } else {
        faltaPrecio = true;
      }

      await client.query(`
        INSERT INTO compras_detalle (
          id_compra,
          id_producto,
          cantidad,
          id_unidad,
          modalidad_precio,
          importe_informado,
          subtotal,
          factor_ajuste,
          costo_unitario,
          costo_unitario_ajustado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        idCompra,
        id_producto,
        cantidad,
        id_unidad,
        modalidad,
        importe,
        subtotal,
        factor,
        costoUnitario,
        costoAjustado
      ]);
    }

    const estado = faltaPrecio ? "PENDIENTE_PRECIO" : "PENDIENTE_REVISION";

    await client.query(`
      UPDATE compras
      SET estado = $1
      WHERE id = $2
    `, [estado, idCompra]);

    await client.query("COMMIT");

    return await obtenerCompra(idCompra);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function confirmarCompra(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const compra = await client.query(`
      SELECT id, estado
      FROM compras
      WHERE id = $1
      FOR UPDATE
    `, [id]);

    if (!compra.rowCount) {
      const error = new Error("La compra no existe.");
      error.status = 404;
      throw error;
    }

    if (compra.rows[0].estado === "CONFIRMADA") {
      throw new Error("La compra ya está confirmada.");
    }

    if (compra.rows[0].estado === "ANULADA") {
      throw new Error("No se puede confirmar una compra anulada.");
    }

    const detalles = await client.query(`
      SELECT
        id,
        id_producto,
        cantidad,
        id_unidad,
        costo_unitario,
        costo_unitario_ajustado
      FROM compras_detalle
      WHERE id_compra = $1
      ORDER BY id
      FOR UPDATE
    `, [id]);

    if (!detalles.rowCount) {
      throw new Error("La compra no tiene detalles.");
    }

    const incompletos = detalles.rows.filter(d =>
      d.costo_unitario === null || d.costo_unitario_ajustado === null
    );

    if (incompletos.length > 0) {
      throw new Error("No se puede confirmar: hay productos sin precio informado.");
    }

    for (const detalle of detalles.rows) {
      await client.query(`
        INSERT INTO movimientos_stock (
          id_producto,
          id_unidad,
          tipo_movimiento,
          cantidad,
          id_compra,
          id_compra_detalle,
          observaciones
        )
        VALUES ($1, $2, 'ENTRADA_COMPRA', $3, $4, $5, $6)
      `, [
        detalle.id_producto,
        detalle.id_unidad,
        detalle.cantidad,
        id,
        detalle.id,
        `Ingreso por compra ${id}`
      ]);
    }

    await client.query(`
      UPDATE compras
      SET estado = 'CONFIRMADA',
          fecha_confirmacion = NOW()
      WHERE id = $1
    `, [id]);

    await client.query("COMMIT");

    return await obtenerCompra(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function anularCompra(id) {
  const result = await pool.query(`
    UPDATE compras
    SET estado = 'ANULADA'
    WHERE id = $1
      AND estado IN ('PENDIENTE_PRECIO', 'PENDIENTE_REVISION')
    RETURNING id
  `, [id]);

  if (!result.rowCount) {
    throw new Error(
      "No se encontró la compra o ya está confirmada/anulada. Una compra confirmada requiere un movimiento de reversión."
    );
  }

  return { id: result.rows[0].id, estado: "ANULADA" };
}

async function consultarStock() {
  const { rows } = await pool.query(`
    SELECT
      p.id AS id_producto,
      p.codigo,
      p.nombre AS producto,
      p.tipo,
      u.codigo AS unidad,
      COALESCE(SUM(
        CASE
          WHEN m.tipo_movimiento IN (
            'ENTRADA_COMPRA',
            'ENTRADA_PRODUCCION',
            'AJUSTE_INICIAL',
            'AJUSTE_POSITIVO'
          ) THEN m.cantidad
          WHEN m.tipo_movimiento IN (
            'SALIDA_VENTA',
            'SALIDA_PRODUCCION',
            'AJUSTE_NEGATIVO',
            'ANULACION_COMPRA'
          ) THEN -m.cantidad
          ELSE 0
        END
      ), 0)::numeric(18,6) AS existencia
    FROM productos p
    LEFT JOIN unidades_medida u ON u.id = p.id_unidad
    LEFT JOIN movimientos_stock m ON m.id_producto = p.id
    WHERE p.activo = TRUE
    GROUP BY p.id, p.codigo, p.nombre, p.tipo, u.codigo
    ORDER BY p.nombre
  `);

  return rows;
}

async function listarMovimientos(idProducto = null) {
  const { rows } = await pool.query(`
    SELECT
      m.*,
      p.codigo AS codigo_producto,
      p.nombre AS producto,
      u.codigo AS unidad
    FROM movimientos_stock m
    INNER JOIN productos p ON p.id = m.id_producto
    INNER JOIN unidades_medida u ON u.id = m.id_unidad
    WHERE ($1::integer IS NULL OR m.id_producto = $1)
    ORDER BY m.fecha_movimiento DESC, m.id DESC
  `, [idProducto || null]);

  return rows;
}

module.exports = {
  listarCompras,
  obtenerCompra,
  crearCompra,
  confirmarCompra,
  anularCompra,
  consultarStock,
  listarMovimientos
};
