
const comprasService = require("../services/comprasService");

function responderError(res, error) {
  console.error("Error en Compras/Stock:", error);

  res.status(error.status || 400).json({
    error: error.message || "Error interno al procesar la operación."
  });
}

async function listar(req, res) {
  try {
    const datos = await comprasService.listarCompras();
    res.json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

async function obtener(req, res) {
  try {
    const datos = await comprasService.obtenerCompra(req.params.id);
    res.json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

async function crear(req, res) {
  try {
    const datos = await comprasService.crearCompra(req.body);
    res.status(201).json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

async function confirmar(req, res) {
  try {
    const datos = await comprasService.confirmarCompra(req.params.id);
    res.json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

async function anular(req, res) {
  try {
    const datos = await comprasService.anularCompra(req.params.id);
    res.json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

async function stock(req, res) {
  try {
    const datos = await comprasService.consultarStock();
    res.json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

async function movimientos(req, res) {
  try {
    const idProducto = req.query.id_producto || null;
    const datos = await comprasService.listarMovimientos(idProducto);
    res.json(datos);
  } catch (error) {
    responderError(res, error);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  confirmar,
  anular,
  stock,
  movimientos
};
