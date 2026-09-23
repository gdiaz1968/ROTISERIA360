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
// CONSULTAR ESTRUCTURA ACTIVA POR PRODUCTO
// ======================================================

const consultarEstructura = async (req, res) => {

    try {

        const productoId =
            parseInt(req.params.producto_id);


        // --------------------------------------------------
        // VALIDAR ID
        // --------------------------------------------------

        if (!productoId) {

            return res.status(400).json({
                error: "Debe indicar un producto válido"
            });

        }


        // --------------------------------------------------
        // CONSULTAR CABECERA + PRODUCTO
        // --------------------------------------------------

        const cabecera = await pool.query(`
            SELECT
                pe.id,
                pe.producto_id,
                pe.version,
                pe.rendimiento,
                pe.unidad_rendimiento,
                pe.activo,
                pe.fecha_alta,

                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,
                p.unidad AS producto_unidad

            FROM producto_estructura pe

            INNER JOIN productos p
                ON p.id = pe.producto_id

            WHERE pe.producto_id = $1
              AND pe.activo = TRUE

            ORDER BY pe.version DESC

            LIMIT 1
        `, [
            productoId
        ]);


        // --------------------------------------------------
        // NO EXISTE ESTRUCTURA
        // --------------------------------------------------

        if (cabecera.rows.length === 0) {

            return res.status(404).json({
                error: "El producto no tiene una estructura activa"
            });

        }


        const estructura =
            cabecera.rows[0];


        // --------------------------------------------------
        // CONSULTAR DETALLE
        // --------------------------------------------------

        const detalle = await pool.query(`
            SELECT

                ped.id,

                ped.estructura_id,

                ped.componente_id,

                ped.cantidad,

                ped.merma,

                ped.activo,

                p.codigo AS componente_codigo,

                p.nombre AS componente_nombre,

                p.tipo AS componente_tipo,

                p.unidad AS componente_unidad

            FROM producto_estructura_detalle ped

            INNER JOIN productos p
                ON p.id = ped.componente_id

            WHERE ped.estructura_id = $1
              AND ped.activo = TRUE

            ORDER BY ped.id
        `, [
            estructura.id
        ]);


        // --------------------------------------------------
        // RESPUESTA
        // --------------------------------------------------

        res.json({

            estructura: estructura,

            detalle: detalle.rows

        });


    } catch (error) {

        console.error(
            "ERROR CONSULTAR ESTRUCTURA:",
            error
        );

        res.status(500).json({
            error: "Error al consultar la estructura"
        });

    }

};


// ======================================================
// CONSULTAR ESTRUCTURA POR ID
// ======================================================

const consultarEstructuraPorId = async (req, res) => {

    try {

        const estructuraId =
            parseInt(req.params.id);


        // --------------------------------------------------
        // VALIDAR ID
        // --------------------------------------------------

        if (!estructuraId) {

            return res.status(400).json({
                error: "Debe indicar una estructura válida"
            });

        }


        // --------------------------------------------------
        // CABECERA
        // --------------------------------------------------

        const cabecera = await pool.query(`
            SELECT

                pe.id,
                pe.producto_id,
                pe.version,
                pe.rendimiento,
                pe.unidad_rendimiento,
                pe.activo,
                pe.fecha_alta,

                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,
                p.unidad AS producto_unidad

            FROM producto_estructura pe

            INNER JOIN productos p
                ON p.id = pe.producto_id

            WHERE pe.id = $1
        `, [
            estructuraId
        ]);


        if (cabecera.rows.length === 0) {

            return res.status(404).json({
                error: "La estructura no existe"
            });

        }


        const estructura =
            cabecera.rows[0];


        // --------------------------------------------------
        // DETALLE
        // --------------------------------------------------

        const detalle = await pool.query(`
            SELECT

                ped.id,

                ped.estructura_id,

                ped.componente_id,

                ped.cantidad,

                ped.merma,

                ped.activo,

                p.codigo AS componente_codigo,

                p.nombre AS componente_nombre,

                p.tipo AS componente_tipo,

                p.unidad AS componente_unidad

            FROM producto_estructura_detalle ped

            INNER JOIN productos p
                ON p.id = ped.componente_id

            WHERE ped.estructura_id = $1

            ORDER BY ped.id
        `, [
            estructuraId
        ]);


        // --------------------------------------------------
        // RESPUESTA
        // --------------------------------------------------

        res.json({

            estructura: estructura,

            detalle: detalle.rows

        });


    } catch (error) {

        console.error(
            "ERROR CONSULTAR ESTRUCTURA POR ID:",
            error
        );

        res.status(500).json({
            error: "Error al consultar la estructura"
        });

    }

};


