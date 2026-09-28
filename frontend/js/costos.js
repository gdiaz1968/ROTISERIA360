// ======================================================
// ROTISERIA360
// COSTOS
// PASO 2 - MOSTRAR ESTRUCTURA Y COSTOS
// ======================================================


let productosCostos = [];


// ======================================================
// INICIO
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarProductosCostos();

        document
            .getElementById("costos-producto")
            .addEventListener(
                "change",
                seleccionarProductoCosto
            );

        document
            .getElementById("btn-calcular-costo")
            .addEventListener(
                "click",
                consultarCosto
            );

        document
            .getElementById("btn-limpiar-costo")
            .addEventListener(
                "click",
                limpiarCosto
            );

    }
);


// ======================================================
// CARGAR PRODUCTOS
// ======================================================

async function cargarProductosCostos() {

    try {

        const respuesta =
            await fetch("/api/productos");


        if (!respuesta.ok) {

            throw new Error(
                "No se pudieron cargar los productos."
            );

        }


        const datos =
            await respuesta.json();


        if (Array.isArray(datos)) {

            productosCostos = datos;

        } else {

            productosCostos =
                datos.productos || [];

        }


        const combo =
            document.getElementById(
                "costos-producto"
            );


        combo.innerHTML = `
            <option value="">
                Seleccionar producto...
            </option>
        `;


        productosCostos.forEach(
            function (producto) {

                if (
                    producto.activo === false
                ) {

                    return;

                }


                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    producto.id;


                opcion.textContent =
                    producto.codigo +
                    " - " +
                    producto.nombre;


                combo.appendChild(
                    opcion
                );

            }
        );


    } catch (error) {

        console.error(
            error
        );


        mostrarMensajeCosto(
            error.message,
            "error"
        );

    }

}


// ======================================================
// SELECCIONAR PRODUCTO
// ======================================================

function seleccionarProductoCosto() {

    const combo =
        document.getElementById(
            "costos-producto"
        );


    const id =
        Number(
            combo.value
        );


    if (!id) {

        limpiarDatosProducto();

        limpiarResultado();

        return;

    }


    const producto =
        productosCostos.find(
            function (item) {

                return Number(item.id) === id;

            }
        );


    if (!producto) {

        limpiarDatosProducto();

        limpiarResultado();

        return;

    }


    document.getElementById(
        "costos-codigo"
    ).value =
        producto.codigo || "";


    document.getElementById(
        "costos-nombre"
    ).value =
        producto.nombre || "";


    document.getElementById(
        "costos-tipo"
    ).value =
        producto.tipo || "";


    document.getElementById(
        "costos-unidad"
    ).value =
        producto.unidad || "";


    limpiarResultado();

}


// ======================================================
// CONSULTAR COSTO
// ======================================================

async function consultarCosto() {

    const id =
        Number(
            document.getElementById(
                "costos-producto"
            ).value
        );


    if (!id) {

        mostrarMensajeCosto(
            "Seleccione un producto.",
            "error"
        );

        return;

    }


    mostrarMensajeCosto(
        "Consultando estructura...",
        "info"
    );


    try {

        const respuesta =
            await fetch(
                "/api/costos/estructura/" +
                id +
                "/costos"
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.mensaje ||
                "No se pudo consultar la estructura."
            );

        }


        mostrarResultado(
            datos.resultado
        );


        mostrarMensajeCosto(
            "Estructura consultada correctamente.",
            "ok"
        );


    } catch (error) {

        console.error(
            "ERROR:",
            error
        );


        mostrarMensajeCosto(
            error.message,
            "error"
        );

    }

}


// ======================================================
// MOSTRAR RESULTADO
// ======================================================

