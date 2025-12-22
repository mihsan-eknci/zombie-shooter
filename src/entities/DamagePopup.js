// src/DamagePopup.js
import * as THREE from 'three';

export class DamagePopup {
    constructor(scene, position, damage, isCritical = false) {
        this.scene = scene;
        this.lifeTime = 1.0; // 1 saniye yaşasın
        this.isAlive = true;

        // Sprite için canvas oluştur
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        // Arkaplan temizle (şeffaf)
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Yazı ayarları
        context.font = isCritical ? 'Bold 80px Arial' : 'Bold 60px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Gölge efekti
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 10;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;

        // Renk (Kritik kırmızı, normal sarı)
        context.fillStyle = isCritical ? '#ff0000' : '#ffff00';

        // Hasarı yaz (sadece sayı)
        const text = `-${damage}`;
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // Canvas'ı texture yap
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Sprite materyali
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        // Sprite oluştur
        this.sprite = new THREE.Sprite(spriteMaterial);
        this.sprite.scale.set(isCritical ? 4 : 2, isCritical ? 2 : 1, 1);
        
        // Pozisyonu ayarla (zombinin başının üstünde)
        this.sprite.position.copy(position);
        this.sprite.position.y += 2.5; // Başın üstünde başla

        // Hareket hızı
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2, // Hafif sağa sola
            3, // Yukarı doğru
            0
        );

        scene.add(this.sprite);
    }

    update(dt) {
        // Yukarı doğru hareket
        this.sprite.position.add(
            this.velocity.clone().multiplyScalar(dt)
        );

        // Yavaşlama
        this.velocity.y -= 2 * dt;

        // Ömür azalt ve şeffaflaştır
        this.lifeTime -= dt;
        const alpha = Math.max(0, this.lifeTime);
        this.sprite.material.opacity = alpha;

        // Ölüm kontrolü
        if (this.lifeTime <= 0) {
            this.kill();
        }
    }

    kill() {
        this.isAlive = false;
        this.scene.remove(this.sprite);
        this.sprite.material.map.dispose();
        this.sprite.material.dispose();
    }
}