// ======================================================
// ROTISERIA360
// CRUD DE PRODUCTOS
// ======================================================

var productoSeleccionado = null;


// ======================================================
// INICIO
// ======================================================

document.addEventListener("DOMContentLoaded", function () {

    cargarProductos();

});


// ======================================================
// CARGAR PRODUCTOS
// ======================================================

async function cargarProductos() {

    try {

        var respuesta = await fetch("/api/productos");

        if (!respuesta.ok) {

            throw new Error("Error al consultar productos");

        }

        var productos = await respuesta.json();

        var tabla = document.getElementById("tablaProductos");

        tabla.innerHTML = "";

        productos.forEach(function (producto) {

            var fila = document.createElement("tr");

            fila.setAttribute("data-id", producto.id);

            fila.style.cursor = "pointer";


            fila.innerHTML = `
                <td>${producto.codigo}</td>

                <td>${producto.nombre}</td>

                <td>${producto.tipo}</td>

                <td>${producto.unidad}</td>

                <td>
                    ${producto.activo ? "ACTIVO" : "INACTIVO"}
                </td>
            `;


            fila.addEventListener("click", function () {

                seleccionarProducto(producto);

            });


            tabla.appendChild(fila);

        });


        actualizarCantidadProductos(productos.length);

        actualizarDashboard(productos.length);


    } catch (error) {

        console.error(error);

        alert("No se pudieron cargar los productos.");

    }

}


// ======================================================
// SELECCIONAR PRODUCTO
// ======================================================

function seleccionarProducto(producto) {

    productoSeleccionado = producto;


    document.getElementById("idProducto").value =
        producto.id;

    document.getElementById("codigo").value =
        producto.codigo;

    document.getElementById("nombre").value =
        producto.nombre;

    document.getElementById("tipo").value =
        producto.tipo;

    document.getElementById("unidad").value =
        producto.unidad;

    document.getElementById("activo").checked =
        producto.activo;


    marcarFilaSeleccionada(producto.id);

}


// ======================================================
// MARCAR FILA SELECCIONADA
// ======================================================

function marcarFilaSeleccionada(id) {

    var filas =
        document.querySelectorAll("#tablaProductos tr");


    filas.forEach(function (fila) {

        fila.classList.remove("seleccionado");


        if (fila.getAttribute("data-id") == id) {

            fila.classList.add("seleccionado");

        }

    });

}


// ======================================================
// NUEVO PRODUCTO
// ======================================================

function nuevoProducto() {

    productoSeleccionado = null;


    document.getElementById("idProducto").value = "";

    document.getElementById("codigo").value = "";

    document.getElementById("nombre").value = "";

    document.getElementById("tipo").value = "";

    document.getElementById("unidad").value = "";

    document.getElementById("activo").checked = true;


    var filas =
        document.querySelectorAll("#tablaProductos tr");


    filas.forEach(function (fila) {

        fila.classList.remove("seleccionado");

    });


    document.getElementById("codigo").focus();

}


// ======================================================
// OBTENER DATOS DEL FORMULARIO
// ======================================================

function obtenerDatosFormulario() {

    return {

        codigo:
            document.getElementById("codigo").value.trim(),

        nombre:
            document.getElementById("nombre").value.trim(),

        tipo:
            document.getElementById("tipo").value,

        unidad:
            document.getElementById("unidad").value,

        activo:
            document.getElementById("activo").checked

    };

}


// ======================================================
// VALIDAR FORMULARIO
// ======================================================

function validarProducto(datos) {

    if (!datos.codigo) {

        alert("Ingrese el código del producto.");

        document.getElementById("codigo").focus();

        return false;

    }


    if (!datos.nombre) {

        alert("Ingrese el nombre del producto.");

        document.getElementById("nombre").focus();

        return false;

    }


    if (!datos.tipo) {

        alert("Seleccione el tipo de producto.");

        document.getElementById("tipo").focus();

        return false;

    }


    if (!datos.unidad) {

        alert("Seleccione la unidad.");

        document.getElementById("unidad").focus();

        return false;

    }


    return true;

}


// ======================================================
// GUARDAR PRODUCTO
// ======================================================

async function guardarProducto() {

    var datos = obtenerDatosFormulario();


    if (!validarProducto(datos)) {

        return;

    }


    try {

        var respuesta = await fetch(
            "/api/productos",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datos)
            }
        );


        var resultado = await respuesta.json();


        if (!respuesta.ok) {

            alert(resultado.error ||
                "No se pudo guardar el producto.");

            return;

        }


        alert("Producto creado correctamente.");


        nuevoProducto();

        await cargarProductos();

    }
    catch (error) {

        console.error(error);

        alert("Error de comunicación con el servidor.");

    }

}


// ======================================================
// MODIFICAR PRODUCTO
// ======================================================

async function modificarProducto() {

    var id =
        document.getElementById("idProducto").value;


    if (!id) {

        alert("Seleccione un producto de la lista.");

        return;

    }


    var datos = obtenerDatosFormulario();


    if (!validarProducto(datos)) {

        return;

    }


    try {

        var respuesta = await fetch(
            "/api/productos/" + id,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datos)
            }
        );


        var resultado = await respuesta.json();


        if (!respuesta.ok) {

            alert(resultado.error ||
                "No se pudo modificar el producto.");

            return;

        }


        alert("Producto modificado correctamente.");


        nuevoProducto();

        await cargarProductos();

    }
    catch (error) {

        console.error(error);

        alert("Error de comunicación con el servidor.");

    }

}


// ======================================================
// ELIMINAR PRODUCTO
// ======================================================

async function eliminarProducto() {

    var id =
        document.getElementById("idProducto").value;


    if (!id) {

        alert("Seleccione un producto de la lista.");

        return;

    }


    var nombre =
        document.getElementById("nombre").value;


    var confirmar =
        confirm(
            "¿Desea eliminar el producto '" +
            nombre +
            "'?"
        );


    if (!confirmar) {

        return;

    }


    try {

        var respuesta = await fetch(
            "/api/productos/" + id,
            {
                method: "DELETE"
            }
        );


        var resultado = await respuesta.json();


        if (!respuesta.ok) {

            alert(resultado.error ||
                "No se pudo eliminar el producto.");

            return;

        }


        alert("Producto eliminado correctamente.");


        nuevoProducto();

        await cargarProductos();

    }
    catch (error) {

        console.error(error);

        alert("Error de comunicación con el servidor.");

    }

}


// ======================================================
// CANTIDAD DE PRODUCTOS
// ======================================================

function actualizarCantidadProductos(cantidad) {

    var elemento =
        document.getElementById("cantidadProductos");


    if (!elemento) {

        return;

    }


    if (cantidad === 1) {

        elemento.textContent =
            "1 producto";

    }
    else {

        elemento.textContent =
            cantidad + " productos";

    }

}


// ======================================================
// ACTUALIZAR DASHBOARD
// ======================================================

function actualizarDashboard(cantidad) {

    var elemento =
        document.getElementById(
            "dashboardCantidadProductos"
        );


    if (!elemento) {

        return;

    }


    elemento.textContent = cantidad;

}