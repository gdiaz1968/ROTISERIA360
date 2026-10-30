
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

// Cargar variables desde backend/.env
const resultadoEnv = dotenv.config({
    path: path.join(__dirname, ".env")
});

if (resultadoEnv.error) {
    console.error("ERROR CARGANDO backend/.env:", resultadoEnv.error.message);
} else {
    console.log("VARIABLES DE ENTORNO CARGADAS:", Object.keys(resultadoEnv.parsed || {}).length);
}

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida en backend/.env");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

module.exports = pool;
