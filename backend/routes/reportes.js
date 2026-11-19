const express = require("express");
const router = express.Router();
const { reporteVentas } = require("../controllers/reportesVentasController");

router.get("/ventas", reporteVentas);

module.exports = router;
