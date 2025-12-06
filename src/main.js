import * as THREE from 'three';
import { Player } from './Player.js'; // Player sınıfını içeri aktardık
import { Bullet } from './Bullet.js';
import { Enemy } from './Enemy.js';
import { Particle } from './Particle.js';
import { Pickup } from './Pickup.js';

// --- AYARLAR ---
const CONFIG = {
  viewSize: 20,
  cameraOffset: 100
};

// --- DEĞİŞKENLER ---
let scene, camera, renderer, clock;
let player; // Artık bir Player nesnesi olacak
let raycaster, mouse, aimPlane;
let inputs = {}; // Tuşları tutan obje
let bullets = []; // Mermileri tutan liste
let currentAimPoint = new THREE.Vector3(); // Farenin 3D dünyadaki yeri
let enemies = []; // Zombileri tutan liste
let spawnTimer = 0; // Zombi doğma sayacı
let score = 0;
let isGameOver = false; // Oyun bitti mi kontrolü
let particles = []; // Efekt parçacıkları
// --- DALGA SİSTEMİ DEĞİŞKENLERİ (YENİ) ---
let wave = 1;
let waveZombieCount = 10; // Bu dalgada toplam kaç zombi çıkacak?
let zombiesSpawned = 0;   // Şu ana kadar kaç tane doğdu?
let zombiesKilledInWave = 0; // Bu dalgada kaç tane öldürdük?
let spawnRate = 2.0;      // Kaç saniyede bir doğsun?
let pickups = []; // Yerdeki eşyalar

init();
animate();

function init() {
  // 1. Temel Kurulum
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xad8a6c);
  clock = new THREE.Clock();

  // 2. Kamera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    -CONFIG.viewSize * aspect, CONFIG.viewSize * aspect,
    CONFIG.viewSize, -CONFIG.viewSize,
    -2000, 10000
  );
  camera.position.set(CONFIG.cameraOffset, CONFIG.cameraOffset, CONFIG.cameraOffset);
  camera.lookAt(0, 0, 0);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // 4. Işıklar
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

  // 5. Zemin (Texture ile)
  const textureLoader = new THREE.TextureLoader();
  const groundTexture = textureLoader.load('/ground.jpg'); // public klasöründen çeker

  // Texture ayarları (Sonsuz gibi görünmesi için tekrar ettiriyoruz)
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  // Harita ne kadar büyükse o kadar çok tekrar etsin (20x20 kere)
  groundTexture.repeat.set(20, 20);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.8, // Çok parlamasın
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // 6. OYUNCUYU OLUŞTUR
  player = new Player(scene);

  // 7. Input Ayarları
  setupInputs();

  window.addEventListener('resize', onWindowResize);
  updateUI(); // Başlangıçta UI'ı resetle
}

