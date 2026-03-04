importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// User's Firebase project: alphify-4394f
firebase.initializeApp({
  apiKey: "AIzaSyD9r0kFdISIKFgLg3vwa-D9XpeJrS7jwFc",
  authDomain: "alphify-4394f.firebaseapp.com",
  projectId: "alphify-4394f",
  storageBucket: "alphify-4394f.firebasestorage.app",
  messagingSenderId: "824578311617",
  appId: "1:824578311617:web:a4215951c9037023945b40",
  measurementId: "G-1P9J3TBX4H"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/alphify-icon-192.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
