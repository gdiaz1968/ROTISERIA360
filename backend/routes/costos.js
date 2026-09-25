
const express = require("express");

console.log(">>> CARGANDO ROUTER COSTOS");

const {
    calcularCostoProducto
} = require("../services/costosService");

const router = express.Router();

router.get(
    "/prueba",
    function (req, res) {

        res.json({
            ok: true,
            mensaje: "Router COSTOS funcionando"
        });

    }
);


// ======================================================
// CALCULAR COSTO DE UN PRODUCTO
// ======================================================
//
// GET /api/costos/calcular/:id
//
// Ejemplo:
//
// /api/costos/calcular/14
// /api/costos/calcular/18
// /api/costos/calcular/19
//
// ======================================================

router.get(
    "/calcular/:id",
    async function (req, res) {

        try {

            const idProducto =
                Number(req.params.id);

            if (!Number.isInteger(idProducto) ||
                idProducto <= 0) {

                return res.status(400).json({
                    ok: false,
                    mensaje:
                        "El ID del producto no es válido."
                });
            }

            console.log(
                ">>> CALCULANDO COSTO PRODUCTO:",
                idProducto
            );

            const resultado =
                await calcularCostoProducto(
                    idProducto
                );

            res.json({
                ok: true,
                resultado: resultado
            });

        } catch (error) {

            console.error(
                "ERROR CALCULANDO COSTO:",
                error
            );

            res.status(400).json({
                ok: false,
                mensaje: error.message
            });
        }
    }
);


// ======================================================
// CONSULTAR COSTO DE UN PRODUCTO
// ======================================================
//
// GET /api/costos/producto/:id
//
// Por ahora utiliza el mismo motor de cálculo.
//
// Se deja separado para poder diferenciar posteriormente:
//
// - calcular
// - consultar
// - historial
// - costos registrados
//
// ======================================================

router.get(
    "/producto/:id",
    async function (req, res) {

        try {

            const idProducto =
                Number(req.params.id);

            if (!Number.isInteger(idProducto) ||
                idProducto <= 0) {

                return res.status(400).json({
                    ok: false,
                    mensaje:
                        "El ID del producto no es válido."
                });
            }

            const resultado =
                await calcularCostoProducto(
                    idProducto
                );

            res.json({
                ok: true,
                resultado: resultado
            });

        } catch (error) {

            console.error(
                "ERROR CONSULTANDO COSTO:",
                error
            );

            res.status(400).json({
                ok: false,
                mensaje: error.message
            });
        }
    }
);


module.exports = router;