import * as THREE from 'three';
import { Player } from './Player.js';
import { Bullet } from './Bullet.js';
import { Enemy } from './Enemy.js';
import { Particle } from './Particle.js';
import { Pickup } from './Pickup.js';

const CONFIG = {
  viewSize: 15,
  cameraOffset: 25,
  mapSize: 150,
  wallHeight: 5
};

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

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xad8a6c);
  clock = new THREE.Clock();

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

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffaa33, 0.8);
  dirLight.position.set(50, 200, 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  const d = 500;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);

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
  player = new Player(scene);
  setupInputs();
  window.addEventListener('resize', onWindowResize);
  updateUI();
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
    if ((e.key === 'r' || e.key === 'R') && player && !isPaused) {
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

        const bullet = new Bullet(scene, spawnPos, direction);
        bullets.push(bullet);

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

  if (isPaused || isGameOver) {
    renderer.render(scene, camera);
    return;
  }

  if (player) {
    player.update(dt, inputs);

    const halfSize = CONFIG.mapSize / 2 - 1;
    const pPos = player.getPosition();
    if (pPos.x < -halfSize) pPos.x = -halfSize;
    if (pPos.x > halfSize) pPos.x = halfSize;
    if (pPos.z < -halfSize) pPos.z = -halfSize;
    if (pPos.z > halfSize) pPos.z = halfSize;

    camera.position.x = pPos.x + CONFIG.cameraOffset;
    camera.position.z = pPos.z + CONFIG.cameraOffset;

    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(aimPlane, intersection)) {
      player.lookAt(intersection);
      currentAimPoint.copy(intersection);
    }
  }

  if (zombiesKilledInWave >= waveZombieCount && zombiesSpawned >= waveZombieCount) {
    startNextWave();
  }

  if (zombiesSpawned < waveZombieCount) {
    spawnTimer += dt;
    if (spawnTimer > spawnRate) {
      spawnTimer = 0;
      spawnEnemy();
      zombiesSpawned++;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt, player.getPosition());

    const halfSize = CONFIG.mapSize / 2 - 1;
    const ePos = enemy.mesh.position;
    if (ePos.x < -halfSize) ePos.x = -halfSize;
    if (ePos.x > halfSize) ePos.x = halfSize;
    if (ePos.z < -halfSize) ePos.z = -halfSize;
    if (ePos.z > halfSize) ePos.z = halfSize;

    const distToPlayer = enemy.mesh.position.distanceTo(player.getPosition());
    let attackRange = 1.2;
    let damage = 10;
    
    if (enemy.type === 'tank') {
      attackRange = 2.0;
      damage = 15;
    } else if (enemy.type === 'boss') {
      attackRange = 3.0;
      damage = 25;
    } else if (enemy.type === 'runner') {
      attackRange = 1.0;
      damage = 8;
    }

    if (distToPlayer < attackRange) {
      if (!enemy.lastAttackTime || clock.getElapsedTime() - enemy.lastAttackTime > 1.0) {
        player.takeDamage(damage);
        enemy.lastAttackTime = clock.getElapsedTime();

        const originalColor = enemy.mesh.material.color.getHex();
        enemy.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
          if (enemy.isAlive) enemy.mesh.material.color.setHex(originalColor);
        }, 100);

        updateUI();

        if (player.isDead) {
          isGameOver = true;
          showGameOver();
        }
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update(dt);
    let hitSomething = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (!enemy.isAlive) {
        enemies.splice(j, 1);
        continue;
      }
      const hitRadius = enemy.mesh.scale.x * 0.8;

      if (b.mesh.position.distanceTo(enemy.mesh.position) < hitRadius) {
        enemy.takeDamage();
        hitSomething = true;

        if (!enemy.isAlive) {
          createExplosion(enemy.mesh.position, 0x8d6e63);
          tryDropPickup(enemy.mesh.position);
          score += 10;
          zombiesKilledInWave++;
          updateUI();
          enemies.splice(j, 1);
        }
        break;
      }
    }

    if (hitSomething || !b.isAlive) {
      b.kill();
      bullets.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(dt);
    if (!p.isAlive) {
      particles.splice(i, 1);
    }
  }

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.update(dt, player);
    if (!p.isAlive) {
      pickups.splice(i, 1);
      updateUI();
    }
  }

  if (player && !player.isReloading && document.getElementById('ammo-text').innerText === "DOLDURULUYOR...") {
    updateUI();
  }

  renderer.render(scene, camera);
}

function spawnEnemy() {
  if (!player) return;

  const halfSize = CONFIG.mapSize / 2 - 2;
  let spawnX, spawnZ;
  const side = Math.floor(Math.random() * 4);

  switch(side) {
    case 0:
      spawnX = (Math.random() - 0.5) * (CONFIG.mapSize - 10);
      spawnZ = -halfSize;
      break;
    case 1:
      spawnX = (Math.random() - 0.5) * (CONFIG.mapSize - 10);
      spawnZ = halfSize;
      break;
    case 2:
      spawnX = -halfSize;
      spawnZ = (Math.random() - 0.5) * (CONFIG.mapSize - 10);
      break;
    case 3:
      spawnX = halfSize;
      spawnZ = (Math.random() - 0.5) * (CONFIG.mapSize - 10);
      break;
  }

  const spawnPos = new THREE.Vector3(spawnX, 0, spawnZ);
  let type = 'normal';
  const chance = Math.random();

  if (wave >= 2 && chance < 0.3) type = 'runner';
  if (wave >= 4 && chance > 0.85) type = 'tank';
  if (wave > 10 && chance > 0.7) type = 'tank';
  if (wave % 5 === 0 && zombiesSpawned === 0) type = 'boss';

  const enemy = new Enemy(scene, spawnPos, type);
  enemies.push(enemy);
}

function updateUI() {
  document.getElementById('health-bar').style.width = (player.health / player.maxHealth) * 100 + '%';
  
  const ammoDiv = document.getElementById('ammo-text');
  if (player.isReloading) {
    ammoDiv.innerText = "DOLDURULUYOR...";
    ammoDiv.style.color = "#ff0000";
  } else {
    ammoDiv.innerText = `MERMİ: ${player.ammo} / ∞`;
    ammoDiv.style.color = "#ffd700";
  }
  
  document.getElementById('score-box').innerText = score;
  const remaining = waveZombieCount - zombiesKilledInWave;
  document.getElementById('wave-info').innerText = `DALGA: ${wave} | 🧟 KALAN: ${remaining}`;
}

function showGameOver() {
  document.getElementById('game-over').style.display = 'block';
  document.getElementById('final-score').innerText = 'Skorun: ' + score;
}

function startNextWave() {
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
    const p = new Particle(scene, position, color);
    particles.push(p);
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