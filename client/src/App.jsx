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
const MeetingHeader = ({ roomId, participantCount }) => {
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
        <div className="divider"></div>
        <span className="participant-badge">👤 {participantCount} Kişi</span>
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

  // Mixleme Değişkenleri (Ref ile saklıyoruz ki cleanup kolay olsun)
  const mixingRefs = useRef({
    audioCtx: null,
    animationId: null,
    canvas: null,
    screenVideo: null,
    cameraVideo: null
  });

  const handleScreenShareLogic = async () => {
    if (!screenSharing) {
      try {
        // 1. Ekran ve Sistem Sesini Al
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        // 2. Mevcut Kamera ve Mikrofonu Al (Eğer varsa)
        const micTrack = localStream?.getAudioTracks()[0];
        const cameraTrack = localStream?.getVideoTracks()[0];

        // 3. Audio Mixleme (Web Audio API)
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        mixingRefs.current.audioCtx = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        if (micTrack) {
          const micSource = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
          micSource.connect(dest);
        }
        if (screenAudioTrack) {
          const screenAudioSource = audioCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
          screenAudioSource.connect(dest);
        }

        // 4. Video Mixleme (Canvas)
        const canvas = document.createElement('canvas');
        mixingRefs.current.canvas = canvas;
        const ctx = canvas.getContext('2d');

        const screenVideo = document.createElement('video');
        screenVideo.srcObject = new MediaStream([screenVideoTrack]);
        screenVideo.play();
        mixingRefs.current.screenVideo = screenVideo;

        const cameraVideo = document.createElement('video');
        if (cameraTrack) {
          cameraVideo.srcObject = new MediaStream([cameraTrack]);
          cameraVideo.play();
          mixingRefs.current.cameraVideo = cameraVideo;
        }

        const render = () => {
          if (!screenVideoTrack.enabled || screenVideoTrack.readyState === 'ended') return;

          const settings = screenVideoTrack.getSettings();
          canvas.width = settings.width || 1280;
          canvas.height = settings.height || 720;

          // Ana Ekranı Çiz
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

          // Kamerayı Sağ Alt Köşeye Çiz (Overlay)
          if (cameraTrack && cameraTrack.enabled) {
            const camW = canvas.width / 4;
            const camH = (camW * 9) / 16;
            const padding = 20;
            ctx.fillStyle = "#000";
            ctx.fillRect(canvas.width - camW - padding - 2, canvas.height - camH - padding - 2, camW + 4, camH + 4);
            ctx.drawImage(cameraVideo, canvas.width - camW - padding, canvas.height - camH - padding, camW, camH);
          }

          mixingRefs.current.animationId = requestAnimationFrame(render);
        };
        render();

        const mixedVideoTrack = canvas.captureStream(30).getVideoTracks()[0];
        const mixedAudioTrack = dest.stream.getAudioTracks()[0];

        // 5. Kanalları Değiştir
        Object.values(rtcService.peers).forEach(peer => {
          const videoSender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) videoSender.replaceTrack(mixedVideoTrack);
          if (mixedAudioTrack) {
            const audioSender = peer.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (audioSender) audioSender.replaceTrack(mixedAudioTrack);
          }
        });

        const mixedStream = new MediaStream([mixedVideoTrack, mixedAudioTrack]);
        setLocalStream(mixedStream);
        setScreenSharing(true);

        screenVideoTrack.onended = () => { stopScreenShare(); };

        // Auto-PiP: Ekran paylaşımı başladığında diğer kişinin videosunu PiP yap
        setTimeout(async () => {
          try {
            const remoteVideos = document.querySelectorAll('.video-element[data-peer-id]');
            if (remoteVideos.length > 0 && document.pictureInPictureEnabled) {
              await remoteVideos[0].requestPictureInPicture();
            }
          } catch (pipErr) {
            console.warn("Auto-PiP ignored:", pipErr);
          }
        }, 1000);
      } catch (err) {
        console.error("Screen Share Mixing Error:", err);
        stopScreenShare();
      }
    } else {
      stopScreenShare();
    }
  }

  const stopScreenShare = async () => {
    // Cleanup Mixers
    if (mixingRefs.current.animationId) cancelAnimationFrame(mixingRefs.current.animationId);
    if (mixingRefs.current.audioCtx) mixingRefs.current.audioCtx.close();

    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const videoTrack = userStream.getVideoTracks()[0];
      const audioTrack = userStream.getAudioTracks()[0];

      Object.values(rtcService.peers).forEach(peer => {
        const videoSender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack);
        const audioSender = peer.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (audioSender && audioTrack) audioSender.replaceTrack(audioTrack);
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
      <MeetingHeader roomId={roomId} participantCount={Object.keys(remoteUsers).length + 1} />

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
