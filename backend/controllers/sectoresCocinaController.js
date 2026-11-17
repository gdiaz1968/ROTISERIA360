const pool = require("../db");

async function listarSectores(req, res) {
  try {
    const resultado = await pool.query(
      "SELECT id, nombre, descripcion, activo, fecha_alta FROM sectores_cocina ORDER BY activo DESC, nombre"
    );
    res.json({ sectores: resultado.rows });
  } catch (error) {
    console.error("Error al listar sectores de cocina:", error);
    res.status(500).json({ mensaje: "No se pudieron consultar los sectores." });
  }
}

async function crearSector(req, res) {
  const nombre = String(req.body?.nombre || "").trim().replace(/\\s+/g, " ").slice(0, 100);
  const descripcion = String(req.body?.descripcion || "").trim().slice(0, 500);

  if (!nombre) {
    return res.status(400).json({ mensaje: "Ingresá el nombre del sector." });
  }

  try {
    const resultado = await pool.query(
      "INSERT INTO sectores_cocina (nombre, descripcion, activo) VALUES ($1, $2, TRUE) RETURNING id, nombre, descripcion, activo, fecha_alta",
      [nombre, descripcion || null]
    );
    res.status(201).json({ mensaje: "Sector creado correctamente.", sector: resultado.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ mensaje: "Ya existe un sector con ese nombre." });
    }
    console.error("Error al crear sector:", error);
    res.status(500).json({ mensaje: "No se pudo crear el sector." });
  }
}

module.exports = { listarSectores, crearSector };
