document.addEventListener('DOMContentLoaded', () => {
    // utilitários
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const rand = (a, b) => Math.random() * (b - a) + a;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // canvas
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) { console.error('Canvas não encontrado. Verifique se index.html tem <canvas id="gameCanvas">'); return; }
    const ctx = canvas.getContext('2d');
    let W = canvas.width, H = canvas.height;

    // entrada
    const input = { keys: {}, mouse: { x: W / 2, y: H / 2, down: false } };
    window.addEventListener('keydown', e => { input.keys[e.key.toLowerCase()] = true; if (e.key === 'r') game.reset(); });
    window.addEventListener('keyup', e => { input.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', e => {
        const r = canvas.getBoundingClientRect();
        input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', () => input.mouse.down = true);
    canvas.addEventListener('mouseup', () => input.mouse.down = false);

    // Player
    class Player {
        constructor(x, y) { this.x = x; this.y = y; this.r = 18; this.speed = 220; this.hp = 100; this.inv = 0; this.cool = 0; }
        update(dt) {
            let vx = (input.keys['d'] || input.keys['arrowright'] ? 1 : 0) - (input.keys['a'] || input.keys['arrowleft'] ? 1 : 0);
            let vy = (input.keys['s'] || input.keys['arrowdown'] ? 1 : 0) - (input.keys['w'] || input.keys['arrowup'] ? 1 : 0);
            const len = Math.hypot(vx, vy) || 1;
            this.x = clamp(this.x + (vx / len) * this.speed * dt, this.r, W - this.r);
            this.y = clamp(this.y + (vy / len) * this.speed * dt, this.r, H - this.r);
            this.inv = Math.max(0, this.inv - dt);
            this.cool = Math.max(0, this.cool - dt);
        }
        swing() { if (this.cool === 0) { this.cool = 0.35; return true } return false }
        draw() {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.beginPath(); ctx.ellipse(0, 15, 20, 8, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fillStyle = '#a6e3a1'; ctx.fill();
            const ang = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
            ctx.fillStyle = '#052'; ctx.beginPath(); ctx.arc(Math.cos(ang) * 6, Math.sin(ang) * 6, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }

    // Enemy
    class Enemy {
        constructor(x, y, type = 'grunt') {
            this.x = x; this.y = y; this.type = type;
            this.r = (type === 'grunt' ? 14 : 22);
            this.speed = (type === 'grunt' ? 80 : 50);
            this.hp = (type === 'grunt' ? 20 : 60);
            this.color = (type === 'grunt' ? '#ff8b8b' : '#ffb86b');
        }
        update(dt, player) {
            const dx = player.x - this.x, dy = player.y - this.y;
            const d = Math.hypot(dx, dy) || 1;
            this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt;
        }
        draw() {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
            ctx.fillStyle = '#201'; ctx.beginPath(); ctx.arc(-this.r / 3, -3, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(this.r / 4, -3, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }

    // Game manager
    class Game {
        constructor() {
            this.player = new Player(W / 2, H / 2);
            this.enemies = [];
            this.score = 0;
            this.best = Number(localStorage.getItem('hs')) || 0;
            this.wave = 1;
            this.spawnCount = 0;
            this.spawnTimer = 0;
            this.gameOver = false;
            this.last = performance.now();
            this.setupUI();
            this.spawnWave();
        }

        setupUI() {
            this.elScore = document.getElementById('score');
            this.elHp = document.getElementById('hp');
            this.elBest = document.getElementById('best');
            this.elWave = document.getElementById('wave');
            const btn = document.getElementById('btnRestart');
            if (btn) btn.addEventListener('click', () => this.reset());
        }

        updateUI() {
            if (this.elScore) this.elScore.textContent = Math.floor(this.score);
            if (this.elHp) this.elHp.textContent = Math.max(0, Math.floor(this.player.hp));
            if (this.elBest) this.elBest.textContent = Math.floor(this.best);
            if (this.elWave) this.elWave.textContent = this.wave;
        }

        spawnWave() {
            this.spawnCount = 3 + Math.floor(this.wave * 1.5);
            this.spawnTimer = 0.4;
        }

        spawnEnemy() {
            const side = Math.floor(Math.random() * 4), pad = 40;
            let x, y;
            if (side === 0) { x = rand(pad, W - pad); y = -30; }
            else if (side === 1) { x = W + 30; y = rand(pad, H - pad); }
            else if (side === 2) { x = rand(pad, W - pad); y = H + 30; }
            else { x = -30; y = rand(pad, H - pad); }
            const t = (Math.random() < 0.85 ? 'grunt' : 'brute');
            this.enemies.push(new Enemy(x, y, t));
        }

        update(dt) {
            if (this.gameOver) return;

            // spawn
            if (this.spawnCount > 0) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) { this.spawnEnemy(); this.spawnCount--; this.spawnTimer = rand(0.35, 0.9); }
            } else if (this.enemies.length === 0) {
                this.wave++; this.spawnWave(); this.score += 50;
            }

            // player actions
            this.player.update(dt);
            if (input.mouse.down && this.player.swing()) {
                const range = 56, arc = Math.PI * 0.9;
                const center = Math.atan2(input.mouse.y - this.player.y, input.mouse.x - this.player.x);
                for (const e of this.enemies) {
                    if (dist(this.player, e) <= range + e.r) {
                        const ang = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                        const diff = Math.atan2(Math.sin(ang - center), Math.cos(ang - center));
                        if (Math.abs(diff) <= arc / 2) {
                            e.hp -= (e.type === 'grunt' ? 30 : 18);
                            e.x += Math.cos(ang) * 18; e.y += Math.sin(ang) * 18;
                            if (e.hp <= 0) this.score += (e.type === 'grunt' ? 10 : 30);
                        }
                    }
                }
            }

            // enemies update & collisions
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.update(dt, this.player);
                if (dist(e, this.player) < e.r + this.player.r - 2) {
                    if (this.player.inv <= 0) { this.player.hp -= (e.type === 'grunt' ? 8 : 14); this.player.inv = 0.9; }
                }
                if (e.hp <= 0) this.enemies.splice(i, 1);
            }

            // death / regen / best
            if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver = true; }
            if (!this.gameOver) this.player.hp = clamp(this.player.hp + 0 * dt, 0, 100);
            if (this.score > this.best) { this.best = Math.floor(this.score); localStorage.setItem('hs', this.best); }

            this.updateUI();
        }

        draw() {
            ctx.clearRect(0, 0, W, H);

            // background grid
            ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = "#fff";
            for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
            ctx.restore();

            for (const e of this.enemies) e.draw();
            this.player.draw();

            // attack arc
            if (this.player.cool > 0 && this.player.cool > 0.25) {
                const ang = Math.atan2(input.mouse.y - this.player.y, input.mouse.x - this.player.x);
                ctx.save(); ctx.translate(this.player.x, this.player.y); ctx.globalAlpha = 0.25;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 56, ang - Math.PI * 0.45, ang + Math.PI * 0.45); ctx.closePath();
                ctx.fillStyle = "#ffd19a"; ctx.fill(); ctx.restore();
            }

            if (this.gameOver) {
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "36px sans-serif"; ctx.fillText("GAME OVER", W / 2, H / 2 - 10);
                ctx.font = "16px sans-serif"; ctx.fillText("Pressione R ou Reiniciar", W / 2, H / 2 + 26);
            }
        }

        loop() {
            const now = performance.now();
            const dt = Math.min((now - this.last) / 1000, 0.06);
            this.last = now;
            this.update(dt);
            this.draw();
            requestAnimationFrame(() => this.loop());
        }

        start() { this.last = performance.now(); this.loop(); }
        reset() { this.player = new Player(W / 2, H / 2); this.enemies = []; this.score = 0; this.wave = 1; this.spawnWave(); this.gameOver = false; this.updateUI(); }
    }

    // inicializa o jogo
    const game = new Game();
    console.log('Hack & Slash: iniciando jogo');
    game.start();

});