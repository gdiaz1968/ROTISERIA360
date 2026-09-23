const express = require("express");

const router = express.Router();

const {
    listarProductosElaborados,
    listarComponentes,
    consultarEstructura,
    consultarEstructuraPorId,
    crearEstructura,
    modificarEstructura,
    eliminarEstructura
} = require("../controllers/estructuraController");


// ======================================================
// DIAGNOSTICO
// ======================================================

console.log("==========================================");
console.log("ESTRUCTURA.JS CARGADO");
console.log("ARCHIVO:", __filename);
console.log("==========================================");


// ======================================================
// PRUEBA
// ======================================================

router.get(
    "/prueba",
    function (req, res) {

        console.log(
            ">>> ENTRO A GET /api/estructura/prueba"
        );

        res.json({

            ok: true,

            mensaje:
                "Ruta estructura registrada"

        });

    }
);


// ======================================================
// PRODUCTOS ELABORADOS
// ======================================================
//
// GET /api/estructura/productos
//
// Devuelve los productos de tipo ELABORADO
// activos.
//
// ======================================================

router.get(
    "/productos",
    listarProductosElaborados
);


// ======================================================
// COMPONENTES
// ======================================================
//
// GET /api/estructura/componentes
//
// Devuelve los productos activos que pueden utilizarse
// como componentes.
//
// ======================================================

router.get(
    "/componentes",
    listarComponentes
);


// ======================================================
// CONSULTAR ESTRUCTURA POR ID DE PRODUCTO
// ======================================================
//
// GET /api/estructura/producto/:producto_id
//
// Devuelve la estructura ACTIVA del producto y
// todos sus componentes activos.
//
// Ejemplo:
//
// GET /api/estructura/producto/10
//
// ======================================================

router.get(
    "/producto/:producto_id",
    consultarEstructura
);


// ======================================================
// CONSULTAR ESTRUCTURA POR ID DE ESTRUCTURA
// ======================================================
//
// GET /api/estructura/id/:id
//
// Devuelve una estructura específica por su ID.
//
// Esto permite consultar también estructuras
// históricas/inactivas.
//
// Ejemplo:
//
// GET /api/estructura/id/25
//
// ======================================================

router.get(
    "/id/:id",
    consultarEstructuraPorId
);


// ======================================================
// CREAR ESTRUCTURA
// ======================================================
//
// POST /api/estructura
//
// Crea una nueva estructura.
//
// La operación corresponde al ALTA.
//
// ======================================================

router.post(
    "/",
    crearEstructura
);


// ======================================================
// MODIFICAR ESTRUCTURA
// ======================================================
//
// PUT /api/estructura/:id
//
// IMPORTANTE:
//
// No modifica físicamente la estructura existente.
//
// La estructura actual se desactiva y se genera
// una nueva versión activa.
//
// Ejemplo:
//
// PUT /api/estructura/15
//
// ======================================================

router.put(
    "/:id",
    modificarEstructura
);


// ======================================================
// BAJA LOGICA DE ESTRUCTURA
// ======================================================
//
// DELETE /api/estructura/:id
//
// IMPORTANTE:
//
// No elimina físicamente.
//
// Cambia:
//
// activo = TRUE
//
// por:
//
// activo = FALSE
//
// También desactiva sus detalles.
//
// ======================================================

router.delete(
    "/:id",
    eliminarEstructura
);


// ======================================================
// EXPORTAR ROUTER
// ======================================================

module.exports = router;