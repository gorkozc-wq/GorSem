import React, { useEffect, useRef } from 'react';

const VideoCard = ({ stream, isLocal, username, connectionState }) => {
    const videoRef = useRef();

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;

            const handlePlay = async () => {
                try {
                    await videoRef.current.play();
                } catch (e) {
                    // console.error("Video play failed:", e); // Autoplay policy hatası olabilir, sessiz kalalım veya butonu gösterelim
                }
            };

            handlePlay();

            // Bazen play asenkron kalır veya metadata yüklenince gerekir
            videoRef.current.onloadedmetadata = handlePlay;

            // Stream aktif mi kontrolü
            // console.log("Stream tracks:", stream.getTracks());
        }
    }, [stream, stream?.id, stream?.getTracks().length]);

    return (
        <div className="video-card">
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay     // Video yüklendiği anda otomatik oynat
                    playsInline  // Mobil tarayıcılarda tam ekran olmadan oynatmayı sağlar

                    // Remote videoları da sessize alalım ki autoplay çalışsın.
                    // Tarayıcılar (Chrome/Safari), kullanıcının etkileşimi olmadan sesli video oynatmayı engeller.
                    // Bu yüzden başlangıçta 'muted' olması garanti oynatmayı sağlar.
                    muted={isLocal}
                    className={`video-element ${isLocal ? 'local-video' : ''}`}
                />
            ) : (
                <div className="video-placeholder">
                    <span>Video Bekleniyor...</span>
                    <span className="track-status">Track Status: Waiting</span>
                </div>
            )}

            <div className="video-info">
                <span className="username">
                    {isLocal ? `${username || 'Siz'} (Siz)` : (username || "Kullanıcı")}
                </span>
                {!isLocal && (
                    <span className={`connection-status ${connectionState === 'connected' ? 'connected' : 'disconnected'}`}>
                        {connectionState || 'Bağlanıyor...'}
                    </span>
                )}
            </div>
        </div>
    );
};

const VideoRoom = ({ localStream, remoteStreams, remoteUsers, currentUser }) => {
    // Debug için
    console.log("VideoRoom render:", { remoteStreams, remoteUsers });

    return (
        <div className="video-grid">
            {localStream && <VideoCard stream={localStream} isLocal={true} username={currentUser} />}

            {Object.entries(remoteUsers).map(([id, username]) => (
                <VideoCard
                    key={id}
                    stream={remoteStreams[id]}
                    isLocal={false}
                    username={username}
                    connectionState={remoteStreams[id] ? 'connected' : 'waiting'}
                />
            ))}
        </div>
    );
};

export default VideoRoom;
