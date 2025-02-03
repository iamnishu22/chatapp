    import { useEffect, useRef, useState } from "react";
    import "./chat.css";
    import EmojiPicker from "emoji-picker-react";
    import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
    import { db } from "../lib/firebase";
    import { useChatStore } from "../lib/chatStore";
    import { useUserStore } from "../lib/userStore";
    import upload from "../lib/upload";
    import { format, isToday, isYesterday } from 'date-fns';
    import AgoraRTC from "agora-rtc-sdk-ng";
    import { getFirestore, doc as firestoreDoc, setDoc } from "firebase/firestore";  // Renamed doc

    // Custom Popups for Errors
    const showPopup = (message) => {
        alert(message); // You can replace this with a custom modal or toast
    };
    
    const checkMicrophone = async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMic = devices.some(device => device.kind === "audioinput");
        if (!hasMic) {
        showPopup("Microphone not found!");
        return false;
        }
        return true;
    };
    
    const checkCamera = async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCam = devices.some(device => device.kind === "videoinput");
        if (!hasCam) {
        showPopup("Camera not found!");
        return false;
        }
        return true;
    };
    


    const Chat = () => {
        const [isCallActive, setIsCallActive] = useState(false);
        const localVideoRef = useRef(null);
        const remoteVideoRef = useRef(null);
        const client = useRef(null);
        const localAudioTrack = useRef(null);
        const localVideoTrack = useRef(null);
        const [chat, setChat] = useState(null);
        const [open, setOpen] = useState(false);
        const [text, setText] = useState("");
        const [img, setImg] = useState({ file: null, url: "" });
        const [isRecording, setIsRecording] = useState(false);
        const [recordedChunks, setRecordedChunks] = useState([]);
        const [mediaRecorder, setMediaRecorder] = useState(null);
        const [infoMenuOpen, setInfoMenuOpen] = useState(false);
        const [isDeleting, setIsDeleting] = useState(false);
        const [selectedMessages, setSelectedMessages] = useState([]);
        const [searchQuery, setSearchQuery] = useState("");
        const [filteredMessages, setFilteredMessages] = useState([]);
        const [showSearchInput, setShowSearchInput] = useState(false);
        const [showCamera, setShowCamera] = useState(false);
        const [cameraImage, setCameraImage] = useState("");
        const [cameraError, setCameraError] = useState("");  // New state for camera errors
        const [errorMessage, setErrorMessage] = useState("");  // State for general errors
        const [errorVisible, setErrorVisible] = useState(false); // State to control error visibility
        const {isCurrentUserBlocked, isReceiverBlocked } = useChatStore();
        const videoRef = useRef(null);
        const canvasRef = useRef(null);
        const endRef = useRef(null);
        const [showWallpaperInput, setShowWallpaperInput] = useState(false);
        const APP_ID = "54ac37daa6bb430d8c4bbe7f82167e17";
        const TOKEN = null; // For testing, you can leave it as null if the project doesn’t have token authentication enabled.
        const CHANNEL = "test";
        const { currentUser } = useUserStore();
        const { chatId, changeChat, user, groupId } = useChatStore();

        const chatName = user?.groupName || user?.username || "No Name";

        const startCall = async () => {
            client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            client.current.on("user-published", handleUserPublished);
            client.current.on("user-unpublished", handleUserUnpublished);
        
            await client.current.join(APP_ID, CHANNEL, TOKEN, null);
        
            localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
            localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();
            localVideoTrack.current.play(localVideoRef.current);
        
            await client.current.publish([localAudioTrack.current, localVideoTrack.current]);
            setIsCallActive(true);
        };
        
        const handleUserPublished = async (user, mediaType) => {
            await client.current.subscribe(user, mediaType);
        
            if (mediaType === 'video') {
            user.videoTrack.play(remoteVideoRef.current);
            }
            if (mediaType === 'audio') {
            user.audioTrack.play();
            }
        };
        
        const handleUserUnpublished = (user) => {
            const remoteContainer = document.getElementById(user.uid);
            if (remoteContainer) remoteContainer.remove();
        };
        
        const endCall = async () => {
            localAudioTrack.current.close();
            localVideoTrack.current.close();
            await client.current.unpublish();
            await client.current.leave();
            setIsCallActive(false);
        };

        const handleWallpaperChange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const chatContainer = document.querySelector('.chat'); // Target the chat component
                    chatContainer.style.backgroundImage = `url(${e.target.result})`;
                    chatContainer.style.backgroundSize = 'cover'; // Make sure it covers the area
                    chatContainer.style.backgroundPosition = 'center'; // Center the image
                    chatContainer.style.backgroundRepeat = 'no-repeat'; // Prevent repeating
                };
                reader.readAsDataURL(file);
            }
        };
        
        
            
        const formatTimestamp = (timestamp) => {
            const date = timestamp.toDate();

            if (isToday(date)) {
                return format(date, 'h:mm a');
            } else if (isYesterday(date)) {
                return ` ${format(date, 'h:mm a')}`;
            } else {
                return format(date, 'h:mm a');
            }
        };

        const groupMessagesByDate = (messages) => {
            if (!messages.length) return [];

            const grouped = [];
            let currentDate = null;

            messages.forEach(message => {
                const messageDate = new Date(message.createdAt.toDate()).toDateString();

                if (messageDate !== currentDate) {
                    currentDate = messageDate;
                    const label =
                        isToday(new Date(message.createdAt.toDate())) ? 'Today' :
                        isYesterday(new Date(message.createdAt.toDate())) ? 'Yesterday' :
                        format(new Date(message.createdAt.toDate()), 'dd-MMM-yyyy');

                    grouped.push({ type: 'date', label });
                }

                grouped.push({ type: 'message', data: message });
            });

            return grouped;
        };

        useEffect(() => {
            if (!chatId) return;

            const chatRef = doc(db, "chats", chatId);
            const unSub = onSnapshot(chatRef, (res) => {
                setChat(res.data());
            }, (error) => {
                console.error("Error fetching chat data:", error);
            });

            return () => {
                unSub();
            };
        }, [chatId]);

        useEffect(() => {
            if (chat) {
                setFilteredMessages(chat.messages);
            }
        }, [chat]);

        useEffect(() => {
            endRef.current?.scrollIntoView({ behavior: "smooth" });
        }, [filteredMessages]);

        useEffect(() => {
            if (chat) {
                const results = chat.messages.filter(message =>
                    message.text?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                setFilteredMessages(results);
            }
        }, [searchQuery, chat]);

        useEffect(() => {
            if (errorMessage) {
                setErrorVisible(true);
                const timer = setTimeout(() => {
                    setErrorVisible(false);
                    setErrorMessage("");  // Clear the error message after timeout
                }, 3000);

                return () => clearTimeout(timer); // Clean up the timeout if the component unmounts
            }
        }, [errorMessage]);

        const handleEmoji = (e) => {
            setText(prev => prev + e.emoji);
            setOpen(false);
        };

        const handleImg = (e) => {
            if (e.target.files[0]) {
                setImg({
                    file: e.target.files[0],
                    url: URL.createObjectURL(e.target.files[0])
                });
            }
        };

        const shouldShowMessage = (message) => {
            if (!currentUser || !user) return false;
            if (isCurrentUserBlocked && message.senderId === currentUser.id) return false;
            if (isReceiverBlocked && message.senderId === user.id) return false;
            return true;
        };

        const handleStartRecording = () => {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(stream => {
                        const recorder = new MediaRecorder(stream);
                        setMediaRecorder(recorder);

                        recorder.ondataavailable = (event) => {
                            if (event.data.size > 0) {
                                setRecordedChunks(prev => [...prev, event.data]);
                            }
                        };

                        recorder.onstop = async () => {
                            const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
                            const audioUrl = await uploadAudio(audioBlob);
                            await handleSend({ audio: audioUrl });
                        };

                        recorder.start();
                        setIsRecording(true);
                    })
                    .catch(error => console.error("Error accessing microphone:", error));
            } else {
                setErrorMessage("Your browser does not support audio recording.");
            }
        };

        const handleStopRecording = () => {
            if (mediaRecorder) {
                mediaRecorder.stop();
                setIsRecording(false);
                setRecordedChunks([]);
            }
        };

        const uploadAudio = async (audioBlob) => {
            const filename = `audio_${Date.now()}.wav`;
            const uploadPath = `path/to/your/storage/${filename}`;
            const storageRef = firebase.storage().ref(uploadPath);
            await storageRef.put(audioBlob);
            return await storageRef.getDownloadURL();
        };

        const handleSend = async (additionalData = {}) => {
            if (text.trim() === "" && !img.file && !additionalData.audio) return;
        
            if (isCurrentUserBlocked || isReceiverBlocked) {
                setErrorMessage("You cannot send a message. You are blocked or the receiver is blocked.");
                return;
            }
        
            let imgUrl = null;
        
            try {
                if (img.file) {
                    imgUrl = await upload(img.file);
                }
        
                const chatRef = firestoreDoc(db, "chats", chatId);  // Use firestoreDoc instead of doc
        
                // Check if the chat document exists
                const chatDoc = await getDoc(chatRef);
        
                if (!chatDoc.exists()) {
                    // If the chat document doesn't exist, create it
                    console.log("Chat document doesn't exist, creating new document.");
                    await setDoc(chatRef, {
                        messages: [
                            {
                                id: Date.now(),
                                senderId: currentUser.id,
                                text,
                                createdAt: new Date(),
                                isSeen: false,
                                ...(imgUrl && { img: imgUrl }),
                                ...(additionalData.audio && { audio: additionalData.audio })
                            }
                        ],
                    });
                } else {
                    // If the document exists, update it
                    console.log("Chat document exists, updating.");
                    await updateDoc(chatRef, {
                        messages: arrayUnion({
                            id: Date.now(),
                            senderId: currentUser.id,
                            text,
                            createdAt: new Date(),
                            isSeen: false,
                            ...(imgUrl && { img: imgUrl }),
                            ...(additionalData.audio && { audio: additionalData.audio })
                        }),
                    });
                }
        
                const userIDs = [currentUser.id, user.id];
                
                // Update user chats for both users
                await Promise.all(userIDs.map(async (id) => {
                    const userChatsRef = firestoreDoc(db, "userchats", id);  // Use firestoreDoc instead of doc
                    const userChatsSnapshot = await getDoc(userChatsRef);
        
                    if (userChatsSnapshot.exists()) {
                        const userChatsData = userChatsSnapshot.data();
                        const chatIndex = userChatsData.chats.findIndex(
                            (c) => c.chatId === chatId
                        );
        
                        if (chatIndex !== -1) {
                            userChatsData.chats[chatIndex].lastMessage = text;
                            userChatsData.chats[chatIndex].isSeen = id === currentUser.id;
                            userChatsData.chats[chatIndex].updatedAt = new Date();
        
                            await updateDoc(userChatsRef, {
                                chats: userChatsData.chats,
                            });
                        }
                    }
                }));
        
                setText("");
                setImg({ file: null, url: "" });
            } catch (err) {
                console.error("Error sending message:", err);
                setErrorMessage("Error sending message: " + err.message);
            }
        };
        
        const handleDeleteMessages = async () => {
            if (!chatId) return;

            const chatRef = doc(db, "chats", chatId);
            try {
                const chatDoc = await getDoc(chatRef);
                if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    const updatedMessages = chatData.messages.filter(msg => !selectedMessages.includes(msg.id));

                    await updateDoc(chatRef, {
                        messages: updatedMessages,
                    });

                    setSelectedMessages([]);
                    setIsDeleting(false);
                    setShowSearchInput(false);
                }
            } catch (err) {
                setErrorMessage("Error deleting messages: " + err.message);
            }
        };

        const toggleMessageSelection = (messageId) => {
            setSelectedMessages(prev => 
                prev.includes(messageId)
                    ? prev.filter(id => id !== messageId)
                    : [...prev, messageId]
            );
        };

        const handleSearch = () => {
            setShowSearchInput(true);
        };

        const handleClearChat = () => {
            if (chatId) {
                const chatRef = doc(db, "chats", chatId);
                updateDoc(chatRef, {
                    messages: []
                })
                .then(() => {
                    setShowSearchInput(false);
                })
                .catch(err => setErrorMessage("Error clearing chat: " + err.message));
            }
        };

        const handleSearchChange = (e) => {
            setSearchQuery(e.target.value);
        };

        const handleCameraClick = () => {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then(stream => {
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                            setShowCamera(true);
                            setCameraError("");  // Clear any previous errors
                        }
                    })
                    .catch(error => {
                        setCameraError("Error accessing camera: " + error.message);
                        console.error("Error accessing camera:", error);
                    });
            } else {
                setCameraError("Your browser does not support camera access.");
                alert("Your browser does not support camera access.");
            }
        };

        const handleCapture = () => {
            if (canvasRef.current && videoRef.current) {
                const context = canvasRef.current.getContext('2d');
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvasRef.current.toDataURL('image/png');
                setCameraImage(dataUrl);
                setShowCamera(false);  // Hide camera after capture
                // Here you can upload the image if needed
            } else {
                setCameraError("Error capturing image: Ensure video stream is active.");
            }
        };
        useEffect(() => {
            // Initialize Agora client or other setup when component mounts
            client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

            // Clean up the Agora client on component unmount
            return () => {
                if (client.current) {
                    client.current.leave();
                    client.current = null;
                }
            };
        }, []);

        const handleAudioCall = async () => {
        const micAvailable = await checkMicrophone();
        if (micAvailable) {
            // Proceed with audio call setup
            console.log("Microphone found. Starting audio call...");
        }
        };

        const handleVideoCall = async () => {
        const camAvailable = await checkCamera();
        if (camAvailable) {
            // Proceed with video call setup
            console.log("Camera found. Starting video call...");
        }
        };

        return (
            <div className='chat'>
            <div className="top">
                    <div className="user">
                        {(!isReceiverBlocked || !isCurrentUserBlocked) && (
    <img
    src={user?.groupName ? "./group-avatar.png" : user?.avatar || "./avatar.png"}
    alt={user?.groupName ? "Group Avatar" : "User Avatar"}
    />                    )}
    <div className="texts">
            <span>{chatName}</span>  
            {/* Display group name if group chat, otherwise display username */}
            <p>{user?.groupName ? "This is a group chat" : user?.status || "I am using chat application"}</p>
        </div>

                    </div>
                    <div className="icons">
                        <img 
                            src="./phone.png" 
                            alt="Phone Icon" 
                        onClick={handleAudioCall}
                            style={{ cursor: 'pointer' }}
                        />
                        <img 
                            src="./video.png" 
                            alt="Video Icon" 
                            onClick={handleVideoCall} 
                            style={{ cursor: 'pointer' }}
                        />
                        <img
                            src="./info.png"
                            alt="Info Icon"
                            onClick={() => setInfoMenuOpen(prev => !prev)}
                            style={{ cursor: 'pointer' }}
                        />
                    </div>
                </div>
                {isCallActive && (
                    <div className="call-container">
                        {isVideoCall && (
                            <div className="video-call">
                                <div ref={localVideoRef} style={{ width: '320px', height: '240px' }} />
                                <div ref={remoteVideoRef} style={{ width: '320px', height: '240px' }} />
                            </div>
                        )}
                        <button onClick={endCall}>
                            End Call
                        </button>
                    </div>
                )}
              <div className="center">
        {/* Render filtered messages */}
        {groupMessagesByDate(filteredMessages).map((item, index) => (
          item.type === 'date' ? (
            <div key={index} className="dateLabel">
              {item.label}
            </div>
          ) : (
            shouldShowMessage(item.data) && (
              <div
                className={`message ${item.data.senderId === currentUser.id ? 'own' : ''}`}
                key={item.data.id}
                style={{ backgroundColor: item.data.isSeen ? 'transparent' : '#518fe' }}
              >
                <div className="texts">
                  {item.data.text && (
                    <div className="textMessage">
                      <p>{item.data.text}
                        <div className="timestamp">
                          {formatTimestamp(item.data.createdAt)}
                        </div>
                      </p>
                    </div>
                  )}
                  {item.data.img && (
                    <div className="imageMessage">
                      <img src={item.data.img} alt="Message Attachment" />
                      <div className="timestamp">
                        {formatTimestamp(item.data.createdAt)}
                      </div>
                    </div>
                  )}
                  {item.data.audio && (
                    <div className="audioMessage">
                      <audio controls>
                        <source src={item.data.audio} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  {isDeleting && item.data.senderId === currentUser.id && (
                    <div className="deleteCheckbox">
                      <input
                        type="checkbox"
                        checked={selectedMessages.includes(item.data.id)}
                        onChange={() => toggleMessageSelection(item.data.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          )
        ))}

        {/* If there's an image preview or camera image */}
        {img.url && (
          <div className="message own">
            <div className="texts">
              <img src={img.url} alt="Selected" />
            </div>
          </div>
        )}
        {cameraImage && (
          <div className="message own">
            <div className="texts">
              <img src={cameraImage} alt="Captured" />
            </div>
          </div>
        )}

        {/* Display error message if any */}
        {errorVisible && (
          <div className="error">{errorMessage}</div>
        )}

        {/* End reference for scrolling */}
        <div ref={endRef}></div>
      </div>
            <div className="bottom">
                <div className="icons">
                    <label htmlFor="file">
                        <img src="./img.png" alt="Image Icon" />
                    </label>
                    <input type="file" id="file" style={{ display: "none" }} onChange={handleImg} />
                    <img
                        src="./camera.png"
                        alt="Camera Icon"
                        onClick={handleCameraClick}  // Open camera
                        style={{ cursor: 'pointer' }}
                    />
                    <img
                        src="./mic.png"
                        alt="Mic Icon"
                        onClick={() => {
                            if (isRecording) {
                                handleStopRecording();
                            } else {
                                handleStartRecording();
                            }
                        }}
                        style={{ cursor: 'pointer' }}
                    />
                </div>
                <input
                    type="text"
                    placeholder={(isCurrentUserBlocked || isReceiverBlocked) ? "You cannot send a message" : "Type a message..."}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isCurrentUserBlocked || isReceiverBlocked}
                />
                <div className="emoji">
                    <img
                        src="./emoji.png"
                        alt="Emoji Icon"
                        onClick={() => setOpen(prev => !prev)}
                    />
                    {open && (
                        <div className="picker">
                            <EmojiPicker onEmojiClick={handleEmoji} />
                        </div>
                    )}
                </div>
                <button
                    className="sendButton"
                    onClick={() => handleSend()}
                    disabled={isCurrentUserBlocked || isReceiverBlocked}
                >
                    Send
                </button>
            </div>
            {infoMenuOpen && (
    <div className="infoMenu">
        {showSearchInput ? (
            <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{ marginBottom: "10px", padding: "5px", borderRadius: "5px", border: "1px solid #ccc" }}
            />
        ) : (
            <button onClick={() => { handleSearch(); setInfoMenuOpen(false); }}>
                Search
            </button>
        )}
        
        {isDeleting ? (
            <button onClick={() => { handleDeleteMessages(); setInfoMenuOpen(false); }}>
                Confirm Delete
            </button>
        ) : (
            <button onClick={() => {
                setIsDeleting(prev => !prev);
                setShowSearchInput(false);
            }}>
                {isDeleting ? "Cancel" : "Delete Message"}
            </button>
        )}

        <button onClick={() => { handleClearChat(); setInfoMenuOpen(false); }}>
            Clear Chat
        </button>

        <button onClick={() => { setShowWallpaperInput(prev => !prev); }}>
            {showWallpaperInput ? "Cancel" : "Set Wallpaper"}
        </button>
        
        {showWallpaperInput && (
            <input
                type="file"
                accept="image/*"
                onChange={(e) => { handleWallpaperChange(e); setInfoMenuOpen(false); }}
                style={{ marginTop: "10px" }}
            />
        )}
    </div>
)}


            {showCamera && (
                <div className="cameraOverlay">
                    <video ref={videoRef} autoPlay></video>
                    <button onClick={handleCapture}>Capture</button>
                    <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
                </div>
            )}
        </div>
    );
};

export default Chat;