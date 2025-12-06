// src/Pickup.js
import * as THREE from 'three';

export class Pickup {
    constructor(scene, position, type) {
        this.scene = scene;
        this.type = type; // 'health' veya 'ammo'
        this.isAlive = true;

        // Ayarlar
        let color = 0x00ff00; // Varsayılan: Yeşil (Health)

        if (type === 'ammo') {
            color = 0xffd700; // Altın Sarısı (Mermi)
        } else if (type === 'health') {
            color = 0xe91e63; // Pembe/Kırmızı (Can)
        }

        // Kutu Şekli
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geo, mat);

        // Yerden biraz havada dursun
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.5;

        scene.add(this.mesh);
    }

    update(dt, player) {
        // Kendi etrafında dönsün (Dikkat çeksin)
        this.mesh.rotation.y += 2.0 * dt;
        this.mesh.rotation.x += 1.0 * dt;

        // Havada hafifçe inip kalksın (Floating effect)
        this.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;

        // OYUNCU İLE ÇARPIŞMA KONTROLÜ
        // Eğer oyuncu kutuya çok yakınsa (1.0 birim)
        if (this.mesh.position.distanceTo(player.getPosition()) < 1.0) {
            this.collect(player);
        }
    }

    collect(player) {
        if (this.type === 'health') {
            // Canı 20 artır (Maksimumu geçmesin)
            player.health = Math.min(player.maxHealth, player.health + 20);
            console.log("Can toplandı!");
        } else if (this.type === 'ammo') {
            // Bir şarjör mermi ver
            player.ammo += 30; // Şarjör kapasitesini geçebilir (yedek mermi mantığı yoksa)
            // Eğer yedek mermi mantığımız yoksa direkt şarjöre ekliyoruz.
            // İstersen player.ammo = Math.min(player.clipSize, player.ammo + 30) yapabilirsin.
            console.log("Mermi toplandı!");
        }

        // UI Güncellemek için bir yol bulmamız lazım ama şimdilik main.js halledecek
        this.kill();
    }

    kill() {
        this.isAlive = false;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}