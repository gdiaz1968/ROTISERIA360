const pool = require("../db");

// ======================================================
// LISTAR PROVEEDORES
// ======================================================

const listarProveedores = async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                cuit,
                telefono,
                email,
                direccion,
                activo,
                fecha_alta
            FROM proveedores
            WHERE activo = TRUE
            ORDER BY codigo, nombre
        `);

        res.json(resultado.rows);

    }
    catch (error) {

        console.error("Error al consultar proveedores:", error);

        res.status(500).json({
            error: "Error al consultar proveedores"
        });

    }

};


// ======================================================
// OBTENER PROVEEDOR
// ======================================================

const obtenerProveedor = async (req, res) => {

    try {

        const { id } = req.params;

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                cuit,
                telefono,
                email,
                direccion,
                activo,
                fecha_alta
            FROM proveedores
            WHERE id = $1
        `, [id]);

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                error: "Proveedor no encontrado"
            });

        }

        res.json(resultado.rows[0]);

    }
    catch (error) {

        console.error("Error al obtener proveedor:", error);

        res.status(500).json({
            error: "Error al obtener proveedor"
        });

    }

};


// ======================================================
// CREAR PROVEEDOR
// ======================================================

const crearProveedor = async (req, res) => {

    try {

        const {
            codigo,
            nombre,
            cuit,
            telefono,
            email,
            direccion
        } = req.body;


        if (!codigo || !nombre) {

            return res.status(400).json({
                error: "El código y el nombre del proveedor son obligatorios"
            });

        }


        const resultado = await pool.query(`
            INSERT INTO proveedores
            (
                codigo,
                nombre,
                cuit,
                telefono,
                email,
                direccion,
                activo
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                TRUE
            )
            RETURNING *
        `, [
            codigo,
            nombre,
            cuit || null,
            telefono || null,
            email || null,
            direccion || null
        ]);


        res.status(201).json(resultado.rows[0]);

    }
    catch (error) {

        console.error("Error al crear proveedor:", error);


        if (error.code === "23505") {

            return res.status(400).json({
                error: "El código del proveedor ya existe"
            });

        }


        res.status(500).json({
            error: "Error al crear proveedor"
        });

    }

};


// ======================================================
// MODIFICAR PROVEEDOR
// ======================================================

const modificarProveedor = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            codigo,
            nombre,
            cuit,
            telefono,
            email,
            direccion,
            activo
        } = req.body;


        if (!codigo || !nombre) {

            return res.status(400).json({
                error: "El código y el nombre del proveedor son obligatorios"
            });

        }


        const resultado = await pool.query(`
            UPDATE proveedores
            SET
                codigo = $1,
                nombre = $2,
                cuit = $3,
                telefono = $4,
                email = $5,
                direccion = $6,
                activo = $7
            WHERE id = $8
            RETURNING *
        `, [
            codigo,
            nombre,
            cuit || null,
            telefono || null,
            email || null,
            direccion || null,
            activo !== false,
            id
        ]);


        if (resultado.rows.length === 0) {

            return res.status(404).json({
                error: "Proveedor no encontrado"
            });

        }


        res.json(resultado.rows[0]);

    }
    catch (error) {

        console.error("Error al modificar proveedor:", error);


        if (error.code === "23505") {

            return res.status(400).json({
                error: "El código del proveedor ya existe"
            });

        }


        res.status(500).json({
            error: "Error al modificar proveedor"
        });

    }

};


// ======================================================
// BAJA LOGICA
// ======================================================

const eliminarProveedor = async (req, res) => {

    try {

        const { id } = req.params;


        const resultado = await pool.query(`
            UPDATE proveedores
            SET activo = FALSE
            WHERE id = $1
              AND activo = TRUE
            RETURNING *
        `, [id]);


        if (resultado.rows.length === 0) {

            return res.status(404).json({
                error: "Proveedor no encontrado o ya está inactivo"
            });

        }


        res.json({
            mensaje: "Proveedor dado de baja logicamente correctamente",
            proveedor: resultado.rows[0]
        });

    }
    catch (error) {

        console.error("Error al dar de baja proveedor:", error);

        res.status(500).json({
            error: "Error al dar de baja el proveedor"
        });

    }

};


// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    modificarProveedor,
    eliminarProveedor
};