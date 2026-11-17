const express = require("express");
const router = express.Router();
const {
  listarProductosVenta,
  configurarProductoVenta
} = require("../controllers/productosVentaController");

router.get("/", listarProductosVenta);
router.put("/:idProducto", configurarProductoVenta);

module.exports = router;
