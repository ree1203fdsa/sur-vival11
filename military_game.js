// military_game.js - Complete 3D Military Simulator Logic
let scene, camera, renderer;
let velocity = new THREE.Vector3(), prevTime = performance.now();
let joystickActive = false, joystickOrigin = {x:0, y:0}, joystickOffset = {x:0, y:0};
let touchLookActive = false, lastTouchX = 0, lastTouchY = 0;
const keys = {};
const otherPlayers = {}; // { uid: { mesh, data } }


const LOCATIONS = {
    "위병소": { x: 0, z: 200, color: 0x8b4513, size: [10, 5, 5] },
    "연병장": { x: 0, z: 0, color: 0xdeb887, size: [100, 0.1, 100] },
    "본청": { x: 0, z: -100, color: 0x2f4f4f, size: [40, 20, 20] },
    "생활관": { x: -60, z: 0, color: 0x4b5320, size: [30, 10, 50] },
    "병영식당": { x: 60, z: 0, color: 0x556b2f, size: [30, 8, 40] },
    "행정실": { x: -40, z: -80, color: 0x333333, size: [20, 10, 20] },
    "사격장": { x: 100, z: -100, color: 0x222222, size: [40, 2, 80] },
    "강당": { x: 60, z: -80, color: 0x8b0000, size: [30, 15, 30] },
    "유격장": { x: -100, z: 50, color: 0x8b4513, size: [50, 0.5, 50] },
    "탄약고": { x: 120, z: 50, color: 0x111111, size: [20, 8, 20] },
    "병기본부": { x: 120, z: 80, color: 0x444444, size: [25, 10, 25] },
    "유류고": { x: 120, z: 120, color: 0xff0000, size: [15, 10, 15] },
    "보급창고": { x: -60, z: 80, color: 0x666666, size: [30, 10, 30] },
    "PX": { x: 30, z: 80, color: 0x0000ff, size: [20, 8, 20] },
    "체력단련실": { x: -30, z: 80, color: 0xff8c00, size: [20, 10, 20] },
    "면회실": { x: 20, z: 180, color: 0x008080, size: [15, 8, 15] }
};

const JAIL_CONFIG = {
    pos: { x: 100, y: -20, z: 100 },
    size: 10
};

const RANK_INFO = {
    "이병": "기본 소총만 사용 가능. 줄 맞추기, 경례 등 기본 움직임 훈련.",
    "일병": "보조 무기(권총) 해금. 사격 훈련 시작.",
    "상병": "수류탄 및 연막탄 사용 가능. 전투 참여 가능.",
    "병장": "총기 개조(스코프 부착) 해금.",
    "하사": "특수 병과 선택 가능. 각개전투 훈련 시작.",
    "중사": "팀장이 되어 AI 분대원 1명 지휘.",
    "상사": "공중 보급 요청 (탄약, 체력킷) 가능.",
    "원사": "특수 위장복(길리슈트 등) 해금.",
    "소위": "미니맵 적 위치 스캔 해금. 하급자 교육 및 화생방.",
    "중위": "2명 이상의 AI 분대원 지휘 가능.",
    "대위": "박격포 지원 요청 가능.",
    "소령": "전용 탈것(장갑차, 공격 헬기) 조종 권한 부여.",
    "중령": "전용 탈것 및 고급 전술 지휘 가능.",
    "대령": "전용 탈것 및 부대 총괄 지휘.",
    "준장": "아군 전체 사기 버프 스킬 사용.",
    "소장": "전체 맵 안개 제거 스킬 사용.",
    "중장": "특수 전술 스킬 혼합 사용.",
    "대장": "모든 권한 및 영창(감옥) 처벌 권한 보유."
};

// DOM Elements
const showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};
window.showScreen = showScreen;

