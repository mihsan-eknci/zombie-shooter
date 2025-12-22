import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Yardımcı Fonksiyon: İki nokta arası mesafe
function getDistance(e, p) {
    return Math.sqrt((e.x - p.x) ** 2 + (e.z - p.z) ** 2);
}

const ZOMBIE_TYPES = {
    normal: { hp: 20, speed: 0.15, damage: 10, range: 1.5, scale: 1.0 },
    runner: { hp: 10, speed: 0.25, damage: 5, range: 1.3, scale: 0.8 },
    tank: { hp: 120, speed: 0.08, damage: 20, range: 2.0, scale: 1.6 },
    boss: { hp: 240, speed: 0.10, damage: 40, range: 3.0, scale: 2.5 }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'dist')));

// DURUM YÖNETİMİ
let players = {};
let enemies = {};
let pickups = {};
let enemyIdCounter = 0;
let pickupIdCounter = 0;

io.on('connection', (socket) => {
    console.log(`🟢 Bağlantı: ${socket.id}`);

    // --- 1. JOIN ---
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            room: data.mode,
            x: 0, y: 0, z: 0,
            rotation: 0,
            weapon: 'pistol',
            isDead: false // Oyuncunun ölü olup olmadığını takip etmeliyiz
        };

        socket.join(data.mode);
        console.log(`🎮 ${data.name} -> ${data.mode}`);

        const roomPlayers = {};
        Object.keys(players).forEach(id => {
            if (players[id].room === data.mode && id !== socket.id) {
                roomPlayers[id] = players[id];
            }
        });
        socket.emit('currentPlayers', roomPlayers);
        socket.to(data.mode).emit('newPlayer', players[socket.id]);
    });

    // --- 2. HAREKET ---
    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;
            player.z = movementData.z;
            player.rotation = movementData.rotation;
            socket.to(player.room).emit('playerMoved', player);
        }
    });

    // --- 3. AKSİYONLAR (Ateş, Silah) ---
    socket.on('playerShoot', (shootData) => {
        const player = players[socket.id];
        if (player) {
            socket.to(player.room).emit('remotePlayerShoot', { id: socket.id, ...shootData });
        }
    });

    socket.on('weaponSwitch', (weaponName) => {
        const player = players[socket.id];
        if (player) {
            player.weapon = weaponName;
            socket.to(player.room).emit('playerSwitchedWeapon', { id: socket.id, weapon: weaponName });
        }
    });

    // --- 4. PVP HASAR ---
    socket.on('playerHit', (data) => {
        const victim = players[data.targetId];
        const attacker = players[socket.id];
        if (victim && attacker && victim.room === attacker.room) {
            io.to(victim.room).emit('playerDamaged', {
                id: data.targetId,
                damage: data.damage,
                attackerId: attacker.id
            });
        }
    });

    // --- 5. OYUNCU ÖLÜMÜ ---
    socket.on('playerDied', () => {
        if (players[socket.id]) {
            players[socket.id].isDead = true; // Zombiler artık bu oyuncuyu kovalamaz
            console.log(`💀 Oyuncu öldü: ${socket.id}`);
        }
    });

    // --- 6. ZOMBİYE HASAR (DÜZELTİLEN KISIM) ---
    socket.on('damageEnemy', (data) => {
        const enemy = enemies[data.id];

        // Zombi var mı ve zaten ölü olarak işaretlenmiş mi?
        if (enemy && !enemy.isDead) {
            enemy.hp -= data.damage;

            if (enemy.hp <= 0) {
                // KRİTİK DÜZELTME: Zombiyi hemen "ölü" olarak işaretle
                enemy.isDead = true;

                // Listeden ve oyundan sil
                delete enemies[data.id];
                io.to('coop').emit('enemyDied', { id: data.id, killerId: socket.id });

                // LOOT DROP (Sadece bir kez çalışır çünkü enemy.isDead kontrolü var)
                if (Math.random() < 0.35) { // Şansı biraz artırdım test için
                    const pickupId = `pickup_${pickupIdCounter++}`;
                    const type = Math.random() < 0.6 ? 'ammo' : 'health';
                    pickups[pickupId] = {
                        id: pickupId,
                        x: enemy.x,
                        z: enemy.z,
                        type: type
                    };
                    io.to('coop').emit('pickupSpawn', pickups[pickupId]);
                }
            }
        }
    });

    // --- 7. EŞYA TOPLAMA ---
    socket.on('playerCollectPickup', (data) => {
        if (pickups[data.id]) {
            const type = pickups[data.id].type;
            delete pickups[data.id]; // Sunucudan sil

            // Toplayana ve herkese haber ver
            io.to('coop').emit('pickupCollected', {
                id: data.id,
                collectorId: socket.id,
                type: type
            });
        }
    });

    socket.on('disconnect', () => {
        const player = players[socket.id];
        if (player) {
            console.log(`🔴 Çıkış: ${player.name}`);
            socket.to(player.room).emit('playerDisconnected', socket.id);
            delete players[socket.id];
        }
    });
});

