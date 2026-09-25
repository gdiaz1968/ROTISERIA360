const {
    calcularCostoProducto
} = require("./services/costosService");

async function probar() {

    try {

        console.log("==========================================");
        console.log("PRUEBA MOTOR DE COSTOS");
        console.log("==========================================");


        // ==========================================
        // PRUEBA 1 - HARINA
        // ==========================================

        console.log("");
        console.log(">>> PRUEBA 1: HARINA");

        const harina =
            await calcularCostoProducto(14);

        console.log(
            JSON.stringify(
                harina,
                null,
                2
            )
        );


        // ==========================================
        // PRUEBA 2 - MASA
        // ==========================================

        console.log("");
        console.log(">>> PRUEBA 2: MASA PARA EMPANADA");

        const masa =
            await calcularCostoProducto(18);

        console.log(
            JSON.stringify(
                masa,
                null,
                2
            )
        );


        // ==========================================
        // PRUEBA 3 - EMPANADA
        // ==========================================

        console.log("");
        console.log(">>> PRUEBA 3: EMPANADA DE POLLO");

        const empanada =
            await calcularCostoProducto(19);

        console.log(
            JSON.stringify(
                empanada,
                null,
                2
            )
        );


        console.log("");
        console.log("==========================================");
        console.log("FIN PRUEBA MOTOR DE COSTOS");
        console.log("==========================================");

        process.exit(0);

    } catch (error) {

        console.error("");
        console.error("==========================================");
        console.error("ERROR MOTOR DE COSTOS");
        console.error("==========================================");

        console.error(
            error.message
        );

        console.error(
            error.stack
        );

        process.exit(1);

    }

}

probar();