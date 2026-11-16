const express = require("express");

const router = express.Router();

const {
    listarPresentaciones,
    listarReportePresentaciones,
    obtenerPresentacion,
    crearPresentacion,
    modificarPresentacion,
    eliminarPresentacion
} = require("../controllers/presentacionesController");


// El reporte general debe declararse antes de la ruta dinámica /:id.
router.get(
    "/reporte",
    listarReportePresentaciones
);


// IMPORTANTE:
// Esta ruta debe estar antes de /:id

router.get(
    "/producto/:id",
    listarPresentaciones
);

router.get(
    "/:id",
    obtenerPresentacion
);

router.post(
    "/",
    crearPresentacion
);

router.put(
    "/:id",
    modificarPresentacion
);

router.delete(
    "/:id",
    eliminarPresentacion
);


module.exports = router;