// src/core/Game.js
import * as THREE from 'three';
import { Player } from '../entities/Player.js';
import { World } from './World.js';
import { InputManager } from './InputManager.js';
import { Bullet } from '../entities/Bullet.js';
import { DamagePopup } from '../entities/DamagePopup.js';
import { UIManager } from '../managers/UIManager.js';
import { WaveManager } from '../managers/WaveManager.js';
import { SoundManager } from '../managers/SoundManager.js';
import { Pickup } from '../entities/Pickup.js';
import { MinimapManager } from '../managers/MinimapManager.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Enemy } from '../entities/Enemy.js';
import { Obstacle, ObstacleManager } from '../entities/Obstacles.js';

export class Game {
    constructor(socket) {
        this.socket = socket;
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
        this.damagePopups = [];
        this.isPaused = false;
        this.score = 0;
        this.pickups = [];
        this.remotePlayers = {};
        this.obstacleManager = null;

        if (this.socket) {
            console.log("🔌 Multiplayer Modu Aktif - Sunucuya bağlanılıyor...");

            this.socket.on('connect', () => {
                console.log(`✅ Bağlandı! ID: ${this.socket.id}`);
            });

            this.socket.on('currentPlayers', (players) => {
                Object.keys(players).forEach((id) => {
                    if (id !== this.socket.id) {
                        this.addRemotePlayer(players[id]);
                    }
                });

                if (this.mode === 'coop') {
                    this.socket.emit('requestWaveInfo');
                }
            });

            this.socket.on('newPlayer', (playerInfo) => {
                this.addRemotePlayer(playerInfo);
                console.log("Yeni oyuncu katıldı:", playerInfo.id);
            });

            this.socket.on('playerMoved', (playerInfo) => {
                if (this.remotePlayers[playerInfo.id]) {
                    this.remotePlayers[playerInfo.id].updatePosition(playerInfo);
                }
            });

            this.socket.on('playerDisconnected', (id) => {
                if (this.remotePlayers[id]) {
                    this.remotePlayers[id].delete();
                    delete this.remotePlayers[id];
                    console.log("Oyuncu ayrıldı:", id);
                }
            });

            this.socket.on('remotePlayerShoot', (data) => {
                const spawnPos = new THREE.Vector3(data.x, data.y, data.z);
                const direction = new THREE.Vector3(data.dirX, data.dirY, data.dirZ);

                const bullet = new Bullet(this.scene, spawnPos, direction, data.weaponData);
                this.bullets.push(bullet);

                this.soundManager.playShootSound(data.weaponName || 'pistol');

                const flash = new THREE.PointLight(0xffff00, 2, 10);
                flash.position.copy(spawnPos);
                this.scene.add(flash);
                setTimeout(() => this.scene.remove(flash), 50);
            });

            this.socket.on('playerDamaged', (data) => {
                if (data.id === this.socket.id) {
                    this.player.takeDamage(data.damage);
                    this.soundManager.playPlayerHurt();
                    this.uiManager.updateHealth();

                    const overlay = document.getElementById('damage-overlay');
                    if (overlay) {
                        overlay.style.opacity = "1";
                        setTimeout(() => overlay.style.opacity = "0", 300);
                    } else {
                        document.body.style.backgroundColor = "rgba(255, 0, 0, 0.4)";
                        setTimeout(() => document.body.style.backgroundColor = "#ad8a6c", 100);
                    }

                    console.log(`💔 Vuruldum! Kalan Can: ${this.player.health}`);

                    if (this.player.health <= 0 && !this.player.isDead) {
                        this.player.isDead = true;
                        this.socket.emit('playerDied');
                        this.uiManager.showGameOver(this.score);
                        this.isPaused = true;
                    }
                }
            });

            this.socket.on('enemyUpdate', (serverEnemies) => {
                Object.values(serverEnemies).forEach(sEnemy => {
                    let localEnemy = this.enemies.find(e => e.id === sEnemy.id);

                    if (localEnemy) {
                        localEnemy.mesh.position.set(sEnemy.x, sEnemy.y, sEnemy.z);
                        localEnemy.mesh.lookAt(sEnemy.x + Math.sin(sEnemy.rotation), sEnemy.y, sEnemy.z + Math.cos(sEnemy.rotation));
                    }
                });
            });

            this.socket.on('enemySpawn', (sEnemy) => {
                this.spawnRemoteZombie(sEnemy);
            });

            this.socket.on('enemyDied', (data) => {
                const enemy = this.enemies.find(e => e.id === data.id);
                if (enemy) {
                    this.soundManager.playZombieDeath();
                    enemy.kill();

                    if (data.killerId === this.socket.id) {
                        this.score += 10;
                    }
                }
            });

            this.socket.on('pickupSpawn', (data) => {
                const p = new Pickup(this.scene, new THREE.Vector3(data.x, 0, data.z), data.type);
                p.id = data.id;
                this.pickups.push(p);
            });

            this.socket.on('pickupCollected', (data) => {
                const index = this.pickups.findIndex(p => p.id === data.id);
                if (index !== -1) {
                    this.pickups[index].isAlive = false;
                    this.pickups[index].mesh.visible = false;
                }

                if (data.collectorId === this.socket.id) {
                    this.soundManager.playPickupSound(data.type);

                    if (data.type === 'health') {
                        this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);
                    }
                    else if (data.type === 'ammo') {
                        const weapon = this.player.getWeapon();
                        weapon.reserveAmmo = Math.min(weapon.maxReserveAmmo, weapon.reserveAmmo + 30);
                    }

                    this.uiManager.update();
                }
            });

            this.socket.on('waveUpdate', (data) => {
                console.log(`📊 Wave Güncellendi: Dalga ${data.wave}, Kalan: ${data.remaining}`);
                if (this.uiManager) {
                    this.uiManager.updateWaveInfo(data.wave, data.remaining);
                }
            });

            this.socket.on('waveComplete', (data) => {
                console.log(`🎉 Dalga ${data.nextWave} Tamamlandı!`);
                if (this.soundManager) {
                    this.soundManager.playWaveComplete();
                }
                if (this.uiManager) {
                    this.uiManager.showWaveComplete(data.nextWave);
                }

                if (this.player.health < this.player.maxHealth) {
                    this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);
                    this.uiManager.updateHealth();
                }
            });

