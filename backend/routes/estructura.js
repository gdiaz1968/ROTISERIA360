const express = require("express");

const router = express.Router();

const {
    listarProductosElaborados,
    listarComponentes,
    crearEstructura
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

router.get("/prueba", function (req, res) {

    console.log(">>> ENTRO A GET /api/estructura/prueba");

    res.json({
        ok: true,
        mensaje: "Ruta estructura registrada"
    });

});


// ======================================================
// PRODUCTOS ELABORADOS
// ======================================================

router.get(
    "/productos",
    listarProductosElaborados
);


// ======================================================
// COMPONENTES
// ======================================================

router.get(
    "/componentes",
    listarComponentes
);


// ======================================================
// CREAR ESTRUCTURA
// ======================================================

router.post(
    "/",
    crearEstructura
);


module.exports = router;