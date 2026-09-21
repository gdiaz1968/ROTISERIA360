// ======================================================
// ROTISERIA360
// ESTRUCTURA DE PRODUCTOS
// ======================================================

let productosElaborados = [];
let componentes = [];
let detalleEstructura = [];


// ======================================================
// INICIO
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

    cargarProductosElaborados();
    cargarComponentes();

    document
        .getElementById("estructura-producto")
        .addEventListener("change", seleccionarProducto);

    document
        .getElementById("estructura-componente")
        .addEventListener("change", seleccionarComponente);

    document
        .getElementById("btn-agregar-componente")
        .addEventListener("click", agregarComponente);

    document
        .getElementById("btn-guardar-estructura")
        .addEventListener("click", guardarEstructura);

});


// ======================================================
// CARGAR PRODUCTOS ELABORADOS
// ======================================================

async function cargarProductosElaborados() {

    try {

        const respuesta = await fetch(
            "/api/estructura/productos"
        );

        if (!respuesta.ok) {

            throw new Error(
                "Error al consultar productos elaborados"
            );
        }

        productosElaborados = await respuesta.json();

        const combo =
            document.getElementById(
                "estructura-producto"
            );

        combo.innerHTML = `
            <option value="">
                Seleccionar producto...
            </option>
        `;

        productosElaborados.forEach(producto => {

            const option =
                document.createElement("option");

            option.value = producto.id;

            option.textContent =
                producto.codigo +
                " - " +
                producto.nombre;

            combo.appendChild(option);

        });

    } catch (error) {

        console.error(error);

        alert(
            "No se pudieron cargar los productos elaborados."
        );

    }

}


// ======================================================
// CARGAR COMPONENTES
// ======================================================

async function cargarComponentes() {

    try {

        const respuesta = await fetch(
            "/api/estructura/componentes"
        );

        if (!respuesta.ok) {

            throw new Error(
                "Error al consultar componentes"
            );
        }

        componentes = await respuesta.json();

        const combo =
            document.getElementById(
                "estructura-componente"
            );

        combo.innerHTML = `
            <option value="">
                Seleccionar componente...
            </option>
        `;

        componentes.forEach(componente => {

            const option =
                document.createElement("option");

            option.value = componente.id;

            option.textContent =
                componente.codigo +
                " - " +
                componente.nombre;

            combo.appendChild(option);

        });

    } catch (error) {

        console.error(error);

        alert(
            "No se pudieron cargar los componentes."
        );

    }

}


// ======================================================
// SELECCIONAR PRODUCTO
// ======================================================

function seleccionarProducto() {

    const id =
        parseInt(
            document.getElementById(
                "estructura-producto"
            ).value
        );

    const producto =
        productosElaborados.find(
            p => p.id === id
        );

    if (!producto) {

        document.getElementById(
            "estructura-codigo"
        ).value = "";

        document.getElementById(
            "estructura-unidad"
        ).value = "";

        document.getElementById(
            "estructura-unidad-rendimiento"
        ).value = "";

        return;
    }

    document.getElementById(
        "estructura-codigo"
    ).value = producto.codigo;

    document.getElementById(
        "estructura-unidad"
    ).value = producto.unidad;

    document.getElementById(
        "estructura-unidad-rendimiento"
    ).value = producto.unidad;

}


// ======================================================
// SELECCIONAR COMPONENTE
// ======================================================

function seleccionarComponente() {

    const id =
        parseInt(
            document.getElementById(
                "estructura-componente"
            ).value
        );

    const componente =
        componentes.find(
            c => c.id === id
        );

    if (!componente) {

        document.getElementById(
            "componente-codigo"
        ).value = "";

        document.getElementById(
            "componente-tipo"
        ).value = "";

        document.getElementById(
            "componente-unidad"
        ).value = "";

        return;
    }

    document.getElementById(
        "componente-codigo"
    ).value = componente.codigo;

    document.getElementById(
        "componente-tipo"
    ).value = componente.tipo;

    document.getElementById(
        "componente-unidad"
    ).value = componente.unidad;

}


// ======================================================
// AGREGAR COMPONENTE
// ======================================================

function agregarComponente() {

    const componenteId =
        parseInt(
            document.getElementById(
                "estructura-componente"
            ).value
        );

    const cantidad =
        parseFloat(
            document.getElementById(
                "componente-cantidad"
            ).value
        );

    const merma =
        parseFloat(
            document.getElementById(
                "componente-merma"
            ).value
        ) || 0;


    if (!componenteId) {

        alert(
            "Seleccione un componente."
        );

        return;
    }


    if (!cantidad || cantidad <= 0) {

        alert(
            "Ingrese una cantidad válida."
        );

        return;
    }


    const componente =
        componentes.find(
            c => c.id === componenteId
        );


    if (!componente) {

        alert(
            "Componente no encontrado."
        );

        return;
    }


    detalleEstructura.push({

        componente_id: componente.id,

        codigo: componente.codigo,

        nombre: componente.nombre,

        tipo: componente.tipo,

        unidad: componente.unidad,

        cantidad: cantidad,

        merma: merma

    });


    mostrarDetalle();

    limpiarComponente();

}


