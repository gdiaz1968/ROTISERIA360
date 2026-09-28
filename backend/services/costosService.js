const pool = require("../db");


// ==========================================================
// LISTAR INSUMOS
// ==========================================================

async function listarInsumos() {

    const resultado = await pool.query(`
        SELECT
            p.id,
            p.codigo,
            p.nombre,
            p.tipo,
            p.id_unidad,
            um.codigo AS unidad,
            um.nombre AS unidad_nombre,

            (
                SELECT cp.costo
                FROM costos_productos cp
                WHERE cp.id_producto = p.id
                  AND cp.activo = TRUE
                ORDER BY cp.fecha_desde DESC
                LIMIT 1
            ) AS costo_actual,

            (
                SELECT cp.fecha_desde
                FROM costos_productos cp
                WHERE cp.id_producto = p.id
                  AND cp.activo = TRUE
                ORDER BY cp.fecha_desde DESC
                LIMIT 1
            ) AS costo_fecha_desde

        FROM productos p

        LEFT JOIN unidades_medida um
            ON um.id = p.id_unidad

        WHERE p.activo = TRUE
          AND p.tipo = 'INSUMO'

        ORDER BY p.nombre
    `);

    return resultado.rows;
}


// ==========================================================
// OBTENER COSTO ACTUAL DE UN INSUMO
// ==========================================================

async function obtenerCostoInsumo(idProducto) {

    const producto = await pool.query(`
        SELECT
            p.id,
            p.codigo,
            p.nombre,
            p.tipo,
            p.id_unidad,
            um.codigo AS unidad,
            um.nombre AS unidad_nombre
        FROM productos p
        LEFT JOIN unidades_medida um
            ON um.id = p.id_unidad
        WHERE p.id = $1
          AND p.activo = TRUE
    `, [idProducto]);


    if (producto.rows.length === 0) {

        throw new Error(
            "El producto no existe o está inactivo."
        );

    }


    const datosProducto =
        producto.rows[0];


    if (datosProducto.tipo !== "INSUMO") {

        throw new Error(
            "El producto seleccionado no es un INSUMO."
        );

    }


    const costo = await pool.query(`
        SELECT
            id,
            costo,
            fecha_desde,
            fecha_hasta,
            activo
        FROM costos_productos
        WHERE id_producto = $1
          AND activo = TRUE
        ORDER BY fecha_desde DESC
        LIMIT 1
    `, [idProducto]);


    return {

        producto: datosProducto,

        costo: costo.rows.length > 0
            ? costo.rows[0]
            : null

    };
}


// ==========================================================
// LISTAR HISTORIAL DE COSTOS
// ==========================================================

async function listarHistorialCosto(idProducto) {

    const resultado = await pool.query(`
        SELECT
            id,
            costo,
            fecha_desde,
            fecha_hasta,
            activo
        FROM costos_productos
        WHERE id_producto = $1
        ORDER BY fecha_desde DESC, id DESC
    `, [idProducto]);

    return resultado.rows;
}


// ==========================================================
// REGISTRAR NUEVO COSTO DE INSUMO
// ==========================================================

