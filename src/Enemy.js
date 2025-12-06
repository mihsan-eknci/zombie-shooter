// src/Enemy.js
import * as THREE from 'three';

export class Enemy {
    // Constructor artık 'type' (tür) bilgisi de alıyor
    constructor(scene, position, type = 'normal') {
        this.scene = scene;
        this.isAlive = true;
        this.type = type;

        // --- TÜR AYARLARI ---
        let color = 0x8d6e63; // Normal (Kahverengi)
        let scale = 1.0;

        // Varsayılan Değerler (Normal)
        this.speed = 4.0;
        this.health = 2;

        if (type === 'runner') {
            color = 0xd32f2f; // Kırmızı
            this.speed = 7.0; // Çok hızlı
            this.health = 1;  // Tek mermilik
            scale = 0.8;      // Daha küçük
        } else if (type === 'tank') {
            color = 0x212121; // Koyu Gri/Siyah
            this.speed = 2.5; // Yavaş
            this.health = 8;  // Çok dayanıklı
            scale = 1.5;      // Büyük
        } else if (type === 'boss') {
            color = 0x4a148c; // Mor
            this.speed = 3.5;
            this.health = 50; // Tam bir baş belası
            scale = 2.5;      // Devasa
        }

        // Geometriyi türe göre oluştur
        const geo = new THREE.BoxGeometry(1, 1.8, 0.5);
        const mat = new THREE.MeshLambertMaterial({ color: color });
        this.mesh = new THREE.Mesh(geo, mat);

        this.mesh.position.copy(position);
        this.mesh.position.y = 0.9 * scale; // Boyuta göre yere basmalı
        this.mesh.scale.set(scale, scale, scale); // Büyüt/Küçült

        this.mesh.castShadow = true;
        scene.add(this.mesh);
    }

    update(dt, playerPosition) {
        if (!this.isAlive) return;

        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.mesh.position);

        direction.y = 0;

        // Mesafe kontrolü (Boss veya Tank ise oyuncuya çok dibine girmesin, biraz uzaktan vursun)
        const stopDistance = (this.type === 'boss') ? 2.0 : 0.5;

        if (direction.length() > stopDistance) {
            direction.normalize();
            this.mesh.position.add(
                direction.multiplyScalar(this.speed * dt)
            );
            this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);
        }
    }

    takeDamage() {
        this.health--;

        // Vurulma efekti (Beyaz yanıp sönsün)
        const originalColor = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xffffff);

        setTimeout(() => {
            if (this.isAlive) this.mesh.material.color.setHex(originalColor);
        }, 50);

        if (this.health <= 0) {
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