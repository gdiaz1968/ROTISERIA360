const express = require("express");

const router = express.Router();

const {
listarPreciosCompra,
listarPreciosPresentacion,
obtenerPrecioCompra,
crearPrecioCompra,
modificarPrecioCompra,
eliminarPrecioCompra
} = require("../controllers/preciosCompraController");

// ============================================================
// LISTAR TODOS LOS PRECIOS
// ============================================================

router.get(
"/",
listarPreciosCompra
);

// ============================================================
// LISTAR PRECIOS DE UNA PRESENTACIÓN
// IMPORTANTE:
// Debe estar antes de /:id
// ============================================================

router.get(
"/presentacion/:id",
listarPreciosPresentacion
);

// ============================================================
// OBTENER UN PRECIO
// ============================================================

router.get(
"/:id",
obtenerPrecioCompra
);

// ============================================================
// CREAR PRECIO
// ============================================================

router.post(
"/",
crearPrecioCompra
);

// ============================================================
// MODIFICAR PRECIO
// ============================================================

router.put(
"/:id",
modificarPrecioCompra
);

// ============================================================
// ELIMINAR PRECIO
// ============================================================

router.delete(
"/:id",
eliminarPrecioCompra
);

module.exports = router;