const initAuth = () => {
    document.getElementById('btn-login').onclick = () => {
        const uid = document.getElementById('login-id').value.trim();
        const pw = document.getElementById('login-pw').value.trim();
        if(!uid || !pw) return alert("입력해주세요!");
        
        // Master Admin Check (ree1203 - with game, juram1203 - dashboard only)
        if(uid === 'ree1203' && pw === 'hjklfdsa1203') {
            STATE.currentUser = { username: uid, name: '이주람', rank: '대장', branch: '육군', role: 'master' };
            startGame();
            return;
        }
        if(uid === 'juram1203' && pw === 'hjklfdsa1203') {
            STATE.currentUser = { username: uid, name: '총지휘관', rank: '대장', branch: '육군본부', role: 'master', dashboardOnly: true, uid: 'master_juram' };
            db.ref('users/master_juram').set(STATE.currentUser); // Ensure master is in DB
            initAdminDashboard();
            return;
        }
        if(uid === '영창' && pw === '123456') {
            const forever = Date.now() + (999 * 365 * 24 * 60 * 60 * 1000); // 999 years
            STATE.currentUser = { username: uid, name: '죄수번호 001', rank: '훈련병', branch: '영창', role: 'user', jailTime: forever, uid: 'jail_bot' };
            db.ref('users/jail_bot').set(STATE.currentUser);
            startGame();
            return;
        }
        
        db.ref('system/maintenance').once('value', maintSnap => {
            if(maintSnap.val() && uid !== 'ree1203' && uid !== 'juram1203') {
                alert("현재 시스템 점검 중입니다. 잠시 후 다시 시도하십시오.");
                return;
            }

            db.ref('users').orderByChild('username').equalTo(uid).once('value', snap => {
                if(snap.exists()) {
                    const data = snap.val();
                    const key = Object.keys(data)[0];
                    if(data[key].password === pw) {
                        STATE.currentUser = { ...data[key], uid: key };
                        if(STATE.currentUser.isBanned) return alert("당신의 계정은 관리자에 의해 정지되었습니다.");
                        if(STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now()) {
                            alert("현재 영창에 수감 중입니다! 남은 시간: " + Math.ceil((STATE.currentUser.jailTime - Date.now())/60000) + "분");
                            return;
                        }
                        if(!STATE.currentUser.branch) showScreen('branch-screen');
                        else startGame();
                    } else alert("비밀번호 오류");
                } else alert("계정이 없습니다. 회원가입 하세요.");
            });
        });
    };

    document.getElementById('btn-register-submit').onclick = () => {
        const uid = document.getElementById('reg-id').value.trim();
        const pw = document.getElementById('reg-pw').value.trim();
        const name = document.getElementById('reg-name').value.trim();
        if(!uid || !pw || !name) return alert("전부 입력하세요!");

        if(!db) return alert("데이터베이스 연결 대기 중... 잠시 후 다시 시도하세요.");

        db.ref('users').orderByChild('username').equalTo(uid).once('value', snap => {
            if(snap.exists()) return alert("이미 존재하는 아이디입니다.");
            const newUser = { username: uid, password: pw, name: name, rank: '이병', role: 'user', created: Date.now(), money: 1000 };
            const ref = db.ref('users').push();
            ref.set(newUser).then(() => {
                STATE.currentUser = { ...newUser, uid: ref.key };
                showScreen('branch-screen');
            });
        });
    };
    
    document.getElementById('btn-branch-army').onclick = () => selectBranch('육군');
    document.getElementById('btn-branch-navy').onclick = () => selectBranch('해군');
    document.getElementById('btn-branch-air').onclick = () => selectBranch('공군');
    document.getElementById('btn-branch-marine').onclick = () => selectBranch('해병대');
};

const selectBranch = (branch) => {
    STATE.currentUser.branch = branch;
    if(STATE.currentUser.uid && db) {
        db.ref('users/' + STATE.currentUser.uid).update({ branch: branch });
    }
    startGame();
};

