// survival.js - Juram OS Survival Game Core
const SURVIVAL = {
    canvas: null,
    ctx: null,
    player: {
        x: 2000,
        y: 2000,
        speed: 5,
        hp: 100,
        maxHp: 100,
        stamina: 100,
        maxStamina: 100,
        level: 1,
        exp: 0,
        inventory: ['axe', 'pickaxe', 'apple', 'meat'],
        activeSlot: 0,
        angle: 0
    },
    camera: { x: 0, y: 0 },
    world: { width: 4000, height: 4000 },
    trees: [],
    rocks: [],
    animals: [],
    particles: [],
    keys: {},
    lastTime: 0,
    gameTime: 0, // Day/Night
    initialized: false,

    init: () => {
        if (SURVIVAL.initialized) return;
        SURVIVAL.canvas = document.getElementById('survival-canvas');
        if (!SURVIVAL.canvas) return;
        SURVIVAL.ctx = SURVIVAL.canvas.getContext('2d');
        
        SURVIVAL.resize();
        window.addEventListener('resize', SURVIVAL.resize);
        
        window.addEventListener('keydown', e => SURVIVAL.keys[e.code] = true);
        window.addEventListener('keyup', e => SURVIVAL.keys[e.code] = false);
        
        // 클릭/터치 이벤트 (동작 구현)
        SURVIVAL.canvas.addEventListener('mousedown', (e) => SURVIVAL.handleAction(e));
        const actionBtn = document.getElementById('survival-action-btn');
        if (actionBtn) actionBtn.addEventListener('click', () => SURVIVAL.handleAction({ clientX: window.innerWidth/2, clientY: window.innerHeight/2, isBtn: true }));
        
        // 슬롯 선택
        document.querySelectorAll('.inventory-slot').forEach(slot => {
            slot.onclick = (e) => {
                document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('active'));
                slot.classList.add('active');
                SURVIVAL.player.activeSlot = parseInt(slot.dataset.index);
                playSound('click');
            };
        });

        SURVIVAL.generateWorld();
        SURVIVAL.initialized = true;
        requestAnimationFrame(SURVIVAL.loop);
        console.log("Survival Game Upgraded & Initialized");
    },

    resize: () => {
        SURVIVAL.canvas.width = SURVIVAL.canvas.clientWidth;
        SURVIVAL.canvas.height = SURVIVAL.canvas.clientHeight;
    },

    generateWorld: () => {
        // 나무 생성
        for (let i = 0; i < 150; i++) {
            SURVIVAL.trees.push({
                x: Math.random() * SURVIVAL.world.width,
                y: Math.random() * SURVIVAL.world.height,
                hp: 100,
                id: i
            });
        }
        // 바위 생성
        for (let i = 0; i < 80; i++) {
            SURVIVAL.rocks.push({
                x: Math.random() * SURVIVAL.world.width,
                y: Math.random() * SURVIVAL.world.height,
                hp: 100,
                id: i
            });
        }
        // 동물 생성 (돼지)
        for (let i = 0; i < 20; i++) {
            SURVIVAL.animals.push({
                x: Math.random() * SURVIVAL.world.width,
                y: Math.random() * SURVIVAL.world.height,
                type: 'pig',
                hp: 50,
                targetX: Math.random() * SURVIVAL.world.width,
                targetY: Math.random() * SURVIVAL.world.height,
                speed: 1.5
            });
        }
    },

    update: (dt) => {
        const p = SURVIVAL.player;
        let dx = 0;
        let dy = 0;

        if (SURVIVAL.keys['KeyW'] || SURVIVAL.keys['ArrowUp']) dy -= 1;
        if (SURVIVAL.keys['KeyS'] || SURVIVAL.keys['ArrowDown']) dy += 1;
        if (SURVIVAL.keys['KeyA'] || SURVIVAL.keys['ArrowLeft']) dx -= 1;
        if (SURVIVAL.keys['KeyD'] || SURVIVAL.keys['ArrowRight']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
            p.x += dx * p.speed;
            p.y += dy * p.speed;
            p.angle = Math.atan2(dy, dx);
            
            // 경계 제한
            p.x = Math.max(0, Math.min(SURVIVAL.world.width, p.x));
            p.y = Math.max(0, Math.min(SURVIVAL.world.height, p.y));
        }

        // 카메라 추적
        SURVIVAL.camera.x = p.x - SURVIVAL.canvas.width / 2;
        SURVIVAL.camera.y = p.y - SURVIVAL.canvas.height / 2;

        // 동물 AI 간단 구현
        SURVIVAL.animals.forEach(a => {
            const dist = Math.sqrt((a.targetX - a.x)**2 + (a.targetY - a.y)**2);
            if (dist < 10) {
                a.targetX = Math.random() * SURVIVAL.world.width;
                a.targetY = Math.random() * SURVIVAL.world.height;
            } else {
                const angle = Math.atan2(a.targetY - a.y, a.targetX - a.x);
                a.x += Math.cos(angle) * a.speed;
                a.y += Math.sin(angle) * a.speed;
            }
        });

        // 시간 흐름 (Day/Night)
        SURVIVAL.gameTime += 0.001;
        
        // 자동 체력 회복
        if (p.hp < p.maxHp && p.hp > 0) p.hp += 0.01;

        // HUD 업데이트
        const hpBar = document.getElementById('survival-hp-bar');
        if (hpBar) hpBar.style.width = (p.hp / p.maxHp * 100) + '%';
        const stBar = document.getElementById('survival-stamina-bar');
        if (stBar) stBar.style.width = (p.stamina / p.maxStamina * 100) + '%';
    },

    handleAction: (e) => {
        const p = SURVIVAL.player;
        const rect = SURVIVAL.canvas.getBoundingClientRect();
        
        let mx, my;
        if (e.isBtn) {
            // 버튼 클릭시 캐릭터 앞쪽 50px 위치 조사
            mx = p.x + Math.cos(p.angle) * 60;
            my = p.y + Math.sin(p.angle) * 60;
        } else {
            mx = (e.clientX - rect.left) + SURVIVAL.camera.x;
            my = (e.clientY - rect.top) + SURVIVAL.camera.y;
        }

        // 도구 사용 로직
        const tool = p.inventory[p.activeSlot];
        
        // 1. 나무 베기
        SURVIVAL.trees.forEach(t => {
            const dist = Math.sqrt((t.x - mx)**2 + (t.y - my)**2);
            if (dist < 50 && tool === 'axe') {
                t.hp -= 20;
                SURVIVAL.spawnParticle(t.x, t.y, '#5d4037');
                if (t.hp <= 0) {
                    p.exp += 10;
                    t.x = -1000; // 제거
                    showToast("🪵 나무 원목을 획득했습니다!", "success");
                }
            }
        });

        // 2. 바위 채광
        SURVIVAL.rocks.forEach(r => {
            const dist = Math.sqrt((r.x - mx)**2 + (r.y - my)**2);
            if (dist < 50 && tool === 'pickaxe') {
                r.hp -= 20;
                SURVIVAL.spawnParticle(r.x, r.y, '#9e9e9e');
                if (r.hp <= 0) {
                    p.exp += 15;
                    r.x = -1000;
                    showToast("🪨 돌 조각을 획득했습니다!", "success");
                }
            }
        });

        // 공격 애니메이션 (단순화)
        const btn = document.getElementById('survival-action-btn');
        if (btn) {
            btn.style.transform = 'scale(0.8)';
            setTimeout(() => btn.style.transform = 'scale(1)', 100);
        }
    },

    spawnParticle: (x, y, color) => {
        for(let i=0; i<5; i++){
            SURVIVAL.particles.push({
                x, y, color,
                vx: (Math.random()-0.5)*10,
                vy: (Math.random()-0.5)*10,
                life: 1.0
            });
        }
    },

    draw: () => {
        const ctx = SURVIVAL.ctx;
        const cam = SURVIVAL.camera;
        ctx.clearRect(0, 0, SURVIVAL.canvas.width, SURVIVAL.canvas.height);

        // 배경 그리드
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        for (let x = -cam.x % 100; x < SURVIVAL.canvas.width; x += 100) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SURVIVAL.canvas.height); ctx.stroke();
        }
        for (let y = -cam.y % 100; y < SURVIVAL.canvas.height; y += 100) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SURVIVAL.canvas.width, y); ctx.stroke();
        }

        // 바위 그리기
        SURVIVAL.rocks.forEach(r => {
            const rx = r.x - cam.x;
            const ry = r.y - cam.y;
            if (rx > -50 && rx < SURVIVAL.canvas.width + 50 && ry > -50 && ry < SURVIVAL.canvas.height + 50) {
                ctx.fillStyle = '#9e9e9e';
                ctx.beginPath(); ctx.arc(rx, ry, 25, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#757575';
                ctx.beginPath(); ctx.arc(rx-5, ry-5, 10, 0, Math.PI*2); ctx.fill();
            }
        });

        // 나무 그리기
        SURVIVAL.trees.forEach(t => {
            const tx = t.x - cam.x;
            const ty = t.y - cam.y;
            if (tx > -50 && tx < SURVIVAL.canvas.width + 50 && ty > -100 && ty < SURVIVAL.canvas.height + 50) {
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(tx - 8, ty, 16, 30);
                ctx.fillStyle = '#2e7d32';
                ctx.beginPath(); ctx.arc(tx, ty - 15, 30, 0, Math.PI * 2); ctx.fill();
            }
        });

        // 동물 그리기
        SURVIVAL.animals.forEach(a => {
            const ax = a.x - cam.x;
            const ay = a.y - cam.y;
            ctx.fillStyle = '#f8bbd0';
            ctx.beginPath(); ctx.ellipse(ax, ay, 20, 15, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(ax+10, ay-5, 2, 0, Math.PI*2); ctx.fill();
        });

        // 파티클
        SURVIVAL.particles = SURVIVAL.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.05;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - cam.x, p.y - cam.y, 4, 4);
            ctx.globalAlpha = 1.0;
            return p.life > 0;
        });

        // 플레이어
        const px = SURVIVAL.player.x - cam.x;
        const py = SURVIVAL.player.y - cam.y;
        
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(SURVIVAL.player.angle);
        
        // 몸체
        ctx.fillStyle = '#64b5f6';
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
        // 앞 표시
        ctx.fillStyle = '#fff';
        ctx.fillRect(10, -5, 15, 10);
        
        ctx.restore();

        // 낮/밤 효과 오버레이
        const nightVal = Math.max(0, Math.sin(SURVIVAL.gameTime) * 0.5);
        if (nightVal > 0) {
            ctx.fillStyle = `rgba(0, 0, 50, ${nightVal})`;
            ctx.fillRect(0, 0, SURVIVAL.canvas.width, SURVIVAL.canvas.height);
        }
    },

    loop: (time) => {
        const dt = time - SURVIVAL.lastTime;
        SURVIVAL.lastTime = time;
        
        SURVIVAL.update(dt);
        SURVIVAL.draw();
        
        requestAnimationFrame(SURVIVAL.loop);
    }
};
