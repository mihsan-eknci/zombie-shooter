// src/Player.js
import * as THREE from 'three';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.speed = 10; // Hareket hızı
        this.maxHealth = 100;
        this.health = 100;
        this.isDead = false;
        // --- ŞARJÖR AYARLARI ---
        this.clipSize = 30;      // Bir şarjör kaç mermi alıyor?
        this.ammo = 30;          // Şu anki mermi
        this.reloadTime = 1.5;   // Şarjör değiştirme süresi (saniye)
        this.isReloading = false; // Şu an değiştiriyor mu?

        // Karakter Grubu (Gövde + Kafa + Silah)
        this.mesh = new THREE.Group();

        // Gövde
        const bodyGeo = new THREE.BoxGeometry(1, 1.8, 0.5);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.9;
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // Silah (Nereye baktığını görmek için şart)
        const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 1.5);
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        this.gun = new THREE.Mesh(gunGeo, gunMat);
        this.gun.position.set(0.3, 1.2, 0.5); // Sağ elde ve öne doğru
        this.gun.castShadow = true;
        this.mesh.add(this.gun);

        // Sahneye ekle
        scene.add(this.mesh);
    }

    update(dt, inputs) {
        // --- HAREKET MANTIĞI ---
        const moveDir = new THREE.Vector3(0, 0, 0);

        // Türkçe klavye uyumu için hem küçük hem büyük harf kontrolü veya KeyCode kullanımı
        if (inputs['w'] || inputs['W']) moveDir.z -= 1;
        if (inputs['s'] || inputs['S']) moveDir.z += 1;
        if (inputs['a'] || inputs['A']) moveDir.x -= 1;
        if (inputs['d'] || inputs['D']) moveDir.x += 1;

        // Vektör varsa hareket et
        if (moveDir.length() > 0) {
            moveDir.normalize(); // Çapraz gidince hızlanmayı önler

            // dt (delta time) ile çarparak her bilgisayarda aynı hızda gitmesini sağla
            this.mesh.position.x += moveDir.x * this.speed * dt;
            this.mesh.position.z += moveDir.z * this.speed * dt;

            // Ufak bir yaylanma efekti (Yürürken sallanma)
            this.mesh.position.y = Math.sin(Date.now() * 0.015) * 0.1;
        }
    }

    // Sınıfın içine (update fonksiyonunun altına) yeni bir metod ekle:
    takeDamage(amount) {
        if (this.isDead) return;

        this.health -= amount;

        // Can 0'ın altına düşmesin
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            // Ölünce karakteri kırmızı yapalım veya yere yatıralım
            this.body.material.color.setHex(0x555555); // Griye dönsün
        }
    }

    // Ateş edebilir miyiz kontrolü
    canShoot() {
        return this.ammo > 0 && !this.isReloading && !this.isDead;
    }

    // Ateş edince mermiyi düş
    shoot() {
        this.ammo--;
    }

    // Şarjör Değiştirme (Reload)
    reload() {
        if (this.isReloading || this.ammo === this.clipSize) return; // Zaten doluyken veya değiştirirken yapma

        this.isReloading = true;
        console.log("Şarjör değiştiriliyor...");

        // Basit bir zamanlayıcı (setTimeout yerine oyun döngüsünde de yapılabilir ama bu daha pratik)
        setTimeout(() => {
            this.ammo = this.clipSize; // Mermiyi fulle
            this.isReloading = false;
            console.log("Şarjör dolu!");
        }, this.reloadTime * 1000); // Saniyeyi milisaniyeye çevir
    }

    // Karakterin mouse'a bakması
    lookAt(targetPoint) {
        this.mesh.lookAt(targetPoint.x, this.mesh.position.y, targetPoint.z);
    }

    // Pozisyonu dışarıdan okumak için
    getPosition() {
        return this.mesh.position;
    }
}