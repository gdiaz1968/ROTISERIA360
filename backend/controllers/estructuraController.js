const pool = require("../db");


// ======================================================
// LISTAR PRODUCTOS ELABORADOS
// ======================================================

const listarProductosElaborados = async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                unidad
            FROM productos
            WHERE tipo = 'ELABORADO'
              AND activo = TRUE
            ORDER BY nombre
        `);

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al consultar productos elaborados"
        });
    }
};


// ======================================================
// LISTAR COMPONENTES
// ======================================================

const listarComponentes = async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                tipo,
                unidad
            FROM productos
            WHERE activo = TRUE
              AND tipo IN ('INSUMO', 'ELABORADO')
            ORDER BY nombre
        `);

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al consultar componentes"
        });
    }
};


// ======================================================
// CREAR ESTRUCTURA
// ======================================================

const crearEstructura = async (req, res) => {

    const cliente = await pool.connect();

    try {

        const {
            producto_id,
            rendimiento,
            unidad_rendimiento,
            detalle
        } = req.body;


        // --------------------------------------------------
        // VALIDACIONES BASICAS
        // --------------------------------------------------

        if (!producto_id) {

            return res.status(400).json({
                error: "Debe indicar el producto elaborado"
            });
        }


        if (!rendimiento || rendimiento <= 0) {

            return res.status(400).json({
                error: "El rendimiento debe ser mayor que cero"
            });
        }


        if (!unidad_rendimiento) {

            return res.status(400).json({
                error: "Debe indicar la unidad de rendimiento"
            });
        }


        if (!Array.isArray(detalle) || detalle.length === 0) {

            return res.status(400).json({
                error: "La estructura debe tener al menos un componente"
            });
        }


        // --------------------------------------------------
        // VERIFICAR PRODUCTO
        // --------------------------------------------------

        const producto = await cliente.query(`
            SELECT
                id,
                tipo,
                unidad,
                activo
            FROM productos
            WHERE id = $1
        `, [producto_id]);


        if (producto.rows.length === 0) {

            return res.status(400).json({
                error: "El producto no existe"
            });
        }


        if (producto.rows[0].tipo !== "ELABORADO") {

            return res.status(400).json({
                error: "El producto debe ser de tipo ELABORADO"
            });
        }


        if (!producto.rows[0].activo) {

            return res.status(400).json({
                error: "El producto está inactivo"
            });
        }


        // --------------------------------------------------
        // COMENZAR TRANSACCION
        // --------------------------------------------------

        await cliente.query("BEGIN");


        // --------------------------------------------------
        // OBTENER SIGUIENTE VERSION
        // --------------------------------------------------

        const versionResultado = await cliente.query(`
            SELECT
                COALESCE(MAX(version), 0) + 1 AS version
            FROM producto_estructura
            WHERE producto_id = $1
        `, [producto_id]);


        const version =
            versionResultado.rows[0].version;


        // --------------------------------------------------
        // CREAR CABECERA
        // --------------------------------------------------

        const estructuraResultado = await cliente.query(`
            INSERT INTO producto_estructura
            (
                producto_id,
                version,
                rendimiento,
                unidad_rendimiento,
                activo
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                TRUE
            )
            RETURNING *
        `, [
            producto_id,
            version,
            rendimiento,
            unidad_rendimiento
        ]);


        const estructura =
            estructuraResultado.rows[0];


        // --------------------------------------------------
        // CREAR DETALLE
        // --------------------------------------------------

        for (const item of detalle) {

            if (!item.componente_id) {

                throw new Error(
                    "Existe un componente sin ID"
                );
            }


            if (!item.cantidad || item.cantidad <= 0) {

                throw new Error(
                    "Existe un componente con cantidad inválida"
                );
            }


            const componente =
                await cliente.query(`
                    SELECT
                        id,
                        tipo,
                        unidad,
                        activo
                    FROM productos
                    WHERE id = $1
                `, [
                    item.componente_id
                ]);


            if (componente.rows.length === 0) {

                throw new Error(
                    "El componente " +
                    item.componente_id +
                    " no existe"
                );
            }


            if (!componente.rows[0].activo) {

                throw new Error(
                    "El componente " +
                    item.componente_id +
                    " está inactivo"
                );
            }


            await cliente.query(`
                INSERT INTO producto_estructura_detalle
                (
                    estructura_id,
                    componente_id,
                    cantidad,
                    merma,
                    activo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    TRUE
                )
            `, [
                estructura.id,
                item.componente_id,
                item.cantidad,
                item.merma || 0
            ]);

        }


        // --------------------------------------------------
        // CONFIRMAR TRANSACCION
        // --------------------------------------------------

        await cliente.query("COMMIT");


        res.status(201).json({

            mensaje: "Estructura creada correctamente",

            estructura_id: estructura.id,

            producto_id: producto_id,

            version: version

        });


    } catch (error) {

        await cliente.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: error.message
        });


    } finally {

        cliente.release();

    }

};


module.exports = {

    listarProductosElaborados,

    listarComponentes,

    crearEstructura

};