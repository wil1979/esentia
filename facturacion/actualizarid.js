import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";

// productos_esentia.json ya cargado en memoria
// ejemplo: const productos = [...];

async function migrarStockViejo() {
  const snap = await getDocs(collection(db, "stock"));

  let migrados = 0;
  let omitidos = 0;
  let sinMatch = 0;

  for (const d of snap.docs) {
    const data = d.data();

    // ⛔ ya tiene stockId → no tocar
    if (data.stockId) {
      omitidos++;
      continue;
    }

    // 🔎 buscar producto en el JSON
    const producto = productos.find(p =>
      p.codigoViejo === data.codigo ||
      p.nombre === data.nombre
    );

    if (!producto) {
      console.warn("⚠️ No se encontró match para:", data.nombre);
      sinMatch++;
      continue;
    }

    // ✍️ actualizar documento
    await updateDoc(doc(db, "stock", d.id), {
      stockId: producto.stockId,
      sku: producto.sku || null,
      migrado: true,
      migradoEn: new Date().toISOString()
    });

    console.log(`✅ Migrado: ${data.nombre} → stockId ${producto.stockId}`);
    migrados++;
  }

  console.log("🎉 MIGRACIÓN TERMINADA");
  console.log("Migrados:", migrados);
  console.log("Omitidos:", omitidos);
  console.log("Sin match:", sinMatch);
}
