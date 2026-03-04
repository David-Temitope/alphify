import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

// Firebase config provided by the user
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD9r0kFdISIKFgLg3vwa-D9XpeJrS7jwFc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alphify-4394f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alphify-4394f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alphify-4394f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "824578311617",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:824578311617:web:a4215951c9037023945b40",
  measurementId: "G-1P9J3TBX4H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export const requestNotificationPermission = async (userId: string) => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      if (token) {
        // Save the token to the database
        await supabase
          .from('user_settings')
          .update({ fcm_token: token })
          .eq('user_id', userId);

        console.log('FCM Token saved to database');
        return token;
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return;
  return onMessage(messaging, callback);
};
