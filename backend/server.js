const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const path = require('path');

const app = express();
app.use(cors());

// ----------------------------------------------------------------------
// Frontend Build Dosyalarını Sun (DEPLOYMENT İÇİN)
// ----------------------------------------------------------------------
// Üretim ortamında (Production) frontend dosyaları 'client/dist' klasöründedir.
// Express bu klasörü statik olarak dışarı açar, böylece ayrı bir frontend sunucusuna gerek kalmaz.
const buildPath = path.join(__dirname, '../client/dist');
app.use(express.static(buildPath));

// API rotaları buraya gelebilir...

// ----------------------------------------------------------------------
// SPA (Single Page Application) Yönlendirmesi
// ----------------------------------------------------------------------
// React Router kullanıldığında, kullanıcı direkt bir alt sayfaya (örn: /room/1) girerse
// sunucu bunu anlamaz. O yüzden API olmayan tüm istekleri index.html'e yönlendiriyoruz.
// React bu noktada devreye girip doğru sayfayı gösterir.
app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

const server = http.createServer(app);

// ----------------------------------------------------------------------
// Socket.io Kurulumu & CORS (Güvenlik) Ayarları
// ----------------------------------------------------------------------
const io = new Server(server, {
    cors: {
        // origin: "*", // Geliştirme aşamasında her yerden gelen isteği kabul et
        origin: "*", // Canlı ortamda güvenlik için buraya kendi domaininizi yazabilirsiniz (örn: "https://gorsem.onrender.com")
        methods: ["GET", "POST"]
    }
});

// rooms[roomId] = { host: socketId, users: { [socketId]: username } }
const rooms = {};

io.on('connection', (socket) => {
    console.log(`[Connect] Socket connected: ${socket.id}`);

    socket.on("join-room", ({ roomId, username }) => {
        // Eğer socket zaten bir odadaysa, önceki odadan temizle (Güvenlik önlemi)
        // (Normalde client disconnect olup yeni bağlanır ama emin olalım)
        for (const rId in rooms) {
            if (rooms[rId].users[socket.id]) {
                delete rooms[rId].users[socket.id];
                socket.to(rId).emit("user-disconnected", socket.id);
            }
        }

        if (!rooms[roomId]) {
            rooms[roomId] = {
                host: socket.id,
                users: {}
            };
            console.log(`[Room Created] Room: ${roomId}, Host: ${username} (${socket.id})`);
        }

        rooms[roomId].users[socket.id] = username;
        socket.join(roomId);

        console.log(`[Join] User: ${username} (${socket.id}) joined Room: ${roomId}`);
        console.log(`[Room Status] Room ${roomId} users:`, Object.values(rooms[roomId].users));

        socket.to(roomId).emit("user-connected", { socketId: socket.id, username });

        const otherUsers = Object.entries(rooms[roomId].users)
            .filter(([id, _]) => id !== socket.id)
            .map(([id, name]) => ({ socketId: id, username: name }));

        socket.emit("all-users", otherUsers);
    });

    // ----------------------------------------------------------------------
    // WebRTC Sinyalleşme (Signaling) Events
    // ----------------------------------------------------------------------
    // WebRTC cihazlarının birbirini bulması ve bağlantı kurması için
    // küçük veri paketlerini (SDP, Candidate) birbirlerine aktarmaları gerekir.
    // Sunucu burada sadece "Postacı" görevi görür. İçeriği okumaz, sadece iletir.

    // Arayan kişi (Caller) "Benim özelliklerim bunlar" der (Offer).
    socket.on("offer", (payload) => io.to(payload.target).emit("offer", payload));

    // Aranan kişi (Callee) "Tamam, kabul ettim, benim özelliklerim de bunlar" der (Answer).
    socket.on("answer", (payload) => io.to(payload.target).emit("answer", payload));

    // Bağlantı kurulurken "Hangi yoldan bağlanabilirim?" denemeleri (ICE Candidates).
    // ÖNEMLİ: Bu paketin içine "Gönderen Kim?" (caller) bilgisini eklemek zorundayız!
    socket.on("ice-candidate", (payload) => {
        const newPayload = { ...payload, caller: socket.id };
        io.to(payload.target).emit("ice-candidate", newPayload);
    });

    socket.on("send-message", (payload) => {
        let senderName = "Anonim";
        if (rooms[payload.roomId] && rooms[payload.roomId].users[socket.id]) {
            senderName = rooms[payload.roomId].users[socket.id];
        }
        io.to(payload.roomId).emit("receive-message", {
            message: payload.message,
            sender: senderName,
            timestamp: payload.timestamp
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Disconnect] Socket disconnected: ${socket.id}`);

        for (const roomId in rooms) {
            const room = rooms[roomId];

            if (room.users[socket.id]) {
                const username = room.users[socket.id];
                console.log(`[Left] User ${username} (${socket.id}) left room ${roomId}`);

                // 1. Kullanıcıyı listeden sil
                delete room.users[socket.id];

                // 2. Diğerlerine haber ver (Ghost user kalmasın diye hemen emit ediyoruz)
                socket.to(roomId).emit("user-disconnected", socket.id);

                // 3. Eğer ayrılan kişi HOST ise odayı kapat
                if (room.host === socket.id) {
                    console.log(`[Room Closed] Host left room ${roomId}. Auto-closing.`);
                    io.to(roomId).emit("room-closed");
                    delete rooms[roomId];
                    return; // Oda silindiği için döngüden çık
                }

                // 4. Oda boşaldıysa sil
                if (Object.keys(room.users).length === 0) {
                    console.log(`[Room Empty] Room ${roomId} deleted.`);
                    delete rooms[roomId];
                }
            }
        }
    });
});

// ----------------------------------------------------------------------
// Sunucuyu Başlatma
// ----------------------------------------------------------------------
// Bulut sunucular (Render, Heroku vb.) bize dinamik bir port atar.
// Bu yüzden process.env.PORT kullanmalıyız. Yoksa varsayılan 5000 olsun.
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
