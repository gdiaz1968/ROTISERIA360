const pool = require("../db");

// ============================================================
// LISTAR PRECIOS DE COMPRA
// ============================================================

async function listarPreciosCompra(req, res) {

    try {

        const resultado = await pool.query(`
            SELECT
                pc.id,
                pc.id_proveedor,

                pr.codigo AS proveedor_codigo,
                pr.nombre AS proveedor_nombre,

                p.id AS id_producto,
                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,

                pp.id AS id_presentacion,
                pp.nombre AS presentacion_nombre,
                pp.cantidad_contenida,
                pp.id_unidad_contenido,

                um.codigo AS unidad,
                um.nombre AS unidad_nombre,

                pc.precio,
                pc.fecha_desde,
                pc.fecha_hasta,
                pc.activo,
                pc.fecha_alta

            FROM precios_compra pc

            INNER JOIN proveedores pr
                ON pr.id = pc.id_proveedor

            INNER JOIN presentaciones_producto pp
                ON pp.id = pc.id_presentacion

            INNER JOIN productos p
                ON p.id = pp.id_producto

            INNER JOIN unidades_medida um
                ON um.id = pp.id_unidad_contenido

            ORDER BY
                p.codigo,
                pp.nombre,
                pc.fecha_desde DESC
        `);

        res.json({
            ok: true,
            precios: resultado.rows
        });

    }
    catch (error) {

        console.error(
            "ERROR AL LISTAR PRECIOS DE COMPRA:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje: "Error al listar los precios de compra."
        });

    }

}


// ============================================================
// LISTAR PRECIOS DE UNA PRESENTACIÓN
// ============================================================

async function listarPreciosPresentacion(req, res) {

    try {

        const idPresentacion =
            Number(req.params.id);

        if (
            !Number.isInteger(idPresentacion) ||
            idPresentacion <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "El ID de la presentación no es válido."
            });

        }

        const resultado = await pool.query(`
            SELECT
                pc.id,
                pc.id_proveedor,

                pr.codigo AS proveedor_codigo,
                pr.nombre AS proveedor_nombre,

                pc.id_presentacion,
                pc.precio,
                pc.fecha_desde,
                pc.fecha_hasta,
                pc.activo,
                pc.fecha_alta

            FROM precios_compra pc

            INNER JOIN proveedores pr
                ON pr.id = pc.id_proveedor

            WHERE pc.id_presentacion = $1

            ORDER BY
                pc.fecha_desde DESC,
                pc.id DESC
        `, [
            idPresentacion
        ]);

        res.json({
            ok: true,
            precios: resultado.rows
        });

    }
    catch (error) {

        console.error(
            "ERROR AL LISTAR PRECIOS DE PRESENTACIÓN:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje:
                "Error al listar los precios de la presentación."
        });

    }

}


// ============================================================
// OBTENER PRECIO DE COMPRA
// ============================================================

async function obtenerPrecioCompra(req, res) {

    try {

        const id =
            Number(req.params.id);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "El ID del precio no es válido."
            });

        }

        const resultado = await pool.query(`
            SELECT
                pc.id,
                pc.id_proveedor,

                pr.codigo AS proveedor_codigo,
                pr.nombre AS proveedor_nombre,

                pc.id_presentacion,

                p.id AS id_producto,
                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,

                pp.nombre AS presentacion_nombre,
                pp.cantidad_contenida,
                pp.id_unidad_contenido,

                um.codigo AS unidad,
                um.nombre AS unidad_nombre,

                pc.precio,
                pc.fecha_desde,
                pc.fecha_hasta,
                pc.activo,
                pc.fecha_alta

            FROM precios_compra pc

            INNER JOIN proveedores pr
                ON pr.id = pc.id_proveedor

            INNER JOIN presentaciones_producto pp
                ON pp.id = pc.id_presentacion

            INNER JOIN productos p
                ON p.id = pp.id_producto

            INNER JOIN unidades_medida um
                ON um.id = pp.id_unidad_contenido

            WHERE pc.id = $1
        `, [
            id
        ]);

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                ok: false,
                mensaje: "Precio de compra no encontrado."
            });

        }

        res.json({
            ok: true,
            precio: resultado.rows[0]
        });

    }
    catch (error) {

        console.error(
            "ERROR AL OBTENER PRECIO DE COMPRA:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje:
                "Error al obtener el precio de compra."
        });

    }

}


