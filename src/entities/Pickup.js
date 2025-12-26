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

    update(dt, player, onCollect) {
        // Kendi etrafında dönsün (Dikkat çeksin)
        this.mesh.rotation.y += 2.0 * dt;
        this.mesh.rotation.x += 1.0 * dt;

        // Havada hafifçe inip kalksın (Floating effect)
        this.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;

        // OYUNCU İLE ÇARPIŞMA KONTROLÜ
        if (this.mesh.position.distanceTo(player.getPosition()) < 1.0) {
            this.collect(player, onCollect);
        }
    }

    collect(player, onCollect) {
        if (this.type === 'health') {
            // ✅ CAN SİSTEMİ
            player.health = Math.min(player.maxHealth, player.health + 20);
            console.log("❤️ Can toplandı! (+20)");
            
            if (onCollect) onCollect(this.type);
            this.kill();
        } 
        else if (this.type === 'ammo') {
            // ✅ YENİ MERMİ SİSTEMİ (DÜZELTİLMİŞ)
            const weapon = player.getWeapon();
            
            // ✅ DÜZELTİLDİ: weapon.name yerine player.currentWeapon kullan
            let ammoAmount = 0;
            
            if (player.currentWeapon === 'pistol') {
                ammoAmount = 30;
            } else if (player.currentWeapon === 'shotgun') {
                ammoAmount = 16;
            } else if (player.currentWeapon === 'rifle') {
                ammoAmount = 60;
            } else if (player.currentWeapon === 'sniper') {
                ammoAmount = 10;
            }
            
            // 2. Depo dolu mu kontrol et
            if (weapon.reserveAmmo >= weapon.maxReserveAmmo) {
                console.log(`⚠️ ${weapon.name} deposu dolu! (${weapon.reserveAmmo}/${weapon.maxReserveAmmo})`);
                return; // ❌ Kutuyu ALMA
            }
            
            // 3. Depoya ekle (limit aşmasın)
            const oldReserve = weapon.reserveAmmo;
            weapon.reserveAmmo = Math.min(
                weapon.maxReserveAmmo, 
                weapon.reserveAmmo + ammoAmount
            );
            
            const actualAdded = weapon.reserveAmmo - oldReserve;
            
            console.log(`📦 ${weapon.name} mermisi toplandı! (+${actualAdded}) → ${weapon.reserveAmmo}/${weapon.maxReserveAmmo}`);
            
            if (onCollect) onCollect(this.type);
            this.kill();
        }
    }

    kill() {
        this.isAlive = false;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}