// src/entities/RemotePlayer.js
import * as THREE from 'three';

export class RemotePlayer {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;

        // ✅ Player.js ile aynı detaylı model
        this.mesh = new THREE.Group();
        this.mesh.position.set(initialData.x, initialData.y, initialData.z);

        this.createModel();

        // İsim etiketi ekle
        if (initialData.name) {
            this.addNameTag(initialData.name);
        }

        scene.add(this.mesh);
    }

    createModel() {
        // Diğer oyuncuları ayırt etmek için farklı renkler
        const skinColor = 0xffccaa;
        const shirtColor = 0xff4444; // Kırmızı gömlek (fark için)
        const pantsColor = 0x1a237e;

        // 1. Gövde
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
        const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
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

        // 3. Sağ Kol
        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(0.45, 0.3, 0);
        this.body.add(this.rightArmPivot);

        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const armMat = new THREE.MeshLambertMaterial({ color: skinColor });
        this.rightArm = new THREE.Mesh(armGeo, armMat);
        this.rightArm.position.y = -0.35;
        this.rightArm.castShadow = true;
        this.rightArmPivot.add(this.rightArm);

        // 4. Silah (Sağ kolda)
        const gunGeo = new THREE.BoxGeometry(0.12, 0.12, 0.8);
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x708090 });
        this.gun = new THREE.Mesh(gunGeo, gunMat);
        this.gun.position.set(0.1, -0.25, 0.6);
        this.gun.rotation.x = Math.PI / 12;
        this.rightArmPivot.add(this.gun);

        // 5. Sol Kol
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-0.45, 0.3, 0);
        this.body.add(this.leftArmPivot);

        this.leftArm = new THREE.Mesh(armGeo, armMat.clone());
        this.leftArm.position.y = -0.35;
        this.leftArm.castShadow = true;
        this.leftArmPivot.add(this.leftArm);

        // 6. Sağ Bacak
        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(0.15, -0.35, 0);
        this.body.add(this.rightLegPivot);

        const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        const legMat = new THREE.MeshLambertMaterial({ color: pantsColor });
        this.rightLeg = new THREE.Mesh(legGeo, legMat);
        this.rightLeg.position.y = -0.35;
        this.rightLeg.castShadow = true;
        this.rightLegPivot.add(this.rightLeg);

        // 7. Sol Bacak
        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-0.15, -0.35, 0);
        this.body.add(this.leftLegPivot);

        this.leftLeg = new THREE.Mesh(legGeo, legMat.clone());
        this.leftLeg.position.y = -0.35;
        this.leftLeg.castShadow = true;
        this.leftLegPivot.add(this.leftLeg);
    }

    updatePosition(data) {
        // Pozisyon güncellemesi için smooth interpolation
        const targetPos = new THREE.Vector3(data.x, data.y, data.z);
        this.mesh.position.lerp(targetPos, 0.3); // Yumuşak hareket

        // ✅ AIM POINT'E BAKMA (Fare pozisyonuna göre dönüş)
        if (data.aimX !== undefined && data.aimZ !== undefined) {
            // Karakteri aimPoint'e çevir
            this.mesh.lookAt(data.aimX, this.mesh.position.y, data.aimZ);
        } else if (data.rotation !== undefined) {
            // Eski yöntem (fallback)
            this.mesh.rotation.y = data.rotation;
        }

        // Hareket kontrolü - pozisyon değişimi varsa animasyon
        const deltaX = Math.abs(this.mesh.position.x - targetPos.x);
        const deltaZ = Math.abs(this.mesh.position.z - targetPos.z);
        const isMoving = (deltaX + deltaZ) > 0.01;

        // ✅ Yürüme animasyonu
        if (isMoving) {
            const time = Date.now() * 0.01;
            const angle = Math.sin(time) * 0.5;

            this.rightLegPivot.rotation.x = angle;
            this.leftLegPivot.rotation.x = -angle;
            this.rightArmPivot.rotation.x = -angle * 0.5;
            this.leftArmPivot.rotation.x = angle * 0.5;
        } else {
            // Duruyorsa normal poz
            this.rightLegPivot.rotation.x = 0;
            this.leftLegPivot.rotation.x = 0;
            this.rightArmPivot.rotation.x = 0;
            this.leftArmPivot.rotation.x = 0;
        }
    }

    addNameTag(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.font = "Bold 40px Arial";
        context.fillStyle = "white";
        context.textAlign = "center";
        context.strokeStyle = "black";
        context.lineWidth = 4;

        context.strokeText(name, 128, 40);
        context.fillText(name, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

        sprite.position.y = 2.5;
        sprite.scale.set(4, 1, 1);

        this.mesh.add(sprite);
    }

    delete() {
        this.scene.remove(this.mesh);
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}