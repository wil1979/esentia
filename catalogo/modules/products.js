// modules/products.js
import { Store, Utils } from './core.js';
import { DB } from './firebase.js';

const ProductManager = {
  // ✅ URLs REMOTAS DE TUS CATÁLOGOS
  URLS: {
    ESENCIAS: "https://wil1979.github.io/esentia-factura/productos_esentia.json",
    LIMPIEZA: "https://wil1979.github.io/esentia-factura/productos_limpieza_completo.json",
    VELAS:    "https://wil1979.github.io/esentia-factura/catalogo-velas.json"
  },

  // ✅ AROMAS DISPONIBLES PARA DIFUSORES
  AROMAS_DIFUSORES: [
    "Pera", "Manzana Verde", "Coco", "Vainilla", "Lavanda",
    "Melon & Vainilla", "Kiwi", "Carro Nuevo", "Manzana & Canela", "Limón", "Menta", "Fresa"
  ],

  // ✅ CLAVES NORMALIZADAS PARA PROMOCIONES (sin espacios)
  PROMO_ESPECIAL: {
    "freshkiwienergiafrutal": 35,
    "strawberryjoy": 35,
    "nightcaress": 45,
    "crystalembrace": 45,
    "puremagnolia": 35,
    "melonvanilladelight": 35,
    "freshbreatheeucalipto": 35,
    "freshmint": 35,
  },

  // 🔧 FUNCIÓN DE LIMPIEZA UNIVERSAL (Maneja claves sucias como "id ", "nombre ", etc.)
  _limpiarClaves(obj) {
    if (!obj) return null;
    const limpio = {};
    Object.keys(obj).forEach(k => {
      // Quitamos espacios al inicio y final de la CLAVE
      const key = k.trim();
      // Quitamos espacios al inicio y final del VALOR si es texto
      const val = typeof obj[k] === 'string' ? obj[k].trim() : obj[k];
      limpio[key] = val;
    });
    return limpio;
  },

  async load() {
    Store.set('ui.loading', true);
    console.log('📡 Iniciando carga unificada de catálogos...');
    
    try {
      let productosTotales = [];

      // ---------------------------------------------
      // 1. CARGAR ESENCIAS (Lógica original intacta)
      // ---------------------------------------------
      try {
        const response = await fetch(this.URLS.ESENCIAS);
        if (response.ok) {
          const data = await response.json();
          Object.entries(data).forEach(([tipo, items]) => {
            items.forEach(item => {
              // Limpiar item antes de procesar
              const itemLimpio = this._limpiarClaves(item);
              
              const producto = {
                ...itemLimpio,
                tipo, // Forzar tipo de la categoría
                id: itemLimpio.id || Utils.normalizeText(itemLimpio.nombre),
                precio: itemLimpio.precioOferta || itemLimpio.precio || 3000,
                precioOriginal: itemLimpio.precioOriginal,
                variantes: itemLimpio.variantes || [{ nombre: '30ml', precio: 3000 }]
              };

              // ✅ Aplicar descuento si coincide
              const key = Utils.normalizeText(producto.nombre);
              const promoPorcentaje = this.PROMO_ESPECIAL[key] || this.PROMO_ESPECIAL[String(producto.id)] || 0;
              
              if (promoPorcentaje > 0) {
                producto.descuentoPromo = promoPorcentaje;
                producto.variantes = producto.variantes.map(v => ({
                  ...v,
                  precioBase: v.precio,
                  precioDescuento: Math.round(v.precio * (1 - promoPorcentaje / 100))
                }));
              }

              productosTotales.push(producto);
            });
          });
          console.log(`✅ Esencias: ${Object.values(data).flat().length} productos cargados.`);
        }
      } catch (e) { console.warn('⚠️ Error cargando esencias:', e); }

      // ---------------------------------------------
      // 2. CARGAR LIMPIEZA (Normalización automática)
      // ---------------------------------------------
      try {
        const response = await fetch(this.URLS.LIMPIEZA);
        if (response.ok) {
          const data = await response.json();
          const lista = Array.isArray(data) ? data : [data];
          
          const productosLimpieza = lista.map(p => {
            const pLimpio = this._limpiarClaves(p);
            return {
              id: pLimpio.id || `limp_${Date.now()}_${Math.random()}`,
              nombre: pLimpio.nombre || 'Producto Limpieza',
              tipo: 'Limpieza',
              precio: pLimpio.precioPublico || pLimpio.precio || 0,
              precioCompra: pLimpio.precioCompra || 0,
              categoria: pLimpio.categoria || 'General',
              stock: pLimpio.stock || 0,
              activo: pLimpio.disponible !== false,
              imagen: pLimpio.imagen || 'images/default.png',
              // Transformar 'aromas' en 'variantes' para que funcione en el carrito
              variantes: (pLimpio.aromas && pLimpio.aromas.length > 0) 
                ? pLimpio.aromas.map(a => ({ nombre: a.trim(), precio: pLimpio.precioPublico })) 
                : [{ nombre: 'Única', precio: pLimpio.precioPublico || pLimpio.precio }]
            };
          });
          productosTotales = [...productosTotales, ...productosLimpieza];
          console.log(`✅ Limpieza: ${productosLimpieza.length} productos cargados.`);
        }
      } catch (e) { console.warn('⚠️ Error cargando limpieza:', e); }

      // ---------------------------------------------
      // 3. CARGAR VELAS (Normalización automática)
      // ---------------------------------------------
      try {
        const response = await fetch(this.URLS.VELAS);
        if (response.ok) {
          const dataRaw = await response.json();
          const dataVelas = Array.isArray(dataRaw) ? dataRaw : [dataRaw];
          
          const productosVelas = dataVelas.map(p => {
            const pLimpio = this._limpiarClaves(p);
            return {
              id: pLimpio.id || `vela_${Date.now()}_${Math.random()}`,
              nombre: pLimpio.nombre || 'Vela',
              tipo: 'Velas',
              precio: pLimpio.precio || pLimpio.precioPublico || 0,
              precioCompra: pLimpio.precioCompra || 0,
              categoria: (pLimpio.tipo ? pLimpio.tipo.split('|')[0] : 'Decoración'),
              stock: pLimpio.stock || 0,
              activo: pLimpio.disponible !== false,
              imagen: pLimpio.imagen || 'images/default.png',
              variantes: pLimpio.variantes || [{ nombre: 'Única', precio: pLimpio.precio || pLimpio.precioPublico }]
            };
          });
          productosTotales = [...productosTotales, ...productosVelas];
          console.log(`✅ Velas: ${productosVelas.length} productos cargados.`);
        }
      } catch (e) { console.warn('⚠️ Error cargando velas:', e); }

      // ---------------------------------------------
      // 4. GUARDAR EN STORE GLOBAL
      // ---------------------------------------------
      Store.set('productos', productosTotales);
      console.log(`🌟 TOTAL PRODUCTOS EN TIENDA: ${productosTotales.length}`);
      
      this.subscribeInventory();
      
    } catch (error) {
      console.error("❌ Error crítico cargando productos:", error);
      Store.emit('error', 'No se pudo cargar el catálogo');
    } finally {
      Store.set('ui.loading', false);
    }
  },

  subscribeInventory() {
    if (DB.subscribeStock) {
      DB.subscribeStock((snapshot) => {
        const inventario = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          const key = Utils.normalizeText(data.nombre);
          inventario[key] = data.cantidad ?? data.stock ?? 0;
        });
        Store.set('inventario', inventario);
        Store.emit('inventory:updated', inventario);
      });
    }
  },

  getStock(productName) {
    const key = Utils.normalizeText(productName);
    return Store.get('inventario')[key] ?? 0;
  },

  isAvailable(product) {
    return this.getStock(product.nombre) > 0 && product.disponible !== false;
  },

  search(query, options = {}) {
    const productos = Store.get('productos');
    if (!query.trim()) return productos;
    const term = Utils.normalizeText(query);
    const results = [];
    productos.forEach(p => {
      let score = 0;
      const nameNorm = Utils.normalizeText(p.nombre);
      if (nameNorm.includes(term)) score += 10;
      if (p.tipo?.toLowerCase().includes(term)) score += 5;
      if (Utils.normalizeText(p.info || '').includes(term)) score += 3;
      if (Utils.normalizeText(p.beneficios || '').includes(term)) score += 8;
      if (score === 0 && options.fuzzy) {
        const dist = Utils.levenshtein?.(term.slice(0, 10), nameNorm.slice(0, 10)) || 999;
        if (dist <= 3) score = 5 - dist;
      }
      if (score > 0) results.push({ product: p, score });
    });
    return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 50).map(r => r.product);
  },

  filter(criteria) {
    let results = Store.get('productos').filter(p => this.isAvailable(p));
    if (criteria.tipo) results = results.filter(p => p.tipo === criteria.tipo);
    if (criteria.precioMin) results = results.filter(p => p.precio >= criteria.precioMin);
    if (criteria.precioMax) results = results.filter(p => p.precio <= criteria.precioMax);
    if (criteria.orden === 'precio-asc') results.sort((a, b) => a.precio - b.precio);
    else if (criteria.orden === 'precio-desc') results.sort((a, b) => b.precio - a.precio);
    return results;
  },

  normalize(nombre) { 
    return Utils?.normalizeText?.(nombre) || nombre?.toLowerCase().trim().replace(/\s+/g, '-') || ''; 
  },

  getProduct(id) { 
    const productos = Store.get('productos') || []; 
    const strId = String(id);
    return productos.find(p => String(p.id) === strId) 
      || productos.find(p => Utils.normalizeText?.(p.nombre) === strId) 
      || null; 
  },

  getByType(tipo) { 
    const productos = Store.get('productos') || []; 
    return productos.filter(p => p.tipo === tipo && this.isAvailable(p)); 
  },

  checkStock(nombre, cantidadRequerida = 1) { 
    return this.getStock(nombre) >= cantidadRequerida; 
  }
};

export default ProductManager;