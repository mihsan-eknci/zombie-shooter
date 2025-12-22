import * as THREE from 'three';

export class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = new THREE.Vector2();
        this.isMouseDown = false;

        // Event dinleyicilerini başlat
        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', () => this.isMouseDown = true);
        window.addEventListener('mouseup', () => this.isMouseDown = false);
    }

    onMouseMove(e) {
        // Mouse pozisyonunu normalize et (-1 ile +1 arası)
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    isKeyPressed(key) {
        return !!this.keys[key];
    }

    // Multiplayer için: Girdileri paketleyip sunucuya atmak için bir metot
    getInputState() {
        return {
            keys: this.keys,
            mouse: this.mouse,
            isShooting: this.isMouseDown
        };
    }
}