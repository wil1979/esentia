// modules/admin.js
import { getDocs, collection, addDoc, query, where, serverTimestamp, increment, deleteDoc, doc, updateDoc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { Store } from './core.js';
import { DB } from './firebase.js';
import ProductManager from './products.js';
import { InventoryService } from './inventory-service.js'; // ✅ NUEVO IMPORT
import { UI } from '../components/ui.js'; // ✅ IMPORTACIÓN CORRECTA
import { Utils } from './core.js';

const AdminManager = {
  isAdmin() {
    return Store.get('isAdmin') === true;
  },

  // ============ ESTADÍSTICAS ============
  async showStats() {
  if (!this.isAdmin()) return;
  if (document.getElementById('modalStats')) document.getElementById('modalStats').remove();

  const modal = document.createElement('div');
  modal.className = 'modal show'; modal.id = 'modalStats';
  modal.innerHTML = `
    <div class="modal-content modal-grande">
      <button class="modal-close" onclick="UI.modal('modalStats','close')">✕</button>
      <h2>📊 Estadísticas de Ventas</h2>
      <div id="statsContent" class="stats-container">
        <div class="loading-state">🔄 Calculando ventas...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const snap = await getDocs(collection(DB.db, "facturas"));
    const ventas = [];
    snap.forEach(doc => {
      const data = doc.data();
      const compras = Array.isArray(data.compras) ? data.compras : [];
      compras.forEach(c => ventas.push({ ...c, clienteId: doc.id }));
    });

    if (ventas.length === 0) {
      document.getElementById('statsContent').innerHTML = '<p class="no-data">Sin ventas registradas</p>';
      return;
    }

    // Agrupar por día
    const porDia = {};
    ventas.forEach(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-CR');
      if (!porDia[fecha]) porDia[fecha] = { total: 0, count: 0, items: [] };
      porDia[fecha].total += (Number(v.total) || 0);
      porDia[fecha].count += 1;
      (v.productos || []).forEach(p => {
        porDia[fecha].items.push({ nombre: p.nombre, cantidad: p.cantidad, total: p.total || (p.precio * p.cantidad) });
      });
    });

    const dias = Object.entries(porDia).sort((a, b) => new Date(b[0].split('/').reverse().join('-')) - new Date(a[0].split('/').reverse().join('-'))).slice(0, 7);

    let html = `<div class="stats-summary"><span>📅 Últimos 7 días</span><span>💰 Total: ₡${dias.reduce((s,d)=>s+d[1].total,0).toLocaleString()}</span></div>`;
    html += dias.map(([fecha, data]) => `
      <div class="stat-day">
        <div class="stat-header"><strong>${fecha}</strong><span>${data.count} ventas</span><strong>₡${data.total.toLocaleString()}</strong></div>
        <div class="stat-items">${data.items.slice(0,3).map(i=>`<small>• ${i.nombre} (x${i.cantidad})</small>`).join('')} ${data.items.length>3?'...':''}</div>
      </div>
    `).join('');

    document.getElementById('statsContent').innerHTML = html;
  } catch (e) {
    console.error(e);
    document.getElementById('statsContent').innerHTML = '<p style="color:#e74c3c">Error al cargar estadísticas</p>';
  }
},
  async calculateStats() {
    try {
      const visitasSnap = await getDocs(collection(DB.db, "registroVisitas"));
      const clientesSnap = await getDocs(collection(DB.db, "clientesBD"));
      const productos = Store.get('productos') || [];
      const inventario = Store.get('inventario') || {};
      
      const normalize = (n) => n?.toLowerCase().trim().replace(/\s+/g, '-');
      const productosAgotados = productos.filter(p => (inventario[normalize(p.nombre)] || 0) === 0).length;

      const clientesConCompras = [];
      for (const docSnap of clientesSnap.docs) {
        try {
          const factSnap = await DB.getInvoices(docSnap.id);
          if (factSnap?.exists?.()) {
            clientesConCompras.push({
              nombre: docSnap.data().nombre || 'Sin nombre',
              compras: factSnap.data().compras?.length || 0
            });
          }
        } catch (e) { console.warn('Error cliente:', e); }
      }

      const ventasPorDia = {};
      const hoy = new Date();
      for (let i = 6; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - i);
        ventasPorDia[fecha.toLocaleDateString('es-CR')] = 0;
      }

      return {
        totalVisitas: visitasSnap.size,
        totalClientes: clientesSnap.size,
        totalProductos: productos.length,
        productosAgotados,
        topClientes: clientesConCompras.sort((a, b) => b.compras - a.compras).slice(0, 5),
        ventasPorDia
      };
    } catch (error) {
      console.error('Error stats:', error);
      return { totalVisitas: 0, totalClientes: 0, totalProductos: 0, productosAgotados: 0, topClientes: [], ventasPorDia: {} };
    }
  },

  renderSimpleChart(data) {
    if (!data || Object.keys(data).length === 0) return '<p class="no-data">Sin datos</p>';
    const values = Object.values(data);
    const max = Math.max(...values, 1);
    return Object.entries(data).map(([fecha, valor]) => {
      const porcentaje = (valor / max) * 100;
      return `<div class="chart-bar"><div class="bar-fill" style="height: ${porcentaje}%"></div><span class="bar-label">${fecha.slice(0, 5)}</span></div>`;
    }).join('');
  },

// ============ INVENTARIO ============
async manageInventory() {
  if (!this.isAdmin()) return;
  if (document.getElementById('modalInventory')) document.getElementById('modalInventory').remove();

  // Mapear IDs reales de Firestore
  this._stockDocMap = {};
  try {
    const snap = await getDocs(collection(DB.db, "stock"));
    snap.forEach(doc => {
      const data = doc.data();
      const key = Utils.normalizeText(data.nombre);
      this._stockDocMap[key] = doc.id;
    });
  } catch (e) { console.warn("⚠️ Error mapeando stock:", e); }

  const productos = Store.get('productos') || [];
  const inventario = Store.get('inventario') || {};

  const modal = document.createElement('div');
  modal.className = 'modal admin-modal';
  modal.id = 'modalInventory';
  modal.innerHTML = `
    <div class="modal-content modal-grande">
      <button class="modal-close" onclick="UI.modal('modalInventory','close')">✕</button>
      <h2>📦 Gestión de Inventario</h2>
      <div class="inventory-toolbar">
        <input type="text" id="searchInventory" placeholder="🔍 Buscar producto...">
        <select id="filterStock">
          <option value="">Todos</option>
          <option value="agotado">Agotados</option>
          <option value="bajo">Stock bajo (≤5)</option>
          <option value="normal">Normal</option>
        </select>
        <button id="btnSaveInventory">💾 Guardar en Firestore</button>
        <button id="btnExportInventory">📥 Exportar CSV</button>
      </div>
      <div class="inventory-stats" id="inventoryStats"></div>
      <div class="inventory-grid" id="inventoryGrid">
        ${productos.map(p => this.renderInventoryRow(p, inventario)).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  UI.modal('modalInventory', 'open');

  // ✅ DELEGACIÓN DE EVENTOS UNIFICADA (botones + input manual)
  const grid = document.getElementById('inventoryGrid');
  
  // Botones +/-
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-stock-adjust');
    if (!btn) return;
    const row = btn.closest('.inventory-row');
    const input = row.querySelector('.stock-input');
    const delta = parseInt(btn.dataset.delta);
    let val = Math.max(0, parseInt(input.value) + delta);
    input.value = val;
    this._markModified(row, val);
  });

  // ✅ Input manual: escuchar 'change' (cuando pierde foco) y 'keyup' (Enter)
  grid.addEventListener('change', e => {
    const input = e.target.closest('.stock-input');
    if (!input) return;
    const row = input.closest('.inventory-row');
    const val = Math.max(0, parseInt(input.value) || 0);
    input.value = val;
    this._markModified(row, val);
  });
  
  grid.addEventListener('keyup', e => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('.stock-input');
    if (!input) return;
    input.blur(); // Forzar evento 'change'
  });

  // Filtros y botones
  document.getElementById('searchInventory')?.addEventListener('input', e => this._filterInventory(e.target.value));
  document.getElementById('filterStock')?.addEventListener('change', e => this._filterStock(e.target.value));
  document.getElementById('btnSaveInventory')?.addEventListener('click', () => this.saveInventory());
  document.getElementById('btnExportInventory')?.addEventListener('click', () => this.exportInventory());

  this.updateInventoryStats();
},

