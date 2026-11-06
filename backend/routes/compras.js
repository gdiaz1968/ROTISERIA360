
const express = require("express");
const router = express.Router();

const comprasController = require("../controllers/comprasController");

router.get("/", comprasController.listar);
router.get("/stock", comprasController.stock);
router.get("/movimientos", comprasController.movimientos);
router.get("/:id", comprasController.obtener);

router.post("/", comprasController.crear);
router.post("/:id/confirmar", comprasController.confirmar);
router.post("/:id/anular", comprasController.anular);

module.exports = router;
