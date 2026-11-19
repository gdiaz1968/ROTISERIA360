const express = require("express");
const router = express.Router();
const {
  consultarComandas,
  actualizarEstadoComanda,
  previsualizarAnulacionComanda,
  anularComanda,
  registrarSolicitudImpresion
} = require("../controllers/comandasController");

router.get("/", consultarComandas);
router.get("/:id", consultarComandas);
router.patch("/:id/estado", actualizarEstadoComanda);
router.get("/:id/anulacion/preview", previsualizarAnulacionComanda);
router.post("/:id/anulacion", anularComanda);
router.post("/:id/imprimir", registrarSolicitudImpresion);

module.exports = router;
