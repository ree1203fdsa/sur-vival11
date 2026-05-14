// military_game.js - Complete 3D Military Simulator Logic
let scene, camera, renderer;
let velocity = null, prevTime = performance.now();
let joystickActive = false, joystickOrigin = { x: 0, y: 0 }, joystickOffset = { x: 0, y: 0 };
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
        if (!uid || !pw) return alert("입력해주세요!");

        // Master Admin Check (ree1203 - with game, juram1203 - dashboard only)
        if (uid === 'ree1203' && pw === 'hjklfdsa1203') {
            STATE.currentUser = { username: uid, name: '이주람', rank: '대장', branch: '육군', role: 'master', uid: 'master_ree' };
            db.ref('users/master_ree').set(STATE.currentUser); // DB에 대장 데이터 저장
            startGame();
            return;
        }
        if (uid === 'juram1203' && pw === 'hjklfdsa1203') {
            STATE.currentUser = { username: uid, name: '총지휘관', rank: '대장', branch: '육군본부', role: 'master', dashboardOnly: true, uid: 'master_juram' };
            db.ref('users/master_juram').set(STATE.currentUser); // Ensure master is in DB
            initAdminDashboard();
            return;
        }
        if (uid === 'minhoo2570' && pw === 'hooooooo') {
            STATE.currentUser = { username: uid, name: '김민후', rank: '준장', branch: '육군', role: 'admin', uid: 'admin_minhoo' };
            db.ref('users/admin_minhoo').set(STATE.currentUser);
            startGame();
            return;
        }
        if (uid === '한sapce' && pw === '1130') {
            STATE.currentUser = { username: uid, name: '한우주', rank: '준장', branch: '해병대', role: 'admin', uid: 'admin_han' };
            db.ref('users/admin_han').set(STATE.currentUser);
            startGame();
            return;
        }
        if (uid === '영창' && pw === '123456') {
            const forever = Date.now() + (999 * 365 * 24 * 60 * 60 * 1000); // 999 years
            STATE.currentUser = { username: uid, name: '죄수번호 001', rank: '훈련병', branch: '영창', role: 'user', jailTime: forever, uid: 'jail_bot' };
            db.ref('users/jail_bot').set(STATE.currentUser);
            startGame();
            return;
        }

        db.ref('system/maintenance').once('value', maintSnap => {
            if (maintSnap.val() && uid !== 'ree1203' && uid !== 'juram1203') {
                alert("현재 시스템 점검 중입니다. 잠시 후 다시 시도하십시오.");
                return;
            }

            db.ref('users').orderByChild('username').equalTo(uid).once('value', snap => {
                if (snap.exists()) {
                    const data = snap.val();
                    const key = Object.keys(data)[0];
                    if (data[key].password === pw) {
                        STATE.currentUser = { ...data[key], uid: key };
                        if (STATE.currentUser.isBanned) return alert("당신의 계정은 관리자에 의해 정지되었습니다.");
                        if (STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now()) {
                            alert("현재 영창에 수감 중입니다! 남은 시간: " + Math.ceil((STATE.currentUser.jailTime - Date.now()) / 60000) + "분");
                            return;
                        }
                        if (!STATE.currentUser.branch) showScreen('branch-screen');
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
        if (!uid || !pw || !name) return alert("전부 입력하세요!");

        if (!db) return alert("데이터베이스 연결 대기 중... 잠시 후 다시 시도하세요.");

        db.ref('users').orderByChild('username').equalTo(uid).once('value', snap => {
            if (snap.exists()) return alert("이미 존재하는 아이디입니다.");
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
    if (STATE.currentUser.uid && db) {
        db.ref('users/' + STATE.currentUser.uid).update({ branch: branch });
    }
    startGame();
};

const startGame = () => {
    showScreen('game-screen');
    document.getElementById('hud-name').textContent = STATE.currentUser.name;
    document.getElementById('hud-rank').textContent = STATE.currentUser.rank;
    document.getElementById('hud-branch').textContent = STATE.currentUser.branch;

    if (db && STATE.currentUser.uid) {
        db.ref('users/' + STATE.currentUser.uid).on('value', snap => {
            const data = snap.val();
            if (!data) return;
            STATE.currentUser = { ...STATE.currentUser, ...data };
            document.getElementById('hud-rank').textContent = STATE.currentUser.rank;
            document.getElementById('hud-branch').textContent = STATE.currentUser.branch;
        });
    }

    initChat();
    initTrainingCommandListener();
    init3D();
};

const initTrainingCommandListener = () => {
    db.ref('system/training_command').on('value', snap => {
        const cmd = snap.val();
        if (!cmd) return;

        // Check if user is in training ground (-140 < x,z < -60)
        const inGround = Math.abs(camera.position.x + 100) < 40 && Math.abs(camera.position.z + 100) < 40;
        if (!inGround) return;

        // 대장 계급은 훈련 열외 (이병 ~ 중장까지만 훈련 적용)
        const rankIdx = window.RANKS ? window.RANKS.indexOf(STATE.currentUser.rank) : -1;
        if (rankIdx >= 17) return;

        // Force Action
        switch (cmd.action) {
            case 'ATTENTION':
                velocity.set(0, 0, 0);
                alert("! 차렷 !");
                break;
            case 'PT':
                alert("! PT체조 시작 !");
                let jumps = 0;
                const interval = setInterval(() => {
                    if (camera.position.y <= 1.6) velocity.y = 100;
                    jumps++;
                    if (jumps >= 5) clearInterval(interval);
                }, 800);
                break;
            case 'SALUTE':
                alert("! 충성 ! (경례)");
                break;
            case 'EASE':
                alert("쉬어.");
                break;
        }
    });
};

const initChat = () => {
    if (!db) return;
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
        if (!text) return;

        // Admin Commands
        const isAdmin = ['ree1203', 'minhoo2570', '한sapce'].includes(STATE.currentUser.username);
        if (isAdmin) {
            const cmd = text.trim();
            // 1. Jail Command (Allowed for all admins)
            if (cmd.startsWith('수감(') && cmd.endsWith(')')) {
                executeAdminCommand('jail', cmd.substring(3, cmd.length - 1));
                input.value = ''; return;
            }
            if (cmd.startsWith('석방(') && cmd.endsWith(')')) {
                executeAdminCommand('release', cmd.substring(3, cmd.length - 1));
                input.value = ''; return;
            }

            // 2. Rank Command (ree1203, 한sapce only)
            if (['ree1203', '한sapce'].includes(STATE.currentUser.username)) {
                for (let r of RANKS) {
                    if (cmd.startsWith(r + '(') && cmd.endsWith(')')) {
                        executeAdminCommand('rank', cmd.substring(r.length + 1, cmd.length - 1), r);
                        input.value = ''; return;
                    }
                }
            }

            // 3. Special: Money/Clear (한sapce, ree1203 only)
            if (['ree1203', '한sapce'].includes(STATE.currentUser.username)) {
                if (cmd.startsWith('머니(') && cmd.endsWith(')')) {
                    const parts = cmd.substring(3, cmd.length - 1).split(',');
                    executeAdminCommand('money', parts[0].trim(), parseInt(parts[1]));
                    input.value = ''; return;
                }
                // 4. Training Commands (ree1203 only)
                if (STATE.currentUser.username === 'ree1203') {
                    const trainCmds = {
                        '/차렷': 'ATTENTION',
                        '/쉬어': 'EASE',
                        '/경례': 'SALUTE',
                        '/PT체조': 'PT',
                        '/앞으로갓': 'MARCH'
                    };
                    if (trainCmds[cmd]) {
                        db.ref('system/training_command').set({
                            action: trainCmds[cmd],
                            time: Date.now()
                        });
                        input.value = ''; return;
                    }
                }
            }
        } // Close if(isAdmin)

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
                } else if (type === 'money') {
                    db.ref('users/' + uid).once('value', s => {
                        const current = s.val().money || 0;
                        db.ref('users/' + uid).update({ money: current + value });
                        alert(`${targetId}님에게 ${value}G를 지급했습니다.`);
                    });
                }
            });
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') sendMsg();
            e.stopPropagation(); // Prevent WASD while typing
        };
    };

    // --- FULL ADMIN SUITE (juram1203 - 60+ Functions) ---
    const sendNotice = (type) => {
        const msg = document.getElementById('notice-msg').value.trim();
        if (!msg) return alert("공지 내용을 입력하세요.");
        if (type === 'server') {
            db.ref('system/alert').set({ text: msg, time: Date.now() });
        } else {
            db.ref('chat').push({ name: "[전체공지]", rank: "GM", text: msg, timestamp: Date.now() });
        }
        logAdminAction(`공지(${type}): ${msg}`);
    };

    const controlServer = (action) => {
        if (!confirm(`서버를 ${action} 하시겠습니까?`)) return;
        db.ref('system/server_state').set({ action, time: Date.now() });
        logAdminAction(`서버 ${action} 실행`);
    };

    const updateSystemRates = () => {
        const exp = document.getElementById('exp-rate').value;
        const drop = document.getElementById('drop-rate').value;
        db.ref('system/config').update({ expRate: exp, dropRate: drop });
        alert("시스템 배율이 변경되었습니다.");
    };

    const giveReward = () => {
        const target = document.getElementById('reward-target').value;
        const item = document.getElementById('reward-item').value;
        db.ref('users').orderByChild('username').equalTo(target).once('value', snap => {
            if (!snap.exists()) return alert("유저를 찾을 수 없습니다.");
            const uid = Object.keys(snap.val())[0];
            db.ref('users/' + uid + '/inventory').push(item);
            alert(`${target}님에게 ${item} 지급 완료`);
        });
    };

    const searchUserDetailed = () => {
        const q = document.getElementById('search-uid').value;
        db.ref('users').orderByChild('username').equalTo(q).once('value', snap => {
            if (!snap.exists()) return alert("결과 없음");
            const u = Object.values(snap.val())[0];
            alert(`[조회 결과]\n아이디: ${u.username}\n최근IP: ${u.lastIp || 'N/A'}\n마지막로그인: ${new Date(u.lastSeen).toLocaleString()}\n보유머니: ${u.money}G`);
        });
    };

    const toggleAntiCheat = (type) => {
        STATE.antiCheat = STATE.antiCheat || {};
        STATE.antiCheat[type] = !STATE.antiCheat[type];
        logAdminAction(`보안 설정 변경: ${type} -> ${STATE.antiCheat[type]}`);
        alert(`${type} 감지 모드: ${STATE.antiCheat[type] ? 'ON' : 'OFF'}`);
    };

    const manageGear = (action) => {
        const target = document.getElementById('gear-target').value;
        if (!target) return alert("대상 유저 ID를 입력하세요.");
        logAdminAction(`장비 제어 (${action}): ${target}`);
        alert(`${target} 유저의 장비를 ${action === 'delete' ? '삭제' : '강제 변경'}했습니다.`);
    };

    const checkDetailedLog = () => {
        const uid = document.getElementById('edit-uid').value;
        db.ref('users/' + uid).once('value', snap => {
            const u = snap.val();
            alert(`[상세 로그]\nIP: ${u.lastIp || '127.0.0.1'}\n기기: Browser/Mobile\n로그인 기록: ${u.lastSeen ? new Date(u.lastSeen).toLocaleString() : '기록 없음'}`);
        });
    };

    const changeNick = () => {
        const uid = document.getElementById('edit-uid').value;
        const newName = prompt("새로운 이름을 입력하세요.");
        if (!newName) return;
        db.ref('users/' + uid).update({ name: newName });
        alert("닉네임이 변경되었습니다.");
    };

    const editUserValue = (key) => {
        const uid = document.getElementById('edit-uid').value;
        const val = prompt(`${key} 수정을 위한 값을 입력하세요.`);
        if (val === null) return;
        const update = {};
        update[key] = isNaN(val) ? val : parseInt(val);
        db.ref('users/' + uid).update(update);
        alert(`${key} 수정 완료: ${val}`);
    };

    const logAdminAction = (action) => {
        if (db) db.ref('system/admin_logs').push({
            admin: 'juram1203',
            action: action,
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        });
    };

    // Make global for UI buttons
    window.sendNotice = sendNotice;
    window.controlServer = controlServer;
    window.updateSystemRates = updateSystemRates;
    window.giveReward = giveReward;
    window.searchUserDetailed = searchUserDetailed;
    window.toggleAntiCheat = toggleAntiCheat;
    window.manageGear = manageGear;
    window.checkDetailedLog = checkDetailedLog;
    window.changeNick = changeNick;
    window.editUserValue = editUserValue;
    window.logAdminAction = logAdminAction;

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
            if (!users) {
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
            if (!ais) return;
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
            if (!units) return;
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
        if (!name) return alert("이름을 입력하세요");
        db.ref('system/ai_soldiers').push({ name, rank, created: Date.now() });
        document.getElementById('ai-name').value = '';
    };
    window.createAISoldier = createAISoldier;

    const removeAISoldier = (id) => db.ref('system/ai_soldiers/' + id).remove();
    window.removeAISoldier = removeAISoldier;

    const createUnit = () => {
        const name = document.getElementById('unit-name').value.trim();
        if (!name) return alert("부대 이름을 입력하세요");
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
        if (!amount || isNaN(amount)) return alert("정확한 금액을 입력하세요.");
        const uid = document.getElementById('edit-uid').value;
        db.ref('users/' + uid).once('value', snap => {
            const u = snap.val();
            const newMoney = (u.money || 0) + amount;
            db.ref('users/' + uid).update({ money: newMoney });
            logAdminAction(`머니 수정: ${u.username} (${amount > 0 ? '+' : ''}${amount}G)`);
            alert(`${u.username}님의 잔고를 수정했습니다. (현재: ${newMoney}G)`);
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
            if (!targetId) return alert("대상 아이디를 입력하세요!");
            db.ref('users').orderByChild('username').equalTo(targetId).once('value', snap => {
                if (snap.exists()) {
                    const uid = Object.keys(snap.val())[0];
                    db.ref('users/' + uid).update({ jailTime: Date.now() + (mins * 60000) });
                    alert(`${targetId} 요원을 ${mins}분간 영창으로 보냈습니다!`);
                } else alert("해당 유저가 없습니다.");
            });
        };
    };

    const init3D = () => {
        velocity = new THREE.Vector3();
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;

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
            mesh.position.set(data.x, data.size[1] / 2, data.z);
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

        // Training Ground
        const trainingFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(80, 80),
            new THREE.MeshStandardMaterial({ color: 0x556b2f, side: THREE.DoubleSide })
        );
        trainingFloor.rotation.x = -Math.PI / 2;
        trainingFloor.position.set(-100, 0.01, -100);
        scene.add(trainingFloor);

        // Training Ground Fence/Markers
        for (let i = 0; i < 4; i++) {
            const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            marker.position.set(-100 + Math.cos(angle) * 56, 2.5, -100 + Math.sin(angle) * 56);
            scene.add(marker);
        }

        // Add some "trees" for atmosphere
        for (let i = 0; i < 50; i++) {
            const tx = (Math.random() - 0.5) * 400;
            const tz = (Math.random() - 0.5) * 400;
            if (Math.abs(tx) < 50 && Math.abs(tz) < 50) continue; // Keep center clear

            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x4d2926 }));
            trunk.position.set(tx, 2.5, tz);
            trunk.castShadow = true;
            scene.add(trunk);

            const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2d3419 }));
            leaves.position.set(tx, 8, tz);
            leaves.castShadow = true;
            scene.add(leaves);
        }

        window.localWeapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }));
        window.localWeapon.position.set(0.15, -0.15, -0.3);
        camera.add(window.localWeapon);

        // --- Third Person Camera Setup ---
        window.isThirdPerson = false;
        window.thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        window.thirdPersonCamera.position.set(0, 1.5, 5); // Behind and slightly up
        window.thirdPersonCamera.rotation.x = -0.1; // Slight downward tilt
        camera.add(window.thirdPersonCamera);

        // --- Digital Camo & Player Modeling ---
        const generateCamoTexture = (baseColorHex) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const r = (baseColorHex >> 16) & 255;
            const g = (baseColorHex >> 8) & 255;
            const b = baseColorHex & 255;
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, 0, 128, 128);
            
            for(let i=0; i<300; i++) {
                const x = Math.floor(Math.random() * 16) * 8;
                const y = Math.floor(Math.random() * 16) * 8;
                const w = (Math.floor(Math.random() * 3) + 1) * 8;
                const h = (Math.floor(Math.random() * 3) + 1) * 8;
                const type = Math.random();
                if(type > 0.6) ctx.fillStyle = 'rgba(0,0,0,0.4)';
                else if(type > 0.3) ctx.fillStyle = 'rgba(255,255,255,0.2)';
                else ctx.fillStyle = `rgba(${r/2},${g/2},${b/2}, 0.8)`;
                ctx.fillRect(x, y, w, h);
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            return tex;
        };

        const camoMaterials = {};
        const getCamoMaterial = (colorHex) => {
            if(!camoMaterials[colorHex]) camoMaterials[colorHex] = new THREE.MeshStandardMaterial({ map: generateCamoTexture(colorHex), roughness: 0.9 });
            return camoMaterials[colorHex];
        };

        const createPlayerModel = (colorHex) => {
            const group = new THREE.Group();
            const mat = getCamoMaterial(colorHex);
            const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

            // Torso (몸통)
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.4), mat);
            torso.position.y = 1.25;
            torso.userData.isCamo = true;
            group.add(torso);

            // Head (머리)
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
            head.position.y = 1.75;
            group.add(head);

            // Winter Hood (방한복 털 장식)
            const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.2), mat);
            hood.position.y = 1.55;
            hood.userData.isCamo = true;
            group.add(hood);

            // Backpack (군장)
            const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), mat);
            backpack.position.set(0, 1.25, -0.45);
            backpack.userData.isCamo = true;
            group.add(backpack);

            // Sleeping Bag (침낭)
            const sleepingBag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7), mat);
            sleepingBag.rotation.z = Math.PI / 2;
            sleepingBag.position.set(0, 1.75, -0.45);
            sleepingBag.userData.isCamo = true;
            group.add(sleepingBag);

            // Arms (팔)
            const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), mat);
            lArm.position.set(0.55, 1.25, 0);
            lArm.userData.isCamo = true;
            group.add(lArm);

            const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), mat);
            rArm.position.set(-0.55, 1.25, 0);
            rArm.userData.isCamo = true;
            group.add(rArm);

            // Legs (다리)
            const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), mat);
            lLeg.position.set(0.2, 0.55, 0);
            lLeg.userData.isCamo = true;
            group.add(lLeg);

            const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), mat);
            rLeg.position.set(-0.2, 0.55, 0);
            rLeg.userData.isCamo = true;
            group.add(rLeg);

            // Boots (전투화)
            const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.35), blackMat);
            lBoot.position.set(0.2, 0.1, 0.05);
            group.add(lBoot);

            const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.35), blackMat);
            rBoot.position.set(-0.2, 0.1, 0.05);
            group.add(rBoot);

            return group;
        };

        // Local Player Body (Visible only in 3rd person)
        window.localPlayerBody = createPlayerModel(0x4b5320);
        window.localPlayerBody.position.y = -1.6; // Offset relative to camera
        window.localPlayerLastColor = 0x4b5320;
        
        window.localPlayerBody.visible = false; 
        camera.add(window.localPlayerBody);

        scene.add(camera);

        // Entrance to Jail
        const entrance = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x000000 }));
        entrance.position.set(JAIL_CONFIG.pos.x, 0.1, JAIL_CONFIG.pos.z);
        scene.add(entrance);

        // Label for Entrance
        const ec = document.createElement('canvas');
        ec.width = 256; ec.height = 64;
        const ectx = ec.getContext('2d');
        ectx.fillStyle = 'rgba(139,0,0,0.7)'; ectx.fillRect(0, 0, 256, 64);
        ectx.fillStyle = 'white'; ectx.font = 'bold 28px Pretendard'; ectx.textAlign = 'center';
        ectx.fillText('영창 입구 (지하)', 128, 42);
        const etex = new THREE.CanvasTexture(ec);
        const esprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: etex }));
        esprite.position.set(JAIL_CONFIG.pos.x, 5, JAIL_CONFIG.pos.z);
        esprite.scale.set(8, 2, 1);
        scene.add(esprite);

        // Staircase to Jail
        for (let i = 0; i < 40; i++) {
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(10, 0.5, 1),
                new THREE.MeshStandardMaterial({ color: 0x333333 })
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
        const jailFloor = new THREE.Mesh(new THREE.BoxGeometry(JAIL_CONFIG.size, 1, JAIL_CONFIG.size), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        jailFloor.position.set(JAIL_CONFIG.pos.x, JAIL_CONFIG.pos.y - 0.5, JAIL_CONFIG.pos.z);
        scene.add(jailFloor);

        const jailCeiling = new THREE.Mesh(new THREE.BoxGeometry(JAIL_CONFIG.size, 1, JAIL_CONFIG.size), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        jailCeiling.position.set(JAIL_CONFIG.pos.x, JAIL_CONFIG.pos.y + 5, JAIL_CONFIG.pos.z);
        scene.add(jailCeiling);

        // Bars
        for (let i = 0; i <= JAIL_CONFIG.size; i += 2) {
            // North
            const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 1 }));
            b1.position.set(JAIL_CONFIG.pos.x - 5 + i, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z - 5);
            scene.add(b1);
            // South
            const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 1 }));
            b2.position.set(JAIL_CONFIG.pos.x - 5 + i, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z + 5);
            scene.add(b2);
            // East
            const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 1 }));
            b3.position.set(JAIL_CONFIG.pos.x + 5, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z - 5 + i);
            scene.add(b3);
            // West
            const b4 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 1 }));
            b4.position.set(JAIL_CONFIG.pos.x - 5, JAIL_CONFIG.pos.y + 2.5, JAIL_CONFIG.pos.z - 5 + i);
            scene.add(b4);
        }

        // --- Helicopter for ree1203 ---
        window.helicopterMesh = new THREE.Group();
        
        // Body
        const heliBody = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 10), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        heliBody.position.y = 1.5;
        window.helicopterMesh.add(heliBody);

        // Tail
        const heliTail = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        heliTail.position.set(0, 2, 8);
        window.helicopterMesh.add(heliTail);

        // Main Rotor
        window.heliRotor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 1), new THREE.MeshStandardMaterial({ color: 0x777777 }));
        window.heliRotor.position.set(0, 3.5, 0);
        window.helicopterMesh.add(window.heliRotor);

        // Tail Rotor
        window.heliTailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.5), new THREE.MeshStandardMaterial({ color: 0x777777 }));
        window.heliTailRotor.position.set(0.6, 2, 10.5);
        window.helicopterMesh.add(window.heliTailRotor);

        window.helicopterMesh.position.set(0, 0, -20);
        scene.add(window.helicopterMesh);
        
        const heliLabelCanvas = document.createElement('canvas');
        heliLabelCanvas.width = 256; heliLabelCanvas.height = 64;
        const hctx = heliLabelCanvas.getContext('2d');
        hctx.fillStyle = 'rgba(0,0,0,0.7)'; hctx.fillRect(0,0,256,64);
        hctx.fillStyle = '#ff3333'; hctx.font = 'bold 24px Pretendard'; hctx.textAlign = 'center';
        hctx.fillText('대장 전용 헬기 (F탑승)', 128, 40);
        const htex = new THREE.CanvasTexture(heliLabelCanvas);
        window.heliLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: htex }));
        window.heliLabel.position.set(0, 6, 0);
        window.heliLabel.scale.set(10, 2.5, 1);
        window.helicopterMesh.add(window.heliLabel);

        const setupPCControls = () => {
            const canvas = document.getElementById('game-canvas');
            canvas.addEventListener('click', () => {
                canvas.requestPointerLock();
            });

            document.addEventListener('mousemove', (e) => {
                if (document.pointerLockElement === canvas) {
                    camera.rotation.y -= e.movementX * 0.002;
                    camera.rotation.x -= e.movementY * 0.002;
                    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
                }
            });
        };

        setupMobileControls();
        setupPCControls();

        // Bind Action Buttons
        document.getElementById('btn-promote').onclick = () => {
            const curIdx = RANKS.indexOf(STATE.currentUser.rank);
            if (curIdx < RANKS.length - 1) {
                const nextRank = RANKS[curIdx + 1];
                STATE.currentUser.rank = nextRank;
                document.getElementById('hud-rank').textContent = nextRank;
                if (db) db.ref('users/' + STATE.currentUser.uid).update({ rank: nextRank });
                alert(`축하합니다! ${nextRank} (으)로 진급하셨습니다.\n${RANK_INFO[nextRank]}`);
            } else {
                alert("최고 계급입니다.");
            }
        };

        document.getElementById('btn-training').onclick = () => {
            alert(`${STATE.currentUser.rank} 훈련:\n${RANK_INFO[STATE.currentUser.rank]}`);
        };

        const SHOP_ITEMS = [
            { id: 'hardtack', name: '건빵 (별사탕 포함)', desc: '목이 메이지만 든든한 간식', price: 100, emoji: '🍪' },
            { id: 'sauce', name: '맛다시', desc: '어떤 밥이든 맛있게 만들어주는 마법의 양념', price: 200, emoji: '🌶️' },
            { id: 'cream', name: '위장크림', desc: '얼굴에 칠해 은폐/엄폐 능력 향상', price: 300, emoji: '🎭' },
            { id: 'mre', name: '전투식량 (발열팩)', desc: '허기 100% 회복', price: 500, emoji: '🥫' },
            { id: 'burger', name: '군대리아', desc: '일요일 아침의 특식', price: 800, emoji: '🍔' },
            { id: 'liner', name: '깔깔이 (방한복 상의 내피)', desc: '겨울철 최고의 보온 아이템', price: 1500, emoji: '🧥' },
            { id: 'armor', name: '전술 방탄복', desc: '피해량 감소', price: 2000, emoji: '🦺' },
            { id: 'scope', name: '홀로그래픽 조준경', desc: '사격 정확도 향상', price: 3000, emoji: '🔭' },
            { id: 'k2', name: 'K2C1 소총', desc: '고급형 돌격소총', price: 5000, emoji: '🔫' },
            { id: 'px_truck', name: '황금마차 호출권', desc: '이동식 PX를 내 위치로 호출', price: 7000, emoji: '🚚' },
            { id: 'heli', name: '공격 헬기 호출권', desc: '일회용 헬기 지원', price: 10000, emoji: '🚁' },
            { id: 'artillery', name: 'K9 자주포 포격 요청', desc: '지정된 위치에 막강한 화력 지원', price: 15000, emoji: '💥' }
        ];

        document.getElementById('btn-shop').onclick = () => {
            const modal = document.getElementById('shop-modal');
            const itemsContainer = document.getElementById('shop-items');
            const isMaster = STATE.currentUser.username === 'ree1203';
            document.getElementById('shop-money').textContent = isMaster ? "무제한 (∞)" : (STATE.currentUser.money || 0).toLocaleString();
            
            itemsContainer.innerHTML = '';
            SHOP_ITEMS.forEach(item => {
                const div = document.createElement('div');
                div.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.1); gap: 10px;';
                div.innerHTML = `
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 1rem; color: #fff;">${item.emoji} ${item.name}</div>
                        <div style="font-size: 0.75rem; color: #aaa; margin-top: 3px; line-height: 1.2;">${item.desc}</div>
                    </div>
                    <button class="btn" style="width: auto; padding: 8px 15px; margin: 0; background: #2e8b57; font-size: 0.85rem; border-radius: 8px; white-space: nowrap;" onclick="buyItem('${item.id}', ${item.price}, '${item.name}')">${item.price.toLocaleString()}G</button>
                `;
                itemsContainer.appendChild(div);
            });
            
            modal.style.display = 'flex';
        };

        window.buyItem = (id, price, name) => {
            if (!STATE.currentUser) return;
            const isMaster = STATE.currentUser.username === 'ree1203';
            const currentMoney = STATE.currentUser.money || 0;
            
            if (!isMaster && currentMoney < price) {
                alert(`잔고가 부족합니다! (현재: ${currentMoney}G)`);
                return;
            }
            
            const priceText = isMaster ? "무료(마스터 권한)로" : `${price.toLocaleString()}G에`;
            if (confirm(`${name}을(를) ${priceText} 구매하시겠습니까?`)) {
                if (!isMaster) {
                    const newMoney = currentMoney - price;
                    STATE.currentUser.money = newMoney;
                    document.getElementById('shop-money').textContent = newMoney.toLocaleString();
                    db.ref('users/' + STATE.currentUser.uid).update({ money: newMoney });
                }
                
                db.ref('users/' + STATE.currentUser.uid + '/inventory').push(id);
                alert(`${name} 구매 완료!`);
            }
        };

        document.getElementById('btn-inventory').onclick = () => {
            const modal = document.getElementById('inventory-modal');
            const itemsContainer = document.getElementById('inventory-items');
            
            if (!STATE.currentUser) return;
            
            itemsContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">불러오는 중...</div>';
            modal.style.display = 'flex';
            
            db.ref('users/' + STATE.currentUser.uid + '/inventory').once('value', snap => {
                const inv = snap.val();
                itemsContainer.innerHTML = '';
                
                if (!inv) {
                    itemsContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">가방이 비어 있습니다.<br>PX 상점에서 물건을 구매해 보세요!</div>';
                    return;
                }
                
                Object.keys(inv).forEach(key => {
                    const itemId = inv[key];
                    const itemData = SHOP_ITEMS.find(i => i.id === itemId);
                    if (!itemData) return;
                    
                    const div = document.createElement('div');
                    div.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.1); gap: 10px;';
                    div.innerHTML = `
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 1rem; color: #fff;">${itemData.emoji} ${itemData.name}</div>
                            <div style="font-size: 0.75rem; color: #aaa; margin-top: 3px; line-height: 1.2;">${itemData.desc}</div>
                        </div>
                        <button class="btn" style="width: auto; padding: 8px 15px; margin: 0; background: #4682b4; font-size: 0.85rem; border-radius: 8px; white-space: nowrap;" onclick="useItem('${key}', '${itemData.id}', '${itemData.name}')">사용</button>
                    `;
                    itemsContainer.appendChild(div);
                });
            });
        };

        window.useItem = (key, itemId, name) => {
            if (!STATE.currentUser) return;
            
            if (!confirm(`${name}을(를) 사용하시겠습니까?`)) return;

            db.ref('users/' + STATE.currentUser.uid + '/inventory/' + key).remove().then(() => {
                let effectMsg = "";
                if (itemId === 'hardtack') effectMsg = "건빵을 먹었습니다! 뻑뻑하지만 별사탕을 찾아 먹으니 기분이 좋아졌습니다. 🍪⭐";
                else if (itemId === 'sauce') effectMsg = "밥에 맛다시를 비벼 먹었습니다. 군침이 싹 도는 엄청난 맛입니다! 🌶️🍚";
                else if (itemId === 'cream') effectMsg = "얼굴에 위장크림을 듬뿍 발랐습니다. 이제 적의 눈에 잘 띄지 않습니다! 🎭";
                else if (itemId === 'mre') effectMsg = "전투식량 발열팩을 터뜨렸습니다. 따뜻한 밥을 먹고 체력과 허기가 100% 회복되었습니다! 😋🥫";
                else if (itemId === 'burger') effectMsg = "군대리아를 제조해서 먹었습니다. 잼과 패티의 오묘한 조화가 일품입니다. 🍔🥛";
                else if (itemId === 'liner') effectMsg = "황금빛 깔깔이를 입었습니다! 매서운 훈련장 바람에도 끄떡없는 따뜻함이 느껴집니다. 🧥✨";
                else if (itemId === 'armor') effectMsg = "전술 방탄복을 착용했습니다! 방어력이 상승해 든든합니다. 🛡️";
                else if (itemId === 'scope') effectMsg = "소총에 홀로그래픽 조준경을 부착했습니다! 시야가 뚜렷해지고 명중률이 올라갑니다. 🔭";
                else if (itemId === 'k2') effectMsg = "K2C1 소총을 장착했습니다! 최신형 소총의 위력을 발휘할 수 있습니다. 🎯";
                else if (itemId === 'px_truck') effectMsg = "🚚 황금마차를 호출했습니다! 흥겨운 음악 소리와 함께 이동식 PX가 다가옵니다.";
                else if (itemId === 'heli') effectMsg = "🚁 지원 헬기를 호출했습니다!! 하늘에서 아군 헬기가 나타나 공중 지원을 시작합니다.";
                else if (itemId === 'artillery') effectMsg = "💥 K9 자주포 포격 지원을 요청했습니다!! 잠시 후 어마어마한 굉음과 함께 지정된 좌표가 초토화됩니다!!";
                else effectMsg = `${name}을(를) 사용했습니다!`;
                
                alert(effectMsg);
                document.getElementById('btn-inventory').click(); // Refresh inventory UI
            });
        };

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            if (window.thirdPersonCamera) {
                window.thirdPersonCamera.aspect = window.innerWidth / window.innerHeight;
                window.thirdPersonCamera.updateProjectionMatrix();
            }
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // --- Voice Chat Setup (WebRTC via PeerJS) ---
        window.localAudioStream = null;
        window.activeVoiceCalls = [];

        const setupVoiceChat = () => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly || typeof Peer === 'undefined') return;
            
            // Generate a unique room/peer ID for this game instance
            const peerId = 'mil_survival_' + STATE.currentUser.uid;
            window.peer = new Peer(peerId);
            
            window.peer.on('call', (call) => {
                call.answer(); // Answer without sending our stream
                call.on('stream', (remoteStream) => {
                    const audio = new Audio();
                    audio.srcObject = remoteStream;
                    audio.autoplay = true;
                    audio.play().catch(e => console.error("Audio playback failed:", e));
                    
                    const indicator = document.getElementById('voice-indicator');
                    if (indicator) {
                        indicator.style.display = 'block';
                        indicator.textContent = '🔊 무전 수신 중...';
                        indicator.style.color = '#fff';
                        indicator.style.borderColor = '#fff';
                        indicator.style.background = 'rgba(255,255,255,0.2)';
                        indicator.style.boxShadow = '0 0 15px rgba(255,255,255,0.5)';
                    }
                    
                    call.on('close', () => {
                        if (indicator) indicator.style.display = 'none';
                    });
                });
            });
        };
        setupVoiceChat();

        animate();
    };

    const setupMobileControls = () => {
        document.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            const touch = e.touches[0];
            if (joystickActive) {
                const dx = touch.clientX - joystickOrigin.x, dy = touch.clientY - joystickOrigin.y;
                const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 75);
                const angle = Math.atan2(dy, dx);
                joystickOffset.x = Math.cos(angle) * dist / 75;
                joystickOffset.y = Math.sin(angle) * dist / 75;
                document.getElementById('joystick-knob').style.transform = `translate(${joystickOffset.x * 50}px, ${joystickOffset.y * 50}px)`;
                e.preventDefault();
            } else if (touchLookActive) {
                const dx = touch.clientX - lastTouchX, dy = touch.clientY - lastTouchY;
                camera.rotation.y -= dx * 0.005;
                camera.rotation.x -= dy * 0.005;
                camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            joystickActive = false;
            touchLookActive = false;
            joystickOffset = { x: 0, y: 0 };
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

        // Keyboard Support & Flight Logic
        if (window.inHelicopter) {
            if (keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 800.0 * delta;
            if (keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 800.0 * delta;
            if (keys['a'] || keys['A'] || keys['ArrowLeft']) camera.rotation.y += 1.5 * delta;
            if (keys['d'] || keys['D'] || keys['ArrowRight']) camera.rotation.y -= 1.5 * delta;
            if (keys['q'] || keys['Q']) camera.position.y += 20 * delta;
            if (keys['e'] || keys['E']) camera.position.y -= 20 * delta;
        } else {
            if (keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 400.0 * delta;
            if (keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 400.0 * delta;
            if (keys['a'] || keys['A'] || keys['ArrowLeft']) velocity.x -= 400.0 * delta;
            if (keys['d'] || keys['D'] || keys['ArrowRight']) velocity.x += 400.0 * delta;
        }

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();

        // Jail Logic
        const isJailed = STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now();

        if (isJailed) {
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
                    if (Math.abs(dx) > Math.abs(dz)) camera.position.x = JAIL_CONFIG.pos.x + (pushX * (JAIL_CONFIG.size / 2 + 0.5));
                    else camera.position.z = JAIL_CONFIG.pos.z + (pushZ * (JAIL_CONFIG.size / 2 + 0.5));
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

            if (window.inHelicopter) {
                floorY = 2.0; // Minimum altitude for heli
                if (camera.position.y < floorY) camera.position.y = floorY;
            } else {
                if (camera.position.y > floorY) {
                    camera.position.y -= 10 * delta;
                    if (camera.position.y < floorY) camera.position.y = floorY;
                } else {
                    camera.position.y = floorY;
                }
            }
        }

        // Sync Helicopter Mesh with Camera if flying
        if (window.helicopterMesh) {
            if (window.inHelicopter) {
                window.helicopterMesh.position.set(camera.position.x, camera.position.y - 2, camera.position.z);
                window.helicopterMesh.rotation.y = camera.rotation.y;
                if (window.heliRotor) window.heliRotor.rotation.y += 20 * delta;
                if (window.heliTailRotor) window.heliTailRotor.rotation.x += 20 * delta;
                if (window.heliLabel) window.heliLabel.visible = false;
            } else {
                if (window.heliLabel) window.heliLabel.visible = true;
                // Idle rotor spin
                if (window.heliRotor) window.heliRotor.rotation.y += 0.5 * delta;
                if (window.heliTailRotor) window.heliTailRotor.rotation.x += 0.5 * delta;
            }
        }

        prevTime = time;

        // Multiplayer Sync
        if (STATE.currentUser && STATE.currentUser.uid && !STATE.currentUser.dashboardOnly) {
            const localIsJailed = Boolean(STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now());
            db.ref('presence/' + STATE.currentUser.uid).set({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                ry: camera.rotation.y,
                name: STATE.currentUser.name || "신병",
                rank: STATE.currentUser.rank || "이병",
                isJailed: localIsJailed,
                lastSeen: Date.now()
            });

            // Update Local Player Body Color for 3rd Person View
            if (window.localPlayerBody) {
                const getRankColor = (rank, isJailed) => {
                    if (isJailed) return 0xffa500; // 영창: 주황색
                    const idx = window.RANKS ? window.RANKS.indexOf(rank) : -1;
                    if (idx >= 14) return 0x222222; // 장성급: 흑복(검정)
                    if (idx >= 11) return 0x1f305e; // 영관급: 네이비(청색)
                    if (idx >= 8) return 0xc2b280;  // 위관급: 사막색(베이지)
                    if (idx >= 4) return 0x3a4b2a;  // 부사관: 진녹색
                    return 0x4b5320;                // 병사: 일반 국방색
                };
                const targetColor = getRankColor(STATE.currentUser.rank, localIsJailed);
                if (window.localPlayerLastColor !== targetColor) {
                    window.localPlayerLastColor = targetColor;
                    const newMat = getCamoMaterial(targetColor);
                    window.localPlayerBody.traverse(child => {
                        if (child.isMesh && child.userData.isCamo) {
                            child.material = newMat;
                        }
                    });
                }
            }
        }

        // Render Other Players
        updateOtherPlayers();

        renderer.render(scene, window.isThirdPerson ? window.thirdPersonCamera : camera);
    };

    const updateOtherPlayers = () => {
        db.ref('presence').once('value', snap => {
            const players = snap.val();
            if (!players) return;

            Object.keys(players).forEach(uid => {
                if (uid === STATE.currentUser.uid) return;
                const p = players[uid];

                // Clean up old players (inactive for 10s)
                if (Date.now() - p.lastSeen > 10000) {
                    if (otherPlayers[uid]) {
                        scene.remove(otherPlayers[uid].mesh);
                        delete otherPlayers[uid];
                    }
                    return;
                }

                if (!otherPlayers[uid]) {
                    // Create new complex player mesh
                    const group = createPlayerModel(0x4b5320);
                    group.position.y = 1.6; // Initial offset
                    scene.add(group);
                    otherPlayers[uid] = { mesh: group, lastColor: 0x4b5320 };
                }

                // Update Position & Appearance
                const playerObj = otherPlayers[uid];
                playerObj.mesh.position.set(p.x, p.y - 1.6, p.z);
                playerObj.mesh.rotation.y = p.ry;

                // Update Label (ID & Rank)
                if (!playerObj.label || playerObj.lastRank !== p.rank || playerObj.lastName !== p.name) {
                    if (playerObj.label) playerObj.mesh.remove(playerObj.label);

                    const canvas = document.createElement('canvas');
                    canvas.width = 512; canvas.height = 128;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.roundRect ? ctx.roundRect(0, 0, 512, 128, 20) : ctx.fillRect(0, 0, 512, 128);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 40px Pretendard';
                    ctx.textAlign = 'center';
                    ctx.fillText(`[${p.rank}] ${p.name || uid}`, 256, 75);

                    const tex = new THREE.CanvasTexture(canvas);
                    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
                    sprite.position.y = 3.2; // Above head
                    sprite.scale.set(4, 1, 1);
                    playerObj.mesh.add(sprite);
                    playerObj.label = sprite;
                    playerObj.lastRank = p.rank;
                    playerObj.lastName = p.name;
                }

                // Rank-based Uniform Color
                const getRankColor = (rank, isJailed) => {
                    if (isJailed) return 0xffa500;
                    const idx = window.RANKS ? window.RANKS.indexOf(rank) : -1;
                    if (idx >= 14) return 0x222222; // 장성급: 흑복
                    if (idx >= 11) return 0x1f305e; // 영관급: 네이비
                    if (idx >= 8) return 0xc2b280;  // 위관급: 베이지
                    if (idx >= 4) return 0x3a4b2a;  // 부사관: 진녹색
                    return 0x4b5320;                // 병사: 일반 국방색
                };
                
                const targetColor = getRankColor(p.rank, p.isJailed);
                if (playerObj.lastColor !== targetColor) {
                    playerObj.lastColor = targetColor;
                    const newMat = getCamoMaterial(targetColor);
                    playerObj.mesh.traverse(child => {
                        if (child.isMesh && child.userData.isCamo) {
                            child.material = newMat;
                        }
                    });
                }
            });
        });
    };

window.onload = () => {
    initAuth();
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        keys[e.key] = true;
        
        // Perspective Toggle (1st/3rd Person)
        if (e.key === 'r' || e.key === 'R') {
            window.isThirdPerson = !window.isThirdPerson;
            if (window.localPlayerBody) window.localPlayerBody.visible = window.isThirdPerson;
            if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson;
        }
        
        // Helicopter Enter/Exit
        if ((e.key === 'f' || e.key === 'F') && window.helicopterMesh) {
            const hPos = window.helicopterMesh.position;
            const dist = Math.sqrt(Math.pow(camera.position.x - hPos.x, 2) + Math.pow(camera.position.z - hPos.z, 2));
            
            if (dist < 15) {
                if (STATE.currentUser.username !== 'ree1203') {
                    alert("이 헬기는 대장(ree1203) 전용입니다. 탑승 권한이 없습니다!");
                    return;
                }
                
                window.inHelicopter = !window.inHelicopter;
                if (window.inHelicopter) {
                    alert("🚁 대장 전용 헬기에 탑승했습니다!\n[조작법]\nW/S: 전진/후진\nA/D: 기수 좌우 회전\nQ/E: 고도 상승/하강\nF: 내리기");
                    camera.position.set(hPos.x, hPos.y + 2, hPos.z);
                } else {
                    alert("헬기에서 내렸습니다.");
                    camera.position.y = 1.6;
                }
            }
        }

        // Voice Chat Broadcast (P key)
        if ((e.key === 'p' || e.key === 'P') && window.peer && !window.localAudioStream) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                window.localAudioStream = stream;
                
                const indicator = document.getElementById('voice-indicator');
                if (indicator) {
                    indicator.style.display = 'block';
                    indicator.textContent = '🎙️ 전 채널 무전 송신 중...';
                    indicator.style.color = '#0f0';
                    indicator.style.borderColor = '#0f0';
                    indicator.style.background = 'rgba(0,255,0,0.2)';
                    indicator.style.boxShadow = '0 0 15px rgba(0,255,0,0.5)';
                }
                
                // Call all other active players
                Object.keys(otherPlayers).forEach(uid => {
                    const call = window.peer.call('mil_survival_' + uid, stream);
                    if (call) window.activeVoiceCalls.push(call);
                });
            }).catch(err => {
                alert("마이크 권한이 필요합니다! 브라우저 주소창 왼쪽의 자물쇠를 눌러 마이크 권한을 허용해주세요.");
            });
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.target.tagName === 'INPUT') return;
        keys[e.key] = false;

        // Stop Voice Chat Broadcast
        if ((e.key === 'p' || e.key === 'P') && window.localAudioStream) {
            window.localAudioStream.getTracks().forEach(track => track.stop());
            window.localAudioStream = null;
            
            window.activeVoiceCalls.forEach(call => call.close());
            window.activeVoiceCalls = [];
            
            const indicator = document.getElementById('voice-indicator');
            if (indicator) indicator.style.display = 'none';
        }
    });

    // --- Official Community Chat (Discord Style) ---
    let officialChatRef = null;
    window.currentOfficialChannel = 'notice';

    document.getElementById('btn-official-chat').onclick = () => {
        document.getElementById('discord-modal').style.display = 'flex';
        switchChannel('notice');
    };

    window.switchChannel = (channelId) => {
        window.currentOfficialChannel = channelId;
        
        // UI Updates
        const channelNames = {
            notice: '공지사항',
            general: '자유게시판',
            report: '훈련병-신고',
            suggestion: '건의사항'
        };
        document.getElementById('current-channel-name').textContent = channelNames[channelId];
        document.getElementById('discord-input').placeholder = `#${channelNames[channelId]}에 메시지 보내기`;
        
        // Sidebar active state
        const channels = document.querySelectorAll('.discord-channel');
        channels.forEach(ch => {
            ch.classList.toggle('active', ch.textContent === channelNames[channelId]);
        });

        // Clear messages
        const msgContainer = document.getElementById('discord-messages');
        msgContainer.innerHTML = '';

        // Firebase Sync
        if (officialChatRef) officialChatRef.off();
        officialChatRef = db.ref(`official_chat/${channelId}`).limitToLast(50);
        
        officialChatRef.on('child_added', snap => {
            const m = snap.val();
            const item = document.createElement('div');
            item.className = 'discord-msg-item';
            
            const initial = (m.name || '?')[0];
            const dateStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            item.innerHTML = `
                <div class="discord-avatar">${initial}</div>
                <div class="discord-msg-content">
                    <div class="discord-msg-header">
                        <span class="discord-msg-name">[${m.rank}] ${m.name}</span>
                        <span class="discord-msg-time">오늘 ${dateStr}</span>
                    </div>
                    <div class="discord-msg-text">${m.text}</div>
                </div>
            `;
            msgContainer.appendChild(item);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    };

    document.getElementById('discord-input').onkeydown = (e) => {
        if (e.key === 'Enter') {
            const input = e.target;
            const text = input.value.trim();
            if (!text) return;

            // Admin only for notice
            if (window.currentOfficialChannel === 'notice' && STATE.currentUser.username !== 'ree1203') {
                alert("공지사항 채널은 대장님만 작성할 수 있습니다.");
                input.value = '';
                return;
            }

            db.ref(`official_chat/${window.currentOfficialChannel}`).push({
                uid: STATE.currentUser.uid,
                name: STATE.currentUser.name || "신병",
                rank: STATE.currentUser.rank || "이병",
                text: text,
                timestamp: Date.now()
            });

            input.value = '';
        }
    };
};