// ==============================
// 📦 VARIABLES GLOBALES
// ==============================
let carrito = [];
let cuponActivo = false;
let productoSeleccionado = null;
let productos = [];

// ==============================
// 📦 CARGAR PRODUCTOS DESDE JSON
// ==============================
const URL_ESENCIA = "https://wil1979.github.io/esentia-factura/productos_esentia.json";

fetch(URL_ESENCIA)
  .then(res => res.json())
  .then(data => {
    productos = data;
    renderizarProductos();
  })
  .catch(err => console.error("Error cargando productos:", err));

// ==============================
// 🖼️ RENDERIZAR PRODUCTOS
// ==============================
function renderizarProductos() {
  const container = document.getElementById("productos-hogar");
  if (!container) return;

  container.innerHTML = "";

  const fila = document.createElement("div");
  fila.className = "productos";
  fila.style.display = "flex";
  fila.style.flexWrap = "wrap";
  fila.style.gap = "1.5rem";

  productos.forEach(producto => {
    if (!producto.disponible) return;

    const divProducto = document.createElement("div");
    divProducto.className = producto.precioOferta
      ? "producto oferta producto-card"
      : "producto producto-card";
    divProducto.dataset.nombre = producto.nombre;

    const precioFinal = producto.precioOferta || producto.precio;

    let estrellasHTML = "";
    if (producto.calificacion) {
      const estrellasLlenas = Math.floor(producto.calificacion);
      const mediaEstrella = producto.calificacion % 1 >= 0.5;
      for (let i = 0; i < estrellasLlenas; i++) estrellasHTML += "⭐";
      if (mediaEstrella) estrellasHTML += "✨";
      while (estrellasHTML.length < 5) estrellasHTML += "☆";
    }

    const precioHTML = producto.precioOferta
      ? `<p><span class="precio-original">₡${producto.precioOriginal}</span> ₡${producto.precioOferta}</p>`
      : `<p>₡${producto.precio}</p>`;

    const botonHTML = `<button class="btn-agregar" onclick="mostrarInfoProducto(
      '${producto.nombre}',
      ${precioFinal},
      '${producto.imagen}',
      \`${producto.info}\`,
      \`${producto.beneficios || ''}\`,
      \`${producto.usoRecomendado || ''}\`
    )">Ver detalles</button>`;

    divProducto.innerHTML = `
      <div style="position:relative;">
        <img src="${producto.imagen}" alt="${producto.nombre}"
          onclick="mostrarInfoProducto(
            '${producto.nombre}',
            ${precioFinal},
            '${producto.imagen}',
            \`${producto.info}\`,
            \`${producto.beneficios || ''}\`,
            \`${producto.usoRecomendado || ''}\`
          )">
      </div>
      <h3>${producto.nombre}</h3>
      <div class="estrellas">${estrellasHTML}</div>
      ${precioHTML}
      <p class="stock-label">Cargando stock...</p>
      ${botonHTML}
    `;

    fila.appendChild(divProducto);
  });

  container.appendChild(fila);

  if (typeof actualizarCatalogoConStock === "function") {
    actualizarCatalogoConStock();
  }
}

// ==============================
// 🛒 MODAL DE DETALLES
// ==============================
function mostrarInfoProducto(nombre, precio, imagen, info, beneficios, usoRecomendado) {
  document.getElementById("modalProductoNombre").textContent = nombre;
  document.getElementById("modalProductoImagen").src = imagen;
  document.getElementById("modalProductoInfo").textContent = info;
  document.getElementById("modalProductoUso").innerHTML = `
    <strong>🧠 Beneficios:</strong> ${beneficios}<br>
    <strong>🏠 Uso recomendado:</strong> ${usoRecomendado}`;

  document.getElementById("modalProductoPrecio").textContent = `₡${precio.toLocaleString()}`;

  // buscar producto real
  const productoReal = productos.find(p => p.nombre === nombre);
  productoSeleccionado = { ...productoReal };

  // manejar variantes
  const selectorContainer = document.getElementById("selectorVariante");
  selectorContainer.innerHTML = "";

  if (productoReal.variantes && productoReal.variantes.length > 0) {
    const select = document.createElement("select");
    select.id = "varianteSeleccionada";
    select.style.width = "100%";
    select.style.marginTop = "1rem";
    select.style.padding = "10px";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Selecciona una presentación --";
    select.appendChild(defaultOption);

    productoReal.variantes.forEach(v => {
      const option = document.createElement("option");
      option.value = JSON.stringify(v);
      option.textContent = `${v.nombre} – ₡${v.precio.toLocaleString()}`;
      select.appendChild(option);
    });

    selectorContainer.appendChild(select);
  }

  const modal = document.getElementById("modalProducto");
  modal.style.display = "flex";

  if (typeof actualizarModalConStock === "function") {
    actualizarModalConStock(nombre);
  }
}

