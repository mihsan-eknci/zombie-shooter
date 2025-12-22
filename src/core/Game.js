// src/coree/Game.js
import * as THREE from 'three';
import { Player } from '../entities/Player.js';
import { World } from './World.js';
import { InputManager } from './InputManager.js';
import { Bullet } from '../entities/Bullet.js';
import { DamagePopup } from '../entities/DamagePopup.js'; // EKLENDİ
import { UIManager } from '../managers/UIManager.js';
import { WaveManager } from '../managers/WaveManager.js';
import { SoundManager } from '../managers/SoundManager.js';
import { Pickup } from '../entities/Pickup.js';
import { MinimapManager } from '../managers/MinimapManager.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Enemy } from '../entities/Enemy.js'; // <-- BU SATIRI EKLE

export class Game {
    constructor(socket) {
        this.socket = socket; // <-- Sınıf içinde kullanmak için kaydet
        this.config = {
            viewSize: 15,
            cameraOffset: 25,
            mapSize: 150,
            wallHeight: 5
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        this.raycaster = new THREE.Raycaster();
        this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.currentAimPoint = new THREE.Vector3();

        this.inputManager = new InputManager();
        this.soundManager = new SoundManager();

        this.world = null;
        this.player = null;
        this.uiManager = null;
        this.waveManager = null;
        this.minimapManager = null;

        this.bullets = [];
        this.enemies = [];
        this.damagePopups = []; // EKLENDİ: Hasar yazılarını tutacak dizi
        this.isPaused = false;
        this.score = 0; // Skor takibi
        this.pickups = []; // Loot kutularını tutacak dizi
        this.remotePlayers = {}; // Diğer oyuncuları ID'si ile tutacağımız obje

        // Bağlantı testi (Konsola bak)
        if (this.socket) {
            console.log("🔌 Multiplayer Modu Aktif - Sunucuya bağlanılıyor...");

            // 1. Bağlanınca ID yaz
            this.socket.on('connect', () => {
                console.log(`✅ Bağlandı! ID: ${this.socket.id}`);
            });

            // 2. Oyuna girdiğimde zaten içeride olan oyuncuları al
            this.socket.on('currentPlayers', (players) => {
                Object.keys(players).forEach((id) => {
                    if (id !== this.socket.id) {
                        this.addRemotePlayer(players[id]);
                    }
                });
            });

            // 3. Yeni bir oyuncu bağlandığında
            this.socket.on('newPlayer', (playerInfo) => {
                this.addRemotePlayer(playerInfo);
                console.log("Yeni oyuncu katıldı:", playerInfo.id);
            });

            // 4. Bir oyuncu hareket ettiğinde
            this.socket.on('playerMoved', (playerInfo) => {
                if (this.remotePlayers[playerInfo.id]) {
                    this.remotePlayers[playerInfo.id].updatePosition(playerInfo);
                }
            });

            // 5. Bir oyuncu çıktığında
            this.socket.on('playerDisconnected', (id) => {
                if (this.remotePlayers[id]) {
                    this.remotePlayers[id].delete();
                    delete this.remotePlayers[id];
                    console.log("Oyuncu ayrıldı:", id);
                }
            });

            // 6. Başka bir oyuncu ateş ettiğinde
            this.socket.on('remotePlayerShoot', (data) => {
                // Gelen veriyi Three.js Vektörlerine çevir
                const spawnPos = new THREE.Vector3(data.x, data.y, data.z);
                const direction = new THREE.Vector3(data.dirX, data.dirY, data.dirZ);

                // Mermiyi oluştur (RemotePlayer'ın silah özellikleriyle)
                // data.weaponData içinde hız, renk, boyut gibi bilgiler var
                const bullet = new Bullet(this.scene, spawnPos, direction, data.weaponData);

                // Mermiyi listeye ekle ki update döngüsünde hareket etsin
                this.bullets.push(bullet);

                // Ses ve Işık efekti
                this.soundManager.playShootSound(data.weaponName || 'pistol');

                const flash = new THREE.PointLight(0xffff00, 2, 10);
                flash.position.copy(spawnPos);
                this.scene.add(flash);
                setTimeout(() => this.scene.remove(flash), 50);
            });

            // 7. Biri hasar aldığında
            this.socket.on('playerDamaged', (data) => {
                // 1. EĞER HASAR ALAN BEN İSEM
                if (data.id === this.socket.id) {
                    this.player.takeDamage(data.damage);
                    this.soundManager.playPlayerHurt();
                    this.uiManager.updateHealth();

                    // GÖRSEL EFEKT (KANLI EKRAN)
                    const overlay = document.getElementById('damage-overlay');
                    if (overlay) {
                        overlay.style.opacity = "1";
                        setTimeout(() => overlay.style.opacity = "0", 300);
                    } else {
                        // Eğer HTML'de div yoksa geçici çözüm
                        document.body.style.backgroundColor = "rgba(255, 0, 0, 0.4)";
                        setTimeout(() => document.body.style.backgroundColor = "#ad8a6c", 100); // Arka plan rengine geri dön
                    }

                    console.log(`💔 Vuruldum! Kalan Can: ${this.player.health}`);

                    if (this.player.health <= 0 && !this.player.isDead) {
                        this.player.isDead = true;
                        this.socket.emit('playerDied'); // Sunucuya öldüğümü bildir
                        this.uiManager.showGameOver("ÖLDÜNÜZ");
                    }
                }
                // 2. EĞER BAŞKASI HASAR ALDIYSA (Co-op Arkadaşım)
                else if (this.remotePlayers[data.id]) {
                    // Arkadaşının karakterinde kırmızı yanıp sönme efekti (Opsiyonel)
                    // this.remotePlayers[data.id].flashRed(); 
                }
            });

            // 8. ZOMBİ POZİSYON GÜNCELLEMESİ (CO-OP)
            this.socket.on('enemyUpdate', (serverEnemies) => {
                // Sunucudan gelen listedeki her zombi için:
                Object.values(serverEnemies).forEach(sEnemy => {
                    // Bu zombi bizde var mı?
                    let localEnemy = this.enemies.find(e => e.id === sEnemy.id);

                    if (localEnemy) {
                        // Varsa konumunu güncelle (Interpolation yapılabilir ama şimdilik direkt atıyoruz)
                        localEnemy.mesh.position.set(sEnemy.x, sEnemy.y, sEnemy.z);
                        localEnemy.mesh.lookAt(sEnemy.x + Math.sin(sEnemy.rotation), sEnemy.y, sEnemy.z + Math.cos(sEnemy.rotation));
                    } else {
                        // Yoksa yarat (Enemy sınıfını biraz modifiye etmemiz gerekecek veya id ekleyeceğiz)
                        // Şimdilik basitçe yaratıyoruz, detaylı Enemy düzenlemesi bir sonraki adımda.
                        // Geçici çözüm:
                        // this.spawnRemoteZombie(sEnemy); (Bunu birazdan yazacağız)
                    }
                });
            });

            // 9. ZOMBİ DOĞMA (SPAWN)
            this.socket.on('enemySpawn', (sEnemy) => {
                this.spawnRemoteZombie(sEnemy);
            });

            // 10. ZOMBİ ÖLÜMÜ (CO-OP)
            this.socket.on('enemyDied', (data) => {
                // data = { id, killerId }

                const enemy = this.enemies.find(e => e.id === data.id);
                if (enemy) {
                    // Ses ve efektler
                    this.soundManager.playZombieDeath();

                    // Zombiyi yok et
                    enemy.kill();

                    // Eğer ben öldürdüysem skoru artır
                    if (data.killerId === this.socket.id) {
                        this.score += 10;
                    }
                }
            });

            // 11. EŞYA OLUŞTURMA (SPAWN)
            this.socket.on('pickupSpawn', (data) => {
                // Pickup sınıfını kullanarak sahneye ekle
                // (Pickup.js'de id özelliği olmadığı için sonradan ekliyoruz)
                const p = new Pickup(this.scene, new THREE.Vector3(data.x, 0, data.z), data.type);
                p.id = data.id;
                this.pickups.push(p);
            });

            // 12. EŞYA TOPLANDI BİLGİSİ
            this.socket.on('pickupCollected', (data) => {
                // data = { id, collectorId, type }

                // 1. Eşyayı sahneden sil (Eğer hala duruyorsa)
                const index = this.pickups.findIndex(p => p.id === data.id);
                if (index !== -1) {
                    this.pickups[index].isAlive = false; // update döngüsünde silinecek
                    this.pickups[index].mesh.visible = false; // Hemen gizle
                }

                // 2. Eğer toplayan BENSEM ödülü ver
                if (data.collectorId === this.socket.id) {
                    this.soundManager.playPickupSound(data.type);

                    if (data.type === 'health') {
                        this.player.heal(20); // Can doldurma fonksiyonun varsa
                        // Yoksa: this.player.health += 20;
                    }
                    else if (data.type === 'ammo') {
                        // Mermi doldurma fonksiyonun varsa
                        const weapon = this.player.getWeapon(); // Şu anki silah
                        weapon.reserve += 30; // veya this.player.addAmmo(30);
                    }

                    this.uiManager.update();
                    this.uiManager.updateHealth();
                    this.uiManager.updateAmmo();
                }
            });
        }

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xad8a6c);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            -this.config.viewSize * aspect, this.config.viewSize * aspect,
            this.config.viewSize, -this.config.viewSize,
            -2000, 10000
        );
        this.camera.position.set(this.config.cameraOffset, this.config.cameraOffset, this.config.cameraOffset);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        this.world = new World(this.scene, this.config);
        this.player = new Player(this.scene);
        this.uiManager = new UIManager(this.player);

