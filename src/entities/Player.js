import * as THREE from 'three';

export class Player {
    constructor(scene, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.speed = 10;
        this.maxHealth = 100;
        this.health = 100;
        this.isDead = false;

        // --- SİLAH SİSTEMİ ---
        this.weapons = {
            pistol: {
                name: 'Desert Eagle', damage: 10, clipSize: 15, currentAmmo: 15,
                reserveAmmo: 60, maxReserveAmmo: 150, reloadTime: 1.5, fireRate: 0.4,
                bulletCount: 1, bulletSpeed: 50, bulletColor: 0xffd700, bulletSize: 0.25,
                color: 0x708090, size: { w: 0.12, h: 0.12, l: 0.8 }
            },
            shotgun: {
                name: 'Pompalı', damage: 7, clipSize: 8, currentAmmo: 8,
                reserveAmmo: 40, maxReserveAmmo: 80, reloadTime: 2.5, fireRate: 1.0,
                bulletCount: 4, bulletSpread: 0.6, bulletSpeed: 35, bulletColor: 0xff8c00, bulletSize: 0.35,
                color: 0x8b4513, size: { w: 0.15, h: 0.15, l: 1.0 }
            },
            rifle: {
                name: 'AK-47', damage: 4, clipSize: 30, currentAmmo: 30,
                reserveAmmo: 120, maxReserveAmmo: 300, reloadTime: 2.0, fireRate: 0.08,
                bulletCount: 1, bulletSpread: 0.05, bulletSpeed: 60, bulletColor: 0xff4500, bulletSize: 0.2,
                color: 0x2a2a2a, size: { w: 0.13, h: 0.13, l: 1.2 }
            },
            sniper: {
                name: 'AWP', damage: 40, clipSize: 5, currentAmmo: 5,
                reserveAmmo: 20, maxReserveAmmo: 50, reloadTime: 3.0, fireRate: 2.0,
                bulletCount: 1, bulletSpeed: 100, bulletColor: 0x00bfff, bulletSize: 0.3,
                color: 0x654321, size: { w: 0.10, h: 0.10, l: 1.5 }
            }
        };

        this.currentWeapon = 'pistol';
        this.isReloading = false;
        this.lastShotTime = 0;

        this.mesh = new THREE.Group();
        this.createModel();
        scene.add(this.mesh);
    }