// ======================================================
// MOSTRAR DETALLE
// ======================================================

function mostrarDetalle() {

    const tbody =
        document.getElementById(
            "detalle-estructura"
        );

    tbody.innerHTML = "";


    detalleEstructura.forEach(
        (detalle, index) => {

            const fila =
                document.createElement("tr");


            fila.innerHTML = `

                <td>
                    ${detalle.codigo}
                </td>

                <td>
                    ${detalle.nombre}
                </td>

                <td>
                    ${detalle.tipo}
                </td>

                <td>
                    ${detalle.unidad}
                </td>

                <td>
                    ${detalle.cantidad.toFixed(3)}
                </td>

                <td>
                    ${detalle.merma.toFixed(3)}
                </td>

                <td>

                    <button
                        type="button"
                        onclick="eliminarComponente(${index})">

                        Eliminar

                    </button>

                </td>

            `;


            tbody.appendChild(fila);

        }
    );

}


// ======================================================
// ELIMINAR COMPONENTE
// ======================================================

function eliminarComponente(index) {

    detalleEstructura.splice(
        index,
        1
    );

    mostrarDetalle();

}


// ======================================================
// LIMPIAR COMPONENTE
// ======================================================

function limpiarComponente() {

    document.getElementById(
        "estructura-componente"
    ).value = "";

    document.getElementById(
        "componente-codigo"
    ).value = "";

    document.getElementById(
        "componente-tipo"
    ).value = "";

    document.getElementById(
        "componente-unidad"
    ).value = "";

    document.getElementById(
        "componente-cantidad"
    ).value = "";

    document.getElementById(
        "componente-merma"
    ).value = "0";

}


// ======================================================
// GUARDAR ESTRUCTURA
// ======================================================

async function guardarEstructura() {

    const productoId =
        parseInt(
            document.getElementById(
                "estructura-producto"
            ).value
        );

    const rendimiento =
        parseFloat(
            document.getElementById(
                "estructura-rendimiento"
            ).value
        );

    const unidadRendimiento =
        document.getElementById(
            "estructura-unidad-rendimiento"
        ).value;


    // --------------------------------------------------
    // VALIDACIONES
    // --------------------------------------------------

    if (!productoId) {

        alert(
            "Seleccione un producto elaborado."
        );

        return;
    }


    if (!rendimiento || rendimiento <= 0) {

        alert(
            "Ingrese un rendimiento válido."
        );

        return;
    }


    if (!unidadRendimiento) {

        alert(
            "No se encontró la unidad de rendimiento."
        );

        return;
    }


    if (detalleEstructura.length === 0) {

        alert(
            "Debe agregar al menos un componente."
        );

        return;
    }


    // --------------------------------------------------
    // ARMAR DATOS PARA EL BACKEND
    // --------------------------------------------------

    const datos = {

        producto_id: productoId,

        rendimiento: rendimiento,

        unidad_rendimiento: unidadRendimiento,

        detalle: detalleEstructura.map(
            item => ({

                componente_id:
                    item.componente_id,

                cantidad:
                    item.cantidad,

                merma:
                    item.merma

            })
        )

    };


    console.log(
        "Datos enviados al servidor:",
        datos
    );


    // --------------------------------------------------
    // ENVIAR AL BACKEND
    // --------------------------------------------------

    try {

        const respuesta =
            await fetch(
                "/api/estructura",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)

                }
            );


        const resultado =
            await respuesta.json();


        // --------------------------------------------------
        // ERROR DEL SERVIDOR
        // --------------------------------------------------

        if (!respuesta.ok) {

            throw new Error(
                resultado.error ||
                "Error al guardar la estructura"
            );

        }


        // --------------------------------------------------
        // ESTRUCTURA GUARDADA
        // --------------------------------------------------

        alert(
            "Estructura guardada correctamente.\n\n" +
            "Versión: " +
            resultado.version
        );


        console.log(
            "Respuesta del servidor:",
            resultado
        );


        // --------------------------------------------------
        // LIMPIAR PANTALLA
        // --------------------------------------------------

        detalleEstructura = [];

        mostrarDetalle();


        document.getElementById(
            "estructura-producto"
        ).value = "";


        document.getElementById(
            "estructura-codigo"
        ).value = "";


        document.getElementById(
            "estructura-unidad"
        ).value = "";


        document.getElementById(
            "estructura-rendimiento"
        ).value = "1";


        document.getElementById(
            "estructura-unidad-rendimiento"
        ).value = "";


    } catch (error) {

        console.error(error);

        alert(
            "No se pudo guardar la estructura.\n\n" +
            error.message
        );

    }

}