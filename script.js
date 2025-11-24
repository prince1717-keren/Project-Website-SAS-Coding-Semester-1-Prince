document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const canvas = document.getElementById('duelCanvas');
    const ctx = canvas.getContext('2d');
    const blueHealthBar = document.getElementById('blueHealthBar');
    
    // UI Elements
    const splashScreen = document.getElementById('splash-screen');
    const mainMenu = document.getElementById('main-menu');
    const difficultyMenu = document.getElementById('difficulty-menu');
    const gameInfo = document.getElementById('game-info');
    const goldTimerDisplay = document.getElementById('gold-timer');
    const difficultyDisplay = document.getElementById('difficulty-display');
    const statusMessage = document.getElementById('status-message');
    const finalResult = document.getElementById('final-result');
    const restartButton = document.getElementById('restart-button');
    const backToMenuButton = document.getElementById('back-to-menu-btn');
    const playButton = document.getElementById('play-btn');
    const diffButtons = document.querySelectorAll('.diff-btn');
    const backButton = document.getElementById('back-btn');


    // --- Konstanta Game ---
    const GAME_WIDTH = canvas.width;
    const GAME_HEIGHT = canvas.height;
    const FLOOR = GAME_HEIGHT - 50; 
    const WIN_TIME = 30000; // 30 detik untuk menang

    // --- State Global ---
    let keysPressed = {};
    let isGameActive = false;
    let lastTime = 0;
    let botDifficulty = 'normal';
    let heroes = []; 
    let goldCoin = {};

    // --- Konstanta Attack ---
    const SKILL_COOLDOWNS = { attack: 500 }; 
    const DAMAGE = { attack: 1 }; 

    // --- Hero Class ---
    class Hero {
        constructor(x, color, keys, isPlayer, name, isBot = false) {
            this.x = x;
            this.y = FLOOR; 
            this.width = 40;
            this.height = 80;
            this.color = color;
            this.name = name;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.speed = 5;
            this.baseSpeed = 5;
            this.velocityY = 0;
            this.gravity = 0.8;
            this.jumpPower = -15;
            this.isOnGround = true;
            this.isPlayer = isPlayer;
            this.isBot = isBot;

            this.currentAction = 'idle'; 
            this.timers = { attack: 0, animation: 0 };
            this.keys = keys;
            this.maxCooldowns = { attack: SKILL_COOLDOWNS.attack };
        }

        update(deltaTime) {
            // Cek status koin untuk penalti kecepatan dan lompatan
            if (goldCoin.isHeld && goldCoin.holder === this) {
                this.speed = this.baseSpeed * 0.6; 
                this.jumpPower = -7; 
            } else {
                this.speed = this.baseSpeed;
                this.jumpPower = -15;
            }

            for (const key in this.timers) {
                if (this.timers[key] > 0) this.timers[key] = Math.max(0, this.timers[key] - deltaTime);
            }
            if (this.currentAction !== 'idle' && this.timers.animation === 0) this.currentAction = 'idle';

            // Logika Bot di sini
            if (this.isBot) this.handleBotLogic(deltaTime);
            
            // Input Pemain/Bot
            if (this.currentAction === 'idle' || this.isBot) { 
                this.handleMovement(keysPressed);
                this.handleSkills(keysPressed);
            }

            this.velocityY += this.gravity;
            this.y += this.velocityY;
            if (this.y >= FLOOR) {
                this.y = FLOOR;
                this.velocityY = 0;
                this.isOnGround = true;
            }
            this.x = Math.max(0, Math.min(this.x, GAME_WIDTH - this.width));
        }

        handleMovement(keysPressed) {
            if (keysPressed[this.keys.left]) this.x -= this.speed;
            if (keysPressed[this.keys.right]) this.x += this.speed;
            if (keysPressed[this.keys.jump] && this.isOnGround) {
                this.velocityY = this.jumpPower;
                this.isOnGround = false;
            }
        }

        handleSkills(keysPressed) {
            if (keysPressed[this.keys.attack] && this.timers.attack === 0) this.useSkill('attack');
        }

        useSkill(skillName) {
            let cooldownTime = SKILL_COOLDOWNS[skillName];
            let animationTime = 100;
            
            this.currentAction = skillName;
            this.timers[skillName] = cooldownTime;
            this.timers.animation = animationTime;
        }

        getHitbox() {
            // Hitbox Hero: dari (x, y_atas) dengan ukuran (width, height)
            return { x: this.x, y: this.y - this.height, width: this.width, height: this.height };
        }
        
        getAttackHitbox() {
            if (this.currentAction !== 'attack') return null;

            let x, width, height;
            const target = findNearestTarget(this);
            const opponentX = target ? target.x : (this.x > GAME_WIDTH / 2 ? 0 : GAME_WIDTH);
            const facingRight = this.x < opponentX; 

            width = 30;
            height = this.height * 0.7;
            x = facingRight ? this.x + this.width : this.x - width;
            const y = this.y - (this.height * 0.7);
            
            return { x, y, width, height };
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y - this.height, this.width, this.height);

            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x + this.width / 2, this.y - this.height - 5);

            const attackHitbox = this.getAttackHitbox();
            if (attackHitbox) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(attackHitbox.x, attackHitbox.y, attackHitbox.width, attackHitbox.height);
            }
        }
        
        // --- LOGIKA BOT AI ---
        handleBotLogic(deltaTime) {
            // Reset input bot sebelum mengambil keputusan
            for (const key in this.keys) keysPressed[this.keys[key]] = false;

            if (this.currentAction !== 'idle') return; 

            let target = goldCoin.holder;
            if (!target || target === this) target = findNearestTarget(this);

            const targetX = target ? target.x : goldCoin.x;
            const distance = target ? Math.abs(this.x - target.x) : Math.abs(this.x - targetX);
            const decision = Math.random();
            
            // Bot AI Sederhana (Hanya Basic Attack)
            if (goldCoin.holder === this) {
                 // Bertahan: Lari/Hindar
                if (distance < 200 && target) moveTowards(this, target.x, true);
                if (this.isOnGround && decision < 0.1) keysPressed[this.keys.jump] = true;
            } else {
                // Menyerang/Merebut: Mendekat dan Spam Basic Attack
                if (distance > 30) moveTowards(this, targetX);
                
                if (distance < 50 && this.timers.attack === 0) keysPressed[this.keys.attack] = true;
            }
        }
    }
    
    // --- Implementasi AI Helper ---
    function moveTowards(self, targetX, flee = false) {
        const moveRight = self.x < targetX;
        if (flee) {
            keysPressed[moveRight ? self.keys.left : self.keys.right] = true;
        } else {
            keysPressed[moveRight ? self.keys.right : self.keys.left] = true;
        }
    }

    function findNearestTarget(hero) {
        let nearestTarget = null;
        let minDistance = Infinity;

        heroes.forEach(other => {
            if (other === hero || other.health <= 0) return;
            if (goldCoin.holder && goldCoin.holder === other) {
                nearestTarget = other;
                minDistance = 0; 
                return;
            }
            
            const dist = Math.abs(hero.x - other.x);
            if (!goldCoin.holder && dist < minDistance) {
                minDistance = dist;
                nearestTarget = other;
            }
        });
        return nearestTarget;
    }

    // --- Game Logic Utama ---

    function gameLoop(currentTime) {
        if (!isGameActive) return;

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        heroes.forEach(hero => hero.update(deltaTime));
        
        updateCoin(deltaTime);

        handleAttacks();
        
        if (goldCoin.captureTime >= goldCoin.maxCaptureTime) {
            gameOver(goldCoin.holder);
        } else {
            draw();
            requestAnimationFrame(gameLoop);
        }
    }

    function updateCoin(deltaTime) {
        if (goldCoin.holder) {
            goldCoin.x = goldCoin.holder.x + goldCoin.holder.width / 2 - goldCoin.width / 2;
            goldCoin.y = goldCoin.holder.y - goldCoin.holder.height - 5; 
            
            goldCoin.captureTime += deltaTime;
        } else {
            // Cek tabrakan untuk Hero mengambil koin
            heroes.forEach(hero => {
                if (hero.health > 0 && checkAABB(hero.getHitbox(), goldCoin)) {
                    goldCoin.isHeld = true;
                    goldCoin.holder = hero;
                    goldCoin.captureTime = 0; 
                }
            });
        }
        
        // Update tampilan timer
        if (goldCoin.holder) {
            const timeLeft = Math.max(0, goldCoin.maxCaptureTime - goldCoin.captureTime) / 1000;
            goldTimerDisplay.textContent = `${timeLeft.toFixed(1)}s`;
        } else {
             goldTimerDisplay.textContent = `0.0s (Koin Bebas)`;
        }
    }
    
    // --- Rendering dan UI ---
    function draw() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#666'; ctx.fillRect(0, FLOOR, GAME_WIDTH, GAME_HEIGHT - FLOOR);
        
        heroes.forEach(hero => hero.draw());
        
        if (!goldCoin.isHeld) { drawGoldCoin(goldCoin.x, goldCoin.y); } 
        else if (goldCoin.holder) { drawGoldCoin(goldCoin.x, goldCoin.y); }
    }
    
    function drawGoldCoin(x, y) {
        ctx.fillStyle = '#FFD700'; 
        ctx.beginPath();
        ctx.arc(x + goldCoin.width / 2, y + goldCoin.height / 2, goldCoin.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    // --- Damage dan Kematian ---
    function handleAttacks() {
        heroes.forEach((attacker) => {
            heroes.forEach((defender) => {
                if (attacker === defender || defender.health <= 0) return;

                if (attacker.currentAction === 'attack') {
                    const attackBox = attacker.getAttackHitbox();
                    
                    if (checkAABB(attackBox, defender.getHitbox())) {
                        applyDamage(defender, DAMAGE.attack);
                        attacker.currentAction = 'idle'; 
                    }
                }
            });
        });
    }
    
    function applyDamage(target, amount) {
        if (target.health <= 0) return; 
        
        target.health -= amount; 
        target.health = Math.max(0, target.health);
        
        if (target.health <= 0) {
            if (goldCoin.holder === target) {
                goldCoin.isHeld = false;
                goldCoin.holder = null;
                goldCoin.captureTime = 0;
                goldCoin.x = GAME_WIDTH / 2 - 20;
                goldCoin.y = FLOOR - 40;
            }
        }
        updateHealthDisplay();
    }
    
    // --- FIX KRITIS: Logika Tabrakan (AABB) ---
    function checkAABB(rect1, rect2) {
        if (!rect1 || !rect2) return false;
        return (rect1.x < rect2.x + rect2.width && 
                rect1.x + rect1.width > rect2.x &&
                rect1.y < rect2.y + rect2.height && 
                rect1.y + rect1.height > rect2.y); // Logika tabrakan yang benar
    }
    
    function updateHealthDisplay() {
        const playerHero = heroes.find(h => h.isPlayer);
        blueHealthBar.style.width = playerHero ? `${playerHero.health}%` : '0%';
        blueHealthBar.style.backgroundColor = playerHero && playerHero.health < 30 ? 'yellow' : '#3498db';
    }

    function gameOver(winner) {
        isGameActive = false;
        let resultText;
        if (winner) {
            resultText = `${winner.name.toUpperCase()} WINS THE GOLD RUSH!`;
            finalResult.style.color = winner.color;
        } else {
             resultText = "GAME OVER!"; 
             finalResult.style.color = '#f1c40f';
        }
        finalResult.textContent = resultText;
        canvas.classList.add('hidden');
        statusMessage.classList.remove('hidden');
    }

    // --- MENU MANAGEMENT ---
    function showMenu(menu) {
        // Logika menu tetap sama
        mainMenu.classList.add('hidden');
        difficultyMenu.classList.add('hidden');
        gameInfo.classList.add('hidden');
        splashScreen.classList.remove('hidden');
        canvas.classList.add('hidden');
        statusMessage.classList.add('hidden');

        if (menu === 'main') {
            mainMenu.classList.remove('hidden');
        } else if (menu === 'difficulty') {
            difficultyMenu.classList.remove('hidden');
            splashScreen.classList.add('hidden');
        } else if (menu === 'game') {
            gameInfo.classList.remove('hidden');
            canvas.classList.remove('hidden');
            splashScreen.classList.add('hidden');
        }
    }
    
    function setDifficulty(e) {
        diffButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        botDifficulty = e.currentTarget.dataset.level;
        difficultyDisplay.textContent = botDifficulty.toUpperCase();
        
        initGame();
        showMenu('game');
    }

    // --- Inisialisasi Game (FIX KRITIS: Keymap Unik untuk Bot) ---
    function initGame() {
        const keysPlayer = { attack: 'f', jump: 'w', left: 'a', right: 'd' };
        
        // Setiap Bot HARUS memiliki keymap unik agar tidak saling menimpa input
        const keysBot1 = { attack: 'k', jump: 'i', left: 'j', right: 'l' }; 
        const keysBot2 = { attack: 'z', jump: 'u', left: 't', right: 'y' }; // Keymap unik
        const keysBot3 = { attack: 'p', jump: 'o', left: 'n', right: 'm' }; // Keymap unik
        
        heroes = [
            new Hero(50, '#3498db', keysPlayer, true, "Player", false), 
            new Hero(GAME_WIDTH - 50 - 40, '#e74c3c', keysBot1, false, "Bot 1", true), 
            new Hero(GAME_WIDTH - 150 - 40, '#ff7f7f', keysBot2, false, "Bot 2", true), 
            new Hero(GAME_WIDTH - 250 - 40, '#990000', keysBot3, false, "Bot 3", true)
        ]; 
        
        goldCoin = {
            x: GAME_WIDTH / 2 - 20, y: FLOOR - 40, width: 40, height: 40,
            isHeld: false, holder: null, captureTime: 0, maxCaptureTime: WIN_TIME 
        };

        heroes.forEach(hero => { hero.timers.attack = hero.maxCooldowns.attack; });

        isGameActive = true;
        updateHealthDisplay();
        lastTime = performance.now();
        
        requestAnimationFrame(gameLoop);
    }
    
    // --- Event Listeners ---
    playButton.addEventListener('click', () => showMenu('difficulty'));
    backButton.addEventListener('click', () => showMenu('main'));
    diffButtons.forEach(btn => btn.addEventListener('click', setDifficulty));
    restartButton.addEventListener('click', () => { initGame(); showMenu('game'); });
    backToMenuButton.addEventListener('click', () => showMenu('main'));

    document.addEventListener('keydown', (e) => {
        // Gunakan e.key.toLowerCase() untuk kompatibilitas
        keysPressed[e.key.toLowerCase()] = true;
        if (!isGameActive && e.key.toLowerCase() === 'enter') { initGame(); showMenu('game'); }
    });
    document.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });

    showMenu('main');
});