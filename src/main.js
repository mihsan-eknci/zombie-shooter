import * as THREE from 'three';
import { Player } from './Player.js';
import { Bullet } from './Bullet.js';
import { Enemy } from './Enemy.js';
import { Particle } from './Particle.js';
import { Pickup } from './Pickup.js';
import { DamagePopup } from './DamagePopup.js';
import { SoundManager } from './SoundManager.js';
import { io } from "socket.io-client";

const CONFIG = {
  viewSize: 15,
  cameraOffset: 25,
  mapSize: 150,
  wallHeight: 5
};
let socket;
let myId = null;
let otherPlayers = {};
let serverEnemies = {};
let scene, camera, renderer, clock;
let player;
let raycaster, mouse, aimPlane;
let inputs = {};
let bullets = [];
let currentAimPoint = new THREE.Vector3();
let enemies = [];
let spawnTimer = 0;
let score = 0;
let isGameOver = false;
let isPaused = false;
let particles = [];
let wave = 1;
let waveZombieCount = 10;
let zombiesSpawned = 0;
let zombiesKilledInWave = 0;
let spawnRate = 2.0;
let pickups = [];
let damagePopups = [];
let soundManager;

init();
animate();

function init() {
    // --- STANDART THREE.JS KURULUMLARI ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xad8a6c);
    clock = new THREE.Clock();

    soundManager = new SoundManager();

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -CONFIG.viewSize * aspect, CONFIG.viewSize * aspect,
        CONFIG.viewSize, -CONFIG.viewSize,
        -2000, 10000
    );
    camera.position.set(CONFIG.cameraOffset, CONFIG.cameraOffset, CONFIG.cameraOffset);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Işıklar
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffaa33, 0.8);
    dirLight.position.set(50, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    const d = 500;
    dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Zemin
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('/ground.jpg');
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(40, 40);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
        new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    createWalls();

    // Local Oyuncuyu Yarat
    player = new Player(scene);
    setupInputs();

    window.addEventListener('resize', onWindowResize);
    updateUI();
    updateWeaponUI();

    document.querySelectorAll('.weapon-slot').forEach(slot => {
        slot.onclick = () => {
            const weaponType = slot.getAttribute('data-weapon');
            player.switchWeapon(weaponType);
            updateWeaponUI();
        };
    });

    // --- NETWORK BAĞLANTILARI (GÜNCELLENMİŞ HALİ) ---

    // Buraya kendi IP adresini yazmalısın (Örn: 'http://192.168.1.35:3000')
    socket = io('http://localhost:3000');

    // 1. Bağlantı kurulduğunda mevcut durumu al
    socket.on('init', (data) => {
        myId = data.id;

        // Oyuna girdiğimizde haritada zaten var olan düşmanları yarat
        if (data.enemies) {
            data.enemies.forEach(enemyData => createNetworkEnemy(enemyData));
        }
        // (Mevcut oyuncuları da burada looplayıp yaratabilirsin ama stateUpdate bunu zaten halleder)
    });

    // 2. Yeni bir oyuncu bağlandı
    socket.on('newPlayer', (playerData) => {
        createOtherPlayer(playerData);
    });

    // 3. Bir oyuncu çıktı
    socket.on('playerDisconnected', (id) => {
        if (otherPlayers[id]) {
            scene.remove(otherPlayers[id].mesh);
            delete otherPlayers[id];
        }
    });

    // 4. Sunucudan yeni bir zombi doğdu emri (ÖNEMLİ: Bunu ekledik)
    socket.on('enemySpawn', (enemyData) => {
        createNetworkEnemy(enemyData);
    });

    // 5. Oyun Durumu Güncellemesi (Her frame veya tickte gelir)
    socket.on('stateUpdate', (state) => {
        // A) Diğer Oyuncuları Güncelle
        Object.keys(state.players).forEach(id => {
            if (id !== myId) {
                if (!otherPlayers[id]) createOtherPlayer(state.players[id]);
                updateOtherPlayerPos(id, state.players[id]);
            }
        });

        // B) Düşman Pozisyonlarını Güncelle
        state.enemies.forEach(serverEnemy => {
            // Client'taki düşmanı ID ile bul
            const localEnemy = enemies.find(e => e.id === serverEnemy.id);

            if (localEnemy) {
                // Varsa hedefini güncelle (Enemy.js içindeki updateState)
                localEnemy.updateState(serverEnemy.x, serverEnemy.z);
            } else {
                // Senkron hatası olduysa ve düşman bizde yoksa yarat
                createNetworkEnemy(serverEnemy);
            }
        });
    });

    // 6. Düşman Öldü
    socket.on('enemyDied', (data) => {
        const index = enemies.findIndex(e => e.id === data.enemyId);
        if (index !== -1) {
            const enemy = enemies[index];

            // Efektler
            createExplosion(enemy.mesh.position, 0x8d6e63);
            soundManager.playZombieDeath();

            // Mesh'i sil
            enemy.kill();
            enemies.splice(index, 1);

            // Skoru güncelle (Basitlik için burada yapıyoruz, normalde server skor yollar)
            if (data.killerId === socket.id) {
                score += 10;
                updateUI();
            }
        }
    });
}
function createWalls() {
  const halfSize = CONFIG.mapSize / 2;
  const wallThickness = 2;
  const wallMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x5d4037,
    side: THREE.DoubleSide 
  });

  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.mapSize + wallThickness * 2, CONFIG.wallHeight, wallThickness),
    wallMaterial
  );
  northWall.position.set(0, CONFIG.wallHeight / 2, -halfSize);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  scene.add(northWall);

  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.mapSize + wallThickness * 2, CONFIG.wallHeight, wallThickness),
    wallMaterial
  );
  southWall.position.set(0, CONFIG.wallHeight / 2, halfSize);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  scene.add(southWall);

  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, CONFIG.wallHeight, CONFIG.mapSize),
    wallMaterial
  );
  westWall.position.set(-halfSize, CONFIG.wallHeight / 2, 0);
  westWall.castShadow = true;
  westWall.receiveShadow = true;
  scene.add(westWall);

  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, CONFIG.wallHeight, CONFIG.mapSize),
    wallMaterial
  );
  eastWall.position.set(halfSize, CONFIG.wallHeight / 2, 0);
  eastWall.castShadow = true;
  eastWall.receiveShadow = true;
  scene.add(eastWall);
}

