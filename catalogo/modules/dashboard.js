// modules/dashboard.js
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { DB } from './firebase.js';
import { Store } from './core.js';
import { UI } from '../components/ui.js';

export const DashboardManager = {
  async mostrarDashboard() {
    if (!Store.get('isAdmin')) { UI.toast('Acceso denegado', 'warning'); return; }
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalDashboard';
    modal.innerHTML = `
      <div class="modal-content modal-xl">
        <button class="modal-close" onclick="UI.modal('modalDashboard','close')">✕</button>
        <h2>📊 Dashboard de Ventas</h2>
        <div id="dashboardContent">
          <div class="loading-state">🔄 Cargando métricas...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    await this.cargarMetricas();
  },

  async cargarMetricas() {
    const container = document.getElementById('dashboardContent');
    try {
      // Cargar facturas y clientes
      const facturasSnap = await getDocs(collection(DB.db, "facturas"));
      const clientesSnap = await getDocs(collection(DB.db, "clientesBD"));
      
      let totalVentas = 0;
      let totalFacturas = 0;
      let clientesConCompra = new Set();
      const ventasPorProducto = {};
      const ventasPorCliente = {};
      let facturasPendientes = 0;
      let facturasCompletadas = 0;
      let montoPendiente = 0;

      // Procesar facturas
      facturasSnap.forEach(doc => {
        const data = doc.data();
        const compras = Array.isArray(data.compras) ? data.compras : [];
        
        compras.forEach(compra => {
          totalFacturas++;
          const total = Number(compra.total) || 0;
          const saldo = Number(compra.saldo) || 0;
          
          if (compra.estado === 'completado' || compra.estado === 'despachado') {
            totalVentas += total;
            facturasCompletadas++;
            clientesConCompra.add(doc.id);
          } else if (compra.estado === 'pendiente' || compra.estado === 'parcial') {
            facturasPendientes++;
            montoPendiente += saldo;
          }

          // Ventas por producto
          (compra.productos || []).forEach(prod => {
            const nombre = prod.nombre;
            if (!ventasPorProducto[nombre]) {
              ventasPorProducto[nombre] = { cantidad: 0, total: 0 };
            }
            ventasPorProducto[nombre].cantidad += prod.cantidad;
            ventasPorProducto[nombre].total += (prod.precio * prod.cantidad);
          });

          // Ventas por cliente
          if (!ventasPorCliente[doc.id]) {
            ventasPorCliente[doc.id] = { nombre: '', total: 0, facturas: 0 };
          }
          ventasPorCliente[doc.id].total += total;
          ventasPorCliente[doc.id].facturas++;
        });
      });

      // Obtener nombres de clientes
      clientesSnap.forEach(doc => {
        const data = doc.data();
        if (ventasPorCliente[doc.id]) {
          ventasPorCliente[doc.id].nombre = data.nombre || 'Sin nombre';
        }
      });

      // Top 5 productos
      const topProductos = Object.entries(ventasPorProducto)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Top 5 clientes
      const topClientes = Object.entries(ventasPorCliente)
        .map(([id, datos]) => ({ id, ...datos }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Renderizar dashboard
      container.innerHTML = `
        <div class="dashboard-grid">
          <!-- KPIs -->
          <div class="kpi-card kpi-primary">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value">₡${totalVentas.toLocaleString()}</div>
            <div class="kpi-label">Total Ventas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📄</div>
            <div class="kpi-value">${facturasCompletadas}</div>
            <div class="kpi-label">Facturas Completadas</div>
          </div>
          <div class="kpi-card kpi-warning">
            <div class="kpi-icon">⏳</div>
            <div class="kpi-value">${facturasPendientes}</div>
            <div class="kpi-label">Pendientes</div>
          </div>
          <div class="kpi-card kpi-danger">
            <div class="kpi-icon">💳</div>
            <div class="kpi-value">₡${montoPendiente.toLocaleString()}</div>
            <div class="kpi-label">Monto Pendiente</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">👥</div>
            <div class="kpi-value">${clientesConCompra.size}</div>
            <div class="kpi-label">Clientes Activos</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📊</div>
            <div class="kpi-value">${totalFacturas}</div>
            <div class="kpi-label">Total Facturas</div>
          </div>
        </div>

        <!-- Top Clientes -->
        <div class="dashboard-section">
          <h3>🏆 Top 5 Clientes Más Compradores</h3>
          <div class="top-carousel">
            ${topClientes.map((c, i) => `
              <div class="carousel-item ${i === 0 ? 'first' : ''}">
                <div class="carousel-rank">#${i + 1}</div>
                <div class="carousel-info">
                  <strong>${c.nombre || c.id}</strong>
                  <small>${c.facturas} compras</small>
                </div>
                <div class="carousel-amount">₡${c.total.toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Top Productos -->
        <div class="dashboard-section">
          <h3>🔥 Top 5 Productos Más Vendidos</h3>
          <div class="top-list">
            ${topProductos.map((p, i) => `
              <div class="top-item">
                <span class="top-rank">#${i + 1}</span>
                <span class="top-name">${p.nombre}</span>
                <span class="top-qty">${p.cantidad} unid.</span>
                <span class="top-total">₡${p.total.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Ticket Promedio -->
        <div class="dashboard-section">
          <h3>📈 Métricas Adicionales</h3>
          <div class="metrics-grid">
            <div class="metric-box">
              <span class="metric-label">Ticket Promedio</span>
              <span class="metric-value">₡${facturasCompletadas > 0 ? Math.round(totalVentas / facturasCompletadas).toLocaleString() : 0}</span>
            </div>
            <div class="metric-box">
              <span class="metric-label">Compras por Cliente</span>
              <span class="metric-value">${clientesConCompra.size > 0 ? (totalFacturas / clientesConCompra.size).toFixed(1) : 0}</span>
            </div>
            <div class="metric-box">
              <span class="metric-label">% Cobranza</span>
              <span class="metric-value">${totalVentas + montoPendiente > 0 ? ((totalVentas / (totalVentas + montoPendiente)) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      console.error(e);
      container.innerHTML = '<p style="color:red">❌ Error al cargar métricas</p>';
    }
  }
};

export default DashboardManager;