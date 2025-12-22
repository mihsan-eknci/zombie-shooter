// src/Main.js
import { Game } from './core/Game.js';
import { io } from 'socket.io-client';

// Socket bağlantısını oluştur (Ama henüz veri göndermiyoruz)
const socket = io('http://localhost:3000');

window.onload = () => {
  // 1. Oyunu Oluştur (Ama başlatma!)
  // Game sınıfına 'false' parametresi göndererek otomatik başlamayı engellemek isteyebiliriz
  // Ama şimdilik Game.js içinde düzenleme yapacağız.
  const game = new Game(socket);

  // 2. HTML Elemanlarını Seç
  const menuScreen = document.getElementById('menu-screen');
  const uiLayer = document.getElementById('ui-layer');
  const nameInput = document.getElementById('player-name-input');

  // 3. Mod Başlatma Fonksiyonu
  const startGame = (mode) => {
    const playerName = nameInput.value.trim() || `Player_${Math.floor(Math.random() * 1000)}`;

    console.log(`🎮 Oyun Başlatılıyor: ${mode} - İsim: ${playerName}`);

    // Menüyü Gizle, Oyun UI'ını Göster
    menuScreen.style.display = 'none';
    uiLayer.style.display = 'block';

    // Game.js içindeki start fonksiyonunu çağır
    game.start(mode, playerName);
  };

  // 4. Buton Dinleyicileri
  document.getElementById('btn-single').onclick = () => startGame('single');
  document.getElementById('btn-coop').onclick = () => startGame('coop');
  document.getElementById('btn-pvp').onclick = () => startGame('pvp');
};