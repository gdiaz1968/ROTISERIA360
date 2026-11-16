const pool = require("../db");


// ============================================================
// LISTAR PRESENTACIONES DE UN PRODUCTO
// ============================================================

async function listarPresentaciones(req, res) {

    try {

        const { id } = req.params;

        const resultado = await pool.query(
            `
            SELECT
                pp.id,
                pp.id_producto,
                pp.nombre,
                pp.cantidad_contenida,
                pp.id_unidad_contenido,
                um.codigo AS unidad,
                um.nombre AS unidad_nombre,
                pp.activo,
                pp.fecha_alta
            FROM presentaciones_producto pp
            INNER JOIN unidades_medida um
                ON um.id = pp.id_unidad_contenido
            WHERE pp.id_producto = $1
            ORDER BY
                pp.nombre
            `,
            [id]
        );

        res.json(resultado.rows);

    }
    catch (error) {

        console.error(
            "Error al listar presentaciones:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje: "Error al listar las presentaciones."
        });

    }

}



// ============================================================
// OBTENER UNA PRESENTACIÓN
// ============================================================

async function obtenerPresentacion(req, res) {

    try {

        const { id } = req.params;

        const resultado = await pool.query(
            `
            SELECT
                pp.id,
                pp.id_producto,
                pp.nombre,
                pp.cantidad_contenida,
                pp.id_unidad_contenido,
                um.codigo AS unidad,
                um.nombre AS unidad_nombre,
                pp.activo,
                pp.fecha_alta
            FROM presentaciones_producto pp
            INNER JOIN unidades_medida um
                ON um.id = pp.id_unidad_contenido
            WHERE pp.id = $1
            `,
            [id]
        );

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                ok: false,
                mensaje: "Presentación no encontrada."
            });

        }

        res.json(resultado.rows[0]);

    }
    catch (error) {

        console.error(
            "Error al obtener presentación:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje: "Error al obtener la presentación."
        });

    }

}



// ============================================================
// CREAR PRESENTACIÓN
// ============================================================

async function crearPresentacion(req, res) {

    try {

        const {
            id_producto,
            nombre,
            cantidad_contenida,
            id_unidad_contenido,
            activo
        } = req.body;


        if (
            !id_producto ||
            !nombre ||
            cantidad_contenida === undefined ||
            cantidad_contenida === null ||
            !id_unidad_contenido
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "Faltan datos obligatorios."
            });

        }


        if (
            Number(cantidad_contenida) <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje:
                    "La cantidad contenida debe ser mayor que cero."
            });

        }


        // ----------------------------------------------------
        // Verificar que el producto exista
        // ----------------------------------------------------

        const producto =
            await pool.query(
                `
                SELECT
                    id,
                    codigo,
                    nombre,
                    tipo
                FROM productos
                WHERE id = $1
                `,
                [id_producto]
            );


        if (producto.rows.length === 0) {

            return res.status(404).json({
                ok: false,
                mensaje: "El producto no existe."
            });

        }


        // ----------------------------------------------------
        // Las presentaciones corresponden a INSUMOS
        // ----------------------------------------------------

        if (
            producto.rows[0].tipo !== "INSUMO"
        ) {

            return res.status(400).json({
                ok: false,
                mensaje:
                    "Las presentaciones solamente corresponden a productos de tipo INSUMO."
            });

        }


        // ----------------------------------------------------
        // Verificar unidad
        // ----------------------------------------------------

        const unidad =
            await pool.query(
                `
                SELECT id
                FROM unidades_medida
                WHERE id = $1
                `,
                [id_unidad_contenido]
            );


        if (unidad.rows.length === 0) {

            return res.status(400).json({
                ok: false,
                mensaje: "La unidad de contenido no existe."
            });

        }


        const resultado =
            await pool.query(
                `
                INSERT INTO presentaciones_producto
                (
                    id_producto,
                    nombre,
                    cantidad_contenida,
                    id_unidad_contenido,
                    activo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                RETURNING id
                `,
                [
                    id_producto,
                    nombre.trim(),
                    cantidad_contenida,
                    id_unidad_contenido,
                    activo !== false
                ]
            );


        res.status(201).json({
            ok: true,
            mensaje: "Presentación creada correctamente.",
            id: resultado.rows[0].id
        });

    }
    catch (error) {

        console.error(
            "Error al crear presentación:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje: "Error al crear la presentación."
        });

    }

}



// ============================================================
// MODIFICAR PRESENTACIÓN
// ============================================================

