// src/Enemy.js
import * as THREE from 'three';

export class Enemy {
    constructor(scene, position, type = 'normal') {
        this.scene = scene;
        this.isAlive = true;
        this.type = type;

        let skinColor = 0x558b2f;
        let clothesColor = 0x4e342e;
        let scale = 1.0;
        this.speed = 4.0;
        this.health = 20; // Normal zombi canı 20

        if (type === 'runner') {
            skinColor = 0x2e7d32;
            clothesColor = 0xb71c1c;
            this.speed = 7.0;
            this.health = 10; // Hızlı zombi canı 10
            scale = 0.8;
        } else if (type === 'tank') {
            skinColor = 0x212121;
            clothesColor = 0x263238;
            this.speed = 2.5;
            this.health = 120; // Tank zombi canı 120
            scale = 1.6;
        } else if (type === 'boss') {
            skinColor = 0x4a148c;
            clothesColor = 0x000000;
            this.speed = 3.5;
            this.health = 240; // Boss zombi canı 240
            scale = 2.5;
        }

        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.mesh.scale.set(scale, scale, scale);

        // 1. Gövde
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
        const bodyMat = new THREE.MeshLambertMaterial({ color: clothesColor });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 1.0;
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // 2. Kafa
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.y = 0.6;
        this.head.castShadow = true;
        this.body.add(this.head);

        // 3. Kollar
        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const armMat = new THREE.MeshLambertMaterial({ color: skinColor });

        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(0.45, 0.3, 0);
        this.body.add(this.rightArmPivot);

        this.rightArm = new THREE.Mesh(armGeo, armMat);
        this.rightArm.position.y = -0.35;
        this.rightArm.castShadow = true;
        this.rightArmPivot.add(this.rightArm);

        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-0.45, 0.3, 0);
        this.body.add(this.leftArmPivot);

        this.leftArm = new THREE.Mesh(armGeo, armMat.clone());
        this.leftArm.position.y = -0.35;
        this.leftArm.castShadow = true;
        this.leftArmPivot.add(this.leftArm);

        this.rightArmPivot.rotation.x = Math.PI / 2;
        this.leftArmPivot.rotation.x = Math.PI / 2;

        // 4. Bacaklar
        const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(0.15, -0.35, 0);
        this.body.add(this.rightLegPivot);

        this.rightLeg = new THREE.Mesh(legGeo, legMat);
        this.rightLeg.position.y = -0.35;
        this.rightLeg.castShadow = true;
        this.rightLegPivot.add(this.rightLeg);

        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-0.15, -0.35, 0);
        this.body.add(this.leftLegPivot);

        this.leftLeg = new THREE.Mesh(legGeo, legMat.clone());
        this.leftLeg.position.y = -0.35;
        this.leftLeg.castShadow = true;
        this.leftLegPivot.add(this.leftLeg);

        scene.add(this.mesh);
    }

    update(dt, playerPosition) {
        if (!this.isAlive) return;

        // EĞER BU BİR "REMOTE" (SUNUCU) ZOMBİSİ İSE HAREKET MANTIĞINI ÇALIŞTIRMA
        if (this.id && this.id.startsWith('zombie_')) {
            // Sadece animasyonları oynat (bacak sallama vs.)
            const speed = 2.0; // Tahmini hız
            const time = Date.now() * 0.005 * speed;
            const angle = Math.sin(time) * 0.6;
            this.rightLegPivot.rotation.x = angle;
            this.leftLegPivot.rotation.x = -angle;
            this.rightArmPivot.rotation.x = -Math.PI / 3 + Math.sin(time * 2) * 0.15;
            this.leftArmPivot.rotation.x = -Math.PI / 3 + Math.cos(time * 2) * 0.15;
            return; // <-- HAREKET KODLARINA GİRMEDEN ÇIK
        }

        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.mesh.position);
        direction.y = 0;

        const stopDistance = (this.type === 'boss') ? 2.0 : 0.8;

        if (direction.length() > stopDistance) {
            direction.normalize();
            this.mesh.position.add(direction.multiplyScalar(this.speed * dt));
            this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);

            const time = Date.now() * 0.01 * (this.speed * 0.5);
            const angle = Math.sin(time) * 0.6;

            this.rightLegPivot.rotation.x = angle;
            this.leftLegPivot.rotation.x = -angle;

            // Kollar hafifçe yukarı aşağı (zombi gibi)
            this.rightArmPivot.rotation.x = -Math.PI / 3 + Math.sin(time * 2) * 0.15;
            this.leftArmPivot.rotation.x = -Math.PI / 3 + Math.cos(time * 2) * 0.15;
        }
    }

    takeDamage(damage = 1) {
        this.health -= damage; // Hasar parametresini kullan

        this.flashMaterial(this.body.material);
        this.flashMaterial(this.head.material);
        this.flashMaterial(this.rightArm.material);
        this.flashMaterial(this.leftArm.material);

        if (this.health <= 0) {
            this.kill();
        }
    }

    flashMaterial(material) {
        const oldColor = material.color.getHex();
        material.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.isAlive) material.color.setHex(oldColor);
        }, 50);
    }

    kill() {
        this.isAlive = false;
        this.scene.remove(this.mesh);

        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}