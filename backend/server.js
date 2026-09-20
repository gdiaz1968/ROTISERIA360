const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./db");
const productosRoutes = require("./routes/productos");
const estructuraRoutes = require("./routes/estructura");



const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));

app.use("/api/productos", productosRoutes);
app.use("/api/estructura", estructuraRoutes);

app.get("/api/prueba-estructura", (req, res) => {
    res.json({
        mensaje: "Ruta estructura funcionando"
    });
});

app.get("/api/prueba-db", async (req, res) => {
    try {
        const resultado = await pool.query("SELECT NOW()");

        res.json({
            mensaje: "Conexión con PostgreSQL OK",
            fecha: resultado.rows[0].now
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: "Error de conexión con PostgreSQL",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log("Servidor ROTISERIA360 iniciado en http://localhost:3000");
});