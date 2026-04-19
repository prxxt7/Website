(() => {
  const host = String(window.location.hostname || "").toLowerCase();
  const isLocalHost = host === "127.0.0.1" || host === "localhost";
  const isRenderHost = host.endsWith(".onrender.com");

  window.SPYGLASS_API_BASE = isLocalHost
    ? "http://127.0.0.1:8080"
    : isRenderHost
      ? window.location.origin
      : "https://spy-glass-house.onrender.com";
})();
window.SPYGLASS_ADMIN_EMAILS = ["mmpptt9@gmail.com"];
window.SPYGLASS_WHATSAPP_NUMBER = "919999999999";
window.SPYGLASS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAY0x7nhWy4MJ1JWkPYagd6P_QS06U1JJ4",
  authDomain: "spy-glass-house.firebaseapp.com",
  projectId: "spy-glass-house",
  storageBucket: "spy-glass-house.firebasestorage.app",
  messagingSenderId: "23532303547",
  appId: "1:23532303547:web:61f7b9c2451f0f489fa59e"
};
