
const express = require("express");
const cors = require("cors");
const path = require("path");

const pool = require("./db");

// ==========================================
// IMPORTAR RUTAS
// ==========================================

const productosRoutes = require("./routes/productos");
const estructuraRoutes = require("./routes/estructura");
const costosRoutes = require("./routes/costos");
const unidadesRoutes = require("./routes/unidades");
const proveedoresRoutes = require("./routes/proveedores");
const presentacionesRoutes = require("./routes/presentaciones");
const preciosCompraRoutes = require("./routes/preciosCompra");
const comprasRoutes = require("./routes/compras");

// ==========================================
// CONFIGURACIÓN DEL SERVIDOR
// ==========================================

const app = express();

const PORT = process.env.PORT || 3032;

console.log("==========================================");
console.log("INICIO SERVER ROTISERIA360");
console.log("VERSION: COMPRAS Y STOCK");
console.log("PID NODE:", process.pid);
console.log("DIRECTORIO NODE:", process.cwd());
console.log("ARCHIVO SERVER:", __filename);
console.log("PUERTO:", PORT);
console.log("==========================================");

// ==========================================
// MIDDLEWARES GENERALES
// ==========================================

app.use(cors());

app.use(express.json());

// Registro de solicitudes recibidas
app.use(function (req, res, next) {
    console.log(
        ">>> REQUEST:",
        req.method,
        req.originalUrl
    );

    next();
});

// ==========================================
// RUTAS DE PRUEBA
// ==========================================

app.get("/api/prueba-version", function (req, res) {
    res.json({
        ok: true,
        mensaje: "SERVER.JS CORRECTO - COMPRAS Y STOCK"
    });
});

app.get("/api/costos-prueba-directa", function (req, res) {
    res.json({
        ok: true,
        mensaje: "Ruta COSTOS directa desde server.js funcionando"
    });
});

app.get("/api/prueba-directa", function (req, res) {
    console.log(">>> ENTRO A PRUEBA DIRECTA");

    res.json({
        ok: true,
        mensaje: "Ruta directa de server.js funcionando"
    });
});

app.get("/api/prueba-estructura", function (req, res) {
    console.log(">>> ENTRO A PRUEBA ESTRUCTURA");

    res.json({
        ok: true,
        mensaje: "Ruta estructura funcionando"
    });
});

app.get("/api/prueba-db", async function (req, res) {
    try {
        const resultado = await pool.query("SELECT NOW()");

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
});

// ==========================================
// RUTAS API
// IMPORTANTE: TODAS DEBEN IR ANTES DEL 404
// ==========================================

app.use("/api/productos", productosRoutes);

app.use("/api/unidades", unidadesRoutes);

app.use("/api/estructura", estructuraRoutes);

app.use("/api/costos", costosRoutes);

app.use("/api/proveedores", proveedoresRoutes);

app.use("/api/presentaciones", presentacionesRoutes);

app.use("/api/precios-compra", preciosCompraRoutes);

app.use("/api/compras", comprasRoutes);

// Confirmación de montaje de rutas
console.log("==========================================");
console.log("ROUTERS API MONTADOS");
console.log("PRODUCTOS");
console.log("UNIDADES");
console.log("ESTRUCTURA");
console.log("COSTOS");
console.log("PROVEEDORES");
console.log("PRESENTACIONES");
console.log("PRECIOS COMPRA");
console.log("COMPRAS");
console.log("==========================================");

// ==========================================
// ARCHIVOS ESTÁTICOS DE REACT
// ==========================================

app.use(
    express.static(
        path.join(__dirname, "../frontend-react/dist")
    )
);

// ==========================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ESTE MIDDLEWARE DEBE SER EL ÚLTIMO
// ==========================================

app.use(function (req, res) {

    // Las rutas API inexistentes devuelven JSON.
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

    // React recibe index.html para manejar
    // las rutas del frontend.
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

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, "0.0.0.0", function () {

    console.log("==========================================");
    console.log("SERVIDOR ROTISERIA360 INICIADO");
    console.log("PUERTO:", PORT);
    console.log("==========================================");

});