function setupInputs() {
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  window.addEventListener('keydown', (e) => {
    inputs[e.key] = true;
    
    if (e.key === 'Escape') {
      togglePause();
      return;
    }
    
    // Silah değiştirme (1-2-3-4)
    if (e.key === '1') {
      player.switchWeapon('pistol');
      updateWeaponUI();
    }
    if (e.key === '2') {
      player.switchWeapon('shotgun');
      updateWeaponUI();
    }
    if (e.key === '3') {
      player.switchWeapon('rifle');
      updateWeaponUI();
    }
    if (e.key === '4') {
      player.switchWeapon('sniper');
      updateWeaponUI();
    }

    if ((e.key === 'r' || e.key === 'R') && player && !isPaused) {
      if (!player.isReloading) {
        soundManager.playReloadSound();
      }
      player.reload();
      updateUI();
    }
  });
  
  window.addEventListener('keyup', (e) => inputs[e.key] = false);

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && player && !isPaused) {
      if (player.canShoot()) {
        player.shoot();
        updateUI();

        const playerPos = player.getPosition();
        const spawnPos = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
        const direction = new THREE.Vector3()
          .subVectors(currentAimPoint, spawnPos)
          .normalize();
        direction.y = 0;

        // Silah özelliklerini al
        const weapon = player.getWeapon();
        
        // 🔊 ATEŞ SESİ
        soundManager.playShootSound(player.currentWeapon);
        
        // Pompalı için 4 mermi (bulletCount)
        const bulletCount = weapon.bulletCount || 1;
        
        for (let i = 0; i < bulletCount; i++) {
          // Her mermi için yön hesapla (spread varsa)
          const spreadAngle = weapon.bulletSpread || 0;
          const randomSpread = (Math.random() - 0.5) * spreadAngle;
          
          const bulletDir = direction.clone();
          bulletDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomSpread);
          
          // Mermiyi silah özellikleriyle oluştur
          const bullet = new Bullet(scene, spawnPos, bulletDir, {
            damage: weapon.damage,
            speed: weapon.bulletSpeed,
            color: weapon.bulletColor,
            size: weapon.bulletSize
          });
          bullets.push(bullet);
        }

        const flash = new THREE.PointLight(0xffff00, 2, 10);
        flash.position.copy(spawnPos);
        scene.add(flash);
        setTimeout(() => scene.remove(flash), 50);
      } else {
        if (player.ammo === 0 && !player.isReloading) {
          player.reload();
          updateUI();
        }
      }
    }
  });
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -CONFIG.viewSize * aspect;
  camera.right = CONFIG.viewSize * aspect;
  camera.top = CONFIG.viewSize;
  camera.bottom = -CONFIG.viewSize;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    // Oyun duraklatılmışsa render et ama güncelleme
    if (isPaused || isGameOver) {
        renderer.render(scene, camera);
        return;
    }

    // --- 1. LOCAL OYUNCU (SEN) ---
    if (player && !player.isDead) {
        player.update(dt, inputs);

        // Harita sınırları ve Kamera takibi
        const halfSize = CONFIG.mapSize / 2 - 1;
        const pPos = player.getPosition();
        if (pPos.x < -halfSize) pPos.x = -halfSize;
        if (pPos.x > halfSize) pPos.x = halfSize;
        if (pPos.z < -halfSize) pPos.z = -halfSize;
        if (pPos.z > halfSize) pPos.z = halfSize;

        camera.position.x = pPos.x + CONFIG.cameraOffset;
        camera.position.z = pPos.z + CONFIG.cameraOffset;

        // Mouse ile nişan alma
        raycaster.setFromCamera(mouse, camera);
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(aimPlane, intersection)) {
            player.lookAt(intersection);
            currentAimPoint.copy(intersection);
        }

        // [NETWORK] Hareketimizi Sunucuya Bildir
        // Sunucuya sadece pozisyon ve rotasyon gönderiyoruz
        if (socket) {
            socket.emit('playerInput', {
                x: player.mesh.position.x,
                z: player.mesh.position.z,
                rotation: player.mesh.rotation.y
            });
        }
    }

    // --- 2. DİĞER OYUNCULAR ---
    // Eğer NetworkPlayer sınıfında animasyon (lerp/bacak sallama) varsa update et
    Object.values(otherPlayers).forEach(otherPlayer => {
        if (otherPlayer.update) otherPlayer.update(dt);
    });

    // --- 3. DÜŞMANLAR (ENEMIES) ---
    // NOT: Burada spawnTimer, wave kontrolü veya saldırı mantığı YOK.
    // Hepsi sunucuda. Biz sadece sunucudan gelen hedefe doğru kaymasını (update) sağlıyoruz.
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(dt); // Artık playerPosition parametresi almıyor
    }

    // --- 4. MERMİLER VE VURUŞ SİSTEMİ ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update(dt);

        if (!b.isAlive) {
            bullets.splice(i, 1);
            continue;
        }

        let hitSomething = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];

            // Sadece görsel olarak yaşayan düşmanlara çarpabiliriz
            if (!enemy.isAlive) continue;

            const bulletPos = b.mesh.position;
            const enemyPos = enemy.mesh.position;
            const distance = bulletPos.distanceTo(enemyPos);

            // Hitbox boyutu
            let hitRadius = 1.5 * enemy.mesh.scale.x;
            if (enemy.type === 'runner') hitRadius = 2.0;

            if (distance < hitRadius) {
                // [NETWORK] Vurduğumuzu Sunucuya Söyle
                // Can azaltma işlemini (takeDamage) yapmıyoruz, sunucuya bildiriyoruz.
                if (socket) {
                    socket.emit('enemyHit', {
                        enemyId: enemy.id, // Enemy.js constructor'a id eklemiştik
                        damage: b.damage
                    });
                }

                // --- GÖRSEL GERİ BİLDİRİM (Client Side Prediction) ---
                // Oyuncu vurduğunu hemen hissetsin diye görsel efektleri burada yapıyoruz.

                // Kritik Vuruş Hesabı (Sadece görsel popup için)
                const isCritical = Math.random() < 0.05;
                const displayDamage = isCritical ? b.damage * 4 : b.damage;

                if (isCritical) soundManager.playCriticalHit();

                // Hasar Popup'ı
                const popup = new DamagePopup(scene, enemy.mesh.position, displayDamage, isCritical);
                damagePopups.push(popup);

                // Zombinin yanıp sönmesi
                enemy.flashMaterial(enemy.body.material);

                hitSomething = true;
                break; // Bir mermi tek düşmana değer
            }
        }

        if (hitSomething) {
            b.kill(); // Mermiyi yok et
            bullets.splice(i, 1);
        }
    }

    // --- 5. EFEKTLER (Particle, Popup, Pickup) ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update(dt);
        if (!p.isAlive) particles.splice(i, 1);
    }

    for (let i = damagePopups.length - 1; i >= 0; i--) {
        damagePopups[i].update(dt);
        if (!damagePopups[i].isAlive) damagePopups.splice(i, 1);
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        // Pickup toplama mantığını da sunucuya taşıyabilirsin ama
        // şimdilik görsel olarak dönmesini sağlıyoruz.
        p.mesh.rotation.y += dt;
        // p.update(dt, player...) fonksiyonunu kullanmıyoruz çünkü toplama sunucudan yönetilmeli
    }

    // --- 6. UI GÜNCELLEMELERİ ---
    if (player && !player.isReloading && document.getElementById('ammo-text').innerText === "DOLDURULUYOR...") {
        updateUI();
    }

    renderer.render(scene, camera);
}

