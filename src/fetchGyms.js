import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default async function fetchGyms() {
  const snapshot = await getDocs(collection(db, "gimnasios"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}