function setupInputs() {
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Tuş basılınca inputs objesine kaydet
  window.addEventListener('keydown', (e) => {
    inputs[e.key] = true;

    // 'R' tuşuna basılırsa reload yap
    if ((e.key === 'r' || e.key === 'R') && player) {
      player.reload();
      updateUI(); // UI'da "Dolduruluyor..." yazısı için
    }
  });
  window.addEventListener('keyup', (e) => inputs[e.key] = false);

  // Fare hareket edince pozisyonunu güncelle
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // ATEŞ ETME (Sol Tık) - ŞARJÖR KONTROLLÜ
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && player) {
      // Önce mermi var mı kontrol et
      if (player.canShoot()) {
        player.shoot(); // Mermiyi azalt
        updateUI();     // UI güncelle

        // --- Mermi Oluşturma Kodları (Aynı) ---
        const playerPos = player.getPosition();
        const spawnPos = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);

        const direction = new THREE.Vector3()
          .subVectors(currentAimPoint, spawnPos)
          .normalize();
        direction.y = 0;

        const bullet = new Bullet(scene, spawnPos, direction);
        bullets.push(bullet);

        // Namlu Ateşi
        const flash = new THREE.PointLight(0xffff00, 2, 10);
        flash.position.copy(spawnPos);
        scene.add(flash);
        setTimeout(() => scene.remove(flash), 50);

      } else {
        // Mermi yoksa ve reload yapmıyorsa otomatik reload yapalım mı?
        // Veya "tık tık" sesi çıkarabiliriz.
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

  // 1. OYUNCU GÜNCELLEME
  if (player) {
    player.update(dt, inputs);

    const pPos = player.getPosition();
    camera.position.x = pPos.x + CONFIG.cameraOffset;
    camera.position.z = pPos.z + CONFIG.cameraOffset;

    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(aimPlane, intersection)) {
      player.lookAt(intersection);
      currentAimPoint.copy(intersection);
    }
  }

  // 2. ZOMBİ DOĞURMA (SPAWN) MANTIĞI
  // 2. GELİŞMİŞ DALGA VE SPAWN MANTIĞI

  // Eğer bu dalgadaki tüm zombiler öldüyse -> YENİ DALGA
  if (zombiesKilledInWave >= waveZombieCount) {
    startNextWave();
  }

  // Hala doğacak zombi varsa ve zamanı geldiyse -> DOĞUR
  if (zombiesSpawned < waveZombieCount) {
    spawnTimer += dt;
    if (spawnTimer > spawnRate) {
      spawnTimer = 0;
      spawnEnemy();
      zombiesSpawned++;
    }
  }

  // Oyun bittiyse döngüyü durdurma, sadece güncelleme yapma
  if (isGameOver) return;

  // 3. ZOMBİLERİ GÜNCELLE
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt, player.getPosition());

    // ZOMBİ SALDIRISI
    const distToPlayer = enemy.mesh.position.distanceTo(player.getPosition());

    // 1.2 birim yakındaysa ve son saldırıdan beri 1 saniye geçtiyse
    if (distToPlayer < 1.2) {
      // Zombinin içine 'lastAttackTime' diye bir özellik ekliyoruz (anlık olarak)
      if (!enemy.lastAttackTime || clock.getElapsedTime() - enemy.lastAttackTime > 1.0) {
        player.takeDamage(10); // 10 Can azalt
        enemy.lastAttackTime = clock.getElapsedTime(); // Saldırı zamanını kaydet

        // UI Güncelle
        updateUI();

        // ÖLDÜ MÜ?
        if (player.isDead) {
          isGameOver = true;
          showGameOver();
        }
      }
    }
  }
  // 4. MERMİLER VE SKOR
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update(dt);
    let hitSomething = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (!enemy.isAlive) { enemies.splice(j, 1); continue; }
      const hitRadius = enemy.mesh.scale.x * 0.8;

      if (b.mesh.position.distanceTo(enemy.mesh.position) < hitRadius) {
        enemy.takeDamage();
        hitSomething = true;

        // Zombi öldüyse skor ver
        if (!enemy.isAlive) {
          // PATLAMA EFEKTİ! (Kahverengi/Kırmızı parçalar)
          createExplosion(enemy.mesh.position, 0x8d6e63);
          // YENİ: Eşya düşürmeyi dene
          tryDropPickup(enemy.mesh.position);
          score += 10;
          // YENİ: Dalga sayacını artır
          zombiesKilledInWave++;
          updateUI();
          enemies.splice(j, 1);
        } break;
      }
    }

    if (hitSomething || !b.isAlive) {
      b.kill();
      bullets.splice(i, 1);
    }
  }

  // 5. PARÇACIKLARI GÜNCELLE
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(dt);
    if (!p.isAlive) {
      particles.splice(i, 1);
    }
  }

  // 6. EŞYALARI GÜNCELLE
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];

    // Pickup'ın içindeki collect fonksiyonu çalışınca isAlive false olur
    p.update(dt, player);

    if (!p.isAlive) {
      pickups.splice(i, 1);
      updateUI(); // Can veya Mermi değiştiği için UI'ı yenile
    }
  }

  // Reload bittiyse ve mermi dolduysa yazıyı düzeltmek için (Basit kontrol)
  if (player && !player.isReloading && document.getElementById('ammo-text').innerText === "DOLDURULUYOR...") {
    updateUI();
  }

  renderer.render(scene, camera);
}