function cerrarModalProducto() {
  document.getElementById("modalProducto").style.display = "none";
}

// ==============================
// 🛒 AGREGAR AL CARRITO
// ==============================
function agregarDesdeModal() {
  if (!productoSeleccionado) return;

  const selector = document.getElementById("varianteSeleccionada");
  if (selector && selector.value === "") {
    mostrarToast("⚠️ Selecciona una presentación", "#e53935");
    return;
  }

  if (selector && selector.value) {
    const variante = JSON.parse(selector.value);
    agregarCarrito(`${productoSeleccionado.nombre} ${variante.nombre}`, variante.precio);
  } else {
    agregarCarrito(productoSeleccionado.nombre, productoSeleccionado.precio);
  }

  cerrarModalProducto();
}

function agregarCarrito(nombre, precio) {
  const itemExistente = carrito.find(item => item.nombre === nombre);
  if (itemExistente) {
    itemExistente.cantidad += 1;
  } else {
    carrito.push({ nombre, precio, cantidad: 1 });
  }
  renderCarrito();
  mostrarToast(`✅ "${nombre}" agregado al carrito`);
}

// ==============================
// 🛒 CARRITO Y PEDIDO
// ==============================
function renderCarrito() {
  const lista = document.getElementById("listaCarritoModal");
  lista.innerHTML = "";
  let total = 0;

  carrito.forEach((item, i) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const li = document.createElement("li");
    li.textContent = `${item.nombre} x${item.cantidad} - ₡${subtotal.toLocaleString()}`;

    const btnQuitar = document.createElement("button");
    btnQuitar.textContent = "❌";
    btnQuitar.onclick = () => {
      carrito.splice(i, 1);
      renderCarrito();
    };

    li.appendChild(btnQuitar);
    lista.appendChild(li);
  });

  document.getElementById("totalModal").textContent = `Total: ₡${Math.round(total).toLocaleString()}`;
  document.getElementById("contadorCarrito").textContent = carrito.reduce((s, i) => s + i.cantidad, 0);
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

function cargarCarrito() {
  const data = localStorage.getItem("carrito");
  if (data) {
    carrito = JSON.parse(data);
    renderCarrito();
  }
}

function vaciarCarrito() {
  if (confirm("¿Vaciar todo el carrito?")) {
    carrito = [];
    renderCarrito();
  }
}

function finalizarPedido() {
  if (carrito.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  let mensaje = "Hola Wilber 👋%0AQuiero hacer el siguiente pedido:%0A%0A";
  let total = 0;

  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    mensaje += `🧴 ${item.nombre} x${item.cantidad} - ₡${subtotal.toLocaleString()}%0A`;
    total += subtotal;
  });

  mensaje += `%0A💰 Total: ₡${Math.round(total).toLocaleString()}%0A%0A¡Gracias por tu compra! 🌿`;
  window.open(`https://wa.me/50672952454?text=${mensaje}`, "_blank");
}

// ==============================
// 🔔 TOAST
// ==============================
function mostrarToast(mensaje, color = "#4caf50") {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.style.backgroundColor = color;
  toast.style.display = "block";
  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.transition = "opacity 0.5s";
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
      toast.style.transition = "";
    }, 500);
  }, 3000);
}

function abrirModalCarrito() {
  renderCarrito();
  document.getElementById("modalCarrito").style.display = "flex";
}

function cerrarModalCarrito() {
  document.getElementById("modalCarrito").style.display = "none";
}