renderInventoryRow(producto, inventario) {
  const key = Utils.normalizeText(producto.nombre);
  const stock = inventario[key] ?? 0;
  const cls = stock === 0 ? 'agotado' : stock <= 5 ? 'bajo' : 'normal';
  const img = producto.imagen?.startsWith('http') ? producto.imagen : `https://wil1979.github.io/esentia-factura/${producto.imagen || 'images/placeholder.png'}`;
  const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24'%3E📦%3C/text%3E%3C/svg%3E";

  // ✅ SIN onchange inline: todo se maneja por delegación en manageInventory()
  return `
    <div class="inventory-row" data-key="${key}" data-stock="${stock}">
      <img src="${img}" alt="${producto.nombre}" class="inv-img" width="60" height="60" loading="lazy" onerror="this.src='${fallback}'">
      <div class="inv-info"><strong>${producto.nombre}</strong><span class="inv-tipo">${producto.tipo || '-'}</span></div>
      <div class="inv-stock-control">
        <button class="btn-stock-adjust" data-delta="-1">−</button>
        <input type="number" class="stock-input ${cls}" value="${stock}" min="0">
        <button class="btn-stock-adjust" data-delta="1">+</button>
      </div>
      <span class="stock-badge ${cls}">${stock === 0 ? '❌ Agotado' : stock <= 5 ? '⚠️ Bajo' : '✓ OK'}</span>
    </div>`;
},

