const express = require("express");
const cors = require("cors");
const path = require("path");

const pool = require("./db");


const productosRoutes = require("./routes/productos");
const estructuraRoutes = require("./routes/estructura");
const costosRoutes = require("./routes/costos");
const unidadesRoutes = require("./routes/unidades");
const proveedoresRoutes = require("./routes/proveedores");
const presentacionesRoutes = require("./routes/presentaciones");
const preciosCompraRoutes = require("./routes/preciosCompra");

const app = express();

console.log(">>> SERVER.JS CORRECTO - PRUEBA 3032");

const PORT = process.env.PORT || 3032;

console.log("==========================================");
console.log("INICIO SERVER ROTISERIA360");
console.log("PID NODE:", process.pid);
console.log("DIRECTORIO NODE:", process.cwd());
console.log("ARCHIVO SERVER:", __filename);
console.log("PUERTO:", PORT);
console.log("==========================================");

app.get(
    "/api/prueba-version",
    function (req, res) {
        res.json({
            ok: true,
            mensaje: "SERVER.JS CORRECTO - VERSION COSTOS"
        });
    }
);

app.use(cors());
app.use(express.json());

app.use(function (req, res, next) {
    console.log(
        ">>> REQUEST:",
        req.method,
        req.originalUrl
    );
    next();
});

app.use(
    express.static(
        path.join(__dirname, "../frontend-react/dist")
    )
);

app.use(
    "/api/productos",
    productosRoutes
);

app.use("/api/unidades", unidadesRoutes);

app.use(
    "/api/estructura",
    estructuraRoutes
);



app.get(
    "/api/costos-prueba-directa",
    function (req, res) {

        res.json({
            ok: true,
            mensaje: "Ruta COSTOS directa desde server.js funcionando"
        });

    }
);

app.use(
    "/api/costos",
    costosRoutes
);

app.use("/api/proveedores", proveedoresRoutes);

app.use("/api/presentaciones", presentacionesRoutes);

app.use("/api/precios-compra", preciosCompraRoutes);

console.log("ROUTER PRODUCTOS MONTADO");
console.log("ROUTER ESTRUCTURA MONTADO");
console.log("ROUTER COSTOS MONTADO");
console.log("ROUTER PROVEEDORES MONTADO");

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

            console.error(
                "ERROR POSTGRESQL:",
                error
            );

            res.status(500).json({
                ok: false,
                mensaje: "Error de conexión con PostgreSQL",
                error: error.message
            });
        }
    }
);

app.use(function (req, res) {

    // Las rutas de la API que no existen deben devolver JSON.
    if (req.originalUrl.startsWith("/api/")) {
        console.log(
            "!!! API NO ENCONTRADA:",
            req.method,
            req.originalUrl
        );

        return res.status(404).json({
            ok: false,
            mensaje: "Ruta API no encontrada",
            metodo: req.method,
            ruta: req.originalUrl
        });
    }

    // React debe recibir index.html para manejar sus rutas.
    if (req.method === "GET") {
        return res.sendFile(
            path.join(
                __dirname,
                "../frontend-react/dist/index.html"
            ),
            function (error) {
                if (error) {
                    console.error(
                        "ERROR AL SERVIR REACT:",
                        error
                    );

                    if (!res.headersSent) {
                        res.status(500).json({
                            ok: false,
                            mensaje: "No se pudo cargar el frontend React"
                        });
                    }
                }
            }
        );
    }

    return res.status(404).json({
        ok: false,
        mensaje: "Ruta no encontrada",
        metodo: req.method,
        ruta: req.originalUrl
    });
});

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
