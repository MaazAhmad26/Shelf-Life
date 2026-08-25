import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBmn-_84txnbzEw8RIUqMwpegnTpWozLx0",
  authDomain: "shelf-life-app9835.firebaseapp.com",
  projectId: "shelf-life-app9835",
  storageBucket: "shelf-life-app9835.firebasestorage.app",
  messagingSenderId: "755847174606",
  appId: "1:755847174606:web:b65e68cbb7b1945c10f39f",
  measurementId: "G-QBGEVK3FEP",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);