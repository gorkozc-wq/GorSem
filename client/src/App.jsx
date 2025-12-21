import React, { useState, useEffect, useRef } from 'react';
import socketService from './services/socket';
import rtcService from './services/webrtc';
import VideoRoom from './components/VideoRoom';
import Chat from './components/Chat';
import './App.css';

// Basit bir Debug Logger
const DebugPanel = ({ logs }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '300px',
    height: '200px',
    background: 'rgba(0,0,0,0.8)',
    color: '#0f0',
    fontSize: '10px',
    overflowY: 'auto',
    zIndex: 9999,
    padding: '5px',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    display: 'none' // Kullanıcı isteğiyle artık gizleyebiliriz veya UI task'ında açarız. Şimdilik gizli kalsın kafa karıştırmasın.
  }}>
    {logs.map((log, i) => <div key={i}>{log}</div>)}
  </div>
);

// ----------------------------------------------------------------------
// Ana Uygulama Bileşeni
// ----------------------------------------------------------------------
// Tüm uygulama mantığı (State yönetimi, Socket olayları, WebRTC bağlantıları) burada toplanır.
// Gerçek bir uygulamada bunlar Context API veya Redux ile daha modüler hale getirilebilir.
const MeetingHeader = ({ roomId }) => {
  const [time, setTime] = useState('00:00:00');

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="teams-header">
      <div className="header-left">
        <div className="meeting-info">
          <span className="recording-dot"></span>
          <span className="timer">{time}</span>
        </div>
        <div className="divider"></div>
        <h2 className="room-title">{roomId || 'Toplantı'}</h2>
      </div>
    </div>
  );
};

const BottomControls = ({ audioEnabled, toggleAudio, videoEnabled, toggleVideo, screenSharing, handleScreenShare, leaveRoom, isChatOpen, toggleChat, unreadCount }) => {
  return (
    <div className="bottom-bar">
      <div className="pill-controls">
        <button onClick={toggleVideo} className={`btn-icon large ${!videoEnabled ? 'danger' : ''}`} title="Camera">
          {videoEnabled ? '📹' : '🚫'}
        </button>
        <button onClick={toggleAudio} className={`btn-icon large ${!audioEnabled ? 'danger' : ''}`} title="Mic">
          {audioEnabled ? '🎤' : '🚫'}
        </button>
        <button onClick={handleScreenShare} className={`btn-icon large ${screenSharing ? 'active' : ''}`} title="Share">
          📤
        </button>
        <button onClick={toggleChat} className={`btn-icon large ${isChatOpen ? 'active' : ''}`} style={{ position: 'relative' }} title="Chat">
          💬
          {unreadCount > 0 && !isChatOpen && <span className="notification-badge">{unreadCount}</span>}
        </button>
        <div className="control-divider"></div>
        <button onClick={leaveRoom} className="btn-leave-round" title="Leave">
          📞
        </button>
      </div>
    </div>
  );
};

const DynamicInput = ({ placeholder, value, onChange, required }) => {
  const spanRef = useRef();
  const [width, setWidth] = useState('auto');

  useEffect(() => {
    if (spanRef.current) {
      // Calculate width based on hidden span + padding
      const newWidth = Math.max(150, spanRef.current.offsetWidth + 30);
      setWidth(`${newWidth}px`);
    }
  }, [value, placeholder]);

  return (
    <div className="dynamic-input-container">
      <span ref={spanRef} className="width-measure">
        {value || placeholder}
      </span>
      <input
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={{ width }}
        className="dynamic-input"
      />
    </div>
  );
};

