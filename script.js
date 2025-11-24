document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Canvas
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const livesDisplay = document.getElementById('lives');
    const statusMessage = document.getElementById('status-message');
    const finalScoreText = document.getElementById('final-score');
    const startButton = document.getElementById('start-button');
    
    // Konstanta Game
    const GAME_WIDTH = canvas.width;
    const GAME_HEIGHT = canvas.height;

    // --- State Game Global ---
    let score = 0;
    let lives = 3;
    let isPlaying = false;
    let lastTime = 0;
    let enemySpawnTimer = 0;
    const ENEMY_SPAWN_RATE = 1500; // Musuh muncul setiap 1500ms (1.5 detik)

    // --- Objek Game ---
    let player = {
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT - 50,
        width: 40,
        height: 40,
        speed: 5,
        color: '#00ff00' // Hijau Neon
    };

    let bullets = [];
    let enemies = [];
    let keys = {}; // Untuk melacak tombol yang ditekan

    // --- Kelas Peluru (Bullet) ---
    class Bullet {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = 4;
            this.height = 10;
            this.speed = 7;
            this.color = '#ff00ff'; // Magenta Neon
        }

        update() {
            this.y -= this.speed;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    // --- Kelas Musuh (Enemy) ---
    class Enemy {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = 30;
            this.height = 30;
            this.speed = Math.random() * 1.5 + 1; // Kecepatan acak antara 1 dan 2.5
            this.color = '#e74c3c'; // Merah
        }

        update() {
            this.y += this.speed;
        }

        draw() {
            // Gambar bentuk Musuh (kotak sederhana)
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Tambahkan mata/detail (opsional)
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
            ctx.fillRect(this.x + this.width - 10, this.y + 5, 5, 5);
        }
    }

    // --- Fungsi Game Loop ---

    function gameLoop(currentTime) {
        if (!isPlaying) return;

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // 1. Update (Perbarui posisi objek)
        update(deltaTime);

        // 2. Draw (Gambar ulang semua objek)
        draw();
        
        // Minta frame berikutnya
        requestAnimationFrame(gameLoop);
    }

    function update(deltaTime) {
        // --- 1. Pergerakan Pemain ---
        if (keys['ArrowLeft'] && player.x > 0) {
            player.x -= player.speed;
        }
        if (keys['ArrowRight'] && player.x < GAME_WIDTH - player.width) {
            player.x += player.speed;
        }

        // --- 2. Pergerakan Peluru ---
        bullets.forEach((bullet, index) => {
            bullet.update();
            // Hapus peluru yang keluar dari layar
            if (bullet.y < 0) {
                bullets.splice(index, 1);
            }
        });

        // --- 3. Spawn Musuh ---
        enemySpawnTimer += deltaTime;
        if (enemySpawnTimer >= ENEMY_SPAWN_RATE) {
            spawnEnemy();
            enemySpawnTimer = 0;
        }

        // --- 4. Pergerakan Musuh ---
        enemies.forEach((enemy, index) => {
            enemy.update();

            // Musuh mencapai bagian bawah (Pemain kehilangan nyawa)
            if (enemy.y > GAME_HEIGHT) {
                enemies.splice(index, 1);
                loseLife();
            }
        });

        // --- 5. Deteksi Tabrakan (Peluru vs Musuh) ---
        handleCollisions();

        // --- 6. Cek Game Over ---
        if (lives <= 0) {
            gameOver();
        }
    }

    function draw() {
        // Hapus (Clear) canvas setiap frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Gambar Pemain
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // Gambar Peluru
        bullets.forEach(bullet => bullet.draw());

        // Gambar Musuh
        enemies.forEach(enemy => enemy.draw());
    }

    // --- Fungsi Pembantu ---

    function spawnEnemy() {
        // Buat musuh di posisi X acak
        const x = Math.random() * (GAME_WIDTH - 30);
        enemies.push(new Enemy(x, -30));
    }

    function handleCollisions() {
        // Loop terbalik agar aman saat menghapus elemen
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            
            // Cek tabrakan Musuh vs Pemain
            if (checkAABB(player, enemy)) {
                enemies.splice(i, 1);
                loseLife();
                continue; 
            }

            // Cek tabrakan Peluru vs Musuh
            for (let j = bullets.length - 1; j >= 0; j--) {
                const bullet = bullets[j];

                if (checkAABB(bullet, enemy)) {
                    // Tabrakan terjadi!
                    enemies.splice(i, 1); // Hapus musuh
                    bullets.splice(j, 1); // Hapus peluru
                    score += 10;
                    scoreDisplay.textContent = score;
                    break; // Keluar dari loop peluru
                }
            }
        }
    }

    // Fungsi deteksi tabrakan AABB (Axis-Aligned Bounding Box)
    function checkAABB(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    function loseLife() {
        lives--;
        livesDisplay.textContent = lives;
        // Opsional: berikan feedback visual (blink pemain)
    }

    function fireBullet() {
        // Tambahkan peluru di tengah atas pesawat
        const bullet = new Bullet(player.x + player.width / 2 - 2, player.y);
        bullets.push(bullet);
    }

    function gameOver() {
        isPlaying = false;
        finalScoreText.textContent = `Skor Anda: ${score}`;
        statusMessage.classList.remove('hidden');
    }

    function startGame() {
        score = 0;
        lives = 3;
        player.x = GAME_WIDTH / 2;
        player.y = GAME_HEIGHT - 50;
        bullets = [];
        enemies = [];
        enemySpawnTimer = 0;
        
        scoreDisplay.textContent = score;
        livesDisplay.textContent = lives;
        statusMessage.classList.add('hidden');
        
        isPlaying = true;
        lastTime = performance.now(); // Reset waktu untuk gameLoop
        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---

    // Menangani tombol ditekan (movement)
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;

        if (isPlaying && e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault(); // Mencegah scrolling
            fireBullet();
        }
        
        // Memulai game dari layar status
        if (!isPlaying && e.key === ' ' || e.key === 'Spacebar') {
            startGame();
        }
    });

    // Menangani tombol dilepas
    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Menangani tombol Start di layar Game Over
    startButton.addEventListener('click', startGame);

    // Inisialisasi awal
    gameOver(); // Tampilkan layar awal "Game Over" sebagai layar Start
});