import io from "socket.io-client";

// ----------------------------------------------------------------------
// Socket URL Belirleme
// ----------------------------------------------------------------------
// Geliştirme ortamında (Dev) frontend 5173, backend 5000 portunda çalışır.
// Bu yüzden manuel olarak localhost:5000'e bağlanırız.
// Canlı ortamda (Production) frontend ve backend aynı sunucudadır, bu yüzden "/" (relative path) yeterlidir.
const SOCKET_URL = import.meta.env.DEV
    ? (window.location.hostname === 'localhost' ? "http://localhost:5000" : `http://${window.location.hostname}:5000`)
    : "/";

class SocketService {
    socket = null;

    connect() {
        this.socket = io(SOCKET_URL);

        this.socket.on("connect", () => {
            console.log("Socket connected:", this.socket.id);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // Event listeners
    joinRoom(roomId, username) {
        if (!this.socket) return;
        this.socket.emit("join-room", { roomId, username });
    }

    sendMessage(roomId, message, sender) {
        if (!this.socket) return;
        this.socket.emit("send-message", { roomId, message, sender });
    }

    // WebRTC Signaling
    sendOffer(payload) {
        this.socket.emit("offer", payload);
    }

    sendAnswer(payload) {
        this.socket.emit("answer", payload);
    }

    sendIceCandidate(payload) {
        this.socket.emit("ice-candidate", payload);
    }
}

export default new SocketService(); // Singleton: Uygulama boyunca tek bir socket yönetimi olsun