async function registrarCostoInsumo(
    idProducto,
    costo
) {

    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");


        // --------------------------------------------------
        // Verificar producto
        // --------------------------------------------------

        const producto =
            await client.query(`
                SELECT
                    p.id,
                    p.codigo,
                    p.nombre,
                    p.tipo,
                    p.id_unidad,
                    um.codigo AS unidad,
                    um.nombre AS unidad_nombre
                FROM productos p
                LEFT JOIN unidades_medida um
                    ON um.id = p.id_unidad
                WHERE p.id = $1
                  AND p.activo = TRUE
            `, [idProducto]);


        if (producto.rows.length === 0) {

            throw new Error(
                "El producto no existe o está inactivo."
            );

        }


        const datosProducto =
            producto.rows[0];


        if (datosProducto.tipo !== "INSUMO") {

            throw new Error(
                "Solo se puede registrar costo para productos INSUMO."
            );

        }


        if (!datosProducto.id_unidad) {

            throw new Error(
                "El INSUMO no tiene una unidad de medida asignada."
            );

        }


        // --------------------------------------------------
        // Obtener costo activo actual
        // --------------------------------------------------

        const costoActual =
            await client.query(`
                SELECT
                    id,
                    costo,
                    fecha_desde
                FROM costos_productos
                WHERE id_producto = $1
                  AND activo = TRUE
                ORDER BY fecha_desde DESC
                LIMIT 1
            `, [idProducto]);


        const ahora =
            new Date();


        // --------------------------------------------------
        // Cerrar costo anterior
        // --------------------------------------------------

        if (costoActual.rows.length > 0) {

            await client.query(`
                UPDATE costos_productos
                SET
                    fecha_hasta = $1,
                    activo = FALSE
                WHERE id = $2
            `, [
                ahora,
                costoActual.rows[0].id
            ]);

        }


        // --------------------------------------------------
        // Crear nuevo costo
        // --------------------------------------------------

        const nuevoCosto =
            await client.query(`
                INSERT INTO costos_productos
                (
                    id_producto,
                    costo,
                    fecha_desde,
                    fecha_hasta,
                    activo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    NULL,
                    TRUE
                )
                RETURNING
                    id,
                    id_producto,
                    costo,
                    fecha_desde,
                    fecha_hasta,
                    activo
            `, [
                idProducto,
                costo,
                ahora
            ]);


        await client.query("COMMIT");


        return {

            producto: datosProducto,

            costo: nuevoCosto.rows[0]

        };

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();

    }
}

// ==========================================================
// OBTENER ESTRUCTURA ACTIVA DE UN PRODUCTO
// ==========================================================

