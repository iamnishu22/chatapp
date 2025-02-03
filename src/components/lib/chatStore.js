import { arrayUnion, doc, updateDoc, arrayRemove, getDocs, collection } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from './firebase';
import { useUserStore } from './userStore';

export const useChatStore = create((set, get) => ({
  chatId: null,
  user: null,
  chatList: [], // Store for all chats and groups
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,

  // Change the active chat
  changeChat: (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;

    if (user?.blocked?.includes(currentUser.id)) {
      return set({
        chatId,
        user: null,
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
    } else if (currentUser?.blocked?.includes(user?.id)) {
      return set({
        chatId,
        user: user || null,
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
    } else {
      return set({
        chatId,
        user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
      });
    }
  },

  // Update the block/unblock status
  changeBlock: async () => {
    const state = get();
    const { currentUser } = useUserStore.getState();
    const userId = state.user?.id;

    if (!userId || !currentUser) return;

    const userDocRef = doc(db, 'users', currentUser.id);
    const chatRef = doc(db, 'chats', state.chatId);
    const isReceiverBlocked = !state.isReceiverBlocked;

    try {
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked ? arrayUnion(userId) : arrayRemove(userId),
      });

      // Update the chat document
      if (state.chatId) {
        await updateDoc(chatRef, {
          messages: arrayUnion({
            senderId: 'system',
            createdAt: new Date(),
            isSeen: false,
          }),
        });
      }

      set({ isReceiverBlocked });
    } catch (err) {
      console.error('Error updating block status:', err);
    }
  },

  // Fetch all chats (individual and group)
  fetchChats: async () => {
    try {
      // Fetch groups or chats collection
      const groupRef = collection(db, 'groups');
      const groupSnapshot = await getDocs(groupRef);
      const groups = groupSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Assuming there's another collection for individual chats (userchats)
      const userChatsRef = collection(db, 'userchats');
      const userChatsSnapshot = await getDocs(userChatsRef);
      const userChats = userChatsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      set({ chatList: [...groups, ...userChats] }); // Combine groups and individual chats
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  },

  // Send a message in the current chat
  sendMessage: async (messageContent) => {
    const state = get();
    const { currentUser } = useUserStore.getState();
    const chatId = state.chatId;

    if (!chatId || !messageContent.trim()) return;

    try {
      // Prepare the message to be added
      const message = {
        senderId: currentUser.id,
        content: messageContent,
        createdAt: new Date(),
        isSeen: false,
      };

      // Determine if it's a group chat or individual chat
      let chatDocRef;
      if (state.user?.groupName) {
        chatDocRef = doc(db, 'groups', chatId);  // Group chat
      } else {
        chatDocRef = doc(db, 'chats', chatId);  // Individual chat
      }

      // Add message to the appropriate chat document
      await updateDoc(chatDocRef, {
        messages: arrayUnion(message),
      });

      // Optionally update other UI elements like "seen" or "lastMessage"
    } catch (err) {
      console.error('Error sending message:', err);
    }
  },

  // Update the chat list dynamically
  updateChatList: (newChat) => {
    set((state) => ({
      chatList: [...state.chatList, newChat],
    }));
  },
}));