// ============================================================
// REGISTRAR NUEVO PRECIO DE COMPRA
//
// Para una misma combinación:
// PRESENTACIÓN + PROVEEDOR
//
// solamente puede existir UN precio activo.
//
// Si existe uno activo:
//     se cierra
//     fecha_hasta = ahora
//     activo = false
//
// Luego se crea el nuevo precio activo.
// ============================================================

async function crearPrecioCompra(req, res) {

    const client =
        await pool.connect();

    try {

        const {
            id_proveedor,
            id_presentacion,
            precio
        } = req.body;

        const idProveedor =
            Number(id_proveedor);

        const idPresentacion =
            Number(id_presentacion);

        const precioNumerico =
            Number(precio);

        // ----------------------------------------------------
        // VALIDACIONES
        // ----------------------------------------------------

        if (
            !Number.isInteger(idProveedor) ||
            idProveedor <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "El proveedor no es válido."
            });

        }

        if (
            !Number.isInteger(idPresentacion) ||
            idPresentacion <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "La presentación no es válida."
            });

        }

        if (
            !Number.isFinite(precioNumerico) ||
            precioNumerico <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje:
                    "El precio debe ser mayor que cero."
            });

        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // VERIFICAR PROVEEDOR
        // ----------------------------------------------------

        const proveedor =
            await client.query(`
                SELECT
                    id,
                    codigo,
                    nombre,
                    activo
                FROM proveedores
                WHERE id = $1
            `, [
                idProveedor
            ]);

        if (
            proveedor.rows.length === 0
        ) {

            throw new Error(
                "El proveedor no existe."
            );

        }

        if (
            proveedor.rows[0].activo === false
        ) {

            throw new Error(
                "El proveedor está inactivo."
            );

        }

        // ----------------------------------------------------
        // VERIFICAR PRESENTACIÓN
        // ----------------------------------------------------

        const presentacion =
            await client.query(`
                SELECT
                    pp.id,
                    pp.id_producto,
                    pp.nombre,
                    pp.cantidad_contenida,
                    pp.id_unidad_contenido,
                    pp.activo,

                    p.codigo AS producto_codigo,
                    p.nombre AS producto_nombre,
                    p.tipo AS producto_tipo,

                    um.codigo AS unidad,
                    um.nombre AS unidad_nombre

                FROM presentaciones_producto pp

                INNER JOIN productos p
                    ON p.id = pp.id_producto

                INNER JOIN unidades_medida um
                    ON um.id = pp.id_unidad_contenido

                WHERE pp.id = $1
            `, [
                idPresentacion
            ]);

        if (
            presentacion.rows.length === 0
        ) {

            throw new Error(
                "La presentación no existe."
            );

        }

        const datosPresentacion =
            presentacion.rows[0];

        if (
            datosPresentacion.activo === false
        ) {

            throw new Error(
                "La presentación está inactiva."
            );

        }

        if (
            datosPresentacion.producto_tipo !== "INSUMO"
        ) {

            throw new Error(
                "Los precios de compra solamente corresponden a presentaciones de productos INSUMO."
            );

        }

        // ----------------------------------------------------
        // CERRAR PRECIO ACTIVO ANTERIOR
        // ----------------------------------------------------

        const ahora =
            new Date();

        await client.query(`
            UPDATE precios_compra
            SET
                fecha_hasta = $1,
                activo = FALSE
            WHERE id_presentacion = $2
              AND id_proveedor = $3
              AND activo = TRUE
        `, [
            ahora,
            idPresentacion,
            idProveedor
        ]);

        // ----------------------------------------------------
        // INSERTAR NUEVO PRECIO
        // ----------------------------------------------------

        const nuevoPrecio =
            await client.query(`
                INSERT INTO precios_compra
                (
                    id_proveedor,
                    id_presentacion,
                    precio,
                    fecha_desde,
                    fecha_hasta,
                    activo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    NULL,
                    TRUE
                )
                RETURNING
                    id,
                    id_proveedor,
                    id_presentacion,
                    precio,
                    fecha_desde,
                    fecha_hasta,
                    activo,
                    fecha_alta
            `, [
                idProveedor,
                idPresentacion,
                precioNumerico,
                ahora
            ]);

        await client.query("COMMIT");

        res.status(201).json({

            ok: true,

            mensaje:
                "Precio de compra registrado correctamente.",

            precio:
                nuevoPrecio.rows[0]

        });

    }
    catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "ERROR AL CREAR PRECIO DE COMPRA:",
            error
        );

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });

    }
    finally {

        client.release();

    }

}


