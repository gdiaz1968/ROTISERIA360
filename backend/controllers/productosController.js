const pool = require("../db");
const { registrarActividad } = require("../services/auditoriaService");

// ======================================================
// AUDITORÍA FUNCIONAL DE PRODUCTOS
// No registra el contenido del request ni datos sensibles.
// ======================================================

const auditarProducto = async (req, {
    accion,
    resultado,
    entidadId = null,
    detalle = {}
}) => {
    await registrarActividad({
        modulo: "PRODUCTOS",
        pantalla: "PRODUCTOS",
        accion,
        entidad: "PRODUCTO",
        entidadId: entidadId === null || entidadId === undefined
            ? null
            : String(entidadId),
        metodoHttp: req.method,
        ruta: req.baseUrl
            ? `${req.baseUrl}${req.path}`
            : req.path,
        resultado,
        detalle
    });
};

// ======================================================
// LISTAR PRODUCTOS
// Solo productos activos
// ======================================================

const listarProductos = async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.tipo,
                p.id_unidad,
                um.codigo AS unidad,
                um.nombre AS unidad_nombre,
                p.activo,
                p.fecha_alta
            FROM productos p
            LEFT JOIN unidades_medida um
                ON um.id = p.id_unidad
            WHERE p.activo = TRUE
            ORDER BY p.codigo, p.nombre
        `);

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al consultar productos"
        });
    }
};


// ======================================================
// OBTENER PRODUCTO
// Permite obtener también productos inactivos
// ======================================================

const obtenerProducto = async (req, res) => {

    try {

        const id = req.params.id;

        const resultado = await pool.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.tipo,
                p.id_unidad,
                um.codigo AS unidad,
                um.nombre AS unidad_nombre,
                p.activo,
                p.fecha_alta
            FROM productos p
            LEFT JOIN unidades_medida um
                ON um.id = p.id_unidad
            WHERE p.id = $1
        `, [id]);

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al obtener producto"
        });
    }
};


// ======================================================
// CREAR PRODUCTO
// ======================================================

const crearProducto = async (req, res) => {

    try {

        const {
            codigo,
            nombre,
            tipo,
            id_unidad
        } = req.body;

        if (!codigo || !nombre || !tipo || !id_unidad) {

            await auditarProducto(req, {
                accion: "PRODUCTO_CREAR",
                resultado: "ADVERTENCIA",
                detalle: { motivo: "CAMPOS_OBLIGATORIOS" }
            });

            return res.status(400).json({
                error: "Todos los campos son obligatorios"
            });
        }

        if (!["INSUMO", "ELABORADO", "REVENTA"].includes(tipo)) {
            await auditarProducto(req, {
                accion: "PRODUCTO_CREAR",
                resultado: "ADVERTENCIA",
                detalle: { motivo: "TIPO_NO_VALIDO" }
            });

            return res.status(400).json({
                error: "El tipo debe ser INSUMO, ELABORADO o REVENTA."
            });
        }

        const resultado = await pool.query(`
            INSERT INTO productos
            (
                codigo,
                nombre,
                tipo,
                id_unidad
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4
            )
            RETURNING *
        `, [
            codigo,
            nombre,
            tipo,
            id_unidad
        ]);

        const producto = resultado.rows[0];

        await auditarProducto(req, {
            accion: "PRODUCTO_CREADO",
            resultado: "OK",
            entidadId: producto.id,
            detalle: { tipo: producto.tipo }
        });

        res.status(201).json(producto);

    } catch (error) {

        console.error(error);

        if (error.code === "23505") {

            await auditarProducto(req, {
                accion: "PRODUCTO_CREAR",
                resultado: "ADVERTENCIA",
                detalle: { motivo: "CODIGO_DUPLICADO", codigo_error: error.code }
            });

            return res.status(400).json({
                error: "El código del producto ya existe"
            });
        }

        await auditarProducto(req, {
            accion: "PRODUCTO_CREAR",
            resultado: "ERROR",
            detalle: {
                motivo: "ERROR_BASE_DATOS_O_INTERNO",
                codigo_error: error.code || null
            }
        });

        res.status(500).json({
            error: "Error al crear producto"
        });
    }
};


// ======================================================
// MODIFICAR PRODUCTO
// ======================================================