function createNetworkEnemy(serverData) {
    if (!scene) return;

    // Sunucudan gelen pozisyonu al
    const spawnPos = new THREE.Vector3(serverData.x, 0, serverData.z);

    // Enemy sınıfını ID ile başlat (Önceki adımda Enemy.js'e ID parametresi eklemiştik)
    const enemy = new Enemy(scene, spawnPos, serverData.type, serverData.id);

    // Listeye ekle
    enemies.push(enemy);
}

function updateUI() {
  if (!player) return;
  
  const healthBar = document.getElementById('health-bar');
  if (healthBar) {
    const healthPercent = (player.health / player.maxHealth) * 100;
    healthBar.style.width = healthPercent + '%';
  }
  
  const ammoDiv = document.getElementById('ammo-text');
  if (ammoDiv) {
    const weapon = player.getWeapon();
    if (player.isReloading) {
      ammoDiv.innerText = "DOLDURULUYOR...";
      ammoDiv.style.color = "#ff0000";
    } else {
      ammoDiv.innerText = `${weapon.name.toUpperCase()}: ${player.ammo}/${weapon.clipSize}`;
      ammoDiv.style.color = "#ffd700";
    }
  }
  
  const scoreBox = document.getElementById('score-box');
  if (scoreBox) {
    scoreBox.innerText = score;
  }
  
  const waveInfo = document.getElementById('wave-info');
  if (waveInfo) {
    const remaining = waveZombieCount - zombiesKilledInWave;
    waveInfo.innerText = `DALGA: ${wave} | 🧟 KALAN: ${remaining}`;
  }
}

