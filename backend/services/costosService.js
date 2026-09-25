const pool = require("../db");

// ======================================================
// MOTOR DE COSTOS BÁSICO
// ======================================================
//
// Calcula el costo de un producto:
//
// INSUMO
//    -> toma el costo vigente
//
// ELABORADO
//    -> toma la estructura activa
//    -> calcula cada componente
//    -> suma los subtotales
//    -> divide por el rendimiento
//
// El cálculo es recursivo para permitir:
//
// ELABORADO
//    -> ELABORADO
//        -> ELABORADO
//            -> INSUMO
//
// ======================================================


/**
 * Calcula el costo de un producto.
 *
 * @param {number} idProducto
 * @param {Array} camino
 * @returns {Object}
 */
async function calcularCostoProducto(idProducto, camino = []) {

    // ==================================================
    // 1. VALIDAR ID
    // ==================================================

    if (!idProducto) {

        throw new Error(
            "No se recibió el ID del producto."
        );

    }


    // ==================================================
    // 2. DETECTAR CICLOS
    // ==================================================

    if (camino.includes(idProducto)) {

        const recorrido = [
            ...camino,
            idProducto
        ];

        throw new Error(
            "Dependencia circular detectada: " +
            recorrido.join(" -> ")
        );

    }


    // ==================================================
    // 3. OBTENER PRODUCTO
    // ==================================================

    const productoResult = await pool.query(
        `
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
          AND p.activo = true
        `,
        [idProducto]
    );


    if (productoResult.rows.length === 0) {

        throw new Error(
            "No existe un producto activo con ID " +
            idProducto
        );

    }


    const producto = productoResult.rows[0];


    // ==================================================
    // 4. AGREGAR PRODUCTO AL CAMINO
    // ==================================================

    const nuevoCamino = [
        ...camino,
        idProducto
    ];


    // ==================================================
    // 5. SI ES INSUMO
    // ==================================================

    if (producto.tipo === "INSUMO") {

        const costoResult = await pool.query(
            `
            SELECT
                id,
                costo,
                fecha_desde,
                fecha_hasta
            FROM costos_productos
            WHERE id_producto = $1
              AND activo = true
            ORDER BY fecha_desde DESC
            LIMIT 1
            `,
            [idProducto]
        );


        if (costoResult.rows.length === 0) {

            throw new Error(
                "El producto " +
                producto.codigo +
                " - " +
                producto.nombre +
                " no posee un costo vigente."
            );

        }


        const costo = costoResult.rows[0];


        return {

            id_producto: producto.id,

            codigo: producto.codigo,

            nombre: producto.nombre,

            tipo: producto.tipo,

            unidad: producto.unidad_codigo,

            unidad_nombre: producto.unidad_nombre,

            costo_total: Number(costo.costo),

            costo_unitario: Number(costo.costo),

            rendimiento: 1,

            unidad_rendimiento: producto.unidad_codigo,

            detalle: []

        };

    }


    // ==================================================
    // 6. SI ES ELABORADO
    // ==================================================

    if (producto.tipo === "ELABORADO") {

        const estructuraResult = await pool.query(
            `
            SELECT
                pe.id,
                pe.version,
                pe.rendimiento,
                pe.unidad_rendimiento
            FROM producto_estructura pe
            WHERE pe.producto_id = $1
              AND pe.activo = true
            ORDER BY pe.version DESC
            LIMIT 1
            `,
            [idProducto]
        );


        if (estructuraResult.rows.length === 0) {

            throw new Error(
                "El producto " +
                producto.codigo +
                " - " +
                producto.nombre +
                " no posee una estructura activa."
            );

        }


        const estructura = estructuraResult.rows[0];


        const rendimiento = Number(
            estructura.rendimiento
        );


        if (!Number.isFinite(rendimiento) ||
            rendimiento <= 0) {

            throw new Error(
                "El producto " +
                producto.codigo +
                " posee un rendimiento inválido."
            );

        }


        // ==============================================
        // 7. OBTENER COMPONENTES
        // ==============================================

        const componentesResult = await pool.query(
            `
            SELECT
                ped.id,
                ped.componente_id,
                ped.cantidad,
                ped.merma,

                p.codigo,
                p.nombre,
                p.tipo,
                p.id_unidad,

                u.codigo AS unidad_codigo,
                u.nombre AS unidad_nombre

            FROM producto_estructura_detalle ped

            INNER JOIN productos p
                ON p.id = ped.componente_id

            LEFT JOIN unidades_medida u
                ON u.id = p.id_unidad

            WHERE ped.estructura_id = $1
              AND ped.activo = true
              AND p.activo = true

            ORDER BY ped.id
            `,
            [estructura.id]
        );


        // ==============================================
        // 8. CALCULAR COMPONENTES
        // ==============================================

        let costoTotal = 0;

        const detalle = [];


        for (const componente of componentesResult.rows) {

            const cantidad = Number(
                componente.cantidad
            );

            const merma = Number(
                componente.merma || 0
            );


            if (!Number.isFinite(cantidad) ||
                cantidad < 0) {

                throw new Error(
                    "Cantidad inválida en el componente " +
                    componente.codigo
                );

            }


            if (!Number.isFinite(merma) ||
                merma < 0) {

                throw new Error(
                    "Merma inválida en el componente " +
                    componente.codigo
                );

            }


            // ==========================================
            // 9. CALCULAR CANTIDAD EFECTIVA
            // ==========================================
            //
            // La merma se interpreta como porcentaje.
            //
            // Ejemplo:
            //
            // cantidad = 10
            // merma    = 5
            //
            // 10 * (1 + 5 / 100)
            // = 10.5
            //
            // ==========================================

            const cantidadEfectiva =
                cantidad *
                (1 + merma / 100);


            // ==========================================
            // 10. CALCULAR COSTO DEL COMPONENTE
            // ==========================================

            const costoComponente =
                await calcularCostoProducto(
                    componente.componente_id,
                    nuevoCamino
                );


            // ==========================================
            // 11. CALCULAR SUBTOTAL
            // ==========================================

            const subtotal =
                cantidadEfectiva *
                costoComponente.costo_unitario;


            costoTotal += subtotal;


            // ==========================================
            // 12. GUARDAR DETALLE
            // ==========================================

            detalle.push({

                id: componente.id,

                componente_id:
                    componente.componente_id,

                codigo:
                    componente.codigo,

                nombre:
                    componente.nombre,

                tipo:
                    componente.tipo,

                cantidad,

                merma,

                cantidad_efectiva:
                    cantidadEfectiva,

                unidad:
                    componente.unidad_codigo,

                unidad_nombre:
                    componente.unidad_nombre,

                costo_unitario:
                    costoComponente.costo_unitario,

                subtotal,

                calculo:
                    costoComponente

            });

        }


        // ==============================================
        // 13. COSTO POR UNIDAD DE RENDIMIENTO
        // ==============================================

        const costoUnitario =
            costoTotal / rendimiento;


        // ==============================================
        // 14. DEVOLVER RESULTADO
        // ==============================================

        return {

            id_producto:
                producto.id,

            codigo:
                producto.codigo,

            nombre:
                producto.nombre,

            tipo:
                producto.tipo,

            unidad:
                producto.unidad_codigo,

            unidad_nombre:
                producto.unidad_nombre,

            estructura_id:
                estructura.id,

            version:
                estructura.version,

            rendimiento,

            unidad_rendimiento:
                estructura.unidad_rendimiento,

            costo_total:
                costoTotal,

            costo_unitario:
                costoUnitario,

            detalle

        };

    }


    // ==================================================
    // 15. TIPO NO SOPORTADO
    // ==================================================

    throw new Error(
        "Tipo de producto no soportado: " +
        producto.tipo
    );

}


module.exports = {

    calcularCostoProducto

};