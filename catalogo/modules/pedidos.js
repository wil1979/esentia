// modules/pedidos.js
import { getDocs, collection, doc, updateDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store, Utils } from './core.js';
import { UI } from '../components/ui.js';

export const PedidosManager = {
  _clientesCache: {}, // Cache local para mapear IDs a Nombres

  async mostrarPanel() {
    if (!Store.get('isAdmin')) { UI.toast('Acceso denegado', 'warning'); return; }
    if (document.getElementById('modalPedidos')) document.getElementById('modalPedidos').remove();

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalPedidos';
    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalPedidos','close')">✕</button>
        <h2>📦 Pedidos Pendientes de Despacho</h2>
        <div id="listaPedidos" class="pedidos-grid">
          <p style="text-align:center; padding:2rem;">🔄 Cargando pedidos...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    await this.cargarPedidos();
  },

  async cargarPedidos() {
    const container = document.getElementById('listaPedidos');
    try {
      // 1️⃣ Cargar nombres de clientes y guardarlos en cache
      const clientesSnap = await getDocs(collection(DB.db, "clientesBD"));
      this._clientesCache = {};
      clientesSnap.forEach(d => {
        const data = d.data();
        this._clientesCache[d.id] = data.nombre || data.telefono || 'Cliente';
      });

      // 2️⃣ Cargar facturas y filtrar pendientes
      const facturasSnap = await getDocs(collection(DB.db, "facturas"));
      const pedidos = [];

      facturasSnap.forEach(docSnap => {
        const data = docSnap.data();
        const compras = Array.isArray(data.compras) ? data.compras : [];
        
        // Recorremos con índice real para evitar errores de .indexOf()
        compras.forEach((c, i) => {
          if (c.estado === 'pendiente' || c.estado === 'en_proceso') {
            pedidos.push({
              idFactura: docSnap.id,
              index: i, // ✅ Índice exacto en el array original
              nombreCliente: this._clientesCache[docSnap.id] || 'Cliente Desconocido', // ✅ NOMBRE REAL
              pedido: c
            });
          }
        });
      });

      // Ordenar por fecha (más reciente primero)
      pedidos.sort((a, b) => new Date(b.pedido.fecha) - new Date(a.pedido.fecha));

      if (pedidos.length === 0) {
        container.innerHTML = '<p class="no-data">✅ No hay pedidos pendientes. ¡Todo al día!</p>';
        return;
      }

      // 3️⃣ Renderizar lista
      container.innerHTML = pedidos.map(p => `
        <div class="pedido-card">
          <div class="pedido-header">
            <span><strong>👤 Cliente:</strong> ${p.nombreCliente}</span>
            <span><strong>📅 Fecha:</strong> ${new Date(p.pedido.fecha).toLocaleDateString()}</span>
          </div>
          <div class="pedido-body">
            <p><strong>Total:</strong> ₡${p.pedido.total.toLocaleString()} | <strong>Método:</strong> ${p.pedido.metodoPago}</p>
            <ul class="pedido-items">
              ${p.pedido.productos.map(prod => `<li>${prod.cantidad}x ${prod.nombre} (${prod.variante || 'Única'})</li>`).join('')}
            </ul>
          </div>
          <div class="pedido-actions">
            <button class="btn-aprobar" onclick="PedidosManager.aprobarPedido('${p.idFactura}', ${p.index})">✅ Aprobar y Descontar</button>
            <button class="btn-cancelar" onclick="PedidosManager.cancelarPedido('${p.idFactura}', ${p.index})">❌ Cancelar</button>
          </div>
        </div>
      `).join('');

    } catch (e) {
      console.error(e);
      container.innerHTML = '<p style="color:red">Error al cargar pedidos</p>';
    }
  },

    async aprobarPedido(idFactura, index) {
    if (!confirm('¿Confirmar despacho? Se descontará el stock y se sumarán los puntos de lealtad.')) return;
    
    try {
      // 1. Obtener la factura
      const snap = await getDocs(collection(DB.db, "facturas"));
      const docSnap = snap.docs.find(d => d.id === idFactura);
      if (!docSnap) throw new Error("Factura no encontrada");

      const compras = docSnap.data().compras || [];
      const compra = compras[index];
      const inventario = Store.get('inventario') || {};

      // 2. Descontar Stock
      for (const prod of compra.productos) {
        const key = Utils.normalizeText(prod.nombre);
        const stockActual = inventario[key] || 0;
        inventario[key] = Math.max(0, stockActual - prod.cantidad);
      }

      // 3. 🏆 CALCULAR Y SUMAR PUNTOS DE LEALTAD AUTOMÁTICOS
      // Regla: 1 punto por cada 4000 colones gastados
      const puntosGanados = Math.floor((compra.total || 0) / 4000);
      
      if (puntosGanados > 0) {
        try {
          const clienteRef = doc(DB.db, "clientesBD", idFactura); // idFactura es igual al ID del cliente
          const clienteSnap = await getDoc(clienteRef);
          const puntosActuales = clienteSnap.exists() ? (clienteSnap.data().puntosLealtad || 0) : 0;
          
          await updateDoc(clienteRef, {
            puntosLealtad: puntosActuales + puntosGanados,
            historialPuntos: arrayUnion({ // Asegúrate de importar arrayUnion si no está
              cantidad: puntosGanados,
              fecha: new Date().toISOString(),
              motivo: 'Compra #' + (index + 1),
              autor: 'sistema'
            })
          });
          UI.toast(`🏆 ¡Cliente ganó ${puntosGanados} puntos de lealtad!`, 'success');
        } catch (err) {
          console.warn("⚠️ No se pudieron sumar puntos:", err);
        }
      }

      // 4. Actualizar estado a 'despachado'
      const comprasActualizadas = [...compras];
      comprasActualizadas[index] = { ...compra, estado: 'despachado' };

      await updateDoc(doc(DB.db, "facturas", idFactura), { compras: comprasActualizadas });

      // Sync local y UI
      Store.set('inventario', inventario);
      Store.persist('inventario');

      UI.toast('✅ Pedido despachado, stock actualizado y puntos sumados', 'success');
      this.cargarPedidos();
      Store.emit('inventory:updated');
      
    } catch (e) {
      console.error(e);
      UI.toast('❌ Error al procesar pedido', 'error');
    }
  },
    // 🔍 Verifica al cargar si hay pedidos pendientes y muestra banner
  async verificarNotificacionPedidos() {
    if (!Store.get('isAdmin')) return;
    if (sessionStorage.getItem('banner_pedidos_cerrado')) return; // Si ya lo cerró en esta sesión, no mostrar

    try {
      const facturasSnap = await getDocs(collection(DB.db, "facturas"));
      let hayPendientes = false;
      
      for (const docSnap of facturasSnap.docs) {
        const compras = Array.isArray(docSnap.data().compras) ? docSnap.data().compras : [];
        if (compras.some(c => c.estado === 'pendiente' || c.estado === 'en_proceso')) {
          hayPendientes = true;
          break;
        }
      }

      if (hayPendientes) this.mostrarBannerNotificacion();
    } catch (e) { console.error('Error verificando pedidos:', e); }
  },

  // 🖼️ Renderiza el banner visual
  mostrarBannerNotificacion() {
    if (document.getElementById('bannerPedidosPendientes')) return;
    
    const banner = document.createElement('div');
    banner.id = 'bannerPedidosPendientes';
    banner.className = 'banner-pedidos';
    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-icon">📦</span>
        <span class="banner-text">Tienes pedidos pendientes de revisión y despacho</span>
        <button class="btn-ver-pedidos" onclick="PedidosManager.mostrarPanel(); document.getElementById('bannerPedidosPendientes').classList.remove('show');">Ver ahora</button>
        <button class="btn-cerrar-banner" onclick="document.getElementById('bannerPedidosPendientes').classList.remove('show'); sessionStorage.setItem('banner_pedidos_cerrado','true')">✕</button>
      </div>
    `;
    document.body.appendChild(banner);
    
    // Animación de entrada
    requestAnimationFrame(() => banner.classList.add('show'));
  },

  async cancelarPedido(idFactura, index) {
    if (!confirm('¿Cancelar este pedido? El stock NO se tocará.')) return;
    try {
      const snap = await getDocs(collection(DB.db, "facturas"));
      const docSnap = snap.docs.find(d => d.id === idFactura);
      const compras = docSnap.data().compras || [];

      const comprasActualizadas = [...compras];
      comprasActualizadas[index] = { ...compras[index], estado: 'anulado' };

      await updateDoc(doc(DB.db, "facturas", idFactura), { compras: comprasActualizadas });
      UI.toast('🚫 Pedido cancelado', 'info');
      this.cargarPedidos();
    } catch (e) {
      console.error(e);
      UI.toast('❌ Error al cancelar', 'error');
    }
  }
};

export default PedidosManager;