function mostrarResultado(
    resultado
) {

    if (!resultado) {

        return;

    }


    // --------------------------------------------------
    // PRODUCTO
    // --------------------------------------------------

    if (resultado.producto) {

        document.getElementById(
            "costos-codigo"
        ).value =
            resultado.producto.codigo || "";


        document.getElementById(
            "costos-nombre"
        ).value =
            resultado.producto.nombre || "";


        document.getElementById(
            "costos-tipo"
        ).value =
            resultado.producto.tipo || "";


        document.getElementById(
            "costos-unidad"
        ).value =
            resultado.producto.unidad || "";

    }


    // --------------------------------------------------
    // RENDIMIENTO
    // --------------------------------------------------

    if (resultado.estructura) {

        const rendimiento =
            resultado.estructura.rendimiento;


        const unidad =
            resultado.estructura.unidad_rendimiento ||
            "";


        if (
            rendimiento !== null &&
            rendimiento !== undefined
        ) {

            document.getElementById(
                "costos-rendimiento"
            ).textContent =
                Number(
                    rendimiento
                ).toLocaleString(
                    "es-AR",
                    {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3
                    }
                ) +
                (
                    unidad
                        ? " " + unidad
                        : ""
                );

        }

    }


    // --------------------------------------------------
    // DETALLE
    // --------------------------------------------------

    mostrarDetalle(
        resultado.detalle || []
    );


    // --------------------------------------------------
    // POR AHORA NO CALCULAMOS
    // --------------------------------------------------

    document.getElementById(
        "costos-costo-unitario"
    ).textContent =
        "-";


    document.getElementById(
        "costos-costo-total"
    ).textContent =
        "-";

}


// ======================================================
// MOSTRAR DETALLE
// ======================================================

function mostrarDetalle(
    detalle
) {

    const tabla =
        document.getElementById(
            "tablaCostos"
        );


    tabla.innerHTML = "";


    if (
        !detalle ||
        detalle.length === 0
    ) {

        tabla.innerHTML = `
            <tr>
                <td colspan="9">
                    No hay componentes en la estructura.
                </td>
            </tr>
        `;

        return;

    }


    detalle.forEach(
        function (item) {

            const fila =
                document.createElement(
                    "tr"
                );


            const costo =
                item.costo_unitario;


            let textoCosto =
                "Sin costo";


            if (
                costo !== null &&
                costo !== undefined &&
                costo !== ""
            ) {

                textoCosto =
                    formatearMoneda(
                        costo
                    );

            }


            fila.innerHTML = `

                <td>
                    ${item.codigo || ""}
                </td>

                <td>
                    ${item.nombre || ""}
                </td>

                <td>
                    ${item.tipo || ""}
                </td>

                <td>
                    ${item.unidad || ""}
                </td>

                <td>
                    ${formatearNumero(
                        item.cantidad
                    )}
                </td>

                <td>
                    ${formatearNumero(
                        item.merma
                    )}
                </td>

                <td>
                    -
                </td>

                <td>
                    ${textoCosto}
                </td>

                <td>
                    -
                </td>

            `;


            tabla.appendChild(
                fila
            );

        }
    );

}


// ======================================================
// LIMPIAR
// ======================================================

function limpiarCosto() {

    document.getElementById(
        "costos-producto"
    ).value = "";


    limpiarDatosProducto();

    limpiarResultado();


    mostrarMensajeCosto(
        "",
        ""
    );

}


// ======================================================
// LIMPIAR DATOS DEL PRODUCTO
// ======================================================

function limpiarDatosProducto() {

    document.getElementById(
        "costos-codigo"
    ).value = "";


    document.getElementById(
        "costos-nombre"
    ).value = "";


    document.getElementById(
        "costos-tipo"
    ).value = "";


    document.getElementById(
        "costos-unidad"
    ).value = "";

}


// ======================================================
// LIMPIAR RESULTADO
// ======================================================

function limpiarResultado() {

    document.getElementById(
        "tablaCostos"
    ).innerHTML = "";


    document.getElementById(
        "costos-rendimiento"
    ).textContent = "-";


    document.getElementById(
        "costos-costo-unitario"
    ).textContent = "-";


    document.getElementById(
        "costos-costo-total"
    ).textContent = "-";

}


// ======================================================
// MENSAJE
// ======================================================

function mostrarMensajeCosto(
    mensaje,
    tipo
) {

    const elemento =
        document.getElementById(
            "costos-mensaje"
        );


    if (!elemento) {

        return;

    }


    elemento.textContent =
        mensaje || "";


    elemento.className =
        "costos-mensaje";


    if (tipo) {

        elemento.classList.add(
            "costos-mensaje-" + tipo
        );

    }

}


// ======================================================
// FORMATEAR NUMERO
// ======================================================

function formatearNumero(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return "-";

    }


    return Number(
        valor
    ).toLocaleString(
        "es-AR",
        {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }
    );

}


// ======================================================
// FORMATEAR MONEDA
// ======================================================

function formatearMoneda(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return "-";

    }


    return Number(
        valor
    ).toLocaleString(
        "es-AR",
        {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        }
    );

}