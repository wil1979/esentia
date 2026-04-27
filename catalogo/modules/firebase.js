// modules/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc, doc,
  setDoc, updateDoc, addDoc, deleteDoc,
  arrayUnion, serverTimestamp, query, where, orderBy,
  onSnapshot, increment // ✅ IMPORTANTE: Agregado para usePromo
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const config = {
  apiKey: "AIzaSyDuMNZrLgxBs6CbuPp8j0iyynejt6WCpnQ",
  authDomain: "esentiacreditos-8345f.firebaseapp.com",
  projectId: "esentiacreditos-8345f",
  storageBucket: "esentiacreditos-8345f.firebasestorage.app",
  messagingSenderId: "888658236080",
  appId: "1:888658236080:web:506e5e2085b5a452dba175"
};

const app = initializeApp(config);
const db = getFirestore(app);

export const DB = {
  db,
  getStock: () => getDocs(collection(db, "stock")),
  subscribeStock: (callback) => onSnapshot(collection(db, "stock"), callback),
  updateStock: (id, data) => updateDoc(doc(db, "stock", id), data),
  
  getClient: (cedula) => getDocs(query(collection(db, "clientesBD"), where("cedula", "==", cedula))),
  getClientByPhone: (phone) => getDocs(query(collection(db, "clientesBD"), where("telefono", "==", phone))),
  addClient: (data) => addDoc(collection(db, "clientesBD"), { ...data, creado: serverTimestamp() }),
  
  // ✅ CORREGIDO: addInvoice asíncrono y seguro
  addInvoice: async (clientId, invoiceData) => {
    const docRef = doc(db, "facturas", clientId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      // 🆕 Primera compra: crea el documento con estructura válida
      await setDoc(docRef, {
        compras: [invoiceData],
        ultimaCompra: serverTimestamp(),
        lealtad: { premiosReclamados: 0 }
      });
    } else {
      // 🔄 Compra existente: añade al array de forma segura
      await updateDoc(docRef, {
        compras: arrayUnion(invoiceData),
        ultimaCompra: serverTimestamp()
      });
    }
  },
  
  getInvoices: (clientId) => getDoc(doc(db, "facturas", clientId)),
  updateInvoice: (clientId, data) => updateDoc(doc(db, "facturas", clientId), data),
  
  getPromos: () => getDocs(collection(db, "promociones")),
  validatePromo: async (code, clientId) => {
    const q = query(collection(db, "promociones"), where("codigo", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return { valid: false, message: "Código no existe" };
    const promo = snap.docs[0].data();
    const now = new Date();
    if (promo.fechaExpiracion && new Date(promo.fechaExpiracion) < now) return { valid: false, message: "Código expirado" };
    if (promo.usosMax && promo.usosActuales >= promo.usosMax) return { valid: false, message: "Código agotado" };
    if (promo.clientesUsados?.includes(clientId)) return { valid: false, message: "Ya usaste este código" };
    return { valid: true, promo: { id: snap.docs[0].id, ...promo } };
  },
  usePromo: (promoId, clientId) => updateDoc(doc(db, "promociones", promoId), { 
    usosActuales: increment(1), 
    clientesUsados: arrayUnion(clientId) 
  }),
  
  registerVisit: (clientId, data) => setDoc(doc(db, "registroVisitas", clientId), { ...data, ultimaVisita: serverTimestamp() }, { merge: true })
};