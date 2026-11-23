/*
 * Feedback Fatima - Firebase client configuration.
 * Client config is public; authorization is enforced by Firebase Rules and the Worker.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCOWCTMbpG2vTD3I6sUcAH1KPstjG9-lUg",
  authDomain: "feedback-fatima.firebaseapp.com",
  projectId: "feedback-fatima",
  storageBucket: "feedback-fatima.firebasestorage.app",
  messagingSenderId: "84845637469",
  appId: "1:84845637469:web:60c9a2fa2b77f577b282b4",
  measurementId: "G-HP6DWGWB6H"
};
if (!window.firebase) throw new Error("Firebase SDK did not load.");
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
window.firebaseAuth = firebase.auth();
window.firebaseDb = firebase.firestore();
window.FEEDBACK_ADMIN_UID = "LOnmkvnLwjYdDtATbJ8sDbieHZQ2";
window.FEEDBACK_UPLOAD_WORKER_URL = "https://feedback-fatima-upload.aishfatimasiddiqui.workers.dev";
window.FEEDBACK_CLOUDINARY_CLOUD_NAME = "doz60trsm";
