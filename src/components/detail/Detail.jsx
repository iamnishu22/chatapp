import { arrayRemove, arrayUnion, updateDoc, doc, getDoc, getDocs, collection } from "firebase/firestore";
import { useChatStore } from "../lib/chatStore";
import { auth, db } from "../lib/firebase";
import { useUserStore } from "../lib/userStore";
import "./detail.css";
import { useState, useEffect } from "react";

const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock } = useChatStore();
  const { currentUser } = useUserStore();
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisappearingOptions, setShowDisappearingOptions] = useState(false);
  const [notification, setNotification] = useState("");
  const [showPrivacyHelp, setShowPrivacyHelp] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
const [addedMembers, setAddedMembers] = useState([]);  // Track members already in the chat

useEffect(() => {
  const fetchAllUsers = async () => {
    const userCollectionRef = collection(db, "users");
    const userQuerySnapshot = await getDocs(userCollectionRef);

    const usersList = [];
    userQuerySnapshot.forEach((doc) => {
      const userData = doc.data();
      usersList.push({ id: doc.id, username: userData.username, avatar: userData.avatar });
    });

    setAllUsers(usersList);
  };

  const fetchChatMembers = async () => {
    if (!chatId) return;

    const chatDocRef = doc(db, "chats", chatId);
    const chatDoc = await getDoc(chatDocRef);
    if (chatDoc.exists()) {
      const chatData = chatDoc.data();
      setAddedMembers(chatData.members || []);  // Assuming chat has a "members" field
    }
  };

  fetchAllUsers();
  fetchChatMembers();
}, [chatId]);

const handleAddMember = async (user) => {
  if (!chatId) return;

  const chatRef = doc(db, "chats", chatId);

  try {
    // Add the user to the chat
    await updateDoc(chatRef, {
      members: arrayUnion(user.id),
    });

    // Update the state with the added member
    setAddedMembers((prev) => [...prev, user.id]);
  } catch (err) {
    console.error("Error adding member:", err);
  }
};

