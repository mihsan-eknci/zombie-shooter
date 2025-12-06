// src/Bullet.js
import * as THREE from 'three';

export class Bullet {
    constructor(scene, position, direction) {
        this.scene = scene;
        this.speed = 40; // Mermi hızı
        this.isAlive = true; // Yaşıyor mu?
        this.lifeTime = 2.0; // 2 saniye sonra yok olur

        // Mermi Şekli (Sarı bir küre)
        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geo, mat);

        // Başlangıç pozisyonu
        this.mesh.position.copy(position);

        // Yön (Direction vektörünü kopyalıyoruz)
        this.velocity = direction.clone().normalize().multiplyScalar(this.speed);

        scene.add(this.mesh);
    }

    update(dt) {
        // Hareketi uygula
        this.mesh.position.add(
            this.velocity.clone().multiplyScalar(dt)
        );

        // Ömürden düş
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.kill();
        }
    }

    kill() {
        this.isAlive = false;
        this.scene.remove(this.mesh);
        // Bellek temizliği (Geometry ve Material'i serbest bırak)
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}