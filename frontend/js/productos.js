// ============================================================
// PRODUCTOS
// ============================================================


// ============================================================
// CARGAR UNIDADES
// ============================================================

async function cargarUnidades() {

    try {

        var respuesta =
            await fetch("/api/unidades");

        if (!respuesta.ok) {

            throw new Error(
                "Error al obtener las unidades"
            );

        }

        var unidades =
            await respuesta.json();

        var combo =
            document.getElementById("unidad");

        if (!combo) {
            return;
        }

        combo.innerHTML = "";

        var opcionInicial =
            document.createElement("option");

        opcionInicial.value = "";

        opcionInicial.textContent =
            "Seleccionar...";

        combo.appendChild(
            opcionInicial
        );


        unidades.forEach(
            function (unidad) {

                var opcion =
                    document.createElement("option");

                opcion.value =
                    unidad.id;

                opcion.textContent =
                    unidad.codigo;

                combo.appendChild(
                    opcion
                );

            }
        );

    }
    catch (error) {

        console.error(
            "Error al cargar unidades:",
            error
        );

        alert(
            "No se pudieron cargar las unidades de medida."
        );

    }

}



// ============================================================
// CARGAR PRODUCTOS
// ============================================================

async function cargarProductos() {

    try {

        var respuesta =
            await fetch("/api/productos");

        if (!respuesta.ok) {

            throw new Error(
                "Error al obtener los productos"
            );

        }

        var productos =
            await respuesta.json();

        var tabla =
            document.getElementById(
                "tablaProductos"
            );

        tabla.innerHTML = "";


        productos.forEach(
            function (producto) {

                var fila =
                    document.createElement("tr");


                fila.setAttribute(
                    "data-id",
                    producto.id
                );


                fila.addEventListener(
                    "click",
                    function () {

                        seleccionarProducto(
                            producto
                        );

                    }
                );


                fila.innerHTML = `

                    <td>
                        ${producto.codigo}
                    </td>

                    <td>
                        ${producto.nombre}
                    </td>

                    <td>
                        ${producto.tipo}
                    </td>

                    <td>
                        ${producto.unidad || ""}
                    </td>

                    <td>
                        ${producto.activo ? "Activo" : "Inactivo"}
                    </td>

                `;


                tabla.appendChild(
                    fila
                );

            }
        );


        var cantidad =
            document.getElementById(
                "cantidadProductos"
            );


        if (cantidad) {

            cantidad.textContent =
                productos.length +
                (
                    productos.length === 1
                        ? " producto"
                        : " productos"
                );

        }


        var dashboardCantidad =
            document.getElementById(
                "dashboardCantidadProductos"
            );


        if (dashboardCantidad) {

            dashboardCantidad.textContent =
                productos.length;

        }

    }
    catch (error) {

        console.error(
            "Error al cargar productos:",
            error
        );

        alert(
            "No se pudieron cargar los productos."
        );

    }

}



// ============================================================
// OBTENER DATOS DEL FORMULARIO
// ============================================================

function obtenerDatosFormulario() {

    return {

        codigo:
            document
                .getElementById("codigo")
                .value
                .trim(),

        nombre:
            document
                .getElementById("nombre")
                .value
                .trim(),

        tipo:
            document
                .getElementById("tipo")
                .value,

        id_unidad:
            document
                .getElementById("unidad")
                .value,

        activo:
            document
                .getElementById("activo")
                .checked

    };

}



// ============================================================
// VALIDAR PRODUCTO
// ============================================================

function validarProducto(datos) {

    if (!datos.codigo) {

        alert(
            "Ingrese el código del producto."
        );

        return false;

    }


    if (!datos.nombre) {

        alert(
            "Ingrese el nombre del producto."
        );

        return false;

    }


    if (!datos.tipo) {

        alert(
            "Seleccione el tipo de producto."
        );

        return false;

    }


    if (!datos.id_unidad) {

        alert(
            "Seleccione la unidad."
        );

        return false;

    }


    return true;

}



// ============================================================
// NUEVO PRODUCTO
// ============================================================

function nuevoProducto() {

    document.getElementById(
        "idProducto"
    ).value = "";


    document.getElementById(
        "codigo"
    ).value = "";


    document.getElementById(
        "nombre"
    ).value = "";


    document.getElementById(
        "tipo"
    ).value = "";


    document.getElementById(
        "unidad"
    ).value = "";


    document.getElementById(
        "activo"
    ).checked = true;


    limpiarSeleccionProducto();

}