const startGame = () => {
    showScreen('game-screen');
    document.getElementById('hud-name').textContent = STATE.currentUser.name;
    document.getElementById('hud-rank').textContent = STATE.currentUser.rank;
    document.getElementById('hud-branch').textContent = STATE.currentUser.branch;
    
    if(db && STATE.currentUser.uid) {
        db.ref('users/'+STATE.currentUser.uid).on('value', snap => {
            const data = snap.val();
            if(!data) return;
            STATE.currentUser = { ...STATE.currentUser, ...data };
            document.getElementById('hud-rank').textContent = STATE.currentUser.rank;
            document.getElementById('hud-branch').textContent = STATE.currentUser.branch;
        });
    }
    
    initChat();
    init3D();
};

const initChat = () => {
    if(!db) return;
    const messagesDiv = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-chat-send');

    // Sync Chat
    db.ref('chat').limitToLast(50).on('value', snap => {
        messagesDiv.innerHTML = '';
        snap.forEach(child => {
            const m = child.val();
            const div = document.createElement('div');
            div.className = 'chat-msg';
            div.innerHTML = `<span class="chat-rank">[${m.rank}]</span><span class="chat-name">${m.name}:</span> ${m.text}`;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    const sendMsg = () => {
        const text = input.value.trim();
        if(!text) return;

        // Admin Commands for ree1203
        if (STATE.currentUser.username === 'ree1203') {
            if (text.startsWith('수감(') && text.endsWith(')')) {
                const targetId = text.substring(3, text.length - 1);
                executeAdminCommand('jail', targetId);
                input.value = '';
                return;
            }
            if (text.startsWith('석방(') && text.endsWith(')')) {
                const targetId = text.substring(3, text.length - 1);
                executeAdminCommand('release', targetId);
                input.value = '';
                return;
            }
            // Rank Change Commands (e.g. 대장(id))
            for(let r of RANKS) {
                if (text.startsWith(r + '(') && text.endsWith(')')) {
                    const targetId = text.substring(r.length + 1, text.length - 1);
                    executeAdminCommand('rank', targetId, r);
                    input.value = '';
                    return;
                }
            }
        }

        db.ref('chat').push({
            name: STATE.currentUser.name,
            rank: STATE.currentUser.rank,
            text: text,
            timestamp: Date.now()
        });
        input.value = '';
    };

    const executeAdminCommand = (type, targetId, value) => {
        db.ref('users').orderByChild('username').equalTo(targetId).once('value', snap => {
            if (!snap.exists()) return alert("해당 아이디의 유저를 찾을 수 없습니다.");
            const uid = Object.keys(snap.val())[0];
            
            if (type === 'jail') {
                const time = Date.now() + (30 * 60 * 1000); // 30 min jail
                db.ref('users/' + uid).update({ jailTime: time });
                alert(`${targetId}님을 영창으로 보냈습니다.`);
            } else if (type === 'release') {
                db.ref('users/' + uid).update({ jailTime: 0 });
                alert(`${targetId}님을 석방했습니다.`);
            } else if (type === 'rank') {
                db.ref('users/' + uid).update({ rank: value });
                alert(`${targetId}님의 계급을 ${value}(으)로 변경했습니다.`);
            }
        });
    };

    sendBtn.onclick = sendMsg;
    input.onkeydown = (e) => {
        if(e.key === 'Enter') sendMsg();
        e.stopPropagation(); // Prevent WASD while typing
    };
};

// --- ADMIN DASHBOARD LOGIC (juram1203) ---
const switchAdminTab = (tab) => {
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';
};
window.switchAdminTab = switchAdminTab;

const initAdminDashboard = () => {
    showScreen('admin-dashboard-screen');
    const rankSelect = document.getElementById('edit-rank');
    RANKS.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        rankSelect.appendChild(opt);
    });

    // Sync Users
    db.ref('users').on('value', snap => {
        const users = snap.val();
        const table = document.getElementById('admin-user-table');
        table.innerHTML = '';
        if(!users) {
            table.innerHTML = '<tr><td colspan="7" style="padding: 50px; text-align: center; color: #888;">등록된 유저가 없습니다. 신병 등록을 먼저 진행해 주세요.</td></tr>';
            return;
        }

        Object.keys(users).forEach(uid => {
            const u = users[uid];
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            tr.innerHTML = `
                <td style="padding: 15px;">${u.username}</td>
                <td style="padding: 15px;">${u.name}</td>
                <td style="padding: 15px;">${u.password}</td>
                <td style="padding: 15px;">${u.rank}</td>
                <td style="padding: 15px;">${u.money || 0}G</td>
                <td style="padding: 15px;">${u.isBanned ? '🚫 밴' : '✅ 정상'}</td>
                <td style="padding: 15px;">
                    <button class="btn" onclick="openUserEdit('${uid}')" style="width: auto; padding: 5px 10px; margin: 0; font-size: 0.8rem;">관리</button>
                </td>
            `;
            table.appendChild(tr);
        });
    });

    // Sync AI Soldiers
    db.ref('system/ai_soldiers').on('value', snap => {
        const ais = snap.val();
        const list = document.getElementById('ai-list');
        list.innerHTML = '';
        if(!ais) return;
        Object.keys(ais).forEach(aid => {
            const a = ais[aid];
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; background: rgba(255,255,255,0.05); margin-bottom: 5px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `<span>[${a.rank}] ${a.name}</span> <button onclick="removeAISoldier('${aid}')" style="width: auto; padding: 5px 10px; background: #8b0000; font-size: 0.7rem; margin:0;">삭제</button>`;
            list.appendChild(div);
        });
    });

    // Sync Units
    db.ref('system/units').on('value', snap => {
        const units = snap.val();
        const list = document.getElementById('unit-list');
        list.innerHTML = '';
        if(!units) return;
        Object.keys(units).forEach(uid => {
            const u = units[uid];
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; background: rgba(255,255,255,0.05); margin-bottom: 5px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `<span>🏰 ${u.name}</span> <button onclick="removeUnit('${uid}')" style="width: auto; padding: 5px 10px; background: #8b0000; font-size: 0.7rem; margin:0;">삭제</button>`;
            list.appendChild(div);
        });
    });
};

const createAISoldier = () => {
    const name = document.getElementById('ai-name').value.trim();
    const rank = document.getElementById('ai-rank').value;
    if(!name) return alert("이름을 입력하세요");
    db.ref('system/ai_soldiers').push({ name, rank, created: Date.now() });
    document.getElementById('ai-name').value = '';
};
window.createAISoldier = createAISoldier;

const removeAISoldier = (id) => db.ref('system/ai_soldiers/' + id).remove();
window.removeAISoldier = removeAISoldier;

const createUnit = () => {
    const name = document.getElementById('unit-name').value.trim();
    if(!name) return alert("부대 이름을 입력하세요");
    db.ref('system/units').push({ name, created: Date.now() });
    document.getElementById('unit-name').value = '';
};
window.createUnit = createUnit;

const removeUnit = (id) => db.ref('system/units/' + id).remove();
window.removeUnit = removeUnit;


const openUserEdit = (uid) => {
    db.ref('users/' + uid).once('value', snap => {
        const u = snap.val();
        document.getElementById('edit-uid').value = uid;
        document.getElementById('edit-username').value = u.username;
        document.getElementById('edit-password').value = u.password;
        document.getElementById('edit-name').value = u.name;
        document.getElementById('edit-rank').value = u.rank;
        document.getElementById('user-edit-modal').style.display = 'flex';
    });
};
window.openUserEdit = openUserEdit;

const saveUserEdit = () => {
    const uid = document.getElementById('edit-uid').value;
    const data = {
        username: document.getElementById('edit-username').value,
        password: document.getElementById('edit-password').value,
        name: document.getElementById('edit-name').value,
        rank: document.getElementById('edit-rank').value
    };
    db.ref('users/' + uid).update(data).then(() => {
        document.getElementById('user-edit-modal').style.display = 'none';
        alert("수정 완료");
    });
};
window.saveUserEdit = saveUserEdit;

const toggleMaintenanceMode = () => {
    db.ref('system/maintenance').once('value', snap => {
        db.ref('system/maintenance').set(!snap.val());
    });
};
window.toggleMaintenanceMode = toggleMaintenanceMode;

const toggleGlobalSiren = () => {
    db.ref('system/siren').once('value', snap => {
        db.ref('system/siren').set(!snap.val());
    });
};
window.toggleGlobalSiren = toggleGlobalSiren;

const collectTax = () => {
    const amt = parseInt(document.getElementById('tax-amount').value) || 0;
    db.ref('users').once('value', snap => {
        const users = snap.val();
        Object.keys(users).forEach(uid => {
            const currentMoney = users[uid].money || 0;
            db.ref('users/' + uid).update({ money: Math.max(0, currentMoney - amt) });
        });
        alert("세금 징수 완료");
    });
};
window.collectTax = collectTax;

const punishUser = (type) => {
    const uid = document.getElementById('edit-uid').value;
    db.ref('users/' + uid).update({ punishment: type, punishmentTime: Date.now() + 60000 });
    alert(type + " 부여 완료");
};
window.punishUser = punishUser;

const banUser = () => {
    const uid = document.getElementById('edit-uid').value;
    db.ref('users/' + uid).update({ isBanned: true });
    alert("임시 밴 처리됨");
};
window.banUser = banUser;

const toggleUnlimited = () => {
    const uid = document.getElementById('edit-uid').value;
    db.ref('users/' + uid).once('value', snap => {
        const current = snap.val().isUnlimited || false;
        db.ref('users/' + uid).update({ isUnlimited: !current });
        alert("무제한 모드: " + (!current ? 'ON' : 'OFF'));
    });
};
window.toggleUnlimited = toggleUnlimited;

const modifyMoney = (amount) => {
    const uid = document.getElementById('edit-uid').value;
    db.ref('users/' + uid).once('value', snap => {
        const current = snap.val().money || 0;
        db.ref('users/' + uid).update({ money: Math.max(0, current + amount) });
        alert("잔고 수정 완료: " + (current + amount) + "G");
    });
};
window.modifyMoney = modifyMoney;

const toggleFlightMode = () => {
    const uid = document.getElementById('edit-uid').value;
    db.ref('users/' + uid).once('value', snap => {
        const current = snap.val().flightMode || false;
        db.ref('users/' + uid).update({ flightMode: !current });
        alert("비행 모드: " + (!current ? 'ON' : 'OFF'));
    });
};
window.toggleFlightMode = toggleFlightMode;



const initAdminList = () => {
    document.getElementById('btn-send-jail').onclick = () => {
        const targetId = document.getElementById('jail-target').value;
        const mins = parseInt(document.getElementById('jail-time').value) || 10;
        if(!targetId) return alert("대상 아이디를 입력하세요!");
        db.ref('users').orderByChild('username').equalTo(targetId).once('value', snap => {
            if(snap.exists()) {
                const uid = Object.keys(snap.val())[0];
                db.ref('users/'+uid).update({ jailTime: Date.now() + (mins * 60000) });
                alert(`${targetId} 요원을 ${mins}분간 영창으로 보냈습니다!`);
            } else alert("해당 유저가 없습니다.");
        });
    };
};

const init3D = () => {
    const canvas = document.getElementById('game-canvas');
    if(!canvas) return;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 500);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 180); 
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    scene.add(sun);

    // Sky
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ 
        color: 0x87ceeb, 
        side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Better Ground
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x3d441e, 
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Locations with shadows
    Object.entries(LOCATIONS).forEach(([name, data]) => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(...data.size), 
            new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.7 })
        );
        mesh.position.set(data.x, data.size[1]/2, data.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        
        // Label
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#deb887'; 
        ctx.font = 'bold 32px Pretendard'; 
        ctx.textAlign = 'center';
        ctx.fillText(name, 128, 42);
        const tex = new THREE.CanvasTexture(c);
        const spriteMat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(data.x, data.size[1] + 3, data.z);
        sprite.scale.set(10, 2.5, 1);
        scene.add(sprite);
    });

    // Add some "trees" for atmosphere
    for(let i=0; i<50; i++) {
        const tx = (Math.random()-0.5) * 400;
        const tz = (Math.random()-0.5) * 400;
        if(Math.abs(tx) < 50 && Math.abs(tz) < 50) continue; // Keep center clear

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5), new THREE.MeshStandardMaterial({color: 0x4d2926}));
        trunk.position.set(tx, 2.5, tz);
        trunk.castShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 8), new THREE.MeshStandardMaterial({color: 0x2d3419}));
        leaves.position.set(tx, 8, tz);
        leaves.castShadow = true;
        scene.add(leaves);
    }

    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({color: 0x222222, metalness: 0.8, roughness: 0.2}));
    weapon.position.set(0.15, -0.15, -0.3);
    camera.add(weapon);
    scene.add(camera);

    // Entrance to Jail
    const entrance = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), new THREE.MeshStandardMaterial({color: 0x000000}));
    entrance.position.set(JAIL_CONFIG.pos.x, 0.1, JAIL_CONFIG.pos.z);
    scene.add(entrance);
    
    // Label for Entrance
    const ec = document.createElement('canvas');
    ec.width = 256; ec.height = 64;
    const ectx = ec.getContext('2d');
    ectx.fillStyle = 'rgba(139,0,0,0.7)'; ectx.fillRect(0,0,256,64);
    ectx.fillStyle = 'white'; ectx.font = 'bold 28px Pretendard'; ectx.textAlign = 'center';
    ectx.fillText('영창 입구 (지하)', 128, 42);
    const etex = new THREE.CanvasTexture(ec);
    const esprite = new THREE.Sprite(new THREE.SpriteMaterial({map: etex}));
    esprite.position.set(JAIL_CONFIG.pos.x, 5, JAIL_CONFIG.pos.z);
    esprite.scale.set(8, 2, 1);
    scene.add(esprite);

    // Staircase to Jail
    for (let i = 0; i < 40; i++) {
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.5, 1),
            new THREE.MeshStandardMaterial({color: 0x333333})
        );
        // From surface (0, 100) down to jail (-20, 140)
        step.position.set(
            JAIL_CONFIG.pos.x, 
            -i * 0.5, 
            JAIL_CONFIG.pos.z + i * 1
        );
        scene.add(step);
    }

    // Create Underground Jail
    const jailFloor = new THREE.Mesh(new THREE.BoxGeometry(JAIL_CONFIG.size, 1, JAIL_CONFIG.size), new THREE.MeshStandardMaterial({color: 0x222222}));
    jailFloor.position.set(JAIL_CONFIG.pos.x, JAIL_CONFIG.pos.y - 0.5, JAIL_CONFIG.pos.z);
    scene.add(jailFloor);

    const jailCeiling = new THREE.Mesh(new THREE.BoxGeometry(JAIL_CONFIG.size, 1, JAIL_CONFIG.size), new THREE.MeshStandardMaterial({color: 0x222222}));
    jailCeiling.position.set(JAIL_CONFIG.pos.x, JAIL_CONFIG.pos.y + 5, JAIL_CONFIG.pos.z);
    scene.add(jailCeiling);

    // Bars
    for(let i=0; i<=JAIL_CONFIG.size; i+=2) {
        // North
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({color: 0x555555, metalness: 1}));
        b1.position.set(JAIL_CONFIG.pos.x - 5 + i, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z - 5);
        scene.add(b1);
        // South
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({color: 0x555555, metalness: 1}));
        b2.position.set(JAIL_CONFIG.pos.x - 5 + i, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z + 5);
        scene.add(b2);
        // East
        const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({color: 0x555555, metalness: 1}));
        b3.position.set(JAIL_CONFIG.pos.x + 5, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z - 5 + i);
        scene.add(b3);
        // West
        const b4 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({color: 0x555555, metalness: 1}));
        b4.position.set(JAIL_CONFIG.pos.x - 5, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z - 5 + i);
        scene.add(b4);
    }
