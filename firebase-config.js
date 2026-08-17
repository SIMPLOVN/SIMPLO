/* ═══════════════════════════════════════════════════
   Firebase Configuration — Calendário Acadêmico
   ═══════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyA3ZtmRs0g7vOGCEgeNq3Q6ScXQaDsUWRI",
  authDomain: "calendario-academico-ec838.firebaseapp.com",
  projectId: "calendario-academico-ec838",
  storageBucket: "calendario-academico-ec838.firebasestorage.app",
  messagingSenderId: "214842478309",
  appId: "1:214842478309:web:bcaf8429b33ba5299c4e0c"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Referência ao Firestore
const db = firebase.firestore();

// Referências aos documentos
const dayDataRef  = db.collection('app').doc('dayData');
const materialsRef = db.collection('app').doc('materials');

console.log('🔥 Firebase conectado com sucesso!');