// ============================================================
// SELECCIONAR PRODUCTO
// ============================================================

function seleccionarProducto(producto) {

    document.getElementById(
        "idProducto"
    ).value =
        producto.id;


    document.getElementById(
        "codigo"
    ).value =
        producto.codigo || "";


    document.getElementById(
        "nombre"
    ).value =
        producto.nombre || "";


    document.getElementById(
        "tipo"
    ).value =
        producto.tipo || "";


    document.getElementById(
        "unidad"
    ).value =
        producto.id_unidad || "";


    document.getElementById(
        "activo"
    ).checked =
        producto.activo;


    limpiarSeleccionProducto();


    var filas =
        document.querySelectorAll(
            "#tablaProductos tr"
        );


    filas.forEach(
        function (fila) {

            fila.classList.remove(
                "fila-seleccionada"
            );

        }
    );


    var filaSeleccionada =
        document.querySelector(
            '#tablaProductos tr[data-id="' +
            producto.id +
            '"]'
        );


    if (filaSeleccionada) {

        filaSeleccionada.classList.add(
            "fila-seleccionada"
        );

    }

}



// ============================================================
// LIMPIAR SELECCION
// ============================================================

function limpiarSeleccionProducto() {

    var filas =
        document.querySelectorAll(
            "#tablaProductos tr"
        );


    filas.forEach(
        function (fila) {

            fila.classList.remove(
                "fila-seleccionada"
            );

        }
    );

}



// ============================================================
// GUARDAR PRODUCTO
// ============================================================

async function guardarProducto() {

    var datos =
        obtenerDatosFormulario();


    if (!validarProducto(datos)) {

        return;

    }


    try {

        var respuesta =
            await fetch(
                "/api/productos",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            datos
                        )

                }
            );


        var resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            alert(
                resultado.error ||
                "No se pudo guardar el producto."
            );

            return;

        }


        alert(
            "Producto guardado correctamente."
        );


        nuevoProducto();

        await cargarProductos();

    }
    catch (error) {

        console.error(
            "Error al guardar producto:",
            error
        );

        alert(
            "Error de comunicación con el servidor."
        );

    }

}



// ============================================================
// MODIFICAR PRODUCTO
// ============================================================

async function modificarProducto() {

    var id =
        document
            .getElementById("idProducto")
            .value;


    if (!id) {

        alert(
            "Seleccione un producto para modificar."
        );

        return;

    }


    var datos =
        obtenerDatosFormulario();


    if (!validarProducto(datos)) {

        return;

    }


    try {

        var respuesta =
            await fetch(
                "/api/productos/" + id,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            datos
                        )

                }
            );


        var resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            alert(
                resultado.error ||
                "No se pudo modificar el producto."
            );

            return;

        }


        alert(
            "Producto modificado correctamente."
        );


        nuevoProducto();

        await cargarProductos();

    }
    catch (error) {

        console.error(
            "Error al modificar producto:",
            error
        );

        alert(
            "Error de comunicación con el servidor."
        );

    }

}



// ============================================================
// ELIMINAR PRODUCTO
// ============================================================

async function eliminarProducto() {

    var id =
        document
            .getElementById("idProducto")
            .value;


    if (!id) {

        alert(
            "Seleccione un producto para eliminar."
        );

        return;

    }


    var confirmar =
        confirm(
            "¿Está seguro de eliminar el producto seleccionado?"
        );


    if (!confirmar) {

        return;

    }


    try {

        var respuesta =
            await fetch(
                "/api/productos/" + id,
                {

                    method: "DELETE"

                }
            );


        var resultado =
            await respuesta.json();


        if (!respuesta.ok) {

            alert(
                resultado.error ||
                "No se pudo eliminar el producto."
            );

            return;

        }


        alert(
            "Producto eliminado correctamente."
        );


        nuevoProducto();

        await cargarProductos();

    }
    catch (error) {

        console.error(
            "Error al eliminar producto:",
            error
        );

        alert(
            "Error de comunicación con el servidor."
        );

    }

}



// ============================================================
// INICIALIZACION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        await cargarUnidades();

        await cargarProductos();

    }
);