import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from './firebase'; // Import your Firestore instance
import { getAuth } from 'firebase/auth';

export const useUserStore = create((set, get) => ({
  currentUser: {
    avatar: "./cute.png",
    username: "DefaultUser",
    status: "" 
  },
  users: [],
  isLoading: true,
  error: null,
  unsubscribe: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const usersCol = collection(db, 'users');
      const userSnapshot = await getDocs(usersCol);
      const usersList = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      set({ users: usersList, isLoading: false });
    } catch (err) {
      console.error("Failed to fetch users:", err);
      set({ error: err.message, isLoading: false });
    }
  },

  fetchUserInfo: async (uid) => {
    if (!uid) {
      set({ currentUser: null, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        set({ currentUser: docSnap.data(), isLoading: false });
      } else {
        set({ currentUser: null, isLoading: false });
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      set({ currentUser: null, error: err.message, isLoading: false });
    }
  },

  updateUser: async (updates) => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;

    if (!uid || !updates) return;

    try {
      const docRef = doc(db, "users", uid);
      await updateDoc(docRef, updates);
      set((state) => ({
        currentUser: { ...state.currentUser, ...updates }
      }));
    } catch (err) {
      console.error("Error updating user:", err);
      set({ error: err.message });
    }
  },

  subscribeToUserInfo: (uid) => {
    if (!uid) return;

    const docRef = doc(db, "users", uid);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        set({ currentUser: snapshot.data(), isLoading: false });
      } else {
        set({ currentUser: null, isLoading: false });
      }
    }, (err) => {
      console.error('Error subscribing to user info:', err);
      set({ error: err.message });
    });

    set({ unsubscribe });
  },

  unsubscribeFromUserInfo: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  }
}));