// ======================================================
// CREAR ESTRUCTURA
// ======================================================

const crearEstructura = async (req, res) => {

    const cliente =
        await pool.connect();


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


        if (!Array.isArray(detalle) ||
            detalle.length === 0) {

            return res.status(400).json({
                error:
                    "La estructura debe tener al menos un componente"
            });

        }


        // --------------------------------------------------
        // COMENZAR TRANSACCION
        // --------------------------------------------------

        await cliente.query("BEGIN");


        // --------------------------------------------------
        // VERIFICAR PRODUCTO
        // --------------------------------------------------

        const producto =
            await cliente.query(`
                SELECT
                    id,
                    tipo,
                    unidad,
                    activo
                FROM productos
                WHERE id = $1
                FOR UPDATE
            `, [
                producto_id
            ]);


        if (producto.rows.length === 0) {

            throw new Error(
                "El producto no existe"
            );

        }


        if (producto.rows[0].tipo !== "ELABORADO") {

            throw new Error(
                "El producto debe ser de tipo ELABORADO"
            );

        }


        if (!producto.rows[0].activo) {

            throw new Error(
                "El producto está inactivo"
            );

        }


        // --------------------------------------------------
        // VERIFICAR QUE NO EXISTA ESTRUCTURA ACTIVA
        // --------------------------------------------------

        const estructuraActiva =
            await cliente.query(`
                SELECT
                    id,
                    version
                FROM producto_estructura
                WHERE producto_id = $1
                  AND activo = TRUE
                FOR UPDATE
            `, [
                producto_id
            ]);


        if (estructuraActiva.rows.length > 0) {

            throw new Error(
                "El producto ya posee una estructura activa. " +
                "Utilice modificar para generar una nueva versión."
            );

        }


        // --------------------------------------------------
        // OBTENER SIGUIENTE VERSION
        // --------------------------------------------------

        const versionResultado =
            await cliente.query(`
                SELECT
                    COALESCE(MAX(version), 0) + 1 AS version
                FROM producto_estructura
                WHERE producto_id = $1
            `, [
                producto_id
            ]);


        const version =
            parseInt(
                versionResultado.rows[0].version
            );


        // --------------------------------------------------
        // CREAR CABECERA
        // --------------------------------------------------

        const estructuraResultado =
            await cliente.query(`
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


            if (!item.cantidad ||
                item.cantidad <= 0) {

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
        // CONFIRMAR
        // --------------------------------------------------

        await cliente.query("COMMIT");


        res.status(201).json({

            mensaje:
                "Estructura creada correctamente",

            estructura_id:
                estructura.id,

            producto_id:
                producto_id,

            version:
                version

        });


    } catch (error) {

        try {

            await cliente.query("ROLLBACK");

        } catch (rollbackError) {

            console.error(
                "ERROR ROLLBACK:",
                rollbackError
            );

        }


        console.error(
            "ERROR CREAR ESTRUCTURA:",
            error
        );


        res.status(500).json({
            error: error.message
        });


    } finally {

        cliente.release();

    }

};


// ======================================================
// MODIFICAR ESTRUCTURA
// ======================================================
//
// IMPORTANTE:
//
// La modificación NO modifica la versión existente.
//
// La versión actual se desactiva y se crea una nueva
// versión con el detalle recibido.
//
// Ejemplo:
//
// versión 1 ACTIVA
//       ↓
// modificación
//       ↓
// versión 1 INACTIVA
// versión 2 ACTIVA
//
// ======================================================

const modificarEstructura = async (req, res) => {

    const cliente =
        await pool.connect();


    try {

        const estructuraId =
            parseInt(req.params.id);


        const {
            rendimiento,
            unidad_rendimiento,
            detalle
        } = req.body;


        // --------------------------------------------------
        // VALIDAR ID
        // --------------------------------------------------

        if (!estructuraId) {

            return res.status(400).json({
                error: "Debe indicar una estructura válida"
            });

        }


        // --------------------------------------------------
        // VALIDACIONES
        // --------------------------------------------------

        if (!rendimiento ||
            rendimiento <= 0) {

            return res.status(400).json({
                error:
                    "El rendimiento debe ser mayor que cero"
            });

        }


        if (!unidad_rendimiento) {

            return res.status(400).json({
                error:
                    "Debe indicar la unidad de rendimiento"
            });

        }


        if (!Array.isArray(detalle) ||
            detalle.length === 0) {

            return res.status(400).json({
                error:
                    "La estructura debe tener al menos un componente"
            });

        }


        // --------------------------------------------------
        // COMENZAR TRANSACCION
        // --------------------------------------------------

        await cliente.query("BEGIN");


        // --------------------------------------------------
        // OBTENER ESTRUCTURA ACTUAL
        // --------------------------------------------------

        const estructuraActual =
            await cliente.query(`
                SELECT
                    pe.id,
                    pe.producto_id,
                    pe.version,
                    pe.activo,

                    p.tipo,
                    p.unidad,
                    p.activo AS producto_activo

                FROM producto_estructura pe

                INNER JOIN productos p
                    ON p.id = pe.producto_id

                WHERE pe.id = $1

                FOR UPDATE
            `, [
                estructuraId
            ]);


        if (estructuraActual.rows.length === 0) {

            throw new Error(
                "La estructura no existe"
            );

        }


        const actual =
            estructuraActual.rows[0];


        // --------------------------------------------------
        // VALIDAR ESTADO
        // --------------------------------------------------

        if (!actual.activo) {

            throw new Error(
                "La estructura está inactiva"
            );

        }


        if (actual.tipo !== "ELABORADO") {

            throw new Error(
                "El producto de la estructura no es ELABORADO"
            );

        }


        if (!actual.producto_activo) {

            throw new Error(
                "El producto está inactivo"
            );

        }


        // --------------------------------------------------
        // OBTENER SIGUIENTE VERSION
        // --------------------------------------------------

        const versionResultado =
            await cliente.query(`
                SELECT
                    COALESCE(MAX(version), 0) + 1 AS version
                FROM producto_estructura
                WHERE producto_id = $1
            `, [
                actual.producto_id
            ]);


        const nuevaVersion =
            parseInt(
                versionResultado.rows[0].version
            );


        // --------------------------------------------------
        // DESACTIVAR ESTRUCTURA ACTUAL
        // --------------------------------------------------

        await cliente.query(`
            UPDATE producto_estructura
            SET activo = FALSE
            WHERE id = $1
        `, [
            estructuraId
        ]);


        // --------------------------------------------------
        // DESACTIVAR DETALLE ACTUAL
        // --------------------------------------------------

        await cliente.query(`
            UPDATE producto_estructura_detalle
            SET activo = FALSE
            WHERE estructura_id = $1
        `, [
            estructuraId
        ]);


        // --------------------------------------------------
        // CREAR NUEVA CABECERA
        // --------------------------------------------------

        const nuevaEstructura =
            await cliente.query(`
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
                actual.producto_id,
                nuevaVersion,
                rendimiento,
                unidad_rendimiento
            ]);


        const estructura =
            nuevaEstructura.rows[0];


        // --------------------------------------------------
        // CREAR NUEVO DETALLE
        // --------------------------------------------------

        for (const item of detalle) {

            if (!item.componente_id) {

                throw new Error(
                    "Existe un componente sin ID"
                );

            }


            if (!item.cantidad ||
                item.cantidad <= 0) {

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
        // CONFIRMAR
        // --------------------------------------------------

        await cliente.query("COMMIT");


        res.json({

            mensaje:
                "Estructura modificada correctamente",

            estructura_anterior_id:
                estructuraId,

            estructura_id:
                estructura.id,

            producto_id:
                actual.producto_id,

            version_anterior:
                actual.version,

            version:
                nuevaVersion

        });


    } catch (error) {

        try {

            await cliente.query("ROLLBACK");

        } catch (rollbackError) {

            console.error(
                "ERROR ROLLBACK:",
                rollbackError
            );

        }


        console.error(
            "ERROR MODIFICAR ESTRUCTURA:",
            error
        );


        res.status(500).json({
            error: error.message
        });


    } finally {

        cliente.release();

    }

};


