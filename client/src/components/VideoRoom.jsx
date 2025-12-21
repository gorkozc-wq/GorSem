import React, { useEffect, useRef } from 'react';

const VideoCard = ({ stream, isLocal, username, connectionState, hasOthers, isSidebar }) => {
    const videoRef = useRef();

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            const handlePlay = async () => {
                try { await videoRef.current.play(); } catch (e) { }
            };
            handlePlay();
            videoRef.current.onloadedmetadata = handlePlay;
        }
    }, [stream, stream?.id]);

    const togglePiP = async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (videoRef.current) {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP Error:', error);
        }
    };

    return (
        <div className={`video-card ${isLocal ? 'is-local' : ''} ${isSidebar ? 'is-sidebar' : ''}`}>
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="video-element"
                    data-socket-id={!isLocal ? stream?.id : 'local'}
                />
            ) : (
                <div className="video-placeholder">
                    <div className="avatar-circle">
                        {(username || 'U').charAt(0).toUpperCase()}
                    </div>
                </div>
            )}

            <div className="video-name-tag">
                <span className="username">
                    {isLocal ? `${username || 'Siz'} (Siz)` : (username || "Kullanıcı")}
                </span>
                {!isLocal && connectionState !== 'connected' && (
                    <span className="connection-mini-status">Bağlanıyor...</span>
                )}
                {stream && document.pictureInPictureEnabled && (
                    <button
                        className="pip-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePiP();
                        }}
                        title="Resim içinde Resim"
                    >
                        🖼️
                    </button>
                )}
            </div>
        </div>
    );
};

const VideoRoom = ({ localStream, remoteStreams, remoteUsers, currentUser }) => {
    const remoteUserEntries = Object.entries(remoteUsers);

    // Basit mantık: İlk 4 kişi ana gridde, geri kalanı sidebar'da
    const mainParticipants = remoteUserEntries.slice(0, 3); // 3 remote + 1 local = 4 main
    const sidebarParticipants = remoteUserEntries.slice(3);

    return (
        <div className="video-container">
            <div className="main-video-grid">
                {/* Local Video her zaman ana gridde */}
                {localStream && (
                    <VideoCard
                        stream={localStream}
                        isLocal={true}
                        username={currentUser}
                        hasOthers={remoteUserEntries.length > 0}
                    />
                )}

                {/* Main Remote Videos */}
                {mainParticipants.map(([id, username]) => (
                    <VideoCard
                        key={id}
                        stream={remoteStreams[id]}
                        isLocal={false}
                        username={username}
                        connectionState={remoteStreams[id] ? 'connected' : 'waiting'}
                    />
                ))}
            </div>

            {sidebarParticipants.length > 0 && (
                <div className="participants-sidebar">
                    {sidebarParticipants.map(([id, username]) => (
                        <VideoCard
                            key={id}
                            stream={remoteStreams[id]}
                            isLocal={false}
                            username={username}
                            isSidebar={true}
                            connectionState={remoteStreams[id] ? 'connected' : 'waiting'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default VideoRoom;