_markModified(row, stock) {
  row.dataset.stock = stock;
  const cls = stock === 0 ? 'agotado' : stock <= 5 ? 'bajo' : 'normal';
  const input = row.querySelector('.stock-input');
  const badge = row.querySelector('.stock-badge');
  if (input) input.className = `stock-input ${cls}`;
  if (badge) { 
    badge.className = `stock-badge ${cls}`; 
    badge.textContent = stock === 0 ? '❌ Agotado' : stock <= 5 ? '⚠️ Bajo' : '✓ OK'; 
  }
  row.classList.add('modified');
  this.updateInventoryStats();
},

_filterInventory(q) {
  const term = q?.toLowerCase() || '';
  document.querySelectorAll('.inventory-row').forEach(r => {
    r.style.display = r.querySelector('strong')?.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
},

_filterStock(filter) {
  document.querySelectorAll('.inventory-row').forEach(r => {
    const s = parseInt(r.dataset.stock) || 0;
    const show = !filter || (filter === 'agotado' ? s===0 : filter==='bajo' ? (s>0&&s<=5) : s>5);
    r.style.display = show ? '' : 'none';
  });
},

updateInventoryStats() {
  const el = document.getElementById('inventoryStats');
  if (!el) return;
  const productos = Store.get('productos') || [];
  const inv = Store.get('inventario') || {};
  let agot = 0, bajo = 0;
  productos.forEach(p => {
    const s = inv[Utils.normalizeText(p.nombre)] ?? 0;
    if (s === 0) agot++; else if (s <= 5) bajo++;
  });
  el.innerHTML = `<span>📦 ${productos.length}</span><span class="warning">⚠️ ${bajo} bajos</span><span class="error">❌ ${agot} agotados</span>`;
},

async saveInventory() {
  const modified = document.querySelectorAll('.inventory-row.modified');
  if (modified.length === 0) { UI.toast('No hay cambios pendientes', 'info'); return; }

  try {
    let count = 0;
    for (const row of modified) {
      const nombre = row.querySelector('strong').textContent;
      const nuevoStock = parseInt(row.dataset.stock);
      const key = row.dataset.key;
      const docId = this._stockDocMap?.[key] || key;

      await setDoc(doc(DB.db, "stock", docId), { 
        nombre: nombre,
        cantidad: nuevoStock, 
        ultimaActualizacion: new Date().toISOString() 
      }, { merge: true });
      
      this._stockDocMap[key] = docId;
      count++;
    }
    UI.toast(`✅ ${count} producto(s) sincronizados`, 'success');
    modified.forEach(r => r.classList.remove('modified'));
    Store.emit('inventory:updated');
  } catch (err) {
    console.error('Error guardando:', err);
    UI.toast('❌ Error al guardar en Firestore', 'error');
  }
},

exportInventory() {
  const productos = Store.get('productos') || [];
  const inv = Store.get('inventario') || {};
  let csv = 'Nombre,Tipo,Precio,Stock,Estado\n';
  productos.forEach(p => {
    const key = Utils.normalizeText(p.nombre);
    const s = inv[key] ?? 0;
    csv += `"${p.nombre}","${p.tipo||''}",${p.precio||0},${s},"${s===0?'Agotado':s<=5?'Bajo':'Normal'}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  UI.toast('📥 CSV descargado', 'success');
},


// ============ PROMOCIONES ============
async managePromos() {
  if (!this.isAdmin()) return;
  if (document.getElementById('modalPromos')) {
    document.getElementById('modalPromos').remove();
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal admin-modal';
  modal.id = 'modalPromos';
  modal.innerHTML = `
    <div class="modal-content modal-grande">
      <button class="modal-close" onclick="document.getElementById('modalPromos').remove(); UI.modal('modalPromos','close')">✕</button>
      <h2>🎁 Códigos Promocionales</h2>
      <div class="promo-toolbar">
        <button id="btnCreatePromo" class="btn-primary">+ Crear Código</button>
        <button id="btnAutoPromo">⚡ Generar Auto</button>
        <button id="btnRefreshPromos">🔄 Actualizar</button>
      </div>
      <div id="promoListContainer" style="margin-top:1rem;">Cargando...</div>
    </div>
  `;
  document.body.appendChild(modal);
  UI.modal('modalPromos', 'open');

  await this._loadAndRenderPromos();

  document.getElementById('btnCreatePromo')?.addEventListener('click', () => this._createPromoUI());
  document.getElementById('btnAutoPromo')?.addEventListener('click', () => this.generateAutoPromo());
  document.getElementById('btnRefreshPromos')?.addEventListener('click', () => this._loadAndRenderPromos());
},

async _loadAndRenderPromos() {
  const container = document.getElementById('promoListContainer');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;color:#6b7280;">Cargando promociones...</p>';
  
  try {
    const promos = await this.loadPromos();
    if (!promos.length) {
      container.innerHTML = '<p class="empty-state">No hay promociones activas</p>';
      return;
    }
    container.innerHTML = promos.map(p => this._renderPromoRow(p)).join('');
    
    // Attach dynamic listeners
    document.querySelectorAll('.btn-edit-promo').forEach(btn => btn.addEventListener('click', (e) => this.editPromo(e.target.dataset.id)));
    document.querySelectorAll('.btn-delete-promo').forEach(btn => btn.addEventListener('click', (e) => this.deletePromo(e.target.dataset.id)));
    document.querySelectorAll('.btn-users-promo').forEach(btn => btn.addEventListener('click', (e) => this._showPromoUsers(e.target.dataset.id, e.target.dataset.code)));
    
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p style="color:#e74c3c;">Error al cargar</p>';
  }
},

_renderPromoRow(promo) {
  const expirada = promo.fechaExpiracion && new Date(promo.fechaExpiracion) < new Date();
  const agotada = promo.usosMax && promo.usosActuales >= promo.usosMax;
  const status = expirada ? 'expirada' : agotada ? 'agotada' : 'activa';
  const usosDisplay = promo.clientesUsados?.length ? `${promo.clientesUsados.length} usuario(s)` : `${promo.usosActuales || 0}/${promo.usosMax || '∞'}`;
  
  return `
    <div class="promo-row ${status}">
      <div class="promo-code">${promo.codigo}</div>
      <div class="promo-details">
        <span>${promo.tipo === 'porcentaje' ? promo.valor + '%' : '₡' + (promo.valor || 0)}</span>
        <span>Usos: ${usosDisplay}</span>
      </div>
      <div class="promo-actions">
        ${promo.clientesUsados?.length ? `<button class="btn-users-promo" data-id="${promo.id}" data-code="${promo.codigo}" title="Ver quién usó">👥</button>` : ''}
        <button class="btn-edit-promo" data-id="${promo.id}">✏️</button>
        <button class="btn-delete-promo" data-id="${promo.id}">🗑️</button>
      </div>
    </div>
  `;
},

async _showPromoUsers(promoId, code) {
  try {
    const snap = await getDoc(doc(DB.db, "promociones", promoId));
    if (!snap.exists() || !snap.data().clientesUsados?.length) {
      UI.toast('No hay registros de uso', 'info');
      return;
    }
    const userIds = snap.data().clientesUsados;
    const clients = [];
    for (const uid of userIds) {
      const cSnap = await getDoc(doc(DB.db, "clientesBD", uid));
      if (cSnap.exists()) clients.push(cSnap.data().nombre || uid.slice(0,6));
    }
    alert(`👥 Usuarios que usaron ${code}:\n\n${clients.join('\n') || 'Anónimos'}`);
  } catch (e) { UI.toast('Error al cargar usuarios', 'error'); }
},

async loadPromos() {
  try {
    const snap = await DB.getPromos();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  } catch { return []; }
},

async deletePromo(id) {
  if (!confirm('¿Eliminar este código permanentemente?')) return;
  try {
    await deleteDoc(doc(DB.db, "promociones", id));
    UI.toast('✓ Eliminado', 'success');
    this._loadAndRenderPromos();
  } catch (e) { UI.toast('Error', 'error'); }
},

async editPromo(id) {
  try {
    const snap = await getDoc(doc(DB.db, "promociones", id));
    if (!snap.exists()) return;
    const current = snap.data();
    const nuevoCodigo = prompt('Editar código:', current.codigo);
    if (nuevoCodigo === null) return;
    await updateDoc(doc(DB.db, "promociones", id), { codigo: nuevoCodigo.toUpperCase().trim(), fechaActualizacion: serverTimestamp() });
    UI.toast('✓ Actualizado', 'success');
    this._loadAndRenderPromos();
  } catch (e) { UI.toast('Error', 'error'); }
},

async _createPromoUI() {
  const codigo = prompt('Código (ej: ESENTIA10):'); 
  if (!codigo?.trim()) return;
  const tipo = prompt('Tipo (porcentaje/fijo):', 'porcentaje') || 'porcentaje';
  const valor = parseInt(prompt('Valor:', '10')) || 10;
  const usosMax = prompt('Usos máximos (vacío = ∞):') ? parseInt(prompt('Usos máximos:')) : null;
  const dias = parseInt(prompt('Válido por (días):', '30')) || 30;
  
  try {
    await addDoc(collection(DB.db, "promociones"), {
      codigo: codigo.toUpperCase().trim(), tipo, valor, usosMax: isNaN(usosMax) ? null : usosMax,
      usosActuales: 0, clientesUsados: [],
      fechaCreacion: new Date().toISOString(),
      fechaExpiracion: new Date(Date.now() + dias * 86400000).toISOString(), 
      activo: true
    });
    UI.toast('✓ Creado', 'success');
    this._loadAndRenderPromos(); // ✅ Refresca SIN cerrar ni recrear modal
  } catch (e) { UI.toast('Error al crear', 'error'); }
},

async generateAutoPromo() {
  const codigo = 'ESENTIA' + Math.floor(Math.random() * 10000);
  try {
    await addDoc(collection(DB.db, "promociones"), {
      codigo, tipo: 'porcentaje', valor: 10, usosMax: 1, usosActuales: 0, clientesUsados: [],
      fechaCreacion: new Date().toISOString(), fechaExpiracion: new Date(Date.now() + 86400000).toISOString(),
      activo: true, autoGenerado: true
    });
    navigator.clipboard?.writeText(codigo);
    UI.toast(`🎁 ${codigo} copiado al portapapeles`, 'success');
    this._loadAndRenderPromos();
  } catch (e) { UI.toast('Error', 'error'); }
},

  // ============ NOTIFICACIONES ============
  async sendNotification() {
    if (!this.isAdmin()) return;
    
    const mensaje = prompt('Mensaje para todos los clientes:'); 
    if (!mensaje?.trim()) return;
    
    const titulo = prompt('Título:', 'Esentia') || 'Esentia';
    const cliente = Store.get('cliente') || {};
    
    try {
      await addDoc(collection(DB.db, "notificaciones"), {
        titulo, 
        mensaje: mensaje.trim(), 
        fecha: serverTimestamp(),
        enviadoPor: cliente.id || 'admin', 
        leidaPor: []
      });
      UI.toast('🔔 Notificación enviada', 'success');
    } catch (error) { 
      console.error('Error:', error); 
    }
  },

  // ============ VISITAS ============
  async showVisits() {
    if (!this.isAdmin()) return;
  const modal = document.createElement('div');
  modal.className = 'modal admin-modal'; 
  modal.id = 'modalVisits';
  
  modal.innerHTML = `
    <div class="modal-content modal-grande">
      <button class="modal-close" onclick="document.getElementById('modalVisits').remove(); UI.modal('modalVisits','close')">✕</button>
      <h2>👁️ Visitas Recientes</h2>
      <div id="visitsContent">Cargando...</div>
      <button id="btnClearVisits" style="margin-top:1rem; background:#e74c3c; color:white; padding:8px 16px; border:none; border-radius:8px; cursor:pointer; width:100%; font-weight:600;">🗑️ Borrar Historial de Visitas</button>
    </div>
  `;
  
  document.body.appendChild(modal); 
  UI.modal('modalVisits', 'open');
  
  document.getElementById('btnClearVisits')?.addEventListener('click', () => this.clearVisits());
  
  try {
    const snap = await getDocs(collection(DB.db, "registroVisitas"));
    const visitas = []; 
    snap.forEach(d => visitas.push({ id: d.id, ...d.data() }));
    
    if (visitas.length === 0) { 
      document.getElementById('visitsContent').innerHTML = '<p class="no-data">Sin visitas registradas</p>'; 
      return; 
    }
    
    const porDia = {};
    visitas.forEach(v => {
      const fecha = v.ultimaVisita?.toDate?.() || new Date(v.ultimaVisita) || new Date();
      const key = fecha.toLocaleDateString('es-CR');
      if (!porDia[key]) porDia[key] = []; 
      porDia[key].push(v);
    });
    
    document.getElementById('visitsContent').innerHTML = Object.entries(porDia)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 7)
      .map(([fecha, lista]) => `
        <div class="visit-day">
          <h4>${fecha} (${lista.length} visitas)</h4>
          <div class="visit-list">
            ${lista.map(v => `
              <div class="visit-item">
                <span>${v.nombre || v.clienteId || 'Anónimo'}</span>
                <small>${v.ultimaVisita?.toDate?.().toLocaleTimeString?.() || ''}</small>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
  } catch (error) { 
    console.error('Error:', error); 
  }
},

// ✅ NUEVO MÉTODO: Borrar visitas de forma segura
async clearVisits() {
  if (!confirm('⚠️ ¿Borrar TODO el historial de visitas? Esta acción no se puede deshacer.')) return;
  try {
    const snap = await getDocs(collection(DB.db, "registroVisitas"));
    if (snap.empty) { UI.toast('No hay visitas que borrar', 'info'); return; }
    
    const batch = writeBatch(DB.db);
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    UI.toast('🗑️ Historial borrado correctamente', 'success');
    this.showVisits(); // Refrescar modal
  } catch (e) {
    console.error(e);
    UI.toast('Error al borrar visitas', 'error');
    }
  },

// ============ FACTURACIÓN RÁPIDA ============
async quickInvoice() {
  if (!this.isAdmin()) return;
  if (document.getElementById('modalQuickInvoice')) document.getElementById('modalQuickInvoice').remove();
  
  const modal = document.createElement('div');
  modal.className = 'modal admin-modal';
  modal.id = 'modalQuickInvoice';
  modal.innerHTML = `
    <div class="modal-content modal-grande">
      <button class="modal-close" onclick="document.getElementById('modalQuickInvoice').remove(); UI.modal('modalQuickInvoice','close')">✕</button>
      <h2>🧾 Facturación Rápida</h2>
      <div class="quick-invoice-form">
        <div class="client-search">
          <input type="text" id="quickClientSearch" placeholder="🔍 Buscar por nombre, cédula o teléfono...">
          <div id="quickClientResults" class="search-results"></div>
        </div>
        <div id="quickSelectedClient" class="selected-client" style="display:none;">
          <span id="quickClientName"></span>
          <button onclick="AdminManager.clearQuickClient()">×</button>
        </div>
        <div class="quick-products">
          <h4>Productos</h4>
          <div id="quickProductList"></div>
          <button onclick="AdminManager.addQuickProduct()">+ Agregar Producto</button>
        </div>
        <div class="quick-totals">
          <div class="total-row"><span>Subtotal:</span><span id="quickSubtotal">₡0</span></div>
          <div class="total-row"><span>Descuento:</span><input type="number" id="quickDiscount" value="0" min="0" onchange="AdminManager.calculateQuickTotal()"></div>
          <div class="total-row total-final"><span>TOTAL:</span><span id="quickTotal">₡0</span></div>
        </div>
        <div class="quick-payment">
          <select id="quickPaymentMethod">
            <option value="efectivo">Efectivo</option>
            <option value="sinpe">SINPE</option>
            <option value="credito">Crédito</option>
          </select>
          <button onclick="AdminManager.confirmQuickInvoice()" class="btn-primary">✅ Confirmar Factura</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  UI.modal('modalQuickInvoice', 'open');

  // 🔄 Cargar clientes UNA VEZ y filtrar localmente (instantáneo)
  this._clientCache = await this._loadAllClients();
  document.getElementById('quickClientSearch')?.addEventListener('input', (e) => this._filterQuickClients(e.target.value));

  this.quickInvoiceItems = [];
  this.quickClientId = null;
  this.quickInvoiceTotal = 0;
  this.quickInvoiceDiscount = 0;
  this.renderQuickProducts();
},

async _loadAllClients() {
  try {
    const snap = await getDocs(collection(DB.db, "clientesBD"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('⚠️ Error cargando clientesBD:', e);
    return [];
  }
},

_filterQuickClients(query) {
  const resultsDiv = document.getElementById('quickClientResults');
  if (!query || query.length < 2) { resultsDiv.innerHTML = ''; return; }
  
  const q = query.toLowerCase().trim();
  // ✅ Búsqueda exacta en los campos de tu colección: nombre, cedula, telefono
  const matches = this._clientCache.filter(c => 
    (c.nombre?.toLowerCase().includes(q)) ||
    (c.cedula?.toLowerCase().includes(q)) ||
    (c.telefono?.includes(q))
  ).slice(0, 15); // Límite visual para rendimiento

  resultsDiv.innerHTML = matches.length 
    ? matches.map(c => `
        <div class="search-result-item" onclick="AdminManager.selectQuickClient('${c.id}', '${(c.nombre||'Sin nombre').replace(/'/g, "\\'")}')">
          <strong>${c.nombre || 'Sin nombre'}</strong>
          <small>CC: ${c.cedula || 'N/A'} | 📱 ${c.telefono || ''}</small>
        </div>
      `).join('')
    : '<p class="no-data">No se encontraron clientes</p>';
},

selectQuickClient(id, nombre) {
  this.quickClientId = id;
  document.getElementById('quickClientName').textContent = nombre;
  document.getElementById('quickSelectedClient').style.display = 'flex';
  document.getElementById('quickClientResults').innerHTML = '';
  document.getElementById('quickClientSearch').value = '';
},

clearQuickClient() {
  this.quickClientId = null;
  document.getElementById('quickSelectedClient').style.display = 'none';
  document.getElementById('quickClientSearch').value = '';
  document.getElementById('quickClientResults').innerHTML = '';
},

addQuickProduct() {
  const productos = (Store.get('productos') || []).filter(p => ProductManager.isAvailable?.(p) || true);
  if (!productos.length) { UI.toast('Sin productos disponibles', 'warning'); return; }
  
  const opciones = productos.map((p, i) => `${String(i+1).padStart(2,'0')}. ${p.nombre} - ₡${p.precio||0}`).join('\n');
  const seleccion = prompt(`Selecciona producto:\n${opciones}\n\nNúmero:`);
  if (!seleccion) return;
  
  const index = parseInt(seleccion) - 1;
  if (isNaN(index) || index < 0 || index >= productos.length) { UI.toast('Selección inválida', 'warning'); return; }
  
  const producto = productos[index];
  const cantidad = parseInt(prompt('Cantidad:', '1')) || 1;
  if (cantidad <= 0) return;
  
  this.quickInvoiceItems.push({ 
    id: producto.id, 
    nombre: producto.nombre, 
    precio: producto.precio || 0, 
    cantidad, 
    total: (producto.precio || 0) * cantidad 
  });
  this.renderQuickProducts();
  this.calculateQuickTotal();
  UI.toast(`✓ ${producto.nombre} agregado`, 'success');
},

renderQuickProducts() {
  const container = document.getElementById('quickProductList');
  if (!container) return;
  container.innerHTML = !this.quickInvoiceItems?.length 
    ? '<p class="no-data">Sin productos</p>'
    : this.quickInvoiceItems.map((item, i) => `
        <div class="quick-product-item">
          <span>${item.nombre} × ${item.cantidad}</span>
          <span>₡${(item.total||0).toLocaleString('es-CR')}</span>
          <button onclick="AdminManager.removeQuickProduct(${i})" class="btn-remove">×</button>
        </div>`).join('');
},

removeQuickProduct(index) {
  if (this.quickInvoiceItems?.[index]) {
    this.quickInvoiceItems.splice(index, 1);
    this.renderQuickProducts();
    this.calculateQuickTotal();
  }
},

calculateQuickTotal() {
  const subtotal = (this.quickInvoiceItems || []).reduce((s, i) => s + (i.total || 0), 0);
  const discount = parseInt(document.getElementById('quickDiscount')?.value) || 0;
  const total = Math.max(0, subtotal - discount);
  document.getElementById('quickSubtotal').textContent = '₡' + subtotal.toLocaleString('es-CR');
  document.getElementById('quickTotal').textContent = '₡' + total.toLocaleString('es-CR');
  this.quickInvoiceTotal = total;
  this.quickInvoiceDiscount = discount;
},

async confirmQuickInvoice() {
  if (!this.quickClientId) { UI.toast('Selecciona un cliente', 'warning'); return; }
  if (!this.quickInvoiceItems?.length) { UI.toast('Agrega productos', 'warning'); return; }
  
  const metodo = document.getElementById('quickPaymentMethod')?.value || 'efectivo';
  const esCredito = metodo === 'credito';
  
  const invoice = {
    fecha: new Date().toISOString(),
    productos: this.quickInvoiceItems.map(i => ({ 
      cantidad: i.cantidad, 
      idProducto: String(i.id), 
      nombre: i.nombre, 
      precio: i.precio, 
      variante: 'Única', 
      total: i.total 
    })),
    total: this.quickInvoiceTotal || 0,
    descuento: this.quickInvoiceDiscount || 0,
    metodoPago: metodo.toUpperCase(),
    tipoPago: esCredito ? 'credito' : 'contado',
    pagado: esCredito ? 0 : (this.quickInvoiceTotal || 0),
    saldo: esCredito ? (this.quickInvoiceTotal || 0) : 0,
    estado: 'completado'
  };

  try {
    await DB.addInvoice(this.quickClientId, invoice);
    
    // Actualizar inventario local
    const inventario = Store.get('inventario') || {};
    const normalize = (n) => n?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    for (const item of this.quickInvoiceItems) {
      const key = normalize(item.nombre);
      const actual = inventario[key] || 0;
      inventario[key] = Math.max(0, actual - item.cantidad);
    }
    Store.set('inventario', inventario);
    Store.persist('inventario');
    
    // Sello de lealtad
    if (window.LoyaltyManager?.addStamp) await window.LoyaltyManager.addStamp(this.quickClientId);
    
     // ✅ NUEVO: Mostrar comprobante admin con opción WhatsApp
      this.showAdminReceipt(invoice, this.quickClientId);

    
    UI.toast('✅ Factura creada correctamente', 'success');
    UI.modal('modalQuickInvoice', 'close');
    this.quickInvoiceItems = [];
    this.quickClientId = null;
  } catch (error) {
    console.error('Error facturando:', error);
    UI.toast('❌ Error al guardar factura', 'error');
  }
},

  // ✅ NUEVO MÉTODO: Comprobante para Admin
  showAdminReceipt(invoice, clientId) {
    const cliente = this._clientCache?.find(c => c.id === clientId) || { nombre: 'Cliente', telefono: '' };
    const modal = document.createElement('div');
    modal.className = 'modal show'; modal.id = 'modalAdminReceipt';
    
    const waText = `🧾 *FACTURA ESENTIA*\n👤 ${cliente.nombre}\n📅 ${new Date(invoice.fecha).toLocaleDateString()}\n\n${invoice.productos.map(p => `• ${p.nombre} x${p.cantidad} = ₡${(p.precio*p.cantidad).toLocaleString()}`).join('\n')}\n\n💰 *Total: ₡${invoice.total.toLocaleString()}*\n💳 Método: ${invoice.metodoPago}`;

    modal.innerHTML = `
      <div class="modal-content modal-grande">
        <button class="modal-close" onclick="UI.modal('modalAdminReceipt','close')">✕</button>
        <h2>✅ Factura Registrada</h2>
        <p><strong>Cliente:</strong> ${cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${invoice.total.toLocaleString()}</p>
        <p><strong>Método:</strong> ${invoice.metodoPago}</p>
        <div style="margin:1rem 0; padding:1rem; background:#f8f9fa; border-radius:8px; max-height:150px; overflow-y:auto;">
          ${invoice.productos.map(p => `<div style="padding:4px 0; border-bottom:1px dashed #ddd;">${p.nombre} × ${p.cantidad} → ₡${(p.precio*p.cantidad).toLocaleString()}</div>`).join('')}
        </div>
        <div style="display:flex; gap:10px; margin-top:1.5rem;">
          <button id="btnWaAdmin" style="flex:1; background:#25d366; color:white; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight:600;">📱 Copiar y Abrir WA</button>
          <button onclick="UI.modal('modalAdminReceipt','close')" style="flex:1; background:#e74c3c; color:white; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight:600;">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('btnWaAdmin').addEventListener('click', async () => {
      await navigator.clipboard.writeText(waText);
      UI.toast('📋 Texto copiado al portapapeles', 'success');
      setTimeout(() => window.open(`https://wa.me/${cliente.telefono || '50672952454'}?text=${encodeURIComponent(waText)}`, '_blank'), 800);
    });
  }
};

export default AdminManager;    