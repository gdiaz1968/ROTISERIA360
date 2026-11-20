const { registrarActividad } = require("../services/auditoriaService");

/**
 * Registra automáticamente el resultado de cada solicitud /api.
 * No guarda query strings, cuerpos, contraseñas ni tokens.
 */
function auditoriaMiddleware(req, res, next) {
    if (!req.originalUrl.startsWith("/api/")) {
        return next();
    }

    const inicio = Date.now();

    res.on("finish", function () {
        const ruta = (req.originalUrl || "").split("?")[0];
        const partes = ruta.split("/").filter(Boolean);
        const modulo = partes[1] || "api";
        const estadoHttp = res.statusCode;

        let resultado = "OK";
        if (estadoHttp >= 500) {
            resultado = "ERROR";
        } else if (estadoHttp >= 400) {
            resultado = "ADVERTENCIA";
        }

        // req.user queda preparado para integrarse con autenticación cuando exista.
        const usuario = req.user
            ? (req.user.usuario || req.user.username || null)
            : null;
        const usuarioId = req.user && req.user.id
            ? req.user.id
            : null;

        registrarActividad({
            usuarioId,
            usuario,
            sesionId: null,
            modulo,
            pantalla: null,
            accion: req.method + " " + ruta,
            entidad: null,
            entidadId: null,
            metodoHttp: req.method,
            ruta,
            resultado,
            duracionMs: Date.now() - inicio,
            ip: req.ip || null,
            userAgent: req.get("user-agent") || null,
            detalle: {
                estado_http: estadoHttp
            }
        });
    });

    next();
}

module.exports = auditoriaMiddleware;
