// src/Bullet.js
import * as THREE from 'three';

export class Bullet {
    constructor(scene, position, direction, options = {}) {
        this.scene = scene;

        // Mermi özellikleri
        this.speed = options.speed || 50;
        this.damage = options.damage || 10;
        this.color = options.color || 0xffff00;
        this.size = options.size || 0.2;
        this.lifeTime = options.lifeTime || 2.0;

        this.isAlive = true;

        // --- GÖRSEL İYİLEŞTİRME ---
        // Mermiyi top yerine uzun bir "ışın" gibi yapıyoruz (Tracer effect)
        const geo = new THREE.SphereGeometry(this.size, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: this.color
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);

        // Hız vektörünü hesapla
        this.velocity = direction.clone().normalize().multiplyScalar(this.speed);

        // Mermiyi gittiği yöne çevir ve uzat (Hız hissi için)
        this.mesh.lookAt(position.clone().add(direction));
        this.mesh.scale.set(1, 1, 4); // Z ekseninde (ileri) 4 kat uzat

        scene.add(this.mesh);
    }

    update(dt) {
        // Hareketi uygula
        this.mesh.position.add(
            this.velocity.clone().multiplyScalar(dt)
        );

        // Ömür kontrolü (Süre bitince yok et)
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.kill();
        }
    }

    kill() {
        if (!this.isAlive) return;

        this.isAlive = false;
        this.scene.remove(this.mesh);

        // Bellek temizliği (Memory Leak önlemek için önemli)
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}