    createModel() {
        const skinColor = 0xffccaa;
        const shirtColor = 0x0088ff;
        const pantsColor = 0x1a237e;

        // Gövde
        this.body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: shirtColor }));
        this.body.position.y = 1.0;
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // Kafa
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: skinColor }));
        this.head.position.y = 0.6;
        this.head.castShadow = true;
        this.body.add(this.head);

        // Sağ Kol (Silah Tutan)
        this.rightArmPivot = new THREE.Group();
        this.rightArmPivot.position.set(0.45, 0.3, 0);
        this.body.add(this.rightArmPivot);

        this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshLambertMaterial({ color: skinColor }));
        this.rightArm.position.y = -0.35;
        this.rightArm.castShadow = true;
        this.rightArmPivot.add(this.rightArm);

        // Silah
        this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.8), new THREE.MeshLambertMaterial({ color: this.weapons.pistol.color }));
        this.gun.position.set(0.1, -0.25, 0.6);
        this.gun.rotation.x = Math.PI / 12;
        this.rightArmPivot.add(this.gun);

        // Sol Kol
        this.leftArmPivot = new THREE.Group();
        this.leftArmPivot.position.set(-0.45, 0.3, 0);
        this.body.add(this.leftArmPivot);
        this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshLambertMaterial({ color: skinColor }));
        this.leftArm.position.y = -0.35;
        this.leftArmPivot.add(this.leftArm);

        // Bacaklar
        this.rightLegPivot = new THREE.Group();
        this.rightLegPivot.position.set(0.15, -0.35, 0);
        this.body.add(this.rightLegPivot);
        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), new THREE.MeshLambertMaterial({ color: pantsColor }));
        this.rightLeg.position.y = -0.35;
        this.rightLegPivot.add(this.rightLeg);

        this.leftLegPivot = new THREE.Group();
        this.leftLegPivot.position.set(-0.15, -0.35, 0);
        this.body.add(this.leftLegPivot);
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), new THREE.MeshLambertMaterial({ color: pantsColor }));
        this.leftLeg.position.y = -0.35;
        this.leftLegPivot.add(this.leftLeg);
    }

    getWeapon() {
        return this.weapons[this.currentWeapon];
    }

    switchWeapon(weaponName) {
        if (this.weapons[weaponName] && weaponName !== this.currentWeapon) {
            this.currentWeapon = weaponName;
            const weapon = this.weapons[weaponName];

            this.isReloading = false;
            this.gun.material.color.setHex(weapon.color);
            this.gun.geometry.dispose();
            this.gun.geometry = new THREE.BoxGeometry(weapon.size.w, weapon.size.h, weapon.size.l);

            if (this.soundManager) this.soundManager.playWeaponSwitch();
            console.log(`✅ ${weapon.name} seçildi!`);
        }
    }

    // ⚠️ HATALI KISIM DÜZELTİLDİ: getOldPosition update'in dışına alındı
    getOldPosition() {
        return this.mesh.position.clone();
    }

    update(dt, inputs) {
        if (this.isDead) return;

        const moveDir = new THREE.Vector3(0, 0, 0);

        if (inputs['w'] || inputs['W']) { moveDir.x -= 1; moveDir.z -= 1; }
        if (inputs['s'] || inputs['S']) { moveDir.x += 1; moveDir.z += 1; }
        if (inputs['a'] || inputs['A']) { moveDir.x -= 1; moveDir.z += 1; }
        if (inputs['d'] || inputs['D']) { moveDir.x += 1; moveDir.z -= 1; }

        if (moveDir.length() > 0) {
            moveDir.normalize();
            this.mesh.position.x += moveDir.x * this.speed * dt;
            this.mesh.position.z += moveDir.z * this.speed * dt;

            // Sınırlar
            const limit = 73;
            if (this.mesh.position.x > limit) this.mesh.position.x = limit;
            if (this.mesh.position.x < -limit) this.mesh.position.x = -limit;
            if (this.mesh.position.z > limit) this.mesh.position.z = limit;
            if (this.mesh.position.z < -limit) this.mesh.position.z = -limit;

            // Yürüme Animasyonu
            const time = Date.now() * 0.015;
            const angle = Math.sin(time) * 0.5;
            this.rightLegPivot.rotation.x = angle;
            this.leftLegPivot.rotation.x = -angle;
            this.rightArmPivot.rotation.x = 0;
            this.leftArmPivot.rotation.x = angle * 0.5;
        } else {
            // Durma Animasyonu
            this.rightLegPivot.rotation.x = 0;
            this.leftLegPivot.rotation.x = 0;
            this.leftArmPivot.rotation.x = 0;
            this.rightArmPivot.rotation.x = 0;
        }
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;

        this.body.material.color.setHex(0xff0000);
        setTimeout(() => {
            if (!this.isDead) this.body.material.color.setHex(0x0088ff);
        }, 100);

        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.mesh.rotation.x = -Math.PI / 2;
            this.mesh.position.y = 0.2;
            this.body.material.color.setHex(0x555555);
        }
    }

    canShoot() {
        const weapon = this.getWeapon();
        const currentTime = Date.now() / 1000;
        return !this.isReloading && !this.isDead && (currentTime - this.lastShotTime >= weapon.fireRate);
    }

    shoot() {
        const weapon = this.getWeapon();
        if (weapon.currentAmmo > 0) {
            weapon.currentAmmo--;
            this.lastShotTime = Date.now() / 1000;
            return true;
        }
        return false;
    }

    reload() {
        const weapon = this.getWeapon();
        if (this.isReloading) return;
        if (weapon.currentAmmo === weapon.clipSize) return;
        if (weapon.reserveAmmo === 0) return;

        this.isReloading = true;
        const originalRot = this.rightArmPivot.rotation.x;
        this.rightArmPivot.rotation.x = 0;

        setTimeout(() => {
            const neededAmmo = weapon.clipSize - weapon.currentAmmo;
            const ammoToTake = Math.min(neededAmmo, weapon.reserveAmmo);

            weapon.currentAmmo += ammoToTake;
            weapon.reserveAmmo -= ammoToTake;

            this.isReloading = false;
            this.rightArmPivot.rotation.x = originalRot;
            console.log("Reload Tamamlandı");
        }, weapon.reloadTime * 1000);
    }

    lookAt(targetPoint) {
        if (this.isDead) return;
        this.mesh.lookAt(targetPoint.x, this.mesh.position.y, targetPoint.z);
    }

    getPosition() {
        return this.mesh.position;
    }
}