async function obtenerEstructuraProducto(
    idProducto
) {

    // ------------------------------------------------------
    // PRODUCTO
    // ------------------------------------------------------

    const productoResultado =
        await pool.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.tipo,
                p.id_unidad,
                u.codigo AS unidad_codigo,
                u.nombre AS unidad_nombre
            FROM productos p

            LEFT JOIN unidades_medida u
                ON u.id = p.id_unidad

            WHERE p.id = $1
              AND p.activo = TRUE
        `, [
            idProducto
        ]);


    if (
        productoResultado.rows.length === 0
    ) {

        throw new Error(
            "El producto no existe o está inactivo."
        );

    }


    const producto =
        productoResultado.rows[0];


    // ------------------------------------------------------
    // VALIDAR TIPO
    // ------------------------------------------------------

    if (
        producto.tipo !== "ELABORADO"
    ) {

        throw new Error(
            "El producto seleccionado no es un producto ELABORADO."
        );

    }


    // ------------------------------------------------------
    // BUSCAR ESTRUCTURA ACTIVA
    // ------------------------------------------------------

    const estructuraResultado =
        await pool.query(`
            SELECT
                pe.id,
                pe.version,
                pe.rendimiento,
                pe.unidad_rendimiento,
                pe.activo
            FROM producto_estructura pe

            WHERE pe.producto_id = $1
              AND pe.activo = TRUE

            ORDER BY pe.version DESC

            LIMIT 1
        `, [
            idProducto
        ]);


    if (
        estructuraResultado.rows.length === 0
    ) {

        throw new Error(
            "El producto " +
            producto.codigo +
            " - " +
            producto.nombre +
            " no posee una estructura activa."
        );

    }


    const estructura =
        estructuraResultado.rows[0];


    // ------------------------------------------------------
    // BUSCAR COMPONENTES
    // ------------------------------------------------------

    const detalleResultado =
        await pool.query(`
            SELECT

                d.id,
                d.componente_id,
                d.cantidad,
                d.merma,
                d.activo,

                p.codigo AS componente_codigo,
                p.nombre AS componente_nombre,
                p.tipo AS componente_tipo,
                p.id_unidad AS componente_id_unidad,

                u.codigo AS componente_unidad,
                u.nombre AS componente_unidad_nombre

            FROM producto_estructura_detalle d

            INNER JOIN productos p
                ON p.id = d.componente_id

            LEFT JOIN unidades_medida u
                ON u.id = p.id_unidad

            WHERE d.estructura_id = $1
              AND d.activo = TRUE

            ORDER BY d.id
        `, [
            estructura.id
        ]);


    // ------------------------------------------------------
    // DEVOLVER ESTRUCTURA
    // ------------------------------------------------------

    return {

        producto: {

            id:
                producto.id,

            codigo:
                producto.codigo,

            nombre:
                producto.nombre,

            tipo:
                producto.tipo,

            id_unidad:
                producto.id_unidad,

            unidad:
                producto.unidad_codigo,

            unidad_nombre:
                producto.unidad_nombre

        },

        estructura: {

            id:
                estructura.id,

            version:
                estructura.version,

            rendimiento:
                Number(
                    estructura.rendimiento
                ),

            unidad_rendimiento:
                estructura.unidad_rendimiento,

            activo:
                estructura.activo

        },

        detalle:
            detalleResultado.rows.map(
                function (item) {

                    return {

                        id:
                            item.id,

                        componente_id:
                            item.componente_id,

                        codigo:
                            item.componente_codigo,

                        nombre:
                            item.componente_nombre,

                        tipo:
                            item.componente_tipo,

                        id_unidad:
                            item.componente_id_unidad,

                        unidad:
                            item.componente_unidad,

                        unidad_nombre:
                            item.componente_unidad_nombre,

                        cantidad:
                            Number(
                                item.cantidad
                            ),

                        merma:
                            Number(
                                item.merma
                            )

                    };

                }
            )

    };

}


// ==========================================================
// CALCULAR COSTO DE PRODUCTO
// ==========================================================

async function calcularCostoProducto(
    idProducto,
    camino = []
) {

    // ------------------------------------------------------
    // Validación
    // ------------------------------------------------------

    if (
        !Number.isInteger(idProducto) ||
        idProducto <= 0
    ) {

        throw new Error(
            "El ID del producto no es válido."
        );

    }


    // ------------------------------------------------------
    // Detectar ciclo
    // ------------------------------------------------------

    if (camino.includes(idProducto)) {

        const ciclo =
            camino.concat(idProducto);

        throw new Error(
            "Se detectó una dependencia circular: " +
            ciclo.join(" -> ")
        );

    }


    const nuevoCamino =
        camino.concat(idProducto);


    // ------------------------------------------------------
    // Producto
    // ------------------------------------------------------

    const productoResultado =
        await pool.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.tipo,
                p.id_unidad,
                u.codigo AS unidad_codigo,
                u.nombre AS unidad_nombre
            FROM productos p
            LEFT JOIN unidades_medida u
                ON u.id = p.id_unidad
            WHERE p.id = $1
              AND p.activo = TRUE
        `, [idProducto]);


    if (productoResultado.rows.length === 0) {

        throw new Error(
            "El producto con ID " +
            idProducto +
            " no existe o está inactivo."
        );

    }


    const producto =
        productoResultado.rows[0];


    // ======================================================
    // INSUMO
    // ======================================================

    if (producto.tipo === "INSUMO") {

        const costoResultado =
            await pool.query(`
                SELECT
                    id,
                    costo,
                    fecha_desde,
                    fecha_hasta
                FROM costos_productos
                WHERE id_producto = $1
                  AND activo = TRUE
                ORDER BY fecha_desde DESC
                LIMIT 1
            `, [idProducto]);


        if (costoResultado.rows.length === 0) {

            throw new Error(
                "El producto " +
                producto.codigo +
                " - " +
                producto.nombre +
                " no posee un costo vigente."
            );

        }


        const costo =
            costoResultado.rows[0];


        return {

            producto: {

                id: producto.id,
                codigo: producto.codigo,
                nombre: producto.nombre,
                tipo: producto.tipo,
                id_unidad: producto.id_unidad,
                unidad: producto.unidad_codigo,
                unidad_nombre: producto.unidad_nombre

            },

            costo_unitario:
                Number(costo.costo),

            costo_total:
                Number(costo.costo),

            rendimiento: 1,

            unidad_rendimiento:
                producto.unidad_codigo,

            detalle: [],

            fecha_costo:
                costo.fecha_desde,

            tipo_calculo: "INSUMO"

        };

    }


    // ======================================================
    // ELABORADO
    // ======================================================

    if (producto.tipo !== "ELABORADO") {

        throw new Error(
            "El tipo de producto " +
            producto.tipo +
            " no es válido para cálculo de costos."
        );

    }


    // ------------------------------------------------------
    // Buscar estructura activa
    // ------------------------------------------------------

    const estructuraResultado =
        await pool.query(`
            SELECT
                pe.id,
                pe.version,
                pe.rendimiento,
                pe.unidad_rendimiento
            FROM producto_estructura pe
            WHERE pe.producto_id = $1
              AND pe.activo = TRUE
            ORDER BY pe.version DESC
            LIMIT 1
        `, [idProducto]);


    if (estructuraResultado.rows.length === 0) {

        throw new Error(
            "El producto " +
            producto.codigo +
            " - " +
            producto.nombre +
            " no posee una estructura activa."
        );

    }


    const estructura =
        estructuraResultado.rows[0];


    const rendimiento =
        Number(estructura.rendimiento);


    if (
        !Number.isFinite(rendimiento) ||
        rendimiento <= 0
    ) {

        throw new Error(
            "El rendimiento de la estructura no es válido."
        );

    }


    // ------------------------------------------------------
    // Detalle de estructura
    // ------------------------------------------------------

    const detalleResultado =
        await pool.query(`
            SELECT
                d.id,
                d.componente_id,
                d.cantidad,
                d.merma,

                p.codigo AS componente_codigo,
                p.nombre AS componente_nombre,
                p.tipo AS componente_tipo,
                p.id_unidad AS componente_id_unidad,

                u.codigo AS componente_unidad,
                u.nombre AS componente_unidad_nombre

            FROM producto_estructura_detalle d

            INNER JOIN productos p
                ON p.id = d.componente_id

            LEFT JOIN unidades_medida u
                ON u.id = p.id_unidad

            WHERE d.estructura_id = $1
              AND d.activo = TRUE

            ORDER BY d.id
        `, [estructura.id]);


    let costoTotal = 0;

    const detalle = [];


    // ------------------------------------------------------
    // Calcular componentes
    // ------------------------------------------------------

    for (
        const item of detalleResultado.rows
    ) {

        const cantidad =
            Number(item.cantidad);

        const merma =
            Number(item.merma);


        if (
            !Number.isFinite(cantidad) ||
            cantidad < 0
        ) {

            throw new Error(
                "La cantidad del componente " +
                item.componente_nombre +
                " no es válida."
            );

        }


        if (
            !Number.isFinite(merma) ||
            merma < 0
        ) {

            throw new Error(
                "La merma del componente " +
                item.componente_nombre +
                " no es válida."
            );

        }


        // --------------------------------------------------
        // Cantidad efectiva
        // --------------------------------------------------

        const cantidadEfectiva =
            cantidad *
            (1 + merma / 100);


        // --------------------------------------------------
        // Calcular costo componente
        // --------------------------------------------------

        const costoComponente =
            await calcularCostoProducto(
                item.componente_id,
                nuevoCamino
            );


        const costoUnitarioComponente =
            Number(
                costoComponente.costo_unitario
            );


        const subtotal =
            cantidadEfectiva *
            costoUnitarioComponente;


        costoTotal += subtotal;


        detalle.push({

            id:
                item.id,

            componente_id:
                item.componente_id,

            codigo:
                item.componente_codigo,

            nombre:
                item.componente_nombre,

            tipo:
                item.componente_tipo,

            unidad:
                item.componente_unidad,

            unidad_nombre:
                item.componente_unidad_nombre,

            cantidad:
                cantidad,

            merma:
                merma,

            cantidad_efectiva:
                cantidadEfectiva,

            costo_unitario:
                costoUnitarioComponente,

            subtotal:
                subtotal,

            calculo:
                costoComponente

        });

    }


    // ------------------------------------------------------
    // Costo unitario
    // ------------------------------------------------------

    const costoUnitario =
        costoTotal / rendimiento;


    return {

        producto: {

            id:
                producto.id,

            codigo:
                producto.codigo,

            nombre:
                producto.nombre,

            tipo:
                producto.tipo,

            id_unidad:
                producto.id_unidad,

            unidad:
                producto.unidad_codigo,

            unidad_nombre:
                producto.unidad_nombre

        },

        estructura: {

            id:
                estructura.id,

            version:
                estructura.version

        },

        rendimiento:
            rendimiento,

        unidad_rendimiento:
            estructura.unidad_rendimiento,

        costo_total:
            costoTotal,

        costo_unitario:
            costoUnitario,

        detalle:
            detalle,

        tipo_calculo:
            "ELABORADO"

    };
}

