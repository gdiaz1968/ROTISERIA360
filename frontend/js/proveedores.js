// ======================================================
// ROTISERIA360
// PROVEEDORES
// ======================================================


// ======================================================
// VARIABLES
// ======================================================

let proveedores = [];


// ======================================================
// INICIO
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarProveedores();

    }
);


// ======================================================
// CARGAR PROVEEDORES
// ======================================================

async function cargarProveedores() {

    try {

        const respuesta = await fetch("/api/proveedores");

        if (!respuesta.ok) {

            throw new Error("Error al consultar proveedores");

        }

        proveedores = await respuesta.json();

        mostrarProveedores();

    }
    catch (error) {

        console.error("Error al cargar proveedores:", error);

        alert("No se pudieron cargar los proveedores.");

    }

}


// ======================================================
// MOSTRAR PROVEEDORES
// ======================================================

function mostrarProveedores() {

    const tabla = document.getElementById("tablaProveedores");

    if (!tabla) {
        return;
    }


    tabla.innerHTML = "";


    proveedores.forEach(
        function (proveedor) {

            const fila = document.createElement("tr");

            fila.dataset.id = proveedor.id;


            fila.innerHTML = `
                <td>${proveedor.codigo || ""}</td>
                <td>${proveedor.nombre || ""}</td>
                <td>${proveedor.cuit || ""}</td>
                <td>${proveedor.telefono || ""}</td>
                <td>${proveedor.email || ""}</td>
                <td>${proveedor.activo ? "ACTIVO" : "INACTIVO"}</td>
            `;


            fila.addEventListener(
                "click",
                function () {

                    seleccionarProveedor(proveedor.id);

                }
            );


            tabla.appendChild(fila);

        }
    );


    const cantidad = document.getElementById("cantidadProveedores");

    if (cantidad) {

        cantidad.textContent = proveedores.length;

    }

}


// ======================================================
// OBTENER DATOS DEL FORMULARIO
// ======================================================

function obtenerDatosFormularioProveedor() {

    return {

        codigo:
            document.getElementById("proveedorCodigo").value.trim(),

        nombre:
            document.getElementById("proveedorNombre").value.trim(),

        cuit:
            document.getElementById("proveedorCuit").value.trim(),

        telefono:
            document.getElementById("proveedorTelefono").value.trim(),

        email:
            document.getElementById("proveedorEmail").value.trim(),

        direccion:
            document.getElementById("proveedorDireccion").value.trim(),

        activo:
            document.getElementById("proveedorActivo").checked

    };

}


// ======================================================
// VALIDAR
// ======================================================

function validarProveedor(datos) {

    if (!datos.codigo) {

        alert("Ingrese el código del proveedor.");

        document.getElementById("proveedorCodigo").focus();

        return false;

    }


    if (!datos.nombre) {

        alert("Ingrese el nombre del proveedor.");

        document.getElementById("proveedorNombre").focus();

        return false;

    }


    return true;

}


// ======================================================
// NUEVO
// ======================================================

function nuevoProveedor() {

    document.getElementById("idProveedor").value = "";

    document.getElementById("proveedorCodigo").value = "";

    document.getElementById("proveedorNombre").value = "";

    document.getElementById("proveedorCuit").value = "";

    document.getElementById("proveedorTelefono").value = "";

    document.getElementById("proveedorEmail").value = "";

    document.getElementById("proveedorDireccion").value = "";

    document.getElementById("proveedorActivo").checked = true;


    limpiarSeleccionProveedor();

    document.getElementById("proveedorCodigo").focus();

}


// ======================================================
// SELECCIONAR
// ======================================================

function seleccionarProveedor(id) {

    const proveedor = proveedores.find(
        function (item) {

            return item.id === id;

        }
    );


    if (!proveedor) {
        return;
    }


    document.getElementById("idProveedor").value =
        proveedor.id;

    document.getElementById("proveedorCodigo").value =
        proveedor.codigo || "";

    document.getElementById("proveedorNombre").value =
        proveedor.nombre || "";

    document.getElementById("proveedorCuit").value =
        proveedor.cuit || "";

    document.getElementById("proveedorTelefono").value =
        proveedor.telefono || "";

    document.getElementById("proveedorEmail").value =
        proveedor.email || "";

    document.getElementById("proveedorDireccion").value =
        proveedor.direccion || "";

    document.getElementById("proveedorActivo").checked =
        proveedor.activo;


    limpiarSeleccionProveedor();


    const fila = document.querySelector(
        `#tablaProveedores tr[data-id="${id}"]`
    );


    if (fila) {

        fila.classList.add("seleccionado");

    }

}


// ======================================================
// LIMPIAR SELECCION
// ======================================================

function limpiarSeleccionProveedor() {

    document
        .querySelectorAll("#tablaProveedores tr")
        .forEach(
            function (fila) {

                fila.classList.remove("seleccionado");

            }
        );

}


// ======================================================
// GUARDAR
// ======================================================

async function guardarProveedor() {

    const datos = obtenerDatosFormularioProveedor();


    if (!validarProveedor(datos)) {
        return;
    }


    try {

        const respuesta = await fetch(
            "/api/proveedores",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datos)
            }
        );


        const resultado = await respuesta.json();


        if (!respuesta.ok) {

            alert(resultado.error || "Error al guardar proveedor");

            return;

        }


        alert("Proveedor guardado correctamente.");


        await cargarProveedores();

        nuevoProveedor();

    }
    catch (error) {

        console.error("Error al guardar proveedor:", error);

        alert("Error al guardar el proveedor.");

    }

}


// ======================================================
// MODIFICAR
// ======================================================

async function modificarProveedor() {

    const id =
        document.getElementById("idProveedor").value;


    if (!id) {

        alert("Seleccione un proveedor para modificar.");

        return;

    }


    const datos = obtenerDatosFormularioProveedor();


    if (!validarProveedor(datos)) {
        return;
    }


    try {

        const respuesta = await fetch(
            `/api/proveedores/${id}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datos)
            }
        );


        const resultado = await respuesta.json();


        if (!respuesta.ok) {

            alert(resultado.error || "Error al modificar proveedor");

            return;

        }


        alert("Proveedor modificado correctamente.");


        await cargarProveedores();

        nuevoProveedor();

    }
    catch (error) {

        console.error("Error al modificar proveedor:", error);

        alert("Error al modificar el proveedor.");

    }

}


// ======================================================
// ELIMINAR
// ======================================================

async function eliminarProveedor() {

    const id =
        document.getElementById("idProveedor").value;


    if (!id) {

        alert("Seleccione un proveedor para eliminar.");

        return;

    }


    const confirmado = confirm(
        "¿Está seguro de dar de baja este proveedor?"
    );


    if (!confirmado) {
        return;
    }


    try {

        const respuesta = await fetch(
            `/api/proveedores/${id}`,
            {
                method: "DELETE"
            }
        );


        const resultado = await respuesta.json();


        if (!respuesta.ok) {

            alert(resultado.error || "Error al eliminar proveedor");

            return;

        }


        alert("Proveedor dado de baja correctamente.");


        await cargarProveedores();

        nuevoProveedor();

    }
    catch (error) {

        console.error("Error al eliminar proveedor:", error);

        alert("Error al eliminar el proveedor.");

    }

}