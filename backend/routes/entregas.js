const express = require("express");
const router = express.Router();
const {
  listarPedidosEntrega,
  listarRepartidores,
  crearRepartidor,
  crearReparto,
  confirmarEntrega
} = require("../controllers/entregasController");

router.get("/pedidos", listarPedidosEntrega);
router.get("/repartidores", listarRepartidores);
router.post("/repartidores", crearRepartidor);
router.post("/repartos", crearReparto);
router.post("/:id/confirmar", confirmarEntrega);

module.exports = router;
