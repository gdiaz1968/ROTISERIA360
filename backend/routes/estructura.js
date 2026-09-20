    const express = require("express");

    const router = express.Router();

    const {
        listarProductosElaborados,
        listarComponentes,
        crearEstructura
    } = require("../controllers/estructuraController");


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