const handleRemoveMember = async (user) => {
  if (!chatId) return;

  const chatRef = doc(db, "chats", chatId);

  try {
    // Remove the user from the chat
    await updateDoc(chatRef, {
      members: arrayRemove(user.id),
    });

    // Update the state with the removed member
    setAddedMembers((prev) => prev.filter((id) => id !== user.id));
  } catch (err) {
    console.error("Error removing member:", err);
  }
};


  // Fetch blocked users when the component mounts
  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (!currentUser) return;

      const userDocRef = doc(db, "users", currentUser.id);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const blockedIds = userDoc.data().blocked || [];
        const blockedUsernames = await fetchUsernames(blockedIds);
        setBlockedUsers(blockedUsernames);
      }
    };

    fetchBlockedUsers();
  }, [currentUser]);

  // Fetch usernames based on user IDs
  const fetchUsernames = async (userIds) => {
    const usernames = [];
    const userCollectionRef = collection(db, "users");

    const userQuerySnapshot = await getDocs(userCollectionRef);
    userQuerySnapshot.forEach(doc => {
      const userData = doc.data();
      if (userIds.includes(doc.id)) {
        usernames.push({ id: doc.id, username: userData.username });
      }
    });

    return usernames;
  };

  const handleBlock = async () => {
    if (!user || !currentUser) return;

    const userDocRef = doc(db, "users", currentUser.id);
    const targetUserDocRef = doc(db, "users", user.id);

    try {
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
      });

      await updateDoc(targetUserDocRef, {
        blockedBy: isCurrentUserBlocked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
      });

      // Update local state for blocked users
      setBlockedUsers(prev => {
        if (isReceiverBlocked) {
          return prev.filter(blockedUser => blockedUser.id !== user.id);
        } else {
          return [...prev, { id: user.id, username: user.username }];
        }
      });

      changeBlock();
    } catch (err) {
      console.error("Error updating block status:", err);
    }
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(prev => (prev === option ? null : option));
  };
  

  const handleDeleteChat = async () => {
    if (!chatId) return;

    const chatRef = doc(db, "chats", chatId);
    const userChatsRef = doc(db, "userchats", currentUser.id);

    try {
      await updateDoc(chatRef, {
        messages: []
      });

      const userChatsSnapshot = await getDoc(userChatsRef);
      if (userChatsSnapshot.exists()) {
        const userChatsData = userChatsSnapshot.data();
        const updatedChats = userChatsData.chats.filter(chat => chat.chatId !== chatId);

        await updateDoc(userChatsRef, {
          chats: updatedChats
        });
      }

      console.log("Chat deleted successfully");
      setShowDeleteModal(false);
    } catch (err) {
      console.error("Error deleting chat:", err);
    }
  };

  const handleEditMessage = () => {
    console.log("Edit message clicked");
  };

  const handleToggleDisappearingMessages = () => {
    setShowDisappearingOptions(prev => !prev);
  };

  const handleSetDisappearingTime = async (duration) => {
    const chatRef = doc(db, "chats", chatId);

    try {
      await updateDoc(chatRef, {
        disappearingMessages: duration,
      });

      setTimeout(async () => {
        await updateDoc(chatRef, {
          messages: []
        });
        console.log(`Messages cleared after ${duration} milliseconds`);
      }, duration);

      const timeUnits = {
        1000: "1 Second",
        3600000: "1 Hour",
        43200000: "12 Hours",
        86400000: "24 Hours"
      };
      setNotification(`Messages will disappear after ${timeUnits[duration]}.`);

      setShowDisappearingOptions(false);

      setTimeout(() => {
        setNotification("");
      }, 3000);
    } catch (err) {
      console.error("Error setting disappearing messages:", err);
    }
  };

  return (
    <div className="detail">
      <div className="user">
      {
  user?.groupName ? (
    <>
      <img 
        src="./group-avatar.png" 
        alt="Group Avatar" 
      />
      <h2>{user?.groupName}</h2>  {/* Display group name */}
      <p>{user?.groupStatus || "This is a group chat"}</p>  {/* Display group status */}
    </>
  ) : (
    <>
      <img 
        src={user?.avatar || "./avatar.png"} 
        alt="User Avatar" 
      />
      <h2>{user?.username}</h2>  {/* Display username */}
      <p>{user?.status || "I am using chat application"}</p>  {/* Display user status */}
    </>
  )
}

      </div>
      <div className="info">
        <div className="option">
          <div className="title" onClick={() => setShowChatSettings(prev => !prev)}>
            <span>Chat Settings</span>
            <img src={showChatSettings ? "./arrowDown.png" : "./arrowUp.png"} alt="Arrow" />
          </div>
          {showChatSettings && (
            <div className="modal-overlay">
              <div className="modal-content">
                <center><h3>Chat Settings</h3></center>
                <ul className="chat-settings-options">
                  <li onClick>Add member</li>
                  <li onClick={() => setShowDeleteModal(true)}>Delete Chat</li>
                  <li onClick={handleEditMessage}>Edit Message</li>
                  <li onClick={handleToggleDisappearingMessages}>Disappearing Messages</li>
                </ul>
                <button onClick={() => setShowChatSettings(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
        <div className="option">
          <div className="title" onClick={() => setShowPrivacyHelp(prev => !prev)}>
            <span>Privacy & Help</span>
            <img src={showPrivacyHelp ? "./arrowDown.png" : "./arrowUp.png"} alt="Arrow" />
          </div>
          {showPrivacyHelp && (
            <div className="modal-overlay">
              <div className="modal-content">
                <center><h3>Privacy & Help</h3></center>
                <ul className="chat-settings-options">
                  <li onClick={() => handleOptionSelect('Blocked')}>Blocked</li>
                  {/* <li onClick={() => handleOptionSelect('Login Alerts')}>Login Alerts</li> */}
                  {/* <li onClick={() => handleOptionSelect('Location')}>Location</li> */}
                  {/* <li onClick={() => handleOptionSelect('Two-Step Verification')}>Two-Step Verification</li> */}
                  <li onClick={() => handleOptionSelect('Help Center')}>Help Center</li>
                </ul>
                <button onClick={() => setShowPrivacyHelp(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
        {selectedOption === 'Blocked' && (
          <div className="blocked-users">
            <h4>Blocked Users</h4>
            <ul>
              {blockedUsers.length > 0 ? (
                blockedUsers.map(({ id, username }) => (
                  <li key={id}>{username}</li>
                ))
              ) : (
                <h5>No users blocked</h5>
              )}
            </ul>
          </div>
        )}
        <div className="option">
          <div className="title">
            <span>Shared photos</span>
            <img src="./arrowDown.png" alt="Arrow Down" />
          </div>
          <div className="photo">
            <div className="photoItem">
              <div className="photoDetail">
                <img src="./cute.png" alt="Photo Thumbnail" />
                <span>photo_2024_2.png</span>
              </div>
              <img src="./download.png" alt="Download" className="icon" />
            </div>
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span>Shared Files</span>
            <img src="./arrowUp.png" alt="Arrow Up" />
          </div>
        </div>
      </div>
      <button onClick={handleBlock}>
        {isCurrentUserBlocked ? "You are Blocked!!" : isReceiverBlocked ? "Unblock" : "Block"}
      </button>
      <button className="logout" onClick={() => auth.signOut()}>
        Logout
      </button>

      {/* Notification Display */}
      {notification && <div className="notification">{notification}</div>}

      {/* Confirmation Modal for Delete Chat */}
      {showDeleteModal && (
        <div className="dialog-box">
          <div className="dialog-content">
            <h3>Are you sure you want to delete this chat?</h3>
            <button onClick={handleDeleteChat}>Confirm Delete</button>
            <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Disappearing Messages */}
      {showDisappearingOptions && (
        <div className="dialog-box">
          <div className="dialog-content">
            <h3>Select Disappearing Message Duration</h3>
            <ul className="disappearing-options">
              <li onClick={() => handleSetDisappearingTime(1000)}>1 Second</li>
              <li onClick={() => handleSetDisappearingTime(3600000)}>1 Hour</li>
              <li onClick={() => handleSetDisappearingTime(43200000)}>12 Hours</li>
              <li onClick={() => handleSetDisappearingTime(86400000)}>24 Hours</li>
            </ul>
            <button className="close-button" onClick={() => setShowDisappearingOptions(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Detail;