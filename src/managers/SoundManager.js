// src/SoundManager.js
export class SoundManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = 0.3; // Ana ses seviyesi
    }

    // Temel ses oluşturucu
    playTone(frequency, duration, type = 'sine', volume = 1.0) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.value = volume * this.masterVolume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // ATEŞ SESLERİ (Silaha göre farklı)
    playShootSound(weaponType) {
        switch(weaponType) {
            case 'pistol':
                // Keskin, tek atış
                this.playTone(200, 0.1, 'square', 0.4);
                setTimeout(() => this.playTone(150, 0.05, 'square', 0.2), 50);
                break;

            case 'shotgun':
                // Derin, güçlü patlama
                this.playTone(80, 0.15, 'sawtooth', 0.6);
                this.playTone(60, 0.2, 'square', 0.3);
                break;

            case 'rifle':
                // Hızlı, keskin
                this.playTone(250, 0.08, 'square', 0.3);
                setTimeout(() => this.playTone(200, 0.04, 'square', 0.15), 40);
                break;

            case 'sniper':
                // Çok güçlü, yankılı
                this.playTone(100, 0.25, 'sawtooth', 0.7);
                setTimeout(() => this.playTone(80, 0.2, 'sine', 0.4), 100);
                setTimeout(() => this.playTone(60, 0.15, 'sine', 0.2), 200);
                break;
        }
    }

    // RELOAD SESİ
    playReloadSound() {
        // Mekanik ses - klik klak
        this.playTone(300, 0.05, 'square', 0.3);
        setTimeout(() => this.playTone(250, 0.05, 'square', 0.3), 100);
        setTimeout(() => this.playTone(350, 0.08, 'square', 0.4), 200);
    }

    // ✅ YENİ: SİLAH DEĞİŞTİRME SESİ
    playWeaponSwitch() {
        // Metalik "click-clack" sesi
        this.playTone(400, 0.06, 'square', 0.3);
        setTimeout(() => this.playTone(350, 0.04, 'square', 0.25), 60);
        setTimeout(() => this.playTone(450, 0.05, 'square', 0.2), 120);
    }

    // ZOMBİ ÖLÜM SESİ
    playZombieDeath() {
        // Düşen ses (yüksekten alçağa)
        const startTime = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, startTime + 0.5);

        gainNode.gain.value = 0.4 * this.masterVolume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.5);
    }

    // OYUNCU HASAR SESİ
    playPlayerHurt() {
        // Acı sesi (düşük, titreşimli)
        this.playTone(150, 0.2, 'sawtooth', 0.5);
        setTimeout(() => this.playTone(120, 0.15, 'square', 0.4), 100);
    }

    // PICKUP ALMA SESİ
    playPickupSound(type) {
        if (type === 'health') {
            // Pozitif, yükselen ses
            this.playTone(400, 0.1, 'sine', 0.4);
            setTimeout(() => this.playTone(500, 0.1, 'sine', 0.4), 80);
            setTimeout(() => this.playTone(600, 0.15, 'sine', 0.5), 160);
        } else if (type === 'ammo') {
            // Metalik ses
            this.playTone(300, 0.1, 'square', 0.4);
            setTimeout(() => this.playTone(350, 0.1, 'square', 0.4), 80);
        }
    }

    // KRİTİK VURUŞ SESİ
    playCriticalHit() {
        // Güçlü, dramatik ses
        this.playTone(600, 0.08, 'square', 0.6);
        setTimeout(() => this.playTone(800, 0.08, 'square', 0.6), 50);
        setTimeout(() => this.playTone(1000, 0.1, 'sine', 0.7), 100);
    }

    // WAVE TAMAMLANDI SESİ
    playWaveComplete() {
        // Zafer müziği (kısa)
        this.playTone(400, 0.15, 'sine', 0.5);
        setTimeout(() => this.playTone(500, 0.15, 'sine', 0.5), 150);
        setTimeout(() => this.playTone(600, 0.15, 'sine', 0.5), 300);
        setTimeout(() => this.playTone(800, 0.25, 'sine', 0.6), 450);
    }

    // GAME OVER SESİ
    playGameOver() {
        // Düşen, dramatik ses
        this.playTone(300, 0.3, 'sawtooth', 0.6);
        setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.5), 300);
        setTimeout(() => this.playTone(100, 0.5, 'sine', 0.4), 600);
    }

    // Ses açma/kapama
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
}