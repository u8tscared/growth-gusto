/* Growth Gusto — Firebase configuration (public: it identifies the project, it is not a secret; security lives in firestore.rules).
   Set it to null to switch accounts off: the app runs on this device only, and the sign-in buttons say accounts are coming.
   The object comes from Firebase console → ⚙ Paramètres du projet → Vos applications → </> Web → « Configuration » :
   window.GG_FIREBASE = { apiKey: "…", authDomain: "….firebaseapp.com", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   See tools/FIREBASE.md. */
window.GG_FIREBASE = { apiKey: "AIzaSyDHXVawSF20v0orKpr7CpazVkOFQ9F58o0", authDomain: "growth-gusto.firebaseapp.com", projectId: "growth-gusto", storageBucket: "growth-gusto.firebasestorage.app", messagingSenderId: "364546258133", appId: "1:364546258133:web:5ea7b7f7095f7fdf749e5c" };
/* accounts that may read every in-app feedback (appFeedback, see firestore.rules: keep both lists in sync) */
window.GG_ADMINS = ["marceau.ruis@gmail.com"];
