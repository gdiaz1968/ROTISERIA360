const express = require("express");

const router = express.Router();

const {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    modificarProveedor,
    eliminarProveedor
} = require("../controllers/proveedoresController");


// ======================================================
// RUTAS
// ======================================================

router.get("/", listarProveedores);

router.get("/:id", obtenerProveedor);

router.post("/", crearProveedor);

router.put("/:id", modificarProveedor);

router.delete("/:id", eliminarProveedor);


module.exports = router;