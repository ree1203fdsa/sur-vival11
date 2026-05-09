// military_simulator.js - Mobile Dedicated 3D Engine

THREE.PointerLockControls = function(camera, domElement) {
    this.domElement = domElement || document.body;
    this.isLocked = true; // Always locked for mobile
    this.addEventListener = function() {};
    this.lock = function() {};
};

let scene, camera, renderer, controls;
let velocity = new THREE.Vector3(), prevTime = performance.now();
let joystickActive = false, joystickOrigin = {x:0, y:0}, joystickOffset = {x:0, y:0};
let touchLookActive = false, lastTouchX = 0, lastTouchY = 0;

const LOCATIONS = {
    "위병소": { x: 0, z: 100, color: 0x8b4513, size: [10, 5, 5] },
    "생활관": { x: -30, z: 50, color: 0x4b5320, size: [20, 10, 30] },
    "병영식당": { x: 30, z: 50, color: 0x556b2f, size: [20, 8, 20] },
    "연병장": { x: 0, z: -40, color: 0xdeb887, size: [80, 0.1, 60] },
    "사격장": { x: 80, z: -40, color: 0x333333, size: [30, 2, 80] },
    "본청": { x: 0, z: -100, color: 0x2f4f4f, size: [40, 20, 20] },
    "동굴(비밀기지)": { x: 150, z: 150, color: 0x222222, size: [30, 20, 30] }
};

const initGame = () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 500);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 1.6;
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x2d3419 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    Object.entries(LOCATIONS).forEach(([name, data]) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...data.size), new THREE.MeshStandardMaterial({ color: data.color }));
        mesh.position.set(data.x, data.size[1]/2, data.z);
        scene.add(mesh);
    });

    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({color: 0x333333}));
    weapon.position.set(0.15, -0.15, -0.3);
    camera.add(weapon);
    scene.add(camera);

    // Mobile Touch Logic
    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const joyRect = document.getElementById('joystick-container').getBoundingClientRect();
        const dist = Math.sqrt(Math.pow(touch.clientX - (joyRect.left + 75), 2) + Math.pow(touch.clientY - (joyRect.top + 75), 2));
        
        if (dist < 100) {
            joystickActive = true;
            joystickOrigin = { x: joyRect.left + 75, y: joyRect.top + 75 };
        } else {
            touchLookActive = true;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }
    }, {passive: false});

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (joystickActive) {
            const dx = touch.clientX - joystickOrigin.x, dy = touch.clientY - joystickOrigin.y;
            const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 75);
            const angle = Math.atan2(dy, dx);
            joystickOffset.x = Math.cos(angle) * dist / 75;
            joystickOffset.y = Math.sin(angle) * dist / 75;
            document.getElementById('joystick-knob').style.transform = `translate(${joystickOffset.x * 50}px, ${joystickOffset.y * 50}px)`;
            e.preventDefault();
        } else if (touchLookActive) {
            const dx = touch.clientX - lastTouchX, dy = touch.clientY - lastTouchY;
            camera.rotation.y -= dx * 0.005;
            camera.rotation.x -= dy * 0.005;
            camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }
    }, {passive: false});

    document.addEventListener('touchend', () => {
        joystickActive = false;
        touchLookActive = false;
        joystickOffset = {x:0, y:0};
        document.getElementById('joystick-knob').style.transform = `translate(0,0)`;
    });

    // Button Links
    document.getElementById('btn-exam').onclick = runPromotionExam;
    document.getElementById('btn-training').onclick = startTraining;
    document.getElementById('btn-salute').onclick = () => handleCommand('/경례');
    document.getElementById('btn-ease').onclick = () => handleCommand('/열중쉬어');
    document.getElementById('btn-fire').onclick = shoot;

    if (STATE.currentUser && STATE.currentUser.username === 'juram1203') {
        initAdminUI();
        initMasterUserList();
    }

    initChatSync();
    initSirenSync();
    animate();
};

