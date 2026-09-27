const express = require("express");
const router = express.Router();

const pool = require("../db");

// GET /api/unidades
const listarUnidades = async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                id,
                codigo,
                nombre,
                tipo
            FROM unidades_medida
            WHERE activo = TRUE
            ORDER BY id
        `);

        res.json(resultado.rows);

    } catch (error) {

        console.error("Error al listar unidades:", error);

        res.status(500).json({
            error: "Error al obtener las unidades de medida"
        });
    }
};

router.get("/", listarUnidades);

module.exports = router;