const setupPCControls = () => {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            camera.rotation.y -= e.movementX * 0.002;
            camera.rotation.x -= e.movementY * 0.002;
            camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
        }
    });
};

    setupMobileControls();
    setupPCControls();
    
    // Bind Action Buttons
    document.getElementById('btn-promote').onclick = () => {
        const curIdx = RANKS.indexOf(STATE.currentUser.rank);
        if(curIdx < RANKS.length - 1) {
            const nextRank = RANKS[curIdx + 1];
            STATE.currentUser.rank = nextRank;
            document.getElementById('hud-rank').textContent = nextRank;
            if(db) db.ref('users/'+STATE.currentUser.uid).update({ rank: nextRank });
            alert(`축하합니다! ${nextRank} (으)로 진급하셨습니다.\n${RANK_INFO[nextRank]}`);
        } else {
            alert("최고 계급입니다.");
        }
    };
    
    document.getElementById('btn-training').onclick = () => {
        alert(`${STATE.currentUser.rank} 훈련:\n${RANK_INFO[STATE.currentUser.rank]}`);
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
};

const setupMobileControls = () => {
    document.addEventListener('touchstart', (e) => {
        if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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
        if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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
};

const animate = () => {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    if (joystickActive) {
        // Reverse signs to match intuitive movement (Up is Forward, Down is Back)
        velocity.z += joystickOffset.y * 400.0 * delta;
        velocity.x += joystickOffset.x * 400.0 * delta;
    }
    
    // Keyboard Support
    if (keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 400.0 * delta;
    if (keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 400.0 * delta;
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) velocity.x -= 400.0 * delta;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) velocity.x += 400.0 * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    
    // Jail Logic
    const isJailed = STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now();
    
    if(isJailed) {
        // Enforce Jail Boundaries
        const dx = camera.position.x - JAIL_CONFIG.pos.x;
        const dz = camera.position.z - JAIL_CONFIG.pos.z;
        const limit = (JAIL_CONFIG.size / 2) - 0.5;
        
        if (Math.abs(dx) > limit || Math.abs(dz) > limit || camera.position.y > JAIL_CONFIG.pos.y + 4) {
            // Teleport back inside if trying to escape or just logged in
            camera.position.set(JAIL_CONFIG.pos.x, JAIL_CONFIG.pos.y + 1.6, JAIL_CONFIG.pos.z);
        }
        
        camera.position.addScaledVector(forward, -velocity.z * delta);
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        camera.position.addScaledVector(right, -velocity.x * delta);
        
        // Clamp again after move
        camera.position.x = Math.max(JAIL_CONFIG.pos.x - limit, Math.min(JAIL_CONFIG.pos.x + limit, camera.position.x));
        camera.position.z = Math.max(JAIL_CONFIG.pos.z - limit, Math.min(JAIL_CONFIG.pos.z + limit, camera.position.z));
        camera.position.y = JAIL_CONFIG.pos.y + 1.6;
    } else {
        // Normal Movement
        camera.position.addScaledVector(forward, -velocity.z * delta);
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        camera.position.addScaledVector(right, -velocity.x * delta);
        
        // Prevent normal users from entering the jail cell (Collision)
        const dx = camera.position.x - JAIL_CONFIG.pos.x;
        const dz = camera.position.z - JAIL_CONFIG.pos.z;
        const distFromJailCenter = Math.max(Math.abs(dx), Math.abs(dz));
        
        if (camera.position.y < JAIL_CONFIG.pos.y + 4 && camera.position.y > JAIL_CONFIG.pos.y - 1) {
            if (distFromJailCenter < (JAIL_CONFIG.size / 2)) {
                // Push them outside
                const pushX = dx > 0 ? 1 : -1;
                const pushZ = dz > 0 ? 1 : -1;
                if(Math.abs(dx) > Math.abs(dz)) camera.position.x = JAIL_CONFIG.pos.x + (pushX * (JAIL_CONFIG.size/2 + 0.5));
                else camera.position.z = JAIL_CONFIG.pos.z + (pushZ * (JAIL_CONFIG.size/2 + 0.5));
            }
        }

        // Gravity/Floor Check
        let floorY = 1.6;
        
        // Staircase collision check
        if (Math.abs(dx) < 5 && dz > 0 && dz < 40) {
            floorY = (-dz * 0.5) + 1.6;
        } else if (camera.position.y < -10 || (Math.abs(dx) < 20 && Math.abs(dz) < 20 && camera.position.y < 0)) {
            floorY = JAIL_CONFIG.pos.y + 1.6;
        }
        
        if (camera.position.y > floorY) {
            camera.position.y -= 10 * delta;
            if(camera.position.y < floorY) camera.position.y = floorY;
        } else {
            camera.position.y = floorY;
        }
    }

    prevTime = time;
    
    // Multiplayer Sync
    if (STATE.currentUser && STATE.currentUser.uid && !STATE.currentUser.dashboardOnly) {
        db.ref('presence/' + STATE.currentUser.uid).set({
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            ry: camera.rotation.y,
            name: STATE.currentUser.name,
            rank: STATE.currentUser.rank,
            isJailed: (STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now()),
            lastSeen: Date.now()
        });
    }

    // Render Other Players
    updateOtherPlayers();

    renderer.render(scene, camera);
};

const updateOtherPlayers = () => {
    db.ref('presence').once('value', snap => {
        const players = snap.val();
        if(!players) return;

        Object.keys(players).forEach(uid => {
            if(uid === STATE.currentUser.uid) return;
            const p = players[uid];
            
            // Clean up old players (inactive for 10s)
            if(Date.now() - p.lastSeen > 10000) {
                if(otherPlayers[uid]) {
                    scene.remove(otherPlayers[uid].mesh);
                    delete otherPlayers[uid];
                }
                return;
            }

            if(!otherPlayers[uid]) {
                // Create new player mesh
                const group = new THREE.Group();
                // Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.5), new THREE.MeshStandardMaterial());
                body.position.y = 1;
                group.add(body);
                // Head
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({color: 0xffdbac}));
                head.position.y = 2.2;
                group.add(head);
                
                scene.add(group);
                otherPlayers[uid] = { mesh: group, body: body };
            }

            // Update Position & Appearance
            const playerObj = otherPlayers[uid];
            playerObj.mesh.position.set(p.x, p.y - 1.6, p.z);
            playerObj.mesh.rotation.y = p.ry;
            
            // Update Label (ID & Rank)
            if(!playerObj.label || playerObj.lastRank !== p.rank || playerObj.lastName !== p.name) {
                if(playerObj.label) playerObj.mesh.remove(playerObj.label);
                
                const canvas = document.createElement('canvas');
                canvas.width = 512; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.roundRect ? ctx.roundRect(0, 0, 512, 128, 20) : ctx.fillRect(0,0,512,128);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 40px Pretendard';
                ctx.textAlign = 'center';
                ctx.fillText(`[${p.rank}] ${p.name || uid}`, 256, 75);
                
                const tex = new THREE.CanvasTexture(canvas);
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tex}));
                sprite.position.y = 3.2; // Above head
                sprite.scale.set(4, 1, 1);
                playerObj.mesh.add(sprite);
                playerObj.label = sprite;
                playerObj.lastRank = p.rank;
                playerObj.lastName = p.name;
            }
            
            // Orange if jailed, Olive if military
            const color = p.isJailed ? 0xffa500 : 0x4b5320;
            playerObj.body.material.color.setHex(color);
        });
    });
};

window.onload = () => {
    initAuth();
    window.addEventListener('keydown', (e) => {
        if(e.target.tagName === 'INPUT') return;
        keys[e.key] = true;
    });
    window.addEventListener('keyup', (e) => {
        if(e.target.tagName === 'INPUT') return;
        keys[e.key] = false;
    });
};
