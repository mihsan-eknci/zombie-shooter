// src/entities/Obstacle.js
import * as THREE from 'three';

export class Obstacle {
    constructor(scene, position, type = 'box') {
        this.scene = scene;
        this.type = type;
        this.mesh = null;
        this.boundingBox = null;

        this.createObstacle(position, type);
    }

    createObstacle(position, type) {
        let geometry, material, width, height, depth;

        switch(type) {
            case 'box':
                width = 2 + Math.random() * 1;
                height = 1.5 + Math.random() * 1;
                depth = 2 + Math.random() * 1;
                geometry = new THREE.BoxGeometry(width, height, depth);
                material = new THREE.MeshLambertMaterial({
                    color: 0x8b4513,
                    roughness: 0.9
                });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.position.y = height / 2;
                break;

            case 'barrel':
                const radius = 0.5;
                height = 1.2;
                geometry = new THREE.CylinderGeometry(radius, radius, height, 12);
                material = new THREE.MeshLambertMaterial({ color: 0x555555 });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.position.y = height / 2;
                break;

            case 'wall':
                width = 4;
                height = 1.5;
                depth = 0.5;
                geometry = new THREE.BoxGeometry(width, height, depth);
                material = new THREE.MeshLambertMaterial({
                    color: 0x6d4c41,
                    roughness: 0.8
                });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.position.y = height / 2;
                this.mesh.rotation.y = Math.random() * Math.PI;
                break;

            case 'rock':
                const size = 1.5 + Math.random() * 1;
                geometry = new THREE.DodecahedronGeometry(size, 0);
                material = new THREE.MeshLambertMaterial({
                    color: 0x757575,
                    flatShading: true
                });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.position.y = size * 0.7;
                this.mesh.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                break;

            case 'pillar':
                width = 0.8;
                height = 3;
                depth = 0.8;
                geometry = new THREE.BoxGeometry(width, height, depth);
                material = new THREE.MeshLambertMaterial({ color: 0x424242 });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.position.y = height / 2;
                break;

            default:
                width = 2;
                height = 2;
                depth = 2;
                geometry = new THREE.BoxGeometry(width, height, depth);
                material = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(position);
                this.mesh.position.y = height / 2;
        }

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.updateBoundingBox();
        this.scene.add(this.mesh);
    }

    updateBoundingBox() {
        const box = new THREE.Box3().setFromObject(this.mesh);
        this.boundingBox = {
            min: { x: box.min.x, z: box.min.z },
            max: { x: box.max.x, z: box.max.z }
        };
    }

    checkCollision(position, radius = 0.5) {
        return (
            position.x + radius > this.boundingBox.min.x &&
            position.x - radius < this.boundingBox.max.x &&
            position.z + radius > this.boundingBox.min.z &&
            position.z - radius < this.boundingBox.max.z
        );
    }

    resolveCollision(oldPos, newPos, radius = 0.5) {
        const resolvedPos = newPos.clone();

        if (this.checkCollision(new THREE.Vector3(newPos.x, 0, oldPos.z), radius)) {
            resolvedPos.x = oldPos.x;
        }

        if (this.checkCollision(new THREE.Vector3(resolvedPos.x, 0, newPos.z), radius)) {
            resolvedPos.z = oldPos.z;
        }

        return resolvedPos;
    }

    delete() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

export class ObstacleManager {
    constructor(scene, mapSize) {
        this.scene = scene;
        this.mapSize = mapSize;
        this.obstacles = [];
    }

    generateObstacles(count = 20) {
        const types = ['box', 'barrel', 'wall', 'rock', 'pillar'];
        const halfSize = this.mapSize / 2 - 10;

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * halfSize * 2;
            const z = (Math.random() - 0.5) * halfSize * 2;

            if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

            const position = new THREE.Vector3(x, 0, z);
            const type = types[Math.floor(Math.random() * types.length)];

            const obstacle = new Obstacle(this.scene, position, type);
            this.obstacles.push(obstacle);
        }

        console.log(`✅ ${this.obstacles.length} engel oluşturuldu!`);
    }

    addObstacle(position, type = 'box') {
        const obstacle = new Obstacle(this.scene, position, type);
        this.obstacles.push(obstacle);
        return obstacle;
    }

    checkCollision(position, radius = 0.5) {
        for (const obstacle of this.obstacles) {
            if (obstacle.checkCollision(position, radius)) {
                return obstacle;
            }
        }
        return null;
    }

    resolveMovement(oldPos, newPos, radius = 0.5) {
        let resolvedPos = newPos.clone();

        for (const obstacle of this.obstacles) {
            if (obstacle.checkCollision(resolvedPos, radius)) {
                resolvedPos = obstacle.resolveCollision(oldPos, resolvedPos, radius);
            }
        }

        return resolvedPos;
    }

    clear() {
        for (const obstacle of this.obstacles) {
            obstacle.delete();
        }
        this.obstacles = [];
    }
}