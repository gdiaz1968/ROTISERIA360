const express = require("express");
const router = express.Router();
const {
  consultarComandas,
  actualizarEstadoComanda,
  registrarSolicitudImpresion
} = require("../controllers/comandasController");

router.get("/", consultarComandas);
router.get("/:id", consultarComandas);
router.patch("/:id/estado", actualizarEstadoComanda);
router.post("/:id/imprimir", registrarSolicitudImpresion);

module.exports = router;
