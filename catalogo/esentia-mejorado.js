
/**
 * ESENTIA - SISTEMA MEJORADO v2.0
 * Nuevas funcionalidades: Búsqueda inteligente, Filtros, Comparador,
 * Wishlist, Recomendaciones IA, Offline Support, Performance Optimizations
 */

// ============================================
// CONFIGURACIÓN Y ESTADO GLOBAL MEJORADO
// ============================================
const EsentiaApp = {
  version: '2.0.0',
  state: {
    carrito: [],
    productos: [],
    productosFiltrados: [],
    favoritos: new Set(),
    comparador: [],
    historialBusqueda: [],
    cliente: null,
    preferencias: {
      tema: localStorage.getItem('tema') || 'auto',
      notificaciones: localStorage.getItem('notificaciones') !== 'false',
      ordenamiento: localStorage.getItem('orden') || 'nombre'
    }
  },
  cache: {
    productos: null,
    inventario: null,
    ultimaActualizacion: null
  },
  utils: {
    // Debounce para búsqueda eficiente
    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Throttle para scroll events
    throttle: (func, limit) => {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // Formatear precio en colones
    formatearPrecio: (precio) => {
      return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        minimumFractionDigits: 0
      }).format(precio);
    },

    // Calcular distancia de Levenshtein para búsqueda difusa
    levenshtein: (a, b) => {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1) 
            ? matrix[i - 1][j - 1] 
            : Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
      return matrix[b.length][a.length];
    }
  }
};

// ============================================
// SISTEMA DE BÚSQUEDA INTELIGENTE
// ============================================
class BuscadorInteligente {
  constructor(productos) {
    this.productos = productos;
    this.indice = this.construirIndice();
  }

  construirIndice() {
    const indice = new Map();
    this.productos.forEach(producto => {
      const texto = `${producto.nombre} ${producto.info} ${producto.beneficios} ${producto.tipo}`.toLowerCase();
      const palabras = texto.split(/\s+/);
      palabras.forEach(palabra => {
        if (!indice.has(palabra)) indice.set(palabra, []);
        indice.get(palabra).push(producto);
      });
    });
    return indice;
  }

  buscar(query, opciones = {}) {
    const { 
      limite = 10, 
      umbral = 0.3,
      busquedaDifusa = true 
    } = opciones;

    if (!query.trim()) return this.productos;

    const termino = query.toLowerCase().trim();
    const resultados = new Map();

    // Búsqueda exacta
    this.productos.forEach(p => {
      let score = 0;
      const textoCompleto = `${p.nombre} ${p.info || ''} ${p.beneficios || ''}`.toLowerCase();

      if (p.nombre.toLowerCase().includes(termino)) score += 10;
      if (p.tipo?.toLowerCase().includes(termino)) score += 5;
      if (textoCompleto.includes(termino)) score += 3;

      // Búsqueda por beneficio/emoción
      if (p.beneficios?.toLowerCase().includes(termino)) score += 8;
      if (p.usoRecomendado?.toLowerCase().includes(termino)) score += 6;

      if (score > 0) resultados.set(p.id, { producto: p, score });
    });

    // Búsqueda difusa (si está habilitada y hay pocos resultados)
    if (busquedaDifusa && resultados.size < 3) {
      this.productos.forEach(p => {
        if (resultados.has(p.id)) return;
        const distancia = EsentiaApp.utils.levenshtein(
          termino.slice(0, 10), 
          p.nombre.toLowerCase().slice(0, 10)
        );
        if (distancia <= 3) {
          resultados.set(p.id, { producto: p, score: Math.max(1, 5 - distancia) });
        }
      });
    }

    return Array.from(resultados.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limite)
      .map(r => r.producto);
  }

  sugerencias(query) {
    if (query.length < 2) return [];
    const sugerencias = new Set();
    const termino = query.toLowerCase();

    this.productos.forEach(p => {
      if (p.nombre.toLowerCase().includes(termino)) {
        sugerencias.add(p.nombre);
      }
    });

    return Array.from(sugerencias).slice(0, 5);
  }
}