        this.waveManager = new WaveManager(
            this.scene,
            this.player,
            this.config.mapSize,
            this.uiManager,
            this.soundManager
        );
        this.waveManager.setEnemiesArray(this.enemies);
        this.minimapManager = new MinimapManager(this);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    // menü ekranı için eklendi
    start(mode, playerName) {
        this.mode = mode; // 'single', 'coop', 'pvp'
        this.playerName = playerName;
        this.isPaused = false;

        console.log(`🚀 Mod Yüklendi: ${mode}`);

        // --- MOD AYARLARI ---
        if (mode === 'single') {
            // Tek kişilik: Sunucuya bağlanmaya gerek yok (veya sadece skor için)
            // Zombiler senin bilgisayarında çalışsın
            this.waveManager.enable = true;
        }
        else if (mode === 'coop') {
            // Co-op: Sunucuya haber ver
            this.socket.emit('joinGame', { mode: 'coop', name: playerName });
            this.waveManager.enable = false; // Yerel zombi üretimini KAPAT
            this.enemies.forEach(e => e.kill()); // Varsa eskileri temizle
            this.enemies = [];
        }
        else if (mode === 'pvp') {
            // PvP: Sunucuya haber ver
            this.socket.emit('joinGame', { mode: 'pvp', name: playerName });
            // Zombileri KAPAT (Sadece oyuncular savaşsın)
            this.waveManager.enable = false;
            // Mevcut zombileri sil
            this.enemies.forEach(e => e.kill());
            this.enemies = [];
        }

        // Oyuncuya ismini ata (İleride kafa üstünde göstermek için)
        this.player.name = playerName;

        // Döngüyü Başlat!
        this.animate();
    }

