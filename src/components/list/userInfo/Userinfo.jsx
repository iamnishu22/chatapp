import React, { useState, useEffect } from "react";
import "./userInfo.css";
import { useUserStore } from "../../lib/userStore";
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import QRCode from "react-qr-code";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import SuccessPopup from "../../SuccessPopup/SuccessPopup";

const Userinfo = () => {
  const { currentUser, updateUser, fetchUserInfo, isLoading, error } = useUserStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [newAvatar, setNewAvatar] = useState(currentUser?.avatar || "");
  const [newUsername, setNewUsername] = useState(currentUser?.username || "");
  const [newStatus, setNewStatus] = useState(currentUser?.status || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);

  // Group creation states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [users, setUsers] = useState([]); // Store fetched users
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(""); // Define success message
  const [groupCreated, setGroupCreated] = useState(null);

  // Fetch users when the component mounts
  useEffect(() => {
    const fetchUsers = async () => {
      const db = getFirestore();
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    };

    const fetchCurrentUser = async () => {
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (uid) {
        await fetchUserInfo(uid);
        await fetchUsers(); // Fetch users on user info fetch
      }
    };

    if (!currentUser) {     
      fetchCurrentUser();
    } else {
      fetchUsers(); // Fetch users if currentUser is available
    }
  }, [fetchUserInfo, currentUser]);

  const handleGroupCreation = async () => {
    if (!groupName || selectedUsers.length === 0) {
      console.error("Group name and at least one user must be provided.");
      return;
    }
  
    try {
      const db = getFirestore();
      const groupRef = collection(db, "groups");
      const newGroup = await addDoc(groupRef, {
        name: groupName,
        members: selectedUsers, // Store the members in the group document
      });
  
      // Update userchats for all selected users
      for (const userId of selectedUsers) {
        const userChatsRef = doc(db, "userchats", userId);
        const userChatsSnap = await getDoc(userChatsRef);
        const userChatsData = userChatsSnap.data();
        const updatedChats = userChatsData?.chats || [];
  
        updatedChats.push({
          groupId: newGroup.id,
          lastMessage: "New group created",
          isSeen: false,
          pinned: false,
        });
  
        // Update the userchats document
        await updateDoc(userChatsRef, {
          chats: updatedChats,
        });
      }
  
      // Show success message
      setSuccessMessage(`Group "${groupName}" created successfully!`);
      setGroupCreated({ name: groupName, members: selectedUsers });
      resetGroupModalState();
    } catch (error) {
      console.error("Error creating group:", error);
      setUploadError("Failed to create group. Please try again.");
    }
  };
  

  const closeSuccessPopup = () => {
    setSuccessMessage(""); // Clear the success message
  };

  // Toggle user selection for the group
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prevSelected) =>
      prevSelected.includes(userId)
        ? prevSelected.filter((id) => id !== userId) // Deselect user
        : [...prevSelected, userId] // Select user
    );
  };

  // Reset modal state
  const resetModalState = () => {
    setIsModalOpen(false);
    setNewAvatar(currentUser?.avatar || "");
    setNewUsername(currentUser?.username || "");
    setNewStatus(currentUser?.status || "");
    setSelectedFile(null);
  };

  // Reset group modal state
  const resetGroupModalState = () => {
    setIsGroupModalOpen(false);
    setGroupName("");
    setSelectedUsers([]);
    setGroupCreated(null);
  };

  const handleSaveChanges = async () => {
    setIsUploading(true);
    setUploadError(null);

    const updates = {};
    try {
      if (modalType === "avatar" && selectedFile) {
        const storage = getStorage();
        const storageRef = ref(storage, `avatars/${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        const downloadURL = await getDownloadURL(storageRef);
        updates.avatar = downloadURL;
      } else if (modalType === "username") {
        if (!newUsername) throw new Error("Username is required.");
        updates.username = newUsername;
      } else if (modalType === "status") {
        updates.status = newStatus;
      }

      if (Object.keys(updates).length > 0) {
        await updateUser(updates);
        resetModalState();
        setSuccessMessage("User information updated successfully!"); // Add success message
      }
    } catch (error) {
      setUploadError(error.message || "Failed to update user information. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkedDevicesClick = () => {
    setShowQRCode(true);
    setTimeout(() => setShowQRCode(false), 10000);
    closeOptionsModal();
  };

  const closeOptionsModal = () => setIsOptionsModalOpen(false);
  const handleCreateGroupClick = () => {
    setIsGroupModalOpen(true); // Open the group creation modal
    closeOptionsModal();
  };

  const handleNewBroadcastClick = () => {
    console.log("New Broadcast");
    closeOptionsModal();
  };

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="userInfo">
      <div className="user">
        <img src={currentUser?.avatar || "./avatar.png"} alt="User Avatar" />
        <h2>{currentUser?.username}</h2>
        {currentUser?.status && <p>Status: {currentUser.status}</p>}
      </div>

      {showQRCode && (
        <div className="qrCodeOverlay">
          <QRCode
            value="http://localhost:5173/"
            size={200}
            bgColor="white"
            fgColor="black"
          />
        </div>
      )}

      <div className="icons">
        <img
          src="./more.png"
          alt="More Options"
          onClick={() => setIsOptionsModalOpen(true)}
        />
        <img
          src="./edit.png"
          alt="Edit Icon"
          onClick={() => setIsModalOpen(true)}
        />
      </div>

      {isModalOpen && (
        <div className="modal" role="dialog" aria-labelledby="modalTitle">
          <div className="modal-content">
            <h3 id="modalTitle">Change User Info</h3>
            <button onClick={() => { setModalType("avatar"); setNewAvatar(currentUser?.avatar || ""); }}>
              Change Avatar
            </button>
            <button onClick={() => { setModalType("username"); setNewUsername(currentUser?.username || ""); }}>
              Change Username
            </button>
            <button onClick={() => { setModalType("status"); setNewStatus(currentUser?.status || ""); }}>
              Edit Status
            </button>
            <button onClick={handleSaveChanges} disabled={isUploading}>
              {isUploading ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={resetModalState}>Cancel</button>
            {uploadError && <div className="error-message">{uploadError}</div>}

            {modalType === "avatar" && (
              <div>
                <label>
                  Select Avatar Image:
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setNewAvatar(URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />
                </label>
                {newAvatar && <img src={newAvatar} alt="Preview" style={{ width: "100px", height: "100px", marginTop: "10px" }} />}
              </div>
            )}
            {modalType === "username" && (
              <div>
                <label>
                  Username:
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </label>
              </div>
            )}
            {modalType === "status" && (
              <div>
                <label>
                  Status:
                  <input
                    type="text"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
      {isOptionsModalOpen && (
        <div className="modal" role="dialog" aria-labelledby="optionsModalTitle">
          <div className="modal-content">
            <h3 id="optionsModalTitle">Options</h3>
            <button onClick={handleCreateGroupClick}>Create Group</button>
            <button onClick={handleNewBroadcastClick}>New Broadcast</button>
            <button onClick={handleLinkedDevicesClick}>Linked Devices</button>
            <button onClick={closeOptionsModal}>Close</button>
          </div>
        </div>
      )}
      {isGroupModalOpen && (
        <div className="modal" role="dialog" aria-labelledby="groupModalTitle">
          <div className="modal-content">
            <h3 id="groupModalTitle">Create Group</h3>
            <label>
              Group Name:
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </label>
            <div className="user-selection">
              <h4>Select Users:</h4>
              {users.map((user) => (
                <div key={user.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                    {user.username} {/* Adjust this to match your user object structure */}
                  </label>
                </div>
              ))}
            </div>
            <button onClick={handleGroupCreation}>Create Group</button>
            <button onClick={resetGroupModalState}>Cancel</button>
          </div>
        </div>
      )}
      {groupCreated && (
        <div className="group-confirmation">
          <h3>Group Created!</h3>
          <p>Group Name: {groupCreated.name}</p>
          <p>Members: {groupCreated.members.join(', ')}</p>
        </div>
      )}
      <SuccessPopup message={successMessage} onClose={closeSuccessPopup} />
    </div>
  );
};

export default Userinfo;