// ============================================
// SISTEMA DE RECOMENDACIONES INTELIGENTES
// ============================================
class Recomendador {
  constructor() {
    this.reglas = [
      {
        id: 'relajacion',
        emoji: '🧘',
        titulo: 'Para Relajación',
        condicion: (p) => p.beneficios?.match(/relaj|calm|descans|medita|stress/i),
        peso: 1
      },
      {
        id: 'energia',
        emoji: '⚡',
        titulo: 'Energía y Vitalidad',
        condicion: (p) => p.beneficios?.match(/energ|vital|concentr|frescor/i) || p.tipo === 'citrico',
        peso: 1
      },
      {
        id: 'romance',
        emoji: '💕',
        titulo: 'Ambiente Romántico',
        condicion: (p) => p.beneficios?.match(/rom|seduc|pasion|amor/i) || p.tipo === 'floral',
        peso: 1
      },
      {
        id: 'hogar',
        emoji: '🏠',
        titulo: 'Hogar Acogedor',
        condicion: (p) => p.usoRecomendado?.match(/sala|comedor|cocina|hogar/i) || p.tipo === 'dulcesEspecias',
        peso: 1
      },
      {
        id: 'bebe',
        emoji: '👶',
        titulo: 'Habitación Infantil',
        condicion: (p) => p.beneficios?.match(/beb|infant|suave|delicado/i) || p.nombre.match(/baby/i),
        peso: 1
      }
    ];
  }

  obtenerRecomendaciones(productos, contexto = {}) {
    const { hora = new Date().getHours(), clima = 'normal' } = contexto;

    // Ajustar pesos según contexto
    const pesosAjustados = this.reglas.map(regla => {
      let peso = regla.peso;

      // Mañana: favorecer energía
      if (hora >= 6 && hora < 12 && regla.id === 'energia') peso *= 2;
      // Noche: favorecer relajación
      if (hora >= 18 && regla.id === 'relajacion') peso *= 2;
      // Tarde: favorecer hogar
      if (hora >= 14 && hora < 18 && regla.id === 'hogar') peso *= 1.5;

      return { ...regla, pesoAjustado: peso };
    });

    const recomendaciones = pesosAjustados.map(regla => {
      const matches = productos.filter(p => regla.condicion(p));
      if (matches.length === 0) return null;

      // Seleccionar producto más relevante
      const seleccionado = matches[Math.floor(Math.random() * Math.min(3, matches.length))];
      return {
        ...regla,
        producto: seleccionado,
        matches: matches.length
      };
    }).filter(Boolean);

    return recomendaciones.sort((a, b) => b.pesoAjustado - a.pesoAjustado).slice(0, 4);
  }

  // Recomendaciones basadas en historial
  recomendarBasadoEnHistorial(historialCompras, productos) {
    if (!historialCompras || historialCompras.length === 0) {
      return this.obtenerRecomendaciones(productos);
    }

    // Analizar preferencias del usuario
    const tiposFrecuentes = {};
    const beneficiosFrecuentes = [];

    historialCompras.forEach(compra => {
      compra.productos?.forEach(p => {
        tiposFrecuentes[p.tipo] = (tiposFrecuentes[p.tipo] || 0) + 1;
        if (p.beneficios) beneficiosFrecuentes.push(p.beneficios);
      });
    });

    // Encontrar productos similares pero no comprados
    const tipoPreferido = Object.entries(tiposFrecuentes)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    return productos
      .filter(p => p.tipo === tipoPreferido && !historialCompras.some(h => 
        h.productos?.some(hp => hp.nombre === p.nombre)
      ))
      .slice(0, 4)
      .map(p => ({
        id: 'personalizado',
        emoji: '✨',
        titulo: 'Basado en tus compras',
        producto: p
      }));
  }
}

