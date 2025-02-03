import React, { useRef, useState } from 'react';

const Camera = () => {
    const videoRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const openCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraOpen(true);
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    };

    return (
        <div>
            <img
                src="./camera.png"
                alt="Camera Icon"
                onClick={openCamera}
                style={{ width: '50px', height: '50px', cursor: 'pointer' }}
            />
            {isCameraOpen && (
                <video
                    ref={videoRef}
                    width="640"
                    height="480"
                    autoPlay
                    style={{ border: '1px solid black' }}
                ></video>
            )}
        </div>
    );
};

export default Camera;