    update(dt) {
        if (this.isPaused) return;

        const inputs = this.inputManager.keys;
        this.player.update(dt, inputs);

        // --- MULTİPLAYER: POZİSYON GÜNCELLEMESİ (BURAYI EKLEYİN) ---
        if (this.socket && (this.mode === 'coop' || this.mode === 'pvp')) {
            const pPos = this.player.getPosition();

            // Her frame göndermek yerine throttle yapabiliriz (opsiyonel)
            if (!this.lastPositionUpdate || Date.now() - this.lastPositionUpdate > 50) {
                this.socket.emit('playerMovement', {
                    x: pPos.x,
                    y: pPos.y,
                    z: pPos.z,
                    rotation: this.player.mesh.rotation.y
                });
                this.lastPositionUpdate = Date.now();
            }
        }
        // --------------------------------------------------------

        // --- RELOAD (Manuel) ---
        if ((inputs['r'] || inputs['R']) && !this.player.isReloading) {
            const weapon = this.player.getWeapon();
            if (this.player.ammo < weapon.clipSize) {
                this.player.reload();
                this.soundManager.playReloadSound();
                this.uiManager.updateAmmo();
            }
        }

        // Raycaster (Nişan Alma)
        this.raycaster.setFromCamera(this.inputManager.mouse, this.camera);
        const intersection = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.aimPlane, intersection)) {
            this.player.lookAt(intersection);
            this.currentAimPoint.copy(intersection);
        }

        // --- ATEŞ ETME & OTO RELOAD ---
        if (this.inputManager.isMouseDown && this.player.canShoot()) {
            if (this.player.ammo > 0) {
                this.fireBullet();
            } else {
                this.player.reload();
                this.soundManager.playReloadSound();
                this.uiManager.updateAmmo();
            }
        }

        // Mermiler Update
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(dt);
            if (!b.isAlive) this.bullets.splice(i, 1);
        }

        // --- ZOMBİLER UPDATE ---
        if (this.waveManager.enable) {
            this.waveManager.update(dt);
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt, this.player.getPosition());
        }

        // --- ÇARPIŞMA KONTROLÜ ---
        this.checkCollisions();

        // Hasar Pop-up Update
        for (let i = this.damagePopups.length - 1; i >= 0; i--) {
            const popup = this.damagePopups[i];
            popup.update(dt);
            if (!popup.isAlive) this.damagePopups.splice(i, 1);
        }

        // Pickup (Loot) Güncelleme
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];

            p.update(dt, this.player, (type) => {
                if (this.mode === 'single') {
                    this.soundManager.playPickupSound(type);
                    this.uiManager.update();
                }
                else {
                    if (this.socket) {
                        this.socket.emit('playerCollectPickup', { id: p.id });
                    }
                }
            });

            if (!p.isAlive) this.pickups.splice(i, 1);
        }

        // Kamera Takibi
        const pPos = this.player.getPosition();
        this.camera.position.x = pPos.x + this.config.cameraOffset;
        this.camera.position.z = pPos.z + this.config.cameraOffset;

        // Minimap ve UI
        if (this.minimapManager) this.minimapManager.update();
        this.uiManager.update();
        this.uiManager.updateScore(this.score);
    }


    fireBullet() {
        if (this.player.shoot()) { // Mermiyi düşür
            this.soundManager.playShootSound(this.player.currentWeapon);

            const playerPos = this.player.getPosition();
            const spawnPos = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
            const direction = new THREE.Vector3()
                .subVectors(this.currentAimPoint, spawnPos)
                .normalize();
            direction.y = 0;

            const weapon = this.player.getWeapon();
            const bulletCount = weapon.bulletCount || 1;

            for (let i = 0; i < bulletCount; i++) {
                const spreadAngle = weapon.bulletSpread || 0;
                const randomSpread = (Math.random() - 0.5) * spreadAngle;

                const bulletDir = direction.clone();
                bulletDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomSpread);

                const bullet = new Bullet(this.scene, spawnPos, bulletDir, {
                    damage: weapon.damage,
                    speed: weapon.bulletSpeed,
                    color: weapon.bulletColor,
                    size: weapon.bulletSize,
                    lifeTime: 2.0
                });
                this.bullets.push(bullet);
            }

            // --- MULTIPLAYER: ATEŞ ETTİĞİMİ BİLDİR ---
            if (this.socket) {
                // Vektörleri basit sayılara çevirip gönderiyoruz
                this.socket.emit('playerShoot', {
                    x: spawnPos.x,
                    y: spawnPos.y,
                    z: spawnPos.z,
                    dirX: direction.x,
                    dirY: direction.y,
                    dirZ: direction.z,
                    weaponName: this.player.currentWeapon,
                    weaponData: { // Karşı tarafta merminin aynı özelliklerde oluşması için
                        damage: weapon.damage,
                        speed: weapon.bulletSpeed,
                        color: weapon.bulletColor,
                        size: weapon.bulletSize,
                        lifeTime: 2.0
                    }
                });
            }

            const flash = new THREE.PointLight(0xffff00, 2, 10);
            flash.position.copy(spawnPos);
            this.scene.add(flash);
            setTimeout(() => this.scene.remove(flash), 50);
        }
    }


    checkCollisions() {
        // -------------------------------------------------------------
        // 1. MERMİ KONTROLLERİ (Hem Zombi Hem PvP)
        // -------------------------------------------------------------
        for (const bullet of this.bullets) {
            if (!bullet.isAlive) continue;

            if (this.enemies.length > 0) {
                for (const enemy of this.enemies) {
                    if (!enemy.isAlive) continue;

                    // A) MERMİ - ZOMBİ ÇARPIŞMASI
                    // DİKKAT: Artık 'waveManager.enable' şartı aramıyoruz.
                    // Zombi listesi doluysa çarpışma kontrolü yap.
                    // 2D Mesafe
                    const dx = bullet.mesh.position.x - enemy.mesh.position.x;
                    const dz = bullet.mesh.position.z - enemy.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    const hitRadius = 2.0 * (enemy.mesh.scale.x || 1);

                    if (dist < hitRadius) {
                        // VURDUK!
                        const isCritical = Math.random() < 0.1;
                        const damage = isCritical ? bullet.damage * 3 : bullet.damage;
                        if (isCritical) this.soundManager.playCriticalHit();

                        bullet.kill(); // Mermi her türlü yok olur

                        // --- MODA GÖRE DAVRANIŞ ---

                        if (this.mode === 'single') {
                            // TEK OYUNCULU: Direkt hasar ver
                            enemy.takeDamage(damage);
                            this.handleLocalEnemyDeath(enemy, damage, isCritical);
                        }
                        else if (this.mode === 'coop') {
                            // CO-OP: Sunucuya bildir
                            // Görsel efekt (Kan/Ses) lokal olarak çıksın ki oyun akıcı hissettirsin
                            const popup = new DamagePopup(this.scene, enemy.mesh.position.clone(), damage, isCritical);
                            this.damagePopups.push(popup);

                            // Sunucuya gönder
                            this.socket.emit('damageEnemy', {
                                id: enemy.id,
                                damage: damage
                            });
                        }

                        break; // Mermi yok oldu, diğer zombilere bakma
                    }
                }
            }

            // B) MERMİ - DİĞER OYUNCU ÇARPIŞMASI (Sadece PvP Modunda)
            if (bullet.isAlive && this.mode === 'pvp') {
                Object.values(this.remotePlayers).forEach(remotePlayer => {
                    if (!remotePlayer.mesh) return;

                    const dx = bullet.mesh.position.x - remotePlayer.mesh.position.x;
                    const dz = bullet.mesh.position.z - remotePlayer.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    // Oyuncu Hitbox'ı (Yaklaşık 1.0 birim)
                    if (dist < 1.0) {
                        console.log(`🔫 Vurulan Oyuncu: ${remotePlayer.id}`);

                        bullet.kill();
                        this.soundManager.playPlayerHurt();

                        // Sunucuya Bildir
                        this.socket.emit('playerHit', {
                            targetId: remotePlayer.id,
                            damage: 10
                        });
                    }
                });
            }
        }

        // -------------------------------------------------------------
        // 2. ZOMBİ - OYUNCU SALDIRISI (Döngüden Bağımsız!)
        // -------------------------------------------------------------
        if (this.waveManager.enable) {
            for (const enemy of this.enemies) {
                if (!enemy.isAlive) continue;

                const dx = enemy.mesh.position.x - this.player.getPosition().x;
                const dz = enemy.mesh.position.z - this.player.getPosition().z;
                const distToPlayer = Math.sqrt(dx * dx + dz * dz);
                const attackRange = (enemy.type === 'boss' ? 3.0 : 1.3) * (enemy.mesh.scale.x || 1);

                if (distToPlayer < attackRange) {
                    if (!enemy.lastAttackTime || this.clock.getElapsedTime() - enemy.lastAttackTime > 1.0) {
                        let damage = 10;
                        if (enemy.type === 'runner') damage = 5;
                        if (enemy.type === 'tank') damage = 20;
                        if (enemy.type === 'boss') damage = 40;

                        this.player.takeDamage(damage);
                        this.soundManager.playPlayerHurt();

                        document.body.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
                        setTimeout(() => document.body.style.backgroundColor = "", 100);

                        enemy.lastAttackTime = this.clock.getElapsedTime();

                        if (this.player.isDead) {
                            this.soundManager.playGameOver();
                            this.uiManager.showGameOver(this.score);
                            this.isPaused = true;
                        }
                    }
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();
        this.update(dt);
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -this.config.viewSize * aspect;
        this.camera.right = this.config.viewSize * aspect;
        this.camera.top = this.config.viewSize;
        this.camera.bottom = -this.config.viewSize;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    addRemotePlayer(playerInfo) {
        const remotePlayer = new RemotePlayer(this.scene, playerInfo);
        this.remotePlayers[playerInfo.id] = remotePlayer;
    }

    spawnRemoteZombie(data) {
        // Zaten varsa yaratma
        if (this.enemies.find(e => e.id === data.id)) return;
        console.log(`🧟 Zombi Doğdu (Remote): ${data.id} at ${data.x}, ${data.z}`);
        // Enemy.js sınıfını kullanıyoruz ama ID özelliğini ekliyoruz
        // Enemy constructor'ını güncellememiz gerekebilir ama şimdilik JS'in esnekliğini kullanalım
        const enemy = new Enemy(this.scene, new THREE.Vector3(data.x, data.y, data.z), data.type);
        enemy.id = data.id; // ID'yi sonradan yapıştırıyoruz
        this.enemies.push(enemy);
    }

    // Singleplayer için ölüm mantığı (checkCollisions içindeki kalabalığı azalttık)
    handleLocalEnemyDeath(enemy, damage, isCritical) {
        // Popup
        const popup = new DamagePopup(this.scene, enemy.mesh.position.clone(), damage, isCritical);
        this.damagePopups.push(popup);

        if (enemy.health <= 0) {
            this.soundManager.playZombieDeath();
            this.waveManager.onEnemyKilled();
            this.score += 10;
            if (enemy.type === 'tank') this.score += 30;
            if (enemy.type === 'boss') this.score += 100;

            // Loot
            if (Math.random() < 0.3) {
                const type = Math.random() < 0.6 ? 'ammo' : 'health';
                const pickup = new Pickup(this.scene, enemy.mesh.position.clone(), type);
                this.pickups.push(pickup);
            }
        }
    }
}