// ============================================================
// MODIFICAR PRECIO DE COMPRA
//
// No modificamos el historial.
// El cambio de precio se registra como nuevo precio.
// ============================================================

async function modificarPrecioCompra(req, res) {

    const client =
        await pool.connect();

    try {

        const id =
            Number(req.params.id);

        const {
            precio
        } = req.body;

        const precioNumerico =
            Number(precio);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "El ID del precio no es válido."
            });

        }

        if (
            !Number.isFinite(precioNumerico) ||
            precioNumerico <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje:
                    "El precio debe ser mayor que cero."
            });

        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // OBTENER PRECIO ACTUAL
        // ----------------------------------------------------

        const actual =
            await client.query(`
                SELECT
                    id,
                    id_proveedor,
                    id_presentacion,
                    precio,
                    activo
                FROM precios_compra
                WHERE id = $1
            `, [
                id
            ]);

        if (
            actual.rows.length === 0
        ) {

            throw new Error(
                "El precio de compra no existe."
            );

        }

        const precioActual =
            actual.rows[0];

        if (
            precioActual.activo === false
        ) {

            throw new Error(
                "No se puede modificar un precio histórico."
            );

        }

        const ahora =
            new Date();

        // ----------------------------------------------------
        // CERRAR PRECIO ACTUAL
        // ----------------------------------------------------

        await client.query(`
            UPDATE precios_compra
            SET
                fecha_hasta = $1,
                activo = FALSE
            WHERE id = $2
        `, [
            ahora,
            id
        ]);

        // ----------------------------------------------------
        // CREAR NUEVO PRECIO
        // ----------------------------------------------------

        const nuevoPrecio =
            await client.query(`
                INSERT INTO precios_compra
                (
                    id_proveedor,
                    id_presentacion,
                    precio,
                    fecha_desde,
                    fecha_hasta,
                    activo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    NULL,
                    TRUE
                )
                RETURNING
                    id,
                    id_proveedor,
                    id_presentacion,
                    precio,
                    fecha_desde,
                    fecha_hasta,
                    activo,
                    fecha_alta
            `, [
                precioActual.id_proveedor,
                precioActual.id_presentacion,
                precioNumerico,
                ahora
            ]);

        await client.query("COMMIT");

        res.json({

            ok: true,

            mensaje:
                "Precio de compra actualizado correctamente.",

            precio:
                nuevoPrecio.rows[0]

        });

    }
    catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "ERROR AL MODIFICAR PRECIO DE COMPRA:",
            error
        );

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });

    }
    finally {

        client.release();

    }

}


// ============================================================
// BAJA LÓGICA
// ============================================================

async function eliminarPrecioCompra(req, res) {

    try {

        const id =
            Number(req.params.id);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "El ID del precio no es válido."
            });

        }

        const resultado =
            await pool.query(`
                UPDATE precios_compra
                SET
                    activo = FALSE,
                    fecha_hasta = CURRENT_TIMESTAMP
                WHERE id = $1
                  AND activo = TRUE
                RETURNING
                    id,
                    id_proveedor,
                    id_presentacion,
                    precio,
                    fecha_desde,
                    fecha_hasta,
                    activo
            `, [
                id
            ]);

        if (
            resultado.rows.length === 0
        ) {

            return res.status(404).json({
                ok: false,
                mensaje:
                    "Precio de compra activo no encontrado."
            });

        }

        res.json({

            ok: true,

            mensaje:
                "Precio de compra eliminado correctamente.",

            precio:
                resultado.rows[0]

        });

    }
    catch (error) {

        console.error(
            "ERROR AL ELIMINAR PRECIO DE COMPRA:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje:
                "Error al eliminar el precio de compra."
        });

    }

}


// ============================================================
// EXPORTAR
// ============================================================

module.exports = {

    listarPreciosCompra,
    listarPreciosPresentacion,
    obtenerPrecioCompra,
    crearPrecioCompra,
    modificarPrecioCompra,
    eliminarPrecioCompra

};