const modificarProducto = async (req, res) => {

    try {

        const id = req.params.id;

        const {
            codigo,
            nombre,
            tipo,
            id_unidad,
            activo
        } = req.body;

        if (!codigo || !nombre || !tipo || !id_unidad) {

            await auditarProducto(req, {
                accion: "PRODUCTO_MODIFICAR",
                resultado: "ADVERTENCIA",
                entidadId: id,
                detalle: { motivo: "CAMPOS_OBLIGATORIOS" }
            });

            return res.status(400).json({
                error: "Todos los campos son obligatorios"
            });
        }

        if (!["INSUMO", "ELABORADO", "REVENTA"].includes(tipo)) {
            await auditarProducto(req, {
                accion: "PRODUCTO_MODIFICAR",
                resultado: "ADVERTENCIA",
                entidadId: id,
                detalle: { motivo: "TIPO_NO_VALIDO" }
            });

            return res.status(400).json({
                error: "El tipo debe ser INSUMO, ELABORADO o REVENTA."
            });
        }

        const resultado = await pool.query(`
            UPDATE productos
            SET
                codigo = $1,
                nombre = $2,
                tipo = $3,
                id_unidad = $4,
                activo = $5
            WHERE id = $6
            RETURNING *
        `, [
            codigo,
            nombre,
            tipo,
            id_unidad,
            activo,
            id
        ]);

        if (resultado.rows.length === 0) {

            await auditarProducto(req, {
                accion: "PRODUCTO_MODIFICAR",
                resultado: "ADVERTENCIA",
                entidadId: id,
                detalle: { motivo: "PRODUCTO_NO_ENCONTRADO" }
            });

            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        const producto = resultado.rows[0];

        await auditarProducto(req, {
            accion: "PRODUCTO_MODIFICADO",
            resultado: "OK",
            entidadId: producto.id,
            detalle: {
                tipo: producto.tipo,
                activo: producto.activo
            }
        });

        res.json(producto);

    } catch (error) {

        console.error(error);

        if (error.code === "23505") {

            await auditarProducto(req, {
                accion: "PRODUCTO_MODIFICAR",
                resultado: "ADVERTENCIA",
                entidadId: req.params.id,
                detalle: { motivo: "CODIGO_DUPLICADO", codigo_error: error.code }
            });

            return res.status(400).json({
                error: "El código del producto ya existe"
            });
        }

        await auditarProducto(req, {
            accion: "PRODUCTO_MODIFICAR",
            resultado: "ERROR",
            entidadId: req.params.id,
            detalle: {
                motivo: "ERROR_BASE_DATOS_O_INTERNO",
                codigo_error: error.code || null
            }
        });

        res.status(500).json({
            error: "Error al modificar producto"
        });
    }
};


// ======================================================
// BAJA LOGICA DE PRODUCTO
// No se elimina el registro.
// Se establece activo = FALSE.
// ======================================================

const eliminarProducto = async (req, res) => {

    try {

        const id = req.params.id;

        const resultado = await pool.query(`
            UPDATE productos
            SET activo = FALSE
            WHERE id = $1
              AND activo = TRUE
            RETURNING *
        `, [id]);

        if (resultado.rows.length === 0) {

            await auditarProducto(req, {
                accion: "PRODUCTO_DAR_DE_BAJA",
                resultado: "ADVERTENCIA",
                entidadId: id,
                detalle: { motivo: "NO_ENCONTRADO_O_YA_INACTIVO" }
            });

            return res.status(404).json({
                error: "Producto no encontrado o ya está inactivo"
            });
        }

        const producto = resultado.rows[0];

        await auditarProducto(req, {
            accion: "PRODUCTO_DADO_DE_BAJA",
            resultado: "OK",
            entidadId: producto.id,
            detalle: { activo: false }
        });

        res.json({
            mensaje: "Producto dado de baja logicamente correctamente",
            producto
        });

    } catch (error) {

        console.error(error);

        await auditarProducto(req, {
            accion: "PRODUCTO_DAR_DE_BAJA",
            resultado: "ERROR",
            entidadId: req.params.id,
            detalle: {
                motivo: "ERROR_BASE_DATOS_O_INTERNO",
                codigo_error: error.code || null
            }
        });

        res.status(500).json({
            error: "Error al dar de baja el producto"
        });
    }
};


module.exports = {
    listarProductos,
    obtenerProducto,
    crearProducto,
    modificarProducto,
    eliminarProducto
};
