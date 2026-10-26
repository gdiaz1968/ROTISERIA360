const express = require("express");

console.log(">>> CARGANDO ROUTER COSTOS");

const {
    calcularCostoProducto,
    listarInsumos,
    obtenerCostoInsumo,
    registrarCostoInsumo,
    listarHistorialCosto,
    obtenerEstructuraProducto,
    obtenerEstructuraConCostos
} = require("../services/costosService");

const router = express.Router();


// ==========================================================
// PRUEBA
// ==========================================================

router.get("/prueba", function (req, res) {
    res.json({
        ok: true,
        mensaje: "Router COSTOS funcionando"
    });
});


// ==========================================================
// LISTAR INSUMOS
// ==========================================================

router.get("/insumos", async function (req, res) {
    try {
        const resultado = await listarInsumos();

        res.json({
            ok: true,
            insumos: resultado
        });

    } catch (error) {
        console.error("ERROR LISTANDO INSUMOS:", error);

        res.status(500).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// OBTENER COSTO ACTUAL DE UN INSUMO
// ==========================================================

router.get("/insumo/:id", async function (req, res) {
    try {
        const idProducto = Number(req.params.id);

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El ID del producto no es válido."
            });
        }

        const resultado = await obtenerCostoInsumo(idProducto);

        res.json({
            ok: true,
            resultado
        });

    } catch (error) {
        console.error("ERROR CONSULTANDO COSTO INSUMO:", error);

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// HISTORIAL DE COSTOS
// ==========================================================

router.get("/insumo/:id/historial", async function (req, res) {
    try {
        const idProducto = Number(req.params.id);

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El ID del producto no es válido."
            });
        }

        const resultado = await listarHistorialCosto(idProducto);

        res.json({
            ok: true,
            historial: resultado
        });

    } catch (error) {
        console.error("ERROR CONSULTANDO HISTORIAL:", error);

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// REGISTRAR NUEVO COSTO DE INSUMO
// ==========================================================

router.post("/insumo", async function (req, res) {
    try {
        const {
            id_producto,
            costo,
            factor_ajuste
        } = req.body;

        const idProducto = Number(id_producto);
        const costoNumerico = Number(costo);

        // Mantener compatibilidad con solicitudes anteriores:
        // si no se envía el factor, se utiliza 1.
        const factorNumerico =
            factor_ajuste === undefined ||
            factor_ajuste === null ||
            factor_ajuste === ""
                ? 1
                : Number(factor_ajuste);


        // Validar producto.

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El producto no es válido."
            });
        }


        // Validar costo base.

        if (
            costo === undefined ||
            costo === null ||
            costo === "" ||
            !Number.isFinite(costoNumerico) ||
            costoNumerico < 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El costo base no es válido."
            });
        }


        // Validar factor de ajuste.

        if (
            !Number.isFinite(factorNumerico) ||
            factorNumerico <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El factor de ajuste debe ser un número mayor que cero."
            });
        }


        // Registrar costo base y factor de ajuste.

        const resultado = await registrarCostoInsumo(
            idProducto,
            costoNumerico,
            factorNumerico
        );


        res.status(201).json({
            ok: true,
            mensaje: "Costo registrado correctamente.",
            resultado
        });

    } catch (error) {
        console.error("ERROR REGISTRANDO COSTO:", error);

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// OBTENER ESTRUCTURA DE PRODUCTO
// ==========================================================

router.get("/estructura/:id", async function (req, res) {
    try {
        const idProducto = Number(req.params.id);

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El ID del producto no es válido."
            });
        }

        console.log(
            ">>> CONSULTANDO ESTRUCTURA PRODUCTO:",
            idProducto
        );

        const resultado = await obtenerEstructuraProducto(idProducto);

        res.json({
            ok: true,
            resultado
        });

    } catch (error) {
        console.error("ERROR CONSULTANDO ESTRUCTURA:", error);

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// ESTRUCTURA + COSTO COMPLETO
// ==========================================================

router.get("/estructura/:id/costos", async function (req, res) {
    try {
        const idProducto = Number(req.params.id);

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "ID de producto inválido."
            });
        }

        console.log(
            ">>> CALCULANDO COSTO DESDE ESTRUCTURA:",
            idProducto
        );

        const resultado = await calcularCostoProducto(idProducto);

        res.json({
            ok: true,
            resultado
        });

    } catch (error) {
        console.error(
            "ERROR CALCULANDO COSTO DESDE ESTRUCTURA:",
            error
        );

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// CALCULAR COSTO DE PRODUCTO
// ==========================================================

router.get("/calcular/:id", async function (req, res) {
    try {
        const idProducto = Number(req.params.id);

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El ID del producto no es válido."
            });
        }

        console.log(
            ">>> CALCULANDO COSTO PRODUCTO:",
            idProducto
        );

        const resultado = await calcularCostoProducto(idProducto);

        res.json({
            ok: true,
            resultado
        });

    } catch (error) {
        console.error("ERROR CALCULANDO COSTO:", error);

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


// ==========================================================
// CONSULTAR COSTO DE PRODUCTO
// ==========================================================

router.get("/producto/:id", async function (req, res) {
    try {
        const idProducto = Number(req.params.id);

        if (
            !Number.isInteger(idProducto) ||
            idProducto <= 0
        ) {
            return res.status(400).json({
                ok: false,
                mensaje: "El ID del producto no es válido."
            });
        }

        const resultado = await calcularCostoProducto(idProducto);

        res.json({
            ok: true,
            resultado
        });

    } catch (error) {
        console.error("ERROR CONSULTANDO COSTO:", error);

        res.status(400).json({
            ok: false,
            mensaje: error.message
        });
    }
});


module.exports = router;
