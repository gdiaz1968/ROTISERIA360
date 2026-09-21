const express = require("express");
const cors = require("cors");
const path = require("path");

const pool = require("./db");

const productosRoutes = require("./routes/productos");
const estructuraRoutes = require("./routes/estructura");


const app = express();

// ======================================================
// PUERTO
// ======================================================

// Render proporciona process.env.PORT.
// En local, si no existe, utiliza el puerto 3000.

const PORT = process.env.PORT || 3000;


// ======================================================
// DIAGNOSTICO DEL PROCESO
// ======================================================

console.log("==========================================");
console.log("INICIO SERVER ROTISERIA360");
console.log("PID NODE:", process.pid);
console.log("DIRECTORIO NODE:", process.cwd());
console.log("ARCHIVO SERVER:", __filename);
console.log("PUERTO:", PORT);
console.log("==========================================");


// ======================================================
// MIDDLEWARES
// ======================================================

app.use(cors());

app.use(express.json());


// ======================================================
// DIAGNOSTICO DE REQUESTS
// ======================================================

app.use(function (req, res, next) {

    console.log(
        ">>> REQUEST:",
        req.method,
        req.originalUrl
    );

    next();

});


// ======================================================
// ARCHIVOS FRONTEND
// ======================================================

app.use(
    express.static(
        path.join(__dirname, "../frontend")
    )
);


// ======================================================
// RUTAS API
// ======================================================

app.use(
    "/api/productos",
    productosRoutes
);

app.use(
    "/api/estructura",
    estructuraRoutes
);

console.log("ROUTER PRODUCTOS MONTADO");
console.log("ROUTER ESTRUCTURA MONTADO");


// ======================================================
// PRUEBA DIRECTA
// ======================================================

app.get(
    "/api/prueba-directa",
    function (req, res) {

        console.log(">>> ENTRO A PRUEBA DIRECTA");

        res.json({
            ok: true,
            mensaje: "Ruta directa de server.js funcionando"
        });

    }
);


// ======================================================
// PRUEBA GENERAL DE ESTRUCTURA
// ======================================================

app.get(
    "/api/prueba-estructura",
    function (req, res) {

        console.log(">>> ENTRO A PRUEBA ESTRUCTURA");

        res.json({
            ok: true,
            mensaje: "Ruta estructura funcionando"
        });

    }
);


// ======================================================
// PRUEBA BASE DE DATOS
// ======================================================

app.get(
    "/api/prueba-db",
    async function (req, res) {

        try {

            const resultado = await pool.query(
                "SELECT NOW()"
            );

            res.json({
                ok: true,
                mensaje: "Conexión con PostgreSQL OK",
                fecha: resultado.rows[0].now
            });

        } catch (error) {

            console.error("ERROR POSTGRESQL:", error);

            res.status(500).json({
                ok: false,
                mensaje: "Error de conexión con PostgreSQL",
                error: error.message
            });

        }

    }
);


// ======================================================
// DIAGNOSTICO DE RUTAS NO ENCONTRADAS
// ======================================================

app.use(
    function (req, res) {

        console.log(
            "!!! RUTA NO ENCONTRADA:",
            req.method,
            req.originalUrl
        );

        res.status(404).json({
            ok: false,
            mensaje: "Ruta no encontrada",
            metodo: req.method,
            ruta: req.originalUrl
        });

    }
);


// ======================================================
// INICIAR SERVIDOR
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    function () {

        console.log("==========================================");

        console.log(
            "SERVIDOR ROTISERIA360 INICIADO"
        );

        console.log(
            "PUERTO:",
            PORT
        );

        console.log("==========================================");

    }
);