/**
 * ============================================
 * UTILIDADES PARA ESENTIA v2.0
 * ============================================
 * Módulo de funciones reutilizables para:
 * - Notificaciones Toast
 * - Búsqueda Fuzzy
 * - Caché local
 * - Formateo de datos
 */

// ============================================
// 🔔 SISTEMA DE NOTIFICACIONES TOAST
// ============================================

export class ToastNotification {
  constructor() {
    this.container = document.getElementById('toast-container') || this.createContainer();
    this.toasts = [];
  }

  createContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    this.container.appendChild(toast);
    this.toasts.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
          toast.remove();
          this.toasts = this.toasts.filter(t => t !== toast);
        }, 300);
      }, duration);
    }

    return toast;
  }

  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 4000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 3000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }

  clear() {
    this.toasts.forEach(toast => toast.remove());
    this.toasts = [];
  }
}

// Instancia global
export const toast = new ToastNotification();

// ============================================
// 🔍 BÚSQUEDA FUZZY (Difusa)
// ============================================

/**
 * Calcula la similitud entre dos strings (0-1)
 * Basado en Levenshtein distance normalizada
 */
export function fuzzyMatch(search, target) {
  const s = search.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (!s) return 1; // Si no hay búsqueda, coincide todo
  if (!t) return 0;

  // Búsqueda exacta
  if (t.includes(s)) return 1;

  // Búsqueda al inicio
  if (t.startsWith(s)) return 0.95;

  // Distancia de Levenshtein normalizada
  const distance = levenshteinDistance(s, t);
  const maxLength = Math.max(s.length, t.length);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Filtra un array de objetos usando búsqueda fuzzy
 * @param {Array} items - Array de objetos a filtrar
 * @param {string} query - Término de búsqueda
 * @param {Array<string>} fields - Campos a buscar
 * @param {number} threshold - Umbral mínimo de similitud (0-1)
 */
export function fuzzyFilter(items, query, fields = [], threshold = 0.3) {
  if (!query || query.trim().length === 0) return items;

  return items
    .map(item => {
      const scores = fields.map(field => {
        const value = String(item[field] || '');
        return fuzzyMatch(query, value);
      });
      const maxScore = Math.max(...scores);
      return { item, score: maxScore };
    })
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

// ============================================
// 💾 SISTEMA DE CACHÉ LOCAL
// ============================================

export class LocalCache {
  constructor(prefix = 'esentia_') {
    this.prefix = prefix;
  }

  key(name) {
    return `${this.prefix}${name}`;
  }

  set(name, data, expiresIn = null) {
    const item = {
      value: data,
      timestamp: Date.now(),
      expiresIn
    };
    localStorage.setItem(this.key(name), JSON.stringify(item));
  }

  get(name) {
    const stored = localStorage.getItem(this.key(name));
    if (!stored) return null;

    try {
      const item = JSON.parse(stored);
      
      // Verificar expiración
      if (item.expiresIn) {
        const age = Date.now() - item.timestamp;
        if (age > item.expiresIn) {
          this.remove(name);
          return null;
        }
      }

      return item.value;
    } catch (e) {
      console.error('Error al leer caché:', e);
      return null;
    }
  }

  remove(name) {
    localStorage.removeItem(this.key(name));
  }

  clear() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  exists(name) {
    return this.get(name) !== null;
  }
}

export const cache = new LocalCache();

// ============================================
// 📊 FORMATEO DE DATOS
// ============================================

/**
 * Formatea un número como moneda costarricense
 */
export function formatearColones(n) {
  return `₡${Math.round(n).toLocaleString('es-CR')}`;
}

/**
 * Formatea una fecha al formato costarricense
 */
export function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-CR');
}

/**
 * Normaliza un nombre (mayúsculas, sin espacios extras)
 */
export function normalizarNombre(nombre) {
  return nombre
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza un teléfono (solo dígitos)
 */
export function normalizarTelefono(telefono) {
  return String(telefono).replace(/\D/g, '');
}

/**
 * Normaliza una cédula (solo dígitos)
 */
export function normalizarCedula(cedula) {
  return String(cedula).replace(/\D/g, '');
}

// ============================================
// ⏱️ UTILIDADES DE TIEMPO
// ============================================

/**
 * Calcula los días de atraso desde una fecha
 */
export function calcularDiasAtraso(fecha) {
  if (!fecha) return 0;
  const hoy = new Date();
  const fechaCompra = new Date(fecha);
  const diff = hoy - fechaCompra;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Obtiene un badge de color según los días de atraso
 */
export function getBadgeAtraso(dias) {
  if (dias <= 0) return { emoji: '🟢', texto: 'Al día' };
  if (dias <= 7) return { emoji: '🟠', texto: `${dias} días` };
  if (dias <= 30) return { emoji: '🔴', texto: `${dias} días` };
  return { emoji: '⛔', texto: `${dias} días` };
}

// ============================================
// 🔐 VALIDACIONES
// ============================================

/**
 * Valida un teléfono costarricense (8 dígitos)
 */
export function esTeléfonoValido(telefono) {
  const limpio = normalizarTelefono(telefono);
  return /^\d{8}$/.test(limpio);
}

/**
 * Valida una cédula costarricense
 */
export function esCédulaValida(cedula) {
  const limpio = normalizarCedula(cedula);
  return /^\d{9}$/.test(limpio) || /^\d{10}$/.test(limpio) || /^\d{12}$/.test(limpio);
}

/**
 * Valida un email
 */
export function esEmailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ============================================
// 🎯 UTILIDADES DE ARRAYS
// ============================================

/**
 * Agrupa un array por una propiedad
 */
export function agruparPor(array, propiedad) {
  return array.reduce((acc, item) => {
    const key = item[propiedad];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Suma valores de un array
 */
export function sumarArray(array, propiedad) {
  return array.reduce((sum, item) => sum + (Number(item[propiedad]) || 0), 0);
}

/**
 * Obtiene el máximo valor de un array
 */
export function maxArray(array, propiedad) {
  return Math.max(...array.map(item => Number(item[propiedad]) || 0));
}

/**
 * Obtiene el mínimo valor de un array
 */
export function minArray(array, propiedad) {
  return Math.min(...array.map(item => Number(item[propiedad]) || 0));
}

/**
 * Obtiene el promedio de un array
 */
export function promedioArray(array, propiedad) {
  if (array.length === 0) return 0;
  return sumarArray(array, propiedad) / array.length;
}

// ============================================
// 🔄 UTILIDADES ASYNC
// ============================================

/**
 * Espera un tiempo determinado (en ms)
 */
export function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reintenta una función async hasta N veces
 */
export async function reintentar(fn, maxIntentos = 3, delayMs = 1000) {
  for (let i = 0; i < maxIntentos; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxIntentos - 1) throw error;
      await esperar(delayMs);
    }
  }
}

// ============================================
// 📋 UTILIDADES DE CLIPBOARD
// ============================================

/**
 * Copia texto al portapapeles
 */
export async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success('Copiado al portapapeles');
    return true;
  } catch (error) {
    console.error('Error al copiar:', error);
    toast.error('No se pudo copiar al portapapeles');
    return false;
  }
}

// ============================================
// 🎨 UTILIDADES DE DOM
// ============================================

/**
 * Muestra un elemento con animación
 */
export function mostrar(elemento) {
  if (typeof elemento === 'string') {
    elemento = document.getElementById(elemento);
  }
  if (elemento) {
    elemento.classList.remove('hidden');
    elemento.style.display = '';
  }
}

/**
 * Oculta un elemento con animación
 */
export function ocultar(elemento) {
  if (typeof elemento === 'string') {
    elemento = document.getElementById(elemento);
  }
  if (elemento) {
    elemento.classList.add('hidden');
    elemento.style.display = 'none';
  }
}

/**
 * Alterna la visibilidad de un elemento
 */
export function alternar(elemento) {
  if (typeof elemento === 'string') {
    elemento = document.getElementById(elemento);
  }
  if (elemento) {
    elemento.classList.toggle('hidden');
  }
}

/**
 * Limpia el contenido de un elemento
 */
export function limpiar(elemento) {
  if (typeof elemento === 'string') {
    elemento = document.getElementById(elemento);
  }
  if (elemento) {
    elemento.innerHTML = '';
  }
}

// ============================================
// 🔧 UTILIDADES GENERALES
// ============================================

/**
 * Genera un UUID v4
 */
export function generarUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Clona un objeto profundamente
 */
export function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Verifica si un objeto está vacío
 */
export function estaVacio(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * Obtiene el valor de una propiedad anidada
 */
export function obtenerValorAnidado(obj, ruta) {
  return ruta.split('.').reduce((actual, prop) => actual?.[prop], obj);
}

export default {
  ToastNotification,
  toast,
  fuzzyMatch,
  fuzzyFilter,
  LocalCache,
  cache,
  formatearColones,
  formatearFecha,
  normalizarNombre,
  normalizarTelefono,
  normalizarCedula,
  calcularDiasAtraso,
  getBadgeAtraso,
  esTeléfonoValido,
  esCédulaValida,
  esEmailValido,
  agruparPor,
  sumarArray,
  maxArray,
  minArray,
  promedioArray,
  esperar,
  reintentar,
  copiarAlPortapapeles,
  mostrar,
  ocultar,
  alternar,
  limpiar,
  generarUUID,
  clonar,
  estaVacio,
  obtenerValorAnidado
};
