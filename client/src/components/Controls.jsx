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
        <div className="controls-bar">
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
