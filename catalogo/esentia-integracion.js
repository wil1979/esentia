/**
 * ESENTIA - PUENTE DE INTEGRACIÓN v1.1
 * Corrección: Búsqueda y Filtros funcionando
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Esperar a que productos estén cargados desde esentia.js
    const checkAndInit = setInterval(() => {
        if (window.catalogoListo && window.productos?.length > 0) {
            clearInterval(checkAndInit);
            initMejoras();
        }
    }, 500);

    function initMejoras() {
        console.log('🔧 Inicializando búsqueda y filtros...');

        // 1. INSTANCIAR CLASES DE esentia-mejorado.js
        // Nota: BuscadorInteligente espera productos con propiedades estándar
        window.buscador = new BuscadorInteligente(window.productos.map(p => ({
            ...p,
            id: p.id || p.nombre, // Asegurar que tenga id
            info: p.info || '',
            beneficios: p.beneficios || '',
            tipo: p.tipo || 'Otros'
        })));

        // FiltroAvanzado usa aplicarFiltros (no aplicar)
        window.filtro = new FiltroAvanzado(window.productos);

        // 2. CONFIGURAR BÚSQUEDA EN TIEMPO REAL
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', EsentiaApp.utils.debounce((e) => {
                const termino = e.target.value.trim();
                
                if (!termino) {
                    // Si está vacío, mostrar todos los productos
                    window.renderizarProductos(window.productos);
                    return;
                }

                // Usar buscador inteligente
                const resultados = window.buscador.buscar(termino, {
                    limite: 50,
                    busquedaDifusa: true
                });
                
                window.renderizarProductos(resultados);
                
                // Feedback visual
                if (resultados.length === 0) {
                    ToastSystem?.mostrar ? 
                        ToastSystem.mostrar('No se encontraron resultados', 'warning') :
                        mostrarToast('No se encontraron resultados', '#e74c3c');
                }
            }, 300));
        }

        // 3. CONFIGURAR PANEL DE FILTROS
        const btnFiltros = document.getElementById('btnFiltros');
        const panelFiltros = document.getElementById('panelFiltros');
        if (btnFiltros && panelFiltros) {
            btnFiltros.addEventListener('click', () => {
                panelFiltros.style.display = panelFiltros.style.display === 'none' ? 'block' : 'none';
            });
        }

        // 4. CONFIGURAR BOTÓN "APLICAR FILTROS"
        const btnAplicar = document.querySelector('#panelFiltros button[type="button"], #panelFiltros button:not([type])');
        if (btnAplicar) {
            btnAplicar.addEventListener('click', () => {
                const tipo = document.getElementById('filtroTipo')?.value || undefined;
                const min = document.getElementById('filtroPrecioMin')?.value;
                const max = document.getElementById('filtroPrecioMax')?.value;
                
                const criterios = {
                    tipo: tipo,
                    precioMin: min ? Number(min) : undefined,
                    precioMax: max ? Number(max) : undefined,
                    disponible: true // Solo productos en stock
                };

                // ⚠️ IMPORTANTE: FiltroAvanzado usa aplicarFiltros (con "s" al final)
                const resultados = window.filtro.aplicarFiltros(criterios);
                
                window.renderizarProductos(resultados);
                
                // Feedback
                const msg = resultados.length === 0 ? 
                    'Sin resultados con estos filtros' : 
                    `${resultados.length} producto${resultados.length !== 1 ? 's' : ''} encontrado${resultados.length !== 1 ? 's' : ''}`;
                    
                ToastSystem?.mostrar ? 
                    ToastSystem.mostrar(msg, resultados.length ? 'success' : 'warning') :
                    mostrarToast(msg, resultados.length ? '#25d366' : '#e74c3c');
            });
        }

       // 5. CONFIGURAR BOTÓN "LIMPIAR FILTROS"
const btnLimpiar = document.querySelector('#panelFiltros button:last-child');
if (btnLimpiar && btnLimpiar !== btnAplicar) {
    btnLimpiar.addEventListener('click', () => {
        // Resetear inputs con verificación segura (JS puro)
        const filtroTipo = document.getElementById('filtroTipo');
        const filtroMin = document.getElementById('filtroPrecioMin');
        const filtroMax = document.getElementById('filtroPrecioMax');
        
        if (filtroTipo) filtroTipo.value = '';
        if (filtroMin) filtroMin.value = '';
        if (filtroMax) filtroMax.value = '';
        
        // Mostrar todos los productos
        window.renderizarProductos(window.productos);
        
        // Feedback con fallback seguro
        if (window.ToastSystem?.mostrar) {
            ToastSystem.mostrar('Filtros limpiados', 'info');
        } else if (typeof mostrarToast === 'function') {
            mostrarToast('Filtros limpiados', '#6c4ba3');
        }
    });
}

        // 6. LLENAR SELECT DE TIPOS DINÁMICAMENTE
        const selectTipo = document.getElementById('filtroTipo');
        if (selectTipo && selectTipo.options.length <= 1) {
            const tipos = [...new Set(window.productos.map(p => p.tipo).filter(Boolean))].sort();
            tipos.forEach(tipo => {
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                selectTipo.appendChild(opt);
            });
        }
    }
});

// ==========================================
// FUNCIONES GLOBALES PARA HTML (Handlers)
// ==========================================

// Toggle Favoritos (compatible con ambos sistemas)
window.toggleFavorito = function(nombre) {
    if (!EsentiaApp.state.favoritos) EsentiaApp.state.favoritos = new Set();
    
    const esFav = EsentiaApp.state.favoritos.has(nombre);
    if (esFav) {
        EsentiaApp.state.favoritos.delete(nombre);
        (ToastSystem?.mostrar || mostrarToast)(esFav ? 'Eliminado de favoritos' : 'Agregado a favoritos ❤️', esFav ? '#e74c3c' : '#25d366');
    } else {
        EsentiaApp.state.favoritos.add(nombre);
        (ToastSystem?.mostrar || mostrarToast)('Agregado a favoritos ❤️', '#25d366');
    }
    // Re-render para actualizar iconos
    if (window.buscador) {
        const resultados = window.buscador.buscar(document.getElementById('searchInput')?.value || '');
        window.renderizarProductos(resultados);
    } else {
        window.renderizarProductos();
    }
};

// Toggle Comparador (adaptado a estructura de esentia.js)
window.toggleComparador = function(nombre) {
    const prod = window.productos.find(p => p.nombre === nombre);
    if (!prod) return;

    // Adaptar producto al formato esperado por ComparadorProductos
    const prodAdaptado = { 
        ...prod, 
        id: prod.id || prod.nombre,
        precio: prod.precioOferta || prod.precio || 3000
    };

    if (!window.comparador) window.comparador = new ComparadorProductos();
    
    const resultado = window.comparador.agregar(prodAdaptado);
    
    if (resultado.exito) {
        (ToastSystem?.mostrar || mostrarToast)('Agregado para comparar', '#6c4ba3');
    } else {
        window.comparador.eliminar(prodAdaptado.id);
        (ToastSystem?.mostrar || mostrarToast)('Eliminado del comparador', '#e74c3c');
    }
    
    // Actualizar contador y visibilidad del botón
    const btn = document.getElementById('btnComparador');
    const count = document.getElementById('countComparador');
    if (btn && count) {
        count.textContent = window.comparador.items.length;
        btn.style.display = window.comparador.items.length > 0 ? 'inline-block' : 'none';
    }
    
    // Re-render para actualizar iconos
    window.renderizarProductos();
};

// Abrir/Cerrar Modal Comparador
window.abrirComparador = function() {
    const modal = document.getElementById('modalComparador');
    const grid = document.getElementById('comparadorGrid');
    if (!modal || !grid) return;

    grid.innerHTML = '';
    window.comparador?.items?.forEach(p => {
        const precio = p.precioOferta || p.precio || 3000;
        grid.innerHTML += `
            <div class="card-comparacion">
                <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='https://wil1979.github.io/esentia-factura/images/logo.png'">
                <h4>${p.nombre}</h4>
                <p class="precio">₡${precio.toLocaleString()}</p>
                <p class="beneficios">${p.beneficios || 'Sin beneficios especificados'}</p>
                <button class="btn-agregar" onclick="agregarAlCarritoSimple('${p.nombre.replace(/'/g, "\\'")}', ${precio})">
                    Agregar →
                </button>
            </div>
        `;
    });
    modal.style.display = 'flex';
};

window.cerrarComparador = function() {
    const modal = document.getElementById('modalComparador');
    if (modal) modal.style.display = 'none';
};

// Función auxiliar para agregar desde comparador (sin modal)
window.agregarAlCarritoSimple = function(nombre, precio) {
    const prod = window.productos.find(p => p.nombre === nombre);
    if (!prod) return;
    
    carrito.push({
        id: Date.now(),
        nombre: prod.nombre,
        imagen: prod.imagen,
        variante: 'Hogar / Oficina 30 ml',
        precio: precio,
        cantidad: 1
    });
    guardarCarrito();
    (ToastSystem?.mostrar || mostrarToast)('✓ Producto agregado', '#25d366');
};
// ==========================================
// CONFIGURACIÓN OPCIONAL - SERVICE WORKER
// ==========================================
const CONFIG = {
    enableServiceWorker: false, // ← Cambia a 'true' solo cuando tengas sw.js
    enableOfflineCache: false,
    enableRecomendacionesIA: true
};

// Registro condicional del Service Worker
if (CONFIG.enableServiceWorker && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ SW registrado:', reg.scope))
        .catch(err => console.warn('⚠️ SW no disponible (esperado):', err.message));
}
// En esentia-integracion.js, después de cargar los scripts:
if (window.navigator?.serviceWorker?.register) {
    // Reemplazar con noop para evitar errores si no hay sw.js
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function(scriptURL, options) {
        if (scriptURL.includes('sw.js') && !CONFIG.enableServiceWorker) {
            console.log('🔕 SW registration skipped (config)');
            return Promise.resolve({ scope: location.href });
        }
        return originalRegister.call(this, scriptURL, options);
    };
}