// ============================================
// SISTEMA DE FILTRADO AVANZADO
// ============================================
class FiltroAvanzado {
  constructor(productos) {
    this.productos = productos;
    this.filtrosActivos = new Map();
  }

  aplicarFiltros(criterios) {
    let resultado = [...this.productos];

    if (criterios.tipo) {
      resultado = resultado.filter(p => p.tipo === criterios.tipo);
    }

    if (criterios.precioMin !== undefined) {
      resultado = resultado.filter(p => {
        const precio = p.precioOferta || p.precio || 3000;
        return precio >= criterios.precioMin;
      });
    }

    if (criterios.precioMax !== undefined) {
      resultado = resultado.filter(p => {
        const precio = p.precioOferta || p.precio || 3000;
        return precio <= criterios.precioMax;
      });
    }

    if (criterios.calificacion) {
      resultado = resultado.filter(p => (p.calificacion || 0) >= criterios.calificacion);
    }

    if (criterios.beneficio) {
      resultado = resultado.filter(p => 
        p.beneficios?.toLowerCase().includes(criterios.beneficio.toLowerCase())
      );
    }

    if (criterios.disponible) {
      resultado = resultado.filter(p => p.disponible !== false);
    }

    if (criterios.ordenar) {
      switch(criterios.ordenar) {
        case 'precio-asc':
          resultado.sort((a, b) => (a.precioOferta || a.precio || 3000) - (b.precioOferta || b.precio || 3000));
          break;
        case 'precio-desc':
          resultado.sort((a, b) => (b.precioOferta || b.precio || 3000) - (a.precioOferta || a.precio || 3000));
          break;
        case 'calificacion':
          resultado.sort((a, b) => (b.calificacion || 0) - (a.calificacion || 0));
          break;
        case 'novedad':
          resultado.sort((a, b) => new Date(b.fechaLanzamiento || 0) - new Date(a.fechaLanzamiento || 0));
          break;
      }
    }

    return resultado;
  }

  obtenerEstadisticas() {
    const stats = {
      total: this.productos.length,
      porTipo: {},
      rangoPrecios: { min: Infinity, max: 0 },
      calificacionPromedio: 0
    };

    let sumaCalif = 0;
    let countCalif = 0;

    this.productos.forEach(p => {
      stats.porTipo[p.tipo] = (stats.porTipo[p.tipo] || 0) + 1;
      const precio = p.precioOferta || p.precio || 3000;
      stats.rangoPrecios.min = Math.min(stats.rangoPrecios.min, precio);
      stats.rangoPrecios.max = Math.max(stats.rangoPrecios.max, precio);
      if (p.calificacion) {
        sumaCalif += p.calificacion;
        countCalif++;
      }
    });

    stats.calificacionPromedio = countCalif > 0 ? sumaCalif / countCalif : 0;
    return stats;
  }
}

// ============================================
// SISTEMA DE COMPARACIÓN DE PRODUCTOS
// ============================================
class ComparadorProductos {
  constructor() {
    this.maxItems = 3;
    this.items = [];
  }

  agregar(producto) {
    if (this.items.length >= this.maxItems) {
      return { exito: false, mensaje: 'Máximo 3 productos para comparar' };
    }
    if (this.items.some(i => i.id === producto.id)) {
      return { exito: false, mensaje: 'Producto ya está en comparador' };
    }
    this.items.push(producto);
    return { exito: true };
  }

  eliminar(id) {
    this.items = this.items.filter(i => i.id !== id);
  }

  limpiar() {
    this.items = [];
  }

  comparar() {
    if (this.items.length < 2) return null;

    const atributos = ['precio', 'calificacion', 'variantes', 'beneficios'];
    const resultado = {
      productos: this.items,
      diferencias: {}
    };

    atributos.forEach(attr => {
      const valores = this.items.map(p => p[attr]);
      const unicos = [...new Set(valores)];
      if (unicos.length > 1) {
        resultado.diferencias[attr] = valores;
      }
    });

    return resultado;
  }
}

