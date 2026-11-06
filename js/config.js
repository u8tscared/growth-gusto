/* Growth Gusto — Firebase configuration (public: it identifies the project, it is not a secret; security lives in firestore.rules).
   Set it to null to switch accounts off: the app runs on this device only, and the sign-in buttons say accounts are coming.
   The object comes from Firebase console → ⚙ Paramètres du projet → Vos applications → </> Web → « Configuration » :
   window.GG_FIREBASE = { apiKey: "…", authDomain: "….firebaseapp.com", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   See tools/FIREBASE.md. */
window.GG_FIREBASE = { apiKey: "AIzaSyDHXVawSF20v0orKpr7CpazVkOFQ9F58o0", authDomain: "app.growthgusto.fr", projectId: "growth-gusto", storageBucket: "growth-gusto.firebasestorage.app", messagingSenderId: "364546258133", appId: "1:364546258133:web:5ea7b7f7095f7fdf749e5c" };
/* accounts that may read every in-app feedback (appFeedback, see firestore.rules: keep both lists in sync) */
window.GG_ADMINS = ["marceau.ruis@gmail.com"];
/* ── Commercial layer (js/abo.js) ──
   Online payment is Stripe, server side (functions/src/stripe.js): the admin pastes the Stripe secret key once in
   Espace admin › Paiement en ligne. No key, price or activation code lives in this public file any more. */
/* where « contactez-nous » writes */
window.GG_CONTACT = "contact@growthgusto.fr";

/* server modules deployed with functions/ (tools/SERVER.md): the app shows them as active */
window.GG_SERVER = { sondes: true, alertes: true, resa: true, mails: true, caisse: true };
