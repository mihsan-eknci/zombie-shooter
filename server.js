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

// ✅ EKLENDİ: Engel boyutları (Çarpışma kontrolü için gerekli)
const OBSTACLE_RADII = {
    'box': 1.5,
    'barrel': 0.8,
    'wall': 2.5,
    'rock': 1.5,
    'pillar': 0.8
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

// ENGELLER
let obstacles = [];

// WAVE SİSTEMİ
let coopWave = {
    current: 1,
    zombiesToSpawn: 10,
    zombiesSpawned: 0,
    zombiesKilled: 0,
    spawnTimer: 0,
    spawnRate: 2.0
};

// ENGELLER OLUŞTUR
function generateObstacles() {
    const types = ['box', 'barrel', 'wall', 'rock', 'pillar'];
    const mapSize = 150;
    const halfSize = mapSize / 2 - 10;

    obstacles = [];

    for (let i = 0; i < 25; i++) {
        const x = (Math.random() - 0.5) * halfSize * 2;
        const z = (Math.random() - 0.5) * halfSize * 2;

        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

        const type = types[Math.floor(Math.random() * types.length)];
        const rotation = Math.random() * Math.PI * 2;

        obstacles.push({ x, z, type, rotation, id: `obs_${i}` });
    }

    console.log(`✅ ${obstacles.length} engel oluşturuldu (Sunucu)`);
}

// ✅ ÇARPIŞMA KONTROLÜ
function isColliding(x, z, radius) {
    // Harita sınırları
    if (x < -75 || x > 75 || z < -75 || z > 75) return true;

    for (const obs of obstacles) {
        // OBSTACLE_RADII burada kullanılıyor
        const obsRadius = OBSTACLE_RADII[obs.type] || 1.5;

        const dx = x - obs.x;
        const dz = z - obs.z;
        const distance = Math.sqrt(dx*dx + dz*dz);

        if (distance < (radius + obsRadius)) {
            return true;
        }
    }
    return false;
}

generateObstacles();

io.on('connection', (socket) => {
    console.log(`🟢 Bağlantı: ${socket.id}`);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            room: data.mode,
            x: 0, y: 0, z: 0,
            rotation: 0,
            weapon: 'pistol',
            isDead: false
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

        // ✅ Oyuncu girer girmez engelleri gönder
        socket.emit('obstaclesData', obstacles);

        if (data.mode === 'coop') {
            socket.emit('waveUpdate', {
                wave: coopWave.current,
                remaining: coopWave.zombiesToSpawn - coopWave.zombiesKilled
            });
        }
    });

    socket.on('requestWaveInfo', () => {
        const player = players[socket.id];
        if (player && player.room === 'coop') {
            socket.emit('waveUpdate', {
                wave: coopWave.current,
                remaining: coopWave.zombiesToSpawn - coopWave.zombiesKilled
            });
        }
    });

    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;
            player.z = movementData.z;
            player.rotation = movementData.rotation;
            player.aimX = movementData.aimX;
            player.aimZ = movementData.aimZ;

            socket.to(player.room).emit('playerMoved', player);
        }
    });

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

    socket.on('playerDied', () => {
        if (players[socket.id]) {
            players[socket.id].isDead = true;
            console.log(`💀 Oyuncu öldü: ${socket.id}`);
        }
    });

    socket.on('damageEnemy', (data) => {
        const enemy = enemies[data.id];

        if (enemy && !enemy.isDead) {
            enemy.hp -= data.damage;

            if (enemy.hp <= 0) {
                enemy.isDead = true;
                delete enemies[data.id];

                coopWave.zombiesKilled++;
                io.to('coop').emit('enemyDied', { id: data.id, killerId: socket.id });
                io.to('coop').emit('waveUpdate', {
                    wave: coopWave.current,
                    remaining: coopWave.zombiesToSpawn - coopWave.zombiesKilled
                });

                if (coopWave.zombiesKilled >= coopWave.zombiesToSpawn) {
                    startNextWave();
                }

                if (Math.random() < 0.35) {
                    const pickupId = `pickup_${pickupIdCounter++}`;
                    const type = Math.random() < 0.6 ? 'ammo' : 'health';
                    pickups[pickupId] = {
                        id: pickupId, x: enemy.x, z: enemy.z, type: type
                    };
                    io.to('coop').emit('pickupSpawn', pickups[pickupId]);
                }
            }
        }
    });

    socket.on('playerCollectPickup', (data) => {
        if (pickups[data.id]) {
            const type = pickups[data.id].type;
            delete pickups[data.id];
            io.to('coop').emit('pickupCollected', {
                id: data.id, collectorId: socket.id, type: type
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

function startNextWave() {
    coopWave.current++;
    coopWave.zombiesToSpawn += 5;
    coopWave.zombiesSpawned = 0;
    coopWave.zombiesKilled = 0;
    coopWave.spawnRate = Math.max(0.3, 2.0 - (coopWave.current * 0.15));

    console.log(`🎉 COOP Dalga ${coopWave.current} Başlıyor!`);

    io.to('coop').emit('waveComplete', { nextWave: coopWave.current });
    io.to('coop').emit('waveUpdate', {
        wave: coopWave.current,
        remaining: coopWave.zombiesToSpawn
    });
}

// --- SUNUCU OYUN DÖNGÜSÜ ---
setInterval(() => {
    const coopPlayers = Object.values(players).filter(p => p.room === 'coop' && !p.isDead);

    if (coopPlayers.length > 0) {
        if (coopWave.zombiesSpawned < coopWave.zombiesToSpawn) {
            coopWave.spawnTimer += 1/15;

            if (coopWave.spawnTimer >= coopWave.spawnRate) {
                coopWave.spawnTimer = 0;

                const id = `zombie_${enemyIdCounter++}`;
                const randomPlayer = coopPlayers[Math.floor(Math.random() * coopPlayers.length)];

                const angle = Math.random() * Math.PI * 2;
                const distance = 20 + Math.random() * 10;
                const x = randomPlayer.x + Math.cos(angle) * distance;
                const z = randomPlayer.z + Math.sin(angle) * distance;

                let type = 'normal';
                const r = Math.random();
                if (coopWave.current >= 2 && r > 0.7) type = 'runner';
                if (coopWave.current >= 4 && r > 0.9) type = 'tank';
                if (coopWave.current % 5 === 0 && coopWave.zombiesSpawned === 0) type = 'boss';

                const stats = ZOMBIE_TYPES[type];
                enemies[id] = {
                    id: id, x: x, y: 0, z: z,
                    type: type, hp: stats.hp, maxHp: stats.hp,
                    speed: stats.speed, damage: stats.damage, range: stats.range,
                    lastAttackTime: 0,
                    isDead: false
                };

                io.to('coop').emit('enemySpawn', enemies[id]);
                coopWave.zombiesSpawned++;

                io.to('coop').emit('waveUpdate', {
                    wave: coopWave.current,
                    remaining: coopWave.zombiesToSpawn - coopWave.zombiesKilled
                });
            }
        }

        // 2. AI UPDATE & AGGRO (HAREKET MANTIĞI)
        const currentTime = Date.now();
        const enemyList = Object.values(enemies);

        enemyList.forEach(enemy => {
            if (enemy.isDead) return;

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
                const attackRange = enemy.range;

                if (minDist <= attackRange) {
                    // Saldırı
                    if (currentTime - enemy.lastAttackTime > 1000) {
                        enemy.lastAttackTime = currentTime;
                        io.to('coop').emit('playerDamaged', {
                            id: nearestPlayer.id,
                            damage: enemy.damage,
                            attackerId: enemy.id
                        });
                    }
                } else {
                    // ✅ DÜZELTİLEN KISIM: ENGEL KONTROLLÜ HAREKET
                    const dx = nearestPlayer.x - enemy.x;
                    const dz = nearestPlayer.z - enemy.z;

                    if (minDist > 0.1) {
                        const dirX = dx / minDist;
                        const dirZ = dz / minDist;
                        const speed = enemy.speed;

                        // X ekseninde ilerle (Çarpışma yoksa)
                        if (!isColliding(enemy.x + dirX * speed, enemy.z, 0.8)) {
                            enemy.x += dirX * speed;
                        }

                        // Z ekseninde ilerle (Çarpışma yoksa)
                        if (!isColliding(enemy.x, enemy.z + dirZ * speed, 0.8)) {
                            enemy.z += dirZ * speed;
                        }

                        enemy.rotation = Math.atan2(dx, dz);
                    }
                }
            }
        });

        io.to('coop').emit('enemyUpdate', enemies);
    }
}, 1000 / 15);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda çalışıyor!`);
});