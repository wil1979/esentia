// components/product-card.js
import { Store, Utils } from '../modules/core.js';
import ProductManager from '../modules/products.js';

export const ProductCard = {
  
  /**
   * Renderiza una tarjeta de producto individual
   */
  render(product, options = {}) {
    const stock = ProductManager.getStock(product.nombre);
    const isLowStock = stock > 0 && stock <= 5;
    const badges = [];

    if (product.esNuevo) badges.push('<span class="badge badge-nuevo">NUEVO</span>');
    if (product.descuentoPromo > 0) {
      badges.push(`<span class="badge badge-oferta">-${product.descuentoPromo}% PROMO</span>`);
    } else if (product.precioOriginal) {
      badges.push('<span class="badge badge-oferta">Oferta</span>');
    }
    badges.push(`<span class="badge badge-tipo">${product.tipo}</span>`);

    // ✅ 1. DETERMINAR VARIANTE ACTIVA POR DEFECTO (Prioriza 30ml)
    let variantesVisibles = product.variantes || [];
    
    // Si es promoción, mostrar solo 30ml para simplificar
    if (product.descuentoPromo > 0) {
      const solo30 = variantesVisibles.filter(v => v.nombre.includes('30'));
      if (solo30.length > 0) variantesVisibles = solo30;
    }

    // Buscar índice de 30ml
    const idx30 = variantesVisibles.findIndex(v => v.nombre.includes('30'));
    const activeIdx = idx30 !== -1 ? idx30 : 0;
    const activeVariant = variantesVisibles[activeIdx];

    // Calcular precio inicial
    let precioBase = activeVariant?.precio || product.precio;
    let precioFinal = precioBase;
    if (product.descuentoPromo > 0) {
      precioFinal = activeVariant?.precioDescuento || Math.round(precioBase * (1 - product.descuentoPromo / 100));
    }

    let priceHtml = '';
    if (product.descuentoPromo > 0) {
      priceHtml = `<span class="precio-original">₡${precioBase.toLocaleString()}</span><span class="precio-oferta">₡${precioFinal.toLocaleString()}</span>`;
    } else if (product.precioOriginal) {
      priceHtml = `<span class="precio-original">₡${product.precioOriginal.toLocaleString()}</span><span class="precio-oferta">₡${product.precio.toLocaleString()}</span>`;
    } else {
      priceHtml = `<span class="precio-normal">₡${precioFinal.toLocaleString()}</span>`;
    }

    const stockHtml = isLowStock ? `<div class="stock-label stock-bajo">⚠️ Últimas ${stock}</div>` : '';

    // ✅ 2. RENDERIZAR BOTONES DE VARIANTES
    const variantsHtml = variantesVisibles.map((v, i) => {
      const isActive = i === activeIdx ? 'active' : '';
      // Usamos el índice real del array original de variantes para guardar el correcto
      const realIdx = product.variantes.indexOf(v); 
      
      const precioBtn = product.descuentoPromo > 0
        ? (v.precioDescuento || Math.round(v.precio * (1 - product.descuentoPromo / 100)))
        : v.precio;
      
      return `
        <button class="btn-variante ${isActive}" 
                data-variant="${realIdx}" 
                data-price="${precioBtn}" 
                data-price-original="${v.precio}" 
                data-variant-name="${v.nombre}">
          ${v.nombre} <br> <small>₡${precioBtn.toLocaleString()}</small>
        </button>
      `;
    }).join('');

    return `
      <div class="producto-card ${product.descuentoPromo > 0 ? 'oferta' : ''}" data-id="${product.id}">
        <div class="producto-imagen-container">
          <div class="badges-container">${badges.join('')}</div>
          <img src="${product.imagen}" alt="${product.nombre}" loading="lazy">
        </div>
        <div class="producto-info">
          <h3 class="producto-nombre">${product.nombre}</h3>
          ${product.calificacion ? `<div class="producto-calificacion">${'★'.repeat(Math.floor(product.calificacion))}</div>` : ''}
          
          <div class="producto-precio-container">${priceHtml}</div>
          
          ${stockHtml}
          
          <div class="variantes-container">${variantsHtml}</div>

          <div class="producto-acciones">
            <button class="btn-agregar" data-action="add" title="Agregar al carrito">🛒</button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Modal de Selección de Aromas (Difusores)
   */
  mostrarSelectorAroma(product, variant, precioFinal, precioBase) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'modalSelectorAroma';
    
    const aromas = ProductManager.AROMAS_DIFUSORES || [];
    const iconos = {
      "Pera": "🍐", "Manzana Verde": "🍏", "Coco": "🥥", "Vainilla": "🍦",
      "Lavanda": "💜", "Rosas": "🌹", "Jazmín": "🌼", "Sándalo": "🪵",
      "Canela": "🫚", "Limón": "🍋", "Menta": "🌿", "Fresa": "🍓"
    };

    modal.innerHTML = `
      <div class="modal-content aroma-modal">
        <button class="modal-close" onclick="UI.modal('modalSelectorAroma','close')">✕</button>
        <h3>🌸 Selecciona el Aroma</h3>
        <p class="subtitle">${product.nombre} — ${variant.nombre}</p>
        
        <div class="aromas-grid">
          ${aromas.map(a => `
            <button class="btn-aroma" data-aroma="${a}">
              <span class="aroma-icon">${iconos[a] || '✨'}</span>
              <span>${a}</span>
            </button>
          `).join('')}
        </div>

        <div class="custom-aroma-box">
          <label>🖊️ ¿No encuentras el aroma? Escríbelo aquí:</label>
          <div class="custom-input-row">
            <input type="text" id="customAromaInput" placeholder="Ej: Durazno, Chocolate...">
            <button id="btnConfirmCustomAroma" class="btn-primary">✅ Usar</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) UI.modal('modalSelectorAroma','close'); });

    // Click en botones predefinidos
    modal.querySelectorAll('.btn-aroma').forEach(btn => {
      btn.addEventListener('click', () => this._agregarConAroma(product, variant, precioFinal, precioBase, btn.dataset.aroma));
    });

    // Click en botón personalizado
    document.getElementById('btnConfirmCustomAroma').onclick = () => {
      const custom = document.getElementById('customAromaInput').value.trim();
      if (!custom) return UI.toast('Escribe un aroma válido', 'warning');
      this._agregarConAroma(product, variant, precioFinal, precioBase, custom);
    };
  },

  /**
   * Lógica central para agregar al carrito con aroma
   */
  _agregarConAroma(product, variant, precioFinal, precioBase, aroma) {
    Store.emit('cart:add', {
      product,
      variant: { 
        nombre: variant.nombre, 
        precio: precioFinal, 
        precioOriginal: precioBase, 
        aroma: aroma.toUpperCase() // Normalizar a mayúsculas
      }
    });
    UI.modal('modalSelectorAroma', 'close');
  },

  /**
   * Renderiza la grilla completa de productos
   */
  renderGrid(productos, container) {
    if (productos.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3></div>`;
      return;
    }
    const porTipo = {};
    productos.forEach(p => {
      if (!porTipo[p.tipo]) porTipo[p.tipo] = [];
      porTipo[p.tipo].push(p);
    });

    container.innerHTML = Object.entries(porTipo).map(([tipo, items]) => `
      <div class="seccion-tipo">
        <h2 class="titulo-tipo">${this.getIconoTipo(tipo)} ${tipo} <span class="contador-productos">${items.length}</span></h2>
        <div class="productos-grid">${items.map(p => this.render(p)).join('')}</div>
      </div>
    `).join('');

    this.attachEvents(container);
  },

  /**
   * Maneja los eventos de clic en las tarjetas
   */
  attachEvents(container) {
    container.addEventListener('click', (e) => {
      // ✅ EVENTO: CAMBIO DE VARIANTE
      const variantBtn = e.target.closest('.btn-variante');
      if (variantBtn) {
        const card = variantBtn.closest('.producto-card');
        const parent = variantBtn.closest('.variantes-container');
        
        // Actualizar clase visual
        parent.querySelectorAll('.btn-variante').forEach(b => b.classList.remove('active'));
        variantBtn.classList.add('active');

        // Actualizar precio visible en la tarjeta
        const precioContainer = card.querySelector('.producto-precio-container');
        const nuevoPrecio = parseInt(variantBtn.dataset.price);
        const precioOriginal = variantBtn.dataset.priceOriginal;
        const esOferta = card.classList.contains('oferta');

        if (precioContainer) {
          if (esOferta && precioOriginal) {
            precioContainer.innerHTML = `<span class="precio-original">₡${parseInt(precioOriginal).toLocaleString()}</span><span class="precio-oferta">₡${nuevoPrecio.toLocaleString()}</span>`;
          } else {
            precioContainer.innerHTML = `<span class="precio-normal">₡${nuevoPrecio.toLocaleString()}</span>`;
          }
        }

        // Activar animación radar
        const cartBtn = card.querySelector('.btn-agregar');
        if (cartBtn) {
          cartBtn.classList.remove('radar-pulse');
          void cartBtn.offsetWidth; 
          cartBtn.classList.add('radar-pulse');
        }
        return;
      }

      // ✅ EVENTO: AGREGAR AL CARRITO
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const card = btn.closest('.producto-card');
      if (!card) return;

      const action = btn.dataset.action;
      const productId = card.dataset.id;

      if (action === 'add') {
        const product = ProductManager.getProduct(productId);
        if (!product) return;

        // Obtener datos de la variante ACTIVA
        const activeVariantBtn = card.querySelector('.btn-variante.active');
        const variantIndex = activeVariantBtn ? parseInt(activeVariantBtn.dataset.variant) : 0;
        const variantData = product.variantes[variantIndex];
        
        const precioFinal = parseInt(activeVariantBtn?.dataset.price) || product.precio;
        const precioBase = parseInt(activeVariantBtn?.dataset.priceOriginal) || product.precio;

        // Si es Difusor, abrir selector de aroma
        if (product.tipo === 'Difusores' || product.tipo === 'Difusor') {
          this.mostrarSelectorAroma(product, variantData, precioFinal, precioBase);
          return;
        }

        // Agregar directo (no difusores)
        Store.emit('cart:add', {
          product,
          variant: { 
            nombre: variantData?.nombre || '30ml', 
            precio: precioFinal, 
            precioOriginal: precioBase 
          }
        });
      }
    });
  },

  getIconoTipo(tipo) {
    const iconos = { 'Aromaterapia': '🌿', 'Difusores': '💨', 'Velas': '🕯️', 'Aceites': '💧', 'Perfumes': '🌸', 'Ambientadores': '🏠', 'Regalos': '🎁', 'Limpieza': '🧼' };
    return iconos[tipo] || '✨';
  }
};