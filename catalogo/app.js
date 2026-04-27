// app.js
import { Store, Utils } from './modules/core.js';
import { DB } from './modules/firebase.js';
import ProductManager from './modules/products.js';
import CartManager from './modules/cart.js';
import AuthManager from './modules/auth.js';
import { UI } from './components/ui.js';
import { ProductCard } from './components/product-card.js';
import LoyaltyManager from './modules/loyalty.js';
import AdminManager from './modules/admin.js';
import { ComprasManager } from './modules/compras-proveedor.js'; // ✅ AGREGAR
import { CobrosManager } from './modules/cobros.js';
import { FacturaEditor } from './modules/factura-editor.js';
import { LoyaltyControl } from './modules/loyalty-control.js';
import PedidosManager from './modules/pedidos.js'; // ✅ Agregar esta línea
import UserManager from './modules/user-management.js'; // ✅ AGREGAR ESTA LÍNEA
import ClientesManager from './modules/clientes-manager.js'; // ✅ NUEVO
import DashboardManager from './modules/dashboard.js'; // ✅ AGREGAR
import FacturacionRapidaV2  from './modules/facturacion-rapida-v2.js'; // ✅ NUEVO
import StockAlertsManager from './modules/stock-alerts.js'; // ✅ NUEVO
import BackupManager from './modules/backup-manager.js';    // ✅ NUEVO
import ProformasManager from './modules/proformas-compras.js'; // ✅ NUEVO
import HistorialComprasManager from './modules/historial-compras.js';
import ImpresionManager from './modules/impresion.js';


window.UI = UI;
window.Store = Store;
window.Utils = Utils;
window.LoyaltyManager = LoyaltyManager;
window.AdminManager = AdminManager;
window.ComprasManager = ComprasManager; // ✅ AGREGAR
window.AuthManager = AuthManager;
window.CartManager = CartManager;
window.ProductManager = ProductManager;
window.CobrosManager = CobrosManager;
window.FacturaEditor = FacturaEditor;
window.LoyaltyControl = LoyaltyControl;
window.PedidosManager = PedidosManager; // ✅ Agregar esta línea
window.UserManager = UserManager; // ✅ AGREGAR
window.ClientesManager = ClientesManager; // ✅ NUEVO
window.DashboardManager = DashboardManager; // ✅ AGREGAR
window.FacturacionRapidaV2 = FacturacionRapidaV2; // ✅ NUEVO
window.StockAlertsManager = StockAlertsManager; // ✅ NUEVO
window.BackupManager = BackupManager;           // ✅ NUEVO
window.ProformasManager = ProformasManager; // ✅ NUEVO
window.HistorialComprasManager = HistorialComprasManager;
window.ImpresionManager = ImpresionManager;


