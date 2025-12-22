import * as THREE from 'three';

/**
 * World Sınıfı:
 * Oyun dünyasının fiziksel ortamını (Işıklar, Zemin, Duvarlar) yönetir.
 */
export class World {
    constructor(scene, config) {
        this.scene = scene;   // Three.js sahne referansı
        this.config = config; // Harita boyutları vb. ayarlar

        // Sınıf oluşturulur oluşturulmaz ortamı kur
        this.initEnvironment();
        this.createWalls();
    }

    initEnvironment() {
        // 1. Ortam Işığı (Genel aydınlatma)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        // 2. Yönlü Işık (Güneş gibi, gölge oluşturur)
        const dirLight = new THREE.DirectionalLight(0xffaa33, 0.8);
        dirLight.position.set(50, 200, 50);
        dirLight.castShadow = true;

        // Gölge haritası kalitesi
        dirLight.shadow.mapSize.set(2048, 2048);

        // Gölge kamerasının kapsama alanı (Genişletildi)
        const d = 500;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;

        this.scene.add(dirLight);

        // 3. Zemin (Ground)
        const textureLoader = new THREE.TextureLoader();
        // Texture yolunun '/ground.jpg' olduğuna emin ol (public klasöründe)
        const groundTexture = textureLoader.load('/ground.jpg');

        // Texture tekrar etme ayarları (Zemin döşemesi için)
        groundTexture.wrapS = THREE.RepeatWrapping;
        groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(40, 40);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(this.config.mapSize, this.config.mapSize),
            new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8 })
        );

        // Zemini yatay hale getir
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true; // Gölgeler üzerine düşsün
        this.scene.add(ground);
    }

    createWalls() {
        const halfSize = this.config.mapSize / 2;
        const wallThickness = 2;

        // Duvar materyali
        const wallMaterial = new THREE.MeshLambertMaterial({
            color: 0x5d4037,
            side: THREE.DoubleSide
        });

        // --- Kuzey Duvarı ---
        const northWall = new THREE.Mesh(
            new THREE.BoxGeometry(this.config.mapSize + wallThickness * 2, this.config.wallHeight, wallThickness),
            wallMaterial
        );
        northWall.position.set(0, this.config.wallHeight / 2, -halfSize);
        northWall.castShadow = true;
        northWall.receiveShadow = true;
        this.scene.add(northWall);

        // --- Güney Duvarı ---
        const southWall = new THREE.Mesh(
            new THREE.BoxGeometry(this.config.mapSize + wallThickness * 2, this.config.wallHeight, wallThickness),
            wallMaterial
        );
        southWall.position.set(0, this.config.wallHeight / 2, halfSize);
        southWall.castShadow = true;
        southWall.receiveShadow = true;
        this.scene.add(southWall);

        // --- Batı Duvarı ---
        const westWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, this.config.wallHeight, this.config.mapSize),
            wallMaterial
        );
        westWall.position.set(-halfSize, this.config.wallHeight / 2, 0);
        westWall.castShadow = true;
        westWall.receiveShadow = true;
        this.scene.add(westWall);

        // --- Doğu Duvarı ---
        const eastWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, this.config.wallHeight, this.config.mapSize),
            wallMaterial
        );
        eastWall.position.set(halfSize, this.config.wallHeight / 2, 0);
        eastWall.castShadow = true;
        eastWall.receiveShadow = true;
        this.scene.add(eastWall);
    }
}