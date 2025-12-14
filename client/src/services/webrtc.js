class WebRTCService {
    peers = {}; // socketId -> RTCPeerConnection
    candidatesQueue = {}; // socketId -> [RTCIceCandidate]

    localStream = null;

    // Callbacks assigned by App.jsx
    onIceCandidate = null;
    onTrack = null;

    // ----------------------------------------------------------------------
    // STUN & TURN Sunucu Ayarları (NAT Traversal)
    // ----------------------------------------------------------------------
    // WebRTC cihazlarının internet üzerinden birbirini bulması için "buz kırıcı" (ICE) sunuculara ihtiyaç duyar.
    // STUN: "Benim dış IP adresim ne?" sorusunu cevaplar. (Google sunucuları ücretsiz ve hızlıdır)
    // TURN: Eğer güvenlik duvarı (Firewall) çok sıkıysa, veriyi bu sunucu üzerinden geçirir. (OpenRelay ücretsiz kullanıyoruz)
    config = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
            }
        ]
    };

    // Kullanıcının Kamera ve Mikrofonuna erişim isteği
    initializeLocalStream = async (video = true, audio = true) => {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video, audio });
            console.log("Local stream initialized");
            return this.localStream;
        } catch (error) {
            console.error("Error accessing media devices:", error);
            throw error;
        }
    };

    createPeerConnection = (socketId) => {
        if (this.peers[socketId]) {
            return this.peers[socketId];
        }

        console.log(`Creating new peer connection for ${socketId}`);
        const peer = new RTCPeerConnection(this.config);

        // ICE Candidate: Bağlantı yolu adayları bulunduğunda tetiklenir.
        // Bunu socket üzerinden karşı tarafa yollamalıyız.
        peer.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidate) {
                this.onIceCandidate(socketId, event.candidate);
            }
        };

        // Karşı taraftan görüntü/ses geldiğinde tetiklenir (TRACK).
        peer.ontrack = (event) => {
            console.log(`Track received from ${socketId}:`, event.track.kind);

            // React'in değişikliği algılaması için her zaman yeni bir MediaStream nesnesi oluşturuyoruz.
            // event.streams[0] kullansak bile referans aynı kalabildiği için useEffect tetiklenmeyebilir.
            const newStream = new MediaStream(event.streams[0] ? event.streams[0].getTracks() : [event.track]);

            // Eğer track stream'e sonradan eklenirse, yine de yeni bir nesne yollamalıyız.
            // Ancak ontrack event'i her track için tetiklenir.

            if (this.onTrack) {
                this.onTrack(socketId, newStream);
            }
        };

        peer.onconnectionstatechange = () => {
            console.log(`Connection state with ${socketId}: ${peer.connectionState}`);
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peer.addTrack(track, this.localStream);
            });
        }

        this.peers[socketId] = peer;
        return peer;
    };

    // Kuyruktaki candidate'leri işle
    processCandidatesQueue = async (socketId) => {
        const peer = this.peers[socketId];
        const queue = this.candidatesQueue[socketId];

        if (peer && queue && queue.length > 0) {
            console.log(`Processing ${queue.length} queued candidates for ${socketId}`);
            for (const candidate of queue) {
                try {
                    await peer.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding queued ice candidate", e);
                }
            }
            delete this.candidatesQueue[socketId];
        }
    };

    createOffer = async (socketId) => {
        try {
            const peer = this.createPeerConnection(socketId);
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            return offer;
        } catch (e) {
            console.error("Error creating offer:", e);
        }
    };

    createAnswer = async (socketId, offer) => {
        try {
            const peer = this.createPeerConnection(socketId);
            await peer.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            // Remote description set edildiği için kuyruğu işle
            await this.processCandidatesQueue(socketId);

            return answer;
        } catch (e) {
            console.error("Error creating answer:", e);
        }
    };

    addAnswer = async (socketId, answer) => {
        try {
            const peer = this.peers[socketId];
            if (!peer) return;

            if (!peer.currentRemoteDescription) {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
                // Remote description set edildiği için kuyruğu işle
                await this.processCandidatesQueue(socketId);
            }
        } catch (e) {
            console.error("Error adding answer:", e);
        }
    };

    addIceCandidate = async (socketId, candidate) => {
        try {
            const peer = this.peers[socketId];
            const iceCandidate = new RTCIceCandidate(candidate);

            // Peer yoksa veya remote description henüz set edilmediyse kuyruğa ekle.
            // Bu "Trickle ICE" mantığı için kritiktir. Bazen candidate'ler, Offer/Answer'dan önce gelir.
            // Onları kaybetmemek için bir kuyrukta (queue) bekletiriz.
            if (!peer || !peer.remoteDescription) {
                console.warn(`Queueing ICE candidate for ${socketId} (Remote desc not ready)`);
                if (!this.candidatesQueue[socketId]) {
                    this.candidatesQueue[socketId] = [];
                }
                this.candidatesQueue[socketId].push(iceCandidate);
                return;
            }

            await peer.addIceCandidate(iceCandidate);
        } catch (e) {
            console.error("Error adding ice candidate", e);
        }
    };

    closePeer = (socketId) => {
        if (this.peers[socketId]) {
            this.peers[socketId].close();
            delete this.peers[socketId];
        }
        if (this.candidatesQueue[socketId]) {
            delete this.candidatesQueue[socketId];
        }
    }
}

export default new WebRTCService();
