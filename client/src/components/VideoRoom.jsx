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
        <div className="video-card" style={{
            position: 'relative',
            borderRadius: '1rem',
            overflow: 'hidden',
            background: '#000',
            aspectRatio: '16/9',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
        }}>
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    // Remote videoları da sessize alalım ki autoplay çalışsın.
                    // Kullanıcı aynı odada kendi sesini duymaması için yankı yapabilir, o yüzden mute iyidir.
                    // Gerçek hayatta kullanıcı açmak isteyebilir ama test için mute şart.
                    muted={true}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: isLocal ? 'scaleX(-1)' : 'none'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    flexDirection: 'column'
                }}>
                    <span>Video Bekleniyor...</span>
                    <span style={{ fontSize: '0.7em' }}>Track Status: Waiting</span>
                </div>
            )}

            <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.6)',
                padding: '4px 12px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                backdropFilter: 'blur(4px)'
            }}>
                <span style={{
                    fontSize: '0.9rem',
                    color: 'white',
                    fontWeight: 'bold',
                }}>
                    {isLocal ? `${username || 'Siz'} (Siz)` : (username || "Kullanıcı")}
                </span>
                {!isLocal && (
                    <span style={{
                        fontSize: '0.7rem',
                        color: connectionState === 'connected' ? '#4ade80' : '#f87171'
                    }}>
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
        <div className="video-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
            padding: '1rem',
            flex: 1,
            alignContent: 'center'
        }}>
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
