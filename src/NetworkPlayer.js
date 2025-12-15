// src/NetworkPlayer.js
import * as THREE from 'three';

export class NetworkPlayer {
    constructor(scene, id) {
        this.scene = scene;
        this.id = id;

        // --- GÖRSEL KISIM (Player.js'den Kopyala/Yapıştır) ---
        // Sadece Mesh oluşturma kısmını alıyoruz.
        // Silah mantığına, cana vs. gerek yok, sadece görsel.

        this.mesh = new THREE.Group();

        const skinColor = 0xffccaa;
        const shirtColor = 0x00ff00; // DİKKAT: Diğer oyuncular YEŞİL görünsün ki ayırt et.
        const pantsColor = 0x1a237e;

        // ... (Player.js'deki bodyGeo, headGeo, armGeo kısımlarını buraya yapıştır) ...
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
        const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 1.0;
        this.mesh.add(this.body);

        // (Kısalttım, sen Player.js'deki tüm mesh yapısını buraya al)
        // ...

        scene.add(this.mesh);

        // Hedef pozisyon ve rotasyon
        this.targetPos = new THREE.Vector3(0, 0, 0);
        this.targetRot = 0;
    }

    // Sunucudan gelen veriyi işle
    updateState(x, z, rotation) {
        this.targetPos.set(x, 0, z);
        this.targetRot = rotation;
    }

    update(dt) {
        // Yumuşak geçiş (Interpolation)
        this.mesh.position.lerp(this.targetPos, 15 * dt);

        // Rotasyon için basit bir yaklaşım (Quaternion slerp daha iyidir ama bu yeterli)
        this.mesh.rotation.y = this.targetRot;

        // Yürüme animasyonu (Basit versiyon)
        const speed = this.mesh.position.distanceTo(this.targetPos) / dt;
        if (speed > 1.0) {
            const time = Date.now() * 0.015;
            // Animasyon kodlarını (bacak sallama) buraya ekleyebilirsin
        }
    }

    remove() {
        this.scene.remove(this.mesh);
    }
}