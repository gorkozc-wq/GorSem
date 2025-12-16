import React, { useState, useEffect, useRef } from 'react';
import socketService from './services/socket';
import rtcService from './services/webrtc';
import VideoRoom from './components/VideoRoom';
import Controls from './components/Controls';
import Chat from './components/Chat';

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
function App() {
  const [step, setStep] = useState('lobby');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [localStream, setLocalStream] = useState(null);

  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteUsers, setRemoteUsers] = useState({});

  // Chat State
  const [messages, setMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const [logs, setLogs] = useState([]);
  // Log fonksiyonunu production'da kapatabiliriz ama debug için kalsın
  const addLog = (msg) => {
    // console.log(`[APP LOG] ${msg}`); // Console kirliliğini azaltalım
  };

  useEffect(() => {
    if (!socketService.socket) {
      socketService.connect();
    }

    socketService.socket.removeAllListeners();

    socketService.socket.on("connect", () => addLog("Socket connected"));

    // Bağlantı koparsa remote userları resetle ki ghost user kalmasın
    socketService.socket.on("disconnect", () => {
      addLog("Socket disconnected");
      setRemoteStreams({});
      setRemoteUsers({});
    });

    socketService.socket.on("user-connected", async ({ socketId, username }) => {
      addLog(`User connected: ${username}`);
      setRemoteUsers(prev => ({ ...prev, [socketId]: username }));

      try {
        const offer = await rtcService.createOffer(socketId);
        socketService.sendOffer({
          target: socketId,
          caller: socketService.socket.id,
          sdp: offer
        });
      } catch (err) { console.error(err); }
    });

    socketService.socket.on("all-users", (users) => {
      // Sunucudan güncel liste geldiğinde state'i tamamen yenile
      const usersMap = {};
      users.forEach(u => {
        usersMap[u.socketId] = u.username;
      });
      setRemoteUsers(usersMap); // Spread yerine direkt atama yaptık ki eskiler silinsin
    });

    socketService.socket.on("offer", async (payload) => {
      try {
        const answer = await rtcService.createAnswer(payload.caller, payload.sdp);
        socketService.sendAnswer({ target: payload.caller, caller: socketService.socket.id, sdp: answer });
      } catch (err) { console.error(err); }
    });

    socketService.socket.on("answer", async (payload) => {
      try { await rtcService.addAnswer(payload.caller, payload.sdp); }
      catch (err) { console.error(err); }
    });

    socketService.socket.on("ice-candidate", async (payload) => {
      try { await rtcService.addIceCandidate(payload.caller, payload.candidate); }
      catch (err) { console.error(err); }
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
      alert("Oda sahibi ayrıldı, oda kapatılıyor.");
      window.location.reload();
    });

    socketService.socket.on("receive-message", (data) => {
      setMessages(prev => [...prev, { ...data, isMe: data.sender === socketService.socket.id || data.sender === username }]);

      // Chat kapalıysa bildirim sayısını artır
      if (!isChatOpen) { // Not: State closure sorunu olabilir, ref kullanmak daha güvenli olabilir ama basit tutalım.
        setUnreadCount(prev => prev + 1);
      }
    });

    // Chat açıldığında unread'i sıfırlamak için useEffect
    // (Aşağıda isChatOpen değişince sıfırlayacağız)

    rtcService.onTrack = (socketId, stream) => {
      setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
    };

    rtcService.onIceCandidate = (targetId, candidate) => {
      socketService.sendIceCandidate({ target: targetId, candidate: candidate });
    };

    return () => {
      if (socketService.socket) {
        socketService.socket.removeAllListeners();
      }
    }
  }, []); // Mount only

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);


  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomId || !username) return;

    try {
      const stream = await rtcService.initializeLocalStream();
      setLocalStream(stream);
      addLog("Local stream acquired");
    } catch (err) {
      addLog(`Media access failed/denied: ${err.message}. Joining as viewer.`);
      // alert("Kamera/Mikrofon erişimi sağlanamadı!");
    }

    // Her durumda odaya katıl
    socketService.joinRoom(roomId, username);
    setStep('room');
  };

  const handleSendMessage = (msg) => {
    socketService.sendMessage(roomId, msg, username);
  };

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

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleScreenShareLogic = async () => {
    if (!screenSharing) {
      try {
        // Sistem sesini de almak için audio: true ekledik
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        Object.values(rtcService.peers).forEach(peer => {
          // Video track değiştir
          const videoSender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) videoSender.replaceTrack(screenVideoTrack, videoSender);

          // Varsa Audio track değiştir (Sistem sesi)
          if (screenAudioTrack) {
            const audioSender = peer.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (audioSender) audioSender.replaceTrack(screenAudioTrack, audioSender);
          }
        });

        setLocalStream(screenStream);

        // Ekran paylaşımı durduğunda (tarayıcı UI'ından)
        screenVideoTrack.onended = () => { stopScreenShare(); };

        setScreenSharing(true);
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
    } catch (err) { console.error("Error stopping screen share:", err); }
  };

  const leaveRoom = () => {
    window.location.reload();
  };

  if (step === 'lobby') {
    return (
      <div className="lobby-container">
        <div className="card lobby-card">
          <h1 className="lobby-title">GörSem</h1>
          <form onSubmit={handleJoinRoom} className="lobby-form">
            <input
              placeholder="Adınız"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
            <input
              placeholder="Oda ID (örn: oda-1)"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary">Odaya Katıl</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <div className="content-area">
        <VideoRoom
          localStream={localStream}
          remoteStreams={remoteStreams}
          remoteUsers={remoteUsers}
          currentUser={username}
        />

        <div className="controls-container">
          <div className="controls-content">

            <button onClick={toggleAudio} className={`btn-icon ${!audioEnabled ? 'danger' : ''}`}>
              {audioEnabled ? '🎤' : (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🎤
                  <span style={{ position: 'absolute', width: '100%', height: '2px', background: 'red', transform: 'rotate(45deg)' }}></span>
                </div>
              )}
            </button>
            <button onClick={toggleVideo} className={`btn-icon ${!videoEnabled ? 'danger' : ''}`}>
              {videoEnabled ? '📷' : (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  📷
                  <span style={{ position: 'absolute', width: '100%', height: '2px', background: 'red', transform: 'rotate(45deg)' }}></span>
                </div>
              )}
            </button>
            <button onClick={handleScreenShareLogic} className={`btn-icon ${screenSharing ? 'active' : ''}`} style={{ background: screenSharing ? 'var(--success)' : '' }}>
              💻
            </button>

            {/* CHAT BUTONU - YENİ */}
            <button onClick={toggleChat} className="btn-icon" style={{ position: 'relative' }}>
              💬
              {unreadCount > 0 && !isChatOpen && (
                <span className="notification-badge">
                  {unreadCount}
                </span>
              )}
            </button>

            <button onClick={leaveRoom} className="btn-icon danger" style={{ backgroundColor: 'red', color: 'white' }}>
              📞
            </button>
          </div >
        </div >
      </div >

      {/* Chat Drawer */}
      {
        isChatOpen && (
          <div className="chat-sidebar">
            <div className="chat-header">
              <h3 style={{ margin: 0 }}>Sohbet</h3>
              <button onClick={toggleChat} className="close-chat-btn">✖</button>
            </div>
            <Chat messages={messages} sendMessage={handleSendMessage} />
          </div>
        )
      }
    </div >
  );
}

export default App;
