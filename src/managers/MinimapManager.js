export class MinimapManager {
    constructor(game) {
        this.game = game;
        this.mapSize = game.config.mapSize; // Haritanın gerçek boyutu (150)

        // --- 1. HTML Elemanlarını Oluştur ---
        // Kapsayıcı (Container)
        this.container = document.createElement('div');
        this.container.id = 'minimap-container';
        Object.assign(this.container.style, {
            position: 'absolute',
            bottom: '200px',
            left: '100px',
            width: '150px',
            height: '150px',
            border: '3px solid #3e2723', // Koyu kahve çerçeve
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // Yarı saydam siyah zemin
            borderRadius: '0%', // Yuvarlak harita
            overflow: 'hidden',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            zIndex: '1000'
        });

        // Çizim Alanı (Canvas)
        this.canvas = document.createElement('canvas');
        this.canvas.width = 150;
        this.canvas.height = 150;
        this.ctx = this.canvas.getContext('2d');

        this.container.appendChild(this.canvas);
        document.body.appendChild(this.container);
    }

    update() {
    // Canvas'ı temizle (Eski çizimleri sil)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.game.obstacleManager) {
            for (const obstacle of this.game.obstacleManager.obstacles) {
                if (!obstacle.mesh) continue;
                this.drawDot(obstacle.mesh.position, '#404040', 2);
            }
        }

        // --- 2. Zombileri Çiz (Kırmızı Noktalar) ---
        for (const enemy of this.game.enemies) {
            if (!enemy.isAlive) continue;
            this.drawDot(enemy.mesh.position, '#ff0000', 3); // Kırmızı, 3px
        }

        // --- 3. Loot Kutularını Çiz (Sarı/Pembe Noktalar) ---
        for (const pickup of this.game.pickups) {
            if (!pickup.isAlive) continue;
            const color = pickup.type === 'ammo' ? '#ffd700' : '#ff00ff';
            this.drawDot(pickup.mesh.position, color, 2);
        }

        // --- 4. Oyuncuyu Çiz (Yeşil Nokta - Ortada Değil, Kendi Yerinde) ---
        if (this.game.player && !this.game.player.isDead) {
            this.drawDot(this.game.player.getPosition(), '#00ff00', 4);
        }
    }

    // 3D Dünya Koordinatını -> 2D İzometrik Minimap Koordinatına Çevirir
    drawDot(position, color, size) {
        // --- İZOMETRİK DÖNÜŞÜM ---
        // Dünyadaki X ve Z koordinatlarını 45 derece döndürüyoruz.
        // W tuşu (x az, z az) -> Toplamları negatif -> Haritada YUKARI
        // D tuşu (x çok, z az) -> Farkları pozitif -> Haritada SAĞ

        const rotatedX = position.x - position.z; // Sol - Sağ ekseni (A - D)
        const rotatedY = position.x + position.z; // Yukarı - Aşağı ekseni (W - S)

        // --- ÖLÇEKLEME ---
        // Harita döndürüldüğünde köşegen uzunluğu arttığı için ölçeği ayarlıyoruz.
        // mapSize * 2 diyerek haritanın taşmamasını garantiliyoruz.
        const scale = this.canvas.width / (this.mapSize * 2);

        // --- MERKEZLEME ---
        // Canvas'ın tam ortasını (0,0) noktası kabul ediyoruz
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Son koordinatlar
        const x = centerX + rotatedX * scale;
        const y = centerY + rotatedY * scale;

        // Noktayı çiz
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }
}