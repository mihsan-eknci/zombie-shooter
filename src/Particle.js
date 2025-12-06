// src/Particle.js
import * as THREE from 'three';

export class Particle {
    constructor(scene, position, color) {
        this.scene = scene;
        this.lifeTime = 1.0; // 1 saniye yaşasın
        this.isAlive = true;

        // Rastgele boyut (Küçük parçalar)
        const size = 0.1 + Math.random() * 0.2;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geo, mat);

        this.mesh.position.copy(position);

        // Rastgele bir yöne fırlasın (Patlama efekti)
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10, // X: Sağa sola
            (Math.random() * 5) + 2,    // Y: Yukarı fırlasın
            (Math.random() - 0.5) * 10  // Z: İleri geri
        );

        scene.add(this.mesh);
    }

    update(dt) {
        // Yerçekimi etkisi (Y hızını azalt)
        this.velocity.y -= 15 * dt;

        // Hareketi uygula
        this.mesh.position.add(
            this.velocity.clone().multiplyScalar(dt)
        );

        // Zemin kontrolü (Yere düştüyse dursun veya yavaşlasın)
        if (this.mesh.position.y < 0) {
            this.mesh.position.y = 0;
            this.velocity.y *= -0.5; // Zıplama efekti (sönümlenerek)
            this.velocity.x *= 0.8;  // Sürtünme
            this.velocity.z *= 0.8;
        }

        // Ömürden düş ve küçült
        this.lifeTime -= dt;
        this.mesh.scale.multiplyScalar(0.95); // Giderek küçülsün

        if (this.lifeTime <= 0) {
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