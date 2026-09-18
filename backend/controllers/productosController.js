const pool = require("../db");

// ======================================================
// LISTAR PRODUCTOS
// ======================================================

const listarProductos = async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                tipo,
                unidad,
                activo,
                fecha_alta
            FROM productos
            ORDER BY nombre
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
// ======================================================

const obtenerProducto = async (req, res) => {

    try {

        const id = req.params.id;

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                tipo,
                unidad,
                activo,
                fecha_alta
            FROM productos
            WHERE id = $1
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
            unidad
        } = req.body;

        if (!codigo || !nombre || !tipo || !unidad) {

            return res.status(400).json({
                error: "Todos los campos son obligatorios"
            });
        }

        const resultado = await pool.query(`
            INSERT INTO productos
            (
                codigo,
                nombre,
                tipo,
                unidad
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
            unidad
        ]);

        res.status(201).json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        if (error.code === "23505") {

            return res.status(400).json({
                error: "El código del producto ya existe"
            });
        }

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
            unidad,
            activo
        } = req.body;

        if (!codigo || !nombre || !tipo || !unidad) {

            return res.status(400).json({
                error: "Todos los campos son obligatorios"
            });
        }

        const resultado = await pool.query(`
            UPDATE productos
            SET
                codigo = $1,
                nombre = $2,
                tipo = $3,
                unidad = $4,
                activo = $5
            WHERE id = $6
            RETURNING *
        `, [
            codigo,
            nombre,
            tipo,
            unidad,
            activo,
            id
        ]);

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        if (error.code === "23505") {

            return res.status(400).json({
                error: "El código del producto ya existe"
            });
        }

        res.status(500).json({
            error: "Error al modificar producto"
        });
    }
};


// ======================================================
// ELIMINAR PRODUCTO
// ======================================================

const eliminarProducto = async (req, res) => {

    try {

        const id = req.params.id;

        const resultado = await pool.query(`
            DELETE FROM productos
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        res.json({
            mensaje: "Producto eliminado correctamente"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al eliminar producto"
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