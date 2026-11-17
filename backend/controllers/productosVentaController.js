const pool = require("../db");

const listarProductosVenta = async (req, res) => {
  try {
    const resultado = await pool.query(`
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
        COALESCE(pv.activo, TRUE) AS configuracion_activa
      FROM productos p
      LEFT JOIN unidades_medida um ON um.id = p.id_unidad
      LEFT JOIN productos_venta pv ON pv.id_producto = p.id
      WHERE p.activo = TRUE
      ORDER BY p.codigo, p.nombre
    `);
    res.json(resultado.rows);
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

    const producto = await client.query(
      "SELECT id FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE",
      [idProducto]
    );
    if (producto.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El producto no existe o está inactivo." });
    }

    const anterior = await client.query(
      "SELECT precio_venta FROM productos_venta WHERE id_producto = $1 FOR UPDATE",
      [idProducto]
    );

    const precioAnterior = anterior.rowCount ? Number(anterior.rows[0].precio_venta) : null;
    const cambioPrecio = precioAnterior === null || precioAnterior !== precio;

    const guardado = await client.query(`
      INSERT INTO productos_venta
        (id_producto, habilitado_venta, precio_venta, controla_stock, activo, fecha_actualizacion)
      VALUES ($1, $2, $3, $4, TRUE, NOW())
      ON CONFLICT (id_producto)
      DO UPDATE SET
        habilitado_venta = EXCLUDED.habilitado_venta,
        precio_venta = EXCLUDED.precio_venta,
        controla_stock = EXCLUDED.controla_stock,
        activo = TRUE,
        fecha_actualizacion = NOW()
      RETURNING id, id_producto, habilitado_venta, precio_venta, controla_stock, activo
    `, [idProducto, habilitado, precio, controlaStock]);

    if (cambioPrecio) {
      await client.query(`
        INSERT INTO historial_precios_venta
          (id_producto, precio_anterior, precio_nuevo, fecha_cambio, observaciones)
        VALUES ($1, $2, $3, NOW(), $4)
      `, [
        idProducto,
        precioAnterior,
        precio,
        precioAnterior === null ? "Configuración inicial del precio de venta" : "Actualización del precio de venta"
      ]);
    }

    await client.query("COMMIT");
    res.json({ mensaje: "Configuración comercial guardada.", producto: guardado.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al configurar producto para la venta:", error);
    res.status(500).json({ mensaje: "No se pudo guardar la configuración comercial." });
  } finally {
    client.release();
  }
};

module.exports = { listarProductosVenta, configurarProductoVenta };
