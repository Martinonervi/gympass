import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, GoogleAuthProvider } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAiXVicWGO7CNs-roSbs3Jcw4RpSFrJ_f0",
  authDomain: "gympass-c6310.firebaseapp.com",
  projectId: "gympass-c6310",
  storageBucket: "gympass-c6310.firebasestorage.app",
  messagingSenderId: "572982171612",
  appId: "1:572982171612:web:9a446d4965c4bdc9086119"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

const db = getFirestore();
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, storage };
