// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Veritabanı için gerekli

// Senin verdiğin ayarlar
const firebaseConfig = {
  apiKey: "AIzaSyCqB10Dzm7ZjNtOL1tvyO2fJfdnERTRhuo",
  authDomain: "mazotapp-70882.firebaseapp.com",
  projectId: "mazotapp-70882",
  storageBucket: "mazotapp-70882.firebasestorage.app",
  messagingSenderId: "697624805306",
  appId: "1:697624805306:web:3f9e36a6ade21eb860e783"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Veritabanını başlat ve dışarıya aç (App.js kullanabilsin diye)
export const db = getFirestore(app);