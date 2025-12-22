import * as THREE from 'three';
import { Enemy } from '../entities/Enemy.js';

export class WaveManager {
    // Constructor'a uiManager ve soundManager'ı da ekledik
    constructor(scene, player, mapSize, uiManager, soundManager) {
        this.scene = scene;
        this.player = player;
        this.mapSize = mapSize;
        this.uiManager = uiManager;     // UI'ı güncellemek için
        this.soundManager = soundManager; // Dalga bitiş sesi için

        // Dalga Ayarları
        this.wave = 1;
        this.zombiesToSpawn = 10;   // Bu dalgada toplam çıkacak zombi
        this.zombiesSpawned = 0;    // Şu ana kadar yaratılan
        this.zombiesKilled = 0;     // Öldürülen zombi sayısı

        this.activeEnemies = [];    // Sahnedeki canlı zombiler
        this.spawnTimer = 0;
        this.spawnRate = 2.0;       // Spawn hızı

        // İlk UI güncellemesi
        this.updateUI();
    }

    setEnemiesArray(enemiesArray) {
        this.activeEnemies = enemiesArray;
    }

    update(dt) {
        if (this.enable === false) return; // <-- Bunu ekle (Varsayılan true kabul et)
        // Eğer yaratılacak zombi kaldıysa zamanlayıcıyı çalıştır
        if (this.zombiesSpawned < this.zombiesToSpawn) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnTimer = 0;
                this.spawnEnemy();
            }
        }
    }

    spawnEnemy() {
        const halfSize = this.mapSize / 2 - 2;
        let spawnX, spawnZ;

        const side = Math.floor(Math.random() * 4);
        switch (side) {
            case 0: spawnX = (Math.random() - 0.5) * this.mapSize; spawnZ = -halfSize; break;
            case 1: spawnX = (Math.random() - 0.5) * this.mapSize; spawnZ = halfSize; break;
            case 2: spawnX = -halfSize; spawnZ = (Math.random() - 0.5) * this.mapSize; break;
            case 3: spawnX = halfSize; spawnZ = (Math.random() - 0.5) * this.mapSize; break;
        }

        const spawnPos = new THREE.Vector3(spawnX, 0, spawnZ);

        // Dalga ilerledikçe zor zombiler gelsin
        let type = 'normal';
        const chance = Math.random();
        if (this.wave >= 2 && chance < 0.3) type = 'runner';
        if (this.wave >= 4 && chance > 0.85) type = 'tank';
        if (this.wave % 5 === 0 && this.zombiesSpawned === 0) type = 'boss'; // Her 5 dalgada bir boss

        const enemy = new Enemy(this.scene, spawnPos, type);
        this.activeEnemies.push(enemy);
        this.zombiesSpawned++;
    }

    // Bir zombi öldüğünde Game.js burayı çağıracak
    onEnemyKilled() {
        this.zombiesKilled++;
        this.updateUI();

        // Dalga bitti mi?
        if (this.zombiesKilled >= this.zombiesToSpawn) {
            this.startNextWave();
        }
    }


    startNextWave() {
        this.wave++;
        this.zombiesToSpawn += 5;
        this.zombiesSpawned = 0;
        this.zombiesKilled = 0;

        this.spawnRate = Math.max(0.3, 2.0 - (this.wave * 0.15));

        if (this.player.health < this.player.maxHealth) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);
        }

        console.log(`🎉 Dalga ${this.wave} Başlıyor!`);

        if (this.soundManager) this.soundManager.playWaveComplete();

        // --- EKLENEN KISIM BURASI ---
        // UI Manager'a pop-up'ı göstermesi için emir veriyoruz
        if (this.uiManager) {
            this.uiManager.showWaveComplete(this.wave);
            this.updateUI();
        }
    }
    updateUI() {
        const remaining = this.zombiesToSpawn - this.zombiesKilled;
        this.uiManager.updateWaveInfo(this.wave, remaining);
        this.uiManager.updateHealth(); // Oyuncu iyileştiyse can barını güncelle
    }
}