            this.socket.on('obstaclesData', (obstaclesData) => {
                console.log(`📦 ${obstaclesData.length} engel sunucudan yüklendi`);

                if (this.obstacleManager) {
                    this.obstacleManager.clear();
                } else {
                    this.obstacleManager = new ObstacleManager(this.scene, this.config.mapSize);
                }

                obstaclesData.forEach(obs => {
                    const position = new THREE.Vector3(obs.x, 0, obs.z);
                    const obstacle = new Obstacle(this.scene, position, obs.type);
                    obstacle.mesh.rotation.y = obs.rotation;
                    obstacle.updateBoundingBox();
                    this.obstacleManager.obstacles.push(obstacle);
                });
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

        this.obstacleManager = new ObstacleManager(this.scene, this.config.mapSize);

        this.player = new Player(this.scene, this.soundManager);
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

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.togglePause();
            }
        });

        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.onclick = () => {
                this.togglePause();
            };
        }

        window.addEventListener('resize', () => this.onWindowResize());
    }

    togglePause() {
        if (this.player.isDead) return;

        this.isPaused = !this.isPaused;
        const pauseMenu = document.getElementById('pause-menu');

        if (this.isPaused) {
            pauseMenu.style.display = 'block';
            console.log("⏸️ Oyun duraklatıldı");
        } else {
            pauseMenu.style.display = 'none';
            console.log("▶️ Oyun devam ediyor");
        }
    }

    start(mode, playerName) {
        this.mode = mode;
        this.playerName = playerName;
        this.isPaused = false;

        console.log(`🚀 Mod Yüklendi: ${mode}`);

        if (mode === 'single') {
            this.waveManager.enable = true;
            if (this.obstacleManager && this.obstacleManager.obstacles.length === 0) {
                this.obstacleManager.generateObstacles(25);
            }
        }
        else if (mode === 'coop') {
            this.socket.emit('joinGame', { mode: 'coop', name: playerName });
            this.waveManager.enable = false;
            this.enemies.forEach(e => e.kill());
            this.enemies = [];
        }
        else if (mode === 'pvp') {
            this.socket.emit('joinGame', { mode: 'pvp', name: playerName });
            this.waveManager.enable = false;
            this.enemies.forEach(e => e.kill());
            this.enemies = [];
        }

        this.player.name = playerName;
        this.animate();
    }

    update(dt) {
        if (this.isPaused) return;

        const inputs = this.inputManager.keys;

        const oldPlayerPos = this.player.getPosition().clone();
        this.player.update(dt, inputs);
        const newPlayerPos = this.player.getPosition();

        if (this.obstacleManager) {
            const resolvedPos = this.obstacleManager.resolveMovement(
                oldPlayerPos,
                newPlayerPos,
                0.5
            );

            if (resolvedPos.x !== newPlayerPos.x || resolvedPos.z !== newPlayerPos.z) {
                this.player.mesh.position.copy(resolvedPos);
            }
        }

        if (inputs['1'] && this.player.currentWeapon !== 'pistol') {
            this.player.switchWeapon('pistol');
            this.uiManager.update();
        }
        if (inputs['2'] && this.player.currentWeapon !== 'shotgun') {
            this.player.switchWeapon('shotgun');
            this.uiManager.update();
        }
        if (inputs['3'] && this.player.currentWeapon !== 'rifle') {
            this.player.switchWeapon('rifle');
            this.uiManager.update();
        }
        if (inputs['4'] && this.player.currentWeapon !== 'sniper') {
            this.player.switchWeapon('sniper');
            this.uiManager.update();
        }

        if (this.socket && (this.mode === 'coop' || this.mode === 'pvp')) {
            const pPos = this.player.getPosition();

            if (!this.lastPositionUpdate || Date.now() - this.lastPositionUpdate > 50) {
                this.socket.emit('playerMovement', {
                    x: pPos.x,
                    y: pPos.y,
                    z: pPos.z,
                    rotation: this.player.mesh.rotation.y,
                    aimX: this.currentAimPoint.x,
                    aimZ: this.currentAimPoint.z
                });
                this.lastPositionUpdate = Date.now();
            }
        }

        if ((inputs['r'] || inputs['R']) && !this.player.isReloading) {
            const weapon = this.player.getWeapon();

            if (weapon.reserveAmmo > 0 && weapon.currentAmmo < weapon.clipSize) {
                this.player.reload();
                this.soundManager.playReloadSound();
                this.uiManager.updateAmmo();
            } else if (weapon.reserveAmmo === 0) {
                console.log("❌ Depo boş! Mermi bulamıyorsun.");
            }
        }

        this.raycaster.setFromCamera(this.inputManager.mouse, this.camera);
        const intersection = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.aimPlane, intersection)) {
            this.player.lookAt(intersection);
            this.currentAimPoint.copy(intersection);
        }

        if (this.inputManager.isMouseDown && this.player.canShoot()) {
            const weapon = this.player.getWeapon();

            if (weapon.currentAmmo > 0) {
                this.fireBullet();
            } else {
                if (weapon.reserveAmmo > 0) {
                    this.player.reload();
                    this.soundManager.playReloadSound();
                    this.uiManager.updateAmmo();
                } else {
                    console.log("❌ Mermi bitti! Yerden mermi topla.");
                }
            }
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(dt);
            if (!b.isAlive) this.bullets.splice(i, 1);
        }

        if (this.waveManager.enable) {
            this.waveManager.update(dt);
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const oldEnemyPos = enemy.mesh.position.clone();
            enemy.update(dt, this.player.getPosition());
            const newEnemyPos = enemy.mesh.position;

            if (this.obstacleManager) {
                const resolvedPos = this.obstacleManager.resolveMovement(
                    oldEnemyPos,
                    newEnemyPos,
                    0.8
                );

                if (resolvedPos.x !== newEnemyPos.x || resolvedPos.z !== newEnemyPos.z) {
                    enemy.mesh.position.copy(resolvedPos);
                }
            }
        }

        this.checkCollisions();

        for (let i = this.damagePopups.length - 1; i >= 0; i--) {
            const popup = this.damagePopups[i];
            popup.update(dt);
            if (!popup.isAlive) this.damagePopups.splice(i, 1);
        }

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

        const pPos = this.player.getPosition();
        this.camera.position.x = pPos.x + this.config.cameraOffset;
        this.camera.position.z = pPos.z + this.config.cameraOffset;

        if (this.minimapManager) this.minimapManager.update();
        this.uiManager.update();
        this.uiManager.updateScore(this.score);
    }

    fireBullet() {
        if (this.player.shoot()) {
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

            if (this.socket) {
                this.socket.emit('playerShoot', {
                    x: spawnPos.x,
                    y: spawnPos.y,
                    z: spawnPos.z,
                    dirX: direction.x,
                    dirY: direction.y,
                    dirZ: direction.z,
                    weaponName: this.player.currentWeapon,
                    weaponData: {
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
        for (const bullet of this.bullets) {
            if (!bullet.isAlive) continue;

            // ✅✅✅ YENİ: ENGEL ÇARPIŞMASI ✅✅✅
            if (this.obstacleManager) {
                const bulletPos = new THREE.Vector3(
                    bullet.mesh.position.x,
                    0,
                    bullet.mesh.position.z
                );
                
                if (this.obstacleManager.checkCollision(bulletPos, 0.3)) {
                    // Metalik duvara çarpma sesi
                    this.soundManager.playTone(800, 0.05, 'square', 0.3);
                    
                    // Mermiyi yok et
                    bullet.kill();
                    continue; // Sonraki mermiye geç
                }
            }
            // ✅✅✅ ENGEL KONTROLÜ BİTTİ ✅✅✅

            if (this.enemies.length > 0) {
                for (const enemy of this.enemies) {
                    if (!enemy.isAlive) continue;

                    const dx = bullet.mesh.position.x - enemy.mesh.position.x;
                    const dz = bullet.mesh.position.z - enemy.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    const hitRadius = 2.0 * (enemy.mesh.scale.x || 1);

                    if (dist < hitRadius) {
                        const isCritical = Math.random() < 0.1;
                        const damage = isCritical ? bullet.damage * 3 : bullet.damage;
                        if (isCritical) this.soundManager.playCriticalHit();

                        bullet.kill();

                        if (this.mode === 'single') {
                            enemy.takeDamage(damage);
                            this.handleLocalEnemyDeath(enemy, damage, isCritical);
                        }
                        else if (this.mode === 'coop') {
                            const popup = new DamagePopup(this.scene, enemy.mesh.position.clone(), damage, isCritical);
                            this.damagePopups.push(popup);

                            this.socket.emit('damageEnemy', {
                                id: enemy.id,
                                damage: damage
                            });
                        }

                        break;
                    }
                }
            }

            if (bullet.isAlive && this.mode === 'pvp') {
                for (const remotePlayer of Object.values(this.remotePlayers)) {
                    if (!remotePlayer.mesh) continue;

                    const dx = bullet.mesh.position.x - remotePlayer.mesh.position.x;
                    const dz = bullet.mesh.position.z - remotePlayer.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist < 1.0) {
                        console.log(`🔫 Vurulan Oyuncu: ${remotePlayer.id}`);

                        bullet.kill();
                        this.soundManager.playPlayerHurt();

                        this.socket.emit('playerHit', {
                            targetId: remotePlayer.id,
                            damage: 10
                        });
                        
                        break; // ✅ DURDUR! Tek oyuncuya vur
                    }
                }
            }
        }

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
        if (this.enemies.find(e => e.id === data.id)) return;
        console.log(`🧟 Zombi Doğdu (Remote): ${data.id} at ${data.x}, ${data.z}`);
        const enemy = new Enemy(this.scene, new THREE.Vector3(data.x, data.y, data.z), data.type);
        enemy.id = data.id;
        this.enemies.push(enemy);
    }

    handleLocalEnemyDeath(enemy, damage, isCritical) {
        const popup = new DamagePopup(this.scene, enemy.mesh.position.clone(), damage, isCritical);
        this.damagePopups.push(popup);

        if (enemy.health <= 0) {
            this.soundManager.playZombieDeath();
            this.waveManager.onEnemyKilled();
            this.score += 10;
            if (enemy.type === 'tank') this.score += 30;
            if (enemy.type === 'boss') this.score += 100;

            if (Math.random() < 0.3) {
                const type = Math.random() < 0.6 ? 'ammo' : 'health';
                const pickup = new Pickup(this.scene, enemy.mesh.position.clone(), type);
                this.pickups.push(pickup);
            }
        }
    }
}