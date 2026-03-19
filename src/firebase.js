import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtGbxgp-yy4rvwJkvy21Va8svPeAQEE3c",
  authDomain: "hrstaff-8465e.firebaseapp.com",
  projectId: "hrstaff-8465e",
  storageBucket: "hrstaff-8465e.firebasestorage.app",
  messagingSenderId: "973752698756",
  appId: "1:973752698756:web:8155bb5fbd08cc45f03fd1",
  measurementId: "G-92BGG4D684"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;
