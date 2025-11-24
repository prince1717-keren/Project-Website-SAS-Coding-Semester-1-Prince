document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const canvas = document.getElementById('duelCanvas');
    const ctx = canvas.getContext('2d');
    const blueHealthBar = document.getElementById('blueHealthBar');
    const redHealthBar = document.getElementById('redHealthBar');
    const statusMessage = document.getElementById('status-message');
    const finalResult = document.getElementById('final-result');
    const restartButton = document.getElementById('restart-button');
    const difficultyDisplay = document.getElementById('difficulty-display');
    const diffButtons = document.querySelectorAll('.difficulty-buttons button');
    
    // --- Konstanta Game ---
    const GAME_WIDTH = canvas.width;
    const GAME_HEIGHT = canvas.height;
    const FLOOR = GAME_HEIGHT - 50; 
    const BLOCK_SIZE = 40; 

    // --- State Global ---
    let keysPressed = {};
    let isGameActive = false;
    let lastTime = 0;
    let botDifficulty = 'normal';
    let heroBlue;
    let heroRed;
    let projectiles = [];

    // --- Konstanta Skill & Cooldowns (ms) ---
    const SKILL_COOLDOWNS = {
        attack: 500,
        skill1: 1500,
        skill2: 3000,
        skill3: 6000
    };
    const DAMAGE = {
        attack: 10,
        skill1: 10,
        skill2: 10,
        skill3_ratio: 0.5
    };

    // --- Hero Class ---
    class Hero {
        constructor(x, color, keys, isPlayerOne, isBot = false) {
            this.x = x;
            this.y = FLOOR; 
            this.width = 40;
            this.height = 80;
            this.color = color;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.speed = 5;
            this.velocityY = 0;
            this.gravity = 0.8;
            this.jumpPower = -15;
            this.isOnGround = true;
            this.isPlayerOne = isPlayerOne;
            this.isBot = isBot;

            this.currentAction = 'idle'; 
            this.timers = { attack: 0, skill1: 0, skill2: 0, skill3: 0, animation: 0 };
            this.keys = keys;
            
            // Properti untuk Initial Cooldown
            this.maxCooldowns = {
                attack: SKILL_COOLDOWNS.attack,
                skill1: SKILL_COOLDOWNS.skill1,
                skill2: SKILL_COOLDOWNS.skill2,
                skill3: SKILL_COOLDOWNS.skill3,
            };
        }

        update(deltaTime, keysPressed, opponent) {
            for (const key in this.timers) {
                if (this.timers[key] > 0) this.timers[key] = Math.max(0, this.timers[key] - deltaTime);
            }
            if (this.currentAction !== 'idle' && this.timers.animation === 0) this.currentAction = 'idle';

            if (this.isBot) this.handleBotLogic(opponent, deltaTime);
            
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
            if (keysPressed[this.keys.skill3] && this.timers.skill3 === 0) this.useSkill(3);
            else if (keysPressed[this.keys.skill2] && this.timers.skill2 === 0) this.useSkill(2);
            else if (keysPressed[this.keys.skill1] && this.timers.skill1 === 0) this.useSkill(1);
            else if (keysPressed[this.keys.attack] && this.timers.attack === 0) this.useSkill('attack');
        }

        useSkill(skillNumber) {
            let cooldownTime, animationTime;
            const skillName = typeof skillNumber === 'number' ? `skill${skillNumber}` : skillNumber;
            cooldownTime = SKILL_COOLDOWNS[skillName];
            
            switch (skillNumber) {
                case 'attack': animationTime = 100; break;
                case 1: animationTime = 300; break;
                case 2: animationTime = 500; break;
                case 3: animationTime = 1000; break;
                default: return;
            }
            
            this.currentAction = skillName;
            this.timers[skillName] = cooldownTime;
            this.timers.animation = animationTime;
        }

        getHitbox() {
            return { x: this.x, y: this.y - this.height, width: this.width, height: this.height };
        }
        
        getAttackHitbox() {
            if (this.currentAction === 'idle' || this.currentAction === 'moving' || this.currentAction === 'skill2') return null;

            let x, width, height;
            const opponentX = this.isPlayerOne ? heroRed.x : heroBlue.x;
            const facingRight = this.x < opponentX; 

            if (this.currentAction === 'attack' || this.currentAction === 'skill1') {
                width = 30;
                height = this.height * 0.7;
                x = facingRight ? this.x + this.width : this.x - width;
            } else if (this.currentAction === 'skill3') {
                width = 5 * BLOCK_SIZE; 
                height = 10; 
                x = facingRight ? this.x + this.width : this.x - width;
            } else {
                return null;
            }

            const y = this.currentAction === 'skill3' ? FLOOR - height : this.y - (this.height * 0.7);
            return { x, y, width, height };
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y - this.height, this.width, this.height);

            const attackHitbox = this.getAttackHitbox();
            if (attackHitbox) {
                ctx.fillStyle = this.currentAction === 'skill3' ? 'rgba(255, 0, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(attackHitbox.x, attackHitbox.y, attackHitbox.width, attackHitbox.height);
            }
        }
        
        // --- LOGIKA BOT AI ---
        handleBotLogic(opponent, deltaTime) {
            for (const key in this.keys) keysPressed[this.keys[key]] = false;
            const distance = Math.abs(this.x - opponent.x);
            const decision = Math.random();

            if (this.currentAction !== 'idle') return; 

            switch(botDifficulty) {
                case 'easy': easyAI(this, opponent, distance, decision); break;
                case 'normal': normalAI(this, opponent, distance, decision); break;
                case 'hard': hardAI(this, opponent, distance, decision); break;
            }
        }
    }
    
    // --- Implementasi AI (Kode AI tetap sama) ---
    const DISTANCE_MELEE = 50;
    const DISTANCE_SPIKE = 250; 
    const DISTANCE_SHOOT = 500;

    function easyAI(self, opponent, distance, decision) {
        if (distance > DISTANCE_SHOOT && decision < 0.3) {
            keysPressed[self.x < opponent.x ? self.keys.right : self.keys.left] = true;
        } else if (distance < 100 && self.timers.attack === 0 && decision < 0.7) {
             keysPressed[self.keys.attack] = true;
        } else if (distance > 100 && self.timers.skill2 === 0 && decision < 0.2) {
             keysPressed[self.keys.skill2] = true;
        }
    }

    function normalAI(self, opponent, distance, decision) {
        if (distance > 300) keysPressed[self.x < opponent.x ? self.keys.right : self.keys.left] = true;
        else if (distance < 100) keysPressed[self.x < opponent.x ? self.keys.left : self.keys.right] = true; 

        if (distance <= DISTANCE_MELEE && self.timers.skill1 === 0) {
            keysPressed[self.keys.skill1] = true;
        } else if (distance <= DISTANCE_SPIKE && self.timers.skill3 === 0 && decision < 0.6) {
             keysPressed[self.keys.skill3] = true;
        } else if (self.timers.skill2 === 0 && decision < 0.8) {
            keysPressed[self.keys.skill2] = true;
        }
    }

    function hardAI(self, opponent, distance, decision) {
        if (distance <= DISTANCE_SPIKE && self.timers.skill3 === 0) {
            keysPressed[self.keys.skill3] = true;
            return;
        }

        if (distance > DISTANCE_SPIKE && self.timers.skill2 === 0) {
            keysPressed[self.keys.skill2] = true;
            return;
        }

        if (distance <= DISTANCE_MELEE) {
            if (self.timers.skill1 === 0) keysPressed[self.keys.skill1] = true;
            else if (self.timers.attack === 0) keysPressed[self.keys.attack] = true;
        }
        
        if (distance > DISTANCE_SPIKE) {
            keysPressed[self.x < opponent.x ? self.keys.right : self.keys.left] = true;
        } else if (distance < DISTANCE_MELEE && decision < 0.5) {
             keysPressed[self.x < opponent.x ? self.keys.left : self.keys.right] = true;
        }
    }

    // --- Proyektil Class ---
    class Projectile {
        constructor(x, y, direction, damage) {
            this.x = x; this.y = y; this.width = 15; this.height = 5;
            this.speed = 15; this.damage = damage; this.direction = direction;
        }
        update() { this.x += this.speed * this.direction; }
        draw() { ctx.fillStyle = '#f1c40f'; ctx.fillRect(this.x, this.y, this.width, this.height); }
        getHitbox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    }

    // --- Game Loop dan Logic ---

    function gameLoop(currentTime) {
        if (!isGameActive) return;

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        heroBlue.update(deltaTime, keysPressed, heroRed);
        heroRed.update(deltaTime, keysPressed, heroBlue);
        
        updateProjectiles(deltaTime);
        handleAttacks();
        
        if (heroBlue.health <= 0 || heroRed.health <= 0) {
            gameOver();
        } else {
            draw();
            requestAnimationFrame(gameLoop);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#666'; ctx.fillRect(0, FLOOR, GAME_WIDTH, GAME_HEIGHT - FLOOR);
        
        heroBlue.draw();
        heroRed.draw();
        
        projectiles.forEach(p => p.draw());
    }

    function updateProjectiles(deltaTime) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            projectiles[i].update(deltaTime);
            if (projectiles[i].x < -100 || projectiles[i].x > GAME_WIDTH + 100) projectiles.splice(i, 1);
        }
        
        [heroBlue, heroRed].forEach(hero => {
            if (hero.currentAction === 'skill2' && hero.timers.animation > 400 && hero.timers.animation <= 500) {
                const opponentX = hero.isPlayerOne ? heroRed.x : heroBlue.x;
                const direction = hero.x < opponentX ? 1 : -1;
                
                const newProjectile = new Projectile(
                    hero.x + hero.width / 2, hero.y - hero.height / 2, direction, DAMAGE.skill2
                );
                projectiles.push(newProjectile);
                hero.timers.animation = 399;
            }
        });
    }
    
    function handleAttacks() {
        [heroBlue, heroRed].forEach((attacker, index) => {
            const defender = index === 0 ? heroRed : heroBlue;
            
            if (attacker.currentAction !== 'idle' && attacker.currentAction !== 'moving' && attacker.currentAction !== 'skill2') {
                const attackBox = attacker.getAttackHitbox();
                let damage = 0;
                let hitOnce = true;

                if (attacker.currentAction === 'attack') damage = DAMAGE.attack;
                else if (attacker.currentAction === 'skill1') damage = DAMAGE.skill1;
                else if (attacker.currentAction === 'skill3') { damage = attacker.maxHealth * DAMAGE.skill3_ratio; hitOnce = false; }
                
                if (checkAABB(attackBox, defender.getHitbox())) {
                    if (damage > 0) applyDamage(defender, damage);
                    if (hitOnce) attacker.currentAction = 'idle'; 
                }
            }
        });
        
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            if (checkAABB(proj.getHitbox(), heroBlue.getHitbox())) { applyDamage(heroBlue, proj.damage); projectiles.splice(i, 1); }
            else if (checkAABB(proj.getHitbox(), heroRed.getHitbox())) { applyDamage(heroRed, proj.damage); projectiles.splice(i, 1); }
        }
    }
    
    function checkAABB(rect1, rect2) {
        if (!rect1 || !rect2) return false;
        return (rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
                rect1.y < rect2.y + rect2.height && rect1.y + rect2.height > rect2.y);
    }
    
    function applyDamage(target, amount) {
        target.health -= amount; 
        target.health = Math.max(0, target.health);
        updateHealthDisplay(heroBlue, heroRed);
    }

    function updateHealthDisplay(blueHero, redHero) {
        blueHealthBar.style.width = `${blueHero.health}%`;
        redHealthBar.style.width = `${redHero.health}%`;
        blueHealthBar.style.backgroundColor = blueHero.health < 30 ? 'yellow' : '#3498db';
        redHealthBar.style.backgroundColor = redHero.health < 30 ? 'yellow' : '#e74c3c';
    }

    function gameOver() {
        isGameActive = false;
        let winner;
        if (heroBlue.health > 0) { winner = "BLUE HERO WINS!"; finalResult.style.color = '#3498db'; } 
        else if (heroRed.health > 0) { winner = "RED HERO WINS!"; finalResult.style.color = '#e74c3c'; } 
        else { winner = "DRAW!"; finalResult.style.color = '#f1c40f'; }
        finalResult.textContent = winner;
        statusMessage.classList.remove('hidden');
    }

    function handleDifficultyChange(e) {
        const newDifficulty = e.currentTarget.dataset.level;
        if (botDifficulty === newDifficulty) return;
        
        botDifficulty = newDifficulty;
        difficultyDisplay.textContent = newDifficulty.toUpperCase();
        diffButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        initGame();
    }

    // --- Inisialisasi (Dengan Initial Cooldown) ---
    function initGame() {
        const keysBlue = { attack: 'f', skill1: 'g', skill2: 'h', skill3: 'j', jump: 'w', left: 'a', right: 'd' };
        const keysRed = { attack: 'k', skill1: 'l', skill2: ';', skill3: "'", jump: ' ', left: 'ArrowLeft', right: 'ArrowRight' };

        heroBlue = new Hero(150, '#3498db', keysBlue, true, false); 
        heroRed = new Hero(GAME_WIDTH - 150 - 40, '#e74c3c', keysRed, false, true); 

        // Terapkan INITIAL COOLDOWN
        for (const skill in heroBlue.timers) {
            if (skill !== 'animation' && heroBlue.maxCooldowns[skill]) {
                heroBlue.timers[skill] = heroBlue.maxCooldowns[skill];
                heroRed.timers[skill] = heroRed.maxCooldowns[skill];
            }
        }

        projectiles = [];
        isGameActive = true;
        
        difficultyDisplay.textContent = botDifficulty.toUpperCase();
        statusMessage.classList.add('hidden');
        updateHealthDisplay(heroBlue, heroRed);
        lastTime = performance.now();
        
        requestAnimationFrame(gameLoop);
    }
    
    document.addEventListener('keydown', (e) => {
        keysPressed[e.key] = true;
        if (!isGameActive && e.key === 'Enter') initGame();
    });
    document.addEventListener('keyup', (e) => { keysPressed[e.key] = false; });
    restartButton.addEventListener('click', initGame);
    diffButtons.forEach(btn => btn.addEventListener('click', handleDifficultyChange));

    initGame();
});