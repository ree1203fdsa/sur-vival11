// military_simulator.js - 3D World and Game Logic (Stable Version)

// 1. PointerLockControls 정의 (가장 먼저 정의)
THREE.PointerLockControls = function (camera, domElement) {
    var _this = this;
    this.domElement = domElement || document.body;
    this.isLocked = false;

    function onMouseMove(event) {
        if (_this.isLocked === false) return;
        var movementX = event.movementX || 0;
        var movementY = event.movementY || 0;
        camera.rotation.y -= movementX * 0.002;
        camera.rotation.x -= movementY * 0.002;
        camera.rotation.x = Math.max(- Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }

    function onPointerlockChange() {
        if (document.pointerLockElement === _this.domElement) {
            _this.isLocked = true;
        } else {
            _this.isLocked = false;
        }
    }

    this.lock = function () { this.domElement.requestPointerLock(); };
    this.unlock = function () { document.exitPointerLock(); };

    // 이벤트 리스너 지원
    const listeners = { lock: [], unlock: [] };
    this.addEventListener = function (type, fn) { if (listeners[type]) listeners[type].push(fn); };

    function onPointerlockChange() {
        if (document.pointerLockElement === _this.domElement) {
            _this.isLocked = true;
            listeners.lock.forEach(fn => fn());
        } else {
            _this.isLocked = false;
            listeners.unlock.forEach(fn => fn());
        }
    }

    // 2. 전역 변수
    let scene, camera, renderer, controls;
    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
    let velocity = new THREE.Vector3();
    let direction = new THREE.Vector3();
    let prevTime = performance.now();

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
        console.log("Initializing Game...");
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 0, 500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.y = 1.6;
        camera.rotation.order = 'YXZ';

        renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;

        // 조명
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(50, 100, 50);
        scene.add(sun);

        // 바닥
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshStandardMaterial({ color: 0x2d3419 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);
        scene.add(new THREE.GridHelper(2000, 100, 0x000000, 0x222222));

        // 건물 추가
        Object.entries(LOCATIONS).forEach(([name, data]) => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(...data.size),
                new THREE.MeshStandardMaterial({ color: data.color })
            );
            mesh.position.set(data.x, data.size[1] / 2, data.z);
            scene.add(mesh);
        });

        // 조작기
        controls = new THREE.PointerLockControls(camera, document.body);

        controls.addEventListener('lock', () => {
            console.log("Locked!");
            document.getElementById('start-overlay').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
        });

        controls.addEventListener('unlock', () => {
            console.log("Unlocked!");
            document.getElementById('start-overlay').style.display = 'flex';
            document.getElementById('hud').style.display = 'none';
        });
        const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        weapon.position.set(0.2, -0.2, -0.4);
        camera.add(weapon);
        scene.add(camera);

        // 이벤트 리스너
        document.addEventListener('keydown', (e) => {
            console.log("KeyDown:", e.code);
            if (e.code === 'KeyW') moveForward = true;
            if (e.code === 'KeyS') moveBackward = true;
            if (e.code === 'KeyA') moveLeft = true;
            if (e.code === 'KeyD') moveRight = true;
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') moveForward = false;
            if (e.code === 'KeyS') moveBackward = false;
            if (e.code === 'KeyA') moveLeft = false;
            if (e.code === 'KeyD') moveRight = false;
        });

        document.getElementById('start-overlay').onclick = () => {
            console.log("Start Clicked");
            controls.lock();
        };

        // 스폰 지점
        if (STATE.currentUser.team === 'RAIDER') camera.position.set(150, 1.6, 150);
        else camera.position.set(0, 1.6, 100);

        initChatSync();
        // 이동 함수 재정의 (이동 로직을 위해 필수)
        controls.moveForward = function (distance) {
            var vector = new THREE.Vector3();
            camera.getWorldDirection(vector);
            vector.y = 0;
            vector.normalize();
            camera.position.addScaledVector(vector, distance);
        };
        controls.moveRight = function (distance) {
            var vector = new THREE.Vector3();
            camera.getWorldDirection(vector);
            vector.y = 0;
            vector.normalize();
            var right = new THREE.Vector3(- vector.z, 0, vector.x);
            camera.position.addScaledVector(right, distance);
        };

        animate();
    };

    const animate = () => {
        requestAnimationFrame(animate);

        const time = performance.now();
        const delta = Math.min((time - prevTime) / 1000, 0.1); // 최대 0.1초로 제한

        if (controls.isLocked) {
            // 속도 감쇄
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            // 방향 계산
            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize();

            // 가속
            if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
            if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

            // 실제 이동 적용
            controls.moveRight(-velocity.x * delta);
            controls.moveForward(-velocity.z * delta);

            // 디버그 좌표 출력 (필요시)
            // console.log("Pos:", camera.position.x, camera.position.z);
        }

        prevTime = time;
        renderer.render(scene, camera);
    };

    // --- 기능 함수들 ---
    const runPromotionExam = () => {
        const currentRank = STATE.currentUser.rank;
        const rankIndex = RANKS.indexOf(currentRank);
        if (rankIndex >= RANKS.length - 1) return alert("최고 계급입니다.");
        const nextRank = RANKS[rankIndex + 1];
        const quiz = getQuizForRank(nextRank);
        const answer = prompt(`${nextRank} 승급 시험: ${quiz.q}`);
        if (answer === quiz.a) {
            alert("승급 성공!");
            STATE.currentUser.rank = nextRank;
            document.getElementById('hud-rank').textContent = nextRank;
        }
    };

    const getQuizForRank = (rank) => {
        const q = { "일병": { q: "거수경례 각도는?", a: "45" } };
        return q[rank] || { q: "국군의 날은?", a: "10월 1일" };
    };

    const startTraining = () => alert("훈련을 시작합니다.");

    const initChatSync = () => {
        if (FIREBASE_ENABLED && db) {
            db.ref('chats').limitToLast(20).on('child_added', (snap) => {
                const data = snap.val();
                addChatMessage(data.name, data.message, data.rank, data.team);
            });
        }
    };

    const addChatMessage = (name, msg, rank, team) => {
        const chat = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.innerHTML = `<b>[${rank}] ${name}</b>: ${msg}`;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    };

    const sendMessage = (msg) => {
        if (FIREBASE_ENABLED && db) {
            db.ref('chats').push({
                name: STATE.currentUser.name,
                message: msg,
                rank: STATE.currentUser.rank,
                team: STATE.currentUser.team
            });
        }
    };

    document.getElementById('chat-input').onkeydown = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            sendMessage(e.target.value.trim());
            e.target.value = '';
        }
    }:
