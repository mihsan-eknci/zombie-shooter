// src/Enemy.js
import * as THREE from 'three';

export class Enemy {
    constructor(scene, position, type = 'normal', id = null) {
        this.scene = scene;
        this.id = id; // Sunucu ID'si (ÖNEMLİ)
        this.type = type;
        this.isAlive = true;

        // Hedef Pozisyon (Sunucudan gelen veri için)
        this.targetPosition = new THREE.Vector3(position.x, 0, position.z);
        this.currentPosition = new THREE.Vector3(position.x, 0, position.z);

        // Görsel Ayarlar
        let skinColor = 0x558b2f;
        let clothesColor = 0x4e342e;
        let scale = 1.0;

        if (type === 'runner') {
            skinColor = 0x2e7d32;
            clothesColor = 0xb71c1c;
            scale = 0.8;
        } else if (type === 'tank') {
            skinColor = 0x212121;
            clothesColor = 0x263238;
            scale = 1.6;
        } else if (type === 'boss') {
            skinColor = 0x4a148c;
            clothesColor = 0x000000;
            scale = 2.5;
        }

        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.mesh.scale.set(scale, scale, scale);

        // --- MODEL PARÇALARI ---

        // 1. Gövde
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
        const bodyMat = new THREE.MeshLambertMaterial({ color: clothesColor });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 1.0;
        this.mesh.add(this.body);

        // 2. Kafa
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.y = 0.6;
        this.body.add(this.head);

        // 3. Kollar
        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const armMat = new THREE.MeshLambertMaterial({ color: skinColor });

        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(0.45, 0.3, 0);
        this.body.add(this.rightArmPivot);

        this.rightArm = new THREE.Mesh(armGeo, armMat);
        this.rightArm.position.y = -0.35;
        this.rightArmPivot.add(this.rightArm);

        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-0.45, 0.3, 0);
        this.body.add(this.leftArmPivot);

        this.leftArm = new THREE.Mesh(armGeo, armMat.clone());
        this.leftArm.position.y = -0.35;
        this.leftArmPivot.add(this.leftArm);

        // Zombi duruşu (Kollar önde)
        this.rightArmPivot.rotation.x = Math.PI / 2;
        this.leftArmPivot.rotation.x = Math.PI / 2;

        scene.add(this.mesh);
    }

    // Sunucudan gelen yeni pozisyonu kaydet
    updateState(x, z) {
        this.targetPosition.set(x, 0, z);
    }

    update(dt) {
        if (!this.isAlive) return;

        // 1. Yumuşak Hareket (Interpolation)
        // Mevcut pozisyondan hedef pozisyona doğru kay
        this.mesh.position.lerp(this.targetPosition, 10 * dt);

        // 2. Yönelme (LookAt)
        // Hareket ediyorsa gittiği yöne baksın
        const diffX = this.targetPosition.x - this.mesh.position.x;
        const diffZ = this.targetPosition.z - this.mesh.position.z;

        if (Math.abs(diffX) > 0.1 || Math.abs(diffZ) > 0.1) {
            this.mesh.lookAt(this.targetPosition.x, this.mesh.position.y, this.targetPosition.z);

            // 3. Yürüme Animasyonu
            const time = Date.now() * 0.01;
            this.rightArmPivot.rotation.x = Math.PI / 2 + Math.sin(time) * 0.2;
            this.leftArmPivot.rotation.x = Math.PI / 2 - Math.sin(time) * 0.2;
        }
    }

    flashMaterial(material) {
        if (!material) return;
        const oldColor = material.color.getHex();
        material.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.isAlive && material) material.color.setHex(oldColor);
        }, 50);
    }

    kill() {
        if (!this.isAlive) return;
        this.isAlive = false;
        this.scene.remove(this.mesh);

        // Bellek Temizliği
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}