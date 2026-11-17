const express = require("express");
const router = express.Router();
const { listarVentas, crearVenta } = require("../controllers/ventasController");

router.get("/", listarVentas);
router.post("/", crearVenta);

module.exports = router;
