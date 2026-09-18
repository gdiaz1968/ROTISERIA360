const express = require("express");

const router = express.Router();

const {
    listarProductos,
    obtenerProducto,
    crearProducto,
    modificarProducto,
    eliminarProducto
} = require("../controllers/productosController");


// GET /api/productos
router.get("/", listarProductos);


// GET /api/productos/5
router.get("/:id", obtenerProducto);


// POST /api/productos
router.post("/", crearProducto);


// PUT /api/productos/5
router.put("/:id", modificarProducto);


// DELETE /api/productos/5
router.delete("/:id", eliminarProducto);


module.exports = router;