// --- SUNUCU OYUN DÖNGÜSÜ (AI GÜNCELLEMESİ) ---
setInterval(() => {
    // Sadece canlı ve coop odasındaki oyuncular
    const coopPlayers = Object.values(players).filter(p => p.room === 'coop' && !p.isDead);

    if (coopPlayers.length > 0) {
        // 1. SPAWN (Doğurma)
        if (Object.keys(enemies).length < 15 && Math.random() < 0.05) {
            const id = `zombie_${enemyIdCounter++}`;
            // Rastgele bir oyuncunun etrafında doğsun (tamamen rastgele harita yerine)
            const randomPlayer = coopPlayers[Math.floor(Math.random() * coopPlayers.length)];

            // Oyuncudan 20-30 birim uzakta doğsun
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 10;
            const x = randomPlayer.x + Math.cos(angle) * distance;
            const z = randomPlayer.z + Math.sin(angle) * distance;

            let type = 'normal';
            const r = Math.random();
            if (r > 0.7) type = 'runner';
            if (r > 0.9) type = 'tank';

            const stats = ZOMBIE_TYPES[type];
            enemies[id] = {
                id: id, x: x, y: 0, z: z,
                type: type, hp: stats.hp, maxHp: stats.hp,
                speed: stats.speed, damage: stats.damage, range: stats.range,
                lastAttackTime: 0,
                isDead: false // Loot kontrolü için
            };
            io.to('coop').emit('enemySpawn', enemies[id]);
        }

        // 2. AI UPDATE & AGGRO
        const currentTime = Date.now();
        const enemyList = Object.values(enemies);

        enemyList.forEach(enemy => {
            if (enemy.isDead) return;

            // En yakın oyuncuyu bul (Sadece canlı oyuncular)
            let nearestPlayer = null;
            let minDist = Infinity;

            for (const p of coopPlayers) {
                const d = getDistance(enemy, p);
                if (d < minDist) {
                    minDist = d;
                    nearestPlayer = p;
                }
            }

            if (nearestPlayer) {
                // Oyuncunun hitbox'ı (0.5) + Zombinin menzili
                // Saldırı menzili doğrulama
                const attackRange = enemy.range;

                if (minDist <= attackRange) {
                    // --- SALDIRI (Server-Side Validation) ---
                    if (currentTime - enemy.lastAttackTime > 1000) {
                        enemy.lastAttackTime = currentTime;

                        // İstemciye "Bu oyuncuya hasar ver" emri
                        io.to('coop').emit('playerDamaged', {
                            id: nearestPlayer.id,
                            damage: enemy.damage,
                            attackerId: enemy.id
                        });
                    }
                } else {
                    // --- HAREKET ---
                    // Basit bir "Seek" (Kovalama) davranışı
                    const dx = nearestPlayer.x - enemy.x;
                    const dz = nearestPlayer.z - enemy.z;

                    // Normalize et ve hızla çarp
                    if (minDist > 0) {
                        enemy.x += (dx / minDist) * enemy.speed;
                        enemy.z += (dz / minDist) * enemy.speed;
                        // Dönüş açısını hesapla (atan2)
                        enemy.rotation = Math.atan2(dx, dz);
                    }
                }
            }
        });

        io.to('coop').emit('enemyUpdate', enemies);
    }
}, 1000 / 15); // 15 FPS

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda çalışıyor!`);
});