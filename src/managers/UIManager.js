/**
 * UIManager:
 * Oyun arayüzünü (HTML/DOM) günceller.
 */
export class UIManager {
    constructor(player) {
        this.player = player;

        this.healthBar = document.getElementById('health-bar');
        this.ammoText = document.getElementById('ammo-text');
        this.scoreBox = document.getElementById('score-box');
        this.waveInfo = document.getElementById('wave-info');
        this.weaponSlots = document.querySelectorAll('.weapon-slot');

        this.wavePopup = document.getElementById('wave-complete');
        this.nextWaveNum = document.getElementById('next-wave-num');
        this.gameOverPopup = document.getElementById('game-over');
        this.finalScore = document.getElementById('final-score');

        // --- EKLENEN KISIM: BUTON DİNLEYİCİLERİ ---

        // 1. Game Over ekranındaki 'TEKRAR DENE' butonu
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.onclick = () => location.reload(); // Sayfayı yeniler
        }

        // 2. Pause menüsündeki 'YENİDEN BAŞLA' butonu
        const pauseRestartBtn = document.getElementById('restart-btn-pause');
        if (pauseRestartBtn) {
            pauseRestartBtn.onclick = () => location.reload();
        }

        // 3. Pause menüsündeki 'DEVAM ET' butonu (Opsiyonel ama iyi olur)
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.onclick = () => {
                document.getElementById('pause-menu').style.display = 'none';
                // Game.js içindeki isPaused değişkenini dışarıdan değiştirmek için bir yol gerekebilir
                // veya oyuncu ESC'ye basarak devam edebilir.
            };
        }

        this.initWeaponSlots();
    }

    initWeaponSlots() {
        this.weaponSlots.forEach(slot => {
            slot.onclick = () => {
                const weaponType = slot.getAttribute('data-weapon');
                this.player.switchWeapon(weaponType);
                this.updateWeaponUI();
                this.updateAmmo();
            };
        });
    }

    update() {
        this.updateHealth();
        this.updateAmmo();
        this.updateWeaponUI();
    }

    updateHealth() {
        if (this.healthBar) {
            const healthPercent = (this.player.health / this.player.maxHealth) * 100;
            this.healthBar.style.width = healthPercent + '%';
        }
    }

    updateAmmo() {
        if (this.ammoText) {
            const weapon = this.player.getWeapon();
            if (this.player.isReloading) {
                this.ammoText.innerText = "DOLDURULUYOR...";
                this.ammoText.style.color = "#ff0000";
            } else {
                this.ammoText.innerText = `${weapon.name.toUpperCase()}: ${this.player.ammo}/${weapon.clipSize}`;
                this.ammoText.style.color = "#ffd700";
            }
        }
    }

    updateWeaponUI() {
        this.weaponSlots.forEach(slot => {
            const weaponType = slot.getAttribute('data-weapon');
            if (weaponType === this.player.currentWeapon) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }

    updateWaveInfo(wave, remainingZombies) {
        if (this.waveInfo) {
            this.waveInfo.innerText = `DALGA: ${wave} | 🧟 KALAN: ${remainingZombies}`;
        }
    }

    updateScore(score) {
        if (this.scoreBox) {
            this.scoreBox.innerText = score;
        }
    }

    // --- YENİ EKLENEN METOTLAR ---

    showWaveComplete(nextWave) {
        if (this.wavePopup && this.nextWaveNum) {
            this.nextWaveNum.innerText = nextWave;
            this.wavePopup.style.display = 'block';

            // 3 Saniye sonra gizle
            setTimeout(() => {
                this.wavePopup.style.display = 'none';
            }, 3000);
        }
    }

    showGameOver(score) {
        if (this.gameOverPopup && this.finalScore) {
            this.gameOverPopup.style.display = 'block';
            this.finalScore.innerText = 'Skorun: ' + score;
        }
    }
}