async function modificarPresentacion(req, res) {

    try {

        const { id } = req.params;

        const {
            nombre,
            cantidad_contenida,
            id_unidad_contenido,
            activo
        } = req.body;


        if (
            !nombre ||
            cantidad_contenida === undefined ||
            cantidad_contenida === null ||
            !id_unidad_contenido
        ) {

            return res.status(400).json({
                ok: false,
                mensaje: "Faltan datos obligatorios."
            });

        }


        if (
            Number(cantidad_contenida) <= 0
        ) {

            return res.status(400).json({
                ok: false,
                mensaje:
                    "La cantidad contenida debe ser mayor que cero."
            });

        }


        const unidad =
            await pool.query(
                `
                SELECT id
                FROM unidades_medida
                WHERE id = $1
                `,
                [id_unidad_contenido]
            );


        if (unidad.rows.length === 0) {

            return res.status(400).json({
                ok: false,
                mensaje: "La unidad de contenido no existe."
            });

        }


        const resultado =
            await pool.query(
                `
                UPDATE presentaciones_producto
                SET
                    nombre = $1,
                    cantidad_contenida = $2,
                    id_unidad_contenido = $3,
                    activo = $4
                WHERE id = $5
                RETURNING id
                `,
                [
                    nombre.trim(),
                    cantidad_contenida,
                    id_unidad_contenido,
                    activo !== false,
                    id
                ]
            );


        if (resultado.rows.length === 0) {

            return res.status(404).json({
                ok: false,
                mensaje: "Presentación no encontrada."
            });

        }


        res.json({
            ok: true,
            mensaje: "Presentación modificada correctamente."
        });

    }
    catch (error) {

        console.error(
            "Error al modificar presentación:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje: "Error al modificar la presentación."
        });

    }

}



// ============================================================
// ELIMINAR PRESENTACIÓN
// BAJA LÓGICA
// ============================================================

async function eliminarPresentacion(req, res) {

    try {

        const { id } = req.params;

        const resultado =
            await pool.query(
                `
                UPDATE presentaciones_producto
                SET activo = false
                WHERE id = $1
                RETURNING id
                `,
                [id]
            );


        if (resultado.rows.length === 0) {

            return res.status(404).json({
                ok: false,
                mensaje: "Presentación no encontrada."
            });

        }


        res.json({
            ok: true,
            mensaje: "Presentación eliminada correctamente."
        });

    }
    catch (error) {

        console.error(
            "Error al eliminar presentación:",
            error
        );

        res.status(500).json({
            ok: false,
            mensaje: "Error al eliminar la presentación."
        });

    }

}



// ============================================================
// LISTAR TODAS LAS PRESENTACIONES PARA EL REPORTE
// ============================================================

async function listarReportePresentaciones(req, res) {
    try {
        const resultado = await pool.query(`
            SELECT
                p.id AS producto_id,
                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,
                p.activo AS producto_activo,
                pp.id AS presentacion_id,
                pp.nombre AS presentacion_nombre,
                pp.cantidad_contenida,
                pp.activo AS presentacion_activa,
                pp.fecha_alta,
                um.codigo AS unidad,
                um.nombre AS unidad_nombre
            FROM presentaciones_producto pp
            INNER JOIN productos p
                ON p.id = pp.id_producto
            INNER JOIN unidades_medida um
                ON um.id = pp.id_unidad_contenido
            ORDER BY p.codigo, p.nombre, pp.nombre
        `);

        const productosPorId = new Map();

        for (const fila of resultado.rows) {
            let producto = productosPorId.get(fila.producto_id);
            if (!producto) {
                producto = {
                    id: fila.producto_id,
                    codigo: fila.producto_codigo,
                    nombre: fila.producto_nombre,
                    activo: fila.producto_activo,
                    presentaciones: [],
                };
                productosPorId.set(fila.producto_id, producto);
            }

            producto.presentaciones.push({
                id: fila.presentacion_id,
                nombre: fila.presentacion_nombre,
                cantidad_contenida: fila.cantidad_contenida,
                unidad: fila.unidad,
                unidad_nombre: fila.unidad_nombre,
                activo: fila.presentacion_activa,
                fecha_alta: fila.fecha_alta,
            });
        }

        const productos = Array.from(productosPorId.values());
        res.json({
            total_productos: productos.length,
            total_presentaciones: resultado.rows.length,
            productos,
        });
    } catch (error) {
        console.error("ERROR LISTAR PRESENTACIONES PARA REPORTE:", error);
        res.status(500).json({
            ok: false,
            mensaje: "Error al consultar las presentaciones para el reporte."
        });
    }
}


module.exports = {
    listarPresentaciones,
    listarReportePresentaciones,
    obtenerPresentacion,
    crearPresentacion,
    modificarPresentacion,
    eliminarPresentacion
};