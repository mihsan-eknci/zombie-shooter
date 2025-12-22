import * as THREE from 'three';

export class RemotePlayer {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;

        // --- Basit Model (Kırmızı Kutu) ---
        // İleride burayı Player.js'deki createModel ile değiştirip aynı görselliği vereceğiz.
        // Şimdilik ayırt etmek için kırmızı yapalım.
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Kırmızı
        this.mesh = new THREE.Mesh(geometry, material);

        this.mesh.position.set(initialData.x, initialData.y, initialData.z);

        //isimleri kafanın üzerinde göstermek için
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(initialData.x, initialData.y, initialData.z);

        // Silahı temsil eden küçük kutu
        const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 1.0);
        const gunMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        this.gun = new THREE.Mesh(gunGeo, gunMat);
        this.gun.position.set(0.3, 0.5, 0.5);
        this.mesh.add(this.gun);

        // --- YENİ: İSİM ETİKETİ (NAME TAG) ---
        if (initialData.name) {
            this.addNameTag(initialData.name);
        }

        scene.add(this.mesh);
    }

    updatePosition(data) {
        // Sunucudan gelen veriye göre pozisyonu güncelle
        // Hareketi yumuşatmak için (Interpolation) ileride 'lerp' kullanabiliriz.
        this.mesh.position.set(data.x, data.y, data.z);
        this.mesh.rotation.y = data.rotation || 0;
    }

    addNameTag(name) {
        // 1. Canvas oluştur
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        // 2. Yazıyı çiz
        context.font = "Bold 40px Arial";
        context.fillStyle = "white";
        context.textAlign = "center";
        context.strokeStyle = "black";
        context.lineWidth = 4;

        // Yazının kenarlıkları (Okunabilirlik için)
        context.strokeText(name, 128, 40);
        context.fillText(name, 128, 40);

        // 3. Texture ve Sprite oluştur
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

        // 4. Konumlandır (Karakterin kafasının üstü)
        sprite.position.y = 2.5;
        sprite.scale.set(4, 1, 1); // Boyut ayarı

        this.mesh.add(sprite);
    }

    delete() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}