const App = {
  currentTab: 'login',
  appliedPromo: null, // ✅ NUEVO: Guarda el descuento aplicado temporalmente
  // ... resto del código ..

async integrarJSONsLocales() {
  console.log('📦 Integrando catálogos locales (Limpieza y Velas)...');
  const productosActuales = Store.get('productos') || [];
  let nuevosProductos = [];
  
  try {
    // Función para limpiar claves con espacios
    const limpiarClaves = (obj) => {
      const limpio = {};
      Object.keys(obj).forEach(k => {
        const key = k.trim();
        const val = typeof obj[k] === 'string' ? obj[k].trim() : obj[k];
        limpio[key] = val;
      });
      return limpio;
    };

    // 1. Cargar Limpieza
    try {
      const resLimpieza = await fetch('./data/productos_limpieza_completo.json');
      if (resLimpieza.ok) {
        const dataLimpieza = await resLimpieza.json();
        const productosLimpieza = dataLimpieza.map(p => {
          const pLimpio = limpiarClaves(p);
          return {
            id: pLimpio.id,
            nombre: pLimpio.nombre,
            tipo: 'Limpieza',
            precio: pLimpio.precioPublico || pLimpio.precio,
            categoria: pLimpio.categoria || 'General',
            variantes: (pLimpio.aromas && pLimpio.aromas.length > 0) 
              ? pLimpio.aromas.map(a => ({ nombre: a, precio: pLimpio.precioPublico })) 
              : [{ nombre: 'Única', precio: pLimpio.precioPublico }],
            stock: 0,
            activo: pLimpio.disponible !== false,
            imagen: pLimpio.imagen || 'images/default.png',
            precioCompra: pLimpio.precioCompra || 0
          };
        });
        nuevosProductos = [...nuevosProductos, ...productosLimpieza];
        console.log(`✅ Limpieza: ${productosLimpieza.length} productos`);
      }
    } catch (e) {
      console.warn('⚠️ Error cargando limpieza:', e);
    }

    // 2. Cargar Velas
    try {
      const resVelas = await fetch('./data/catalogo-velas.json');
      if (resVelas.ok) {
        const dataVelasRaw = await resVelas.json();
        const dataVelas = Array.isArray(dataVelasRaw) ? dataVelasRaw : [dataVelasRaw];
        
        const productosVelas = dataVelas.map(p => {
          const pLimpio = limpiarClaves(p);
          return {
            id: pLimpio.id,
            nombre: pLimpio.nombre,
            tipo: 'Velas',
            precio: pLimpio.precio || pLimpio.precioPublico,
            categoria: (pLimpio.tipo ? pLimpio.tipo.split('|')[0] : 'Decoración'),
            variantes: pLimpio.variantes || [{ nombre: 'Única', precio: pLimpio.precio }],
            stock: pLimpio.stock || 0,
            activo: pLimpio.disponible !== false,
            imagen: pLimpio.imagen,
            precioCompra: pLimpio.precioCompra || 0
          };
        });
        nuevosProductos = [...nuevosProductos, ...productosVelas];
        console.log(`✅ Velas: ${productosVelas.length} productos`);
      }
    } catch (e) {
      console.warn('⚠️ Error cargando velas:', e);
    }

    // 3. Fusionar evitando duplicados
    const idsExistentes = new Set(productosActuales.map(p => p.id));
    const productosUnicos = nuevosProductos.filter(p => !idsExistentes.has(p.id));
    
    Store.set('productos', [...productosActuales, ...productosUnicos]);
    console.log(`✅ Total integrados: ${productosUnicos.length} productos locales`);
  } catch (error) {
    console.error('❌ Error en integrarJSONsLocales:', error);
  }
},


 async init() {
  console.log('🌸 Esentia v6.2 - Iniciando...');
  await Store.init();
  await ClientesManager.init();
  if (window.UserManager) await UserManager.syncAdminRights();
  
  const hasSession = AuthManager.checkSession();
  CartManager.init();
  await ProductManager.load();
  
  // ✅ CORREGIDO: Usar 'this.'
  await this.integrarJSONsLocales(); 
  
  this.renderHeader();
  this.renderProducts();
  this.attachGlobalEvents();
  
  if (hasSession) {
    await LoyaltyManager.init();
    if (Store.get('isAdmin')) {
      PedidosManager.verificarNotificacionPedidos();
    }
  } else {
    setTimeout(() => UI.modal('modalLogin', 'open'), 800);
  }
  console.log('✅ Esentia lista');
},

 renderHeader() {
  const cliente = Store.get('cliente');
  const isAdmin = Store.get('isAdmin');
  const userPanel = document.getElementById('panelUsuario');
  const loginBtn = document.getElementById('btnLogin');
  const adminMenu = document.getElementById('adminDropdownContainer');
  const loyaltyContainer = document.getElementById('loyaltyContainer'); 

  if (cliente) {
    userPanel && (userPanel.style.display = 'flex');
    document.getElementById('nombreUsuario').textContent = cliente.nombre;
    loginBtn && (loginBtn.style.display = 'none');
    adminMenu && (adminMenu.style.display = isAdmin ? 'inline-block' : 'none');
    
    // ✅ FORZAR RENDER DE LEALTAD
    if (loyaltyContainer) {
      loyaltyContainer.style.display = 'block';
      if (window.LoyaltyManager) {
        window.LoyaltyManager.renderCard(); // 👈 ESTO ES LO QUE FALTABA
      }
    }
  } else {
    userPanel && (userPanel.style.display = 'none');
    loginBtn && (loginBtn.style.display = 'inline-block');
    adminMenu && (adminMenu.style.display = 'none');
    
    if (loyaltyContainer) loyaltyContainer.style.display = 'none';
  }
 },
  renderProducts() {
    const container = document.getElementById('productos-container');
    const loader = document.getElementById('loader');
    if (!container) return;
    
    const productos = Store.get('productos');
    const disponibles = productos.filter(p => ProductManager.isAvailable(p));
    if (loader) loader.style.display = 'none';
    container.style.display = 'block';
    ProductCard.renderGrid(disponibles, container);
    this.fillTipoFilter(productos);
  },

  fillTipoFilter(productos) {
    const select = document.getElementById('filtroTipo');
    if (!select || select.options.length > 1) return;
    const tipos = [...new Set(productos.map(p => p.tipo).filter(Boolean))].sort();
    tipos.forEach(tipo => {
      const opt = document.createElement('option');
      opt.value = tipo; opt.textContent = tipo; select.appendChild(opt);
    });
  },

  attachGlobalEvents() {
    // 🔗 PUENTE CRÍTICO: Conectar emisión de product-card con el carrito
    Store.on('cart:add', ({ product, variant }) => {
      CartManager.add(product, variant);
    });

    // Login
    document.getElementById('btnLogin')?.addEventListener('click', () => UI.modal('modalLogin', 'open'));

    // Búsqueda
    document.getElementById('searchInput')?.addEventListener('input', Utils.debounce((e) => {
      const query = e.target.value;
      const results = query.trim() ? ProductManager.search(query, { fuzzy: true, limit: 50 }) : Store.get('productos');
      ProductCard.renderGrid(results, document.getElementById('productos-container'));
    }, 300));

    // Filtros
    const btnFiltros = document.getElementById('btnFiltros');
    const panelFiltros = document.getElementById('panelFiltros');
    btnFiltros && panelFiltros && btnFiltros.addEventListener('click', () => {
      const isHidden = panelFiltros.style.display === 'none' || !panelFiltros.style.display;
      panelFiltros.style.display = isHidden ? 'flex' : 'none';
      panelFiltros.classList.toggle('show', isHidden);
    });

    // 📋 HISTORIAL DE COMPRAS
   const btnHistorial = document.getElementById('btnHistorial');
   if (btnHistorial) {
     btnHistorial.addEventListener('click', () => this.showHistorial());
}

    document.getElementById('btnAplicarFiltros')?.addEventListener('click', () => {
      const criteria = {
        tipo: document.getElementById('filtroTipo')?.value || undefined,
        precioMin: document.getElementById('filtroPrecioMin')?.value || undefined,
        precioMax: document.getElementById('filtroPrecioMax')?.value || undefined
      };
      const results = ProductManager.filter(criteria);
      ProductCard.renderGrid(results, document.getElementById('productos-container'));
      UI.toast(`${results.length} productos encontrados`, 'success');
    });

    // 🛒 Carrito Modal
    document.getElementById('btnCarrito')?.addEventListener('click', () => {
      UI.modal('modalCarrito', 'open');
      this.renderCartModal();
    });

        // ✅ APLICAR DESCUENTO
    document.getElementById('btnApplyPromo')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnApplyPromo');
  const input = document.getElementById('promoCodeInput');
  const msg = document.getElementById('promoMessage');
  const code = input.value.trim().toUpperCase();

  // ✅ VALIDACIÓN: Bloquear si hay productos con descuento
  if (typeof CartManager.hasPromoProducts === 'function' && CartManager.hasPromoProducts()) {
    msg.textContent = '⚠️ No se pueden combinar códigos con ofertas';
    msg.style.color = '#f39c12';
    return;
  }

  if (!code) { msg.textContent = 'Ingresa un código'; msg.style.color = '#e74c3c'; return; }
  
  btn.disabled = true; btn.textContent = 'Verificando...';
  msg.textContent = '';

  const cliente = Store.get('cliente');
  if (!cliente) { UI.modal('modalLogin', 'open'); btn.disabled = false; btn.textContent = 'Aplicar'; return; }

  const validation = await DB.validatePromo(code, cliente.id);
  
  if (validation.valid) {
    const subtotal = CartManager.getTotal();
    const discount = validation.promo.tipo === 'porcentaje' 
      ? Math.round(subtotal * validation.promo.valor / 100) 
      : validation.promo.valor;
    
    this.appliedPromo = { id: validation.promo.id, code, discount };
    msg.textContent = `✅ ${validation.promo.codigo} aplicado (-₡${discount.toLocaleString()})`;
    msg.style.color = '#25d366';
    this.renderCartModal();
  } else {
    this.appliedPromo = null;
    msg.textContent = validation.message || 'Código inválido';
    msg.style.color = '#e74c3c';
    this.renderCartModal();
  }
  btn.disabled = false; btn.textContent = 'Aplicar';
});



    // ✅ FINALIZAR COMPRA (Pasa el código aplicado al checkout)
    // En attachGlobalEvents(), reemplaza el listener de btnCheckout por:
