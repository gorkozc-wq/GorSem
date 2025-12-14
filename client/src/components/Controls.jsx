import React, { useState } from 'react';

const Controls = ({
    audioEnabled,
    videoEnabled,
    screenSharing,
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
    onLeave
}) => {
    return (
        <div className="controls-bar" style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '1rem',
            background: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: '2rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            zIndex: 100
        }}>
            <button
                className={`btn-icon ${!audioEnabled ? 'btn-danger' : ''}`}
                onClick={onToggleAudio}
                title={audioEnabled ? "Mute" : "Unmute"}
            >
                {audioEnabled ? "🎤" : "🔇"}
            </button>

            <button
                className={`btn-icon ${!videoEnabled ? 'btn-danger' : ''}`}
                onClick={onToggleVideo}
                title={videoEnabled ? "Stop Camera" : "Start Camera"}
            >
                {videoEnabled ? "📹" : "📷"}
            </button>

            <button
                className={`btn-icon ${screenSharing ? 'btn-primary' : ''}`}
                onClick={onToggleScreenShare}
                title="Share Screen"
            >
                {screenSharing ? "🛑" : "📺"}
            </button>

            <button
                className="btn-icon btn-danger"
                onClick={onLeave}
                title="Leave Call"
            >
                📞
            </button>
        </div>
    );
};

export default Controls;