function updateWeaponUI() {
  const slots = document.querySelectorAll('.weapon-slot');
  slots.forEach(slot => {
    const weaponType = slot.getAttribute('data-weapon');
    if (weaponType === player.currentWeapon) {
      slot.classList.add('active');
    } else {
      slot.classList.remove('active');
    }
  });
}
function createOtherPlayer(data) {
    // Basit bir kapsül veya senin Player modelinin kopyası
    const geometry = new THREE.CapsuleGeometry(1, 2, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Diğerleri yeşil görünsün
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    otherPlayers[data.id] = { mesh: mesh };
}

function updateOtherPlayerPos(id, data) {
    if (otherPlayers[id]) {
        otherPlayers[id].mesh.position.set(data.x, 1, data.z);
        otherPlayers[id].mesh.rotation.y = data.rotation;
    }
}

function updateEnemyVisuals(serverEnemyData) {
    // Eğer bu ID'ye sahip bir düşman zaten sahnede yoksa oluştur
    let localEnemy = enemies.find(e => e.serverData && e.serverData.id === serverEnemyData.id);

    if (!localEnemy) {
        // Enemy.js sınıfını kullanarak görsel oluştur ama AI'ını kapat
        localEnemy = new Enemy(scene, new THREE.Vector3(serverEnemyData.x, 0, serverEnemyData.z), serverEnemyData.type);
        localEnemy.serverData = serverEnemyData; // ID'yi eşleştirmek için sakla
        enemies.push(localEnemy);
    } else {
        // Varsa pozisyonunu sunucudan gelenle eşle (Lerp kullanarak yumuşatabilirsin)
        localEnemy.mesh.position.x = serverEnemyData.x;
        localEnemy.mesh.position.z = serverEnemyData.z;

        // Yönünü de hareket ettiği yere çevirebilirsin
        localEnemy.mesh.lookAt(serverEnemyData.x, 0, serverEnemyData.z);
    }
}

function removeEnemy(id) {
    const index = enemies.findIndex(e => e.serverData.id === id);
    if (index > -1) {
        const enemy = enemies[index];
        createExplosion(enemy.mesh.position, 0xff0000); // Patlama efekti
        scene.remove(enemy.mesh); // Sahneden sil
        enemies.splice(index, 1); // Listeden sil
    }
}

function showGameOver() {
  document.getElementById('game-over').style.display = 'block';
  document.getElementById('final-score').innerText = 'Skorun: ' + score;
}

function startNextWave() {
  // 🔊 WAVE TAMAMLANDI SESİ
  soundManager.playWaveComplete();
  
  // Popup göster
  showWaveComplete();
  
  wave++;
  waveZombieCount += 5;
  spawnRate = Math.max(0.3, 2.0 - (wave * 0.15));
  zombiesSpawned = 0;
  zombiesKilledInWave = 0;
  player.health = Math.min(player.maxHealth, player.health + 20);
  updateUI();
}

function showWaveComplete() {
  const popup = document.getElementById('wave-complete');
  const nextWaveNum = document.getElementById('next-wave-num');
  
  if (!popup || !nextWaveNum) return;
  
  nextWaveNum.innerText = `DALGA ${wave + 1}`;
  popup.style.display = 'block';
  
  console.log(`🎉 Wave ${wave} tamamlandı! Sıradaki: ${wave + 1}`);
  
  // 2.5 saniye sonra gizle
  setTimeout(() => {
    popup.style.display = 'none';
  }, 2500);
}

function createExplosion(position, color) {
  for (let i = 0; i < 15; i++) {
    try {
      const p = new Particle(scene, position, color);
      particles.push(p);
    } catch (err) {
      console.warn('Particle oluşturulamadı:', err);
    }
  }
}

function tryDropPickup(position) {
  if (Math.random() < 0.3) {
    const type = Math.random() < 0.6 ? 'ammo' : 'health';
    const pickup = new Pickup(scene, position, type);
    pickups.push(pickup);
  }
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById('pause-menu').style.display = isPaused ? 'block' : 'none';
  document.body.style.cursor = isPaused ? 'default' : 'crosshair';
}

document.getElementById('resume-btn').onclick = togglePause;
document.getElementById('restart-btn-pause').onclick = () => location.reload();
document.getElementById('restart-btn').onclick = () => location.reload();