document.getElementById('btnCheckout')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnCheckout');
  btn.disabled = true; btn.textContent = 'Procesando...';
  
  // ✅ Leer canal seleccionado
  const canalSeleccionado = document.querySelector('input[name="canalEnvio"]:checked')?.value || 'whatsapp';
  
  await CartManager.checkout(this.appliedPromo?.code, canalSeleccionado);
  this.appliedPromo = null;
  
  btn.disabled = false; btn.textContent = '✅ Finalizar Pedido';
  UI.modal('modalCarrito', 'close');
});

// 🕯️ MENÚ ADMIN - EVENT DELEGATION (CORREGIDO Y ROBUSTO)
const btnAdmin = document.getElementById('btnToggleAdmin');
const adminMenu = document.getElementById('adminMenu');

if (btnAdmin && adminMenu) {
  // Toggle menú
  btnAdmin.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    adminMenu.classList.toggle('show'); 
  });
  
  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!btnAdmin.contains(e.target) && !adminMenu.contains(e.target)) {
      adminMenu.classList.remove('show');
    }
  });

  // ✅ Manejo de clicks en botones del menú
  adminMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-admin-action]');
    if (!btn) return;

    const action = btn.dataset.adminAction;
    
    // ✅ RUTEO DINÁMICO: acción -> { manager, method }
   const routeMap = {
  stats:     { manager: 'AdminManager',    method: 'showStats' },
  inventory: { manager: 'AdminManager',    method: 'manageInventory' },
  visits:    { manager: 'AdminManager',    method: 'showVisits' },
  promos:    { manager: 'AdminManager',    method: 'managePromos' },
  invoice:   { manager: 'AdminManager',    method: 'quickInvoice' },
  notify:    { manager: 'AdminManager',    method: 'sendNotification' },
  compras:   { manager: 'ComprasManager',  method: 'mostrarGestionProveedores' },
  cobros:    { manager: 'CobrosManager',   method: 'mostrarPanelCobros' },
  pedidos:   { manager: 'PedidosManager',  method: 'mostrarPanel' },
  loyaltyAdmin: { manager: 'LoyaltyControl', method: 'mostrarPanelPuntos' },
  editFactura: { manager: 'FacturaEditor', method: 'abrirEditor' },
  userAdmin: { manager: 'UserManager', method: 'mostrarPanel' }, // ✅ NUEVO
  clientesAdmin: { manager: 'ClientesManager', method: 'mostrarPanelGestion' }, // ✅ NUEVO
  dashboard: { manager: 'DashboardManager', method: 'mostrarDashboard' }, // ✅ NUEVO
  facturacion: { manager: 'FacturacionRapidaV2', method: 'mostrarPanel' }, // ✅ NUEVO
  stockAlert: { manager: 'StockAlertsManager', method: 'mostrarAlertas' }, // ✅ NUEVO
  backup: { manager: 'BackupManager', method: 'generarRespaldo' } ,         // ✅ NUEVO
  proformas: { manager: 'ProformasManager', method: 'mostrarPanel' }, // ✅ NUEVO
  historialCompras: { manager: 'HistorialComprasManager', method: 'mostrarPanel' },
  impresion: { manager: 'ImpresionManager', method: 'mostrarMenu' }
  
};

    const route = routeMap[action];
    if (!route) {
      console.warn(`⚠️ Acción no mapeada: ${action}`);
      return;
    }
    
    // ✅ Acceso dinámico al manager vía window[nombre]
    const targetManager = window[route.manager];
    
    if (targetManager && typeof targetManager[route.method] === 'function') {
      // ✅ Ejecutar método asíncrono de forma segura
      Promise.resolve(targetManager[route.method]())
        .catch(err => console.error(`Error en ${route.manager}.${route.method}:`, err));
      
      adminMenu.classList.remove('show'); // Cerrar menú tras ejecutar
    } else {
      console.warn(`⚠️ ${route.manager}.${route.method} no está disponible`);
    }
  });
}
    

    // Login/Registro Forms
    document.getElementById('formLogin')?.addEventListener('submit', this.handleLogin.bind(this));
    document.getElementById('formRegister')?.addEventListener('submit', this.handleRegister.bind(this));
    document.querySelectorAll('.btn-tab').forEach(btn => btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab)));

    // Store Events
    Store.on('auth:success', async ({ cliente }) => {
       if (window.UserManager) await UserManager.syncAdminRights();
     this.renderHeader();
     UI.modal('modalLogin', 'close');
     UI.toast('¡Bienvenido!', 'success');
     await LoyaltyManager.init();
  
  // ✅ Verificar si es su primera compra
  if (!sessionStorage.getItem('esentia_welcome_seen')) {
    await this.checkFirstPurchaseDiscount(cliente.id);
  }
});
    Store.on('auth:logout', () => { 
  this.renderHeader(); // Esto ya oculta loyaltyContainer gracias al cambio de arriba
  UI.toast('Sesión cerrada', 'info');
});
    Store.on('cart:updated', () => { CartManager.updateUI(); this.renderCartModal(); });
    Store.on('inventory:updated', () => this.renderProducts());
    // 👁️ DETALLE DE PRODUCTO
    Store.on('product:detail', (productId) => this.showProductDetail(productId));

    // Cerrar modales
    document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', (e) => { if (e.target === modal) UI.modal(modal.id, 'close'); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach(m => UI.modal(m.id, 'close')); });
  },

 renderCartModal() {
  const lista = document.getElementById('listaCarrito');
  if (!lista) return;

  const items = Store.get('carrito') || [];
  if (items.length === 0) {
    lista.innerHTML = '<li class="empty-cart">Tu carrito está vacío 🛒</li>';
  } else {
    lista.innerHTML = items.map(item => `

      <li class="item-carrito">
        <div class="item-info">
          <strong>${item.nombre}</strong>
          <span>${item.variante} × ${item.cantidad}</span>
        </div>       


        <div class="item-actions">
          <span class="item-price">₡${(item.precio * item.cantidad).toLocaleString()}</span>
          <button onclick="CartManager.remove('${item.id}')" class="btn-remove">🗑️</button>          
        </div>            
        </li>
          
      
      
      `).join('');
  }


  const subtotal = CartManager.getTotal();
  const discount = this.appliedPromo ? this.appliedPromo.discount : 0;
  const total = subtotal - discount;

  // Actualizar UI de totales
  const subEl = document.getElementById('subtotalModal');
  if (subEl) subEl.textContent = `₡${subtotal.toLocaleString()}`;

  const totEl = document.getElementById('totalModal');
  if (totEl) {
    const span = totEl.querySelector('span:last-child') || totEl;
    if (span) span.textContent = `₡${total.toLocaleString()}`;
  }

  // Fila de descuento visual
  const discountRow = document.getElementById('discountRow');
  if (discountRow) {
    if (discount > 0) {
      discountRow.style.display = 'flex';
      const discEl = document.getElementById('discountModal');
      if (discEl) discEl.textContent = `-₡${discount.toLocaleString()}`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  // Mostrar/ocultar input de promo
  const promoSection = document.querySelector('.promo-section');
  const promoMessage = document.getElementById('promoMessage');
  if (promoSection) {
    if (CartManager.hasPromoProducts()) {
      promoSection.style.display = 'none';
    } else {
      promoSection.style.display = 'flex';
      if (promoMessage && promoMessage.style.display === 'block') {
        promoMessage.textContent = '';
        promoMessage.style.display = 'none';
      }
    }
  }

    document.getElementById('subtotalModal').textContent = `₡${subtotal.toLocaleString()}`;
    document.getElementById('totalModal').querySelector('span:last-child').textContent = `₡${total.toLocaleString()}`;
    
   
  },

  

 // Dentro del objeto App en app.js

 async showHistorial() {
  const cliente = Store.get('cliente');
  if (!cliente) { UI.modal('modalLogin', 'open'); return; }
  UI.modal('modalHistorial', 'open');
  const container = document.getElementById('historialContent');
  container.innerHTML = '<p style="text-align:center; padding:2rem;">🔄 Cargando historial...</p>';
  
  try {
    const snap = await DB.getInvoices(cliente.id);
    const data = snap.exists() ? snap.data() : null;
    
    // ✅ CORRECCIÓN CRÍTICA: Validar que sea array antes de usar .sort()
    const compras = Array.isArray(data?.compras) ? data.compras : [];

    if (compras.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🛍️</div><h3>Sin compras aún</h3><p>Tu historial aparecerá aquí cuando realices tu primera compra.</p></div>`;
      return;
    }

    // ✅ Ahora sí es seguro ordenar
    compras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    this._historialCache = compras;

    container.innerHTML = compras.map((c, index) => {
      const total = c.total || c.monto || 0;
      const estado = c.estado === 'completado' ? 'Completado' : (c.estado === 'en_proceso' ? 'Pendiente WA' : 'Pendiente');
      const statusClass = c.estado === 'completado' ? 'status-completado' : 'status-pendiente';
      const fecha = new Date(c.fecha).toLocaleDateString('es-CR', { day:'2-digit', month:'short', year:'numeric' });

      return `
        <div class="historial-item">
          <div class="historial-header">
            <span class="historial-date">${fecha}</span>
            <span class="historial-status ${statusClass}">${estado}</span>
          </div>
          <ul class="historial-products">
            ${(c.productos || []).map(p => `<li>${p.cantidad}× ${p.nombre} (${p.variante || 'Única'})</li>`).join('')}
          </ul>
          <div class="historial-totals">
            <span>Método: ${c.metodoPago || 'N/A'}</span>
            <strong>Total: ₡${total.toLocaleString('es-CR')}</strong>
          </div>
          <button class="btn-ver-detalle" data-index="${index}">📄 Ver Detalle</button>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-ver-detalle').forEach(btn => {
      btn.addEventListener('click', (e) => this.showInvoiceDetail(e.target.dataset.index));
    });
  } catch (e) {
    console.error('Error historial:', e);
    container.innerHTML = '<p style="color:#e74c3c; text-align:center;">Error al cargar el historial.</p>';
  }
 },

 showInvoiceDetail(index) {
  const compra = this._historialCache?.[index];
  if (!compra) return;
  
  const cliente = Store.get('cliente');
  const total = compra.total || compra.monto || 0;
  const fecha = new Date(compra.fecha).toLocaleString('es-CR');

  // Generar texto formateado para WhatsApp
  let waText = `🧾 *COMPROBANTE ESSENTIA*\n📅 Fecha: ${fecha}\n👤 Cliente: ${cliente.nombre}\n\n`;
  (compra.productos || []).forEach(p => {
    const subtotal = (p.precio || 0) * p.cantidad;
    waText += `• ${p.cantidad}x ${p.nombre} (${p.variante || 'Única'}) - ₡${subtotal.toLocaleString()}\n`;
  });
  waText += `\n💰 *TOTAL: ₡${total.toLocaleString()}*\n💳 Método: ${compra.metodoPago || 'N/A'}\n📌 Estado: ${compra.estado || 'Pendiente'}`;

  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.id = 'modalDetalleFactura';
  modal.innerHTML = `
    <div class="modal-content modal-grande factura-detalle">
      <button class="modal-close" onclick="document.getElementById('modalDetalleFactura').remove()">✕</button>
      <h2>🧾 Detalle de Compra</h2>
      <div class="factura-header">
        <p><strong>Cliente:</strong> ${cliente.nombre}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Estado:</strong> <span class="badge ${compra.estado === 'completado' ? 'badge-completado' : 'badge-pendiente'}">${compra.estado === 'completado' ? '✅ Completado' : '⏳ Pendiente'}</span></p>
      </div>
      <div class="factura-items">
        ${(compra.productos || []).map(p => `
          <div class="factura-item">
            <span>${p.cantidad}× ${p.nombre} (${p.variante || 'Única'})</span>
            <span>₡${((p.precio||0)*p.cantidad).toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
      <div class="factura-totals">
        <div class="factura-row total"><span>Total:</span><span>₡${total.toLocaleString()}</span></div>
      </div>
      <div class="detalle-acciones">
        <button id="btnCopyWA" class="btn-wa">📱 Copiar para WhatsApp</button>
        <button onclick="document.getElementById('modalDetalleFactura').remove()" class="btn-secondary">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  
  document.getElementById('btnCopyWA').addEventListener('click', async () => {
    await navigator.clipboard.writeText(waText);
    UI.toast('📋 Comprobante copiado. Pégalo en WhatsApp', 'success');
  });
},

  // ✅ NUEVA FUNCIÓN (agregarla dentro del objeto App, después de renderCartModal)
async checkFirstPurchaseDiscount(clientId) {
  try {
    const snap = await DB.getInvoices(clientId);
    const tieneCompras = snap.exists() && snap.data().compras?.length > 0;
    
    if (!tieneCompras) {
      sessionStorage.setItem('esentia_welcome_seen', 'true');
      setTimeout(() => UI.modal('modalBienvenida', 'open'), 1500);
    }
  } catch (e) {
    console.warn('No se pudo verificar historial de compras:', e);
  }
},

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.getElementById('formLogin').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('formRegister').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('loginMessage').textContent = '';
  },

  async handleLogin(e) {
    e.preventDefault();
    const valor = document.getElementById('loginCedulaTel').value.trim();
    const msg = document.getElementById('loginMessage');
    msg.textContent = 'Verificando...';
    const result = await AuthManager.login(valor);
    if (!result.success) msg.textContent = result.message;
  },

  

  async handleRegister(e) {
    e.preventDefault();
    const cedula = document.getElementById('regCedula').value.trim();
    const telefono = document.getElementById('regTelefono').value.trim();
    const msg = document.getElementById('loginMessage');
    
    if (!cedula || !telefono) { msg.textContent = 'Completa todos los campos'; return; }
    msg.textContent = 'Verificando cédula...';
    const result = await AuthManager.register(cedula, telefono);
    if (!result.success) msg.textContent = result.message;
  },

    showProductDetail(productId) {
    const product = ProductManager.getProduct(productId);
    if (!product) { UI.toast('Producto no encontrado', 'warning'); return; }

    const primeraVar = product.variantes?.[0];
    const precioBase = primeraVar?.precio || product.precio;
    const precioFinal = product.descuentoPromo > 0 
      ? primeraVar?.precioDescuento || Math.round(precioBase * (1 - product.descuentoPromo / 100))
      : precioBase;

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalDetalleProducto';
    modal.innerHTML = `
      <div class="modal-content modal-grande product-detail-modal">
        <button class="modal-close" onclick="document.getElementById('modalDetalleProducto').remove()">✕</button>
        <div class="detail-layout">
          <div class="detail-image">
            <img src="${product.imagen}" alt="${product.nombre}" loading="lazy">
          </div>
          <div class="detail-info">
            <h2>${product.nombre}</h2>
            <p class="detail-tipo">${product.tipo}</p>
            <div class="detail-precio">
              ${product.descuentoPromo > 0 ? `<span class="precio-original">₡${precioBase.toLocaleString()}</span>` : ''}
              <span class="precio-oferta">₡${precioFinal.toLocaleString()}</span>
              ${product.descuentoPromo > 0 ? `<span class="badge-oferta-detail">-${product.descuentoPromo}%</span>` : ''}
            </div>
            <div class="detail-descripcion">
              <h4>Descripción</h4>
              <p>${product.info || 'Sin descripción disponible.'}</p>
            </div>
            ${product.beneficios ? `<div class="detail-beneficios"><h4>Beneficios</h4><p>${product.beneficios}</p></div>` : ''}
            <div class="detail-acciones">
              <button class="btn-add-detail" data-id="${product.id}">🛒 Agregar al Carrito</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    // Agregar al carrito desde el modal
    modal.querySelector('.btn-add-detail')?.addEventListener('click', () => {
      Store.emit('cart:add', { 
        product, 
        variant: { nombre: primeraVar?.nombre || '30ml', precio: precioFinal, original: precioBase } 
      });
      modal.remove();
    });
  },
};

// 🔍 DEBUG: Validar que todos los managers estén expuestos
async function debugAdminRoutes() {
  const routeMap = { /* ... tu routeMap ... */ };
  console.group('🔍 Admin Routes Debug');
  Object.entries(routeMap).forEach(([action, { manager, method }]) => {
    const ok = window[manager]?.[method] ? '✅' : '❌';
    console.log(`${ok} ${action} → ${manager}.${method}`);
  });
  console.groupEnd();
}
// Ejecutar en consola: debugAdminRoutes()

// 🔍 DIAGNÓSTICO: Buscar documentos con 'compras' no-array
async function diagnosticarFacturas() {
  const snap = await getDocs(collection(db, "facturas"));
  console.group('🔍 Diagnóstico de colección facturas');
  
  let corruptos = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (!Array.isArray(data.compras)) {
      console.warn(`❌ ${doc.id}: compras =`, data.compras, typeof data.compras);
      corruptos++;
    }
  });
  console.log(`Total documentos corruptos: ${corruptos}`);
  console.groupEnd();
}
// 🔧 REPARACIÓN: Convertir 'compras' a array si no lo es
async function repararFacturasCorruptas() {
  const snap = await getDocs(collection(db, "facturas"));
  let reparados = 0;
  
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!Array.isArray(data.compras)) {
      // Si es null/undefined, inicializar como array vacío
      // Si es un objeto único, convertirlo a array
      const comprasFix = data.compras && typeof data.compras === 'object' 
        ? [data.compras] 
        : [];
      
      await updateDoc(doc.ref, { compras: comprasFix });
      console.log(`✅ Reparado: ${doc.id}`);
      reparados++;
    }
  }
  console.log(`🎉 Reparados: ${reparados} documentos`);
}
// ⚠️ Ejecutar con precaución: await repararFacturasCorruptas()


if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init());
else App.init();

// ✅ FUNCIÓN NUEVA: Integra y normaliza los JSON locales


window.App = App;