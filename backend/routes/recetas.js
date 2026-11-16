const express = require("express");

const router = express.Router();

const {
    listarProductosElaborados,
    listarComponentes,
    listarReporteRecetas,
    consultarReceta,
    consultarRecetaPorId,
    crearReceta,
    modificarReceta,
    eliminarReceta
} = require("../controllers/recetasController");


// ======================================================
// DIAGNOSTICO
// ======================================================

console.log("==========================================");
console.log("RECETAS.JS CARGADO");
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
                "Ruta de recetas registrada"

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
// REPORTE DE TODAS LAS RECETAS Y SUS VERSIONES
// ======================================================
//
// GET /api/estructura/reporte
//
// Incluye recetas activas e inactivas y todos sus
// componentes, sin filtrar por el estado del detalle.
//
// ======================================================

router.get(
    "/reporte",
    listarReporteRecetas
);


// ======================================================
// CONSULTAR RECETA POR ID DE PRODUCTO
// ======================================================
//
// GET /api/estructura/producto/:producto_id
//
// Devuelve la receta ACTIVA del producto y
// todos sus componentes activos.
//
// Ejemplo:
//
// GET /api/estructura/producto/10
//
// ======================================================

router.get(
    "/producto/:producto_id",
    consultarReceta
);


// ======================================================
// CONSULTAR RECETA POR ID DE ESTRUCTURA
// ======================================================
//
// GET /api/estructura/id/:id
//
// Devuelve una receta específica por su ID.
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
    consultarRecetaPorId
);


// ======================================================
// CREAR RECETA
// ======================================================
//
// POST /api/estructura
//
// Crea una nueva receta.
//
// La operación corresponde al ALTA.
//
// ======================================================

router.post(
    "/",
    crearReceta
);


// ======================================================
// MODIFICAR RECETA
// ======================================================
//
// PUT /api/estructura/:id
//
// IMPORTANTE:
//
// No modifica físicamente la receta existente.
//
// La receta actual se desactiva y se genera
// una nueva versión activa.
//
// Ejemplo:
//
// PUT /api/estructura/15
//
// ======================================================

router.put(
    "/:id",
    modificarReceta
);


// ======================================================
// BAJA LOGICA DE RECETA
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
    eliminarReceta
);


// ======================================================
// EXPORTAR ROUTER
// ======================================================

module.exports = router;