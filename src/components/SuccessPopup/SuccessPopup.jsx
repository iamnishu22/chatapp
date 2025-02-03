// SuccessPopup.jsx
import React from 'react';
import './SuccessPopup.css'; // Optional: for custom styles

const SuccessPopup = ({ message, onClose }) => {
  if (!message) return null; // Don't render if there's no message

  return (
    <div className="success-popup-overlay">
      <div className="success-popup">
        <h3>Success!</h3>
        <p>{message}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default SuccessPopup;