// ======================================================
// BAJA LOGICA DE ESTRUCTURA
// ======================================================

const eliminarEstructura = async (req, res) => {

    const cliente =
        await pool.connect();


    try {

        const estructuraId =
            parseInt(req.params.id);


        // --------------------------------------------------
        // VALIDAR ID
        // --------------------------------------------------

        if (!estructuraId) {

            return res.status(400).json({
                error:
                    "Debe indicar una estructura válida"
            });

        }


        // --------------------------------------------------
        // COMENZAR TRANSACCION
        // --------------------------------------------------

        await cliente.query("BEGIN");


        // --------------------------------------------------
        // BUSCAR ESTRUCTURA
        // --------------------------------------------------

        const estructura =
            await cliente.query(`
                SELECT
                    id,
                    producto_id,
                    version,
                    activo
                FROM producto_estructura
                WHERE id = $1
                FOR UPDATE
            `, [
                estructuraId
            ]);


        if (estructura.rows.length === 0) {

            throw new Error(
                "La estructura no existe"
            );

        }


        const actual =
            estructura.rows[0];


        // --------------------------------------------------
        // VALIDAR ESTADO
        // --------------------------------------------------

        if (!actual.activo) {

            throw new Error(
                "La estructura ya está inactiva"
            );

        }


        // --------------------------------------------------
        // BAJA LOGICA CABECERA
        // --------------------------------------------------

        await cliente.query(`
            UPDATE producto_estructura
            SET activo = FALSE
            WHERE id = $1
        `, [
            estructuraId
        ]);


        // --------------------------------------------------
        // BAJA LOGICA DETALLE
        // --------------------------------------------------

        await cliente.query(`
            UPDATE producto_estructura_detalle
            SET activo = FALSE
            WHERE estructura_id = $1
        `, [
            estructuraId
        ]);


        // --------------------------------------------------
        // CONFIRMAR
        // --------------------------------------------------

        await cliente.query("COMMIT");


        res.json({

            mensaje:
                "Estructura dada de baja correctamente",

            estructura_id:
                actual.id,

            producto_id:
                actual.producto_id,

            version:
                actual.version

        });


    } catch (error) {

        try {

            await cliente.query("ROLLBACK");

        } catch (rollbackError) {

            console.error(
                "ERROR ROLLBACK:",
                rollbackError
            );

        }


        console.error(
            "ERROR BAJA ESTRUCTURA:",
            error
        );


        res.status(500).json({
            error: error.message
        });


    } finally {

        cliente.release();

    }

};


// ======================================================
// EXPORTAR
// ======================================================

module.exports = {

    listarProductosElaborados,

    listarComponentes,

    consultarEstructura,

    consultarEstructuraPorId,

    crearEstructura,

    modificarEstructura,

    eliminarEstructura

};