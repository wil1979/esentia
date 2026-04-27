// modules/stock-alerts.js
import { Store } from './core.js';
import { UI } from '../components/ui.js';

export const StockAlertsManager = {
  async mostrarAlertas() {
    const inventario = Store.get('inventario') || {};
    const productos = Store.get('productos') || [];
    
    // Buscar productos con stock bajo
    const productosBajos = productos.filter(p => {
      const key = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const stock = inventario[key] || 0;
      return stock <= 5;
    });

    if (productosBajos.length === 0) {
      UI.toast('✅ Todo el inventario tiene stock saludable', 'success');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalStockAlert';
    
    const listaHTML = productosBajos.map(p => {
      const key = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const stock = inventario[key] || 0;
      return `
        <div class="alert-row">
          <span>${p.nombre}</span>
          <span class="stock-badge">${stock} u.</span>
          <button class="btn-sm btn-primary" onclick="StockAlertsManager.reponerStock('${key}', '${p.nombre}')">📦 Reponer</button>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="UI.modal('modalStockAlert','close')">✕</button>
        <h2>⚠️ Stock Crítico (${productosBajos.length})</h2>
        <div class="alert-list">
          ${listaHTML}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async reponerStock(key, nombre) {
    const cantidad = parseInt(prompt(`¿Cuántas unidades de "${nombre}" deseas agregar?`));
    if (!cantidad || cantidad <= 0) return;

    const inventario = Store.get('inventario') || {};
    inventario[key] = (inventario[key] || 0) + cantidad;
    
    Store.set('inventario', inventario);
    Store.persist('inventario');
    
    UI.toast(`✅ Stock actualizado: ${nombre} tiene ${inventario[key]} unidades`, 'success');
    this.mostrarAlertas(); // Refrescar modal
  }
};

export default StockAlertsManager;