function App() {
  const [step, setStep] = useState('lobby');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteUsers, setRemoteUsers] = useState({});
  const [messages, setMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  useEffect(() => {
    if (!socketService.socket) socketService.connect();
    socketService.socket.removeAllListeners();

    socketService.socket.on("user-connected", async ({ socketId, username }) => {
      setRemoteUsers(prev => ({ ...prev, [socketId]: username }));
      try {
        const offer = await rtcService.createOffer(socketId);
        socketService.sendOffer({ target: socketId, caller: socketService.socket.id, sdp: offer });
      } catch (err) { console.error(err); }
    });

    socketService.socket.on("all-users", (users) => {
      console.log("All users received:", users);
      const usersMap = {};
      users.forEach(u => { usersMap[u.socketId] = u.username; });
      setRemoteUsers(usersMap);
    });

    socketService.socket.on("offer", async (payload) => {
      try {
        const answer = await rtcService.createAnswer(payload.caller, payload.sdp);
        socketService.sendAnswer({ target: payload.caller, caller: socketService.socket.id, sdp: answer });
      } catch (err) { console.error(err); }
    });

    socketService.socket.on("answer", async (payload) => {
      try { await rtcService.addAnswer(payload.caller, payload.sdp); } catch (err) { console.error(err); }
    });

    socketService.socket.on("ice-candidate", async (payload) => {
      try { await rtcService.addIceCandidate(payload.caller, payload.candidate); } catch (err) { console.error(err); }
    });

    socketService.socket.on("user-disconnected", (socketId) => {
      rtcService.closePeer(socketId);
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[socketId];
        return newStreams;
      });
      setRemoteUsers(prev => {
        const newUsers = { ...prev };
        delete newUsers[socketId];
        return newUsers;
      });
    });

    socketService.socket.on("room-closed", () => {
      alert("Oda kapatıldı.");
      window.location.reload();
    });

    socketService.socket.on("receive-message", (data) => {
      setMessages(prev => [...prev, { ...data, isMe: data.sender === socketService.socket.id || data.sender === username }]);
      if (!isChatOpen) setUnreadCount(prev => prev + 1);
    });

    rtcService.onTrack = (socketId, stream) => {
      setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
    };

    rtcService.onIceCandidate = (targetId, candidate) => {
      socketService.sendIceCandidate({ target: targetId, candidate: candidate });
    };

    return () => { if (socketService.socket) socketService.socket.removeAllListeners(); }
  }, []);

  useEffect(() => { if (isChatOpen) setUnreadCount(0); }, [isChatOpen]);

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomId || !username) return;
    try {
      const stream = await rtcService.initializeLocalStream();
      setLocalStream(stream);
    } catch (err) { console.error(err); }
    socketService.joinRoom(roomId, username);
    setStep('room');
  };

  const handleSendMessage = (msg) => socketService.sendMessage(roomId, msg, username);

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !audioEnabled);
      setAudioEnabled(!audioEnabled);
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !videoEnabled);
      setVideoEnabled(!videoEnabled);
    }
  }

  const handleScreenShareLogic = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];
        Object.values(rtcService.peers).forEach(peer => {
          const videoSender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) videoSender.replaceTrack(screenVideoTrack, videoSender);
          if (screenAudioTrack) {
            const audioSender = peer.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (audioSender) audioSender.replaceTrack(screenAudioTrack, audioSender);
          }
        });
        setLocalStream(screenStream);
        screenVideoTrack.onended = () => { stopScreenShare(); };
        setScreenSharing(true);

        // Auto-PiP: Ekran paylaşımı başladığında diğer kişinin videosunu PiP yap
        setTimeout(async () => {
          try {
            const remoteVideos = document.querySelectorAll('.video-element:not([data-socket-id="local"])');
            if (remoteVideos.length > 0 && document.pictureInPictureEnabled) {
              // En az bir uzaktaki kullanıcı varsa ilkini PiP yap
              await remoteVideos[0].requestPictureInPicture();
            }
          } catch (pipErr) {
            console.warn("Auto-PiP failed:", pipErr);
          }
        }, 1000); // Videonun render edilmesi için kısa bir süre bekle
      } catch (err) { console.error(err); }
    } else {
      stopScreenShare();
    }
  }

  const stopScreenShare = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const videoTrack = userStream.getVideoTracks()[0];
      const audioTrack = userStream.getAudioTracks()[0];
      Object.values(rtcService.peers).forEach(peer => {
        const videoSender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack, videoSender);
        const audioSender = peer.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (audioSender && audioTrack) audioSender.replaceTrack(audioTrack, audioSender);
      });
      setLocalStream(userStream);
      setScreenSharing(false);
    } catch (err) { console.error(err); }
  };

  const leaveRoom = () => window.location.reload();

  if (step === 'lobby') {
    return (
      <div className="lobby-container">
        <div className="lobby-content">
          <img src="/logo.png" alt="Logo" className="lobby-logo" />
          <h1 className="lobby-title">GörSem</h1>
          <form onSubmit={handleJoinRoom} className="lobby-form">
            <DynamicInput
              placeholder="Adınız"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
            <DynamicInput
              placeholder="Oda ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary lobby-submit">Görüşmeye Katıl</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="main-layout vertical">
      <MeetingHeader roomId={roomId} />

      <div className="content-area horizontal">
        <VideoRoom
          localStream={localStream}
          remoteStreams={remoteStreams}
          remoteUsers={remoteUsers}
          currentUser={username}
        />

        {isChatOpen && (
          <div className="chat-sidebar">
            <div className="chat-header">
              <h3 style={{ margin: 0 }}>Sohbet</h3>
              <button onClick={() => setIsChatOpen(false)} className="close-chat-btn">✖</button>
            </div>
            <Chat messages={messages} sendMessage={handleSendMessage} />
          </div>
        )}
      </div>

      <BottomControls
        audioEnabled={audioEnabled}
        toggleAudio={toggleAudio}
        videoEnabled={videoEnabled}
        toggleVideo={toggleVideo}
        screenSharing={screenSharing}
        handleScreenShare={handleScreenShareLogic}
        leaveRoom={leaveRoom}
        isChatOpen={isChatOpen}
        toggleChat={() => setIsChatOpen(!isChatOpen)}
        unreadCount={unreadCount}
      />
    </div>
  );
}

export default App;