function spawnEnemy() {
  if (!player) return;

  // Rastgele konum belirleme (Değişmedi)
  const angle = Math.random() * Math.PI * 2;
  const radius = 25 + Math.random() * 15; // Biraz daha uzakta doğsunlar
  const pPos = player.getPosition();
  const spawnX = pPos.x + Math.cos(angle) * radius;
  const spawnZ = pPos.z + Math.sin(angle) * radius;
  const spawnPos = new THREE.Vector3(spawnX, 0, spawnZ);

  // --- TÜR SEÇİM MANTIĞI (YENİ) ---
  let type = 'normal';
  const chance = Math.random(); // 0 ile 1 arası rastgele sayı

  // Dalga 2'den sonra 'Runner' (Hızlı) gelebilir (%30 şans)
  if (wave >= 2 && chance < 0.3) {
    type = 'runner';
  }

  // Dalga 4'ten sonra 'Tank' gelebilir (%15 şans)
  if (wave >= 4 && chance > 0.85) {
    type = 'tank';
  }

  // Her 5. dalgada sadece BOSS gelsin (Özel Durum) ama şimdilik karma yapalım
  // Eğer çok ilerlediysek tank şansı artar
  if (wave > 10 && chance > 0.7) {
    type = 'tank';
  }

  // Boss Mantığı: Her 5 dalgada bir, o dalganın İLK zombisi Boss olsun
  if (wave % 5 === 0 && zombiesSpawned === 0) {
    type = 'boss';
    // Boss geldiğinde dalga sayısını az tutabiliriz ama şimdilik kalsın
  }

  const enemy = new Enemy(scene, spawnPos, type);
  enemies.push(enemy);
}

function updateUI() {
  // Can Barı
  const healthPercent = (player.health / player.maxHealth) * 100;
  document.getElementById('health-bar').style.width = healthPercent + '%';

  // MERMİ GÖSTERGESİ
  const ammoDiv = document.getElementById('ammo-text');

  if (player.isReloading) {
    ammoDiv.innerText = "DOLDURULUYOR...";
    ammoDiv.style.color = "#ff0000"; // Kırmızı olsun
  } else {
    ammoDiv.innerText = `MERMİ: ${player.ammo} / ∞`;
    ammoDiv.style.color = "#ffd700"; // Altın rengi (Eski hali)
  }

  // Skor
  document.getElementById('score-box').innerText = score;

  // YENİ: Dalga Bilgisi
  // "Kalan Zombi" bilgisini de gösterelim ki oyuncu ne kadar kaldığını bilsin
  const remaining = waveZombieCount - zombiesKilledInWave;
  document.getElementById('wave-info').innerText = `DALGA: ${wave} | KALAN: ${remaining}`;
}

function showGameOver() {
  document.getElementById('game-over').style.display = 'block';
  document.getElementById('final-score').innerText = 'Skorun: ' + score;

  // Tekrar Dene Butonu
  document.getElementById('restart-btn').onclick = () => {
    location.reload(); // Sayfayı yenile
  };
}

function createExplosion(position, color) {
  // 15 tane parça oluştur
  for (let i = 0; i < 15; i++) {
    const p = new Particle(scene, position, color);
    particles.push(p);
  }
}

function startNextWave() {
  wave++;

  // Zorluğu Artır
  waveZombieCount += 5; // Her dalgada 5 zombi daha fazla
  spawnRate = Math.max(0.3, 2.0 - (wave * 0.15)); // Dalga arttıkça süre hızla azalır
  // Sayaçları Sıfırla
  zombiesSpawned = 0;
  zombiesKilledInWave = 0;

  // Oyuncuya biraz can verelim (Ödül)
  player.health = Math.min(player.maxHealth, player.health + 20);

  console.log(`Dalga ${wave} başladı! Hız: ${spawnRate}`);
  updateUI();
}

function tryDropPickup(position) {
  // %30 şansla eşya düşsün
  if (Math.random() < 0.3) {
    // Düşerse: %60 ihtimalle Mermi, %40 ihtimalle Can
    const type = Math.random() < 0.6 ? 'ammo' : 'health';

    const pickup = new Pickup(scene, position, type);
    pickups.push(pickup);
  }
}