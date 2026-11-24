const { registrarActividad } = require("../services/auditoriaService");

const METODOS_DE_ESCRITURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Registra operaciones de escritura y respuestas fallidas de la API.
 * No persiste valores del body, query string, contraseñas ni tokens.
 */
function auditoriaMiddleware(req, res, next) {
    if (!req.originalUrl.startsWith("/api/")) {
        return next();
    }

    const inicio = Date.now();
    const metodo = String(req.method || "").toUpperCase();

    res.once("finish", function () {
        const estadoHttp = res.statusCode;
        const operacionDeEscritura = METODOS_DE_ESCRITURA.has(metodo);
        const respuestaFallida = estadoHttp >= 400;

        // Los GET correctos no generan ruido; los GET fallidos sí quedan auditados.
        if (!operacionDeEscritura && !respuestaFallida) {
            return;
        }

        const ruta = String(req.originalUrl || "").split("?")[0];
        const partes = ruta.split("/").filter(Boolean);
        const modulo = partes[1] || "api";

        let resultado = "OK";
        if (estadoHttp >= 400) {
            resultado = "ERROR";
        } else if (estadoHttp >= 300) {
            resultado = "ADVERTENCIA";
        }

        const usuarioActual = req.user || req.usuario || null;
        const usuario = usuarioActual
            ? (usuarioActual.usuario || usuarioActual.username || usuarioActual.nombre || null)
            : null;
        const usuarioId = usuarioActual && usuarioActual.id != null
            ? usuarioActual.id
            : null;

        void registrarActividad({
            usuarioId,
            usuario,
            sesionId: null,
            modulo,
            pantalla: null,
            accion: metodo + " " + ruta,
            entidad: null,
            entidadId: null,
            metodoHttp: metodo,
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
