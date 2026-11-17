const express = require("express");
const router = express.Router();

const {
  listarProductosVenta,
  configurarProductoVenta,
  obtenerConfiguracionComercial,
  actualizarConfiguracionComercial
} = require("../controllers/productosVentaController");

router.get("/configuracion", obtenerConfiguracionComercial);
router.put("/configuracion", actualizarConfiguracionComercial);
router.get("/", listarProductosVenta);
router.put("/:idProducto", configurarProductoVenta);

module.exports = router;
