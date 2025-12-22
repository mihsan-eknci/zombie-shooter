import * as THREE from 'three';

export class Bullet {
    constructor(scene, position, direction, options = {}) {
        this.scene = scene;
        
        // Mermi özellikleri
        this.speed = options.speed || 40;
        this.damage = options.damage || 1;
        this.color = options.color || 0xffff00;
        this.size = options.size || 0.3;
        this.lifeTime = options.lifeTime || 2.0;
        
        this.isAlive = true;

        console.log(`✅ Bullet.js - Mermi oluşturuldu: Hasar=${this.damage}, Hız=${this.speed}, Renk=${this.color.toString(16)}`);

        // Mermi şekli
        const geo = new THREE.SphereGeometry(this.size, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geo, mat);

        this.mesh.position.copy(position);
        this.velocity = direction.clone().normalize().multiplyScalar(this.speed);

        scene.add(this.mesh);
    }

    update(dt) {
        this.mesh.position.add(
            this.velocity.clone().multiplyScalar(dt)
        );

        this.lifeTime -= dt;
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