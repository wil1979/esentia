import { db } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc,
  query,
  orderBy,
  where
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';

// Referencias a colecciones
const productosRef = collection(db, 'productos');
const clientesRef = collection(db, 'clientes');
const ventasRef = collection(db, 'ventas');

// Manejo de pestañas
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

// === INVENTARIO ===
// Cargar productos
async function cargarProductos() {
  const tabla = document.querySelector('#tabla-productos tbody');
  tabla.innerHTML = '';
  const snapshot = await getDocs(productosRef);
  snapshot.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>$${data.precio.toFixed(2)}</td>
      <td>${data.stock}</td>
      <td><button class="borrar" data-id="${doc.id}">Borrar</button></td>
    `;
    tabla.appendChild(tr);
  });
}

// Agregar producto
document.getElementById('form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombre-producto').value;
  const precio = parseFloat(document.getElementById('precio-producto').value);
  const stock = parseInt(document.getElementById('stock-producto').value);

  await addDoc(productosRef, { nombre, precio, stock });
  document.getElementById('form-producto').reset();
  cargarProductos();
});

// Borrar producto
document.getElementById('tabla-productos').addEventListener('click', async (e) => {
  if (e.target.classList.contains('borrar')) {
    const id = e.target.dataset.id;
    await deleteDoc(doc(db, 'productos', id));
    cargarProductos();
  }
});

// === CLIENTES ===
// Cargar clientes
async function cargarClientes() {
  const tabla = document.querySelector('#tabla-clientes tbody');
  const select = document.getElementById('cliente-venta');
  tabla.innerHTML = '';
  select.innerHTML = '<option value="">Seleccionar cliente</option>';
  
  const snapshot = await getDocs(clientesRef);
  snapshot.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.telefono || '-'}</td>
      <td><button class="borrar" data-id="${doc.id}">Borrar</button></td>
    `;
    tabla.appendChild(tr);

    const option = document.createElement('option');
    option.value = doc.id;
    option.textContent = data.nombre;
    select.appendChild(option);
  });
}

// Agregar cliente
document.getElementById('form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombre-cliente').value;
  const telefono = document.getElementById('telefono-cliente').value;

  await addDoc(clientesRef, { nombre, telefono });
  document.getElementById('form-cliente').reset();
  cargarClientes();
});

// Borrar cliente
document.getElementById('tabla-clientes').addEventListener('click', async (e) => {
  if (e.target.classList.contains('borrar')) {
    const id = e.target.dataset.id;
    await deleteDoc(doc(db, 'clientes', id));
    cargarClientes();
  }
});

// === VENTAS ===
// Cargar productos en select de venta
async function cargarProductosVenta() {
  const select = document.getElementById('producto-venta');
  select.innerHTML = '<option value="">Seleccionar producto</option>';
  const snapshot = await getDocs(productosRef);
  snapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement('option');
    option.value = doc.id;
    option.textContent = `${data.nombre} ($${data.precio.toFixed(2)}) - Stock: ${data.stock}`;
    option.dataset.precio = data.precio;
    option.dataset.stock = data.stock;
    select.appendChild(option);
  });
}

// Registrar venta
document.getElementById('form-venta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const clienteId = document.getElementById('cliente-venta').value;
  const productoId = document.getElementById('producto-venta').value;
  const cantidad = parseInt(document.getElementById('cantidad-venta').value);

  const productoSelect = document.getElementById('producto-venta').selectedOptions[0];
  const precio = parseFloat(productoSelect.dataset.precio);
  const stockActual = parseInt(productoSelect.dataset.stock);

  if (cantidad > stockActual) {
    alert('Stock insuficiente');
    return;
  }

  const total = precio * cantidad;

  // Registrar venta
  await addDoc(ventasRef, {
    clienteId,
    productoId,
    cantidad,
    total,
    fecha: new Date()
  });

  // Actualizar stock
  const productoDoc = doc(db, 'productos', productoId);
  await updateDoc(productoDoc, { stock: stockActual - cantidad });

  // Resetear formulario
  document.getElementById('form-venta').reset();
  cargarVentas();
  cargarProductosVenta(); // Actualizar stock en select
});

// Cargar ventas
async function cargarVentas() {
  const tabla = document.querySelector('#tabla-ventas tbody');
  tabla.innerHTML = '';

  const q = query(ventasRef, orderBy('fecha', 'desc'));
  const snapshot = await getDocs(q);

  for (const ventaDoc of snapshot.docs) {
    const data = ventaDoc.data();
    
    // Obtener nombre del cliente
    const clienteSnap = await getDocs(query(clientesRef, where('__name__', '==', data.clienteId)));
    const cliente = clienteSnap.docs[0]?.data()?.nombre || 'Desconocido';

    // Obtener nombre del producto
    const productoSnap = await getDocs(query(productosRef, where('__name__', '==', data.productoId)));
    const producto = productoSnap.docs[0]?.data()?.nombre || 'Desconocido';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cliente}</td>
      <td>${producto}</td>
      <td>${data.cantidad}</td>
      <td>$${data.total.toFixed(2)}</td>
      <td>${data.fecha.toDate().toLocaleString()}</td>
    `;
    tabla.appendChild(tr);
  }
}

// Inicializar
cargarProductos();
cargarClientes();
cargarProductosVenta();
cargarVentas();