// ======================================================
// OBTENER ESTRUCTURA + COSTO ACTUAL DE COMPONENTES
// ======================================================

const obtenerEstructuraConCostos = async (idProducto) => {

    if (!idProducto || isNaN(idProducto)) {
        throw new Error("ID de producto inválido");
    }

    // --------------------------------------------------
    // PRODUCTO
    // --------------------------------------------------

    const productoResult = await pool.query(`
        SELECT
            p.id,
            p.codigo,
            p.nombre,
            p.tipo,
            p.id_unidad,
            um.codigo AS unidad,
            um.nombre AS unidad_nombre
        FROM productos p
        LEFT JOIN unidades_medida um
            ON um.id = p.id_unidad
        WHERE p.id = $1
          AND p.activo = TRUE
    `, [idProducto]);

    if (productoResult.rows.length === 0) {
        throw new Error("Producto no encontrado");
    }

    const producto = productoResult.rows[0];

    // --------------------------------------------------
    // DEBE SER PRODUCTO ELABORADO
    // --------------------------------------------------

    if (producto.tipo !== "ELABORADO") {
        throw new Error(
            "El producto seleccionado no es un producto ELABORADO"
        );
    }

    // --------------------------------------------------
    // ÚLTIMA ESTRUCTURA ACTIVA
    // --------------------------------------------------

    const estructuraResult = await pool.query(`
        SELECT
            pe.id,
            pe.version,
            pe.rendimiento,
            pe.unidad_rendimiento,
            pe.activo
        FROM producto_estructura pe
        WHERE pe.producto_id = $1
          AND pe.activo = TRUE
        ORDER BY pe.version DESC
        LIMIT 1
    `, [idProducto]);

    if (estructuraResult.rows.length === 0) {
        throw new Error(
            "El producto no tiene una estructura activa"
        );
    }

    const estructura = estructuraResult.rows[0];

    // --------------------------------------------------
    // COMPONENTES
    // --------------------------------------------------

    const detalleResult = await pool.query(`
        SELECT
            ped.id,
            ped.componente_id,

            p.codigo,
            p.nombre,
            p.tipo,

            p.id_unidad,

            um.codigo AS unidad,
            um.nombre AS unidad_nombre,

            ped.cantidad,
            ped.merma,

            cp.costo AS costo_unitario

        FROM producto_estructura_detalle ped

        INNER JOIN productos p
            ON p.id = ped.componente_id

        LEFT JOIN unidades_medida um
            ON um.id = p.id_unidad

        LEFT JOIN costos_productos cp
            ON cp.id_producto = ped.componente_id
           AND cp.activo = TRUE

        WHERE ped.estructura_id = $1
          AND ped.activo = TRUE
          AND p.activo = TRUE

        ORDER BY ped.id
    `, [estructura.id]);

    // --------------------------------------------------
    // RESULTADO
    // --------------------------------------------------

    return {

        producto: producto,

        estructura: {
            id: estructura.id,
            version: estructura.version,
            rendimiento: estructura.rendimiento,
            unidad_rendimiento: estructura.unidad_rendimiento,
            activo: estructura.activo
        },

        detalle: detalleResult.rows

    };

};


module.exports = {
    calcularCostoProducto,
    listarInsumos,
    obtenerCostoInsumo,
    registrarCostoInsumo,
    listarHistorialCosto,
    obtenerEstructuraProducto,
    obtenerEstructuraConCostos
};