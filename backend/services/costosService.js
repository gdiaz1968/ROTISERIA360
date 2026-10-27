
const pool = require("../db");

// ==========================================================
// LISTAR INSUMOS
// El costo_actual devuelve el costo ajustado.
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
                SELECT
                    cp.costo * COALESCE(cp.factor_ajuste, 1)
                FROM costos_productos cp
                WHERE cp.id_producto = p.id
                  AND cp.activo = TRUE
                ORDER BY cp.fecha_desde DESC, cp.id DESC
                LIMIT 1
            ) AS costo_actual,

            (
                SELECT cp.costo
                FROM costos_productos cp
                WHERE cp.id_producto = p.id
                  AND cp.activo = TRUE
                ORDER BY cp.fecha_desde DESC, cp.id DESC
                LIMIT 1
            ) AS costo_base,

            (
                SELECT COALESCE(cp.factor_ajuste, 1)
                FROM costos_productos cp
                WHERE cp.id_producto = p.id
                  AND cp.activo = TRUE
                ORDER BY cp.fecha_desde DESC, cp.id DESC
                LIMIT 1
            ) AS factor_ajuste,

            (
                SELECT cp.fecha_desde
                FROM costos_productos cp
                WHERE cp.id_producto = p.id
                  AND cp.activo = TRUE
                ORDER BY cp.fecha_desde DESC, cp.id DESC
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

    const datosProducto = producto.rows[0];

    if (datosProducto.tipo !== "INSUMO") {
        throw new Error(
            "El producto seleccionado no es un INSUMO."
        );
    }

    const resultadoCosto = await pool.query(`
        SELECT
            id,
            costo,
            COALESCE(factor_ajuste, 1) AS factor_ajuste,
            ROUND(
                (
                    costo * COALESCE(factor_ajuste, 1)
                )::numeric,
                4
            ) AS costo_ajustado,
            fecha_desde,
            fecha_hasta,
            activo
        FROM costos_productos
        WHERE id_producto = $1
          AND activo = TRUE
        ORDER BY fecha_desde DESC, id DESC
        LIMIT 1
    `, [idProducto]);

    return {
        producto: datosProducto,
        costo: resultadoCosto.rows.length > 0
            ? resultadoCosto.rows[0]
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
            COALESCE(factor_ajuste, 1) AS factor_ajuste,
            ROUND(
                (
                    costo * COALESCE(factor_ajuste, 1)
                )::numeric,
                4
            ) AS costo_ajustado,
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
// costo = costo base
// factorAjuste = factor de ajuste
// ==========================================================


async function registrarCostoInsumo(
    idProducto,
    idPresentacion,
    precioPresentacion,
    factorAjuste = 1
) {
    const id = Number(idProducto);
    const idPres = Number(idPresentacion);
    const precio = Number(precioPresentacion);
    const factor = Number(factorAjuste);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("El producto seleccionado no es válido.");
    }

    if (!Number.isInteger(idPres) || idPres <= 0) {
        throw new Error("Debe seleccionar una presentación válida.");
    }

    if (!Number.isFinite(precio) || precio < 0) {
        throw new Error(
            "El precio de la presentación debe ser mayor o igual a cero."
        );
    }

    if (!Number.isFinite(factor) || factor <= 0) {
        throw new Error("El factor de ajuste debe ser mayor que cero.");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const producto = await client.query(`
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
            FOR UPDATE OF p
        `, [id]);

        if (producto.rows.length === 0) {
            throw new Error("El producto no existe o está inactivo.");
        }

        const datosProducto = producto.rows[0];

        if (datosProducto.tipo !== "INSUMO") {
            throw new Error(
                "Solo se puede registrar costo para productos INSUMO."
            );
        }

        if (!datosProducto.id_unidad || !datosProducto.unidad) {
            throw new Error(
                "El INSUMO no tiene una unidad de medida asignada."
            );
        }

        // Obtener y validar la presentación elegida.
        const presentacionResultado = await client.query(`
            SELECT
                pp.id,
                pp.id_producto,
                pp.nombre,
                pp.cantidad_contenida,
                pp.id_unidad_contenido,
                um.codigo AS unidad_presentacion
            FROM presentaciones_producto pp
            INNER JOIN unidades_medida um
                ON um.id = pp.id_unidad_contenido
            WHERE pp.id = $1
              AND pp.id_producto = $2
              AND pp.activo = TRUE
            FOR UPDATE OF pp
        `, [idPres, id]);

        if (presentacionResultado.rows.length === 0) {
            throw new Error(
                "La presentación no existe, está inactiva o no corresponde al insumo."
            );
        }

        const presentacion = presentacionResultado.rows[0];
        const cantidad = Number(presentacion.cantidad_contenida);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error(
                "La cantidad contenida de la presentación debe ser mayor que cero."
            );
        }

        // Por ahora se exige que ambas unidades coincidan.
        // Las conversiones entre KG/G, L/ML, etc. se incorporarán
        // mediante conversiones_unidad cuando corresponda.
        const unidadProducto = String(datosProducto.unidad)
            .trim()
            .toUpperCase();

        const unidadPresentacion = String(presentacion.unidad_presentacion)
            .trim()
            .toUpperCase();

        if (unidadProducto !== unidadPresentacion) {
            throw new Error(
                `La unidad de la presentación (${unidadPresentacion}) ` +
                `no coincide con la unidad base del insumo (${unidadProducto}).`
            );
        }

        // Convertir el precio de la presentación a costo por unidad base.
        const costoBase = precio / cantidad;

        if (!Number.isFinite(costoBase)) {
            throw new Error("No se pudo calcular el costo por unidad.");
        }

        const ahora = new Date();

        // Cerrar los costos activos anteriores del insumo.
        await client.query(`
            UPDATE costos_productos
            SET
                fecha_hasta = $1,
                activo = FALSE
            WHERE id_producto = $2
              AND activo = TRUE
        `, [ahora, id]);

        // Guardar el costo por unidad base, no el precio de la bolsa.
        const nuevoCosto = await client.query(`
            INSERT INTO costos_productos
            (
                id_producto,
                costo,
                factor_ajuste,
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
                id_producto,
                costo,
                factor_ajuste,
                ROUND(
                    (costo * factor_ajuste)::numeric,
                    4
                ) AS costo_ajustado,
                fecha_desde,
                fecha_hasta,
                activo
        `, [
            id,
            costoBase,
            factor,
            ahora
        ]);

        await client.query("COMMIT");

        return {
            producto: datosProducto,
            presentacion: {
                id: presentacion.id,
                nombre: presentacion.nombre,
                cantidad_contenida: cantidad,
                unidad: unidadPresentacion,
                precio_compra: precio
            },
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

async function obtenerEstructuraProducto(idProducto) {
    const productoResultado = await pool.query(`
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
            "El producto no existe o está inactivo."
        );
    }

    const producto = productoResultado.rows[0];

    if (producto.tipo !== "ELABORADO") {
        throw new Error(
            "El producto seleccionado no es un producto ELABORADO."
        );
    }

    const estructuraResultado = await pool.query(`
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

    if (estructuraResultado.rows.length === 0) {
        throw new Error(
            "El producto " +
            producto.codigo +
            " - " +
            producto.nombre +
            " no posee una estructura activa."
        );
    }

    const estructura = estructuraResultado.rows[0];

    const detalleResultado = await pool.query(`
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
    `, [estructura.id]);

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

        estructura: {
            id: estructura.id,
            version: estructura.version,
            rendimiento: Number(estructura.rendimiento),
            unidad_rendimiento: estructura.unidad_rendimiento,
            activo: estructura.activo
        },

        detalle: detalleResultado.rows.map((item) => ({
            id: item.id,
            componente_id: item.componente_id,
            codigo: item.componente_codigo,
            nombre: item.componente_nombre,
            tipo: item.componente_tipo,
            id_unidad: item.componente_id_unidad,
            unidad: item.componente_unidad,
            unidad_nombre: item.componente_unidad_nombre,
            cantidad: Number(item.cantidad),
            merma: Number(item.merma)
        }))
    };
}


// ==========================================================
// CALCULAR COSTO DE PRODUCTO
// INSUMO: costo base x factor de ajuste.
// ELABORADO: suma componentes con merma y divide rendimiento.
// ==========================================================

async function calcularCostoProducto(
    idProducto,
    camino = []
) {
    const id = Number(idProducto);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(
            "El ID del producto no es válido."
        );
    }

    if (camino.includes(id)) {
        const ciclo = camino.concat(id);

        throw new Error(
            "Se detectó una dependencia circular: " +
            ciclo.join(" -> ")
        );
    }

    const nuevoCamino = camino.concat(id);

    const productoResultado = await pool.query(`
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
    `, [id]);

    if (productoResultado.rows.length === 0) {
        throw new Error(
            "El producto con ID " +
            id +
            " no existe o está inactivo."
        );
    }

    const producto = productoResultado.rows[0];

    // ======================================================
    // INSUMO
    // ======================================================

    if (producto.tipo === "INSUMO") {
        const costoResultado = await pool.query(`
            SELECT
                id,
                costo,
                COALESCE(factor_ajuste, 1) AS factor_ajuste,
                fecha_desde,
                fecha_hasta
            FROM costos_productos
            WHERE id_producto = $1
              AND activo = TRUE
            ORDER BY fecha_desde DESC, id DESC
            LIMIT 1
        `, [id]);

        if (costoResultado.rows.length === 0) {
            throw new Error(
                "El producto " +
                producto.codigo +
                " - " +
                producto.nombre +
                " no posee un costo vigente."
            );
        }

        const registro = costoResultado.rows[0];
        const costoBase = Number(registro.costo);
        const factorAjuste = Number(registro.factor_ajuste);
        const costoAjustado = costoBase * factorAjuste;

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

            costo_base: costoBase,
            factor_ajuste: factorAjuste,
            costo_ajustado: costoAjustado,
            costo_unitario: costoAjustado,
            costo_total: costoAjustado,

            rendimiento: 1,
            unidad_rendimiento: producto.unidad_codigo,
            detalle: [],
            fecha_costo: registro.fecha_desde,
            tipo_calculo: "INSUMO"
        };
    }

    // ======================================================
    // VALIDAR PRODUCTO ELABORADO
    // ======================================================

    if (producto.tipo !== "ELABORADO") {
        throw new Error(
            "El tipo de producto " +
            producto.tipo +
            " no es válido para cálculo de costos."
        );
    }

    // ======================================================
    // BUSCAR ESTRUCTURA ACTIVA
    // ======================================================

    const estructuraResultado = await pool.query(`
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
    `, [id]);

    if (estructuraResultado.rows.length === 0) {
        throw new Error(
            "El producto " +
            producto.codigo +
            " - " +
            producto.nombre +
            " no posee una estructura activa."
        );
    }

    const estructura = estructuraResultado.rows[0];
    const rendimiento = Number(estructura.rendimiento);

    if (!Number.isFinite(rendimiento) || rendimiento <= 0) {
        throw new Error(
            "El rendimiento de la estructura no es válido."
        );
    }

    // ======================================================
    // DETALLE DE ESTRUCTURA
    // ======================================================

    const detalleResultado = await pool.query(`
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

    // ======================================================
    // CALCULAR COMPONENTES
    // ======================================================

    for (const item of detalleResultado.rows) {
        const cantidad = Number(item.cantidad);
        const merma = Number(item.merma);

        if (!Number.isFinite(cantidad) || cantidad < 0) {
            throw new Error(
                "La cantidad del componente " +
                item.componente_nombre +
                " no es válida."
            );
        }

        if (
            !Number.isFinite(merma) ||
            merma < 0 ||
            merma > 100
        ) {
            throw new Error(
                "La merma del componente " +
                item.componente_nombre +
                " debe estar entre 0 y 100."
            );
        }

        // La merma afecta a la cantidad utilizada.
        // No modifica el factor de ajuste del costo.
        const cantidadEfectiva =
            cantidad * (1 + merma / 100);

        const costoComponente =
            await calcularCostoProducto(
                Number(item.componente_id),
                nuevoCamino
            );

        const costoUnitarioComponente =
            Number(costoComponente.costo_unitario);

        const subtotal =
            cantidadEfectiva * costoUnitarioComponente;

        costoTotal += subtotal;

        detalle.push({
            id: item.id,
            componente_id: item.componente_id,
            codigo: item.componente_codigo,
            nombre: item.componente_nombre,
            tipo: item.componente_tipo,
            unidad: item.componente_unidad,
            unidad_nombre: item.componente_unidad_nombre,
            cantidad: cantidad,
            merma: merma,
            cantidad_efectiva: cantidadEfectiva,
            costo_unitario: costoUnitarioComponente,
            subtotal: subtotal,
            calculo: costoComponente
        });
    }

    // ======================================================
    // COSTO UNITARIO DEL PRODUCTO ELABORADO
    // ======================================================

    const costoUnitario = costoTotal / rendimiento;

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

        estructura: {
            id: estructura.id,
            version: estructura.version
        },

        rendimiento: rendimiento,
        unidad_rendimiento: estructura.unidad_rendimiento,
        costo_total: costoTotal,
        costo_unitario: costoUnitario,
        detalle: detalle,
        tipo_calculo: "ELABORADO"
    };
}


// ==========================================================
// OBTENER ESTRUCTURA + COSTO ACTUAL DE COMPONENTES
// Devuelve el costo base y el ajustado de cada componente.
// ==========================================================

const obtenerEstructuraConCostos = async (idProducto) => {
    const id = Number(idProducto);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("ID de producto inválido");
    }

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
    `, [id]);

    if (productoResult.rows.length === 0) {
        throw new Error("Producto no encontrado");
    }

    const producto = productoResult.rows[0];

    if (producto.tipo !== "ELABORADO") {
        throw new Error(
            "El producto seleccionado no es un producto ELABORADO"
        );
    }

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
    `, [id]);

    if (estructuraResult.rows.length === 0) {
        throw new Error(
            "El producto no tiene una estructura activa"
        );
    }

    const estructura = estructuraResult.rows[0];

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

            cp.costo AS costo_base,

            COALESCE(cp.factor_ajuste, 1) AS factor_ajuste,

            cp.costo * COALESCE(cp.factor_ajuste, 1)
                AS costo_unitario,

            ROUND(
                (
                    cp.costo * COALESCE(cp.factor_ajuste, 1)
                )::numeric,
                4
            ) AS costo_ajustado,

            cp.fecha_desde AS fecha_costo

        FROM producto_estructura_detalle ped

        INNER JOIN productos p
            ON p.id = ped.componente_id

        LEFT JOIN unidades_medida um
            ON um.id = p.id_unidad

        LEFT JOIN LATERAL (
            SELECT
                c.id,
                c.costo,
                c.factor_ajuste,
                c.fecha_desde
            FROM costos_productos c
            WHERE c.id_producto = ped.componente_id
              AND c.activo = TRUE
            ORDER BY c.fecha_desde DESC, c.id DESC
            LIMIT 1
        ) cp ON TRUE

        WHERE ped.estructura_id = $1
          AND ped.activo = TRUE
          AND p.activo = TRUE

        ORDER BY ped.id
    `, [estructura.id]);

    return {
        producto: producto,

        estructura: {
            id: estructura.id,
            version: estructura.version,
            rendimiento: Number(estructura.rendimiento),
            unidad_rendimiento: estructura.unidad_rendimiento,
            activo: estructura.activo
        },

        detalle: detalleResult.rows.map((item) => ({
            ...item,
            cantidad: Number(item.cantidad),
            merma: Number(item.merma),
            costo_base: item.costo_base === null
                ? null
                : Number(item.costo_base),
            factor_ajuste: item.factor_ajuste === null
                ? null
                : Number(item.factor_ajuste),
            costo_unitario: item.costo_unitario === null
                ? null
                : Number(item.costo_unitario),
            costo_ajustado: item.costo_ajustado === null
                ? null
                : Number(item.costo_ajustado)
        }))
    };
};


// ==========================================================
// EXPORTACIONES
// ==========================================================

module.exports = {
    calcularCostoProducto,
    listarInsumos,
    obtenerCostoInsumo,
    registrarCostoInsumo,
    listarHistorialCosto,
    obtenerEstructuraProducto,
    obtenerEstructuraConCostos
};
