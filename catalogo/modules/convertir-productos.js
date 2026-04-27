// tools/convertir-productos.js
// Ejecutar con Node.js: node convertir-productos.js

const fs = require('fs');

// Función para convertir estructura Limpieza
function convertirLimpieza(origen) {
  return {
    id: origen.id,
    nombre: origen.nombre,
    tipo: 'Limpieza',
    precio: origen.precioPublico,
    categoria: origen.categoria,
    variantes: origen.aromas?.map(a => ({ nombre: a, precio: origen.precioPublico })) || [],
    stock: 100, // Ajustar según necesidad
    activo: origen.disponible !== false,
    precioCompra: origen.precioCompra,
    imagen: origen.imagen
  };
}

// Función para convertir estructura Velas
function convertirVelas(origen) {
  return {
    id: origen.id,
    nombre: origen.nombre,
    tipo: 'Velas',
    precio: origen.precio,
    categoria: origen.tipo?.split('|')[0] || 'Decorativas',
    variantes: [
      { nombre: 'Pequeña', precio: origen.precio },
      { nombre: 'Mediana', precio: origen.precioOferta || origen.precio * 1.5 },
      { nombre: 'Grande', precio: origen.precioOriginal || origen.precio * 2 }
    ],
    stock: origen.stock || 10,
    activo: origen.disponible !== false,
    // Campos adicionales
    precioOferta: origen.precioOferta,
    precioOriginal: origen.precioOriginal,
    descripcion: origen.descripcion,
    beneficios: origen.beneficios,
    duracion: origen.duracion,
    peso: origen.peso,
    materiales: origen.materiales,
    esNuevo: origen.esNuevo,
    esBestseller: origen.esBestseller,
    calificacion: origen.calificacion,
    imagen: origen.imagen
  };
}

// Ejemplo de uso:
// const limpiezaOriginal = JSON.parse(fs.readFileSync('limpieza-original.json', 'utf8'));
// const convertido = limpiezaOriginal.map(convertirLimpieza);
// fs.writeFileSync('data/productos_limpieza_completo.json', JSON.stringify(convertido, null, 2));

console.log('✅ Scripts de conversión listos');