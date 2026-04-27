// modules/cart.js
import { Store } from './core.js';
import { DB } from './firebase.js';

const CartManager = {
  init() {
    Store.restore('carrito');
    Store.on('cart:updated', () => this.updateUI());
  },

    add(product, variant = null) {
    const stock = Store.get('inventario')[product.nombre] || 0;
    
    // ✅ CORRECCIÓN: Comparar ID + Variante para evitar duplicados del MISMO tamaño
    const varianteActual = variant?.nombre || '30ml';
    const inCart = Store.get('carrito').find(i => 
      String(i.id) === String(product.id) && 
      i.variante === varianteActual
    );

    if (inCart && inCart.cantidad >= stock) {
      Store.emit('toast', { message: 'Stock insuficiente', type: 'warning' });
      return false;
    }

    // ✅ AQUÍ ESTÁ LA CLAVE:
    // La tarjeta YA envió el precio final calculado. No volvemos a restar.
    const precioFinal = variant?.precio || product.precio;
    const precioOriginal = variant?.precioOriginal || product.precio;

    // Solo calculamos el ahorro para mostrarlo en el carrito, no para cobrar
    const ahorro = precioOriginal - precioFinal;

    Store.addToCart({
      id: product.id,
      nombre: product.nombre,
      imagen: product.imagen,
      precio: precioFinal,       // ✅ Usamos el precio que llegó (ya descontado)
      precioOriginal: precioOriginal, // Para referencia visual
      descuentoAplicado: ahorro > 0 ? ahorro : 0,
      descuentoPorcentaje: product.descuentoPromo || 0,
      variante: varianteActual,
      cantidad: 1,
      tienePromo: product.descuentoPromo > 0 // ✅ FLAG IMPORTANTE: Bloquea códigos extra
    });

    Store.emit('toast', { 
      message: ahorro > 0 
        ? `✓ Agregado (-${product.descuentoPromo}% promo)` 
        : '✓ Agregado al carrito', 
      type: 'success' 
    });
    return true;  

  Store.emit('toast', { 
    message: descuentoAplicado > 0 
      ? `✓ Agregado (-${product.descuentoPromo}% promo)` 
      : '✓ Agregado al carrito', 
    type: 'success' 
  });


  return true;
},

  remove(id) {
    Store.removeFromCart(id);
    Store.emit('toast', { message: 'Producto eliminado', type: 'info' });
  },

  updateQuantity(id, quantity) {
    if (quantity < 1) {
      this.remove(id);
      return;
    }
    const item = Store.get('carrito').find(i => String(i.id) === String(id));
    if (item) {
      item.cantidad = quantity;
      Store.emit('cart:updated', Store.get('carrito'));
      Store.persist('carrito');
    }
  },

  clear() {
    Store.clearCart();
  },

  getTotal() {
    return Store.get('carrito').reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  },

  getCount() {
    return Store.get('carrito').reduce((sum, item) => sum + item.cantidad, 0);
  },
    
  // ✅ VERIFICAR SI HAY PRODUCTOS CON DESCUENTO PROMO
  hasPromoProducts() {
    const cart = Store.get('carrito') || [];
    return cart.some(item => item.tienePromo === true);
  },

  updateUI() {
    const count = this.getCount();
    const btn = document.getElementById('btnCarrito');
    const badge = document.getElementById('contadorCarrito');
    if (badge) badge.textContent = count;
    if (btn) {
      btn.style.transform = count > 0 ? 'scale(1.1)' : 'scale(1)';
      setTimeout(() => btn.style.transform = 'scale(1)', 200);
    }
  },

    // ✅ NUEVO: Verificar si hay productos con descuento especial
   hasPromoProducts() {
    const items = Store.get('carrito') || [];
    return items.some(item => item.tienePromo === true);
  },

  // modules/cart.js (Reemplaza checkout() y generateWhatsAppMessage)

async checkout(promoCode = null, metodoEnvio = 'whatsapp') {
  const cliente = Store.get('cliente');
  if (!cliente) { Store.emit('auth:required'); return false; }
  
  const items = Store.get('carrito');
  if (items.length === 0) return false;

  let total = this.getTotal();
  let discount = 0;
  const hasPromoItems = items.some(i => i.tienePromo);

  if (promoCode && !hasPromoItems) {
    const validation = await DB.validatePromo(promoCode, cliente.id);
    if (validation.valid) {
      const promo = validation.promo;
      discount = promo.tipo === 'porcentaje' 
        ? Math.round(total * promo.valor / 100)
        : promo.valor;
      total -= discount;
      await DB.usePromo(validation.promo.id, cliente.id);
    }
  } else if (promoCode && hasPromoItems) {
    Store.emit('toast', { message: '⚠️ No se pueden combinar promociones especiales con códigos', type: 'warning' });
  }

  // ✅ CAMBIO CLAVE: La factura inicia como 'pendiente' y 'en_proceso'
    const invoiceData = {
      fecha: new Date().toISOString(),
      productos: items,
      total,
      descuento: discount,
      metodoPago: 'WhatsApp',
      tipoPago: 'credito', // Se confirma tras el pago
      monto: total,
      pagado: 0,
      saldo: total,
      estado: 'pendiente', // 🔴 IMPORTANTE: Para que aparezca en tu panel
      canalEnvio: 'whatsapp'
    };

  await DB.addInvoice(cliente.id, invoiceData);
  this.showReceiptModal(invoiceData, cliente, promoCode);
  
  // ✅ Generar enlace según canal elegido
  const mensaje = this.generateOrderMessage(items, total, discount, cliente, promoCode);
  let enlace = '';

  switch (metodoEnvio) {
    case 'email':
      enlace = `mailto:${cliente.email || 'eweesentia@gmail.com'}?subject=🛒 Nuevo Pedido Esentia - ${cliente.nombre}&body=${encodeURIComponent(mensaje)}`;
      break;
    case 'sms':
      enlace = `sms:${cliente.telefono || ''}?body=${encodeURIComponent(mensaje)}`;
      break;
    default: // whatsapp
      enlace = `https://wa.me/50672952454?text=${encodeURIComponent(mensaje)}`;
  }

  window.open(enlace, '_blank');
  this.clear();
  return true;
},

// ✅ Mensaje genérico optimizado para WA, Email y SMS
generateOrderMessage(items, total, discount, cliente, promoCode) {
  let msg = ` *PEDIDO ESENTIA*\n👤 ${cliente.nombre}\n📱 ${cliente.telefono || 'Sin tel'}\n📧 ${cliente.email || 'Sin correo'}\n\n`;
  items.forEach(item => {
    msg += `• ${item.nombre} (${item.variante}) × ${item.cantidad} – ₡${(item.precio * item.cantidad).toLocaleString()}\n`;
  });
  if (discount > 0) msg += `\n🎁 Promo: ${promoCode} (-₡${discount.toLocaleString()})`;
  msg += `\n\n💰 *TOTAL: ₡${total.toLocaleString()}*\n💳 Método: Crédito/Transferencia\n📦 Por favor confirmar disponibilidad y datos de pago.`;
  return msg;
},

  showReceiptModal(invoice, cliente, promoCode) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalFactura'; // ✅ Corregido: eliminado espacio
    
    // ✅ Template literal limpio y unificado
    modal.innerHTML = `
      <div class="modal-content modal-grande factura-modal">
        <button class="modal-close" onclick="document.getElementById('modalFactura').remove()">✕</button>
        <h2>🧾 Pedido Generado</h2>
        <div class="factura-header">
          <p><strong>Cliente:</strong> ${cliente.nombre}</p>
          <p><strong>Fecha:</strong> ${new Date(invoice.fecha).toLocaleString('es-CR')}</p>
          <p><strong>Estado:</strong> <span class="badge badge-pendiente">⏳ Pendiente (WhatsApp)</span></p>
        </div>
        <div class="factura-items">
          ${invoice.productos.map(p => `
            <div class="factura-item">
              <span>${p.nombre} (${p.variante}) × ${p.cantidad}</span>
              <span>₡${(p.precio * p.cantidad).toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
        <div class="factura-totals">
          ${invoice.descuento > 0 ? `<div class="factura-row discount">Descuento (${promoCode}): -₡${invoice.descuento.toLocaleString()}</div>` : ''}
          <div class="factura-row total">
            <span>Total:</span>
            <span>₡${invoice.total.toLocaleString()}</span>
          </div>
        </div>
        <div class="pagos-section">
          <h3>💳 Opciones de Pago Disponibles</h3>
          <div class="pago-grid">
            <div class="pago-card" onclick="navigator.clipboard.writeText('72952454'); UI.toast('📋 SINPE copiado', 'success')">
              <div class="pago-icon">📱</div>
              <div class="pago-info"><strong>SINPE Móvil</strong><small>Toca para copiar</small></div>
            </div>
            <div class="pago-card" onclick="navigator.clipboard.writeText('CR76015114620010283743'); UI.toast('📋 IBAN copiado', 'success')">
              <div class="pago-icon">🏦</div>
              <div class="pago-info"><strong>Transferencia</strong><small>Toca para copiar IBAN</small></div>
            </div>
            <div class="pago-card" onclick="UI.toast('📝 Pago contra entrega disponible', 'info')">
              <div class="pago-icon">🤝</div>
              <div class="pago-info"><strong>Efectivo</strong><small>Contra entrega</small></div>
            </div>
          </div>
        </div>
        <button onclick="document.getElementById('modalFactura').remove()" class="btn-checkout">✅ Entendido, enviaré comprobante</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  /*generateWhatsAppMessage(items, total, discount, cliente, promoCode) {
    let msg = `Hola Wilber 👋\n\nQuiero confirmar mi pedido:\n\n`;
    items.forEach(item => {
      msg += `• ${item.nombre} (${item.variante}) × ${item.cantidad} – ₡${(item.precio * item.cantidad).toLocaleString()}\n`;
    });
    if (discount > 0) msg += `\n🎁 Promo: ${promoCode}\nDescuento: -₡${discount.toLocaleString()}`;
    msg += `\n\n*💰 Total: ₡${total.toLocaleString()}*\n👤 Cliente: ${cliente.nombre}\n📱 Tel: ${cliente.telefono || 'No registrado'}`;
    return msg;
  }*/
};
export default CartManager;