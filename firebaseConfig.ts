import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // ⬅️ Add this

const firebaseConfig = {
  apiKey: "AIzaSyDEAmvPaF5BmUVzReojj6qe9ILJ5wHkP-s",
  authDomain: "bling-dararocks.firebaseapp.com",
  databaseURL:
    "https://bling-dararocks-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bling-dararocks",
  storageBucket: "bling-dararocks.appspot.com",
  messagingSenderId: "644708181553",
  appId: "1:644708181553:web:095a4250c3911f5eeb5710",
  measurementId: "G-FCKVE5QNKH",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // ⬅️ Export this