const animate = () => {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    if (STATE.isSirenActive) {
        scene.background.setHSL(0, 0.5, 0.2 + Math.sin(time * 0.01) * 0.1);
        document.getElementById('siren-overlay').style.display = 'block';
    } else {
        scene.background.setHex(0x87ceeb);
        document.getElementById('siren-overlay').style.display = 'none';
    }

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    if (joystickActive) {
        velocity.z -= joystickOffset.y * 400.0 * delta;
        velocity.x -= joystickOffset.x * 400.0 * delta;
    }

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    camera.position.addScaledVector(forward, -velocity.z * delta);
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    camera.position.addScaledVector(right, -velocity.x * delta);

    prevTime = time;
    renderer.render(scene, camera);
};

// Admin UI & Functions
const initAdminUI = () => {
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('btn-siren-toggle').onclick = () => {
        const newState = !STATE.isSirenActive;
        db.ref('system/siren').set(newState);
    };
    document.getElementById('btn-send-to-jail').onclick = () => {
        const tid = document.getElementById('target-user').value.trim();
        if (tid) {
            db.ref('users').orderByChild('username').equalTo(tid).once('value', snap => {
                const users = snap.val();
                if (users) {
                    const uid = Object.keys(users)[0];
                    db.ref('users/'+uid).update({jailTime: Date.now() + 600000});
                    alert(tid + " 요원을 10분간 영창에 보냈습니다.");
                }
            });
        }
    };
};

const initMasterUserList = () => {
    const listContainer = document.getElementById('master-user-list');
    if (FIREBASE_ENABLED && db) {
        db.ref('users').on('value', snap => {
            const users = snap.val();
            if (!users) return;
            
            listContainer.innerHTML = '';
            Object.values(users).forEach(user => {
                const div = document.createElement('div');
                div.style.padding = '5px';
                div.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.cursor = 'pointer';
                div.innerHTML = `<span><b>${user.name}</b> (${user.username})</span> <span style="color:var(--gold)">${user.rank}</span>`;
                
                div.onclick = () => {
                    document.getElementById('target-user').value = user.username;
                    document.getElementById('target-user').dispatchEvent(new Event('input'));
                };
                listContainer.appendChild(div);
            });
        });
    }
};

const handleCommand = (cmd) => {
    sendMessage(`[행동] ${cmd.substring(1)}`);
};

const shoot = () => {
    const flash = new THREE.PointLight(0xffff00, 1, 2);
    flash.position.set(0.15, -0.15, -0.4);
    camera.add(flash);
    setTimeout(() => camera.remove(flash), 50);
};

const runPromotionExam = () => {
    const r = STATE.currentUser.rank;
    const idx = RANKS.indexOf(r);
    if (idx < RANKS.length - 1) {
        STATE.currentUser.rank = RANKS[idx + 1];
        document.getElementById('hud-rank').textContent = STATE.currentUser.rank;
        db.ref('users/'+STATE.currentUser.uid).update({rank: STATE.currentUser.rank});
    }
};

const startTraining = () => alert("훈련을 시작합니다!");

const initChatSync = () => {
    db.ref('chats').limitToLast(20).on('child_added', snap => {
        const d = snap.val();
        const chat = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.style.marginBottom = '5px';
        div.innerHTML = `<span style="color:var(--gold)">[${d.rank}] ${d.name}</span>: ${d.message}`;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    });
};

const initSirenSync = () => {
    db.ref('system/siren').on('value', snap => {
        STATE.isSirenActive = snap.val() || false;
    });
};

const sendMessage = (msg) => {
    db.ref('chats').push({
        name: STATE.currentUser.name,
        message: msg,
        rank: STATE.currentUser.rank,
        team: STATE.currentUser.team
    });
};

document.getElementById('btn-send-chat').onclick = () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim()) {
        sendMessage(input.value.trim());
        input.value = '';
    }
};
