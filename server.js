// server.js (Projenin ana dizininde olmalı)
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Vite ile çalışırken CORS hatası almamak için ayarlar
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Statik dosyaları sun (public klasörü)
app.use(express.static('public'));

// --- OYUN DEĞİŞKENLERİ ---
let players = {};
let enemies = [];
let enemyIdCounter = 0;
let wave = 1;
const MAP_SIZE = 150;

// --- DÜŞMAN SINIFI (Sunucu Tarafı) ---
function spawnServerEnemy() {
    const halfSize = MAP_SIZE / 2 - 2;
    let spawnX, spawnZ;
    const side = Math.floor(Math.random() * 4);

    switch(side) {
        case 0: spawnX = (Math.random() - 0.5) * (MAP_SIZE - 10); spawnZ = -halfSize; break;
        case 1: spawnX = (Math.random() - 0.5) * (MAP_SIZE - 10); spawnZ = halfSize; break;
        case 2: spawnX = -halfSize; spawnZ = (Math.random() - 0.5) * (MAP_SIZE - 10); break;
        case 3: spawnX = halfSize; spawnZ = (Math.random() - 0.5) * (MAP_SIZE - 10); break;
    }

    let type = 'normal';
    const chance = Math.random();

    if (wave >= 2 && chance < 0.3) type = 'runner';
    if (wave >= 4 && chance > 0.85) type = 'tank';
    if (wave > 10 && chance > 0.7) type = 'tank';
    if (wave % 5 === 0 && Math.random() < 0.1) type = 'boss';

    const newEnemy = {
        id: enemyIdCounter++,
        x: spawnX,
        z: spawnZ,
        type: type,
        hp: type === 'tank' ? 120 : (type === 'runner' ? 10 : (type === 'boss' ? 240 : 20)),
        speed: type === 'runner' ? 7.0 : (type === 'tank' ? 2.5 : (type === 'boss' ? 3.5 : 4.0)),
    };

    enemies.push(newEnemy);
    io.emit('enemySpawn', newEnemy);
}

// --- SOCKET BAĞLANTILARI ---
io.on('connection', (socket) => {
    console.log('Oyuncu bağlandı:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: 0,
        z: 0,
        rotation: 0,
        hp: 100
    };

    // Yeni gelen oyuncuya mevcut durumu gönder
    socket.emit('init', { id: socket.id, players, enemies, wave });

    // Diğerlerine yeni oyuncuyu haber ver
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerInput', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].z = data.z;
            players[socket.id].rotation = data.rotation;
        }
    });

    socket.on('enemyHit', (data) => {
        const enemy = enemies.find(e => e.id === data.enemyId);
        if (enemy) {
            // Vuruş güvenliği (Server-side check) eklenebilir
            enemy.hp -= data.damage;
            if (enemy.hp <= 0) {
                io.emit('enemyDied', { enemyId: enemy.id, killerId: socket.id });
                enemies = enemies.filter(e => e.id !== enemy.id);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// --- OYUN DÖNGÜSÜ (60 FPS) ---
setInterval(() => {
    // Spawn Mantığı
    if (enemies.length < 5 * wave) {
        if (Math.random() < 0.02) spawnServerEnemy();
    }

    // Takip Mantığı
    enemies.forEach(enemy => {
        let closestPlayer = null;
        let minDist = Infinity;

        for (const id in players) {
            const p = players[id];
            const dx = p.x - enemy.x;
            const dz = p.z - enemy.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < minDist) {
                minDist = dist;
                closestPlayer = p;
            }
        }

        if (closestPlayer && minDist > 0.5) {
            const dx = closestPlayer.x - enemy.x;
            const dz = closestPlayer.z - enemy.z;

            // Normalize et ve hareket ettir
            enemy.x += (dx / minDist) * enemy.speed * 0.016;
            enemy.z += (dz / minDist) * enemy.speed * 0.016;
        }
    });

    io.emit('stateUpdate', { players, enemies });

}, 1000 / 60);

httpServer.listen(3000, '0.0.0.0', () => {
    console.log('Socket Sunucusu 3000 portunda çalışıyor');
});