// ============================================
// SISTEMA DE CACHE Y OFFLINE
// ============================================
class CacheManager {
  constructor() {
    this.CACHE_KEY = 'esentia_cache_v2';
    this.DURACION_CACHE = 1000 * 60 * 60; // 1 hora
  }

  guardar(datos) {
    const cache = {
      datos,
      timestamp: Date.now(),
      version: EsentiaApp.version
    };
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
  }

  obtener() {
    try {
      const cache = JSON.parse(localStorage.getItem(this.CACHE_KEY));
      if (!cache) return null;

      const expirado = Date.now() - cache.timestamp > this.DURACION_CACHE;
      const versionAntigua = cache.version !== EsentiaApp.version;

      if (expirado || versionAntigua) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }

      return cache.datos;
    } catch {
      return null;
    }
  }

  limpiar() {
    localStorage.removeItem(this.CACHE_KEY);
  }
}

// ============================================
// FUNCIONES DE UI MEJORADAS
// ============================================

// Toast system mejorado
const ToastSystem = {
  contenedor: null,

  init() {
    this.contenedor = document.createElement('div');
    this.contenedor.className = 'toast-container';
    this.contenedor.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(this.contenedor);
  },

  mostrar(mensaje, tipo = 'info', duracion = 3000) {
    if (!this.contenedor) this.init();

    const toast = document.createElement('div');
    const iconos = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
      <span class="toast-icon">${iconos[tipo]}</span>
      <span class="toast-message">${mensaje}</span>
    `;
    toast.style.cssText = `
      background: ${tipo === 'success' ? '#25d366' : tipo === 'error' ? '#ff6b6b' : '#6c4ba3'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease;
      min-width: 250px;
    `;

    this.contenedor.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duracion);
  }
};

// Skeleton loading
const SkeletonLoader = {
  mostrar(contenedor, cantidad = 6) {
    const html = Array(cantidad).fill(0).map((_, i) => `
      <div class="skeleton-card" style="animation-delay: ${i * 0.1}s">
        <div class="skeleton-img"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>
    `).join('');

    contenedor.innerHTML = `<div class="skeleton-grid">${html}</div>`;
  },

  ocultar(contenedor) {
    const skeleton = contenedor.querySelector('.skeleton-grid');
    if (skeleton) {
      skeleton.style.opacity = '0';
      setTimeout(() => skeleton.remove(), 300);
    }
  }
};

// ============================================
// INICIALIZACIÓN Y EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar sistema de toast
  ToastSystem.init();

  // Header scroll effect
  const header = document.querySelector('.header');
  window.addEventListener('scroll', EsentiaApp.utils.throttle(() => {
    if (window.scrollY > 50) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  }, 100));

  // Búsqueda en tiempo real
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', EsentiaApp.utils.debounce((e) => {
      const termino = e.target.value;
      if (window.buscador) {
        const resultados = window.buscador.buscar(termino);
        renderizarProductos(resultados);
        //mostrarSugerencias(termino);
      }
    }, 300));
  }

  // Lazy loading de imágenes
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          img.classList.add('loaded');
          imageObserver.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
  }

  // Service Worker para offline (si está disponible)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }

  console.log('🌸 Esentia v2.0 cargado correctamente');
});

// ============================================
// FUNCIONES GLOBALES EXPORTADAS
// ============================================

window.EsentiaApp = EsentiaApp;
window.ToastSystem = ToastSystem;
window.SkeletonLoader = SkeletonLoader;
window.BuscadorInteligente = BuscadorInteligente;
window.Recomendador = Recomendador;
window.FiltroAvanzado = FiltroAvanzado;
window.ComparadorProductos = ComparadorProductos;
window.CacheManager = CacheManager;
