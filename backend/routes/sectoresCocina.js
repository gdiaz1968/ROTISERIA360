const express = require("express");
const router = express.Router();
const { listarSectores, crearSector } = require("../controllers/sectoresCocinaController");

router.get("/", listarSectores);
router.post("/", crearSector);

module.exports = router;
