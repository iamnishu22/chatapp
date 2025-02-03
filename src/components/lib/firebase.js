import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "groupchatapp-dae4e.firebaseapp.com",
    projectId: "groupchatapp-dae4e",
    storageBucket: "groupchatapp-dae4e.firebasestorage.app",
    messagingSenderId: "809135531117",
    appId: "1:809135531117:web:153ea0b6bafa2b4ab10b64",
    measurementId: "G-WJ918WZL9S"
  };

const app = initializeApp(firebaseConfig);

export const auth=getAuth()
export const db=getFirestore()
export const storage = getStorage(app);

