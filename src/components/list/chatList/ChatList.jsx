import { useEffect, useState } from "react";
import "./chatList.css";
import AddUser from "./addUser/addUser";
import { useUserStore } from "../../lib/userStore";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";

const ChatList = () => {
    const [chats, setChats] = useState([]);
    const [addMode, setAddMode] = useState(false);
    const { currentUser } = useUserStore();
    const { chatId, changeChat,groupId } = useChatStore();

    useEffect(() => {
        if (!currentUser.id) return;
    
        const userChatsRef = doc(db, "userchats", currentUser.id);
        const unSub = onSnapshot(userChatsRef, async (res) => {
            const data = res.data();
            if (!data || !data.chats) return;
    
            const items = data.chats;
    
            const promises = items.map(async (item, index) => {
                let user = null;
                let groupName = item.groupId;
    
                // For group chat
                if (groupName) {
                    const groupDocRef = doc(db, "groups", groupName);
                    const groupDocSnap = await getDoc(groupDocRef);
                    const group = groupDocSnap.data();
    
                    // Check if group data is valid before accessing its properties
                    if (group) {
                        user = { groupName: group.name, users: group.users };
                    } else {
                        user = { groupName: "Unnamed Group", users: [] }; // Provide fallback values if group data is missing
                    }
                } else { // For individual chat
                    const userDocRef = doc(db, "users", item.receiverId);
                    const userDocSnap = await getDoc(userDocRef);
                    user = userDocSnap.data();
                }
    
                // Return the chat item with original index and lastMessage
                return { ...item, user, lastMessage: item.lastMessage || "No messages yet", originalIndex: index };
            });
    
            const chatData = await Promise.all(promises);
            setChats(chatData);
        });
    
        return () => {
            unSub();
        };
    }, [currentUser.id]);
     

    // Select a chat (either individual or group)
    const handleSelect = async (chat) => {
        const updatedChats = chats.map(item => {
            const { user, ...rest } = item;
            return rest;
        });
    
        const chatIndex = updatedChats.findIndex(item => item.chatId === chat.chatId);
        if (chatIndex !== -1) {
            updatedChats[chatIndex].isSeen = true;
    
            const userChatsRef = doc(db, "userchats", currentUser.id);
    
            try {
                await updateDoc(userChatsRef, {
                    chats: updatedChats,
                });
    
                // If the chat has a groupId, it's a group chat
                if (chat.groupId) {
                    // Pass groupId and user for group chat
                    changeChat(chat.groupId, chat.user, chat.chatId);
                } else {
                    // If it's an individual chat, pass chatId and user
                    changeChat(chat.chatId, chat.user, chat.chatId);
                }
            } catch (err) {
                console.log(err);
            }
        }
    };
    
    // Toggle pin status of a chat
    const handlePinToggle = async (chat, e) => {
        e.stopPropagation(); // Stop event propagation to prevent triggering other actions
    
        // Toggle pin status only for the clicked chat
        const updatedChats = chats.map(item => {
            if (item.chatId === chat.chatId && item.groupId === chat.groupId) {
                return { 
                    ...item, 
                    pinned: !item.pinned // Toggle pinned status for the clicked chat
                };
            }
            return item;
        });
    
        // Sort chats based on pinned status and original index
        const sortedChats = updatedChats.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; // Pinned chats come first
            return a.originalIndex - b.originalIndex; // Maintain original order for unpinned chats
        });
    
        // Update the state with the sorted chats
        setChats(sortedChats);
    
        const userChatsRef = doc(db, "userchats", currentUser.id);
    
        try {
            await updateDoc(userChatsRef, {
                chats: sortedChats, // Persist the updated chat list to Firestore
            });
        } catch (err) {
            console.error('Error updating pinned chat:', err);
        }
    };
    
    
    // Filter out blocked users or any other condition
    const filteredChats = chats.filter(chat => {
        return !currentUser.blocked.includes(chat.user.id); // Adjust as necessary
    });

    // Sort chats according to pinned status
    const sortedChats = filteredChats.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.originalIndex - b.originalIndex; // Maintain original order for unpinned
    });

    return (
        <div className='chatList'>
            <div className="search">
                <div className="searchBar">
                    <img src="./search.png" alt="Search" />
                    <input type="text" placeholder="Search" />
                </div>
                <img 
                    src={addMode ? "./minus.png" : "./plus.png"} 
                    alt="Add/Remove" 
                    className="add"
                    onClick={() => setAddMode(prev => !prev)} // Toggle add mode
                />
            </div>
           {sortedChats.map((chat, index) => (
    <div
        className={`items ${chat.isSeen ? '' : 'unseen'}`} // Show unread messages with different style
        key={`${chat.chatId || chat.groupId || index}`} // Ensure unique key
        onClick={() => handleSelect(chat)} // Select chat when clicked
    >
        <img 
            src={
                chat.user.groupName 
                    ? chat.user.avatar || "./group-avatar.png"  // Group Avatar
                    : chat.user.avatar || "./avatar.png"   // User Avatar
            } 
            alt={chat.user.groupName ? "Group Avatar" : "User Avatar"} 
        />
        <div className="texts">
            <span>{chat.user.groupName || chat.user.username}</span>
            <p>{chat.lastMessage}</p> {/* Show last message */}
        </div>
        <button 
            className={`pinButton ${chat.pinned ? 'pinned' : ''}`}
            onClick={(e) => handlePinToggle(chat, e)} // Pass the event to the function
        >
            {chat.pinned ? 'Unpin' : 'Pin'}
        </button>
    </div>
))}

            {addMode && <AddUser />} {/* Show AddUser component if in add mode */}
        </div>
    );
};

export default ChatList;
