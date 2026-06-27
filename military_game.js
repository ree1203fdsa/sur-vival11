// military_game.js - Complete 3D Military Simulator Logic
window.onerror = function(message, source, lineno, colno, error) {
    const msgText = message || 'Unknown Runtime Error';
    console.error("Runtime JS Error:", msgText, "at", source, ":", lineno, ":", colno);
    if (!window.errors) window.errors = [];
    window.errors.push({msg: msgText, url: source, line: lineno, col: colno, stack: error ? error.stack : ''});

    try {
        if (typeof db !== 'undefined' && db) {
            const username = (typeof STATE !== 'undefined' && STATE.currentUser) ? (STATE.currentUser.username || 'unknown') : 'guest';
            db.ref('system/runtime_errors').push({
                message: msgText,
                source: source || 'unknown',
                lineno: lineno || 0,
                colno: colno || 0,
                stack: error ? (error.stack || '') : '',
                userAgent: navigator.userAgent,
                username: username,
                timestamp: Date.now()
            });
        }
    } catch (e) {}
    return false;
};
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
    "면회실": { x: 20, z: 180, color: 0x008080, size: [15, 8, 15] },
    "심사장": { x: -100, z: -160, color: 0x1e2e1e, size: [35, 12, 25] },
    "원수실": { x: 0, z: -150, color: 0x11111a, size: [25, 12, 25] },
    "화생방실": { x: -120, z: -100, color: 0x3d352e, size: [20, 8, 20] },
    "준장실 (한우주)": { x: -60, z: -150, color: 0x1e3a8a, size: [20, 10, 20] },
    "탈의실": { x: 60, z: -150, color: 0x8b5cf6, size: [15, 8, 15] },
    "의무대": { x: -120, z: -20, color: 0xb91c1c, size: [20, 8, 20] },
    "활주로": { x: 200, z: 0, color: 0x222222, size: [50, 0.1, 300] },
    "제작진 본부 (ree1203)": { x: -25, z: -40, color: 0xff0055, size: [10, 6, 10] },
    "부제작진 본부 (한space)": { x: 25, z: -40, color: 0x3b82f6, size: [10, 6, 10] }
};

const JAIL_CONFIG = {
    pos: { x: 100, y: -20, z: 100 },
    size: 10
};

const RANK_INFO = {
    "이등병": "군 생활을 처음 시작하는 계급. 기본 군사훈련을 마친 후 자대 배치. 선임의 지시를 배우며 수행. 청소, 경계근무, 장비 정리 등 기본 업무 담당. 아직 지휘 권한 없음.",
    "일등병": "기본 업무에 익숙해진 병사. 개인 장비를 관리할 수 있음. 신병을 도와주기도 함. 각종 근무와 작업 수행. 부분적으로 책임 부여.",
    "상등병": "숙련된 병사. 분대장의 업무 보조. 후임 교육. 부대 규정 준수 지도. 중요한 임무 참여 가능.",
    "병장": "병사 최고 계급. 후임병 관리. 생활관 관리. 선임병 역할 수행. 분대 운영 보조.",
    "하사": "최초의 직업군인 계급. 분대장 임무 수행. 병사 교육 및 관리. 훈련 계획 보조. 군기 유지.",
    "중사": "숙련된 부사관. 여러 분대를 관리. 교육훈련 감독. 장비 관리. 병력 통솔.",
    "상사": "중대 핵심 부사관. 부사관 지휘. 병사 생활 관리. 각종 행정업무 지원. 훈련 전반 감독.",
    "원사": "최고참 부사관. 부대 전통 유지. 교육체계 감독. 지휘관 보좌. 부사관 대표 역할.",
    "준위": "전문 기술 전문가. 무기체계 관리. 정비 감독. 특수 기술 교육. 특정 분야 최고 전문가.",
    "소위": "초급 장교. 소대장 임무. 병력 약 30~50명 지휘. 훈련 계획 수립. 작전 수행.",
    "중위": "경험 있는 소대장. 참모 업무 수행. 작전 계획 보조. 부대 운영 지원.",
    "대위": "중대장. 약 100~200명 지휘. 훈련 총괄. 인사 및 행정 관리. 작전 책임자.",
    "소령": "대대 참모. 작전 계획 작성. 부대 운영 감독. 여러 중대 통제.",
    "중령": "대대장. 약 500~1,000명 지휘. 대대 전체 책임. 전투력 유지. 부대 운영 총괄.",
    "대령": "연대장, 여단 참모장. 수천 명 규모 병력 관리. 전략 수립. 예산 및 행정 관리.",
    "준장": "여단장. 수천 명 병력 지휘. 지역 방어 작전 책임. 부대 전투력 관리.",
    "소장": "사단장. 약 1만 명 이상 지휘. 대규모 작전 수행. 부대 전체 운영.",
    "중장": "군단장. 수만 명 병력 지휘. 광범위한 지역 방어. 여러 사단 통제.",
    "대장": "육군·해군·공군 최고 지휘관급. 국가 방위 계획 수립. 군 전체 작전 지휘.",
    "원수": "대한민국 최고 군 계급. 전시 국가 최고 군사 지휘관. 현재까지 실제 임명 사례 없음."
};

// DOM Elements
const showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};
window.showScreen = showScreen;

window.enterGameField = () => {
    const lobby = document.getElementById('lobby-screen');
    if (lobby) {
        lobby.classList.remove('active');
        lobby.style.display = 'none';
        lobby.style.opacity = '0';
        lobby.style.pointerEvents = 'none';
        lobby.style.zIndex = '0';
    }

    const game = document.getElementById('game-screen');
    if (game) {
        game.classList.add('active');
        game.style.display = 'flex';
        game.style.opacity = '1';
        game.style.zIndex = '20';
    }

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
    }
};

window.startCreatorBattleFromLobby = () => {
    window.enterGameField();
    setTimeout(() => {
        if (typeof window.summonCreatorBoss === 'function') {
            window.summonCreatorBoss('creator');
        }
    }, 700);
};

const initAuth = () => {
    document.getElementById('btn-login').onclick = () => {
        if (typeof db === 'undefined' || !db) {
            return alert("데이터베이스 연결 대기 중... 잠시 후 다시 시도하세요.");
        }
        const uid = document.getElementById('login-id').value.trim();
        const pw = document.getElementById('login-pw').value.trim();
        if (!uid || !pw) return alert("입력해주세요!");

        // Master Admin Check (ree1203 - with game, juram1203 - dashboard only)
        if (uid === 'ree1203' && (pw === 'hjklfdsa1203' || pw === 'admin')) {
            STATE.currentUser = { username: uid, name: '이주람', rank: '원수', branch: '육군', role: 'master', uid: 'master_ree', money: 999999999 };
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
        if (uid === '한Space' && pw === '1130') {
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
        if (uid === 'test' && pw === '1234') {
            STATE.currentUser = { username: uid, name: '테스트대원', rank: '이등병', branch: '육군', role: 'user', uid: 'test_user', money: 5000 };
            db.ref('users/test_user').set(STATE.currentUser);
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
            const newUser = { username: uid, password: pw, name: name, rank: '이등병', role: 'user', created: Date.now(), money: 1000 };
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

const showLobby = () => {
    try {
        // Show lobby screen active overlay
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) {
            lobbyScreen.style.display = '';
            lobbyScreen.style.opacity = '';
            lobbyScreen.style.pointerEvents = '';
            lobbyScreen.classList.add('active');
        }

        window.enterGameField = () => {
            const ls = document.getElementById('lobby-screen');
            if (ls) {
                ls.classList.remove('active');
                ls.style.display = 'none';
                ls.style.opacity = '0';
                ls.style.pointerEvents = 'none';
                ls.style.zIndex = '0';
            }

            const gs = document.getElementById('game-screen');
            if (gs) {
                gs.classList.add('active');
                gs.style.display = 'flex';
                gs.style.opacity = '1';
                gs.style.zIndex = '20';
            }

            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                canvas.style.display = 'block';
                canvas.style.opacity = '1';
            }
        };

        // Show controls guide modal once per session
        if (!sessionStorage.getItem('tacticalGuideShown')) {
            sessionStorage.setItem('tacticalGuideShown', 'true');
            setTimeout(() => {
                const gm = document.getElementById('guide-modal');
                if (gm) gm.style.display = 'flex';
            }, 800);
        }

        const updateLobbyStats = () => {
            if (!STATE.currentUser) return;
            
            const rEl = document.getElementById('lobby-rank');
            if (rEl) rEl.textContent = `[${STATE.currentUser.rank || '이등병'}]`;
            
            const nEl = document.getElementById('lobby-name');
            if (nEl) nEl.textContent = STATE.currentUser.name || '신병';
            
            const bEl = document.getElementById('lobby-branch');
            if (bEl) bEl.textContent = STATE.currentUser.branch || '육군';

            const rSel = document.getElementById('lobby-role-select');
            if (rSel) rSel.value = STATE.currentUser.militaryRole || '소총수';

            const isRee = STATE.currentUser.username === 'ree1203';
            const avatarBox = document.querySelector('#lobby-screen .avatar-box');
            if (avatarBox) {
                if (isRee) {
                    avatarBox.innerHTML = '<div style="font-size:1.65rem; line-height:1;">👑</div><div style="font-size:0.68rem; color:#f0abfc; font-weight:900; margin-top:3px;">BOSS</div>';
                    avatarBox.style.borderColor = '#d946ef';
                    avatarBox.style.boxShadow = '0 0 18px rgba(217,70,239,0.45)';
                } else {
                    avatarBox.innerHTML = '🎖️';
                    avatarBox.style.borderColor = '';
                    avatarBox.style.boxShadow = '';
                }
            }
            const rollcallBtn = document.getElementById('btn-lobby-rollcall');
            const cabinetBtn = document.getElementById('btn-lobby-cabinet');
            if (rollcallBtn) rollcallBtn.style.display = isRee ? '' : 'none';
            if (cabinetBtn) cabinetBtn.style.display = isRee ? '' : 'none';

            const money = STATE.currentUser.username === 'ree1203' ? '∞' : (STATE.currentUser.money || 0).toLocaleString();
            const mEl = document.getElementById('lobby-money');
            if (mEl) mEl.textContent = money;

            const exp = STATE.currentUser.exp || 0;
            const needed = (window.EXP_TO_RANK && window.EXP_TO_RANK[STATE.currentUser.rank]) ? window.EXP_TO_RANK[STATE.currentUser.rank] : 100;
            
            const eEl = document.getElementById('lobby-exp');
            if (eEl) eEl.textContent = exp;
            
            const emEl = document.getElementById('lobby-exp-max');
            if (emEl) emEl.textContent = needed;
            
            const efEl = document.getElementById('lobby-exp-fill');
            if (efEl) efEl.style.width = Math.min(100, (exp / needed) * 100) + '%';

            // Show/hide promotion panels
            const promoWrap = document.getElementById('lobby-promotion-wrap');
            const promoPending = document.getElementById('lobby-promotion-pending');
            if (promoWrap) {
                promoWrap.style.display = STATE.currentUser.promotionReady ? 'flex' : 'none';
            }
            if (promoPending) {
                promoPending.style.display = STATE.currentUser.promotionPending ? 'block' : 'none';
            }
        };
        // Simulated live network ping updater
        if (window.lobbyPingInterval) clearInterval(window.lobbyPingInterval);
        window.lobbyPingInterval = setInterval(() => {
            const pingEl = document.getElementById('lobby-ping');
            if (pingEl) {
                const randomPing = Math.floor(Math.random() * 15) + 18; // 18ms - 32ms
                pingEl.textContent = `PING: ${randomPing}ms`;
            }
        }, 3000);

        updateLobbyStats();

        // Listen to real-time updates for Lobby stats
        if (db && STATE.currentUser.uid) {
            db.ref('users/' + STATE.currentUser.uid).on('value', snap => {
                const data = snap.val();
                if (!data) return;
                STATE.currentUser = { ...STATE.currentUser, ...data };
                updateLobbyStats();
            });
        }

        // Connect lobby shortcut buttons to actual action buttons with safe presence checks
        const invBtn = document.getElementById('btn-lobby-inventory');
        if (invBtn) {
            invBtn.onclick = () => {
                const btn = document.getElementById('btn-inventory');
                if (btn) btn.click();
            };
        }
        
        const shopBtn = document.getElementById('btn-lobby-shop');
        if (shopBtn) {
            shopBtn.onclick = () => {
                const btn = document.getElementById('btn-shop');
                if (btn) btn.click();
            };
        }
        
        const idBtn = document.getElementById('btn-lobby-id-card');
        if (idBtn) {
            idBtn.onclick = () => {
                const btn = document.getElementById('btn-id-card');
                if (btn) btn.click();
            };
        }
        
        const leadBtn = document.getElementById('btn-lobby-leaderboard');
        if (leadBtn) {
            leadBtn.onclick = () => {
                const btn = document.getElementById('btn-leaderboard');
                if (btn) btn.click();
            };
        }

        const creatorBattleBtn = document.getElementById('btn-lobby-creator-battle');
        if (creatorBattleBtn) {
            creatorBattleBtn.onclick = () => {
                if (typeof window.enterGameField === 'function') window.enterGameField();
                
                const deployBtn = document.getElementById('btn-deploy-field');
                if (deployBtn) deployBtn.click();
                
                setTimeout(() => {
                    if (typeof window.summonCreatorBoss === 'function') {
                        window.summonCreatorBoss();
                    }
                }, 1000);
            };
        }

        // Deploy Field Button
        const deployBtn = document.getElementById('btn-deploy-field');
        if (deployBtn) {
            deployBtn.onclick = () => {
                if (typeof window.enterGameField === 'function') window.enterGameField();
                showToast("⚔️ 작전 구역에 배치되었습니다. 대기선으로 이동하세요!", "#deb887");
                
                // Request pointer lock for PC mouse looking
                const isMobile = /Mobi|Android|iPhone|iPad|PlayBook/i.test(navigator.userAgent);
                const canvas = document.getElementById('game-canvas');
                if (!isMobile && canvas && typeof canvas.requestPointerLock === 'function' && !window.joystickActive) {
                    try {
                        canvas.requestPointerLock();
                    } catch (e) {}
                }

                // Ensure Admin Panel is active on deployment
                initAdminPanel();
            };
        }
    } catch (err) {
        console.error("showLobby Error:", err);
    }
};

const initAdminPanel = () => {
    try {
        if (!STATE.currentUser) return;
        const isMaster = STATE.currentUser.username === 'ree1203' || STATE.currentUser.uid === 'master_ree' || STATE.currentUser.rank === '대장' || STATE.currentUser.rank === '원수';
        if (!isMaster) return;

        const panel = document.getElementById('admin-panel');
        if (panel) {
            panel.style.display = 'block';
        }

        const select = document.getElementById('admin-target-user');
        const populateUserList = () => {
            if (!select) return;
            db.ref('presence').once('value', snap => {
                const players = snap.val() || {};
                const originalVal = select.value;
                select.innerHTML = '<option value="">선택 안함</option>';
                
                Object.keys(players).forEach(uid => {
                    if (uid === STATE.currentUser.uid) return;
                    const p = players[uid];
                    const opt = document.createElement('option');
                    opt.value = uid;
                    opt.textContent = `${p.name || '신병'} (${p.rank || '이등병'})`;
                    select.appendChild(opt);
                });
                select.value = originalVal;
            });
        };
        populateUserList();
        setInterval(populateUserList, 5000);

        const rankSelect = document.getElementById('admin-change-rank-select');
        if (rankSelect && rankSelect.children.length === 0) {
            RANKS.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r;
                opt.textContent = r;
                rankSelect.appendChild(opt);
            });
        }

        // 🚨 비상소집
        const sirenBtn = document.getElementById('btn-admin-siren');
        if (sirenBtn) {
            sirenBtn.onclick = () => {
                if (confirm("전체 플레이어를 연병장으로 강제 소집하시겠습니까?")) {
                    db.ref('system/siren_assemble').set({ time: Date.now() });
                    showToast("🚨 비상소집 명령을 발령했습니다!", "#b91c1c");
                }
            };
        }

        // ⚡ 번개벌
        const lightningBtn = document.getElementById('btn-admin-lightning');
        if (lightningBtn) {
            lightningBtn.onclick = () => {
                const target = select.value;
                if (!target) return alert("대상을 지정해 주세요!");
                db.ref('system/lightning').set({ targetUid: target, time: Date.now() });
                showToast("⚡ 벼락 신벌을 내려쳤습니다!", "#d97706");
            };
        }

        // 🛰️ CCTV 감시
        const cctvBtn = document.getElementById('btn-admin-cctv');
        if (cctvBtn) {
            cctvBtn.onclick = () => {
                const target = select.value;
                if (!target) {
                    window.cctvTargetUid = null;
                    showToast("🛰️ CCTV 감시를 종료하고 복귀했습니다.", "#4f46e5");
                    if (window.localPlayerBody) window.localPlayerBody.visible = window.isThirdPerson;
                    return;
                }
                window.cctvTargetUid = target;
                showToast("🛰️ 실시간 감시 위성을 가동합니다...", "#4f46e5");
                if (window.localPlayerBody) window.localPlayerBody.visible = false;
            };
        }

        // 📦 보급투하
        const crateBtn = document.getElementById('btn-admin-crate');
        if (crateBtn) {
            crateBtn.onclick = () => {
                db.ref('system/supply_crate').set({ x: camera.position.x, z: camera.position.z, time: Date.now() });
                showToast("📦 현재 대장님 위치에 보급 상자를 투하했습니다!", "#059669");
            };
        }

        // 💰 머니 이벤트 (제작자 ree1203 한정 - 하늘에서 머니 드랍)
        const moneyEventBtn = document.getElementById('btn-admin-money-event');
        if (moneyEventBtn) {
            if (STATE.currentUser.username !== 'ree1203') {
                moneyEventBtn.style.display = 'none';
            }
            moneyEventBtn.onclick = () => {
                if (STATE.currentUser.username !== 'ree1203') return;
                db.ref('system/money_event').set({
                    cx: camera.position.x,
                    cz: camera.position.z,
                    time: Date.now()
                });
                showToast("💰 제작자 머니 이벤트 발동! 하늘에서 머니가 떨어집니다!", "#facc15");
            };
        }

        // ⏰ 낮밤변경
        const timeBtn = document.getElementById('btn-admin-time');
        if (timeBtn) {
            timeBtn.onclick = () => {
                db.ref('system/time_override').once('value', snap => {
                    const current = snap.val() || 0;
                    const next = current === 1 ? 0 : 1;
                    db.ref('system/time_override').set(next);
                });
            };
        }

        // 🔑 특사사면
        const pardonBtn = document.getElementById('btn-admin-pardon');
        if (pardonBtn) {
            pardonBtn.onclick = () => {
                const target = select.value;
                if (!target) return alert("사면할 대상 부하를 선택하세요!");
                db.ref('users/' + target).update({ jailTime: 0 })
                    .then(() => showToast("🔑 대상 대원을 성공적으로 특사 사면했습니다!", "#10b981"));
            };
        }

        // ⛓️ 강제 영창 송치
        const sendJailBtn = document.getElementById('btn-send-jail');
        if (sendJailBtn) {
            sendJailBtn.onclick = () => {
                const target = select.value;
                if (!target) return alert("영창에 보낼 대상을 선택하세요!");
                const min = parseInt(document.getElementById('jail-time').value) || 10;
                const releaseTime = Date.now() + (min * 60 * 1000);
                db.ref('users/' + target).update({ jailTime: releaseTime })
                    .then(() => showToast("⛓️ 대원을 영창으로 즉시 송치했습니다!", "#ef4444"));
            };
        }
    } catch (err) {
        console.error("initAdminPanel Error:", err);
    }
};

const startGame = () => {
    try {
        showScreen('game-screen');
        const hName = document.getElementById('hud-name');
        if (hName) hName.textContent = STATE.currentUser.name || '';
        const hRank = document.getElementById('hud-rank');
        if (hRank) hRank.textContent = STATE.currentUser.rank || '이등병';
        const hBranch = document.getElementById('hud-branch');
        if (hBranch) hBranch.textContent = STATE.currentUser.branch || '';

        if (db && STATE.currentUser.uid) {
            // Auto-issue Marshal's Keycard to Marshal account
            if (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수') {
                db.ref('users/' + STATE.currentUser.uid + '/inventory').once('value', snap => {
                    const inv = snap.val() || {};
                    const hasCard = Object.values(inv).includes('marshal_card');
                    if (!hasCard) {
                        db.ref('users/' + STATE.currentUser.uid + '/inventory').push('marshal_card');
                    }
                });
            }
            try { registerAllCoupons(); } catch (e) { console.error("registerAllCoupons error:", e); }
            try {
                db.ref('users/' + STATE.currentUser.uid).on('value', snap => {
                    const data = snap.val();
                    if (!data) return;
                    STATE.currentUser = { ...STATE.currentUser, ...data };
                    if (hRank) hRank.textContent = STATE.currentUser.rank || '이등병';
                    if (hBranch) hBranch.textContent = STATE.currentUser.branch || '';
                    if (typeof updateDeployedWeapons === 'function') updateDeployedWeapons();
                });
            } catch (e) {
                console.error("User db listener error:", e);
            }

            try {
                db.ref('users/' + STATE.currentUser.uid + '/isMuted').on('value', snap => {
                    if (STATE.currentUser) STATE.currentUser.isMuted = snap.val() || false;
                });
                db.ref('users/' + STATE.currentUser.uid + '/kicked').on('value', snap => {
                    if (snap.val() && snap.val() > Date.now() - 10000) {
                        alert("🚨 대장(이주람)님에 의해 서버에서 강제 퇴장되었습니다.");
                        location.reload();
                    }
                });
                db.ref('users/' + STATE.currentUser.uid + '/punishment').on('value', snap => {
                    const val = snap.val();
                    if (val) {
                        if (typeof window.triggerPunishment === 'function') {
                            window.triggerPunishment(val);
                        }
                    }
                });
                db.ref('presence/' + STATE.currentUser.uid + '/punishment').on('value', snap => {
                    const val = snap.val();
                    if (val) {
                        if (typeof window.triggerPunishment === 'function') {
                            window.triggerPunishment(val);
                        }
                    }
                });
            } catch (e) {
                console.error("Mute/Kick/Punishment listener error:", e);
            }



            try {
                // Listeners for Admin commands
                // 1. 비상소집
                db.ref('system/siren_assemble').on('value', snap => {
                    const val = snap.val();
                    if (!val || val.time < Date.now() - 5000) return;
                    showToast("🚨 대장님의 비상 소집 명령! 연병장으로 강제 이동되었습니다!", "#ff3333");
                    if (typeof camera !== 'undefined') camera.position.set(0, 1.6, 0); // parade ground
                });

                // 2. 번개벌
                db.ref('system/lightning').on('value', snap => {
                    const val = snap.val();
                    if (!val || val.time < Date.now() - 5000) return;
                    if (STATE.currentUser && STATE.currentUser.uid === val.targetUid) {
                        // Flash yellow
                        const flash = document.createElement('div');
                        flash.style.cssText = 'position:fixed; inset:0; background:#ffffaa; z-index:999999; pointer-events:none;';
                        document.body.appendChild(flash);
                        setTimeout(() => {
                            if (typeof TWEEN !== 'undefined') {
                                new TWEEN.Tween(flash.style)
                                    .to({ opacity: 0 }, 1000)
                                    .onComplete(() => flash.remove())
                                    .start();
                            } else {
                                flash.remove();
                            }
                        }, 50);

                        // Lock movement & knockback
                        window.lightningStunActive = true;
                        if (typeof velocity !== 'undefined') {
                            velocity.set((Math.random() - 0.5) * 50, 15, (Math.random() - 0.5) * 50);
                        }
                        showToast("⚡ 대장님의 하느님 번개 심판을 받아 5초간 마비되었습니다!", "#ef4444");
                        setTimeout(() => {
                            window.lightningStunActive = false;
                        }, 5000);
                    }
                });

                // 3. 보급투하
                db.ref('system/supply_crate').on('value', snap => {
                    const val = snap.val();
                    if (!val) return;
                    
                    // Render 3D crate in scene
                    if (typeof THREE !== 'undefined' && typeof scene !== 'undefined') {
                        if (window.supplyCrateMesh) scene.remove(window.supplyCrateMesh);
                        
                        const geom = new THREE.BoxGeometry(2.5, 2.5, 2.5);
                        const mat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.7, metalness: 0.2 });
                        window.supplyCrateMesh = new THREE.Mesh(geom, mat);
                        window.supplyCrateMesh.position.set(val.x, 1.25, val.z);
                        scene.add(window.supplyCrateMesh);
                    }
                    
                    showToast("📦 전장에 보급품 상자가 낙하 완료되었습니다!", "#059669");
                });

                // 3-2. 💰 머니 이벤트 - 하늘에서 랜덤으로 머니가 떨어짐
                db.ref('system/money_event').on('value', snap => {
                    const val = snap.val();
                    if (!val || val.time < Date.now() - 4000) return;
                    if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

                    showToast("💰 제작자 머니 이벤트! 하늘에서 머니가 쏟아집니다! 어서 주우세요!", "#facc15");

                    if (window.moneyEventDrops) {
                        window.moneyEventDrops.forEach(d => scene.remove(d.mesh));
                    }
                    window.moneyEventDrops = [];

                    const dropCount = 40;
                    const radius = 35;
                    const geom = new THREE.OctahedronGeometry(0.6);
                    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2 });

                    for (let i = 0; i < dropCount; i++) {
                        const mesh = new THREE.Mesh(geom, mat);
                        const angle = Math.random() * Math.PI * 2;
                        const dist = Math.random() * radius;
                        const x = val.cx + Math.cos(angle) * dist;
                        const z = val.cz + Math.sin(angle) * dist;
                        const startY = 20 + Math.random() * 15;
                        mesh.position.set(x, startY, z);
                        scene.add(mesh);
                        window.moneyEventDrops.push({
                            mesh,
                            groundY: 0.6,
                            falling: true,
                            value: 100 + Math.floor(Math.random() * 400)
                        });
                    }
                });

                // 4. 낮밤변경
                db.ref('system/time_override').on('value', snap => {
                    const val = snap.val();
                    if (val === null) return;
                    const isNight = val === 1;
                    if (typeof scene !== 'undefined') {
                        const sun = (scene && scene.children) ? scene.children.find(c => c.isDirectionalLight) : null;
                        if (sun) sun.intensity = isNight ? 0.05 : 1.0;
                        const bgColor = isNight ? 0x050510 : 0x87ceeb;
                        scene.background = new THREE.Color(bgColor);
                        if (scene.fog) scene.fog.color.setHex(bgColor);
                        if (window.skyMesh) window.skyMesh.material.color.setHex(bgColor);
                    }
                    showToast(`⏰ 부대 시간대가 ${isNight ? '야간' : '주간'}으로 강제 전환되었습니다.`, "#deb887");
                });
            } catch (e) {
                console.error("Admin system listeners error:", e);
            }
        }

        try { initChat(); } catch (e) { 
            console.error("initChat error:", e); 
            if (!window.errors) window.errors = [];
            window.errors.push({msg: "initChat error: " + e.message, url: "military_game.js", stack: e.stack});
        }
        try { initTrainingCommandListener(); } catch (e) { 
            console.error("initTrainingCommandListener error:", e); 
            if (!window.errors) window.errors = [];
            window.errors.push({msg: "initTrainingCommandListener error: " + e.message, url: "military_game.js", stack: e.stack});
        }
        try { init3D(); } catch (e) { 
            console.error("init3D error:", e); 
            if (!window.errors) window.errors = [];
            window.errors.push({msg: "init3D error: " + e.message, url: "military_game.js", stack: e.stack});
        }
        try { showLobby(); } catch (e) { 
            console.error("showLobby error:", e); 
            if (!window.errors) window.errors = [];
            window.errors.push({msg: "showLobby error: " + e.message, url: "military_game.js", stack: e.stack});
        }
        try { initAdminPanel(); } catch (e) { 
            console.error("initAdminPanel error:", e); 
            if (!window.errors) window.errors = [];
            window.errors.push({msg: "initAdminPanel error: " + e.message, url: "military_game.js", stack: e.stack});
        }

        // Authenticated Firebase Listeners for Multiplayer sync
        if (FIREBASE_ENABLED && db && STATE.currentUser && STATE.currentUser.uid) {
            try {
                // Set up onDisconnect cleanup for player presence
                db.ref('presence/' + STATE.currentUser.uid).onDisconnect().remove();

                // 1. Presence sync - child 이벤트로 변경된 유저만 수신 (성능 최적화)
                db.ref('presence').on('child_added', snap => {
                    window.allPlayersData[snap.key] = snap.val();
                });
                db.ref('presence').on('child_changed', snap => {
                    window.allPlayersData[snap.key] = snap.val();
                });
                db.ref('presence').on('child_removed', snap => {
                    delete window.allPlayersData[snap.key];
                });
                // 100ms 인터벌로 다른 플레이어 렌더링 (window를 통해 호출)
                setInterval(() => {
                    if (typeof window.updateOtherPlayers === 'function') window.updateOtherPlayers();
                }, 100);


                // 2. Blood splats sync
                db.ref('blood_splats').limitToLast(50).on('child_added', snap => {
                    const data = snap.val();
                    if (data && data.x !== undefined && data.z !== undefined) {
                        if (typeof window.spawnBloodSplatMesh === 'function') {
                            window.spawnBloodSplatMesh(data.x, data.y || 0.05, data.z);
                        }
                    }
                });

                // 3. Damage/hit events on this user
                db.ref('users/' + STATE.currentUser.uid + '/hit').on('value', snap => {
                    if (window.godModeActive) return;
                    const val = snap.val();
                    if (val && val.time && (!window.lastHitTime || val.time > window.lastHitTime)) {
                        window.lastHitTime = val.time;
                        const damage = val.damage || 25;
                        const finalDamage = window.hasArmor ? Math.round(damage * 0.5) : damage;
                        if (window.hasArmor) {
                            window.hasArmor = false;
                            showToast("🛡️ 방탄복이 충격을 일부 흡수하고 파괴되었습니다!", "#3b82f6");
                        }
                        
                        window.STATS.hp = Math.max(0, window.STATS.hp - finalDamage);
                        if (typeof updateStatBars === 'function') updateStatBars();
                        
                        showToast(`💥 ${val.shooter} 요원에게 피격당했습니다! (-${finalDamage} HP)`, "#ef4444");
                        if (typeof window.triggerDamageIndicator === 'function') {
                            window.triggerDamageIndicator(val.shooterUid);
                        }
                        
                        if (window.STATS.hp <= 0) {
                            triggerLocalPlayerDeath(val.shooter || "알 수 없는 플레이어");
                        }
                    }
                });

                db.ref('system/blood_particles_trigger').on('value', snap => {
                    const data = snap.val();
                    if (data && data.time && (!window.lastBloodParticleTime || data.time > window.lastBloodParticleTime)) {
                        window.lastBloodParticleTime = data.time;
                        if (typeof window.spawnBloodParticles === 'function') {
                            window.spawnBloodParticles(data.x, data.y, data.z);
                        }
                    }
                });

                db.ref('system/kill_feed').limitToLast(5).on('child_added', snap => {
                    const data = snap.val();
                    if (data && data.victim) {
                        const kf = document.getElementById('kill-feed');
                        if (kf) {
                            const entry = document.createElement('div');
                            entry.style.cssText = 'background: rgba(0,0,0,0.7); color: #fff; padding: 6px 12px; border-radius: 6px; border-left: 4px solid #ef4444; font-weight: bold; margin-bottom: 4px;';
                            entry.innerHTML = `<span style="color: #3b82f6;">${data.attacker || "자연"}</span> ⚔️ <span style="color: #ef4444;">${data.victim}</span> [${data.weapon || "전투"}]`;
                            kf.appendChild(entry);
                            setTimeout(() => { entry.remove(); }, 4000);
                        }
                    }
                });
            } catch (e) {
                console.error("Authenticated Firebase listeners error:", e);
            }
        }
    } catch (err) {
        console.error("startGame fatal error:", err);
    }
};

const initTrainingCommandListener = () => {
    db.ref('system/training_command').on('value', snap => {
        const cmd = snap.val();
        if (!cmd) return;

        // Check if user is in training ground (-140 < x,z < -60)
        const inGround = Math.abs(camera.position.x + 100) < 40 && Math.abs(camera.position.z + 100) < 40;
        if (!inGround) return;

        // 중장, 대장, 원수 계급은 훈련 열외 (이등병 ~ 소장까지만 훈련 적용)
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

    // Mobile Button Click Logic
    document.getElementById('btn-vehicle').onclick = () => { if (typeof tryEnterVehicle === 'function') tryEnterVehicle(); };
    document.getElementById('btn-view').onclick = () => {
        window.isThirdPerson = !window.isThirdPerson;
        if (window.localPlayerBody) window.localPlayerBody.visible = window.isThirdPerson;
        if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson && window.hasK2;
        showToast(`🎥 시점 변경: ${window.isThirdPerson ? '3인칭' : '1인칭'}`);
    };
    const patrolBtn = document.getElementById('btn-patrol');
    if (patrolBtn) {
        patrolBtn.onclick = () => {
            if (typeof window.startPatrolMission === 'function') {
                window.startPatrolMission();
            }
        };
    }
    
    const marchBtn = document.getElementById('btn-march');
    if (marchBtn) {
        marchBtn.onclick = () => {
            if (typeof window.startMarchMission === 'function') {
                window.startMarchMission();
            }
        };
    }
    
    // Voice button (Touch Start/End for P-key behavior)
    const voiceBtn = document.getElementById('btn-voice');
    const startVoice = () => {
        if (window.peer && !window.localAudioStream) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                window.localAudioStream = stream;
                document.getElementById('voice-indicator').style.display = 'block';
                Object.keys(otherPlayers).forEach(uid => {
                    const call = window.peer.call('mil_survival_' + uid, stream);
                    if (call) window.activeVoiceCalls.push(call);
                });
            });
        }
    };
    const stopVoice = () => {
        if (window.localAudioStream) {
            window.localAudioStream.getTracks().forEach(track => track.stop());
            window.localAudioStream = null;
            window.activeVoiceCalls.forEach(call => call.close());
            window.activeVoiceCalls = [];
            document.getElementById('voice-indicator').style.display = 'none';
        }
    };
    voiceBtn.ontouchstart = (e) => { e.preventDefault(); startVoice(); };
    voiceBtn.ontouchend = stopVoice;
    voiceBtn.onmousedown = startVoice;
    voiceBtn.onmouseup = stopVoice;

    setupMobileControls();
};

window.deleteChatMessage = (key) => {
    if (!db) return;
    if (confirm("이 메세지를 삭제하시겠습니까?")) {
        db.ref('chat/' + key).remove()
            .catch(err => {
                alert("삭제 실패: " + err.message);
            });
    }
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
            if (!m) return;
            const key = child.key;

            // Check if current user is Lee Ju-ram (ree1203) or Han Woo-ju (한Space)
            const canDelete = STATE.currentUser && ['ree1203', '한Space'].includes(STATE.currentUser.username);
            const delBtn = canDelete ? `<span style="color: #ff4d4d; margin-left: 8px; cursor: pointer; font-weight: 900; user-select: none;" onclick="deleteChatMessage('${key}')" title="메시지 삭제">❌</span>` : '';

            const div = document.createElement('div');
            div.className = 'chat-msg';
            if (m.uid === 'master_ree') {
                div.innerHTML = `<span class="chat-rank" style="color: #ffd700; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.8);">[👑총지휘관]</span><span class="chat-name" style="color: #ffa500; font-weight: bold;">${m.name || '이주람'}:</span> <span style="color: #ffffff; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);">${m.text || ''}</span>${delBtn}`;
            } else {
                div.innerHTML = `<span class="chat-rank">[${m.rank || '이등병'}]</span><span class="chat-name">${m.name || '신병'}:</span> ${m.text || ''}${delBtn}`;
            }
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    const sendMsg = () => {
        const text = input.value.trim();
        if (!text) return;

        if (STATE.currentUser && STATE.currentUser.isMuted) {
            alert("당신은 대장님에 의해 음소거되어 채팅을 할 수 없습니다!");
            input.value = '';
            return;
        }

        // Admin Commands
        const isAdmin = ['ree1203', '한Space'].includes(STATE.currentUser.username);
        if (isAdmin) {
            const cmd = text.trim();
            // 0. Self-discipline & Targeted Discipline Command
            if (cmd.startsWith('/얼차려') || cmd.startsWith('/군기훈련')) {
                const parts = cmd.split(' ');
                if (parts.length < 2) {
                    if (typeof showToast === 'function') showToast("사용법: /얼차려 [종류] 또는 /얼차려 [아이디] [종류]", "#ffaa00");
                    input.value = ''; return;
                }
                const typeMap = {
                    '팔굽혀펴기': 'pushups', 'pushups': 'pushups',
                    '앉았다일어서기': 'squats', 'squats': 'squats',
                    '보행': 'walking', 'walking': 'walking',
                    '뜀걸음': 'running', 'running': 'running',
                    '체력단련': 'circuit', 'circuit': 'circuit',
                    '청소': 'cleaning', 'cleaning': 'cleaning',
                    '참선': 'meditation', 'meditation': 'meditation',
                    '반성문': 'reflection', 'reflection': 'reflection',
                    '개인호': 'digging', 'digging': 'digging'
                };
                
                if (parts.length === 2) {
                    const targetPunish = typeMap[parts[1].trim()];
                    if (targetPunish) {
                        if (typeof window.triggerPunishment === 'function') {
                            window.triggerPunishment(targetPunish, true);
                        }
                    } else {
                        if (typeof showToast === 'function') showToast("알 수 없는 훈련 종류입니다.", "#ff3333");
                    }
                } else if (parts.length >= 3) {
                    const targetUser = parts[1].trim();
                    const targetPunish = typeMap[parts[2].trim()];
                    if (targetPunish) {
                        executeAdminCommand('punish', targetUser, targetPunish);
                    } else {
                        if (typeof showToast === 'function') showToast("알 수 없는 훈련 종류입니다.", "#ff3333");
                    }
                }
                input.value = ''; return;
            }

            if (cmd.startsWith('얼차려(') && cmd.endsWith(')')) {
                const inner = cmd.substring(4, cmd.length - 1);
                const parts = inner.split(',');
                if (parts.length === 2) {
                    const targetUser = parts[0].trim();
                    const rawType = parts[1].trim();
                    const typeMap = {
                        '팔굽혀펴기': 'pushups', 'pushups': 'pushups',
                        '앉았다일어서기': 'squats', 'squats': 'squats',
                        '보행': 'walking', 'walking': 'walking',
                        '뜀걸음': 'running', 'running': 'running',
                        '체력단련': 'circuit', 'circuit': 'circuit',
                        '청소': 'cleaning', 'cleaning': 'cleaning',
                        '참선': 'meditation', 'meditation': 'meditation',
                        '반성문': 'reflection', 'reflection': 'reflection',
                        '개인호': 'digging', 'digging': 'digging'
                    };
                    const targetPunish = typeMap[rawType];
                    if (targetPunish) {
                        executeAdminCommand('punish', targetUser, targetPunish);
                    } else {
                        alert("알 수 없는 훈련 종류입니다.");
                    }
                } else {
                    alert("올바른 서식: 얼차려(아이디, 종류)");
                }
                input.value = ''; return;
            }

            // 1. Jail Command (Allowed for all admins)
            if (cmd.startsWith('수감(') && cmd.endsWith(')')) {
                executeAdminCommand('jail', cmd.substring(3, cmd.length - 1));
                input.value = ''; return;
            }
            if (cmd.startsWith('석방(') && cmd.endsWith(')')) {
                executeAdminCommand('release', cmd.substring(3, cmd.length - 1));
                input.value = ''; return;
            }

            // 2. Rank Command (ree1203, 한Space only)
            if (['ree1203', '한Space'].includes(STATE.currentUser.username)) {
                for (let r of RANKS) {
                    if (cmd.startsWith(r + '(') && cmd.endsWith(')')) {
                        executeAdminCommand('rank', cmd.substring(r.length + 1, cmd.length - 1), r);
                        input.value = ''; return;
                    }
                }
            }

            // 3. Special: Money/Clear (한Space, ree1203 only)
            if (['ree1203', '한Space'].includes(STATE.currentUser.username)) {
                if (cmd.startsWith('머니(') && cmd.endsWith(')')) {
                    const parts = cmd.substring(3, cmd.length - 1).split(',');
                    executeAdminCommand('money', parts[0].trim(), parseInt(parts[1]));
                    input.value = ''; return;
                }
                // 4. Training Commands & Master Cheats (ree1203 only)
                if (STATE.currentUser.username === 'ree1203') {
                    if (cmd === '/무적' || cmd === '/god') {
                        if (typeof window.toggleGodModeAdmin === 'function') window.toggleGodModeAdmin();
                        input.value = ''; return;
                    }
                    if (cmd === '/비행' || cmd === '/fly') {
                        if (typeof window.toggleFlightModeAdmin === 'function') window.toggleFlightModeAdmin();
                        input.value = ''; return;
                    }
                    if (cmd === '/돈' || cmd === '/money') {
                        STATE.currentUser.money = 999999999;
                        db.ref('users/' + STATE.currentUser.uid).update({ money: 999999999 });
                        if (typeof showToast === 'function') showToast("💵 999,999,999G가 지급되었습니다!", "#deb887");
                        input.value = ''; return;
                    }
                    if (cmd === '/올무기' || cmd === '/weapons') {
                        const weapons = ['k2', 'k3', 'k5', 'k1a', 'k14', 'k6', 'marshal_card', 'golden_k2'];
                        weapons.forEach(w => {
                            db.ref('users/' + STATE.currentUser.uid + '/inventory').push(w);
                        });
                        if (typeof showToast === 'function') showToast("🔫 모든 무기가 지급되었습니다!", "#3b82f6");
                        input.value = ''; return;
                    }

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

        // Emote parser for all users
        if (text === '/경례' || text === '/salute') {
            window.localPlayerPose = window.localPlayerPose === 'salute' ? 'normal' : 'salute';
            showToast(window.localPlayerPose === 'salute' ? "🫡 경례!" : "쉬어", "#f59e0b");
            input.value = ''; return;
        }
        if (text === '/앉기' || text === '/sit') {
            window.localPlayerPose = window.localPlayerPose === 'sit' ? 'normal' : 'sit';
            showToast(window.localPlayerPose === 'sit' ? "🧘 자리에 앉았습니다." : "자리에 일어섰습니다.", "#f59e0b");
            input.value = ''; return;
        }
        if (text === '/포복' || text === '/prone') {
            window.localPlayerPose = window.localPlayerPose === 'prone' ? 'normal' : 'prone';
            showToast(window.localPlayerPose === 'prone' ? "🪖 포복 상태로 전환했습니다." : "일어섰습니다.", "#f59e0b");
            input.value = ''; return;
        }
        if (text === '/체조' || text === '/pt') {
            window.localPlayerPose = window.localPlayerPose === 'pt' ? 'normal' : 'pt';
            showToast(window.localPlayerPose === 'pt' ? "🔄 PT체조를 시작합니다!" : "체조를 종료합니다.", "#f59e0b");
            input.value = ''; return;
        }
        if (text === '/순찰' || text === '/patrol') {
            window.startPatrolMission();
            input.value = ''; return;
        }
        if (text === '/수류탄' || text === '/grenade') {
            window.startGrenadeThrowMode();
            input.value = ''; return;
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
                } else if (type === 'money') {
                    db.ref('users/' + uid).once('value', s => {
                        const current = s.val().money || 0;
                        db.ref('users/' + uid).update({ money: current + value });
                        alert(`${targetId}님에게 ${value}G를 지급했습니다.`);
                    });
                } else if (type === 'punish') {
                    db.ref('users/' + uid).update({ punishment: value, punishmentTime: Date.now() + 60000 });
                    db.ref('presence/' + uid + '/punishment').set(value);
                    alert(`${targetId}님에게 군기훈련(${value})을 부여했습니다.`);
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
        if (typeof db === 'undefined' || !db) {
            return alert("데이터베이스 연결 실패. 페이지를 새로고침 해보세요.");
        }
        const rankSelect = document.getElementById('edit-rank');
        if (rankSelect) {
            rankSelect.innerHTML = '';
            if (typeof RANKS !== 'undefined' && Array.isArray(RANKS)) {
                RANKS.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r; opt.textContent = r;
                    rankSelect.appendChild(opt);
                });
            }
        }

        // Sync Users
        db.ref('users').on('value', snap => {
            const users = snap.val();
            const table = document.getElementById('admin-user-table');
            if (!table) return;
            table.innerHTML = '';
            if (!users) {
                table.innerHTML = '<tr><td colspan="7" style="padding: 50px; text-align: center; color: #888;">등록된 유저가 없습니다. 신병 등록을 먼저 진행해 주세요.</td></tr>';
                return;
            }

            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (!u) return;
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                tr.innerHTML = `
                <td style="padding: 15px;">${u.username || ''}</td>
                <td style="padding: 15px;">${u.name || ''}</td>
                <td style="padding: 15px;" class="hide-on-mobile">${u.password || ''}</td>
                <td style="padding: 15px;">${u.rank || ''}</td>
                <td style="padding: 15px;" class="hide-on-mobile">${u.money || 0}G</td>
                <td style="padding: 15px;" class="hide-on-mobile">${u.isBanned ? '🚫 밴' : '✅ 정상'}</td>
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
            if (!list) return;
            list.innerHTML = '';
            if (!ais) return;
            Object.keys(ais).forEach(aid => {
                const a = ais[aid];
                if (!a) return;
                const div = document.createElement('div');
                div.style.cssText = 'padding: 10px; background: rgba(255,255,255,0.05); margin-bottom: 5px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
                div.innerHTML = `<span>[${a.rank || ''}] ${a.name || ''}</span> <button onclick="removeAISoldier('${aid}')" style="width: auto; padding: 5px 10px; background: #8b0000; font-size: 0.7rem; margin:0;">삭제</button>`;
                list.appendChild(div);
            });
        });

        // Sync Units
        db.ref('system/units').on('value', snap => {
            const units = snap.val();
            const list = document.getElementById('unit-list');
            if (!list) return;
            list.innerHTML = '';
            if (!units) return;
            Object.keys(units).forEach(uid => {
                const u = units[uid];
                if (!u) return;
                const div = document.createElement('div');
                div.style.cssText = 'padding: 10px; background: rgba(255,255,255,0.05); margin-bottom: 5px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
                div.innerHTML = `<span>🏰 ${u.name || ''}</span> <button onclick="removeUnit('${uid}')" style="width: auto; padding: 5px 10px; background: #8b0000; font-size: 0.7rem; margin:0;">삭제</button>`;
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
        const pType = type || document.getElementById('edit-punishment-type').value;
        db.ref('users/' + uid).update({ punishment: pType, punishmentTime: Date.now() + 60000 });
        alert("군기훈련(" + pType + ") 부여 완료");
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
        const showWebGLWarning = (customMsg) => {
            const warningOverlay = document.createElement('div');
            warningOverlay.id = 'webgl-error-overlay';
            warningOverlay.style.cssText = 'position:fixed; inset:0; background:rgba(10,15,10,0.95); backdrop-filter:blur(15px); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#ef4444; font-family:Pretendard, sans-serif; z-index:9999999; padding:30px; text-align:center; border: 4px solid #ef4444; margin: 20px; border-radius: 16px; box-shadow: 0 0 50px rgba(239, 68, 68, 0.3);';
            warningOverlay.innerHTML = `
                <div style="font-size:5rem; margin-bottom:20px; animation: pulse 1.5s infinite alternate;">☣️</div>
                <h1 style="font-size:2.5rem; font-weight:900; margin-bottom:15px; text-shadow:0 0 10px rgba(239,68,68,0.5); font-family:Orbitron, sans-serif; letter-spacing:2px;">WebGL 가동 불가 (WebGL OFFLINE)</h1>
                <p style="font-size:1.2rem; color:#ccc; max-width:600px; line-height:1.6; margin-bottom:30px;">
                    ${customMsg || '3D 전술 훈련 시뮬레이터를 구동하기 위해 그래픽 가속(WebGL)이 필요합니다.<br>현재 브라우저에서 WebGL을 사용할 수 없거나 비활성화되어 있습니다.'}
                </p>
                <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.3); padding:20px; border-radius:12px; text-align:left; max-width:550px; margin-bottom:30px; font-size:0.95rem; color:#ddd; line-height:1.6;">
                    <strong style="color:#ef4444; font-size:1.1rem; display:block; margin-bottom:10px;">🔧 해결 방법 (How to fix):</strong>
                    1. 브라우저 주소창에 <code style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; color:#fff;">chrome://settings/system</code> 입력 후 이동<br>
                    2. <strong>'가능한 경우 그래픽 가속 사용'</strong> (또는 하드웨어 가속) 옵션 활성화<br>
                    3. 브라우저를 완전히 종료 후 다시 시작<br>
                    4. 현상이 지속될 경우 Chrome/Edge 등 최신 브라우저를 사용해 주세요.
                </div>
                <button onclick="location.reload()" style="background:#ef4444; color:black; border:none; padding:12px 30px; font-size:1.1rem; font-weight:bold; border-radius:8px; cursor:pointer; transition:0.2s; box-shadow:0 5px 15px rgba(239,68,68,0.4);">
                    새로고침 (Reload)
                </button>
            `;
            document.body.appendChild(warningOverlay);
        };

        if (typeof THREE === 'undefined') {
            showWebGLWarning("3D 그래픽 라이브러리(Three.js)를 불러오지 못했습니다. 네트워크 연결 상태를 확인하고 페이지를 새로고침 해보세요.");
            throw new Error("THREE is not defined");
        }

        velocity = new THREE.Vector3();
        window.isAdsMode = false;
        window.gasMaskFilter = 100;
        window.patrolActive = false;
        window.patrolStep = 0;
        window.aiTargetBots = [];
        window.grenadeThrowingMode = false;
        window.grenadePower = 0;
        window.grenadeCharging = false;
        window.obstacleCourseActive = false;
        window.obstacleCourseTime = 0;
        window.obstacleCourseCheckpoint = 0;
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;

        scene = new THREE.Scene();
        const isDaytimeInitial = true;
        const initialSkyColor = 0x87ceeb;
        scene.background = new THREE.Color(initialSkyColor);
        scene.fog = new THREE.Fog(initialSkyColor, 0, 500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.6, 180);
        camera.rotation.order = 'YXZ';

        try {
            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.shadowMap.enabled = true;
        } catch (e) {
            console.error("WebGLRenderer creation failed:", e);
            showWebGLWarning();
            throw e;
        }

        const ambientLight = new THREE.AmbientLight(0xffffff, isDaytimeInitial ? 0.5 : 0.1);
        scene.add(ambientLight);
        const sun = new THREE.DirectionalLight(0xffffff, isDaytimeInitial ? 1.0 : 0.1);
        if (!isDaytimeInitial) sun.color.setHex(0x2244aa);
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
            color: initialSkyColor,
            side: THREE.BackSide,
        });
        window.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(window.skyMesh);

        // Better Ground
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x7b8c4c,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Create Climbable Mountain
        const mountSize = 300;
        const mountSegments = 60;
        const mountGeo = new THREE.PlaneGeometry(mountSize, mountSize, mountSegments, mountSegments);
        
        // Displace vertices to form a mountain
        const posAttr = mountGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i); // Plane is on X-Y initially, then rotated
            
            // Calculate distance from center (0, 0)
            const dist = Math.sqrt(vx * vx + vy * vy);
            if (dist < 150) {
                // Smooth dome height
                const h = 60 * Math.cos((dist / 150) * (Math.PI / 2));
                posAttr.setZ(i, h); // Height along Z before rotation
            }
        }
        mountGeo.computeVertexNormals();
        
        const mountMat = new THREE.MeshStandardMaterial({
            color: 0x4d5d36, // Dark rocky green
            roughness: 0.95,
            metalness: 0.05,
            flatShading: true // Gives a nice low-poly rocky look
        });
        const mountainMesh = new THREE.Mesh(mountGeo, mountMat);
        mountainMesh.rotation.x = -Math.PI / 2;
        mountainMesh.position.set(-250, 0, -250);
        mountainMesh.receiveShadow = true;
        mountainMesh.castShadow = true;
        scene.add(mountainMesh);

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

        const createHealingParticles = (pos) => {
            const pGroup = new THREE.Group();
            pGroup.position.copy(pos);
            scene.add(pGroup);

            const greenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 });
            for (let i = 0; i < 6; i++) {
                const cross = new THREE.Group();
                const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), greenMat);
                const vert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), greenMat);
                cross.add(horiz);
                cross.add(vert);

                cross.position.set(
                    (Math.random() - 0.5) * 1.8,
                    (Math.random() - 0.2) * 0.6,
                    (Math.random() - 0.5) * 1.8
                );
                pGroup.add(cross);
            }

            let elapsed = 0;
            const anim = () => {
                elapsed += 0.016;
                pGroup.position.y += 0.015;
                pGroup.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.opacity = Math.max(0, 0.8 - (elapsed / 1.2));
                    }
                });
                if (elapsed < 1.2) {
                    requestAnimationFrame(anim);
                } else {
                    scene.remove(pGroup);
                    pGroup.traverse(child => {
                        if (child.isMesh) {
                            child.geometry.dispose();
                            child.material.dispose();
                        }
                    });
                }
            };
            anim();
        };

        // --- Custom Procedural Textures ---
        const generateGridWindowTexture = (cols, rows, bgColor = '#1e293b', winColor = '#fffae0') => {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, 256, 256);
            
            const cellW = 256 / cols;
            const cellH = 256 / rows;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    ctx.fillStyle = winColor;
                    ctx.fillRect(c * cellW + cellW * 0.2, r * cellH + cellH * 0.2, cellW * 0.6, cellH * 0.6);
                    ctx.strokeStyle = '#111111';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(c * cellW + cellW * 0.2, r * cellH + cellH * 0.2, cellW * 0.6, cellH * 0.6);
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        const generateHazardTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(32, 0); ctx.lineTo(0, 32); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(32, 64); ctx.lineTo(64, 64); ctx.lineTo(64, 32); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(32, 0); ctx.lineTo(64, 0); ctx.lineTo(0, 64); ctx.lineTo(0, 32); ctx.fill();
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 1);
            return tex;
        };

        const generateBrickTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#8b3a3a';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            for (let y = 0; y < 128; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(128, y);
                ctx.stroke();
                const shift = (y / 16) % 2 === 0 ? 0 : 16;
                for (let x = shift; x < 128; x += 32) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + 16);
                    ctx.stroke();
                }
            }
            return new THREE.CanvasTexture(canvas);
        };

        const generateWoodTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#b58a55';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#6b4c27';
            ctx.lineWidth = 2;
            for (let x = 0; x < 128; x += 32) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 128);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(107, 76, 39, 0.3)';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(i * 32 + 16, Math.random() * 128, 12, 0, Math.PI, true);
                ctx.stroke();
            }
            return new THREE.CanvasTexture(canvas);
        };

        const generateLogoTexture = (text, bgColor = '#113355', textColor = '#ffffff', fontSize = 28) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, 256, 64);
            ctx.fillStyle = textColor;
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 128, 32);
            return new THREE.CanvasTexture(canvas);
        };

        const createStyledBuilding = (name, data) => {
            const group = new THREE.Group();
            const w = data.size[0];
            const h = data.size[1];
            const d = data.size[2];
            
            const wallMat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.7, side: THREE.DoubleSide });
            const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, transparent: true, opacity: 0.6 });
            const roofRedMat = new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.8 });
            
            switch (name) {
                case "심사장": {
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.9, d), wallMat);
                    block.position.y = (h * 0.9) / 2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);
                    
                    // Glass Entrance
                    const entrance = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.2), glassMat);
                    entrance.position.set(0, 3, d/2 + 0.1);
                    group.add(entrance);

                    // Pillars
                    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.3 });
                    for (let xOffset of [-w/2 + 2, -w/3, w/3, w/2 - 2]) {
                        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, h), pillarMat);
                        col.position.set(xOffset, h/2, d/2 + 1.2);
                        col.castShadow = true;
                        group.add(col);
                    }
                    
                    // Portico Roof
                    const pRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.8, 4), wallMat);
                    pRoof.position.set(0, h, d/2 + 0.8);
                    pRoof.castShadow = true;
                    group.add(pRoof);
                    
                    // Signboard
                    const signTex = generateLogoTexture('🎖️ 심 사 장 (REVIEW CENTER)', '#1a2f1a', '#f59e0b', 22);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(0, h + 1.2, d/2 + 1.9);
                    group.add(sign);
                    
                    // Star emblem on top
                    const starGeo = new THREE.ConeGeometry(1.5, 3, 5);
                    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
                    const star = new THREE.Mesh(starGeo, starMat);
                    star.position.set(0, h + 2.5, 0);
                    group.add(star);                    break;
                }

                case "준장실 (한우주)": {
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.9, d), wallMat);
                    block.position.y = (h * 0.9) / 2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);

                    // Anchor/Emblem
                    const emblemGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
                    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
                    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
                    emblem.position.set(0, h * 0.9 + 1, 0);
                    group.add(emblem);

                    // Signboard
                    const signTex = generateLogoTexture('⭐ 준 장 실 (H.W.J OFFICE)', '#1e3a8a', '#ffd700', 20);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(0, h * 0.9 + 0.5, d/2 + 0.1);
                    group.add(sign);
                    break;
                }

                case "제작진 본부 (ree1203)": {
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.5, metalness: 0.1 }));
                    block.position.y = h / 2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);

                    // Signboard
                    const signTex = generateLogoTexture('👑 제작진 (ree1203)', '#ff0055', '#ffffff', 20);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(0, h + 0.5, d/2 + 0.1);
                    group.add(sign);
                    break;
                }

                case "부제작진 본부 (한space)": {
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5, metalness: 0.1 }));
                    block.position.y = h / 2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);

                    // Signboard
                    const signTex = generateLogoTexture('⭐ 부제작진 (한space)', '#3b82f6', '#ffffff', 18);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(0, h + 0.5, d/2 + 0.1);
                    group.add(sign);
                    break;
                }

                case "탈의실": {
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.9, d), wallMat);
                    block.position.y = (h * 0.9) / 2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);

                    // Torque Hanger / Circle Emblem
                    const emblemGeo = new THREE.TorusGeometry(0.8, 0.2, 8, 24);
                    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
                    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
                    emblem.position.set(0, h * 0.9 + 1, 0);
                    group.add(emblem);

                    // Signboard
                    const signTex = generateLogoTexture('👚 VIP 탈의실 (DRESS ROOM)', '#5b21b6', '#ffd700', 18);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(0, h * 0.9 + 0.5, d/2 + 0.1);
                    group.add(sign);
                    break;
                }

                case "의무대": {
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.9, d), wallMat);
                    block.position.y = (h * 0.9) / 2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);
                    
                    // Medical Cross Sign (Red Cross) on top
                    const crossGroup = new THREE.Group();
                    crossGroup.position.set(0, h * 0.9 + 1.2, 0);
                    
                    const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }));
                    const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }));
                    crossGroup.add(crossHorizontal);
                    crossGroup.add(crossVertical);
                    group.add(crossGroup);

                    // Signboard
                    const signTex = generateLogoTexture('🏥 의 무 대 (MEDICAL CLINIC)', '#b91c1c', '#ffffff', 18);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(0, h * 0.9 + 0.5, d/2 + 0.1);
                    group.add(sign);

                    // Beds (침대 3개 배치)
                    window.medicalBeds = [];
                    for (let i = 0; i < 3; i++) {
                        const bedGroup = new THREE.Group();
                        const xOffset = -5 + i * 5;
                        bedGroup.position.set(xOffset, 0, 0);

                        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 3), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.2 }));
                        frame.position.y = 0.2;
                        bedGroup.add(frame);

                        const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 2.8), new THREE.MeshStandardMaterial({ color: 0x93c5fd })); // Light blue
                        mattress.position.y = 0.45;
                        bedGroup.add(mattress);

                        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.45), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                        pillow.position.set(0, 0.56, -1.1);
                        bedGroup.add(pillow);

                        // IV Stand (수액 거치대)
                        const ivPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 }));
                        ivPole.position.set(-0.75, 1.0, -1.2);
                        bedGroup.add(ivPole);
                        
                        const ivBag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
                        ivBag.position.set(-0.75, 1.8, -1.2);
                        bedGroup.add(ivBag);

                        group.add(bedGroup);

                        // Save absolute world position of each bed
                        window.medicalBeds.push({
                            x: -120 + xOffset,
                            z: -20,
                            id: i + 1
                        });
                    }
                    break;
                }

                case "활주로": {
                    // Asphalt base
                    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
                    base.position.y = 0.05;
                    group.add(base);

                    // Central dotted runway line
                    const lineCount = Math.floor(d / 20);
                    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
                    for (let i = 0; i < lineCount; i++) {
                        const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 10), lineMat);
                        dash.position.set(0, 0.07, -d/2 + i * 20 + 10);
                        group.add(dash);
                    }

                    // Side borders (Left and Right solid lines)
                    const borderLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, d), lineMat);
                    borderLeft.position.set(-w/2 + 2, 0.07, 0);
                    group.add(borderLeft);

                    const borderRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, d), lineMat);
                    borderRight.position.set(w/2 - 2, 0.07, 0);
                    group.add(borderRight);

                    // Add runway edge lights (glow blue & white)
                    const blueLightMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 2.0 });
                    const whiteLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
                    
                    const lightCount = Math.floor(d / 15);
                    for (let i = 0; i < lightCount; i++) {
                        const zPos = -d/2 + i * 15;
                        const mat = (i % 2 === 0) ? blueLightMat : whiteLightMat;
                        
                        // Left lamp
                        const bulbL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat);
                        bulbL.position.set(-w/2 + 1, 0.3, zPos);
                        group.add(bulbL);
                        
                        // Right lamp
                        const bulbR = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat);
                        bulbR.position.set(w/2 - 1, 0.3, zPos);
                        group.add(bulbR);
                    }
                    break;
                }
                
                case "위병소": {
                    const booth = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), wallMat);
                    booth.position.set(-2, h/2, 0);
                    booth.castShadow = true; booth.receiveShadow = true;
                    group.add(booth);
                    
                    const win = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 4.1), glassMat);
                    win.position.set(-2, h/2 + 0.5, 0);
                    group.add(win);
                    
                    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, h), darkMetalMat);
                    pillarL.position.set(3, h/2, -2);
                    pillarL.castShadow = true;
                    group.add(pillarL);
                    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, h), darkMetalMat);
                    pillarR.position.set(3, h/2, 2);
                    pillarR.castShadow = true;
                    group.add(pillarR);
                    
                    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), roofRedMat);
                    roof.position.set(0, h, 0);
                    roof.castShadow = true;
                    group.add(roof);
                    
                    const barrierJoint = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), darkMetalMat);
                    barrierJoint.position.set(1.5, 1.2, 0);
                    group.add(barrierJoint);
                    
                    const barrierBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
                    barrierBar.rotation.x = Math.PI / 2;
                    barrierBar.position.set(1.5, 1.2, 3.25);
                    barrierBar.castShadow = true;
                    group.add(barrierBar);
                    
                    for (let zOffset = 1; zOffset < 6; zOffset += 1.5) {
                        const redStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
                        redStripe.rotation.x = Math.PI / 2;
                        redStripe.position.set(1.5, 1.2, zOffset);
                        group.add(redStripe);
                    }
                    break;
                }
                
                case "연병장": {
                    const trackMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
                    const centerFieldMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.95 });
                    
                    const baseTrack = new THREE.Mesh(new THREE.PlaneGeometry(w, d), trackMat);
                    baseTrack.rotation.x = -Math.PI / 2;
                    baseTrack.receiveShadow = true;
                    group.add(baseTrack);
                    
                    const innerField = new THREE.Mesh(new THREE.PlaneGeometry(w - 12, d - 12), centerFieldMat);
                    innerField.rotation.x = -Math.PI / 2;
                    innerField.position.y = 0.02;
                    innerField.receiveShadow = true;
                    group.add(innerField);
                    
                    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                    const innerLine = new THREE.Mesh(new THREE.PlaneGeometry(w - 14, d - 14), lineMat);
                    innerLine.rotation.x = -Math.PI / 2;
                    innerLine.position.y = 0.03;
                    group.add(innerLine);
                    const innerLineMask = new THREE.Mesh(new THREE.PlaneGeometry(w - 14.4, d - 14.4), centerFieldMat);
                    innerLineMask.rotation.x = -Math.PI / 2;
                    innerLineMask.position.y = 0.04;
                    group.add(innerLineMask);
                    
                    const goalWidth = 10, goalHeight = 4;
                    const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
                    
                    const makeSoccerGoal = (zPos, ry) => {
                        const g = new THREE.Group();
                        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, goalWidth), goalMat);
                        top.rotation.z = Math.PI / 2;
                        top.position.y = goalHeight;
                        g.add(top);
                        const left = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, goalHeight), goalMat);
                        left.position.set(-goalWidth/2, goalHeight/2, 0);
                        g.add(left);
                        const right = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, goalHeight), goalMat);
                        right.position.set(goalWidth/2, goalHeight/2, 0);
                        g.add(right);
                        
                        g.position.set(0, 0, zPos);
                        g.rotation.y = ry;
                        return g;
                    };
                    group.add(makeSoccerGoal(-d/2 + 10, 0));
                    group.add(makeSoccerGoal(d/2 - 10, Math.PI));
                    break;
                }
                
                case "본청": {
                    const hqWallMat = new THREE.MeshStandardMaterial({ color: 0x3e4a42, roughness: 0.6 });
                    const wingWallMat = new THREE.MeshStandardMaterial({ color: 0x2d3a33, roughness: 0.7 });
                    
                    const winTex = generateGridWindowTexture(12, 6, '#1a231e', '#e0ffd5');
                    const windowMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.3 });
                    
                    const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h, d * 0.9), hqWallMat);
                    mainBlock.position.y = h / 2;
                    mainBlock.castShadow = true; mainBlock.receiveShadow = true;
                    group.add(mainBlock);
                    
                    const wingL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, h * 0.8, d * 0.8), wingWallMat);
                    wingL.position.set(-w * 0.375, (h * 0.8)/2, 0);
                    wingL.castShadow = true; wingL.receiveShadow = true;
                    group.add(wingL);
                    
                    const wingR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, h * 0.8, d * 0.8), wingWallMat);
                    wingR.position.set(w * 0.375, (h * 0.8)/2, 0);
                    wingR.castShadow = true; wingR.receiveShadow = true;
                    group.add(wingR);
                    
                    const windowPanelF = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, h * 0.7, 0.2), windowMat);
                    windowPanelF.position.set(0, h * 0.5, d * 0.45 + 0.1);
                    group.add(windowPanelF);
                    
                    const windowPanelL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.6, 0.2), windowMat);
                    windowPanelL.position.set(-w * 0.375, h * 0.4, d * 0.4 + 0.1);
                    group.add(windowPanelL);
                    
                    const windowPanelR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.6, 0.2), windowMat);
                    windowPanelR.position.set(w * 0.375, h * 0.4, d * 0.4 + 0.1);
                    group.add(windowPanelR);
                    
                    const columnMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
                    for (let xOffset of [-8, -4, 4, 8]) {
                        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, h), columnMat);
                        col.position.set(xOffset, h/2, d * 0.45 + 1.2);
                        col.castShadow = true;
                        group.add(col);
                    }
                    
                    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 3), hqWallMat);
                    porticoRoof.position.set(0, h, d * 0.45 + 0.5);
                    porticoRoof.castShadow = true;
                    group.add(porticoRoof);
                    
                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 }));
                    pole.position.set(0, h + 4, 0);
                    group.add(pole);
                    
                    const flagTex = generateLogoTexture('태극기/군기', '#002f6c', '#ffffff', 20);
                    const flag = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.05), new THREE.MeshStandardMaterial({ map: flagTex }));
                    flag.position.set(1.5, h + 7, 0);
                    group.add(flag);
                    break;
                }
                
                case "생활관": {
                    const camoMat = getCamoMaterial(data.color);
                    
                    const dorm = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, d), camoMat);
                    dorm.position.y = (h * 0.7) / 2;
                    dorm.castShadow = true; dorm.receiveShadow = true;
                    dorm.userData.isCamo = true;
                    group.add(dorm);
                    
                    const roofSide1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.5, d + 2), roofRedMat);
                    roofSide1.rotation.z = 0.4;
                    roofSide1.position.set(-w*0.25, h * 0.85, 0);
                    roofSide1.castShadow = true;
                    group.add(roofSide1);
                    
                    const roofSide2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.5, d + 2), roofRedMat);
                    roofSide2.rotation.z = -0.4;
                    roofSide2.position.set(w*0.25, h * 0.85, 0);
                    roofSide2.castShadow = true;
                    group.add(roofSide2);
                    
                    const roofCenter = new THREE.Mesh(new THREE.BoxGeometry(w - 2, 2.5, d), camoMat);
                    roofCenter.position.set(0, h * 0.8, 0);
                    roofCenter.userData.isCamo = true;
                    group.add(roofCenter);
                    
                    const barrWinTex = generateGridWindowTexture(8, 2, '#202020', '#fffae0');
                    const barrWinMat = new THREE.MeshStandardMaterial({ map: barrWinTex, roughness: 0.5 });
                    
                    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.2, h * 0.35, d * 0.8), barrWinMat);
                    winL.position.set(-w/2 - 0.1, h * 0.4, 0);
                    winL.rotation.y = Math.PI / 2;
                    group.add(winL);
                    
                    const winR = new THREE.Mesh(new THREE.BoxGeometry(0.2, h * 0.35, d * 0.8), barrWinMat);
                    winR.position.set(w/2 + 0.1, h * 0.4, 0);
                    winR.rotation.y = -Math.PI / 2;
                    group.add(winR);
                    
                    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.6 });
                    const doorF = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.5, 0.2), doorMat);
                    doorF.position.set(0, 2.25, d/2 + 0.1);
                    group.add(doorF);
                    break;
                }
                
                case "병영식당": {
                    const brickTex = generateBrickTexture();
                    const messWallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.7 });
                    
                    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), messWallMat);
                    mainHall.position.y = h / 2;
                    mainHall.castShadow = true; mainHall.receiveShadow = true;
                    group.add(mainHall);
                    
                    const trimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.2 });
                    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.6, d + 1), trimMat);
                    roofTrim.position.set(0, h, 0);
                    group.add(roofTrim);
                    
                    const largeGlassTex = generateGridWindowTexture(4, 1, '#1a1a24', '#bbf2ff');
                    const largeGlassMat = new THREE.MeshStandardMaterial({ map: largeGlassTex, roughness: 0.2 });
                    
                    const winL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.5, 0.2), largeGlassMat);
                    winL.position.set(0, h * 0.45, d/2 + 0.1);
                    group.add(winL);
                    
                    const winR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.5, 0.2), largeGlassMat);
                    winR.position.set(0, h * 0.45, -d/2 - 0.1);
                    group.add(winR);
                    
                    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3), darkMetalMat);
                    chimney.position.set(-w/3, h + 1.5, -d/3);
                    group.add(chimney);
                    const chimneyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4), darkMetalMat);
                    chimneyCap.position.set(-w/3, h + 3, -d/3);
                    group.add(chimneyCap);
                    
                    const signTex = generateLogoTexture('🍴 식 당 (MESS HALL)', '#8b0000', '#ffffff', 24);
                    const sign = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.2), new THREE.MeshStandardMaterial({ map: signTex }));
                    sign.position.set(-w * 0.2, h * 0.7, d/2 + 0.2);
                    group.add(sign);
                    break;
                }
                
                case "행정실": {
                    const panelMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
                    const adminBlock = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), panelMat);
                    adminBlock.position.y = h / 2;
                    adminBlock.castShadow = true; adminBlock.receiveShadow = true;
                    group.add(adminBlock);
                    
                    const officeWinTex = generateGridWindowTexture(6, 2, '#15202b', '#cceeff');
                    const officeWinMat = new THREE.MeshStandardMaterial({ map: officeWinTex, roughness: 0.3 });
                    
                    const frontWin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.4, 0.2), officeWinMat);
                    frontWin.position.set(0, h * 0.6, d/2 + 0.1);
                    group.add(frontWin);
                    
                    const doors = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.2), glassMat);
                    doors.position.set(0, 2.5, d/2 + 0.15);
                    group.add(doors);
                    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.2, 0.1), darkMetalMat);
                    doorFrame.position.set(0, 2.6, d/2 + 0.1);
                    group.add(doorFrame);
                    
                    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
                    acUnit.position.set(-w/2 + 2, h * 0.7, 0);
                    group.add(acUnit);
                    break;
                }
                
                case "사격장": {
                    const rangeFloorMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
                    const woodMat = new THREE.MeshStandardMaterial({ map: generateWoodTexture(), roughness: 0.8 });
                    
                    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), rangeFloorMat);
                    floor.position.y = 0.1;
                    floor.receiveShadow = true;
                    group.add(floor);
                    
                    const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, 1), rangeFloorMat);
                    backWall.position.set(0, 3, -d/2 + 0.5);
                    backWall.castShadow = true; backWall.receiveShadow = true;
                    group.add(backWall);
                    
                    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.7 }));
                    canopyRoof.position.set(0, 5, d/2 - 5);
                    group.add(canopyRoof);
                    
                    for (let xOffset of [-w/2 + 1, -w/4, 0, w/4, w/2 - 1]) {
                        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5), darkMetalMat);
                        col.position.set(xOffset, 2.5, d/2 - 9.8);
                        col.castShadow = true;
                        group.add(col);
                        
                        const backCol = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5), darkMetalMat);
                        backCol.position.set(xOffset, 2.5, d/2 - 0.2);
                        backCol.castShadow = true;
                        group.add(backCol);
                    }
                    
                    for (let i = -2; i <= 2; i++) {
                        const laneX = i * 7.5;
                        const divider = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 4), woodMat);
                        divider.position.set(laneX + 3.75, 0.9, d/2 - 5);
                        divider.castShadow = true;
                        group.add(divider);
                        
                        const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1), woodMat);
                        table.position.set(laneX, 0.8, d/2 - 7);
                        table.castShadow = true;
                        group.add(table);
                        
                        const targetFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), darkMetalMat);
                        targetFrame.position.set(laneX, 1.5, -d/2 + 5);
                        group.add(targetFrame);
                        
                        const targetPlateMat = new THREE.MeshStandardMaterial({
                            map: generateLogoTexture('🎯', '#ffffff', '#ff0000', 36),
                            roughness: 0.8
                        });
                        const targetPlate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.05), targetPlateMat);
                        targetPlate.position.set(laneX, 2.4, -d/2 + 5);
                        targetPlate.castShadow = true;
                        group.add(targetPlate);
                    }
                    break;
                }
                
                case "강당": {
                    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b8b8b, roughness: 0.8 });
                    const archMat = new THREE.MeshStandardMaterial({ color: 0xa9a9a9, roughness: 0.5 });
                    
                    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.6, d), stoneMat);
                    baseBlock.position.y = (h * 0.6) / 2;
                    baseBlock.castShadow = true; baseBlock.receiveShadow = true;
                    group.add(baseBlock);
                    
                    const dome = new THREE.Mesh(new THREE.CylinderGeometry(w/2, w/2, d, 24), roofRedMat);
                    dome.rotation.x = Math.PI / 2;
                    dome.scale.y = 1.0;
                    dome.scale.z = 0.7;
                    dome.position.set(0, h * 0.6, 0);
                    dome.castShadow = true;
                    group.add(dome);
                    
                    const arch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.7, 2), archMat);
                    arch.position.set(0, (h * 0.7)/2, d/2 + 0.8);
                    arch.castShadow = true;
                    group.add(arch);
                    
                    const archCutout = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.22, 3, 16), darkMetalMat);
                    archCutout.rotation.x = Math.PI / 2;
                    archCutout.position.set(0, 3, d/2 + 0.8);
                    group.add(archCutout);
                    
                    const slotWinTex = generateGridWindowTexture(1, 4, '#101015', '#ffd700');
                    const slotWinMat = new THREE.MeshStandardMaterial({ map: slotWinTex, roughness: 0.4 });
                    for (let xOffset of [-w*0.35, -w*0.2, w*0.2, w*0.35]) {
                        const slit = new THREE.Mesh(new THREE.BoxGeometry(1.2, h * 0.4, 0.2), slotWinMat);
                        slit.position.set(xOffset, h * 0.3, d/2 + 0.1);
                        group.add(slit);
                    }
                    break;
                }
                
                case "유격장": {
                    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.95 });
                    const woodMat = new THREE.MeshStandardMaterial({ map: generateWoodTexture(), roughness: 0.9 });
                    
                    const sand = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), sandMat);
                    sand.position.y = 0.1;
                    sand.receiveShadow = true;
                    group.add(sand);
                    
                    const wallPostL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), woodMat);
                    wallPostL.position.set(-10, 2.5, -10);
                    group.add(wallPostL);
                    const wallPostR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), woodMat);
                    wallPostR.position.set(10, 2.5, -10);
                    group.add(wallPostR);
                    
                    const climbPlanks = new THREE.Mesh(new THREE.BoxGeometry(20, 3.8, 0.25), woodMat);
                    climbPlanks.position.set(0, 3.1, -10);
                    climbPlanks.castShadow = true;
                    group.add(climbPlanks);
                    
                    for (let i = 0; i < 3; i++) {
                        const beamZ = 5 + i * 5;
                        const beamPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1), woodMat);
                        beamPost1.position.set(-8, 0.5, beamZ);
                        group.add(beamPost1);
                        const beamPost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1), woodMat);
                        beamPost2.position.set(8, 0.5, beamZ);
                        group.add(beamPost2);
                        
                        const logBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 16), woodMat);
                        logBeam.rotation.z = Math.PI / 2;
                        logBeam.position.set(0, 1.0, beamZ);
                        logBeam.castShadow = true;
                        group.add(logBeam);
                    }
                    
                    const netFrameMat = new THREE.MeshStandardMaterial({ color: 0x223322 });
                    for (let zOffset of [-20, -16, -12]) {
                        const arch = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 0.15), netFrameMat);
                        arch.position.set(0, 0.6, zOffset);
                        group.add(arch);
                        const legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), netFrameMat);
                        legL.position.set(-7.5, 0.6, zOffset);
                        group.add(legL);
                        const legR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), netFrameMat);
                        legR.position.set(7.5, 0.6, zOffset);
                        group.add(legR);
                    }
                    break;
                }
                
                case "탄약고": {
                    const hazardTex = generateHazardTexture();
                    const bunkerWallMat = new THREE.MeshStandardMaterial({ color: 0x4f5255, roughness: 0.9 });
                    
                    const vault = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bunkerWallMat);
                    vault.position.y = h/2;
                    vault.castShadow = true; vault.receiveShadow = true;
                    group.add(vault);
                    
                    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(w*0.45, h*0.7, 0.3), bunkerWallMat);
                    doorFrame.position.set(0, (h*0.7)/2, d/2 + 0.15);
                    group.add(doorFrame);
                    
                    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(w*0.2, h*0.62, 0.1), new THREE.MeshStandardMaterial({ map: hazardTex }));
                    leftDoor.position.set(-w*0.1, (h*0.62)/2, d/2 + 0.25);
                    group.add(leftDoor);
                    
                    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(w*0.2, h*0.62, 0.1), new THREE.MeshStandardMaterial({ map: hazardTex }));
                    rightDoor.position.set(w*0.1, (h*0.62)/2, d/2 + 0.25);
                    group.add(rightDoor);
                    
                    const signTex = generateLogoTexture('⚠️ 화약류·폭발물 경고', '#ff3300', '#ffffff', 20);
                    const dangerSign = new THREE.Mesh(new THREE.BoxGeometry(7, 1.5, 0.1), new THREE.MeshStandardMaterial({ map: signTex }));
                    dangerSign.position.set(0, h * 0.8, d/2 + 0.2);
                    group.add(dangerSign);
                    
                    const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5), darkMetalMat);
                    beaconBase.position.set(0, h + 0.25, 0);
                    group.add(beaconBase);
                    
                    const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                    beaconLight.position.set(0, h + 0.6, 0);
                    group.add(beaconLight);
                    break;
                }
                
                case "병기본부": {
                    const armoryWallMat = new THREE.MeshStandardMaterial({ color: 0x3d3f42, metalness: 0.4, roughness: 0.5 });
                    
                    const armoryBlock = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), armoryWallMat);
                    armoryBlock.position.y = h/2;
                    armoryBlock.castShadow = true; armoryBlock.receiveShadow = true;
                    group.add(armoryBlock);
                    
                    const shutterMat = new THREE.MeshStandardMaterial({
                        color: 0x888888,
                        metalness: 0.9,
                        roughness: 0.2,
                        map: generateLogoTexture('====== ROLL-UP ======', '#888888', '#555555', 20)
                    });
                    const shutterDoor = new THREE.Mesh(new THREE.BoxGeometry(w*0.5, h*0.7, 0.1), shutterMat);
                    shutterDoor.position.set(0, (h*0.7)/2, d/2 + 0.1);
                    group.add(shutterDoor);
                    
                    const towerG = new THREE.Group();
                    const towerCabin = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), armoryWallMat);
                    towerCabin.position.y = h + 2;
                    towerG.add(towerCabin);
                    
                    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(3, 2, 4), roofRedMat);
                    towerRoof.rotation.y = Math.PI / 4;
                    towerRoof.position.y = h + 5;
                    towerG.add(towerRoof);
                    
                    const cabinWin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 4.2), glassMat);
                    cabinWin.position.y = h + 2;
                    towerG.add(cabinWin);
                    
                    towerG.position.set(-w/2 + 2, 0, -d/2 + 2);
                    group.add(towerG);
                    
                    const radarStand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2), darkMetalMat);
                    radarStand.position.set(w/3, h + 1, 0);
                    group.add(radarStand);
                    
                    const radarDish = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8 }));
                    radarDish.rotation.z = Math.PI / 3;
                    radarDish.position.set(w/3, h + 2, 0);
                    group.add(radarDish);
                    break;
                }
                
                case "유류고": {
                    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
                    const tankMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.2 });
                    
                    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), concreteMat);
                    floor.position.y = 0.1;
                    floor.receiveShadow = true;
                    group.add(floor);
                    
                    const wallL = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 0.4), concreteMat);
                    wallL.position.set(0, 0.6, -d/2 + 0.2);
                    group.add(wallL);
                    
                    const wallR = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 0.4), concreteMat);
                    wallR.position.set(0, 0.6, d/2 - 0.2);
                    group.add(wallR);
                    
                    const makeFuelTank = (xOffset) => {
                        const tankG = new THREE.Group();
                        const body = new THREE.Mesh(new THREE.CylinderGeometry(w*0.2, w*0.2, h*0.8), tankMat);
                        body.position.y = (h*0.8)/2 + 0.2;
                        body.castShadow = true; body.receiveShadow = true;
                        tankG.add(body);
                        
                        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(w*0.2 + 0.05, w*0.2 + 0.05, 0.8), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
                        stripe.position.y = h*0.6;
                        tankG.add(stripe);
                        
                        const dangerText = generateLogoTexture('DANGER', '#ff0000', '#ffffff', 20);
                        const label = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 0.1), new THREE.MeshStandardMaterial({ map: dangerText }));
                        label.position.set(0, h*0.4, w*0.2 + 0.08);
                        tankG.add(label);
                        
                        tankG.position.x = xOffset;
                        return tankG;
                    };
                    group.add(makeFuelTank(-w*0.22));
                    group.add(makeFuelTank(w*0.22));
                    
                    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xffbb00, metalness: 0.6 });
                    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, w * 0.7), pipeMat);
                    pipe.rotation.z = Math.PI / 2;
                    pipe.position.set(0, h*0.7, -w*0.1);
                    group.add(pipe);
                    
                    const verticalPipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h*0.6), pipeMat);
                    verticalPipe1.position.set(-w*0.22, h*0.35, -w*0.1);
                    group.add(verticalPipe1);
                    const verticalPipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h*0.6), pipeMat);
                    verticalPipe2.position.set(w*0.22, h*0.35, -w*0.1);
                    group.add(verticalPipe2);
                    break;
                }
                
                case "보급창고": {
                    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x4f6258, roughness: 0.5, metalness: 0.4 });
                    
                    const hangar = new THREE.Mesh(new THREE.CylinderGeometry(w/2, w/2, d, 20), hangarMat);
                    hangar.rotation.x = Math.PI / 2;
                    hangar.position.set(0, 0.01, 0);
                    hangar.scale.z = 0.6;
                    hangar.castShadow = true; hangar.receiveShadow = true;
                    group.add(hangar);
                    
                    const endWallF = new THREE.Mesh(new THREE.BoxGeometry(w, w*0.3, 0.2), hangarMat);
                    endWallF.position.set(0, (w*0.3)/2, d/2);
                    group.add(endWallF);
                    const endWallB = new THREE.Mesh(new THREE.BoxGeometry(w, w*0.3, 0.2), hangarMat);
                    endWallB.position.set(0, (w*0.3)/2, -d/2);
                    group.add(endWallB);
                    
                    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x7a838a, metalness: 0.8, roughness: 0.3 });
                    const shutter = new THREE.Mesh(new THREE.BoxGeometry(w*0.4, h*0.7, 0.3), shutterMat);
                    shutter.position.set(0, (h*0.7)/2, d/2 + 0.1);
                    group.add(shutter);
                    
                    const woodTex = generateWoodTexture();
                    const crateMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
                    
                    const makeCrate = (cx, cy, cz, size = 1.6) => {
                        const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
                        crate.position.set(cx, cy + size/2, cz);
                        crate.castShadow = true;
                        return crate;
                    };
                    group.add(makeCrate(w*0.35, 0, d/2 + 1.5, 2.0));
                    group.add(makeCrate(w*0.35 - 0.5, 2.0, d/2 + 1.2, 1.6));
                    group.add(makeCrate(-w*0.35, 0, d/2 + 1.2, 1.8));
                    break;
                }
                
                case "PX": {
                    const storeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 });
                    
                    const shop = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), storeMat);
                    shop.position.y = h/2;
                    shop.castShadow = true; shop.receiveShadow = true;
                    group.add(shop);
                    
                    const displayWin = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, h*0.5, 0.2), glassMat);
                    displayWin.position.set(0, h*0.4, d/2 + 0.1);
                    group.add(displayWin);
                    
                    const awningMat = new THREE.MeshStandardMaterial({ color: 0xb22222, roughness: 0.8 });
                    const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.2, 3), awningMat);
                    awning.rotation.x = 0.3;
                    awning.position.set(0, h * 0.75, d/2 + 1.2);
                    awning.castShadow = true;
                    group.add(awning);
                    
                    const pxSignTex = generateLogoTexture('🎖️ WA-MART (PX)', '#0000ff', '#ffffff', 26);
                    const pxSign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: pxSignTex }));
                    pxSign.position.set(0, h * 0.9, d/2 + 0.15);
                    group.add(pxSign);
                    break;
                }
                
                case "체력단련실": {
                    const gymWallMat = new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.7 });
                    const accentMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
                    
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gymWallMat);
                    block.position.y = h/2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);
                    
                    const frameL = new THREE.Mesh(new THREE.BoxGeometry(2, h + 0.2, d + 0.2), accentMat);
                    frameL.position.set(-w/2 + 1, h/2, 0);
                    group.add(frameL);
                    const frameR = new THREE.Mesh(new THREE.BoxGeometry(2, h + 0.2, d + 0.2), accentMat);
                    frameR.position.set(w/2 - 1, h/2, 0);
                    group.add(frameR);
                    
                    const gymLogoTex = generateLogoTexture('💪 ARMY FITNESS', '#ff6600', '#ffffff', 22);
                    const logoPanel = new THREE.Mesh(new THREE.BoxGeometry(12, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: gymLogoTex }));
                    logoPanel.position.set(0, h * 0.8, d/2 + 0.1);
                    group.add(logoPanel);
                    
                    const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(w*0.7, h*0.5, 0.1), glassMat);
                    glassPanel.position.set(0, h*0.4, d/2 + 0.05);
                    group.add(glassPanel);
                    break;
                }
                
                case "면회실": {
                    const cottageWallMat = new THREE.MeshStandardMaterial({ color: 0xfffcf5, roughness: 0.8 });
                    const woodFenceMat = new THREE.MeshStandardMaterial({ map: generateWoodTexture(), roughness: 0.9 });
                    
                    const cottage = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, d), cottageWallMat);
                    cottage.position.y = (h*0.7)/2;
                    cottage.castShadow = true; cottage.receiveShadow = true;
                    group.add(cottage);
                    
                    const roof = new THREE.Mesh(new THREE.ConeGeometry(w*0.75, h*0.6, 4), roofRedMat);
                    roof.rotation.y = Math.PI / 4;
                    roof.position.set(0, h * 0.8, 0);
                    roof.castShadow = true;
                    group.add(roof);
                    
                    const porch = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, 0.15, 3), woodFenceMat);
                    porch.position.set(0, 0.07, d/2 + 1.5);
                    porch.receiveShadow = true;
                    group.add(porch);
                    
                    const porchColMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
                    const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h*0.7), porchColMat);
                    colL.position.set(-w*0.35, (h*0.7)/2, d/2 + 2.8);
                    group.add(colL);
                    const colR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h*0.7), porchColMat);
                    colR.position.set(w*0.35, (h*0.7)/2, d/2 + 2.8);
                    group.add(colR);
                    
                    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(w*0.8 + 0.4, 0.3, 3.2), roofRedMat);
                    porchRoof.position.set(0, h*0.7, d/2 + 1.5);
                    group.add(porchRoof);
                    
                    const warmWinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.1 });
                    const win1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.2), warmWinMat);
                    win1.position.set(-w*0.25, h*0.4, d/2 + 0.1);
                    group.add(win1);
                    const win2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.2), warmWinMat);
                    win2.position.set(w*0.25, h*0.4, d/2 + 0.1);
                    group.add(win2);
                    break;
                }
                
                case "원수실": {
                    const officeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide });
                    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1, side: THREE.DoubleSide });
                    
                    if (!window.interactiveTargets) window.interactiveTargets = [];

                    // Main Building Shell
                    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), officeMat);
                    building.position.y = h/2;
                    building.castShadow = true; building.receiveShadow = true;
                    group.add(building);
                    
                    // Golden stripes/borders for luxury look
                    for (let i = -1; i <= 1; i += 2) {
                        const verticalBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), goldMat);
                        verticalBar.position.set(i * (w/2), h/2, d/2);
                        group.add(verticalBar);
                        const verticalBarBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), goldMat);
                        verticalBarBack.position.set(i * (w/2), h/2, -d/2);
                        group.add(verticalBarBack);
                    }
                    
                    // Roof Gold Trim
                    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.4, d + 0.2), goldMat);
                    roofTrim.position.set(0, h, 0);
                    group.add(roofTrim);

                    // Marshal Sign
                    const signTex = generateLogoTexture('🎖️ COMMANDER-IN-CHIEF', '#d4af37', '#ffffff', 24);
                    const signPanel = new THREE.Mesh(new THREE.BoxGeometry(14, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide }));
                    signPanel.position.set(0, h * 0.85, d/2 + 0.1);
                    group.add(signPanel);

                    // 1. Sleek Desk (원수 책상)
                    const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a1204, roughness: 0.7 });
                    const desk = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 3.5), deskWoodMat);
                    desk.position.set(0, 0.6, -3);
                    desk.castShadow = true; desk.receiveShadow = true;
                    group.add(desk);
                    
                    // Gold details on the desk
                    const deskTrim = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.1, 3.6), goldMat);
                    deskTrim.position.set(0, 1.2, -3);
                    group.add(deskTrim);
                    
                    // 2. High-back Leather Chair (원수 의자)
                    const chairMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
                    const chairBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), chairMat);
                    chairBase.position.set(0, 0.3, -5.5);
                    group.add(chairBase);
                    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.3), chairMat);
                    chairBack.position.set(0, 1.4, -6.1);
                    group.add(chairBack);
                    
                    // 3. CCTV Monitor Wall
                    const monitorFrameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
                    const monitorFrame = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.3), monitorFrameMat);
                    monitorFrame.position.set(0, h/2 + 1, d/2 - 0.3); // Mounted inside the front wall looking in
                    group.add(monitorFrame);
                    
                    // Render 4 screens in a 2x2 grid
                    const screenW = 7.0;
                    const screenH = 2.4;
                    const screens = [
                        { name: "식당 입구 [CCTV 01]", x: -3.8, y: h/2 + 2.3, id: "cctv_canteen" },
                        { name: "체력단련실 [CCTV 02]", x: 3.8, y: h/2 + 2.3, id: "cctv_gym" },
                        { name: "PX 내부 [CCTV 03]", x: -3.8, y: h/2 - 0.3, id: "cctv_px" },
                        { name: "생활관 입구 [CCTV 04]", x: 3.8, y: h/2 - 0.3, id: "cctv_barracks" }
                    ];
                    
                    window.cctvMeshes = [];
                    
                    screens.forEach(screenInfo => {
                        const sc = document.createElement('canvas');
                        sc.width = 256; sc.height = 128;
                        const sctx = sc.getContext('2d');
                        sctx.fillStyle = '#050c05';
                        sctx.fillRect(0, 0, 256, 128);
                        
                        sctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
                        sctx.lineWidth = 1;
                        for(let gx=0; gx<256; gx+=20) {
                            sctx.beginPath(); sctx.moveTo(gx, 0); sctx.lineTo(gx, 128); sctx.stroke();
                        }
                        for(let gy=0; gy<128; gy+=20) {
                            sctx.beginPath(); sctx.moveTo(0, gy); sctx.lineTo(256, gy); sctx.stroke();
                        }
                        
                        sctx.fillStyle = '#00ff00';
                        sctx.font = 'bold 16px Courier New';
                        sctx.fillText('● REC', 20, 30);
                        sctx.font = 'bold 18px Pretendard';
                        sctx.fillText(screenInfo.name, 20, 65);
                        sctx.font = '14px Courier New';
                        sctx.fillText('SYSTEM OK // FEED LIVE', 20, 100);
                        
                        const stex = new THREE.CanvasTexture(sc);
                        const screenMesh = new THREE.Mesh(
                            new THREE.BoxGeometry(screenW, screenH, 0.1),
                            new THREE.MeshBasicMaterial({ map: stex })
                        );
                        screenMesh.position.set(screenInfo.x, screenInfo.y, d/2 - 0.1);
                        screenMesh.userData = { isCctvScreen: true, cctvId: screenInfo.id };
                        group.add(screenMesh);
                        window.cctvMeshes.push(screenMesh);
                        window.interactiveTargets.push(screenMesh);
                    });

                    // 4. Automated Door (자동문)
                    const doorGeo = new THREE.BoxGeometry(6, h * 0.7, 0.4);
                    const doorMat = new THREE.MeshStandardMaterial({ color: 0x112233, metalness: 0.9, roughness: 0.1, side: THREE.DoubleSide });
                    const door = new THREE.Mesh(doorGeo, doorMat);
                    door.position.set(0, (h*0.7)/2, d/2);
                    
                    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5), goldMat);
                    emblem.rotation.x = Math.PI / 2;
                    emblem.position.set(0, (h*0.7)/2, d/2 + 0.1);
                    group.add(emblem);
                    
                    const doorTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.7, 0.5), goldMat);
                    doorTrimL.position.set(-2.9, (h*0.7)/2, d/2);
                    group.add(doorTrimL);
                    const doorTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.7, 0.5), goldMat);
                    doorTrimR.position.set(2.9, (h*0.7)/2, d/2);
                    group.add(doorTrimR);
                    
                    group.add(door);
                    window.marshalDoorMesh = door; 
                    
                    // 5. Golden Armory Cabinet
                    const armoryCabMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
                    const armoryCab = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 1.5), armoryCabMat);
                    armoryCab.position.set(-9, 2.5, -8);
                    armoryCab.userData = { isGoldenArmory: true };
                    group.add(armoryCab);
                    window.interactiveTargets.push(armoryCab);
                    
                    const armoryTrim = new THREE.Mesh(new THREE.BoxGeometry(3.1, 5.1, 1.6), goldMat);
                    armoryTrim.position.set(-9, 2.5, -8);
                    armoryTrim.material.wireframe = true;
                    group.add(armoryTrim);
                    
                    const miniGun = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.1), goldMat);
                    miniGun.position.set(-9, 2.5, -7.2);
                    group.add(miniGun);
                    
                    // 6. Emergency Red Button (on the desk)
                    const btnBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), armoryCabMat);
                    btnBase.position.set(1.5, 1.25, -3);
                    group.add(btnBase);
                    const btnRed = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2 }));
                    btnRed.position.set(1.5, 1.35, -3);
                    btnRed.userData = { isEmergencyButton: true };
                    group.add(btnRed);
                    window.interactiveTargets.push(btnRed);

                    // 7. Secret Escape Hatch (on the floor)
                    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x44444c, roughness: 0.7 }));
                    hatch.position.set(-3, 0.05, -5.5);
                    hatch.userData = { isEscapeHatch: true };
                    group.add(hatch);
                    window.interactiveTargets.push(hatch);
                    
                    const hatchIndicator = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
                    hatchIndicator.position.set(-3, 0.06, -5.5);
                    group.add(hatchIndicator);

                    // 8. Dress Uniform Wardrobe (옷장)
                    const wardrobeMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1a, roughness: 0.8 });
                    const wardrobe = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 2), wardrobeMat);
                    wardrobe.position.set(9, 3.5, -8);
                    wardrobe.userData = { isWardrobe: true };
                    group.add(wardrobe);
                    window.interactiveTargets.push(wardrobe);
                    
                    const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), goldMat);
                    handleL.position.set(8.9, 3.5, -6.9);
                    group.add(handleL);
                    
                    // 9. Roof Helipad (H)
                    const helipadPlate = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }));
                    helipadPlate.position.set(0, h + 0.1, 0);
                    group.add(helipadPlate);
                    
                    const hc = document.createElement('canvas');
                    hc.width = 128; hc.height = 128;
                    const h_ctx = hc.getContext('2d');
                    h_ctx.fillStyle = '#333333'; h_ctx.fillRect(0,0,128,128);
                    h_ctx.strokeStyle = '#ffffff'; h_ctx.lineWidth = 12;
                    h_ctx.beginPath(); h_ctx.arc(64, 64, 50, 0, Math.PI * 2); h_ctx.stroke();
                    h_ctx.fillStyle = '#ffffff'; h_ctx.font = 'bold 64px Arial'; h_ctx.textAlign = 'center'; h_ctx.textBaseline = 'middle';
                    h_ctx.fillText('H', 64, 64);
                    const h_tex = new THREE.CanvasTexture(hc);
                    const helipadSign = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: h_tex, roughness: 0.9 }));
                    helipadSign.rotation.x = -Math.PI / 2;
                    helipadSign.position.set(0, h + 0.21, 0);
                    group.add(helipadSign);

                    // 10. Ladder on Back Wall
                    for (let ly = 0.5; ly <= h + 0.5; ly += 1.0) {
                        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5), goldMat);
                        rung.rotation.z = Math.PI / 2;
                        rung.position.set(0, ly, -d/2 + 0.1);
                        group.add(rung);
                    }
                    
                    break;
                }

                case "화생방실": {
                    const hqWallMat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.8 });
                    
                    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hqWallMat);
                    block.position.y = h/2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);
                    
                    // Warning Sign
                    const signTex = generateLogoTexture('⚠️ 화생방 가스실 (CBRN)', '#ffcc00', '#111111', 20);
                    const dangerSign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.8, 0.2), new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide }));
                    dangerSign.position.set(0, h * 0.75, d/2 + 0.1);
                    group.add(dangerSign);
                    
                    // Canisters inside
                    const canisterMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x005500, roughness: 0.2 });
                    for (let cx of [-w/3, w/3]) {
                        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.5), canisterMat);
                        can.position.set(cx, 1.25, -d/3);
                        group.add(can);
                    }
                    break;
                }

                default: {
                    const block = new THREE.Mesh(
                        new THREE.BoxGeometry(w, h, d),
                        wallMat
                    );
                    block.position.y = h/2;
                    block.castShadow = true; block.receiveShadow = true;
                    group.add(block);
                    break;
                }
            }
            
            group.position.set(data.x, 0, data.z);
            return group;
        };

        // Locations with shadows
        Object.entries(LOCATIONS).forEach(([name, data]) => {
            const styledBuilding = createStyledBuilding(name, data);
            scene.add(styledBuilding);

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

        // Initialize new models and AI bots
        if (typeof initObstacleCourseModels === 'function') initObstacleCourseModels();
        if (typeof initGrenadeTargetModel === 'function') initGrenadeTargetModel();

        // Training Ground
        const trainingFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(80, 80),
            new THREE.MeshStandardMaterial({ color: 0x7b8c4c, side: THREE.DoubleSide })
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
        let spawnedTreesCount = 0;
        let attempts = 0;
        while (spawnedTreesCount < 50 && attempts < 500) {
            attempts++;
            const tx = (Math.random() - 0.5) * 400;
            const tz = (Math.random() - 0.5) * 400;
            if (Math.abs(tx) < 50 && Math.abs(tz) < 50) continue; // Keep center clear

            // Avoid spawning trees on top of or near buildings/training grounds to prevent clipping
            let nearBuilding = false;
            
            // Check all standard locations
            for (const [name, loc] of Object.entries(LOCATIONS)) {
                const dx = tx - loc.x;
                const dz = tz - loc.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                
                // Exclude buffer area around each building
                const buffer = Math.max(loc.size[0], loc.size[2]) / 2 + 15;
                if (dist < buffer) {
                    nearBuilding = true;
                    break;
                }
            }

            // Also exclude training ground center (-100, -100)
            const trainDx = tx - (-100);
            const trainDz = tz - (-100);
            const trainDist = Math.sqrt(trainDx * trainDx + trainDz * trainDz);
            if (trainDist < 55) {
                nearBuilding = true;
            }

            if (nearBuilding) continue;

            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x4d2926 }));
            trunk.position.set(tx, 2.5, tz);
            trunk.castShadow = true;
            scene.add(trunk);

            const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2d3419 }));
            leaves.position.set(tx, 8, tz);
            leaves.castShadow = true;
            scene.add(leaves);

            spawnedTreesCount++;
        }

        // --- 4 Watchtowers and Searchlights ---
        window.searchlights = [];
        const towerPositions = [
            { x: -150, z: -150 },
            { x: 150, z: -150 },
            { x: -150, z: 150 },
            { x: 150, z: 150 }
        ];
        
        towerPositions.forEach((pos, idx) => {
            const towerGroup = new THREE.Group();
            
            // 4 legs
            const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.6, roughness: 0.4 });
            for (let lx of [-1.2, 1.2]) {
                for (let lz of [-1.2, 1.2]) {
                    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 12), legMat);
                    leg.position.set(lx, 6, lz);
                    leg.castShadow = true;
                    towerGroup.add(leg);
                }
            }
            
            // Platform
            const platformMat = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.8 });
            const platform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 3.2), platformMat);
            platform.position.y = 12;
            platform.receiveShadow = true;
            towerGroup.add(platform);
            
            // Pillars
            const cabPillMat = new THREE.MeshStandardMaterial({ color: 0x1c1d1e, metalness: 0.8 });
            for (let cx of [-1.4, 1.4]) {
                for (let cz of [-1.4, 1.4]) {
                    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), cabPillMat);
                    pillar.position.set(cx, 13.5, cz);
                    pillar.castShadow = true;
                    towerGroup.add(pillar);
                }
            }
            
            // Roof
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a2d2d, roughness: 0.7 });
            const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 4), roofMat);
            roof.rotation.y = Math.PI / 4;
            roof.position.y = 15.9;
            roof.castShadow = true;
            towerGroup.add(roof);
            
            // Searchlight pivot and casing
            const lightBase = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 }));
            lightBase.position.set(0, 13, 0);
            towerGroup.add(lightBase);
            
            const beamGroup = new THREE.Group();
            beamGroup.position.set(0, 13, 0);
            
            const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
            casing.rotation.x = Math.PI / 2;
            casing.position.set(0, 0, -0.4);
            beamGroup.add(casing);
            
            // Translucent yellow beam cone
            const beamGeo = new THREE.ConeGeometry(4, 25, 16, 1, true);
            beamGeo.translate(0, -12.5, 0);
            const beamMat = new THREE.MeshBasicMaterial({
                color: 0xfffca0,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.rotation.x = -Math.PI / 3.5;
            beamGroup.add(beam);
            
            towerGroup.add(beamGroup);
            
            window.searchlights.push({
                group: beamGroup,
                speed: 0.4 + idx * 0.15,
                baseAngle: idx * (Math.PI / 2)
            });
            
            towerGroup.position.set(pos.x, 0, pos.z);
            scene.add(towerGroup);
        });

        const WEAPONS_CONFIG = {
            'k2': { name: 'K2C1 소총', emoji: '🔫', damage: 25, recoil: 0.03, fireRate: 150, maxAmmo: 30, soundPitch: 1.0, range: 100 },
            'k3': { name: 'K3 경기관총', emoji: '💥', damage: 30, recoil: 0.05, fireRate: 100, maxAmmo: 100, soundPitch: 0.8, range: 120 },
            'k5': { name: 'K5 권총', emoji: '🔫', damage: 15, recoil: 0.02, fireRate: 300, maxAmmo: 12, soundPitch: 1.2, range: 50 },
            'k1a': { name: 'K1A 기관단총', emoji: '🔫', damage: 20, recoil: 0.025, fireRate: 120, maxAmmo: 30, soundPitch: 1.1, range: 70 },
            'k14': { name: 'K14 저격소총', emoji: '🎯', damage: 90, recoil: 0.12, fireRate: 1200, maxAmmo: 5, soundPitch: 0.6, range: 250, zoom: 30 },
            'k6': { name: 'K6 중기관총', emoji: '🔥', damage: 50, recoil: 0.08, fireRate: 200, maxAmmo: 50, soundPitch: 0.5, range: 150 },
            'marshal_card': { name: '원수 키카드', emoji: '💳', damage: 0, recoil: 0, fireRate: 9999, maxAmmo: 0, soundPitch: 1.0, range: 0 },
            'golden_k2': { name: '🎖️ 황금 K2C1 소총', emoji: '🔫', damage: 35, recoil: 0.02, fireRate: 120, maxAmmo: 40, soundPitch: 1.3, range: 130 }
        };
        window.WEAPONS_CONFIG = WEAPONS_CONFIG;

        const makeWeaponModel = (id) => {
            const group = new THREE.Group();
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x2c3539, metalness: 0.7, roughness: 0.3 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
            const plasticMat = new THREE.MeshStandardMaterial({ color: 0x1a2421, roughness: 0.7 });
            
            if (id === 'golden_k2') {
                const goldWeaponMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
                const goldDarkMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });
                
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.3), goldWeaponMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25), goldDarkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.25); group.add(barrel);
                const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.15), goldWeaponMat);
                handguard.position.set(0, 0.005, -0.15); group.add(handguard);
                const scope = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.08), goldDarkMat);
                scope.position.set(0, 0.045, -0.05); group.add(scope);
                const lens = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.001), new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.7 }));
                lens.position.set(0, 0.045, -0.091); group.add(lens);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.05), goldWeaponMat);
                mag.rotation.x = 0.2; mag.position.set(0, -0.07, -0.05); group.add(mag);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.15), goldWeaponMat);
                stock.position.set(0, -0.01, 0.2); group.add(stock);
                group.position.set(0.15, -0.15, -0.3);
            } else if (id === 'k5') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.12), metalMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08), darkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.06); group.add(barrel);
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.03), plasticMat);
                grip.rotation.x = 0.3; grip.position.set(0, -0.04, 0.02); group.add(grip);
                group.position.set(0.12, -0.15, -0.2);
            } else if (id === 'k3') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.35), metalMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3), darkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.3); group.add(barrel);
                const box = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x3d493a, roughness: 0.6 }));
                box.position.set(-0.04, -0.04, -0.05); group.add(box);
                const bipod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15), plasticMat);
                bipod1.rotation.z = 0.2; bipod1.position.set(0.02, -0.06, -0.2); group.add(bipod1);
                const bipod2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15), plasticMat);
                bipod2.rotation.z = -0.2; bipod2.position.set(-0.02, -0.06, -0.2); group.add(bipod2);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.18), plasticMat);
                stock.position.set(0, -0.01, 0.22); group.add(stock);
                group.position.set(0.15, -0.18, -0.35);
            } else if (id === 'k1a') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.22), metalMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12), darkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.15); group.add(barrel);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.045), metalMat);
                mag.rotation.x = 0.15; mag.position.set(0, -0.06, -0.03); group.add(mag);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.12), plasticMat);
                stock.position.set(0, -0.01, 0.15); group.add(stock);
                group.position.set(0.14, -0.14, -0.25);
            } else if (id === 'k14') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.32), metalMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45), darkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.38); group.add(barrel);
                const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.16), plasticMat);
                scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.05, -0.05); group.add(scope);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.2), plasticMat);
                stock.position.set(0, -0.01, 0.22); group.add(stock);
                group.position.set(0.15, -0.13, -0.32);
            } else if (id === 'k6') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.45), metalMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45), darkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.45); group.add(barrel);
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), plasticMat);
                handle.position.set(0, 0, 0.24); group.add(handle);
                group.position.set(0.15, -0.2, -0.4);
            } else if (id === 'marshal_card') {
                // Shiny gold card model
                const cardMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
                const cardBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.13), cardMat);
                cardBody.rotation.x = Math.PI / 4;
                cardBody.rotation.y = -Math.PI / 6;
                group.add(cardBody);
                
                // Add a small holographic stripe on the card
                const stripeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.9, roughness: 0.1 });
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.006, 0.13), stripeMat);
                stripe.position.set(0.02, 0.001, 0);
                stripe.rotation.x = Math.PI / 4;
                stripe.rotation.y = -Math.PI / 6;
                group.add(stripe);
                
                group.position.set(0.1, -0.15, -0.22);
            } else {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.3), metalMat);
                body.position.set(0, 0, 0); group.add(body);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25), darkMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.25); group.add(barrel);
                const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.15), plasticMat);
                handguard.position.set(0, 0.005, -0.15); group.add(handguard);
                const scope = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.08), plasticMat);
                scope.position.set(0, 0.045, -0.05); group.add(scope);
                const lens = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.001), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 }));
                lens.position.set(0, 0.045, -0.091); group.add(lens);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.05), metalMat);
                mag.rotation.x = 0.2; mag.position.set(0, -0.07, -0.05); group.add(mag);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.15), plasticMat);
                stock.position.set(0, -0.01, 0.2); group.add(stock);
                group.position.set(0.15, -0.15, -0.3);
            }

            if (id === 'k2' || id === 'golden_k2') {
                const attachmentColor = id === 'golden_k2' ? 0xd4af37 : 0x111111;
                const attachmentMat = new THREE.MeshStandardMaterial({ color: attachmentColor, metalness: 0.8, roughness: 0.2 });
                if (window.hasSilencer) {
                    const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), attachmentMat);
                    silencer.rotation.x = Math.PI / 2;
                    silencer.position.set(0, 0.01, -0.4);
                    group.add(silencer);
                }
                if (window.hasLaserSight) {
                    const laserBox = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.04), darkMat);
                    laserBox.position.set(0, -0.025, -0.15);
                    group.add(laserBox);
                    
                    const beamLength = 40;
                    const laserLine = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.0015, 0.0015, beamLength),
                        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 })
                    );
                    laserLine.rotation.x = Math.PI / 2;
                    laserLine.position.set(0, -0.025, -0.15 - beamLength/2);
                    group.add(laserLine);
                }
                if (window.hasAdvancedScope) {
                    const advScope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), attachmentMat);
                    advScope.rotation.x = Math.PI / 2;
                    advScope.position.set(0, 0.065, -0.05);
                    group.add(advScope);
                    const lensAdv = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 }));
                    lensAdv.position.set(0, 0.065, -0.131);
                    group.add(lensAdv);
                }
            }
            return group;
        };

        window.equipWeapon = (weaponId) => {
            if (!WEAPONS_CONFIG[weaponId]) return;
            window.activeWeaponId = weaponId;
            window.hasK2 = true; // Keep true for firing framework trigger
            
            if (window.localWeapon) {
                camera.remove(window.localWeapon);
            }
            
            window.localWeapon = makeWeaponModel(weaponId);
            window.localWeapon.visible = !window.isThirdPerson;
            camera.add(window.localWeapon);
            
            // Reset FOV zoom
            camera.fov = 75;
            camera.updateProjectionMatrix();
            
            // Update HUD
            const hWep = document.getElementById('hud-weapon');
            if (hWep) hWep.textContent = `${WEAPONS_CONFIG[weaponId].emoji} ${WEAPONS_CONFIG[weaponId].name}`;
            
            showToast(`🔫 [무기 장착] ${WEAPONS_CONFIG[weaponId].name} 장착 완료!`, '#22c55e');
        };

        window.updateDeployedWeapons = () => {
            if (!STATE.currentUser) return;
            const role = STATE.currentUser.militaryRole || '소총수';
            const rankIdx = window.RANKS ? window.RANKS.indexOf(STATE.currentUser.rank) : 0;
            
            let weapons = [];
            
            // 1. Rank-based Weapons
            if (rankIdx >= 4) { // 하사 이상
                weapons.push('k2', 'k5');
            } else { // 이등병 ~ 병장
                weapons.push('k2');
            }
            
            // 2. Specialty/Role-based Weapons
            if (role === '분대지원화기병') {
                if (!weapons.includes('k3')) weapons.push('k3');
            } else if (role === '특수부대') {
                if (!weapons.includes('k1a')) weapons.push('k1a');
                if (!weapons.includes('k14')) weapons.push('k14');
            } else if (role === '차량 승무원') {
                if (!weapons.includes('k1a')) weapons.push('k1a');
            } else if (role === '중화기병') {
                if (!weapons.includes('k6')) weapons.push('k6');
            }
            
            // 3. Sync extra weapons from inventory
            db.ref('users/' + STATE.currentUser.uid + '/inventory').once('value', snap => {
                const inv = snap.val() || {};
                Object.values(inv).forEach(itemId => {
                    if (WEAPONS_CONFIG[itemId] && !weapons.includes(itemId)) {
                        weapons.push(itemId);
                    }
                });
                
                window.availableWeapons = weapons;
                
                // Render HUD weapons list
                const hWepList = document.getElementById('hud-weapons-list');
                if (hWepList) {
                    hWepList.textContent = window.availableWeapons.map((w, i) => `[${i+1}] ${WEAPONS_CONFIG[w].name}`).join('  ');
                }
                
                // Equip the first weapon if not holding one
                if (!window.activeWeaponId || !window.availableWeapons.includes(window.activeWeaponId)) {
                    window.equipWeapon(window.availableWeapons[0]);
                }
            });
        };


        // --- Third Person Camera Setup ---
        window.isThirdPerson = false;
        window.thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        window.thirdPersonCamera.position.set(0, 1.5, 5); // Behind and slightly up
        window.thirdPersonCamera.rotation.x = -0.1; // Slight downward tilt
        camera.add(window.thirdPersonCamera);

        // --- Camouflage Materials defined at top of init3D ---

        const generateRainbowMaterial = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Base dark carbon metal
            ctx.fillStyle = '#0f0f12';
            ctx.fillRect(0, 0, 256, 256);
            
            // Add high-quality brushed metal/scratch noise
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            for (let i = 0; i < 80; i++) {
                const y = Math.random() * 256;
                const h = Math.random() * 2 + 1;
                ctx.fillRect(0, y, 256, h);
            }
            
            // Draw neon glowing border with ultra-saturated colors
            const gradient = ctx.createLinearGradient(0, 0, 256, 256);
            gradient.addColorStop(0, '#ff0066');    // Vibrant Pink-Red
            gradient.addColorStop(0.2, '#ffff00');   // Pure Neon Yellow
            gradient.addColorStop(0.4, '#00ff33');   // Pure Neon Green
            gradient.addColorStop(0.6, '#00ffff');   // Pure Neon Cyan
            gradient.addColorStop(0.8, '#a855f7');   // Bright Neon Purple
            gradient.addColorStop(1, '#ff00ff');     // Vibrant Magenta
            
            // Glow Layer 1 (Outer Blur)
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 14;
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 18;
            ctx.strokeRect(10, 10, 236, 236);
            
            // Glow Layer 2 (Inner Core)
            ctx.lineWidth = 6;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.strokeRect(10, 10, 236, 236);
            
            // Reset shadow for inner panel lines
            ctx.shadowBlur = 0;
            
            // Draw subtle inner panel lines to look techy
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 2;
            ctx.strokeRect(20, 20, 216, 216);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            
            return new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap: texture,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 1.8, // moderate self-illumination/glow intensity
                roughness: 0.15,
                metalness: 0.85
            });
        };

        const generateStageMaterial = (stage) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Base carbon metal
            ctx.fillStyle = '#0f0f12';
            ctx.fillRect(0, 0, 256, 256);
            
            // Subtle scratch noise
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            for (let i = 0; i < 60; i++) {
                const y = Math.random() * 256;
                const h = Math.random() * 2 + 1;
                ctx.fillRect(0, y, 256, h);
            }
            
            // Outlines base
            let borderGlow = '#a855f7';
            let borderCore = '#ffffff';
            let drawsStars = false;
            
            if (stage === 1) {
                borderGlow = '#ffd700'; // Yellow glow
                borderCore = '#ffffaa';
            } else if (stage === 2) {
                borderGlow = '#d946ef'; // Pink/Purple glow
                borderCore = '#ffddff';
            } else if (stage === 3) {
                borderGlow = '#a855f7'; // Purple glow
                borderCore = '#f3e8ff';
            } else if (stage === 5) {
                borderGlow = '#ec4899'; // Deep magenta/pink
                borderCore = '#ffd700';  // Golden core outline!
                drawsStars = true;
            }
            
            // Glow layer 1
            ctx.strokeStyle = borderGlow;
            ctx.lineWidth = 14;
            ctx.shadowColor = borderGlow;
            ctx.shadowBlur = 18;
            ctx.strokeRect(10, 10, 236, 236);
            
            // Glow layer 2
            ctx.lineWidth = 6;
            ctx.shadowColor = borderCore;
            ctx.shadowBlur = 6;
            ctx.strokeRect(10, 10, 236, 236);
            
            // Reset shadows
            ctx.shadowBlur = 0;
            
            if (drawsStars) {
                // Add constellations/stars for stage 5
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                for (let i = 0; i < 15; i++) {
                    const x = Math.random() * 216 + 20;
                    const y = Math.random() * 216 + 20;
                    const r = Math.random() * 2 + 1;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Draw some gold star cross lines
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    const x = Math.random() * 156 + 50;
                    const y = Math.random() * 156 + 50;
                    ctx.beginPath();
                    ctx.moveTo(x - 10, y);
                    ctx.lineTo(x + 10, y);
                    ctx.moveTo(x, y - 10);
                    ctx.lineTo(x, y + 10);
                    ctx.stroke();
                }
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 2;
                ctx.strokeRect(20, 20, 216, 216);
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            
            return new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap: texture,
                emissive: new THREE.Color(stage === 5 ? 0x6d28d9 : (stage === 1 ? 0xd97706 : 0x444444)),
                emissiveIntensity: stage === 5 ? 2.5 : (stage === 1 ? 1.0 : 1.5),
                roughness: 0.15,
                metalness: 0.85
            });
        };

        const convertToCreatorModel = (mesh, stage = 4) => {
            if (!mesh) return;
            mesh.userData.isCreator = true;
            mesh.userData.creatorStage = stage;

            if (!window.creatorStageMaterials) {
                window.creatorStageMaterials = {};
            }
            if (!window.creatorStageMaterials[1]) window.creatorStageMaterials[1] = generateStageMaterial(1);
            if (!window.creatorStageMaterials[2]) window.creatorStageMaterials[2] = generateStageMaterial(2);
            if (!window.creatorStageMaterials[3]) window.creatorStageMaterials[3] = generateStageMaterial(3);
            if (!window.creatorStageMaterials[4]) window.creatorStageMaterials[4] = generateRainbowMaterial();
            if (!window.creatorStageMaterials[5]) window.creatorStageMaterials[5] = generateStageMaterial(5);

            const stageMat = window.creatorStageMaterials[stage];

            mesh.traverse(child => {
                if (child.isMesh) {
                    if (['torso', 'head', 'lArm', 'rArm', 'lLeg', 'rLeg', 'lBoot', 'rBoot'].includes(child.name)) {
                        child.material = stageMat;
                    }
                }
            });

            // Adjust scale based on stage
            const scales = { 1: 0.75, 2: 0.88, 3: 1.0, 4: 1.15, 5: 1.3 };
            const currentScale = scales[stage] || 1.0;
            mesh.scale.set(currentScale, currentScale, currentScale);

            // Hide standard gears
            const hood = mesh.getObjectByName('hood');
            const backpack = mesh.getObjectByName('backpack');
            const sleepingBag = mesh.getObjectByName('sleepingBag');
            const beret = mesh.getObjectByName('beret');
            const helmet = mesh.getObjectByName('helmet');
            const goggles = mesh.getObjectByName('goggles');
            const vest = mesh.getObjectByName('vest');
            const officerCap = mesh.getObjectByName('officerCap');
            if (hood) hood.visible = false;
            if (backpack) backpack.visible = false;
            if (sleepingBag) sleepingBag.visible = false;
            if (beret) beret.visible = false;
            if (helmet) helmet.visible = false;
            if (goggles) goggles.visible = false;
            if (vest) vest.visible = false;
            if (officerCap) officerCap.visible = false;

            // Remove existing attachments
            const cleanObj = (name) => {
                const obj = mesh.getObjectByName(name);
                if (obj && obj.parent) obj.parent.remove(obj);
            };
            cleanObj('creatorCrown');
            cleanObj('creatorCollar');
            cleanObj('leftWing');
            cleanObj('rightWing');
            cleanObj('lBooster');
            cleanObj('rBooster');
            cleanObj('backBooster');
            cleanObj('cosmicLight');
            cleanObj('creatorChestCore');
            cleanObj('creatorFacePanel');
            cleanObj('creatorNameplate');
            cleanObj('creatorAuraRing');
            if (mesh.userData.orbitingRocks) {
                mesh.userData.orbitingRocks.forEach(rock => {
                    if (rock.parent) rock.parent.remove(rock);
                });
                mesh.userData.orbitingRocks = null;
            }

            // 1. Add Crown & Neck Collar to Head
            const head = mesh.getObjectByName('head');
            if (head) {
                const crownGroup = new THREE.Group();
                crownGroup.name = 'creatorCrown';
                const goldMat = new THREE.MeshStandardMaterial({
                    color: 0xffd700,
                    metalness: 1.0,
                    roughness: 0.15
                });
                
                const crownScale = stage === 1 ? 0.5 : (stage === 2 ? 0.75 : (stage === 3 ? 1.0 : (stage === 4 ? 1.25 : 1.4)));
                crownGroup.scale.set(crownScale, crownScale, crownScale);

                // Base band
                const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16), goldMat);
                band.position.y = 0.18;
                crownGroup.add(band);
                
                // Spikes
                const numSpikes = stage === 1 ? 4 : 6;
                const radius = 0.14;
                const rubyMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
                const sapphireMat = new THREE.MeshBasicMaterial({ color: 0x0066ff });
                
                for (let i = 0; i < numSpikes; i++) {
                    const angle = (i / numSpikes) * Math.PI * 2;
                    const spikeGroup = new THREE.Group();
                    
                    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), goldMat);
                    spike.position.y = 0.04;
                    spikeGroup.add(spike);
                    
                    if (stage > 1) {
                        const gemMat = (i % 2 === 0) ? rubyMat : sapphireMat;
                        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), gemMat);
                        gem.position.y = 0.08;
                        spikeGroup.add(gem);
                    }
                    
                    spikeGroup.position.set(Math.cos(angle) * radius, 0.18, Math.sin(angle) * radius);
                    spikeGroup.rotation.z = -Math.cos(angle) * 0.15;
                    spikeGroup.rotation.x = Math.sin(angle) * 0.15;
                    spikeGroup.rotation.y = -angle;
                    
                    crownGroup.add(spikeGroup);
                }
                head.add(crownGroup);

                const facePanel = new THREE.Mesh(
                    new THREE.BoxGeometry(0.26, 0.2, 0.012),
                    new THREE.MeshBasicMaterial({ color: 0x050509 })
                );
                facePanel.name = 'creatorFacePanel';
                facePanel.position.set(0, -0.01, 0.181);
                head.add(facePanel);

                if (stage >= 2) {
                    const collarGeom = new THREE.TorusGeometry(0.17, 0.02, 8, 24);
                    const collar = new THREE.Mesh(collarGeom, goldMat);
                    collar.rotation.x = Math.PI / 2;
                    collar.name = 'creatorCollar';
                    collar.position.y = -0.16;
                    head.add(collar);
                }
            }

            // 2. Add Wings to Torso (Stages 2, 4, 5)
            const torso = mesh.getObjectByName('torso');
            if (torso) {
                const coreGroup = new THREE.Group();
                coreGroup.name = 'creatorChestCore';
                const neonColor = stage === 5 ? 0xd946ef : (stage === 4 ? 0xa855f7 : 0xffd700);
                const panelMat = new THREE.MeshBasicMaterial({ color: 0x06060a });
                const trimMat = new THREE.MeshBasicMaterial({ color: neonColor });
                const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.018), panelMat);
                chestPanel.position.set(0, 0.03, 0.215);
                coreGroup.add(chestPanel);
                const topTrim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.022), trimMat);
                topTrim.position.set(0, 0.275, 0.23);
                coreGroup.add(topTrim);
                const bottomTrim = topTrim.clone();
                bottomTrim.position.y = -0.215;
                coreGroup.add(bottomTrim);
                const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.022), trimMat);
                leftTrim.position.set(-0.31, 0.03, 0.23);
                coreGroup.add(leftTrim);
                const rightTrim = leftTrim.clone();
                rightTrim.position.x = 0.31;
                coreGroup.add(rightTrim);
                torso.add(coreGroup);

                if (stage === 2 || stage === 4 || stage === 5) {
                    const makeWing = (isRight) => {
                        const wing = new THREE.Group();
                        wing.name = isRight ? 'rightWing' : 'leftWing';
                        const sideSign = isRight ? -1 : 1;
                        
                        const wingBaseMat = new THREE.MeshStandardMaterial({
                            color: 0x141416,
                            roughness: 0.3,
                            metalness: 0.8,
                            side: THREE.DoubleSide
                        });
                        
                        const edgeColors = {
                            2: 0xd946ef,
                            4: 0xa855f7,
                            5: 0xffd700
                        };
                        const edgeColor = edgeColors[stage] || 0xa855f7;
                        
                        const wingEdgeMat = new THREE.MeshBasicMaterial({
                            color: edgeColor,
                            side: THREE.DoubleSide
                        });
                        
                        const joint = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), wingBaseMat);
                        joint.position.set(0, 0, -0.02);
                        wing.add(joint);
                        
                        const wingScaleFactor = stage === 2 ? 0.6 : (stage === 5 ? 1.2 : 0.85);

                        try {
                            const outerShape = new THREE.Shape();
                            outerShape.moveTo(0, -0.08);
                            outerShape.lineTo(0.08, -0.08);
                            outerShape.quadraticCurveTo(0.35, 0.15, 0.55, 0.95);
                            outerShape.quadraticCurveTo(0.28, 0.28, 0, 0.08);
                            outerShape.closePath();
                            
                            const extrudeSettings = {
                                depth: 0.03,
                                bevelEnabled: true,
                                bevelSegments: 2,
                                steps: 1,
                                bevelSize: 0.006,
                                bevelThickness: 0.006
                            };
                            const wingGeom = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
                            const mainWingMesh = new THREE.Mesh(wingGeom, wingBaseMat);
                            
                            const innerShape = new THREE.Shape();
                            innerShape.moveTo(0.02, -0.05);
                            innerShape.quadraticCurveTo(0.3, 0.18, 0.5, 0.88);
                            innerShape.quadraticCurveTo(0.25, 0.25, 0.02, 0.05);
                            innerShape.closePath();
                            
                            const innerExtrudeSettings = {
                                depth: 0.04,
                                bevelEnabled: true,
                                bevelSegments: 1,
                                steps: 1,
                                bevelSize: 0.003,
                                bevelThickness: 0.003
                            };
                            const innerGeom = new THREE.ExtrudeGeometry(innerShape, innerExtrudeSettings);
                            const innerWingMesh = new THREE.Mesh(innerGeom, wingEdgeMat);
                            innerWingMesh.position.z = -0.005;
                            
                            wing.add(mainWingMesh);
                            wing.add(innerWingMesh);

                            if (stage === 5) {
                                const sphereGeom = new THREE.SphereGeometry(0.045, 8, 8);
                                const orbCyan = new THREE.Mesh(sphereGeom, new THREE.MeshBasicMaterial({ color: 0x00ffff }));
                                orbCyan.position.set(0.5, 0.9, 0.05);
                                wing.add(orbCyan);

                                const orbGold = new THREE.Mesh(sphereGeom, new THREE.MeshBasicMaterial({ color: 0xffd700 }));
                                orbGold.position.set(0.3, 0.5, 0.05);
                                wing.add(orbGold);
                            }
                        } catch (err) {
                            const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.04), wingBaseMat);
                            seg1.position.set(sideSign * 0.18, 0.02, -0.04);
                            seg1.rotation.z = sideSign * 0.1;
                            wing.add(seg1);
                            
                            const trim1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.05), wingEdgeMat);
                            trim1.position.set(sideSign * 0.18, 0.08, -0.04);
                            trim1.rotation.z = sideSign * 0.1;
                            wing.add(trim1);
                        }
                        
                        wing.scale.set(sideSign * wingScaleFactor, wingScaleFactor, wingScaleFactor);
                        wing.rotation.y = -sideSign * 0.25;
                        wing.rotation.z = sideSign * 0.2;
                        
                        return wing;
                    };
                    
                    const leftWing = makeWing(false);
                    leftWing.position.set(0.2, 0.1, -0.2);
                    torso.add(leftWing);
                    
                    const rightWing = makeWing(true);
                    rightWing.position.set(-0.2, 0.1, -0.2);
                    torso.add(rightWing);
                }

                // 3. Back Booster Rocket (Stage 3 only)
                if (stage === 3) {
                    const backBoosterGroup = new THREE.Group();
                    backBoosterGroup.name = 'backBooster';
                    
                    const metalMat = new THREE.MeshStandardMaterial({ color: 0x221144, metalness: 0.8, roughness: 0.2 });
                    const trimMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 1.5 });
                    
                    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.35, 12), metalMat);
                    cylinder.rotation.x = Math.PI / 6;
                    cylinder.position.set(0, 0.1, -0.25);
                    backBoosterGroup.add(cylinder);
                    
                    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12), trimMat);
                    trim.rotation.x = Math.PI / 2 + Math.PI / 6;
                    trim.position.set(0, -0.08, -0.35);
                    backBoosterGroup.add(trim);
                    
                    const flameGroup = new THREE.Group();
                    flameGroup.name = 'flame';
                    flameGroup.position.set(0, -0.1, -0.37);
                    flameGroup.visible = false;
                    
                    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), new THREE.MeshBasicMaterial({
                        color: 0xff3300, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending
                    }));
                    outerFlame.rotation.x = Math.PI / 6;
                    outerFlame.geometry.translate(0, -0.2, 0);
                    flameGroup.add(outerFlame);
                    
                    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 8), new THREE.MeshBasicMaterial({
                        color: 0xffffff, transparent: true, opacity: 0.95
                    }));
                    innerFlame.rotation.x = Math.PI / 6;
                    innerFlame.geometry.translate(0, -0.11, 0);
                    flameGroup.add(innerFlame);
                    
                    backBoosterGroup.add(flameGroup);
                    torso.add(backBoosterGroup);
                }
            }

            // 4. Boosters to Boots (All stages)
            const makeBooster = (name) => {
                const boosterGroup = new THREE.Group();
                boosterGroup.name = name;
                
                const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
                const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 12), stageMat);
                nozzle.position.y = -0.06;
                boosterGroup.add(nozzle);
                
                const trim = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.015, 6, 12), goldMat);
                trim.rotation.x = Math.PI / 2;
                trim.position.y = -0.12;
                boosterGroup.add(trim);
                
                const lightColors = { 1: 0xffaa00, 2: 0xff00ff, 3: 0xa855f7, 4: 0xff7700, 5: 0x00ffff };
                const thrustLight = new THREE.PointLight(lightColors[stage] || 0xff7700, 0, 6);
                thrustLight.name = 'thrustLight';
                thrustLight.position.set(0, -0.2, 0);
                boosterGroup.add(thrustLight);
                
                const flameGroup = new THREE.Group();
                flameGroup.name = 'flame';
                flameGroup.position.y = -0.12;
                flameGroup.visible = false;
                
                const flameColors = {
                    1: { outer: 0xffaa00, inner: 0xffffff },
                    2: { outer: 0xd946ef, inner: 0xffffff },
                    3: { outer: 0xa855f7, inner: 0xffffff },
                    4: { outer: 0xff3300, inner: 0xffaa00 },
                    5: { outer: 0x00ffff, inner: 0xffffff }
                };
                const colors = flameColors[stage] || { outer: 0xff3300, inner: 0xffffff };

                const outerFlameGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
                outerFlameGeo.translate(0, -0.225, 0);
                const outerFlame = new THREE.Mesh(outerFlameGeo, new THREE.MeshBasicMaterial({
                    color: colors.outer, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending
                }));
                outerFlame.name = 'outer';
                flameGroup.add(outerFlame);
                
                const innerFlameGeo = new THREE.ConeGeometry(0.05, 0.22, 8);
                innerFlameGeo.translate(0, -0.11, 0);
                const innerFlame = new THREE.Mesh(innerFlameGeo, new THREE.MeshBasicMaterial({
                    color: colors.inner, transparent: true, opacity: 0.95
                }));
                innerFlame.name = 'inner';
                flameGroup.add(innerFlame);
                
                boosterGroup.add(flameGroup);
                return boosterGroup;
            };

            const lBoot = mesh.getObjectByName('lBoot');
            if (lBoot) lBoot.add(makeBooster('lBooster'));

            const rBoot = mesh.getObjectByName('rBoot');
            if (rBoot) rBoot.add(makeBooster('rBooster'));

            // 5. Stage 5 Orbiting Space Rocks & Cosmic Light
            if (stage === 5) {
                mesh.userData.orbitingRocks = [];
                const rockMat = new THREE.MeshStandardMaterial({
                    color: 0x3d1a66, roughness: 0.9, metalness: 0.2, emissive: 0x6d28d9, emissiveIntensity: 0.3
                });
                for (let i = 0; i < 4; i++) {
                    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06), rockMat);
                    rock.userData = {
                        angle: (i / 4) * Math.PI * 2,
                        radius: 0.8,
                        speed: 1.5 + i * 0.2,
                        yOffset: 0.5 + i * 0.2
                    };
                    mesh.add(rock);
                    mesh.userData.orbitingRocks.push(rock);
                }
                const cosmicLight = new THREE.PointLight(0xa855f7, 2, 5);
                cosmicLight.name = 'cosmicLight';
                cosmicLight.position.set(0, 1.25, 0);
                mesh.add(cosmicLight);

                const auraRing = new THREE.Mesh(
                    new THREE.TorusGeometry(0.92, 0.018, 8, 64),
                    new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.75 })
                );
                auraRing.name = 'creatorAuraRing';
                auraRing.rotation.x = Math.PI / 2;
                auraRing.position.y = 0.08;
                mesh.add(auraRing);
            }

            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 512;
            labelCanvas.height = 128;
            const labelCtx = labelCanvas.getContext('2d');
            labelCtx.fillStyle = 'rgba(5, 5, 12, 0.78)';
            labelCtx.fillRect(0, 0, 512, 128);
            labelCtx.strokeStyle = '#d946ef';
            labelCtx.lineWidth = 6;
            labelCtx.strokeRect(8, 8, 496, 112);
            labelCtx.fillStyle = '#ffd166';
            labelCtx.font = 'bold 34px Pretendard, sans-serif';
            labelCtx.textAlign = 'center';
            labelCtx.fillText('BOSS 제작진 킹', 256, 50);
            labelCtx.fillStyle = '#ffffff';
            labelCtx.font = 'bold 26px Pretendard, sans-serif';
            labelCtx.fillText('ree1203', 256, 88);
            const labelTex = new THREE.CanvasTexture(labelCanvas);
            const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
            labelSprite.name = 'creatorNameplate';
            labelSprite.position.set(0, 2.35, 0);
            labelSprite.scale.set(1.9, 0.48, 1);
            mesh.add(labelSprite);
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
            torso.name = 'torso';
            group.add(torso);

            // Head (머리)
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
            head.position.y = 1.75;
            head.name = 'head';
            group.add(head);

            // Gas mask filter box (attached to face)
            const maskFilter = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8), blackMat);
            maskFilter.rotation.x = Math.PI / 2;
            maskFilter.position.set(0, 1.7, 0.22);
            maskFilter.userData.isGasMaskPart = true;
            maskFilter.name = 'maskFilter';
            maskFilter.visible = false;
            group.add(maskFilter);

            // Winter Hood (방한복 털 장식)
            const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.2), mat);
            hood.position.y = 1.55;
            hood.userData.isCamo = true;
            hood.name = 'hood';
            group.add(hood);

            // Backpack (군장)
            const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), mat);
            backpack.position.set(0, 1.25, -0.45);
            backpack.userData.isCamo = true;
            backpack.name = 'backpack';
            group.add(backpack);

            // Sleeping Bag (침낭)
            const sleepingBag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7), mat);
            sleepingBag.rotation.z = Math.PI / 2;
            sleepingBag.position.set(0, 1.75, -0.45);
            sleepingBag.userData.isCamo = true;
            sleepingBag.name = 'sleepingBag';
            group.add(sleepingBag);

            // Arms (팔)
            const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), mat);
            lArm.position.set(0.55, 1.25, 0);
            lArm.userData.isCamo = true;
            lArm.name = 'lArm';
            group.add(lArm);

            const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), mat);
            rArm.position.set(-0.55, 1.25, 0);
            rArm.userData.isCamo = true;
            rArm.name = 'rArm';
            group.add(rArm);

            // Legs (다리)
            const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), mat);
            lLeg.position.set(0.2, 0.55, 0);
            lLeg.userData.isCamo = true;
            lLeg.name = 'lLeg';
            group.add(lLeg);

            const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), mat);
            rLeg.position.set(-0.2, 0.55, 0);
            rLeg.userData.isCamo = true;
            rLeg.name = 'rLeg';
            group.add(rLeg);

            // Boots (전투화)
            const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.35), blackMat);
            lBoot.position.set(0.2, 0.1, 0.05);
            lBoot.name = 'lBoot';
            group.add(lBoot);

            const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.35), blackMat);
            rBoot.position.set(-0.2, 0.1, 0.05);
            rBoot.name = 'rBoot';
            group.add(rBoot);

            // Golden Epaulets (원수 정복 전용)
            const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
            const lEpaulet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.35), goldMat);
            lEpaulet.position.set(0.55, 1.5, 0);
            lEpaulet.userData.isEpaulet = true;
            lEpaulet.name = 'lEpaulet';
            lEpaulet.visible = (colorHex === 0xffffff);
            group.add(lEpaulet);

            const rEpaulet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.35), goldMat);
            rEpaulet.position.set(-0.55, 1.5, 0);
            rEpaulet.userData.isEpaulet = true;
            rEpaulet.name = 'rEpaulet';
            rEpaulet.visible = (colorHex === 0xffffff);
            group.add(rEpaulet);

            // 1. Beret (베레모)
            const beretMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
            const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 8), beretMat);
            beret.position.set(0.05, 1.94, 0);
            beret.rotation.z = -0.15; // Slightly tilted to the right of the head
            beret.name = 'beret';
            beret.visible = false;
            group.add(beret);

            // 2. Tactical Helmet (SWAT 헬멧)
            const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.38), blackMat);
            helmet.position.set(0, 1.93, 0);
            helmet.name = 'helmet';
            helmet.visible = false;
            group.add(helmet);

            // Goggles/Mask (고글)
            const goggleMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.7, roughness: 0.2 });
            const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.1), goggleMat);
            goggles.position.set(0, 1.8, 0.16);
            goggles.name = 'goggles';
            goggles.visible = false;
            group.add(goggles);

            // 3. Tactical Vest (방탄조끼)
            const vestMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
            const vest = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.68, 0.46), vestMat);
            vest.position.y = 1.25;
            vest.name = 'vest';
            vest.visible = false;
            group.add(vest);

            // 4. Officer Cap (장교 정모)
            const officerCap = new THREE.Group();
            officerCap.name = 'officerCap';
            officerCap.visible = false;
            
            const capTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
            const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.1, 8), capTopMat);
            capTop.position.set(0, 1.95, -0.02);
            capTop.rotation.x = 0.05; // Slightly tilted forward
            officerCap.add(capTop);

            const capVisorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
            const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.12), capVisorMat);
            capVisor.position.set(0, 1.9, 0.16);
            capVisor.rotation.x = 0.2; // tilted down visor
            officerCap.add(capVisor);

            group.add(officerCap);

            return group;
        };

        window.refreshPlayerSkin = (mesh, skinId, rank, isJailed) => {
            if (!mesh) return;

            const isLocalCreator = (mesh === window.localPlayerBody && STATE.currentUser && STATE.currentUser.username === 'ree1203');
            const isOtherCreator = mesh.userData.isCreator || (mesh.userData.isCreatorMesh === true);
            const shouldBeCreator = isLocalCreator || isOtherCreator || (skinId && skinId.startsWith('creator_skin'));
            
            const isCreatorSkin = (skinId && (skinId.startsWith('creator_skin') || skinId === 'creator_skin')) ||
                                  (isLocalCreator && (!skinId || skinId === 'normal' || skinId === 'camo_army'));

            if (shouldBeCreator && isCreatorSkin) {
                let stage = 5;
                if (skinId && skinId.startsWith('creator_skin_stage')) {
                    stage = parseInt(skinId.replace('creator_skin_stage', '')) || 4;
                }
                
                if (!mesh.userData.isCreator || mesh.userData.creatorStage !== stage) {
                    convertToCreatorModel(mesh, stage);
                }
                
                const hood = mesh.getObjectByName('hood');
                const backpack = mesh.getObjectByName('backpack');
                const sleepingBag = mesh.getObjectByName('sleepingBag');
                const beret = mesh.getObjectByName('beret');
                const helmet = mesh.getObjectByName('helmet');
                const goggles = mesh.getObjectByName('goggles');
                const vest = mesh.getObjectByName('vest');
                const officerCap = mesh.getObjectByName('officerCap');
                if (hood) hood.visible = false;
                if (backpack) backpack.visible = false;
                if (sleepingBag) sleepingBag.visible = false;
                if (beret) beret.visible = false;
                if (helmet) helmet.visible = false;
                if (goggles) goggles.visible = false;
                if (vest) vest.visible = false;
                if (officerCap) officerCap.visible = false;
                
                const crown = mesh.getObjectByName('creatorCrown');
                if (crown) crown.visible = true;
                const collar = mesh.getObjectByName('creatorCollar');
                if (collar) collar.visible = (stage >= 2);
                const leftWing = mesh.getObjectByName('leftWing');
                if (leftWing) leftWing.visible = (stage === 2 || stage === 4 || stage === 5);
                const rightWing = mesh.getObjectByName('rightWing');
                if (rightWing) rightWing.visible = (stage === 2 || stage === 4 || stage === 5);
                const lBooster = mesh.getObjectByName('lBooster');
                if (lBooster) lBooster.visible = true;
                const rBooster = mesh.getObjectByName('rBooster');
                if (rBooster) rBooster.visible = true;
                const backBooster = mesh.getObjectByName('backBooster');
                if (backBooster) backBooster.visible = (stage === 3);
                
                return;
            } else if (mesh.userData.isCreator) {
                mesh.userData.isCreator = false;
                mesh.userData.creatorStage = null;
                const cleanObj = (name) => {
                    const obj = mesh.getObjectByName(name);
                    if (obj && obj.parent) obj.parent.remove(obj);
                };
                cleanObj('creatorCrown');
                cleanObj('creatorCollar');
                cleanObj('leftWing');
                cleanObj('rightWing');
                cleanObj('lBooster');
                cleanObj('rBooster');
                cleanObj('backBooster');
                if (mesh.userData.orbitingRocks) {
                    mesh.userData.orbitingRocks.forEach(rock => {
                        if (rock.parent) rock.parent.remove(rock);
                    });
                    mesh.userData.orbitingRocks = null;
                }
            }

            let targetColor = 0x4b5320; 
            const isJailSkin = (isJailed || skinId === 'camo_jail');
            const isSwatSkin = (skinId === 'camo_swat');
            const isDressSkin = (skinId === 'dress_uniform');

            if (isJailSkin) {
                targetColor = 0xff7f00; // Orange 수감복
            } else if (skinId === 'camo_desert') {
                targetColor = 0xd2b48c; 
            } else if (skinId === 'camo_marine') {
                targetColor = 0xb22222; 
            } else if (skinId === 'camo_swat') {
                targetColor = 0x111111; // SWAT 흑복
            } else if (skinId === 'camo_winter') {
                targetColor = 0xffffff; 
            } else if (skinId === 'camo_army') {
                targetColor = 0x3a4b2a; // 육군 베레모전투복
            } else if (skinId === 'camo_udt') {
                targetColor = 0x475569; // UDT 디지털전투복 (Grayish)
            } else if (skinId === 'camo_navy') {
                targetColor = 0x2b4c7e; // 해군 파란색 디지털전투복
            } else if (isDressSkin) {
                targetColor = 0xffffff; // 장교 정복
            } else {
                if (window.isDressUniform) {
                    targetColor = 0xffffff;
                } else {
                    const idx = window.RANKS ? window.RANKS.indexOf(rank) : -1;
                    if (idx >= 14) targetColor = 0x222222; 
                    else if (idx >= 11) targetColor = 0x1f305e; 
                    else if (idx >= 8) targetColor = 0xc2b280;  
                    else if (idx >= 4) targetColor = 0x3a4b2a;  
                    else targetColor = 0x4b5320;                
                }
            }

            const newMat = getCamoMaterial(targetColor);
            mesh.traverse(child => {
                if (child.isMesh) {
                    if (child.userData.isCamo) {
                        child.material = newMat;
                    }
                    if (child.userData.isEpaulet) {
                        child.visible = (isDressSkin || rank === '원수');
                    }
                }
            });

            // Set specific parts visibility
            const hood = mesh.getObjectByName('hood');
            const backpack = mesh.getObjectByName('backpack');
            const sleepingBag = mesh.getObjectByName('sleepingBag');
            const beret = mesh.getObjectByName('beret');
            const helmet = mesh.getObjectByName('helmet');
            const goggles = mesh.getObjectByName('goggles');
            const vest = mesh.getObjectByName('vest');
            const officerCap = mesh.getObjectByName('officerCap');

            // Jail / SWAT / Dress Uniform don't carry heavy survival packs or wear winter hoods
            const showSurvivalGear = !isJailSkin && !isSwatSkin && !isDressSkin;
            if (hood) hood.visible = showSurvivalGear;
            if (backpack) backpack.visible = showSurvivalGear;
            if (sleepingBag) sleepingBag.visible = showSurvivalGear;

            // Beret visibility and color mapping
            if (beret) {
                if (skinId === 'camo_army') {
                    beret.visible = true;
                    beret.material.color.setHex(0x14532d); // Dark Green
                } else if (skinId === 'camo_udt') {
                    beret.visible = true;
                    beret.material.color.setHex(0x64748b); // Grey/Slate Beret for UDT/SEAL
                } else if (skinId === 'camo_navy') {
                    beret.visible = true;
                    beret.material.color.setHex(0x1e3a8a); // Blue/Navy Beret
                } else {
                    beret.visible = false;
                }
            }

            // Helmet & Goggles & Vest (SWAT exclusive)
            if (helmet) helmet.visible = isSwatSkin;
            if (goggles) goggles.visible = isSwatSkin;
            if (vest) vest.visible = isSwatSkin;

            // Officer Cap (Dress White exclusive)
            if (officerCap) officerCap.visible = isDressSkin;
        };

        window.applyPose = (mesh, pose, timeSec = 0) => {
            const torso = mesh.getObjectByName('torso');
            const head = mesh.getObjectByName('head');
            const lArm = mesh.getObjectByName('lArm');
            const rArm = mesh.getObjectByName('rArm');
            const lLeg = mesh.getObjectByName('lLeg');
            const rLeg = mesh.getObjectByName('rLeg');
            const lBoot = mesh.getObjectByName('lBoot');
            const rBoot = mesh.getObjectByName('rBoot');
            const backpack = mesh.getObjectByName('backpack');
            const sleepingBag = mesh.getObjectByName('sleepingBag');

            if (torso) { torso.rotation.set(0, 0, 0); torso.position.y = 1.25; }
            if (head) { head.rotation.set(0, 0, 0); head.position.y = 1.75; }
            if (lArm) { lArm.rotation.set(0, 0, 0); lArm.position.set(0.55, 1.25, 0); }
            if (rArm) { rArm.rotation.set(0, 0, 0); rArm.position.set(-0.55, 1.25, 0); }
            if (lLeg) { lLeg.rotation.set(0, 0, 0); lLeg.position.set(0.2, 0.55, 0); }
            if (rLeg) { rLeg.rotation.set(0, 0, 0); rLeg.position.set(-0.2, 0.55, 0); }
            if (lBoot) { lBoot.rotation.set(0, 0, 0); lBoot.position.set(0.2, 0.1, 0.05); }
            if (rBoot) { rBoot.rotation.set(0, 0, 0); rBoot.position.set(-0.2, 0.1, 0.05); }

            if (pose === 'salute') {
                if (rArm) {
                    rArm.rotation.z = Math.PI / 1.5;
                    rArm.rotation.y = -Math.PI / 6;
                    rArm.position.set(-0.45, 1.45, 0.25);
                }
            } else if (pose === 'sit') {
                if (torso) torso.position.y = 0.85;
                if (head) head.position.y = 1.35;
                if (backpack) backpack.position.y = 0.85;
                if (sleepingBag) sleepingBag.position.y = 1.35;
                if (lArm) lArm.position.y = 0.85;
                if (rArm) rArm.position.y = 0.85;
                if (lLeg) {
                    lLeg.rotation.x = -Math.PI / 2;
                    lLeg.position.set(0.2, 0.85, 0.35);
                }
                if (rLeg) {
                    rLeg.rotation.x = -Math.PI / 2;
                    rLeg.position.set(-0.2, 0.85, 0.35);
                }
                if (lBoot) {
                    lBoot.rotation.x = -Math.PI / 2;
                    lBoot.position.set(0.2, 0.85, 0.7);
                }
                if (rBoot) {
                    rBoot.rotation.x = -Math.PI / 2;
                    rBoot.position.set(-0.2, 0.85, 0.7);
                }
            } else if (pose === 'prone') {
                if (torso) torso.position.y = 0.25;
                if (head) { head.position.y = 0.45; head.rotation.x = -0.3; }
                if (lArm) { lArm.rotation.x = -Math.PI / 2.5; lArm.position.set(0.55, 0.25, -0.3); }
                if (rArm) { rArm.rotation.x = -Math.PI / 2.5; rArm.position.set(-0.55, 0.25, -0.3); }
                if (lLeg) { lLeg.position.set(0.2, 0.25, 0.5); }
                if (rLeg) { rLeg.position.set(-0.2, 0.25, 0.5); }
                if (lBoot) { lBoot.position.set(0.2, 0.25, 0.85); }
                if (rBoot) { rBoot.position.set(-0.2, 0.25, 0.85); }
            } else if (pose === 'pt') {
                const cycle = Math.sin(timeSec * 8);
                if (lArm) {
                    lArm.rotation.z = Math.max(0, cycle) * (Math.PI / 1.5);
                    lArm.position.x = 0.55 + Math.max(0, cycle) * 0.1;
                }
                if (rArm) {
                    rArm.rotation.z = -Math.max(0, cycle) * (Math.PI / 1.5);
                    rArm.position.x = -0.55 - Math.max(0, cycle) * 0.1;
                }
                if (lLeg) {
                    lLeg.rotation.z = -Math.max(0, cycle) * 0.3;
                }
                if (rLeg) {
                    rLeg.rotation.z = Math.max(0, cycle) * 0.3;
                }
            }
        };

        window.changePlayerRole = (role) => {
            if (!STATE.currentUser) return;
            STATE.currentUser.militaryRole = role;
            db.ref('users/' + STATE.currentUser.uid).update({ militaryRole: role }).then(() => {
                showToast(`🫡 보직이 [${role}](으)로 변경되었습니다!`, "#38bdf8");
                window.updateDeployedWeapons();
            });
        };

        window.giveWeaponAdmin = (weaponId) => {
            if (!db) return;
            const select = document.getElementById('admin-target-user');
            if (!select) return;
            const targetUid = select.value;
            if (!targetUid) return alert("대상 플레이어를 선택하십시오!");
            
            db.ref('users/' + targetUid + '/inventory').push(weaponId).then(() => {
                showToast(`🎁 선택된 요원에게 ${weaponId.toUpperCase()} 총기를 지급했습니다!`, "#059669");
            });
        };

        window.changeRankAdmin = () => {
            if (!db) return;
            const targetSelect = document.getElementById('admin-target-user');
            const rankSelect = document.getElementById('admin-change-rank-select');
            if (!targetSelect || !rankSelect) return;
            
            const targetUid = targetSelect.value;
            const newRank = rankSelect.value;
            if (!targetUid) return alert("대상 플레이어를 선택하십시오!");
            
            db.ref('users/' + targetUid).update({
                rank: newRank,
                exp: 0,
                promotionReady: false,
                promotionPending: false
            }).then(() => {
                showToast(`🎖️ 대상 요원의 계급을 [${newRank}](으)로 변경했습니다!`, "#059669");
                
                db.ref('chat').push({
                    uid: 'system',
                    name: '📢 [부대진급]',
                    rank: '지휘소',
                    text: `🫡 대장(원수)님께서 대상 대원을 심사하고 [${newRank}](으)로 최종 진급/임명하셨습니다! 충성!! 🫡`,
                    timestamp: Date.now()
                });
            });
        };

        // Local Player Body (Visible only in 3rd person)
        window.localPlayerBody = createPlayerModel(0x4b5320);
        window.localPlayerBody.position.y = -1.6; // Offset relative to camera
        window.localPlayerLastColor = 0x4b5320;
        
        window.localPlayerBody.visible = false; 
        camera.add(window.localPlayerBody);
        if (STATE.currentUser && STATE.currentUser.username === 'ree1203') {
            convertToCreatorModel(window.localPlayerBody, 5);
        }

        window.localWeapon = makeWeaponModel('k2');
        window.localWeapon.visible = false;
        camera.add(window.localWeapon);

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

        window.helicopterMesh.position.set(0, 12, -150);
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

        // --- Secret Underground Bunker Room ---
        const bunkerSize = 15;
        const bunkerFloor = new THREE.Mesh(new THREE.BoxGeometry(bunkerSize, 1, bunkerSize), new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9, metalness: 0.1 }));
        bunkerFloor.position.set(0, -40.5, -150);
        bunkerFloor.receiveShadow = true;
        scene.add(bunkerFloor);

        const bunkerCeiling = new THREE.Mesh(new THREE.BoxGeometry(bunkerSize, 1, bunkerSize), new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9 }));
        bunkerCeiling.position.set(0, -40.5 + 8, -150);
        scene.add(bunkerCeiling);

        const bunkerWallMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.9 });
        const wNorth = new THREE.Mesh(new THREE.BoxGeometry(bunkerSize, 8, 1), bunkerWallMat);
        wNorth.position.set(0, -40.5 + 4, -150 - bunkerSize/2);
        scene.add(wNorth);
        const wSouth = new THREE.Mesh(new THREE.BoxGeometry(bunkerSize, 8, 1), bunkerWallMat);
        wSouth.position.set(0, -40.5 + 4, -150 + bunkerSize/2);
        scene.add(wSouth);
        const wEast = new THREE.Mesh(new THREE.BoxGeometry(1, 8, bunkerSize), bunkerWallMat);
        wEast.position.set(bunkerSize/2, -40.5 + 4, -150);
        scene.add(wEast);
        const wWest = new THREE.Mesh(new THREE.BoxGeometry(1, 8, bunkerSize), bunkerWallMat);
        wWest.position.set(-bunkerSize/2, -40.5 + 4, -150);
        scene.add(wWest);

        const bunkerLight = new THREE.PointLight(0xffaa66, 1.5, 20);
        bunkerLight.position.set(0, -40.5 + 6, -150);
        scene.add(bunkerLight);

        // Bunker Exit Hatch
        const bunkerExitHatch = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 }));
        bunkerExitHatch.position.set(0, -40.4, -150);
        bunkerExitHatch.userData = { isBunkerExit: true };
        scene.add(bunkerExitHatch);
        if (!window.interactiveTargets) window.interactiveTargets = [];
        window.interactiveTargets.push(bunkerExitHatch);

        const bunkerHatchLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        bunkerHatchLabel.position.set(0, -40.35, -150);
        scene.add(bunkerHatchLabel);

        // --- 3D Checkpoints for Running Course ---
        const gatePillarMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
        const gateSignTex = generateLogoTexture('START / FINISH', '#00ff00', '#000000', 24);
        const gateSignMat = new THREE.MeshStandardMaterial({ map: gateSignTex });
        
        const gateL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5), gatePillarMat);
        gateL.position.set(-4, 2.5, 45);
        scene.add(gateL);
        const gateR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5), gatePillarMat);
        gateR.position.set(4, 2.5, 45);
        scene.add(gateR);
        const gateTop = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.8, 0.8), gateSignMat);
        gateTop.position.set(0, 5, 45);
        scene.add(gateTop);

        window.checkPointsLoc = [
            { x: 42, z: 42, label: '1' },
            { x: 42, z: -42, label: '2' },
            { x: -42, z: -42, label: '3' },
            { x: -42, z: 42, label: '4' }
        ];

        window.runCheckpoints = [];
        window.checkPointsLoc.forEach((loc, idx) => {
            const geom = new THREE.CylinderGeometry(2, 2, 6, 16, 1, true);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
            const cyl = new THREE.Mesh(geom, mat);
            cyl.position.set(loc.x, 3, loc.z);
            scene.add(cyl);
            window.runCheckpoints.push(cyl);

            // Add number floating label above checkpoint
            const lc = document.createElement('canvas');
            lc.width = 64; lc.height = 64;
            const lctx = lc.getContext('2d');
            lctx.fillStyle = 'rgba(0,0,0,0.6)'; lctx.fillRect(0,0,64,64);
            lctx.fillStyle = '#ff0000'; lctx.font = 'bold 36px Arial'; lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
            lctx.fillText(loc.label, 32, 32);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc) }));
            sprite.position.set(loc.x, 7, loc.z);
            sprite.scale.set(3, 3, 1);
            scene.add(sprite);
            cyl.userData = { labelSprite: sprite, labelCtx: lctx, labelCanvas: lc };
        });

        // Controls initialization moved to window.onload to avoid duplicate listeners

        // Bind Action Buttons
        const btnPromote = document.getElementById('btn-promote');
        if (btnPromote) {
            btnPromote.onclick = () => {
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
        }

        document.getElementById('btn-training').onclick = () => {
            alert(`${STATE.currentUser.rank} 훈련:\n${RANK_INFO[STATE.currentUser.rank]}`);
        };

        window.activeBuffs = {
            staminaInfinite: 0,
            invisibleName: 0,
            coldProtection: 0
        };

        const SHOP_ITEMS = [
            { id: 'hardtack', name: '건빵 (별사탕 포함)', desc: '목이 메이지만 든든한 간식', price: 100, emoji: '🍪' },
            { id: 'sauce', name: '맛다시', desc: '어떤 밥이든 맛있게 만들어주는 마법의 양념', price: 200, emoji: '🌶️' },
            { id: 'cream', name: '위장크림', desc: '얼굴에 칠해 은폐/엄폐 능력 향상', price: 300, emoji: '🎭' },
            { id: 'hotpack', name: '혹한기 핫팩', desc: '눈이나 비가 내릴 때 체력 감소를 방지 (3분)', price: 150, emoji: '🔥' },
            { id: 'mre', name: '전투식량 (발열팩)', desc: '허기 100% 회복', price: 500, emoji: '🥫' },
            { id: 'burger', name: '군대리아', desc: '일요일 아침의 특식', price: 800, emoji: '🍔' },
            { id: 'liner', name: '깔깔이 (방한복 상의 내피)', desc: '겨울철 최고의 보온 아이템', price: 1500, emoji: '🧥' },
            { id: 'armor', name: '전술 방탄복', desc: '피해량 감소', price: 2000, emoji: '🦺' },
            { id: 'scope', name: '홀로그래픽 조준경', desc: '사격 정확도 향상', price: 3000, emoji: '🔭', category: 'gears', rarity: 'rare' },
            { id: 'k2', name: 'K2C1 소총', desc: '고급형 돌격소총', price: 5000, emoji: '🔫', category: 'weapons', rarity: 'epic' },
            { id: 'k3', name: 'K3 경기관총', desc: '분대지원화기 경기관총 (분대지원화기병용)', price: 6000, emoji: '💥', category: 'weapons', rarity: 'epic' },
            { id: 'k5', name: 'K5 권총', desc: '휴대용 9mm 권총 (간부용 부무장)', price: 2000, emoji: '🔫', category: 'weapons', rarity: 'rare' },
            { id: 'k1a', name: 'K1A 기관단총', desc: '가볍고 강력한 기관단총 (특수부대/차량승무원용)', price: 4500, emoji: '🔫', category: 'weapons', rarity: 'epic' },
            { id: 'k14', name: 'K14 저격소총', desc: '초정밀 볼트액션 저격소총 (특수부대용)', price: 9000, emoji: '🎯', category: 'weapons', rarity: 'legendary' },
            { id: 'k6', name: 'K6 중기관총', desc: '강력한 화력의 12.7mm 중기관총 (중화기병용)', price: 12000, emoji: '🔥', category: 'weapons', rarity: 'legendary' },
            { id: 'silencer', name: '소음기', desc: 'K2 소총 격발음과 총구 화염을 대폭 감소시킴', price: 1500, emoji: '🤫', category: 'gears', rarity: 'rare' },
            { id: 'laser_sight', name: '레이저 조준경', desc: 'K2 소총 하단에 적색 조준 가이드 선을 비춤', price: 2000, emoji: '🔴', category: 'gears', rarity: 'rare' },
            { id: 'advanced_scope', name: '고배율 스코프', desc: 'K2 소총 장착 시 우클릭으로 극대화된 줌 사용 가능', price: 2500, emoji: '🔭', category: 'gears', rarity: 'rare' },
            { id: 'gas_mask', name: '방독면', desc: '화생방실 유독 가스로부터 체력을 보호해주는 특수 마스크', price: 1000, emoji: '😷', image: '../../../.gemini/antigravity-ide/brain/21651c40-860a-4f63-888b-1aa706b9c917/media__1781937718463.png', category: 'gears', rarity: 'common' },
            { id: 'nvg', name: '야간 투시경 (NVG)', desc: 'N 키로 작동하며, 야간이나 어두운 곳에서 전방을 밝게 비춰주는 특수 광학장비', price: 1500, emoji: '👓', category: 'gears', rarity: 'common' },
            { id: 'px_truck', name: '황금마차 호출권', desc: '이동식 PX를 내 위치로 호출', price: 7000, emoji: '🚚', category: 'support', rarity: 'epic' },
            { id: 'heli', name: '공격 헬기 호출권', desc: '일회용 헬기 지원', price: 10000, emoji: '🚁', category: 'support', rarity: 'legendary' },
            { id: 'artillery', name: 'K9 자주포 포격 요청', desc: '지정된 위치에 막강한 화력 지원', price: 15000, emoji: '💥', category: 'support', rarity: 'legendary' },
            { id: 'gas_canister', name: '화생방 정화통', desc: '방독면 정화 성능을 100%로 재충전하는 소모품', price: 300, emoji: '🧪', category: 'support', rarity: 'common' },
            { id: 'camo_desert', name: '사막 위장복', desc: '👕 모래빛 사막 디지털 전투복 스킨', price: 1500, emoji: '🏜️', category: 'skins', rarity: 'rare' },
            { id: 'camo_marine', name: '해병대 위장복', desc: '👕 해병대 특유의 붉은 디지털 전투복 스킨', price: 2000, emoji: '🟥', category: 'skins', rarity: 'rare' },
            { id: 'camo_swat', name: '블랙 대테러복', desc: '👕 특수부대 스타일의 흑복/대테러복 스킨', price: 2500, emoji: '🐈‍⬛', category: 'skins', rarity: 'rare' },
            { id: 'camo_winter', name: '동계 위장복', desc: '👕 눈 덮인 전장용 백색 전투복 스킨', price: 1800, emoji: '❄️', category: 'skins', rarity: 'rare' }
        ];

        const RARITY_STYLING = {
            legendary: {
                bg: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(20,25,20,0.95) 100%)',
                border: '2px solid #f59e0b',
                glow: 'box-shadow: 0 0 15px rgba(245,158,11,0.25);',
                badge: '<span style="font-size:0.65rem; background:#f59e0b; color:black; padding:2px 6px; border-radius:4px; font-weight:900; letter-spacing: 0.5px;">LEGENDARY</span>'
            },
            epic: {
                bg: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(20,25,20,0.95) 100%)',
                border: '2px solid #a855f7',
                glow: 'box-shadow: 0 0 15px rgba(168,85,247,0.25);',
                badge: '<span style="font-size:0.65rem; background:#a855f7; color:white; padding:2px 6px; border-radius:4px; font-weight:900; letter-spacing: 0.5px;">EPIC</span>'
            },
            rare: {
                bg: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(20,25,20,0.95) 100%)',
                border: '2px solid #3b82f6',
                glow: 'box-shadow: 0 0 15px rgba(59,130,246,0.25);',
                badge: '<span style="font-size:0.65rem; background:#3b82f6; color:white; padding:2px 6px; border-radius:4px; font-weight:900; letter-spacing: 0.5px;">RARE</span>'
            },
            common: {
                bg: 'linear-gradient(135deg, rgba(156,163,175,0.08) 0%, rgba(20,25,20,0.95) 100%)',
                border: '2px solid #4b5563',
                glow: '',
                badge: '<span style="font-size:0.65rem; background:#4b5563; color:white; padding:2px 6px; border-radius:4px; font-weight:900; letter-spacing: 0.5px;">COMMON</span>'
            }
        };

        window.switchShopTab = (category) => {
            const tabButtons = document.querySelectorAll('#shop-tabs .shop-tab-btn');
            tabButtons.forEach(btn => {
                if (btn.getAttribute('onclick').includes(category)) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(46, 139, 87, 0.25)';
                    btn.style.color = '#fff';
                    btn.style.borderColor = '#2e8b57';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.color = '#ccc';
                    btn.style.borderColor = 'rgba(255,255,255,0.1)';
                }
            });

            const itemsContainer = document.getElementById('shop-items');
            if (!itemsContainer) return;
            itemsContainer.innerHTML = '';

            const filteredItems = category === 'all' 
                ? SHOP_ITEMS 
                : SHOP_ITEMS.filter(item => item.category === category);

            const isMaster = STATE.currentUser && STATE.currentUser.username === 'ree1203';

            filteredItems.forEach(item => {
                const style = RARITY_STYLING[item.rarity] || RARITY_STYLING.common;
                const card = document.createElement('div');
                card.style.cssText = `
                    background: ${style.bg};
                    border: ${style.border};
                    ${style.glow}
                    border-radius: 12px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 12px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    position: relative;
                `;
                
                card.onmouseover = () => {
                    card.style.transform = 'translateY(-4px)';
                    card.style.boxShadow = style.glow ? style.glow.replace('0.25', '0.4').replace('box-shadow:', '') : '0 6px 15px rgba(0,0,0,0.4)';
                };
                card.onmouseout = () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = style.glow ? style.glow.replace('box-shadow:', '') : 'none';
                };

                const smallMediaHtml = item.image 
                    ? `<img src="${item.image}" style="width: 1.5rem; height: 1.5rem; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));" onerror="this.style.display='none';">`
                    : ``;

                const centerMediaHtml = item.image
                    ? `<img src="${item.image}" style="max-height: 100px; max-width: 100%; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div style="font-size: 3.5rem; display: none; align-items: center; justify-content: center;">${item.emoji}</div>`
                    : `<div style="font-size: 3.5rem; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">${item.emoji}</div>`;

                card.innerHTML = `
                    <div style="position: absolute; top: 12px; right: 12px;">
                        ${style.badge}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                        ${smallMediaHtml}
                        <div style="font-weight: 800; font-size: 1.1rem; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">${item.name}</div>
                    </div>
                    <div style="font-size: 0.78rem; color: #bbb; line-height: 1.4; min-height: 38px; margin-top: 4px;">
                        ${item.desc}
                    </div>
                    <!-- 카드 중앙 대형 프리뷰 영역 -->
                    <div style="height: 130px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); border-radius: 8px; margin: 10px 0; border: 1px solid rgba(255,255,255,0.02); overflow: hidden;">
                        ${centerMediaHtml}
                    </div>
                    <button class="btn" style="width: 100%; padding: 12px; margin: 0; background: #2e8b57; font-size: 0.95rem; font-weight: bold; border-radius: 8px; border: none; cursor: pointer; color: white; display: flex; justify-content: center; align-items: center; gap: 5px; transition: background 0.2s;" onclick="buyItem('${item.id}', ${item.price}, '${item.name}')">
                        <span>💰</span>
                        <span>${isMaster ? '무료' : item.price.toLocaleString() + ' G'}</span>
                    </button>
                `;
                itemsContainer.appendChild(card);
            });
        };

        document.getElementById('btn-shop').onclick = () => {
            const modal = document.getElementById('shop-modal');
            const isMaster = STATE.currentUser && STATE.currentUser.username === 'ree1203';
            document.getElementById('shop-money').textContent = isMaster ? "무제한 (∞)" : (STATE.currentUser.money || 0).toLocaleString();
            
            modal.style.display = 'flex';
            window.switchShopTab('all');
        };

        window.buyItem = (id, price, name) => {
            if (!STATE.currentUser) return;
            const isMaster = STATE.currentUser.username === 'ree1203';
            const currentMoney = STATE.currentUser.money || 0;
            
            if (id === 'k2' && !['ree1203', '한Space'].includes(STATE.currentUser.username)) {
                alert("이 무기는 한우주와 이주람 전용 무기입니다! 다른 인원은 구매할 수 없습니다.");
                return;
            }
            
            if (!isMaster && currentMoney < price) {
                alert(`잔고가 부족합니다! (현재: ${currentMoney}G)`);
                return;
            }
            
            const priceText = isMaster ? "무료(마스터 권한)로" : `${price.toLocaleString()}G에`;
            if (confirm(`${name}을(를) ${priceText} 구매하시겠습니까?`)) {
                window.showRewardedAd('shop_purchase', (success) => {
                    if (success) {
                        if (!isMaster) {
                            const newMoney = currentMoney - price;
                            STATE.currentUser.money = newMoney;
                            document.getElementById('shop-money').textContent = newMoney.toLocaleString();
                            db.ref('users/' + STATE.currentUser.uid).update({ money: newMoney });
                        }
                        
                        db.ref('users/' + STATE.currentUser.uid + '/inventory').push(id);
                        alert(`${name} 구매 완료!`);
                    } else {
                        alert("⚠️ 구매 처리에 실패했습니다.");
                    }
                });
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
                    
                    const mediaHtml = itemData.image 
                        ? `<img src="${itemData.image}" style="width: 1.5rem; height: 1.5rem; object-fit: contain; vertical-align: middle; margin-right: 5px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                           <span style="font-size: 1.5rem; display: none; vertical-align: middle; margin-right: 5px;">${itemData.emoji}</span>`
                        : `<span style="font-size: 1.5rem; vertical-align: middle; margin-right: 5px;">${itemData.emoji}</span>`;

                    const div = document.createElement('div');
                    div.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.1); gap: 10px;';
                    div.innerHTML = `
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 1rem; color: #fff; display: flex; align-items: center;">
                                ${mediaHtml}
                                <span>${itemData.name}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: #aaa; margin-top: 3px; line-height: 1.2;">${itemData.desc}</div>
                        </div>
                        <button class="btn" style="width: auto; padding: 8px 15px; margin: 0; background: #4682b4; font-size: 0.85rem; border-radius: 8px; white-space: nowrap;" onclick="useItem('${key}', '${itemData.id}', '${itemData.name}')">사용</button>
                    `;
                    itemsContainer.appendChild(div);
                });
            });
        };

        window.hasSilencer = false;
        window.hasLaserSight = false;
        window.hasAdvancedScope = false;
        window.hasGasMask = false;
        window.hasNVG = false;

        window.useItem = (key, itemId, name) => {
            if (!STATE.currentUser) return;

            if (itemId.startsWith('camo_')) {
                if (window.activeSkin === itemId) {
                    window.activeSkin = null;
                    showToast("👕 기본 전투복으로 환복했습니다.", "#22c55e");
                } else {
                    window.activeSkin = itemId;
                    showToast(`👕 [환복] ${name}(으)로 갈아입었습니다!`, "#22c55e");
                }
                if (window.localPlayerBody) {
                    window.refreshPlayerSkin(window.localPlayerBody, window.activeSkin, STATE.currentUser.rank, false);
                }
                db.ref('users/' + STATE.currentUser.uid).update({ activeSkin: window.activeSkin || 'normal' });
                
                const invModal = document.getElementById('inventory-modal');
                if (invModal && invModal.style.display === 'flex') {
                    const btnInv = document.getElementById('btn-inventory');
                    if (btnInv) btnInv.click();
                }
                return;
            }

            if (itemId === 'gas_canister') {
                if (!window.hasGasMask) {
                    showToast("⚠️ 먼저 방독면을 장착해야 합니다!", "#ff3333");
                    return;
                }
                window.startCanisterReplacementMinigame(key);
                return;
            }
            
            if (itemId === 'silencer' || itemId === 'laser_sight' || itemId === 'advanced_scope' || itemId === 'gas_mask' || itemId === 'nvg') {
                if (itemId === 'silencer') {
                    window.hasSilencer = !window.hasSilencer;
                    showToast(window.hasSilencer ? "🤫 소음기를 장착했습니다." : "소음기를 해제했습니다.", "#22c55e");
                } else if (itemId === 'laser_sight') {
                    window.hasLaserSight = !window.hasLaserSight;
                    showToast(window.hasLaserSight ? "🔴 레이저 조준경을 장착했습니다." : "레이저 조준경을 해제했습니다.", "#22c55e");
                } else if (itemId === 'advanced_scope') {
                    window.hasAdvancedScope = !window.hasAdvancedScope;
                    showToast(window.hasAdvancedScope ? "🔭 고배율 스코프를 장착했습니다." : "고배율 스코프를 해제했습니다.", "#22c55e");
                } else if (itemId === 'gas_mask') {
                    window.hasGasMask = !window.hasGasMask;
                    showToast(window.hasGasMask ? "😷 방독면을 장착했습니다." : "방독면을 해제했습니다.", "#22c55e");
                    if (window.hasGasMask) {
                        window.gasMaskFilter = 100; // Reset filter to 100% on equip
                    }
                } else if (itemId === 'nvg') {
                    window.hasNVG = !window.hasNVG;
                    showToast(window.hasNVG ? "🟢 야간 투시경을 장착했습니다. (N 키로 작동)" : "야간 투시경을 해제했습니다.", "#22c55e");
                    if (!window.hasNVG && window.nvgActive) {
                        window.toggleNVG(); 
                    }
                }
                
                if (window.activeWeaponId) {
                    window.equipWeapon(window.activeWeaponId);
                }
                
                const invModal = document.getElementById('inventory-modal');
                if (invModal && invModal.style.display === 'flex') {
                    const btnInv = document.getElementById('btn-inventory');
                    if (btnInv) btnInv.click();
                }
                return;
            }
            
            if (WEAPONS_CONFIG[itemId]) {
                window.equipWeapon(itemId);
                const invModal = document.getElementById('inventory-modal');
                if (invModal && invModal.style.display === 'flex') {
                    invModal.style.display = 'none';
                }
                return;
            }
            
            if (!confirm(`${name}을(를) 사용하시겠습니까?`)) return;
            
            // Check combo recipe
            if (itemId === 'sauce' || itemId === 'mre') {
                const partnerId = itemId === 'sauce' ? 'mre' : 'sauce';
                db.ref('users/' + STATE.currentUser.uid + '/inventory').once('value', snap => {
                    const inv = snap.val() || {};
                    const partnerKey = Object.keys(inv).find(k => inv[k] === partnerId);
                    if (partnerKey && confirm("맛다시와 전투식량을 함께 사용하여 '맛다시 전투식량 곱빼기(60초간 스테미나 무제한)'로 드시겠습니까?")) {
                        // Consume both!
                        db.ref('users/' + STATE.currentUser.uid + '/inventory/' + key).remove();
                        db.ref('users/' + STATE.currentUser.uid + '/inventory/' + partnerKey).remove().then(() => {
                            const s = window.STATS;
                            s.hunger = 100;
                            s.hp = 100;
                            window.activeBuffs.staminaInfinite = Date.now() + 60 * 1000;
                            alert('맛다시 전투식량 곱빼기를 먹었습니다! 허기/체력 100% 충전 및 60초간 스테미나 무제한! ⚡');
                            updateStatBars();
                            const invModal = document.getElementById('inventory-modal');
                            if (invModal && invModal.style.display === 'flex') {
                                const btnInv = document.getElementById('btn-inventory');
                                if (btnInv) btnInv.click();
                            }
                        });
                        return;
                    } else {
                        // Just use single item
                        executeSingleUse(key, itemId, name);
                    }
                });
            } else {
                executeSingleUse(key, itemId, name);
            }
        };

        const executeSingleUse = (key, itemId, name) => {
            db.ref('users/' + STATE.currentUser.uid + '/inventory/' + key).remove().then(() => {
                const s = window.STATS;
                if (itemId === 'hardtack')  { s.hunger = Math.min(100, s.hunger + 20); window.changeDiscipline(2, '건빵 취식'); alert('건빵을 먹었습니다! 허기 +20, 군기 +2. 🍪'); }
                else if (itemId === 'sauce') { s.hunger = Math.min(100, s.hunger + 30); alert('맛다시를 뿌려 먹었습니다! 허기 +30 🌶️'); }
                else if (itemId === 'mre')   { s.hunger = 100; s.hp = Math.min(100, s.hp + 30); alert('전투식량으로 허기 100% 회복! 체력 +30 😋'); }
                else if (itemId === 'burger'){ s.hunger = Math.min(100, s.hunger + 50); s.hp = Math.min(100, s.hp + 20); alert('군대리아! 허기 +50, 체력 +20 🍔'); }
                else if (itemId === 'liner') { s.stamina = 100; window.activeBuffs.coldProtection = Date.now() + 180 * 1000; alert('깔깔이를 입었습니다! 스테미나 100% 충전 및 3분간 한파 면제! 🧥'); }
                else if (itemId === 'armor') { alert('방탄복 착용! 다음 피해를 50% 감소합니다. 🛡️'); window.hasArmor = true; }
                else if (itemId === 'hotpack') { window.activeBuffs.coldProtection = Date.now() + 180 * 1000; alert('혹한기 핫팩을 사용했습니다! 3분간 한파/동사 피해를 입지 않습니다. 🔥'); }
                else if (itemId === 'cream') { window.activeBuffs.invisibleName = Date.now() + 60 * 1000; alert('위장크림을 얼굴에 발랐습니다! 60초간 상대방 미니맵/이름표에서 은신됩니다. 🎭'); }
                else if (itemId === 'k2')    { 
                    alert('K2C1 소총을 장착했습니다! 마우스 클릭으로 사격할 수 있습니다. 🔫'); 
                    window.hasK2 = true; 
                    if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson;
                    const ch = document.getElementById('crosshair');
                    if (ch) ch.style.display = 'block'; 
                }
                else alert(`${name}을(를) 사용했습니다!`);
                updateStatBars();
                const invModal = document.getElementById('inventory-modal');
                if (invModal && invModal.style.display === 'flex') {
                    const btnInv = document.getElementById('btn-inventory');
                    if (btnInv) btnInv.click();
                }
            });
        };

        window.nvgActive = false;
        window.toggleNVG = () => {
            if (!window.hasNVG) {
                showToast("⚠️ 야간 투시경(NVG) 장비가 없습니다. PX 상점에서 구매해 주십시오.", "#ef4444");
                return;
            }
            window.nvgActive = !window.nvgActive;
            const overlay = document.getElementById('nvg-overlay');
            if (overlay) overlay.style.display = window.nvgActive ? 'block' : 'none';
            if (typeof scene !== 'undefined') {
                const ambient = scene.children.find(c => c.isAmbientLight);
                if (ambient) {
                    ambient.intensity = window.nvgActive ? 2.5 : 0.4;
                }
            }
            showToast(window.nvgActive ? "👓 야간 투시경 전원을 켰습니다." : "👓 야간 투시경 전원을 껐습니다.", "#22c55e");
        };

        window.currentAmmo = {};
        window.isReloading = false;
        
        const playGunshotDryClick = () => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
            } catch(e){}
        };

        window.reloadActiveWeapon = () => {
            if (!window.activeWeaponId || window.activeWeaponId === 'marshal_card') return;
            const max = WEAPONS_CONFIG[window.activeWeaponId].maxAmmo;
            if (window.currentAmmo[window.activeWeaponId] === max) return;
            if (window.isReloading) return;
            window.isReloading = true;
            showToast("🔄 재장전 중...", "#deb887");
            
            const progress = document.getElementById('hud-reload-progress');
            const fill = document.getElementById('hud-reload-fill');
            if (progress && fill) {
                progress.style.display = 'block';
                fill.style.width = '0%';
                let start = Date.now();
                const duration = 1500;
                const interval = setInterval(() => {
                    let elapsed = Date.now() - start;
                    let pct = Math.min(100, (elapsed / duration) * 100);
                    fill.style.width = pct + '%';
                    if (elapsed >= duration) {
                        clearInterval(interval);
                        progress.style.display = 'none';
                        window.currentAmmo[window.activeWeaponId] = max;
                        const ammoDisp = document.getElementById('hud-ammo-display');
                        if (ammoDisp) ammoDisp.textContent = `${max} / ${max}`;
                        window.isReloading = false;
                        showToast("✅ 재장전 완료", "#22c55e");
                    }
                }, 30);
            } else {
                setTimeout(() => {
                    window.currentAmmo[window.activeWeaponId] = max;
                    const ammoDisp = document.getElementById('hud-ammo-display');
                    if (ammoDisp) ammoDisp.textContent = `${max} / ${max}`;
                    window.isReloading = false;
                    showToast("✅ 재장전 완료", "#22c55e");
                }, 1500);
            }
        };

        window.updateScoreboard = () => {
            const tbody = document.getElementById('scoreboard-table-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            const players = [];
            if (STATE.currentUser) {
                players.push({
                    name: STATE.currentUser.name || "신병",
                    rank: STATE.currentUser.rank || "이등병",
                    kills: STATE.currentUser.kills || 0,
                    deaths: STATE.currentUser.deaths || 0,
                    isDead: Boolean(window.isLocalPlayerDead),
                    isLocal: true
                });
            }
            
            Object.keys(window.allPlayersData).forEach(uid => {
                const p = window.allPlayersData[uid];
                players.push({
                    name: p.name || "신병",
                    rank: p.rank || "이등병",
                    kills: p.kills || 0,
                    deaths: p.deaths || 0,
                    isDead: Boolean(p.isDead),
                    isLocal: false
                });
            });
            
            players.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
            
            players.forEach(p => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                tr.style.background = p.isLocal ? 'rgba(163, 230, 53, 0.15)' : 'transparent';
                tr.innerHTML = `
                    <td style="padding: 8px; color: #deb887;">[${p.rank}]</td>
                    <td style="padding: 8px; font-weight: bold; color: ${p.isLocal ? '#a3e635' : '#fff'};">${p.name} ${p.isLocal ? ' (나)' : ''}</td>
                    <td style="padding: 8px; text-align: center; color: #a3e635; font-weight: bold;">${p.kills}</td>
                    <td style="padding: 8px; text-align: center; color: #ef4444;">${p.deaths}</td>
                    <td style="padding: 8px; text-align: center; color: ${p.isDead ? '#ef4444' : '#22c55e'};">${p.isDead ? '💀 전사' : '🟢 작전중'}</td>
                `;
                tbody.appendChild(tr);
            });
        };

        window.spawnBloodParticles = (x, y, z) => {
            if (typeof scene === 'undefined' || !scene) return;
            const particleCount = 12;
            const particles = [];
            const geom = new THREE.SphereGeometry(0.08, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
            
            for (let i = 0; i < particleCount; i++) {
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(
                    x + (Math.random() - 0.5) * 0.3,
                    y + (Math.random() - 0.5) * 0.3,
                    z + (Math.random() - 0.5) * 0.3
                );
                scene.add(mesh);
                particles.push({
                    mesh: mesh,
                    vel: new THREE.Vector3(
                        (Math.random() - 0.5) * 4,
                        Math.random() * 3 + 1,
                        (Math.random() - 0.5) * 4
                    ),
                    createdAt: Date.now()
                });
            }
            
            const pInterval = setInterval(() => {
                let allDone = true;
                const deltaSec = 0.03;
                particles.forEach(p => {
                    if (Date.now() - p.createdAt < 700) {
                        allDone = false;
                        p.vel.y -= 9.8 * deltaSec;
                        p.mesh.position.addScaledVector(p.vel, deltaSec);
                    } else {
                        scene.remove(p.mesh);
                    }
                });
                if (allDone) clearInterval(pInterval);
            }, 30);
        };

        window.triggerDamageIndicator = (shooterUid) => {
            let shooterPos = null;
            if (shooterUid === 'master_ree') {
                shooterPos = window.helicopterMesh ? window.helicopterMesh.position : new THREE.Vector3(0, 0, 0);
            } else if (window.allPlayersData[shooterUid]) {
                const p = window.allPlayersData[shooterUid];
                shooterPos = new THREE.Vector3(p.x, p.y, p.z);
            } else {
                const flash = document.getElementById('damage-flash-indicator');
                if (flash) {
                    flash.style.borderColor = 'rgba(239, 68, 68, 0.8)';
                    flash.style.boxShadow = 'inset 0 0 80px rgba(239, 68, 68, 0.8)';
                    const ind = document.getElementById('damage-indicator');
                    if (ind) {
                        ind.style.display = 'block';
                        ind.style.opacity = '1';
                        setTimeout(() => {
                            ind.style.opacity = '0';
                            setTimeout(() => { ind.style.display = 'none'; }, 250);
                        }, 600);
                    }
                }
                return;
            }
            
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            cameraDir.y = 0; cameraDir.normalize();
            
            const toShooter = shooterPos.clone().sub(camera.position);
            toShooter.y = 0; toShooter.normalize();
            
            const dot = cameraDir.dot(toShooter);
            const cross = cameraDir.x * toShooter.z - cameraDir.z * toShooter.x;
            const angle = Math.atan2(cross, dot);
            
            const flash = document.getElementById('damage-flash-indicator');
            const ind = document.getElementById('damage-indicator');
            if (flash && ind) {
                const xOffset = Math.sin(angle) * 35;
                const yOffset = -Math.cos(angle) * 35;
                flash.style.boxShadow = `inset ${xOffset}px ${yOffset}px 80px rgba(239, 68, 68, 0.95)`;
                flash.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                
                ind.style.display = 'block';
                ind.style.opacity = '1';
                setTimeout(() => {
                    ind.style.opacity = '0';
                    setTimeout(() => { ind.style.display = 'none'; }, 250);
                }, 800);
            }
        };

        const playGruntSound = () => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
            } catch(e){}
        };

        window.pushKillFeed = (attacker, victim, weaponName) => {
            if (!db) return;
            db.ref('system/kill_feed').push({
                attacker: attacker,
                victim: victim,
                weapon: weaponName || "전투",
                timestamp: Date.now()
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

        // ====================================================
        // SYSTEM 1: STAMINA / HUNGER / HP
        // ====================================================
        window.STATS = { hp: 100, hunger: 100, stamina: 100 };

        const updateStatBars = () => {
            const s = window.STATS;
            document.getElementById('hud-hp').textContent = Math.floor(s.hp);
            document.getElementById('hp-fill').style.width = s.hp + '%';
            document.getElementById('hp-fill').style.background = s.hp > 50 ? '#ef4444' : s.hp > 20 ? '#f59e0b' : '#ff0000';
            document.getElementById('hud-hunger').textContent = Math.floor(s.hunger);
            document.getElementById('hunger-fill').style.width = s.hunger + '%';
            document.getElementById('hunger-fill').style.background = s.hunger > 50 ? '#f59e0b' : s.hunger > 20 ? '#ef4444' : '#ff0000';
            document.getElementById('hud-stamina').textContent = Math.floor(s.stamina);
            document.getElementById('stamina-fill').style.width = s.stamina + '%';
            document.getElementById('stamina-fill').style.background = s.stamina > 50 ? '#22c55e' : s.stamina > 20 ? '#f59e0b' : '#ef4444';
            const money = STATE.currentUser.username === 'ree1203' ? '∞' : (STATE.currentUser.money || 0).toLocaleString();
            document.getElementById('hud-money').textContent = money;
        };

        // Hunger decreases over time, stamina recovers when not sprinting
        setInterval(() => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
            if (window.godModeActive) {
                window.STATS.hp = 100;
                window.STATS.hunger = 100;
                window.STATS.stamina = 100;
            } else {
                const isSprinting = keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight'];
                if (isSprinting && window.STATS.stamina > 0) {
                    window.STATS.stamina = Math.max(0, window.STATS.stamina - 1.5);
                } else if (!isSprinting) {
                    window.STATS.stamina = Math.min(100, window.STATS.stamina + 0.5);
                }
                window.STATS.hunger = Math.max(0, window.STATS.hunger - 0.3);
                if (window.STATS.hunger === 0) window.STATS.hp = Math.max(0, window.STATS.hp - 0.5);
                if (window.STATS.hp === 0) { window.STATS.hp = 30; window.STATS.hunger = 50; alert('⚠️ 체력이 바닥났습니다! 응급처치로 회복했습니다. 빨리 식사하세요!'); }
                
                // CBRN Gas Room damage check
                const inCbrnRoom = Math.abs(camera.position.x - (-120)) < 9.0 && Math.abs(camera.position.z - (-100)) < 9.0 && camera.position.y > 0;
                if (inCbrnRoom) {
                    if (!window.hasGasMask) {
                        window.STATS.hp = Math.max(0, window.STATS.hp - 6);
                        showToast("🤢 쿨럭! 컥! 유독 가스실(화생방)에 방독면 없이 노출되었습니다! (-6 HP)", "#ef4444");
                        
                        const flash = document.createElement('div');
                        flash.style.cssText = 'position:fixed; inset:0; background:rgba(0,255,0,0.18); z-index:999999; pointer-events:none;';
                        document.body.appendChild(flash);
                        setTimeout(() => flash.remove(), 250);

                        if (window.STATS.hp <= 0) {
                            triggerLocalPlayerDeath("화생방 가스 질식");
                        }
                    } else {
                        if (Math.random() < 0.2) {
                            showToast("😷 방독면 정화 통이 가스를 안전하게 걸러내고 있습니다.", "#22c55e");
                        }
                    }
                }
            }
            updateStatBars();
        }, 1000);

        // Food items restore stats (redirect to primary useItem handler)
        const originalUseItem = window.useItem;

        // ====================================================
        // SYSTEM 2: DAY/NIGHT CYCLE + WEATHER
        // ====================================================
        const weatherStates = [
            { name: '☀️ 맑음', fog: 500, skyColor: 0x87ceeb, ambientMult: 1.0, overlay: '' },
            { name: '🌤️ 흐림', fog: 300, skyColor: 0x9aabb0, ambientMult: 0.7, overlay: 'rgba(100,100,120,0.15)' },
            { name: '🌧️ 비', fog: 150, skyColor: 0x607080, ambientMult: 0.5, overlay: 'rgba(50,80,120,0.25)' },
            { name: '🌨️ 눈', fog: 100, skyColor: 0xc8d8e8, ambientMult: 0.6, overlay: 'rgba(200,220,255,0.2)' },
            { name: '🌫️ 안개', fog: 60, skyColor: 0x9a9a9a, ambientMult: 0.4, overlay: 'rgba(150,150,150,0.35)' },
        ];
        let currentWeatherIdx = 0;
        const weatherHud = document.getElementById('weather-hud');
        const weatherOverlay = document.getElementById('weather-overlay');

        const applyWeather = (idx) => {
            const w = weatherStates[idx];
            if (!w || !scene || !scene.fog) return;
            scene.fog.far = w.fog;
            scene.background = new THREE.Color(w.skyColor);
            scene.fog.color.setHex(w.skyColor);
            if (window.skyMesh) window.skyMesh.material.color.setHex(w.skyColor);
            if (weatherOverlay) weatherOverlay.style.background = w.overlay;
            if (weatherHud) {
                weatherHud.textContent = w.name;
                weatherHud.style.display = 'block';
            }
        };
        applyWeather(0);

        // Sync weather with Firebase
        if (db) {
            db.ref('system/weather').on('value', snap => {
                const val = snap.val();
                if (val !== null) {
                    currentWeatherIdx = val;
                    applyWeather(currentWeatherIdx);
                }
            });
        }

        // Weather is locked to 'Clear' (0) by user request.
        // Prevent random changes.
        if (db) db.ref('system/weather').set(0);

        // Day/Night: update sun light based on real clock
        const sunLight = (scene && scene.children) ? scene.children.find(c => c.isDirectionalLight) : null;
        // System Siren Sync
        if (db) {
            db.ref('system/siren').on('value', snap => {
                const active = snap.val();
                const overlay = document.getElementById('weather-overlay');
                if (overlay) {
                    if (active) {
                        overlay.classList.add('siren-active');
                        showToast("⚠️ 전 부대 비상 소집! 사이렌 발령!", "#ff0000");
                    } else {
                        overlay.classList.remove('siren-active');
                    }
                }
            });
        }

        // Global Admin Message Sync
        if (db) {
            db.ref('system/message').on('value', snap => {
                const msg = snap.val();
                if (msg) {
                    const toast = document.createElement('div');
                    toast.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(139,0,0,0.9); color:white; padding:30px 60px; border-radius:15px; font-size:2rem; font-weight:900; z-index:9999; border:4px solid #fff; box-shadow:0 0 50px rgba(0,0,0,0.8); text-align:center; animation: blink 0.5s infinite;';
                    toast.innerHTML = `📢 대장 공지:<br>${msg}`;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 8000);
                }
            });
        }

        // ====================================================
        // NEW SIMULATOR SYSTEMS: COGNITIVE & COMBAT ADDITIONS
        // ====================================================

        // --- 1.5. March Mission System ---
        window.startMarchMission = () => {
            if (window.marchActive) {
                // Toggle cancel
                window.marchActive = false;
                window.marchStep = 0;
                const mHud = document.getElementById('march-hud');
                if (mHud) mHud.style.display = 'none';
                
                // Remove visual checkpoint markers
                if (window.marchMarkers) {
                    window.marchMarkers.forEach(m => scene.remove(m));
                    window.marchMarkers = [];
                }
                showToast("⚠️ 전술 행군 훈련이 취소되었습니다.", "#ef4444");
                return;
            }
            
            window.marchActive = true;
            window.marchStep = 1;
            window.marchStartTime = Date.now();
            
            const mHud = document.getElementById('march-hud');
            if (mHud) mHud.style.display = 'block';
            window.updateMarchHud();
            
            // Spawn March Checkpoint Visual Beacons (Flags/Cylinders)
            if (window.marchMarkers) {
                window.marchMarkers.forEach(m => scene.remove(m));
            }
            window.marchMarkers = [];
            
            // Checkpoints list
            const checkpoints = [
                { x: -130, y: 0.1, z: -130, name: "1번 지점 (산 기슭)" },
                { x: -170, y: 15, z: -170, name: "2번 지점 (중턱)" },
                { x: -210, y: 35, z: -210, name: "3번 지점 (능선)" },
                { x: -250, y: 60, z: -250, name: "4번 지점 (정상)" }
            ];
            
            checkpoints.forEach((cp, idx) => {
                const geom = new THREE.CylinderGeometry(2, 2, 8, 16);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xffa500, // Orange
                    transparent: true,
                    opacity: 0.4,
                    side: THREE.DoubleSide
                });
                const marker = new THREE.Mesh(geom, mat);
                // Adjust Y based on expected floor height
                marker.position.set(cp.x, cp.y + 4, cp.z);
                scene.add(marker);
                window.marchMarkers.push(marker);
                
                // Add a small flag mesh
                const flagGeom = new THREE.BoxGeometry(3, 2, 0.1);
                const flagMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const flag = new THREE.Mesh(flagGeom, flagMat);
                flag.position.set(cp.x, cp.y + 7, cp.z);
                scene.add(flag);
                window.marchMarkers.push(flag);
            });
            
            showToast("🥾 전술 행군 훈련이 개시되었습니다! 1번 지점(산 기슭)으로 신속히 이동하십시오.", "#d97706");
        };

        window.updateMarchHud = () => {
            const stepText = document.getElementById('march-step-text');
            if (!stepText) return;
            if (window.marchStep === 1) {
                stepText.textContent = "1단계: 산 기슭 대기소로 이동 (이동 중...)";
            } else if (window.marchStep === 2) {
                stepText.textContent = "2단계: 산 중턱 쉼터로 이동 (고도 상승 중...)";
            } else if (window.marchStep === 3) {
                stepText.textContent = "3단계: 산 능선 초소로 이동 (고도 상승 중...)";
            } else if (window.marchStep === 4) {
                stepText.textContent = "최종 단계: 산 정상 정복! (고지 점령 중...)";
            }
        };

        // --- 1. Patrol Mission System ---
        window.startPatrolMission = () => {
            if (window.patrolActive) {
                showToast("⚠️ 이미 당직 순찰 근무가 진행 중입니다!", "#ffaa00");
                return;
            }
            window.patrolActive = true;
            window.patrolStep = 1;
            const pHud = document.getElementById('patrol-hud');
            if (pHud) pHud.style.display = 'block';
            window.updatePatrolHud();
            showToast("📋 당직 순찰 근무가 시작되었습니다! 1단계: 위병소로 이동하십시오.", "#4f46e5");
        };

        window.updatePatrolHud = () => {
            const stepText = document.getElementById('patrol-step-text');
            if (!stepText) return;
            if (window.patrolStep === 1) {
                stepText.textContent = "1단계: 위병소 순찰 (이동 중...)";
            } else if (window.patrolStep === 2) {
                stepText.textContent = "2단계: 탄약고 순찰 (이동 중...)";
            } else if (window.patrolStep === 3) {
                stepText.textContent = "3단계: 본청 보고 (이동 중...)";
            }
        };

        // --- 2. Canister Minigame System ---
        window.startCanisterReplacementMinigame = (inventoryKey) => {
            const overlay = document.getElementById('punishment-overlay');
            const desc = document.getElementById('punishment-desc');
            const cont = document.getElementById('punishment-interactive-container');
            
            if (!overlay || !desc || !cont) return;
            
            overlay.style.display = 'flex';
            desc.innerHTML = "🚨 <strong>정화통 교체 실시!</strong> 🚨<br>정밀 타이밍 교체가 필요합니다. 바가 <strong>초록색 영역(중앙)</strong>에 도달했을 때 [스페이스바]나 버튼을 클릭하세요!";
            cont.innerHTML = `
                <div style="position: relative; width: 300px; height: 30px; background: #222; border: 2px solid #555; border-radius: 15px; margin: 20px auto; overflow: hidden;">
                    <div style="position: absolute; left: 120px; width: 60px; height: 100%; background: #22c55e;"></div>
                    <div id="canister-slider" style="position: absolute; left: 0px; width: 10px; height: 100%; background: #fff;"></div>
                </div>
                <button id="btn-press-canister" style="width: 150px; background: #3b82f6; border-radius: 8px; font-weight: bold; padding: 10px; cursor: pointer; color: white; border: none;">교체!</button>
            `;
            
            let pos = 0;
            let dir = 1;
            let gameInterval = setInterval(() => {
                pos += dir * 10;
                if (pos >= 290) dir = -1;
                if (pos <= 0) dir = 1;
                const slider = document.getElementById('canister-slider');
                if (slider) slider.style.left = pos + 'px';
            }, 30);
            
            const attemptReplace = () => {
                clearInterval(gameInterval);
                overlay.style.display = 'none';
                
                if (pos >= 110 && pos <= 190) {
                    window.gasMaskFilter = 100;
                    showToast("✅ 정화통 교체 성공! 필터 성능이 100%로 회복되었습니다.", "#22c55e");
                    db.ref('users/' + STATE.currentUser.uid + '/inventory/' + inventoryKey).remove();
                    const invModal = document.getElementById('inventory-modal');
                    if (invModal && invModal.style.display === 'flex') {
                        document.getElementById('btn-inventory').click();
                    }
                } else {
                    showToast("❌ 정화통 교체 실패! 독가스를 들이마셨습니다! (-25 HP)", "#ef4444");
                    window.STATS.hp = Math.max(0, window.STATS.hp - 25);
                    if (typeof updateStatBars === 'function') updateStatBars();
                    if (window.STATS.hp <= 0) {
                        triggerLocalPlayerDeath("화생방 오염 가스 흡입");
                    }
                }
            };
            
            document.getElementById('btn-press-canister').onclick = attemptReplace;
            const handleKey = (e) => {
                if (e.code === 'Space' || e.key === ' ') {
                    e.preventDefault();
                    attemptReplace();
                    window.removeEventListener('keydown', handleKey);
                }
            };
            window.addEventListener('keydown', handleKey);
        };

        // --- 3. AI Target Bots System ---
        function spawnAITargetBots() {
            window.aiTargetBots.forEach(bot => scene.remove(bot));
            window.aiTargetBots = [];

            for (let i = 0; i < 3; i++) {
                const bot = createPlayerModel(0x3a4b2a); 
                bot.position.set(85 + i * 15, 0, -125);
                bot.userData.isAIBot = true;
                bot.userData.baseX = 85 + i * 15;
                bot.userData.speed = 1.0 + i * 0.4;
                bot.userData.hit = false;
                scene.add(bot);
                window.aiTargetBots.push(bot);
            }
        }
        window.spawnAITargetBots = spawnAITargetBots;

        // --- 4. Obstacle Course System ---
        function initObstacleCourseModels() {
            const courseGroup = new THREE.Group();
            
            const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
            wall.position.set(-100, 0.6, 30);
            courseGroup.add(wall);

            const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
            for (let zOffset = 45; zOffset <= 55; zOffset += 2) {
                const arch = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 0.2), tunnelMat); 
                arch.position.set(-100, 0.8, zOffset);
                courseGroup.add(arch);
            }

            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xcd853f }));
            beam.position.set(-100, 0.2, 65);
            courseGroup.add(beam);

            scene.add(courseGroup);
        }

        window.startObstacleCourse = () => {
            window.obstacleCourseActive = true;
            window.obstacleCourseTime = 0;
            window.obstacleCourseCheckpoint = 1;
            const oHud = document.getElementById('obstacle-hud');
            if (oHud) oHud.style.display = 'block';
            document.getElementById('obstacle-status').textContent = "진행 상태: 허들(낮은 장벽)을 넘으십시오!";
            showToast("🏃 유격 장애물 코스 돌파 챌린지 시작! 허들을 점프하여 넘어가세요!", "#10b981");
        };

        // --- 5. Grenade Throwing System ---
        function initGrenadeTargetModel() {
            const targetGroup = new THREE.Group();
            const ringColors = [0xff0000, 0xffffff, 0x0000ff];
            const ringSizes = [6, 4, 2];
            for (let i = 0; i < 3; i++) {
                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(0, ringSizes[i], 32),
                    new THREE.MeshBasicMaterial({ color: ringColors[i], side: THREE.DoubleSide })
                );
                ring.rotation.x = -Math.PI / 2;
                ring.position.set(70, 0.05 + i * 0.01, -130);
                targetGroup.add(ring);
            }
            scene.add(targetGroup);
        }

        window.startGrenadeThrowMode = () => {
            window.grenadeThrowingMode = true;
            window.grenadePower = 0;
            window.grenadeCharging = false;
            const gHud = document.getElementById('grenade-hud');
            if (gHud) gHud.style.display = 'block';
            showToast("☄️ 수류탄 투척 모드 활성화! 사격장 좌측 투척선으로 이동하십시오.", "#deb887");
        };

        window.throwGrenade = (power) => {
            const grenade = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8),
                new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 })
            );
            grenade.position.copy(camera.position).add(new THREE.Vector3(0, -0.3, 0));
            scene.add(grenade);

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            
            const launchVelocity = forward.clone().multiplyScalar(power * 35).add(new THREE.Vector3(0, power * 12, 0));
            const gravityAcc = -9.8;
            
            let gTime = 0;
            const grenadeInterval = setInterval(() => {
                gTime += 0.03;
                grenade.position.addScaledVector(launchVelocity, 0.03);
                launchVelocity.y += gravityAcc * 0.03;

                if (grenade.position.y <= 0.1) {
                    clearInterval(grenadeInterval);
                    
                    const expGeo = new THREE.SphereGeometry(2.5, 16, 16);
                    const expMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
                    const explosion = new THREE.Mesh(expGeo, expMat);
                    explosion.position.copy(grenade.position);
                    explosion.position.y = 1.0;
                    scene.add(explosion);
                    
                    playGunshotSound('k6'); 
                    
                    setTimeout(() => {
                        scene.remove(explosion);
                        scene.remove(grenade);
                    }, 400);

                    const targetPos = { x: 70, z: -130 };
                    const dist = Math.sqrt(Math.pow(grenade.position.x - targetPos.x, 2) + Math.pow(grenade.position.z - targetPos.z, 2));
                    
                    if (dist < 2.0) {
                        gainEXP(100, "수류탄 정밀 투척");
                        STATE.currentUser.money = (STATE.currentUser.money || 0) + 500;
                        db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                        showToast("🎯 대성공! 수류탄이 과녁 중심에 명중했습니다! (+500G, +100 EXP)", "#10b981");
                    } else if (dist < 5.0) {
                        gainEXP(50, "수류탄 우수 투척");
                        STATE.currentUser.money = (STATE.currentUser.money || 0) + 200;
                        db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                        showToast("👍 성공! 수류탄이 과녁 유효 반경에 안착했습니다! (+200G, +50 EXP)", "#22c55e");
                    } else if (dist < 8.0) {
                        gainEXP(20, "수류탄 기본 투척");
                        showToast("👌 과녁 주변에 투척 완료! 다음엔 중앙을 노려보세요! (+20 EXP)", "#f59e0b");
                    } else {
                        showToast("💨 수류탄이 과녁에서 너무 멀리 벗어났습니다!", "#ef4444");
                    }
                    
                    window.grenadeThrowingMode = false;
                    const gHud = document.getElementById('grenade-hud');
                    if (gHud) gHud.style.display = 'none';
                }
            }, 30);
        };

        // Automatic Day/Night cycle disabled - Always daytime
        // ====================================================
        // SYSTEM 3: SHOOTING RANGE (사격장)
        // ====================================================
        window.shootingMode = false;
        window.shootingScore = 0;
        window.shootingAmmo = 30;
        window.shootingTargets = [];

        const startShootingRange = () => {
            window.shootingMode = true;
            window.shootingScore = 0;
            window.shootingAmmo = 30;
            document.getElementById('shooting-hud').style.display = 'block';
            document.getElementById('crosshair').style.display = 'block';
            document.getElementById('shooting-score').textContent = '0';
            document.getElementById('shooting-ammo').textContent = '30';

            // Create targets near 사격장 (x:100, z:-100)
            window.shootingTargets.forEach(t => scene.remove(t));
            window.shootingTargets = [];
            for (let i = 0; i < 5; i++) {
                const target = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 2, 0.3),
                    new THREE.MeshStandardMaterial({ color: 0xff3333 })
                );
                target.position.set(90 + i * 5, 1, -130);
                target.userData.isTarget = true;
                target.userData.hit = false;
                target.userData.baseX = 90 + i * 5;
                target.userData.speed = 1.0 + i * 0.25;
                scene.add(target);
                window.shootingTargets.push(target);
            }
        };

        const endShootingRange = () => {
            window.shootingMode = false;
            document.getElementById('shooting-hud').style.display = 'none';
            if (!window.hasK2) document.getElementById('crosshair').style.display = 'none';
            window.shootingTargets.forEach(t => scene.remove(t));
            window.shootingTargets = [];
            
            // Clean up bullet marks
            if (window.shootingBulletMarks) {
                window.shootingBulletMarks.forEach(m => {
                    if (m.parent) m.parent.remove(m);
                    else scene.remove(m);
                });
                window.shootingBulletMarks = [];
            }
            
            const reward = window.shootingScore * 200;
            if (reward > 0) {
                STATE.currentUser.money = (STATE.currentUser.money || 0) + reward;
                db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                alert(`🎯 사격 훈련 완료!\n명중: ${window.shootingScore}발 → 포상금 ${reward.toLocaleString()}G 지급!`);
            } else {
                alert('사격 훈련 종료. 다음엔 더 잘 맞춰보세요!');
            }
        };

        const playGunshotSound = (weaponId = 'k2') => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                
                const bufferSize = ctx.sampleRate * 0.4;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                
                let pitch = (window.WEAPONS_CONFIG && window.WEAPONS_CONFIG[weaponId]) ? window.WEAPONS_CONFIG[weaponId].soundPitch : 1.0;
                let volume = 0.5;
                
                if (window.hasSilencer && weaponId !== 'marshal_card') {
                    pitch *= 0.6;
                    volume = 0.06;
                }
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000 * pitch, ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.25);
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(volume, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                noise.start();
            } catch (e) {
                console.warn("AudioContext failed:", e);
            }
        };

        const triggerMuzzleFlashAndRecoil = () => {
            if (!window.localWeapon) return;
            
            const isGolden = window.activeWeaponId === 'golden_k2';
            const flashColor = isGolden ? 0xffcc00 : 0xffdd66;
            let flashIntensity = isGolden ? 20 : 12;
            let flashRadius = isGolden ? 8 : 6;
            let meshSize = 0.08;
            if (window.hasSilencer && window.activeWeaponId !== 'marshal_card') {
                flashIntensity *= 0.1;
                flashRadius *= 0.5;
                meshSize *= 0.2;
            }
            
            const flash = new THREE.PointLight(flashColor, flashIntensity, flashRadius);
            flash.position.set(0.15, -0.1, -0.6);
            camera.add(flash);
            setTimeout(() => {
                camera.remove(flash);
            }, 60);

            const flashGeo = new THREE.SphereGeometry(meshSize, 8, 8);
            const flashMat = new THREE.MeshBasicMaterial({ color: flashColor });
            const flashMesh = new THREE.Mesh(flashGeo, flashMat);
            flashMesh.position.set(0.15, -0.1, -0.6);
            camera.add(flashMesh);
            setTimeout(() => {
                camera.remove(flashMesh);
            }, 60);
            
            const recoilZ = -0.22;
            
            if (typeof TWEEN !== 'undefined') {
                new TWEEN.Tween(window.localWeapon.position)
                    .to({ z: recoilZ }, 40)
                    .yoyo(true)
                    .repeat(1)
                    .start();
            }
        };

        const shootPlayerRaycast = (weaponId = 'k2') => {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            
            const targets = [];
            const playerMap = {};
            
            Object.keys(otherPlayers).forEach(uid => {
                const mesh = otherPlayers[uid].mesh;
                targets.push(mesh);
                playerMap[mesh.uuid] = uid;
            });
            
            const hits = raycaster.intersectObjects(targets, true);
            if (hits.length > 0) {
                const closestPlayerHit = hits[0];
                let hitObj = closestPlayerHit.object;
                let hitUid = null;
                
                while (hitObj && hitObj !== scene) {
                    if (playerMap[hitObj.uuid]) {
                        hitUid = playerMap[hitObj.uuid];
                        break;
                    }
                    hitObj = hitObj.parent;
                }
                
                if (hitUid) {
                    const solids = [];
                    scene.traverse(child => {
                        if (child.isMesh && child.visible && !child.userData.isTarget && child.parent !== window.localPlayerBody && !child.userData.isGasMaskPart && !child.userData.isCamo) {
                            let isOtherPlayer = false;
                            Object.values(otherPlayers).forEach(op => {
                                op.mesh.traverse(oc => { if (oc === child) isOtherPlayer = true; });
                            });
                            if (!isOtherPlayer) {
                                solids.push(child);
                            }
                        }
                    });
                    
                    const obstacleHits = raycaster.intersectObjects(solids, true);
                    if (obstacleHits.length > 0 && obstacleHits[0].distance < closestPlayerHit.distance) {
                        showToast("🧱 장애물에 막혀 격발이 전달되지 않았습니다.", "#ffcc00");
                        return;
                    }

                    const hitPlayerName = otherPlayers[hitUid].lastName || hitUid;
                    const damage = (window.WEAPONS_CONFIG && window.WEAPONS_CONFIG[weaponId]) ? window.WEAPONS_CONFIG[weaponId].damage : 25;
                    showToast(`🎯 ${hitPlayerName}을(를) 맞췄습니다! (피해량: ${damage})`, "#ff0000");
                    
                    if (hitUid === 'creator_boss') {
                        if (typeof window.damageCreatorBoss === 'function') {
                            window.damageCreatorBoss(damage, closestPlayerHit.point);
                        }
                        return;
                    }
                    
                    if (db) {
                        db.ref('users/' + hitUid + '/hit').set({
                            shooter: STATE.currentUser.name || STATE.currentUser.username,
                            shooterUid: STATE.currentUser.uid,
                            damage: damage,
                            time: Date.now()
                        });

                        db.ref('system/blood_particles_trigger').set({
                            x: closestPlayerHit.point.x,
                            y: closestPlayerHit.point.y,
                            z: closestPlayerHit.point.z,
                            time: Date.now()
                        });
                    }
                }
            }
        };

        window.spawnBloodSplatMesh = (x, y, z) => {
            const group = new THREE.Group();
            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b0000,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            const mainPuddle = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), mat);
            mainPuddle.rotation.x = -Math.PI / 2;
            mainPuddle.position.set(0, 0.02, 0);
            group.add(mainPuddle);
            
            for (let i = 0; i < 4; i++) {
                const size = 0.15 + Math.random() * 0.25;
                const splat = new THREE.Mesh(new THREE.CircleGeometry(size, 8), mat);
                splat.rotation.x = -Math.PI / 2;
                
                const angle = Math.random() * Math.PI * 2;
                const dist = 0.5 + Math.random() * 0.9;
                const ox = Math.cos(angle) * dist;
                const oz = Math.sin(angle) * dist;
                
                splat.position.set(ox, 0.021 + i * 0.001, oz);
                group.add(splat);
            }
            
            group.position.set(x, 0, z);
            scene.add(group);
        };

        document.getElementById('game-canvas').addEventListener('click', () => {
            if (window.cctvMeshes && window.cctvMeshes.length > 0) {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const hits = raycaster.intersectObjects(window.cctvMeshes);
                if (hits.length > 0) {
                    const clickedScreen = hits[0].object;
                    const cctvId = clickedScreen.userData.cctvId;
                    if (cctvId) {
                        window.enterCctvMode(cctvId);
                        return;
                    }
                }
            }

            if (window.interactiveTargets && window.interactiveTargets.length > 0) {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const hits = raycaster.intersectObjects(window.interactiveTargets, true);
                if (hits.length > 0) {
                    let hitObj = hits[0].object;
                    while (hitObj && hitObj !== scene) {
                        if (hitObj.userData) {
                            if (hitObj.userData.isGoldenArmory) {
                                if (typeof window.triggerGoldenArmory === 'function') window.triggerGoldenArmory();
                                return;
                            }
                            if (hitObj.userData.isEmergencyButton) {
                                if (typeof window.triggerEmergencySiren === 'function') window.triggerEmergencySiren();
                                return;
                            }
                            if (hitObj.userData.isEscapeHatch) {
                                if (typeof window.triggerEscapeHatch === 'function') window.triggerEscapeHatch();
                                return;
                            }
                            if (hitObj.userData.isBunkerExit) {
                                if (typeof window.triggerBunkerExit === 'function') window.triggerBunkerExit();
                                return;
                            }
                            if (hitObj.userData.isWardrobe) {
                                if (typeof window.triggerWardrobe === 'function') window.triggerWardrobe();
                                return;
                            }
                        }
                        hitObj = hitObj.parent;
                    }
                }
            }

            if (!window.shootingMode) {
                if (window.activeWeaponId) {
                    if (window.isLocalPlayerDead) return;
                    
                    const now = Date.now();
                    const nextAllowed = window.lastFireTime || 0;
                    if (now < nextAllowed) return;
                    const delay = (WEAPONS_CONFIG[window.activeWeaponId] && WEAPONS_CONFIG[window.activeWeaponId].fireRate) ? WEAPONS_CONFIG[window.activeWeaponId].fireRate : 150;
                    window.lastFireTime = now + delay;
                    
                    if (window.activeWeaponId !== 'marshal_card') {
                        if (window.currentAmmo[window.activeWeaponId] === undefined) {
                            window.currentAmmo[window.activeWeaponId] = WEAPONS_CONFIG[window.activeWeaponId].maxAmmo;
                        }
                        if (window.currentAmmo[window.activeWeaponId] <= 0) {
                            playGunshotDryClick();
                            showToast("⚠️ 탄약 없음! 재장전(R)이 필요합니다.", "#ffcc00");
                            return;
                        }
                        window.currentAmmo[window.activeWeaponId]--;
                        const ammoDisp = document.getElementById('hud-ammo-display');
                        if (ammoDisp) {
                            ammoDisp.textContent = `${window.currentAmmo[window.activeWeaponId]} / ${WEAPONS_CONFIG[window.activeWeaponId].maxAmmo}`;
                        }
                    }
                    
                    triggerMuzzleFlashAndRecoil();
                    playGunshotSound(window.activeWeaponId);
                    shootPlayerRaycast(window.activeWeaponId);
                }
                return;
            }
            
            if (window.shootingAmmo <= 0) return;
            window.shootingAmmo--;
            document.getElementById('shooting-ammo').textContent = window.shootingAmmo;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            
            const allSceneMeshes = [];
            scene.traverse(child => {
                if (child.isMesh && child.visible) {
                    allSceneMeshes.push(child);
                }
            });
            const allHits = raycaster.intersectObjects(allSceneMeshes);
            
            if (allHits.length > 0) {
                const hitObj = allHits[0].object;
                const hitPoint = allHits[0].point;
                
                const bulletMark = new THREE.Mesh(
                    new THREE.SphereGeometry(0.08, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xffffff })
                );
                
                let hitBot = null;
                let parentObj = hitObj;
                while (parentObj && parentObj !== scene) {
                    if (parentObj.userData && parentObj.userData.isAIBot) {
                        hitBot = parentObj;
                        break;
                    }
                    parentObj = parentObj.parent;
                }

                const isTarget = window.shootingTargets.includes(hitObj);
                if (isTarget) {
                    const localHit = hitObj.worldToLocal(hitPoint.clone());
                    bulletMark.position.copy(localHit);
                    hitObj.add(bulletMark);
                    
                    if (!hitObj.userData.hit) {
                        hitObj.userData.hit = true;
                        hitObj.material.color.setHex(0x888888);
                        hitObj.rotation.x = Math.PI / 2;
                        window.shootingScore++;
                        document.getElementById('shooting-score').textContent = window.shootingScore;
                        
                        if (window.promoExamActive) {
                            window.promoShootHits = (window.promoShootHits || 0) + 1;
                            if (typeof updatePromoHUD === 'function') updatePromoHUD();
                        }
                        if (typeof gainEXP === 'function') gainEXP(10, '명중');
                        if (typeof trackMission === 'function') trackMission('shootHits', 1);
                        if (typeof unlockAchievement === 'function') {
                            unlockAchievement('first_shot');
                            if (window.shootingScore >= 5) unlockAchievement('sharpshooter');
                        }
                    }
                } else if (hitBot && !hitBot.userData.hit) {
                    hitBot.userData.hit = true;
                    if (typeof gainEXP === 'function') gainEXP(25, 'AI 표적 제거');
                    
                    const reward = 150;
                    STATE.currentUser.money = (STATE.currentUser.money || 0) + reward;
                    db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                    
                    showToast(`🤖 AI 사격 훈련용 표적 처치 성공! (+${reward}G, +25 EXP)`, "#10b981");

                    setTimeout(() => {
                        scene.remove(hitBot);
                        setTimeout(() => {
                            if (typeof spawnAITargetBots === 'function') {
                                const index = window.aiTargetBots.indexOf(hitBot);
                                if (index !== -1) {
                                    const bot = createPlayerModel(0x3a4b2a);
                                    bot.position.set(85 + index * 15, 0, -125);
                                    bot.userData.isAIBot = true;
                                    bot.userData.baseX = 85 + index * 15;
                                    bot.userData.speed = 1.0 + index * 0.4;
                                    bot.userData.hit = false;
                                    scene.add(bot);
                                    window.aiTargetBots[index] = bot;
                                }
                            }
                        }, 5000);
                    }, 2000);
                } else {
                    bulletMark.position.copy(hitPoint);
                    scene.add(bulletMark);
                }
                
                if (!window.shootingBulletMarks) window.shootingBulletMarks = [];
                window.shootingBulletMarks.push(bulletMark);
            }
            if (window.shootingAmmo <= 0) setTimeout(endShootingRange, 1500);
        });



        // ====================================================
        // SYSTEM 4: GROUND VEHICLES
        // ====================================================
        window.inVehicle = false;
        window.currentVehicle = null;

        // Create 두돈반 Truck
        const makeTruck = () => {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x4b5320 }));
            body.position.y = 1.5; g.add(body);
            const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), new THREE.MeshStandardMaterial({ color: 0x3a4020 }));
            cab.position.set(0, 3, -2); g.add(cab);
            for (let wx of [-2, 2]) for (let wz of [-2.5, 0, 2.5]) {
                const w = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
                w.rotation.z = Math.PI/2; w.position.set(wx, 0.7, wz); g.add(w);
            }
            const lc = document.createElement('canvas'); lc.width=256; lc.height=64;
            const lx = lc.getContext('2d'); lx.fillStyle='rgba(0,0,0,0.7)'; lx.fillRect(0,0,256,64);
            lx.fillStyle='#deb887'; lx.font='bold 24px sans-serif'; lx.textAlign='center'; lx.fillText('두돈반 트럭 [F탑승]',128,42);
            const ls = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(lc)}));
            ls.position.set(0, 6, 0); ls.scale.set(10,2.5,1); g.add(ls);
            g.userData.type = 'truck'; g.userData.speed = 0; g.userData.label = ls;
            return g;
        };

        // Create K2 Tank
        const makeTank = () => {
            const g = new THREE.Group();
            const hull = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x3d4a2a }));
            hull.position.y = 1; g.add(hull);
            const turret = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3.5), new THREE.MeshStandardMaterial({ color: 0x2e3820 }));
            turret.position.set(0, 2.1, -0.5); g.add(turret);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 }));
            barrel.rotation.x = Math.PI/2; barrel.position.set(0, 2.3, -3.5); g.add(barrel);
            const lc = document.createElement('canvas'); lc.width=256; lc.height=64;
            const lx = lc.getContext('2d'); lx.fillStyle='rgba(0,0,0,0.7)'; lx.fillRect(0,0,256,64);
            lx.fillStyle='#ff9900'; lx.font='bold 24px sans-serif'; lx.textAlign='center'; lx.fillText('K2 전차 [F탑승]',128,42);
            const ls = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(lc)}));
            ls.position.set(0, 5, 0); ls.scale.set(10,2.5,1); g.add(ls);
            g.userData.type = 'tank'; g.userData.speed = 0; g.userData.label = ls;
            return g;
        };

        const makeAirplane = () => {
            const group = new THREE.Group();
            
            // Fuselage (몸체)
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e3820, roughness: 0.5 }); // Dark olive camo color
            const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 12, 16), bodyMat);
            body.rotation.x = Math.PI / 2;
            group.add(body);

            // Cockpit (조종석)
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, transparent: true, opacity: 0.6 });
            const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 16), glassMat);
            cockpit.position.set(0, 0.8, -2);
            cockpit.scale.set(1, 0.8, 2);
            group.add(cockpit);

            // Wings (주날개)
            const wingMat = new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.6 });
            const leftWing = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 2.5), wingMat);
            leftWing.position.set(5.5, 0, -1);
            leftWing.rotation.y = -0.15;
            group.add(leftWing);

            const rightWing = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 2.5), wingMat);
            rightWing.position.set(-5.5, 0, -1);
            rightWing.rotation.y = 0.15;
            group.add(rightWing);

            // Tail Fin (꼬리날개)
            const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 2), wingMat);
            tailFin.position.set(0, 1.8, 5);
            tailFin.rotation.x = -0.2;
            group.add(tailFin);

            const tailFlaps = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.5), wingMat);
            tailFlaps.position.set(0, 0.2, 5);
            group.add(tailFlaps);

            // Propeller Spinner
            const spinnerMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8 });
            const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 8), spinnerMat);
            spinner.rotation.x = -Math.PI / 2;
            spinner.position.set(0, 0, -6.5);
            group.add(spinner);

            // Propeller Blades
            const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
            const propGroup = new THREE.Group();
            propGroup.position.set(0, 0, -6.6);
            
            const blade1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 0.05), bladeMat);
            propGroup.add(blade1);
            
            const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.05), bladeMat);
            propGroup.add(blade2);
            
            group.add(propGroup);
            group.userData.propeller = propGroup;

            // Wheels (Landing Gear)
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            
            const frontWheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8), blackMat);
            frontWheelL.rotation.z = Math.PI / 2;
            frontWheelL.position.set(-2, -1.8, -2);
            frontWheelL.name = 'frontWheelL';
            group.add(frontWheelL);

            const frontWheelR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8), blackMat); frontWheelR.rotation.z = Math.PI / 2;
            frontWheelR.position.set(2, -1.8, -2);
            frontWheelR.name = 'frontWheelR';
            group.add(frontWheelR);

            const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), blackMat);
            tailWheel.rotation.z = Math.PI / 2;
            tailWheel.position.set(0, -1.4, 5);
            tailWheel.name = 'tailWheel';
            group.add(tailWheel);

            // Add label billboard
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 256; labelCanvas.height = 64;
            const ctx = labelCanvas.getContext('2d');
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,256,64);
            ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 24px Pretendard'; ctx.textAlign = 'center';
            ctx.fillText('전투 비행기 [F탑승]', 128, 40);
            const labelTex = new THREE.CanvasTexture(labelCanvas);
            const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex }));
            labelSprite.position.set(0, 5, 0);
            labelSprite.scale.set(10, 2.5, 1);
            group.add(labelSprite);
            group.userData.label = labelSprite;
            group.userData.type = 'airplane';

            return group;
        };

        window.flightEngineOn = false;
        window.flightLightsOn = false;
        window.flightGearDown = true;
        window.flightFlaps = 0;

        window.toggleFlightEngine = (checked) => {
            window.flightEngineOn = checked;
            showToast(checked ? "⚡ 전투기 엔진 시동 ON! 비행 조작 대기." : "💤 전투기 엔진 시동 OFF.", checked ? "#00ffcc" : "#f59e0b");
        };

        window.toggleFlightLights = (checked) => {
            window.flightLightsOn = checked;
            if (window.airplaneMesh) {
                // Remove existing lights
                window.airplaneMesh.traverse(child => {
                    if (child.isSpotLight || (child.name && child.name.includes('spotlight'))) {
                        window.airplaneMesh.remove(child);
                    }
                });
                if (checked) {
                    const spotlight = new THREE.SpotLight(0xffffff, 5, 100, Math.PI / 5, 0.5, 1);
                    spotlight.position.set(0, 0, -6.5);
                    spotlight.name = 'spotlight';
                    
                    const targetObj = new THREE.Object3D();
                    targetObj.position.set(0, -5, -80);
                    targetObj.name = 'spotlightTarget';
                    
                    spotlight.target = targetObj;
                    window.airplaneMesh.add(spotlight);
                    window.airplaneMesh.add(targetObj);
                    showToast("💡 랜딩 라이트 ON", "#00ffcc");
                } else {
                    showToast("💡 랜딩 라이트 OFF", "#f59e0b");
                }
            }
        };

        window.toggleFlightGear = (checked) => {
            window.flightGearDown = checked;
            if (window.airplaneMesh) {
                window.airplaneMesh.traverse(child => {
                    if (child.name && child.name.includes('Wheel')) {
                        child.visible = checked;
                    }
                });
                showToast(checked ? "⚙️ 랜딩 기어 전개 (Gear Down)" : "⚙️ 랜딩 기어 수납 (Gear Up)", "#00ffcc");
            }
        };

        window.changeFlaps = (val) => {
            window.flightFlaps = parseInt(val) || 0;
            showToast(`📐 플랩 각도 변경: ${window.flightFlaps}°`, "#00ffcc");
        };

        window.fireFlightVulcan = () => {
            if (!window.inVehicle || window.currentVehicle !== window.airplaneMesh) {
                showToast("❌ 전투기 조종 중에만 발사할 수 있습니다.", "#ef4444");
                return;
            }
            if (!window.flightEngineOn) {
                showToast("❌ 엔진 시동을 먼저 켜십시오!", "#ef4444");
                return;
            }

            const startPos = new THREE.Vector3().copy(camera.position);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

            // Spawn tracers
            for (let i = 0; i < 2; i++) {
                const tracer = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.08, 0.08, 6),
                    new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
                );
                tracer.position.copy(startPos).addScaledVector(dir, 15);
                tracer.lookAt(startPos.clone().addScaledVector(dir, 100));
                tracer.rotation.x += Math.PI / 2;
                scene.add(tracer);

                let dist = 0;
                const bulletAnim = () => {
                    dist += 4;
                    tracer.position.addScaledVector(dir, 4);
                    if (dist < 300) {
                        requestAnimationFrame(bulletAnim);
                    } else {
                        scene.remove(tracer);
                        tracer.geometry.dispose();
                        tracer.material.dispose();
                    }
                };
                bulletAnim();
            }
            showToast("💥 20mm 기관포 사격 실시!", "#ef4444");
        };

        window.truckMesh = makeTruck();
        window.truckMesh.position.set(-70, 0, 50);
        window.truckMesh.userData.id = 'truck';
        scene.add(window.truckMesh);

        window.tankMesh = makeTank();
        window.tankMesh.position.set(-50, 0, 50);
        window.tankMesh.userData.id = 'tank';
        scene.add(window.tankMesh);

        window.airplaneMesh = makeAirplane();
        window.airplaneMesh.position.set(200, 1.8, 120);
        window.airplaneMesh.userData.id = 'airplane';
        scene.add(window.airplaneMesh);
        
        if (window.helicopterMesh) window.helicopterMesh.userData.id = 'helicopter';

        db.ref('vehicles').on('value', snap => {
            const data = snap.val();
            if (!data) return;
            const vMap = { 'truck': window.truckMesh, 'tank': window.tankMesh, 'helicopter': window.helicopterMesh, 'airplane': window.airplaneMesh };
            Object.keys(data).forEach(id => {
                const v = vMap[id];
                if (v && (!window.inVehicle || window.currentVehicle !== v)) {
                    const d = data[id];
                    v.position.set(d.x, d.y, d.z);
                    v.rotation.y = d.ry || 0;
                }
            });
        });

        const tryEnterVehicle = () => {
            if (window.inVehicle) {
                // Exit vehicle
                window.inVehicle = false;
                camera.position.y = 1.6;
                window.currentVehicle.userData.label.visible = true;
                window.currentVehicle = null;
                document.getElementById('vehicle-hud').style.display = 'none';
                
                // Hide flight dashboard
                const fd = document.getElementById('flight-dashboard');
                if (fd) fd.style.display = 'none';
                return;
            }
            const vehicles = [window.truckMesh, window.tankMesh, window.helicopterMesh, window.airplaneMesh];
            for (const v of vehicles) {
                if (!v) continue;
                const d = camera.position.distanceTo(v.position);
                const maxDist = (v === window.airplaneMesh || v === window.helicopterMesh) ? 22 : 12;
                if (d < maxDist) {
                    if (v === window.helicopterMesh && STATE.currentUser.username !== 'ree1203') {
                        alert('이 헬기는 대장 전용입니다!'); return;
                    }
                    window.inVehicle = true;
                    window.currentVehicle = v;
                    v.userData.label.visible = false;
                    
                    if (document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                    
                    const isAir = (v === window.helicopterMesh || v === window.airplaneMesh);
                    const vname = v === window.helicopterMesh ? '🚁 헬기' : v === window.airplaneMesh ? '✈️ 전투 비행기' : v.userData.type === 'tank' ? '🪖 K2전차' : '🚚 두돈반';
                    document.getElementById('vehicle-hud').textContent = `${vname} 탑승 중 | [WASD: 조향] [Q/E: ${isAir ? '고도 조절' : '속도'}] [F: 하차]`;
                    document.getElementById('vehicle-hud').style.display = 'block';
                    camera.position.set(v.position.x, v.position.y + 3, v.position.z);
                    
                    // Show flight dashboard for flying vehicles
                    if (isAir) {
                        const fd = document.getElementById('flight-dashboard');
                        if (fd) fd.style.display = 'block';
                        
                        // Sync dashboard checkboxes to global state
                        const eb = document.getElementById('btn-engine-switch');
                        if (eb) eb.checked = window.flightEngineOn;
                        const lb = document.getElementById('btn-lights-switch');
                        if (lb) lb.checked = window.flightLightsOn;
                        const gb = document.getElementById('btn-gear-switch');
                        if (gb) gb.checked = window.flightGearDown;
                        const fs = document.getElementById('select-flaps');
                        if (fs) fs.value = window.flightFlaps.toString();
                    }
                    return;
                }
            }
            alert('탑승 가능한 차량이 없습니다. 차량에 가까이 가세요!');
        };

        // ====================================================
        // SYSTEM 5: INDOOR FACILITIES (생활관 내부)
        // ====================================================
        // Create barracks interior (근처에 생활관 내부 구조물 추가)
        const barracksPos = LOCATIONS['생활관'];
        // Beds (침상)
        for (let i = 0; i < 6; i++) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x8b6914 }));
            frame.position.set(barracksPos.x - 10 + (i % 3) * 7, 0.6, barracksPos.z - 10 + Math.floor(i/3) * 10);
            scene.add(frame);
            const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 2.8), new THREE.MeshStandardMaterial({ color: 0x4b5320 }));
            mattress.position.set(frame.position.x, 0.78, frame.position.z);
            scene.add(mattress);
            const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xf5f5dc }));
            pillow.position.set(frame.position.x, 0.87, frame.position.z - 1.1);
            scene.add(pillow);
        }
        // Locker (관물대)
        for (let i = 0; i < 4; i++) {
            const locker = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.5), new THREE.MeshStandardMaterial({ color: 0x555a30, metalness: 0.3 }));
            locker.position.set(barracksPos.x + 12, 1, barracksPos.z - 10 + i * 6);
            scene.add(locker);
        }

        // Obstacle course at 유격장
        const ugPos = LOCATIONS['유격장'];
        for (let i = 0; i < 5; i++) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a3010 }));
            wall.position.set(ugPos.x - 15 + i * 8, 1.5, ugPos.z + 10);
            scene.add(wall);
        }
        // Rope climb pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0x7a5020 }));
        pole.position.set(ugPos.x, 3, ugPos.z);
        scene.add(pole);

        // ====================================================
        // SHARED UTILITY: Toast Notification
        // ====================================================
        window.showToast = (msg, color = '#deb887') => {
            const c = document.getElementById('toast-container');
            if (!c) return;
            const t = document.createElement('div');
            t.className = 'toast';
            t.style.borderColor = color;
            t.innerHTML = msg;
            c.appendChild(t);
            setTimeout(() => t.remove(), 4200);
        };

        // ====================================================
        // SYSTEM A: EXP + AUTO-RANK PROGRESSION
        // ====================================================
        window.EXP_TO_RANK = {};
        let expBase = 100;
        RANKS.forEach((r, i) => { window.EXP_TO_RANK[r] = expBase; expBase = Math.floor(expBase * 1.6); });

        window.expRate = 1.0;
        if (db) {
            db.ref('system/config/expRate').on('value', snap => {
                const val = snap.val();
                if (val !== null) window.expRate = parseFloat(val) || 1.0;
            });
        }

        window.gainEXP = (amount, reason = '') => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
            const scaledAmount = Math.floor(amount * (window.expRate || 1.0));
            
            const needed = window.EXP_TO_RANK[STATE.currentUser.rank] || 100;
            
            STATE.currentUser.exp = Math.min(needed, (STATE.currentUser.exp || 0) + scaledAmount);
            db.ref('users/' + STATE.currentUser.uid).update({ exp: STATE.currentUser.exp });
            if (reason) showToast(`⭐ +${scaledAmount} EXP (${reason})`);

            updateExpBar();
        };

        const updateExpBar = () => {
            if (!STATE.currentUser) return;
            const wrap = document.getElementById('exp-bar-wrap');
            if (wrap) wrap.style.display = 'block';
            const exp = STATE.currentUser.exp || 0;
            const needed = window.EXP_TO_RANK[STATE.currentUser.rank] || 100;
            
            const fill = document.getElementById('exp-bar-fill');
            const hudExp = document.getElementById('hud-exp');
            const hudExpMax = document.getElementById('hud-exp-max');
            if (fill && hudExp && hudExpMax) {
                if (STATE.currentUser.promotionReady) {
                    hudExp.textContent = "진급";
                    hudExpMax.textContent = "측정대기";
                    fill.style.width = '100%';
                    fill.style.background = 'linear-gradient(90deg, #f59e0b, #ff0000)';
                } else if (STATE.currentUser.promotionPending) {
                    hudExp.textContent = "승인";
                    hudExpMax.textContent = "대기중";
                    fill.style.width = '100%';
                    fill.style.background = 'linear-gradient(90deg, #38bdf8, #1e40af)';
                } else {
                    hudExp.textContent = exp;
                    hudExpMax.textContent = needed;
                    fill.style.width = Math.min(100, (exp / needed) * 100) + '%';
                    fill.style.background = 'linear-gradient(90deg, #deb887, #f59e0b)';
                }
            }
        };

        // ====================================================
        // SYSTEM B: DISCIPLINE (군기) POINTS
        // ====================================================
        window.DISCIPLINE = 100;
        document.getElementById('discipline-hud').style.display = 'block';

        window.changeDiscipline = (delta, reason = '') => {
            window.DISCIPLINE = Math.max(0, Math.min(100, window.DISCIPLINE + delta));
            const hudDisc = document.getElementById('hud-discipline');
            if (hudDisc) {
                hudDisc.textContent = Math.floor(window.DISCIPLINE);
                const color = window.DISCIPLINE > 60 ? '#22c55e' : window.DISCIPLINE > 30 ? '#f59e0b' : '#ef4444';
                hudDisc.style.color = color;
            }
            if (reason) showToast(`🏅 군기 ${delta > 0 ? '+' : ''}${delta} (${reason})`);
            
            if (window.DISCIPLINE <= 0 && !window.currentPunishment && !window.godModeActive && !window.isLocalPlayerDead) {
                const punishTypes = ['pushups', 'squats', 'meditation', 'digging'];
                const randType = punishTypes[Math.floor(Math.random() * punishTypes.length)];
                showToast("🚨 군기 0! 강제 군기훈련이 집행됩니다!", "#ef4444");
                if (typeof window.triggerPunishment === 'function') {
                    window.triggerPunishment(randType);
                }
            }
        };

        // ====================================================
        // SYSTEM C: ACHIEVEMENTS (업적 배지)
        // ====================================================
        const ALL_ACHIEVEMENTS = [
            { id: 'first_login',    name: '첫 입영', desc: '처음으로 게임에 접속했습니다.',    icon: '🪖', expReward: 50 },
            { id: 'first_shot',     name: '첫 사격', desc: '사격장에서 표적을 처음 명중했습니다.', icon: '🎯', expReward: 100 },
            { id: 'sharpshooter',   name: '명사수',  desc: '사격 훈련에서 5발 모두 명중!',   icon: '🏆', expReward: 300 },
            { id: 'rich_soldier',   name: '부자 병사', desc: '보유 골드 10,000G 달성!',        icon: '💰', expReward: 200 },
            { id: 'sergeant_up',    name: '부사관',  desc: '하사 이상으로 진급했습니다.',       icon: '⭐', expReward: 500 },
            { id: 'vehicle_pilot',  name: '기동대',  desc: '차량을 처음 탑승했습니다.',         icon: '🚗', expReward: 150 },
            { id: 'voice_chat',     name: '무전병',  desc: 'P키로 무전을 처음 송신했습니다.',   icon: '📻', expReward: 80 },
            { id: 'survivor',       name: '생존왕',  desc: '영창을 탈출(석방)했습니다.',        icon: '🔓', expReward: 200 },
            { id: 'gas_survivor',   name: '가스실 생존왕', desc: '화생방실에서 30초 동안 버텼습니다.', icon: '😤', expReward: 250 },
        ];

        window.unlockAchievement = (id) => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
            const already = STATE.currentUser.achievements || {};
            if (already[id]) return;
            const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
            if (!ach) return;
            already[id] = Date.now();
            STATE.currentUser.achievements = already;
            db.ref('users/' + STATE.currentUser.uid + '/achievements').update({ [id]: Date.now() });
            showToast(`📛 업적 해제: ${ach.icon} ${ach.name}! (+${ach.expReward} EXP)`, '#a78bfa');
            gainEXP(ach.expReward, '업적 달성');
        };

        // First login achievement
        unlockAchievement('first_login');

        document.getElementById('btn-achievements').onclick = () => {
            const modal = document.getElementById('achievements-modal');
            const list  = document.getElementById('achievements-list');
            const unlocked = STATE.currentUser.achievements || {};
            list.innerHTML = ALL_ACHIEVEMENTS.map(a => `
                <div class="badge-item ${unlocked[a.id] ? '' : 'locked'}">
                    <div class="badge-icon">${a.icon}</div>
                    <div>
                        <div style="font-weight:800; color:#fff; margin-bottom:4px;">${a.name}</div>
                        <div style="font-size:0.8rem; color:#888;">${a.desc}</div>
                        ${unlocked[a.id] ? `<div style="font-size:0.75rem; color:#22c55e; margin-top:4px;">✅ 달성 (EXP +${a.expReward})</div>` : '<div style="font-size:0.75rem; color:#666; margin-top:4px;">🔒 미달성</div>'}
                    </div>
                </div>
            `).join('');
            modal.style.display = 'flex';
        };

        // ====================================================
        // SYSTEM D: DAILY MISSIONS
        // ====================================================
        const getTodayKey = () => new Date().toISOString().slice(0, 10);
        const getWeekKey = () => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // nearest Thursday (ISO week)
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getFullYear()}-W${weekNo}`;
        };

        const DAILY_MISSIONS = [
            { id: 'dm_shoot3',   name: '사격 훈련 참가',   desc: '사격장에서 3발 이상 명중하기',   target: 3,  rewardG: 500,  rewardExp: 100, trackKey: 'shootHits'  },
            { id: 'dm_chat5',    name: '전우와 대화',       desc: '채팅 메시지 5개 보내기',         target: 5,  rewardG: 300,  rewardExp: 60,  trackKey: 'chatCount'  },
            { id: 'dm_walk',     name: '순찰 완료',         desc: '총 이동거리 500m 달성',          target: 500,rewardG: 400,  rewardExp: 80,  trackKey: 'walkDist'   },
            { id: 'dm_guard',    name: '위병소 경계근무',   desc: '위병소에서 60초 동안 경계 근무 서기', target: 60, rewardG: 400,  rewardExp: 90,  trackKey: 'guardDuty'  },
            { id: 'dm_ammo',     name: '탄약고 보급 임무',  desc: '탄약고에서 60초 동안 보급 작업 수행', target: 60, rewardG: 450,  rewardExp: 95,  trackKey: 'ammoSupply' },
        ];

        // Load or init today's mission progress
        const todayKey = getTodayKey();
        if (!STATE.currentUser.dailyMissions || STATE.currentUser.dailyMissions.date !== todayKey) {
            STATE.currentUser.dailyMissions = { date: todayKey, progress: {}, completed: {} };
        }
        // Firebase drops empty objects on save, so progress/completed can come back undefined
        if (!STATE.currentUser.dailyMissions.progress) STATE.currentUser.dailyMissions.progress = {};
        if (!STATE.currentUser.dailyMissions.completed) STATE.currentUser.dailyMissions.completed = {};

        window.trackMission = (key, amount = 1) => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
            const dm = STATE.currentUser.dailyMissions;
            if (dm.date !== getTodayKey()) { dm.date = getTodayKey(); dm.progress = {}; dm.completed = {}; }
            if (!dm.progress) dm.progress = {};
            if (!dm.completed) dm.completed = {};
            dm.progress[key] = (dm.progress[key] || 0) + amount;
            DAILY_MISSIONS.forEach(m => {
                if (m.trackKey === key && !dm.completed[m.id] && dm.progress[key] >= m.target) {
                    dm.completed[m.id] = true;
                    STATE.currentUser.money = (STATE.currentUser.money || 0) + m.rewardG;
                    STATE.currentUser.leavePoints = (STATE.currentUser.leavePoints || 0) + 10;
                    db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money, leavePoints: STATE.currentUser.leavePoints });
                    gainEXP(m.rewardExp, '일일 미션 완료');
                    showToast(`📋 미션 완료: ${m.name}! (+${m.rewardG}G +${m.rewardExp}EXP +10휴가P)`, '#22c55e');

                    // Weekly unit-ranking tally (counts mission completions per branch)
                    const wk = getWeekKey();
                    if (!STATE.currentUser.weeklyStats || STATE.currentUser.weeklyStats.week !== wk) {
                        STATE.currentUser.weeklyStats = { week: wk, count: 0 };
                    }
                    STATE.currentUser.weeklyStats.count += 1;
                    db.ref('users/' + STATE.currentUser.uid + '/weeklyStats').set(STATE.currentUser.weeklyStats);
                }
            });
            db.ref('users/' + STATE.currentUser.uid + '/dailyMissions').set(STATE.currentUser.dailyMissions);
        };

        document.getElementById('btn-missions').onclick = () => {
            const modal = document.getElementById('missions-modal');
            const list  = document.getElementById('missions-list');
            const dm = STATE.currentUser.dailyMissions || { progress: {}, completed: {} };
            list.innerHTML = DAILY_MISSIONS.map(m => {
                const prog = Math.min(m.target, dm.progress[m.trackKey] || 0);
                const done = dm.completed[m.id];
                return `<div class="mission-item">
                    <div style="font-size:1.5rem;">${done ? '✅' : '🎯'}</div>
                    <div class="mi-label">
                        <div class="mi-title">${m.name}</div>
                        <div class="mi-desc">${m.desc} (보상: ${m.rewardG}G + ${m.rewardExp} EXP)</div>
                        <div class="mission-progress">
                            <div class="mission-progress-fill" style="width:${(prog/m.target)*100}%; ${done ? 'background:#22c55e;' : ''}"></div>
                        </div>
                        <div style="font-size:0.75rem; color:#888; margin-top:4px;">${prog} / ${m.target} ${done ? '✅ 완료!' : ''}</div>
                    </div>
                </div>`;
            }).join('');
            modal.style.display = 'flex';
        };

        // ====================================================
        // SYSTEM E: LEADERBOARD (명예의 전당)
        // ====================================================
        document.getElementById('btn-leaderboard').onclick = () => {
            const modal = document.getElementById('leaderboard-modal');
            const list  = document.getElementById('leaderboard-list');
            list.innerHTML = '<div style="color:#888; text-align:center; padding:20px;">데이터 로딩 중...</div>';
            modal.style.display = 'flex';

            db.ref('users').orderByChild('money').limitToLast(150).once('value', snap => {
                const users = [];
                snap.forEach(c => { const u = c.val(); if (u.username && !u.dashboardOnly) users.push(u); });
                users.sort((a, b) => (b.money || 0) - (a.money || 0));
                list.innerHTML = users.slice(0, 100).map((u, i) => {
                    const medals = ['🥇','🥈','🥉'];
                    const pos = medals[i] || `${i+1}위`;
                    const rankIdx = RANKS.indexOf(u.rank) || 0;
                    const color = rankIdx >= 14 ? '#222' : rankIdx >= 11 ? '#1f305e' : rankIdx >= 8 ? '#c2b280' : rankIdx >= 4 ? '#3a4b2a' : '#4b5320';
                    return `<div class="rank-item">
                        <div class="rank-pos">${pos}</div>
                        <div style="width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;flex-shrink:0;">${(u.name||'?')[0]}</div>
                        <div style="flex:1;">
                            <div style="font-weight:800;color:#fff;">${u.name || u.username}</div>
                            <div style="font-size:0.8rem;color:#888;">${u.rank || '이등병'} · ${u.branch || '육군'}</div>
                        </div>
                        <div style="font-weight:900;color:#deb887;">${(u.money||0).toLocaleString()}G</div>
                    </div>`;
                }).join('') || '<div style="color:#888;text-align:center;padding:20px;">데이터 없음</div>';
            });
        };

        // ====================================================
        // SYSTEM E2: LEAVE PASS (외출증) - 면회실
        // ====================================================
        window.issueLeavePass = () => {
            if (!STATE.currentUser) return;
            const pts = STATE.currentUser.leavePoints || 0;
            if (window.leavePassActive) {
                showToast('🎫 이미 외출증이 발급되어 있습니다!', '#f59e0b');
                return;
            }
            if (pts < 50) {
                document.getElementById('leave-pass-status').textContent = `휴가포인트가 부족합니다. (보유: ${pts}P / 필요: 50P)`;
                return;
            }
            STATE.currentUser.leavePoints = pts - 50;
            db.ref('users/' + STATE.currentUser.uid).update({ leavePoints: STATE.currentUser.leavePoints });
            document.getElementById('leave-points-display').textContent = STATE.currentUser.leavePoints;

            window.leavePassActive = true;
            showToast('🎫 외출증 발급! 5분간 이동속도 +30%', '#0d9488');
            document.getElementById('leave-pass-status').textContent = '✅ 외출증 사용 중... (5분간 이동속도 증가)';

            setTimeout(() => {
                window.leavePassActive = false;
                showToast('🎫 외출증 시간이 종료되었습니다. 복귀하십시오!', '#888888');
                const statusEl = document.getElementById('leave-pass-status');
                if (statusEl) statusEl.textContent = '';
            }, 5 * 60 * 1000);
        };

        document.getElementById('btn-leave-pass').onclick = () => {
            if (!STATE.currentUser) return;
            document.getElementById('leave-points-display').textContent = STATE.currentUser.leavePoints || 0;
            document.getElementById('leave-pass-status').textContent = window.leavePassActive ? '✅ 외출증 사용 중...' : '';
            document.getElementById('leave-modal').style.display = 'flex';
        };

        // ====================================================
        // SYSTEM E3: UNIT (부대) WEEKLY RANKING
        // ====================================================
        document.getElementById('btn-unit-ranking').onclick = () => {
            const modal = document.getElementById('unit-ranking-modal');
            const list = document.getElementById('unit-ranking-list');
            list.innerHTML = '<div style="color:#888; text-align:center; padding:20px;">데이터 로딩 중...</div>';
            modal.style.display = 'flex';

            const wk = getWeekKey();
            db.ref('users').once('value', snap => {
                const branchTotals = {};
                snap.forEach(c => {
                    const u = c.val();
                    if (!u.username || u.dashboardOnly) return;
                    const ws = u.weeklyStats;
                    if (!ws || ws.week !== wk) return;
                    const branch = u.branch || '소속없음';
                    branchTotals[branch] = (branchTotals[branch] || 0) + (ws.count || 0);
                });
                const entries = Object.entries(branchTotals).sort((a, b) => b[1] - a[1]);
                list.innerHTML = entries.map(([branch, count], i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const pos = medals[i] || `${i + 1}위`;
                    return `<div class="rank-item">
                        <div class="rank-pos">${pos}</div>
                        <div style="flex:1;">
                            <div style="font-weight:800;color:#fff;">${branch}</div>
                            <div style="font-size:0.8rem;color:#888;">이번 주 미션 완료 수</div>
                        </div>
                        <div style="font-weight:900;color:#fbbf24;">${count}건</div>
                    </div>`;
                }).join('') || '<div style="color:#888;text-align:center;padding:20px;">이번 주 데이터가 아직 없습니다.</div>';
            });
        };

        // ====================================================
        // SYSTEM F: MINIMAP
        // ====================================================
        document.getElementById('minimap').style.display = 'block';
        const minimapCanvas = document.getElementById('minimap-canvas');
        const mctx = minimapCanvas.getContext('2d');
        const MINIMAP_SCALE = 160 / 600; // world 600 -> 160px

        const drawMinimap = () => {
            mctx.clearRect(0, 0, 160, 160);
            mctx.fillStyle = 'rgba(0,20,0,0.8)'; mctx.fillRect(0, 0, 160, 160);

            // Buildings
            Object.values(LOCATIONS).forEach(loc => {
                const mx = 80 + loc.x * MINIMAP_SCALE;
                const my = 80 + loc.z * MINIMAP_SCALE;
                mctx.fillStyle = '#4b5320';
                mctx.fillRect(mx - 3, my - 3, 6, 6);
            });

            // Other players
            Object.values(otherPlayers).forEach(p => {
                if (!p.data) return;
                const mx = 80 + p.data.x * MINIMAP_SCALE;
                const my = 80 + p.data.z * MINIMAP_SCALE;
                mctx.fillStyle = '#3b82f6';
                mctx.beginPath(); mctx.arc(mx, my, 3, 0, Math.PI*2); mctx.fill();
            });

            // Self
            const sx = 80 + camera.position.x * MINIMAP_SCALE;
            const sy = 80 + camera.position.z * MINIMAP_SCALE;
            mctx.fillStyle = '#ef4444';
            mctx.beginPath(); mctx.arc(sx, sy, 4, 0, Math.PI*2); mctx.fill();
            // Direction indicator
            mctx.strokeStyle = '#ef4444'; mctx.lineWidth = 1.5;
            mctx.beginPath(); mctx.moveTo(sx, sy);
            mctx.lineTo(sx - Math.sin(camera.rotation.y) * 10, sy - Math.cos(camera.rotation.y) * 10);
            mctx.stroke();
        };
        setInterval(drawMinimap, 500);

        // 💰 머니 이벤트: 낙하 애니메이션 + 줍기 처리 (50ms tick)
        setInterval(() => {
            if (!window.moneyEventDrops || !window.moneyEventDrops.length) return;
            if (typeof camera === 'undefined' || typeof scene === 'undefined') return;

            for (let i = window.moneyEventDrops.length - 1; i >= 0; i--) {
                const drop = window.moneyEventDrops[i];
                if (drop.falling) {
                    drop.mesh.position.y -= 0.35;
                    drop.mesh.rotation.y += 0.1;
                    drop.mesh.rotation.x += 0.05;
                    if (drop.mesh.position.y <= drop.groundY) {
                        drop.mesh.position.y = drop.groundY;
                        drop.falling = false;
                    }
                } else {
                    drop.mesh.rotation.y += 0.05;
                }

                const dist = camera.position.distanceTo(drop.mesh.position);
                if (dist < 2.5 && STATE.currentUser && !STATE.currentUser.dashboardOnly) {
                    scene.remove(drop.mesh);
                    window.moneyEventDrops.splice(i, 1);
                    STATE.currentUser.money = (STATE.currentUser.money || 0) + drop.value;
                    if (db) db.ref('users/' + STATE.currentUser.uid + '/money').set(STATE.currentUser.money);
                    showToast(`💰 +${drop.value}G 획득!`, "#facc15");
                }
            }
        }, 50);

        // ====================================================
        // SYSTEM G: SALUTE (경례) + Walk distance tracking
        // ====================================================
        let lastCamPos = camera.position.clone();
        setInterval(() => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
            const dist = camera.position.distanceTo(lastCamPos);
            if (dist > 0.1) {
                trackMission('walkDist', dist);
                if (window.promoExamActive) {
                    window.promoDistanceRun = (window.promoDistanceRun || 0) + dist;
                    if (typeof updatePromoHUD === 'function') updatePromoHUD();
                }
                lastCamPos = camera.position.clone();
            }

            // Location-based daily missions: guard duty (위병소) & ammo supply (탄약고)
            const guardLoc = LOCATIONS['위병소'];
            const ammoLoc = LOCATIONS['탄약고'];
            if (guardLoc && camera.position.distanceTo(new THREE.Vector3(guardLoc.x, camera.position.y, guardLoc.z)) < 10) {
                trackMission('guardDuty', 2);
            }
            if (ammoLoc && camera.position.distanceTo(new THREE.Vector3(ammoLoc.x, camera.position.y, ammoLoc.z)) < 12) {
                trackMission('ammoSupply', 2);
            }

            // Auto-salute: check if higher-rank player is nearby
            let nearHigher = false;
            Object.values(otherPlayers).forEach(p => {
                if (!p.data) return;
                const d = camera.position.distanceTo(new THREE.Vector3(p.data.x, p.data.y, p.data.z));
                const myIdx = RANKS.indexOf(STATE.currentUser.rank);
                const theirIdx = RANKS.indexOf(p.data.rank);
                if (d < 8 && theirIdx > myIdx + 1) nearHigher = true;
            });
            if (nearHigher && !window._sluteShown) {
                window._sluteShown = true;
                showToast('🫡 상급자가 근처에 있습니다! (자동 경례)', '#deb887');
                changeDiscipline(1, '경례 완료');
                gainEXP(5, '경례');
            } else if (!nearHigher) window._sluteShown = false;
        }, 2000);

        // Show/Hide Mobile buttons based on context
        setInterval(() => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                document.getElementById('btn-view').style.display = 'block';
                document.getElementById('btn-voice').style.display = 'block';
                
                // Show vehicle button if near a vehicle
                const vehicles = [window.truckMesh, window.tankMesh, window.helicopterMesh, window.airplaneMesh];
                let nearAny = false;
                for(const v of vehicles) { 
                    if(v) {
                        const maxDist = (v === window.airplaneMesh || v === window.helicopterMesh) ? 22 : 15;
                        if (camera.position.distanceTo(v.position) < maxDist) nearAny = true; 
                    }
                }
                document.getElementById('btn-vehicle').style.display = (nearAny || window.inVehicle) ? 'block' : 'none';
            }
        }, 1000);

        if (typeof spawnAITargetBots === 'function') spawnAITargetBots();
        animate();
    };

    const setupPCControls = () => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        canvas.addEventListener('click', () => {
            const isMobile = /Mobi|Android|iPhone|iPad|PlayBook/i.test(navigator.userAgent);
            if (isMobile) return; 

            // Check if any modal is open
            const activeModals = Array.from(document.querySelectorAll('.big-modal, #vip-dress-modal, #guide-modal, #cabinet-modal')).some(el => el.style.display === 'flex' || el.style.display === 'block');
            
            // Skip pointer lock if inside a vehicle (so they can click dashboard switches) or if a modal is visible
            if (window.inVehicle || window.inHelicopter || activeModals) {
                return;
            }

            try {
                if (canvas && typeof canvas.requestPointerLock === 'function') {
                    canvas.requestPointerLock();
                }
            } catch (e) {
                console.warn("PointerLock request failed:", e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === canvas && typeof camera !== 'undefined' && camera) {
                camera.rotation.y -= e.movementX * 0.002;
                camera.rotation.x -= e.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
            }
        });
    };

    const setupMobileControls = () => {
        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) {
            const handleJumpStart = (e) => {
                if (e) e.preventDefault();
                keys[' '] = true;
            };
            const handleJumpEnd = () => {
                keys[' '] = false;
            };
            jumpBtn.addEventListener('touchstart', handleJumpStart, { passive: false });
            jumpBtn.addEventListener('touchend', handleJumpEnd);
            jumpBtn.addEventListener('mousedown', handleJumpStart);
            jumpBtn.addEventListener('mouseup', handleJumpEnd);
        }

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

    const handleWorldCollisions = (pos, oldPos) => {
        if (pos.y < -5) return; // Underground bypass
        const r = 0.8; // Player radius
        
        Object.entries(LOCATIONS).forEach(([name, data]) => {
            if (name === "연병장" || name === "유격장" || name === "사격장") return;
            
            const cx = data.x;
            const cz = data.z;
            const W = data.size[0];
            const H = data.size[1];
            const D = data.size[2];
            
            if (name === "위병소") {
                // Small solid booth on left side: x in [-4, 0], z in [-2, 2]
                const minX = cx - 4 - r;
                const maxX = cx - r;
                const minZ = cz - 2 - r;
                const maxZ = cz + 2 + r;
                
                if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
                    const distToLeft = Math.abs(pos.x - minX);
                    const distToRight = Math.abs(pos.x - maxX);
                    const distToBack = Math.abs(pos.z - minZ);
                    const distToFront = Math.abs(pos.z - maxZ);
                    const minDist = Math.min(distToLeft, distToRight, distToBack, distToFront);
                    
                    if (minDist === distToLeft) pos.x = minX;
                    else if (minDist === distToRight) pos.x = maxX;
                    else if (minDist === distToBack) pos.z = minZ;
                    else pos.z = maxZ;
                }
            } else if (name === "유류고") {
                // Two fuel tanks cylinder collisions
                const tankRadius = 3.0;
                const minDist = tankRadius + r;
                
                const checkTank = (tx, tz) => {
                    const dx = pos.x - tx;
                    const dz = pos.z - tz;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < minDist) {
                        const angle = Math.atan2(dz, dx);
                        pos.x = tx + Math.cos(angle) * minDist;
                        pos.z = tz + Math.sin(angle) * minDist;
                    }
                };
                checkTank(cx - W * 0.22, cz);
                checkTank(cx + W * 0.22, cz);
                
                // Low concrete wall collision
                const minZ = cz - D/2 - r;
                const maxZ = cz + D/2 + r;
                const minX = cx - W/2 - r;
                const maxX = cx + W/2 + r;
                if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
                    if (oldPos.z < cz - D/2) pos.z = minZ;
                    else if (oldPos.z > cz + D/2) pos.z = maxZ;
                }
            } else {
                // Standard buildings with front doorways (door at z = cz + D/2)
                let doorW = 4.0;
                if (name === "원수실") {
                    doorW = 6.0;
                }
                let doorMinX = cx - doorW / 2;
                let doorMaxX = cx + doorW / 2;
                
                if (name === "병영식당") {
                    const doorCx = cx - W * 0.2;
                    doorMinX = doorCx - doorW / 2;
                    doorMaxX = doorCx + doorW / 2;
                }
                
                const minX = cx - W / 2;
                const maxX = cx + W / 2;
                const minZ = cz - D / 2;
                const maxZ = cz + D / 2;
                
                const wasInside = (oldPos.x > minX && oldPos.x < maxX && oldPos.z > minZ && oldPos.z < maxZ);
                
                const innerMinX = minX + r;
                const innerMaxX = maxX - r;
                const innerMinZ = minZ + r;
                const innerMaxZ = maxZ - r;
                
                if (wasInside) {
                    // Keep player inside unless exiting through door
                    pos.x = Math.max(innerMinX, Math.min(innerMaxX, pos.x));
                    pos.z = Math.max(innerMinZ, pos.z);
                    
                    if (pos.x >= doorMinX && pos.x <= doorMaxX) {
                        // Allowed to exit
                    } else {
                        pos.z = Math.min(innerMaxZ, pos.z);
                    }
                } else {
                    // Prevent entering building except through front door
                    const isInside = (pos.x > minX - r && pos.x < maxX + r && pos.z > minZ - r && pos.z < maxZ + r);
                    if (isInside) {
                        const enteredThroughDoor = (oldPos.z > maxZ && pos.z <= maxZ && pos.x >= doorMinX && pos.x <= doorMaxX);
                        if (enteredThroughDoor) {
                            if (name === "원수실") {
                                const isMarshal = STATE.currentUser && (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수');
                                const hasCard = window.activeWeaponId === 'marshal_card';
                                if (!isMarshal || !hasCard) {
                                    // Block & push outside
                                    pos.z = maxZ + r;
                                    if (!window.lastMarshalDenyTime || Date.now() - window.lastMarshalDenyTime > 3000) {
                                        window.lastMarshalDenyTime = Date.now();
                                        showToast("🔒 원수실은 원수 키카드를 소지한 원수만 출입할 수 있습니다.", "#ff3333");
                                    }
                                    return;
                                }
                            }
                            if (name === "준장실 (한우주)") {
                                const isFriend = STATE.currentUser && (STATE.currentUser.username === '한Space' || STATE.currentUser.username === 'ree1203');
                                if (!isFriend) {
                                    // Block & push outside
                                    pos.z = maxZ + r;
                                    if (!window.lastFriendDenyTime || Date.now() - window.lastFriendDenyTime > 3000) {
                                        window.lastFriendDenyTime = Date.now();
                                        showToast("🔒 이 방은 준장 한우주(한Space) 대원의 전용 집무실입니다.", "#ff3333");
                                    }
                                    return;
                                }
                            }
                            if (name === "탈의실") {
                                const isMaster = STATE.currentUser && STATE.currentUser.username === 'ree1203';
                                if (!isMaster) {
                                    // Block & push outside
                                    pos.z = maxZ + r;
                                    if (!window.lastLockerDenyTime || Date.now() - window.lastLockerDenyTime > 3000) {
                                        window.lastLockerDenyTime = Date.now();
                                        showToast("🔒 이 방은 대장(ree1203) 전용 VIP 탈의실입니다.", "#ff3333");
                                    }
                                    return;
                                }
                            }
                            // Pass through door
                        } else {
                            // Block & push outside to closest wall
                            const distToLeft = Math.abs(pos.x - (minX - r));
                            const distToRight = Math.abs(pos.x - (maxX + r));
                            const distToBack = Math.abs(pos.z - (minZ - r));
                            const distToFront = Math.abs(pos.z - (maxZ + r));
                            const minDist = Math.min(distToLeft, distToRight, distToBack, distToFront);
                            
                            if (minDist === distToLeft) pos.x = minX - r;
                            else if (minDist === distToRight) pos.x = maxX + r;
                            else if (minDist === distToBack) pos.z = minZ - r;
                            else pos.z = maxZ + r;
                        }
                    }
                }
            }
        });
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const time = performance.now();
        if (isNaN(prevTime) || !prevTime) {
            prevTime = time - 16;
        }
        let delta = Math.min((time - prevTime) / 1000, 0.1);
        if (isNaN(delta) || delta <= 0) {
            delta = 0.016;
        }

        if (typeof window.updateBossAI === 'function') {
            window.updateBossAI();
        }
        if (typeof window.updateBossProjectiles === 'function') {
            window.updateBossProjectiles(delta);
        }
        if (typeof window.updateLootDrops === 'function') {
            window.updateLootDrops(delta);
        }
        if (typeof window.checkProximityInteractions === 'function') {
            window.checkProximityInteractions();
        }
        
        if (camera && (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z))) {
            camera.position.set(0, 1.6, 0);
            if (velocity) velocity.set(0, 0, 0);
        }
        
        // Rotate searchlights
        if (window.searchlights) {
            const timeSec = time / 1000;
            window.searchlights.forEach(light => {
                light.group.rotation.y = light.baseAngle + Math.sin(timeSec * light.speed) * 0.8;
            });
        }

        // Rotate orbiting space rocks for Creator boss Phase 2
        if (window.orbitingRocks && window.bossMesh) {
            const timeSec = time / 1000;
            window.orbitingRocks.forEach(rock => {
                const speed = rock.userData.speed;
                const angle = rock.userData.angle + timeSec * speed;
                const r = rock.userData.radius;
                rock.position.set(
                    Math.cos(angle) * r,
                    rock.userData.yOffset + Math.sin(timeSec * 2.0) * 0.2,
                    Math.sin(angle) * r
                );
                rock.rotation.x += 0.02;
                rock.rotation.y += 0.02;
            });
        }
        // Rotate orbiting space rocks for local player
        if (window.localPlayerBody && window.localPlayerBody.userData && window.localPlayerBody.userData.orbitingRocks) {
            const timeSec = time / 1000;
            window.localPlayerBody.userData.orbitingRocks.forEach(rock => {
                const speed = rock.userData.speed;
                const angle = rock.userData.angle + timeSec * speed;
                const r = rock.userData.radius;
                rock.position.set(
                    Math.cos(angle) * r,
                    rock.userData.yOffset + Math.sin(timeSec * 2.0) * 0.2,
                    Math.sin(angle) * r
                );
                rock.rotation.x += 0.02;
                rock.rotation.y += 0.02;
            });
        }
        // Rotate orbiting space rocks for other players
        Object.values(otherPlayers).forEach(p => {
            if (p.mesh && p.mesh.userData && p.mesh.userData.orbitingRocks) {
                const timeSec = time / 1000;
                p.mesh.userData.orbitingRocks.forEach(rock => {
                    const speed = rock.userData.speed;
                    const angle = rock.userData.angle + timeSec * speed;
                    const r = rock.userData.radius;
                    rock.position.set(
                        Math.cos(angle) * r,
                        rock.userData.yOffset + Math.sin(timeSec * 2.0) * 0.2,
                        Math.sin(angle) * r
                    );
                    rock.rotation.x += 0.02;
                    rock.rotation.y += 0.02;
                });
            }
        });

        // Slide shooting range targets
        if (window.shootingTargets) {
            const timeSec = time / 1000;
            window.shootingTargets.forEach(target => {
                if (!target.userData.hit) {
                    const speed = target.userData.speed || 1.5;
                    const baseX = target.userData.baseX || target.position.x;
                    target.position.x = baseX + Math.sin(timeSec * speed) * 2.5;
                }
            });
        }

        // Slide AI target bots
        if (window.aiTargetBots) {
            const timeSec = time / 1000;
            window.aiTargetBots.forEach(bot => {
                if (!bot.userData.hit) {
                    const speed = bot.userData.speed || 1.5;
                    const baseX = bot.userData.baseX || bot.position.x;
                    bot.position.x = baseX + Math.sin(timeSec * speed) * 3.5;
                } else {
                    bot.rotation.x += (Math.PI / 2 - bot.rotation.x) * 10 * delta;
                }
            });
        }

        // Apply Local Player Pose (Emotes)
        if (window.localPlayerBody) {
            window.applyPose(window.localPlayerBody, window.localPlayerPose || 'normal', time / 1000);
        }

        // Animate rocket booster flames and point lights for the local player and other players
        const timeSec = time / 1000;
        if (window.localPlayerBody) {
            const isCreator = (STATE.currentUser && STATE.currentUser.username === 'ree1203');
            const showFlame = Boolean(window.flightModeActive) || (isCreator && window.localPlayerBody.position.y > 0.2);
            window.localPlayerBody.traverse(child => {
                if (child.name === 'flame') {
                    child.visible = showFlame;
                    if (showFlame) {
                        const scale = 0.85 + Math.sin(timeSec * 25 + child.id) * 0.18;
                        child.scale.set(1, scale, 1);
                    }
                }
                if (child.name === 'thrustLight') {
                    child.intensity = showFlame ? (2.0 + Math.sin(timeSec * 20) * 0.5) : 0;
                }
            });
            const creatorNameplate = window.localPlayerBody.getObjectByName('creatorNameplate');
            if (creatorNameplate) creatorNameplate.visible = Boolean(window.isThirdPerson);
            const cosmicLight = window.localPlayerBody.getObjectByName('cosmicLight');
            if (cosmicLight) {
                cosmicLight.intensity = 2.0 + Math.sin(timeSec * 3.0) * 0.6;
            }
        }
        Object.values(otherPlayers).forEach(p => {
            if (p.mesh) {
                const isBoss = (p.mesh === window.bossMesh);
                const showFlame = isBoss || (p.mesh.userData.isCreator && p.mesh.position.y > 0.2);
                p.mesh.traverse(child => {
                    if (child.name === 'flame') {
                        child.visible = showFlame;
                        if (showFlame) {
                            const scale = 0.85 + Math.sin(timeSec * 25 + child.id) * 0.18;
                            child.scale.set(1, scale, 1);
                        }
                    }
                    if (child.name === 'thrustLight') {
                        child.intensity = showFlame ? (1.5 + Math.sin(timeSec * 20) * 0.3) : 0;
                    }
                });
                const cosmicLight = p.mesh.getObjectByName('cosmicLight');
                if (cosmicLight) {
                    cosmicLight.intensity = isBoss ? (3.0 + Math.sin(timeSec * 3.5) * 1.0) : (2.0 + Math.sin(timeSec * 3.0) * 0.6);
                }
            }
        });

        // Smooth weapon repositioning and camera FOV for ADS
        if (window.localWeapon && window.activeWeaponId) {
            const WEAPONS_POSITIONS = {
                'k2': { hip: [0.15, -0.15, -0.3], ads: [0, -0.08, -0.22] },
                'golden_k2': { hip: [0.15, -0.15, -0.3], ads: [0, -0.08, -0.22] },
                'k5': { hip: [0.12, -0.15, -0.2], ads: [0, -0.06, -0.15] },
                'k3': { hip: [0.15, -0.18, -0.35], ads: [0, -0.09, -0.25] },
                'k1a': { hip: [0.14, -0.14, -0.25], ads: [0, -0.07, -0.2] },
                'k14': { hip: [0.15, -0.13, -0.32], ads: [0, -0.065, -0.24] },
                'k6': { hip: [0.15, -0.2, -0.4], ads: [0, -0.1, -0.3] },
                'marshal_card': { hip: [0.15, -0.15, -0.3], ads: [0, -0.1, -0.25] }
            };
            const config = WEAPONS_POSITIONS[window.activeWeaponId] || { hip: [0.15, -0.15, -0.3], ads: [0, -0.08, -0.22] };
            const targetPos = window.isAdsMode ? config.ads : config.hip;
            
            window.localWeapon.position.x += (targetPos[0] - window.localWeapon.position.x) * 15 * delta;
            window.localWeapon.position.y += (targetPos[1] - window.localWeapon.position.y) * 15 * delta;
            window.localWeapon.position.z += (targetPos[2] - window.localWeapon.position.z) * 15 * delta;
            if (isNaN(window.localWeapon.position.x) || isNaN(window.localWeapon.position.y) || isNaN(window.localWeapon.position.z)) {
                window.localWeapon.position.set(targetPos[0], targetPos[1], targetPos[2]);
            }

            const targetFov = window.isAdsMode ? (window.activeWeaponId === 'k14' ? 20 : (window.hasAdvancedScope ? 12 : 45)) : 75;
            camera.fov += (targetFov - camera.fov) * 15 * delta;
            if (isNaN(camera.fov) || camera.fov <= 0 || camera.fov > 180) {
                camera.fov = 75;
            }
            camera.updateProjectionMatrix();
        }

        // Grenade power charging
        if (window.grenadeThrowingMode && window.grenadeCharging) {
            window.grenadePower = Math.min(1.0, window.grenadePower + delta * 1.5);
            const pFill = document.getElementById('grenade-power-fill');
            if (pFill) pFill.style.width = (window.grenadePower * 100) + '%';
        }

        // CBRN Gas Room Logic
        const inCbrnRoom = Math.abs(camera.position.x - (-120)) < 9.0 && Math.abs(camera.position.z - (-100)) < 9.0 && camera.position.y > 0;
        const cbrnHud = document.getElementById('cbrn-hud');
        if (cbrnHud) {
            cbrnHud.style.display = inCbrnRoom ? 'block' : 'none';
        }
        if (inCbrnRoom) {
            window.cbrnSurviveTimer = (window.cbrnSurviveTimer || 0) + delta;
            const gasHud = document.getElementById('cbrn-survive-hud');
            if (gasHud) gasHud.textContent = `🧪 가스실 생존 시간: ${Math.min(30, Math.floor(window.cbrnSurviveTimer))}초 / 30초`;
            if (window.cbrnSurviveTimer >= 30 && STATE.currentUser && !(STATE.currentUser.achievements || {})['gas_survivor']) {
                STATE.currentUser.money = (STATE.currentUser.money || 0) + 1000;
                db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                showToast('🧪 가스실 버티기 성공! (+1000G)', '#f59e0b');
                if (typeof unlockAchievement === 'function') unlockAchievement('gas_survivor');
            }
            if (window.hasGasMask) {
                window.gasMaskFilter = Math.max(0, window.gasMaskFilter - delta * 2.0);
                const filterPercent = document.getElementById('cbrn-filter-percent');
                const filterFill = document.getElementById('cbrn-filter-fill');
                if (filterPercent) filterPercent.textContent = Math.floor(window.gasMaskFilter);
                if (filterFill) filterFill.style.width = window.gasMaskFilter + '%';
                
                const actionPrompt = document.getElementById('cbrn-action-prompt');
                if (actionPrompt) {
                    actionPrompt.style.display = window.gasMaskFilter < 25 ? 'block' : 'none';
                }

                if (window.gasMaskFilter <= 0) {
                    window.STATS.hp = Math.max(0, window.STATS.hp - delta * 10);
                    if (typeof updateStatBars === 'function') updateStatBars();
                    if (window.STATS.hp <= 0) triggerLocalPlayerDeath("화생방 오염 가스 질식");
                }
            } else {
                window.STATS.hp = Math.max(0, window.STATS.hp - delta * 20);
                if (typeof updateStatBars === 'function') updateStatBars();
                if (window.STATS.hp <= 0) triggerLocalPlayerDeath("화생방 유독 가스 노출");
            }
        } else {
            window.cbrnSurviveTimer = 0;
        }

        // Patrol Mission Logic
        if (window.patrolActive) {
            let targetLoc = null;
            let targetName = "";
            if (window.patrolStep === 1) { targetLoc = {x: 0, z: 200}; targetName = "위병소"; }
            else if (window.patrolStep === 2) { targetLoc = {x: 120, z: 50}; targetName = "탄약고"; }
            else if (window.patrolStep === 3) { targetLoc = {x: 0, z: -100}; targetName = "본청"; }

            if (targetLoc) {
                const dist = Math.sqrt(Math.pow(camera.position.x - targetLoc.x, 2) + Math.pow(camera.position.z - targetLoc.z, 2));
                if (dist < 8.0) {
                    if (window.patrolStep === 3) {
                        window.patrolActive = false;
                        window.patrolStep = 0;
                        const rewardG = 1000;
                        const rewardExp = 150;
                        STATE.currentUser.money = (STATE.currentUser.money || 0) + rewardG;
                        db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                        gainEXP(rewardExp, "당직 순찰 완료");
                        showToast(`🏆 당직 순찰 완료! 포상금 ${rewardG}G 및 ${rewardExp} EXP 획득!`, "#10b981");
                        const pHud = document.getElementById('patrol-hud');
                        if (pHud) pHud.style.display = 'none';
                    } else {
                        window.patrolStep++;
                        let nextName = window.patrolStep === 2 ? "탄약고" : "본청";
                        showToast(`📍 ${targetName} 확인 완료! 다음 목적지: ${nextName}로 순찰을 계속하십시오.`, "#10b981");
                        window.updatePatrolHud();
                    }
                }
            }
        }

        // Obstacle Course Trigger
        if (!window.obstacleCourseActive && window.obstacleCourseCheckpoint === 0) {
            const distToStart = Math.sqrt(Math.pow(camera.position.x - (-100), 2) + Math.pow(camera.position.z - 30, 2));
            if (distToStart < 4.0) {
                window.startObstacleCourse();
            }
        }

        // Obstacle Course Logic
        if (window.obstacleCourseActive) {
            window.obstacleCourseTime += delta;
            const oTimeText = document.getElementById('obstacle-time');
            if (oTimeText) oTimeText.textContent = window.obstacleCourseTime.toFixed(2) + '초';
            
            if (window.obstacleCourseCheckpoint === 1) {
                const distToWall = Math.sqrt(Math.pow(camera.position.x - (-100), 2) + Math.pow(camera.position.z - 30, 2));
                if (distToWall < 4.0 && camera.position.y > 1.2) {
                    window.obstacleCourseCheckpoint = 2;
                    document.getElementById('obstacle-status').textContent = "진행 상태: 철조망 터널을 통과하십시오! (포복 필수)";
                    showToast("🧱 허들 격파 완료! 다음은 철조망 터널입니다. [/포복]으로 기어가세요!", "#10b981");
                }
            }
            else if (window.obstacleCourseCheckpoint === 2) {
                const inTunnel = Math.abs(camera.position.x - (-100)) < 4.0 && camera.position.z >= 45 && camera.position.z <= 55;
                if (inTunnel && window.localPlayerPose !== 'prone') {
                    camera.position.set(-100, camera.position.y, 42);
                    showToast("⚠️ 몸을 웅크리십시오! (철조망 통과 시 포복 필수)", "#ff3333");
                } else if (camera.position.z > 56 && Math.abs(camera.position.x - (-100)) < 5.0) {
                    window.obstacleCourseCheckpoint = 3;
                    document.getElementById('obstacle-status').textContent = "진행 상태: 징검다리를 신속히 건너십시오!";
                    showToast("🕸️ 철조망 터널 통과 완료! 마지막 징검다리 코스로 가십시오!", "#10b981");
                }
            }
            else if (window.obstacleCourseCheckpoint === 3) {
                const distToFinish = Math.sqrt(Math.pow(camera.position.x - (-100), 2) + Math.pow(camera.position.z - 72, 2));
                if (distToFinish < 4.0) {
                    window.obstacleCourseActive = false;
                    window.obstacleCourseCheckpoint = 0;
                    
                    const rewardG = 800;
                    const rewardExp = 200;
                    STATE.currentUser.money = (STATE.currentUser.money || 0) + rewardG;
                    db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                    gainEXP(rewardExp, "유격 장애물 코스 완주");
                    
                    showToast(`🏆 장애물 코스 완주! 기록: ${window.obstacleCourseTime.toFixed(2)}초! (+${rewardG}G, +${rewardExp} EXP)`, "#10b981");
                    
                    const oHud = document.getElementById('obstacle-hud');
                    if (oHud) oHud.style.display = 'none';
                }
            }
        }
        
        if (window.isCctvActive) {
            prevTime = time;
            if (typeof TWEEN !== 'undefined' && TWEEN) {
                TWEEN.update();
            }
            renderer.render(scene, camera);
            return;
        }

        const oldPos = camera.position.clone();

        // Marshal's Office Automatic Door Y position sliding
        if (window.marshalDoorMesh && LOCATIONS["원수실"]) {
            const marshalLoc = LOCATIONS["원수실"];
            const doorZ = marshalLoc.z + marshalLoc.size[2] / 2;
            const dx = camera.position.x - marshalLoc.x;
            const dz = camera.position.z - doorZ;
            const distToDoor = Math.sqrt(dx * dx + dz * dz);
            
            const isMarshal = STATE.currentUser && (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수');
            const hasCard = window.activeWeaponId === 'marshal_card';
            
            if (distToDoor < 6.0 && isMarshal && hasCard) {
                const targetY = marshalLoc.size[1] * 1.2;
                window.marshalDoorMesh.position.y += (targetY - window.marshalDoorMesh.position.y) * 8 * delta;
            } else {
                const targetY = (marshalLoc.size[1] * 0.7) / 2;
                window.marshalDoorMesh.position.y += (targetY - window.marshalDoorMesh.position.y) * 8 * delta;
            }
        }

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        if (window.lightningStunActive || window.isLocalPlayerDead) {
            // Player is stunned by lightning or dead, do not allow inputs
        } else {
            if (joystickActive) {
                // Reverse signs to match intuitive movement (Up is Forward, Down is Back)
                velocity.z += joystickOffset.y * 400.0 * delta;
                velocity.x += joystickOffset.x * 400.0 * delta;
            }

            // Keyboard Support & Flight Logic
            const drivingAirVehicle = window.inHelicopter || (window.inVehicle && (window.currentVehicle === window.airplaneMesh || window.currentVehicle === window.helicopterMesh));
            if (drivingAirVehicle) {
                if (window.flightEngineOn) {
                    const flapsSpeedBonus = window.flightFlaps === 15 ? 1.25 : window.flightFlaps === 30 ? 0.75 : 1.0;
                    if (keys['KeyW'] || keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 1000.0 * delta * flapsSpeedBonus;
                    if (keys['KeyS'] || keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 800.0 * delta;
                    if (keys['KeyA'] || keys['a'] || keys['A'] || keys['ArrowLeft']) camera.rotation.y += 1.5 * delta;
                    if (keys['KeyD'] || keys['d'] || keys['D'] || keys['ArrowRight']) camera.rotation.y -= 1.5 * delta;
                    if (keys['KeyQ'] || keys['q'] || keys['Q']) camera.position.y += 20 * delta * flapsSpeedBonus;
                    if (keys['KeyE'] || keys['e'] || keys['E']) camera.position.y -= 20 * delta;
                } else {
                    // Engine is OFF: fall down to ground level
                    if (camera.position.y > 1.8) {
                        camera.position.y = Math.max(1.8, camera.position.y - 15 * delta);
                    }
                    if (keys['KeyA'] || keys['a'] || keys['A'] || keys['ArrowLeft']) camera.rotation.y += 0.8 * delta;
                    if (keys['KeyD'] || keys['d'] || keys['D'] || keys['ArrowRight']) camera.rotation.y -= 0.8 * delta;
                }
            } else {
                let speedScale = window.bossSpeedDebuffActive ? 0.4 : 1.0;
                if (window.localPlayerPose === 'prone') speedScale *= 0.25;
                if (window.localPlayerPose === 'sit') speedScale *= 0.0;
                if (window.leavePassActive) speedScale *= 1.3;
                
                if (keys['KeyW'] || keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 400.0 * delta * speedScale;
                if (keys['KeyS'] || keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 400.0 * delta * speedScale;
                if (keys['KeyA'] || keys['a'] || keys['A'] || keys['ArrowLeft']) velocity.x -= 400.0 * delta * speedScale;
                if (keys['KeyD'] || keys['d'] || keys['D'] || keys['ArrowRight']) velocity.x += 400.0 * delta * speedScale;
            }
        }

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();

        // Jail Logic
        const dx = camera.position.x - JAIL_CONFIG.pos.x;
        const dz = camera.position.z - JAIL_CONFIG.pos.z;
        const isJailed = STATE.currentUser && STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now();

        if (isJailed) {
            // Enforce Jail Boundaries
            const limit = (JAIL_CONFIG.size / 2) - 0.5;

            if (Math.abs(dx) > limit || Math.abs(dz) > limit || camera.position.y > JAIL_CONFIG.pos.y + 4) {
                // Teleport back inside if trying to escape or just logged in
                camera.position.set(JAIL_CONFIG.pos.x, JAIL_CONFIG.pos.y + 1.6, JAIL_CONFIG.pos.z);
            }

            camera.position.addScaledVector(forward, -velocity.z * delta);
            const right = new THREE.Vector3(-forward.z, 0, forward.x);
            camera.position.addScaledVector(right, velocity.x * delta);

            // Clamp again after move
            camera.position.x = Math.max(JAIL_CONFIG.pos.x - limit, Math.min(JAIL_CONFIG.pos.x + limit, camera.position.x));
            camera.position.z = Math.max(JAIL_CONFIG.pos.z - limit, Math.min(JAIL_CONFIG.pos.z + limit, camera.position.z));
            camera.position.y = JAIL_CONFIG.pos.y + 1.6;
        } else {
            // Normal Movement
            camera.position.addScaledVector(forward, -velocity.z * delta);
            const right = new THREE.Vector3(-forward.z, 0, forward.x);
            camera.position.addScaledVector(right, velocity.x * delta);

            // Prevent normal users from entering the jail cell (Collision)
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

            // Apply building collisions (unless flying in a helicopter/airplane)
            if (!(window.inHelicopter || (window.inVehicle && (window.currentVehicle === window.helicopterMesh || window.currentVehicle === window.airplaneMesh)))) {
                handleWorldCollisions(camera.position, oldPos);
            }

            // Proximity to Marshal's Office ladder (centered at x: 0, z: -162.4)
            const nearLadder = Math.abs(camera.position.x) < 2.0 && Math.abs(camera.position.z - (-162.4)) < 2.0;

            // Gravity/Floor Check
            let floorHeight = 0;

            // Calculate mountain height dynamically based on distance to (-250, -250)
            const mx = camera.position.x - (-250);
            const mz = camera.position.z - (-250);
            const mDist = Math.sqrt(mx * mx + mz * mz);
            if (mDist < 150) {
                floorHeight = 60 * Math.cos((mDist / 150) * (Math.PI / 2));
            }

            // Staircase collision check
            if (Math.abs(dx) < 5 && dz > 0 && dz < 40) {
                floorHeight = (-dz * 0.5);
            } else if (camera.position.y < -30 && Math.abs(camera.position.x) < 20 && Math.abs(camera.position.z + 150) < 20) {
                // Underground bunker floor level
                floorHeight = -40;
            } else if (camera.position.y < -10 || (Math.abs(dx) < 20 && Math.abs(dz) < 20 && camera.position.y < 0)) {
                floorHeight = JAIL_CONFIG.pos.y;
            }

            let eyeHeight = 1.6;
            if (window.localPlayerPose === 'prone') eyeHeight = 0.4;
            else if (window.localPlayerPose === 'sit') eyeHeight = 0.9;
            let floorY = floorHeight + eyeHeight;

            // Spacebar jump trigger (only if on ground and not in a vehicle)
            if ((keys[' '] || keys['Space']) && !window.inVehicle) {
                if (camera.position.y <= floorY + 0.05) {
                    velocity.y = 8.0; // Jump impulse velocity
                }
            }

            // Apply vertical velocity
            if (window.flightModeActive) {
                let flySpeed = 15.0;
                if (keys[' '] || keys['Space']) camera.position.y += flySpeed * delta;
                if (keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']) camera.position.y -= flySpeed * delta;
                velocity.y = 0;
            } else if (nearLadder) {
                velocity.y = 0;
                let climbSpeed = 8.0;
                if (keys['KeyW'] || keys['w'] || keys['W'] || keys['ArrowUp'] || (joystickActive && joystickOffset.y < -0.2)) {
                    camera.position.y += climbSpeed * delta;
                }
                if (keys['KeyS'] || keys['s'] || keys['S'] || keys['ArrowDown'] || (joystickActive && joystickOffset.y > 0.2)) {
                    camera.position.y -= climbSpeed * delta;
                }
                camera.position.y = Math.max(floorY, Math.min(13.6, camera.position.y));
            } else {
                camera.position.y += velocity.y * delta;

                if (window.inHelicopter) {
                    floorY = 2.0; // Minimum altitude for heli
                    if (camera.position.y < floorY) {
                        camera.position.y = floorY;
                        velocity.y = 0;
                    }
                } else {
                    if (camera.position.y > floorY) {
                        velocity.y -= 25.0 * delta; // Smooth gravity deceleration
                    } else {
                        // Fall damage / death check when landing with high velocity
                        if (velocity.y < -10.0 && !window.godModeActive && !window.isLocalPlayerDead) {
                            camera.position.y = floorY;
                            const fallSpeed = -velocity.y;
                            velocity.y = 0;
                            
                            if (fallSpeed >= 18.0) {
                                triggerLocalPlayerDeath("낙하 및 추락");
                                showToast("💀 낙하 충격으로 인해 전사하셨습니다!", "#ff0000");
                            } else {
                                const fallDamage = Math.round((fallSpeed - 10) * 12);
                                window.STATS.hp = Math.max(0, window.STATS.hp - fallDamage);
                                if (typeof updateStatBars === 'function') updateStatBars();
                                
                                if (typeof playGruntSound === 'function') playGruntSound();
                                showToast(`🦴 높은 곳에서 떨어져 다리가 골절되었습니다! (-${fallDamage} HP)`, "#ff3333");
                                
                                if (window.STATS.hp <= 0) {
                                    triggerLocalPlayerDeath("추락 부상 악화");
                                } else {
                                    const ind = document.getElementById('damage-indicator');
                                    const flash = document.getElementById('damage-flash-indicator');
                                    if (ind && flash) {
                                        flash.style.boxShadow = `inset 0 -35px 80px rgba(239, 68, 68, 0.95)`;
                                        flash.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                        ind.style.display = 'block';
                                        ind.style.opacity = '1';
                                        setTimeout(() => {
                                            ind.style.opacity = '0';
                                            setTimeout(() => { ind.style.display = 'none'; }, 250);
                                        }, 800);
                                    }
                                }
                            }
                        } else {
                            camera.position.y = floorY;
                            velocity.y = 0; // Landed
                        }
                    }
                }
            }
        }

        // Sync Ground & Air Vehicle Mesh with Camera if driving
        if (window.inVehicle && window.currentVehicle) {
            const v = window.currentVehicle;
            const isAir = (v === window.helicopterMesh || v === window.airplaneMesh);
            v.position.set(camera.position.x, isAir ? camera.position.y - 2 : 0, camera.position.z);
            v.rotation.y = camera.rotation.y;
            
            if (v === window.helicopterMesh) {
                if (window.flightEngineOn) {
                    if (window.heliRotor) window.heliRotor.rotation.y += 20 * delta;
                    if (window.heliTailRotor) window.heliTailRotor.rotation.x += 20 * delta;
                }
            } else if (v === window.airplaneMesh) {
                if (window.flightEngineOn && v.userData.propeller) {
                    v.userData.propeller.rotation.z += 30 * delta;
                }
            }

            // Sync to Firebase
            if (STATE.currentUser && STATE.currentUser.uid) {
                db.ref('vehicles/' + v.userData.id).set({
                    x: v.position.x, y: v.position.y, z: v.position.z,
                    ry: v.rotation.y,
                    driver: STATE.currentUser.name || "신병",
                    timestamp: Date.now()
                });
            }
        } else {
            // Idle animations for non-driven vehicles
            if (window.helicopterMesh && window.heliRotor) {
                window.heliRotor.rotation.y += 0.5 * delta;
                window.heliTailRotor.rotation.x += 0.5 * delta;
            }
            if (window.airplaneMesh && window.airplaneMesh.userData.propeller) {
                window.airplaneMesh.userData.propeller.rotation.z += 0.5 * delta;
            }
        }

        // CCTV Camera Spectator Override
        if (window.cctvTargetUid && otherPlayers[window.cctvTargetUid]) {
            const targetMesh = otherPlayers[window.cctvTargetUid].mesh;
            const targetPos = targetMesh.position;
            camera.position.set(
                targetPos.x - Math.sin(targetMesh.rotation.y) * 6,
                targetPos.y + 3.5,
                targetPos.z - Math.cos(targetMesh.rotation.y) * 6
            );
            camera.lookAt(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z));
        }


        prevTime = time;

        // Multiplayer Sync - Throttled to 200ms intervals to reduce Firebase writes
        const now = Date.now();
        if (!window.lastPresenceWriteTime) window.lastPresenceWriteTime = 0;
        if (now - window.lastPresenceWriteTime > 200) {
            window.lastPresenceWriteTime = now;
            if (STATE.currentUser && STATE.currentUser.uid && !STATE.currentUser.dashboardOnly) {
                const localIsJailed = Boolean(STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now());
                db.ref('presence/' + STATE.currentUser.uid).set({
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z,
                    ry: camera.rotation.y,
                    name: STATE.currentUser.name || "신병",
                    rank: STATE.currentUser.rank || "이등병",
                    isJailed: localIsJailed,
                    isDead: Boolean(window.isLocalPlayerDead),
                    isStealth: Boolean(window.activeBuffs && window.activeBuffs.invisibleName > Date.now()),
                    isDressUniform: Boolean(window.isDressUniform),
                    isGasMask: Boolean(window.hasGasMask),
                    pose: window.localPlayerPose || 'normal',
                    activeSkin: window.activeSkin || 'normal',
                    username: STATE.currentUser.username || "",
                    lastSeen: Date.now()
                });

                // Update Local Player Body Color for 3rd Person View
                if (window.localPlayerBody) {
                    window.refreshPlayerSkin(window.localPlayerBody, window.activeSkin, STATE.currentUser.rank, localIsJailed);
                    
                    // Update local gas mask visibility
                    window.localPlayerBody.traverse(child => {
                        if (child.userData.isGasMaskPart) {
                            child.visible = Boolean(window.hasGasMask);
                        }
                    });
                }
            }
        }

        // ====================================================
        // VIP DRESSING ROOM UNIFORM CHANGE LOGIC
        // ====================================================
        const inDressingRoom = Math.abs(camera.position.x - 60) < 6.5 && Math.abs(camera.position.z - (-150)) < 6.5 && camera.position.y > 0;
        if (inDressingRoom && STATE.currentUser && STATE.currentUser.username === 'ree1203') {
            if (!window.inDressingRoomAlert) {
                window.inDressingRoomAlert = true;
                showToast("👚 VIP 탈의실에 입장했습니다. [E] 키를 눌러 피복 변경 메뉴를 여십시오!", "#8b5cf6");
            }
            if (keys['KeyE'] || keys['e'] || keys['E']) {
                if (!window.lastDressChangeTime || Date.now() - window.lastDressChangeTime > 500) {
                    window.lastDressChangeTime = Date.now();
                    const vdm = document.getElementById('vip-dress-modal');
                    if (vdm) {
                        vdm.style.display = 'flex';
                        const css = document.getElementById('creator-skins-section');
                        if (css) {
                            css.style.display = (STATE.currentUser && STATE.currentUser.username === 'ree1203') ? 'flex' : 'none';
                        }
                    }
                    keys['KeyE'] = false; keys['e'] = false; keys['E'] = false;
                }
            }
        } else {
            window.inDressingRoomAlert = false;
        }

        // ====================================================
        // MEDICAL BED HEALING LOGIC
        // ====================================================
        let nearBed = null;
        if (window.medicalBeds) {
            for (const bed of window.medicalBeds) {
                const dist = Math.sqrt(Math.pow(camera.position.x - bed.x, 2) + Math.pow(camera.position.z - bed.z, 2));
                if (dist < 2.0 && camera.position.y < 3.0) {
                    nearBed = bed;
                    break;
                }
            }
        }

        if (nearBed) {
            if (!window.currentHealingBed) {
                if (window.STATS.hp >= 100) {
                    if (!window.lastHpFullAlert || Date.now() - window.lastHpFullAlert > 5000) {
                        showToast("💚 이미 체력이 100%입니다. 치료할 필요가 없습니다.", "#10b981");
                        window.lastHpFullAlert = Date.now();
                    }
                } else {
                    if (!window.nearBedAlert) {
                        window.nearBedAlert = true;
                        showToast(`🏥 의무대 침대 ${nearBed.id}번 발견! [E] 키를 눌러 누워서 수액 치료를 받으십시오.`, "#ef4444");
                    }
                }
            }
            
            if (keys['KeyE'] || keys['e'] || keys['E']) {
                if (!window.lastBedUseTime || Date.now() - window.lastBedUseTime > 500) {
                    window.lastBedUseTime = Date.now();
                    keys['KeyE'] = false; keys['e'] = false; keys['E'] = false;
                    
                    if (window.currentHealingBed) {
                        window.currentHealingBed = null;
                        window.localPlayerPose = 'normal';
                        camera.position.y = 1.75;
                        showToast("🚶 수액 치료를 중단하고 침대에서 일어났습니다.", "#f59e0b");
                    } else {
                        if (window.STATS.hp >= 100) {
                            showToast("💚 이미 체력이 100%입니다.", "#10b981");
                        } else {
                            window.currentHealingBed = nearBed;
                            window.localPlayerPose = 'prone';
                            camera.position.set(nearBed.x, 0.9, nearBed.z);
                            showToast(`💉 침대 ${nearBed.id}번에 누워 수액 치료를 받기 시작합니다... (초당 +10 HP)`, "#10b981");
                        }
                    }
                }
            }
        } else {
            window.nearBedAlert = false;
            if (window.currentHealingBed) {
                window.currentHealingBed = null;
                window.localPlayerPose = 'normal';
            }
        }

        if (window.currentHealingBed) {
            camera.position.set(window.currentHealingBed.x, 0.9, window.currentHealingBed.z);
            
            if (!window.lastHealTick || Date.now() - window.lastHealTick > 1000) {
                window.lastHealTick = Date.now();
                if (window.STATS.hp < 100) {
                    window.STATS.hp = Math.min(100, window.STATS.hp + 10);
                    showToast(`💉 수액 투여 중... 현재 체력: ${Math.floor(window.STATS.hp)}/100`, "#10b981");
                    
                    if (typeof createHealingParticles === 'function') {
                        createHealingParticles(camera.position);
                    }

                    if (window.STATS.hp >= 100) {
                        window.currentHealingBed = null;
                        window.localPlayerPose = 'normal';
                        camera.position.y = 1.75;
                        showToast("💖 체력이 완전히 회복되었습니다! 수액 주사를 제거하고 퇴원합니다.", "#10b981");
                    }
                }
            }
        }

        // ====================================================
        // TACTICAL MARCH COURSE MISSION LOGIC
        // ====================================================
        if (window.marchActive) {
            const checkpoints = [
                { x: -130, z: -130 }, // Checkpoint 1
                { x: -170, z: -170 }, // Checkpoint 2
                { x: -210, z: -210 }, // Checkpoint 3
                { x: -250, z: -250 }  // Checkpoint 4 (Peak)
            ];
            
            // Highlight current target marker in green
            if (window.marchMarkers && window.marchMarkers.length > 0) {
                for (let i = 0; i < 4; i++) {
                    const cylIdx = i * 2;
                    const flagIdx = i * 2 + 1;
                    const cyl = window.marchMarkers[cylIdx];
                    const flag = window.marchMarkers[flagIdx];
                    if (cyl && flag) {
                        const isCurrent = (i + 1) === window.marchStep;
                        cyl.material.color.setHex(isCurrent ? 0x00ff00 : 0xffa500);
                        flag.material.color.setHex(isCurrent ? 0x00ff00 : 0xff0000);
                    }
                }
            }
            
            // Check distance to current checkpoint
            const currentCp = checkpoints[window.marchStep - 1];
            if (currentCp) {
                const distToCp = Math.sqrt(
                    Math.pow(camera.position.x - currentCp.x, 2) +
                    Math.pow(camera.position.z - currentCp.z, 2)
                );
                
                if (distToCp < 12.0) {
                    if (window.marchStep === 4) {
                        // Success! Reached the mountain peak
                        window.marchActive = false;
                        window.marchStep = 0;
                        
                        const mHud = document.getElementById('march-hud');
                        if (mHud) mHud.style.display = 'none';
                        
                        // Clean up markers
                        if (window.marchMarkers) {
                            window.marchMarkers.forEach(m => scene.remove(m));
                            window.marchMarkers = [];
                        }
                        
                        // Rewards
                        const rewardG = 2500;
                        const rewardExp = 500;
                        STATE.currentUser.money = (STATE.currentUser.money || 0) + rewardG;
                        db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                        gainEXP(rewardExp, "전술 행군 완주");
                        
                        showToast(`🏆 산 정복 완료! 행군 완주 성공! (+${rewardG}G, +${rewardExp} EXP)`, "#22c55e");
                        alert(`🥾 [전술 행군 완주 성공]\n\n고도 60m의 험준한 산악 고지를 완벽히 점령하셨습니다!\n지휘관 포상금: ${rewardG}G\n경험치: ${rewardExp} EXP`);
                    } else {
                        // Advance to next checkpoint
                        window.marchStep++;
                        showToast(`📍 행군 ${window.marchStep - 1}단계 지점 돌파! 계속 고도를 높이십시오.`, "#deb887");
                        window.updateMarchHud();
                    }
                }
            }
        }

        // ====================================================
        // RUNNING COURSE TIME TRIAL LOGIC
        // ====================================================
        if (typeof window.runTrialActive === 'undefined') {
            window.runTrialActive = false;
            window.runTrialCheckpoint = 0; // 0 = not started, 1-4 = checkpoint index to tag, 5 = head to finish
            window.runTrialStartTime = 0;
        }

        // Distance check to Start/Finish Gate at x: 0, z: 45
        const distToStartGate = camera.position.distanceTo(new THREE.Vector3(0, camera.position.y, 45));

        const updateCheckpointVisuals = (activeIdx) => {
            if (!window.runCheckpoints) return;
            window.runCheckpoints.forEach((cyl, idx) => {
                const isCurrentTarget = (idx + 1) === activeIdx;
                cyl.material.color.setHex(isCurrentTarget ? 0x00ff00 : 0xff0000);
                
                // Update label text color dynamically
                const lctx = cyl.userData.labelCtx;
                lctx.fillStyle = 'rgba(0,0,0,0.6)'; lctx.fillRect(0,0,64,64);
                lctx.fillStyle = isCurrentTarget ? '#00ff00' : '#ff0000';
                lctx.font = 'bold 36px Arial'; lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
                lctx.fillText(idx + 1, 32, 32);
                cyl.userData.labelSprite.material.map.needsUpdate = true;
            });
            const chpText = activeIdx === 5 ? "🏁 결승선 복귀" : activeIdx === 0 ? "대기 중" : `📍 ${activeIdx}번 지점`;
            const hudChp = document.getElementById('running-hud-checkpoint');
            if (hudChp) hudChp.textContent = chpText;
        };

        if (!window.runTrialActive && distToStartGate < 4.0 && window.runTrialCheckpoint === 0) {
            // Start!
            window.runTrialActive = true;
            window.runTrialCheckpoint = 1;
            window.runTrialStartTime = Date.now();
            showToast("🏃 달리기 측정이 시작되었습니다! 1번 체크포인트로 가십시오!", "#00ff00");
            const hud = document.getElementById('running-trial-hud');
            if (hud) hud.style.display = 'block';
            updateCheckpointVisuals(1);
        } else if (window.runTrialActive) {
            const elapsed = ((Date.now() - window.runTrialStartTime) / 1000).toFixed(2);
            const hudTime = document.getElementById('running-hud-time');
            if (hudTime) hudTime.textContent = `${elapsed}s`;

            if (window.checkPointsLoc && window.runTrialCheckpoint >= 1 && window.runTrialCheckpoint <= 4) {
                const targetLoc = window.checkPointsLoc[window.runTrialCheckpoint - 1];
                const distToTarget = camera.position.distanceTo(new THREE.Vector3(targetLoc.x, camera.position.y, targetLoc.z));
                if (distToTarget < 5.0) {
                    if (window.runTrialCheckpoint === 4) {
                        window.runTrialCheckpoint = 5;
                        showToast("🏁 모든 체크포인트 완료! 시작/결승선으로 돌아오십시오!", "#00ff00");
                        updateCheckpointVisuals(5);
                    } else {
                        window.runTrialCheckpoint++;
                        showToast(`📍 체크포인트 ${window.runTrialCheckpoint - 1} 완료! 다음 지점으로!`, "#00ff00");
                        updateCheckpointVisuals(window.runTrialCheckpoint);
                    }
                }
            }
        } else if (window.runTrialCheckpoint === 5 && distToStartGate < 4.0) {
            // Finish!
            window.runTrialActive = false;
            window.runTrialCheckpoint = 0;
            const finalTime = ((Date.now() - window.runTrialStartTime) / 1000).toFixed(2);
            showToast(`🏁 완주 성공! 최종 기록: ${finalTime}초`, "#00ff00");
            alert(`🏃 [달리기 완주 기록]\n최종 시간: ${finalTime}초!`);
            const hud = document.getElementById('running-trial-hud');
            if (hud) hud.style.display = 'none';
            updateCheckpointVisuals(0);
        }

        // Smooth interpolation of other players (runs every frame for fluid movement)
        lerpOtherPlayers();

        // Update TWEEN animations if loaded
        if (typeof TWEEN !== 'undefined' && TWEEN) {
            TWEEN.update();
        }

        renderer.render(scene, window.isThirdPerson ? window.thirdPersonCamera : camera);
    };

    // Shared presence data (window scope so startGame listeners and init3D closures share the same object)
    window.allPlayersData = {};

    const triggerLocalPlayerDeath = (shooterName) => {
        if (typeof camera === 'undefined' || !camera) return;
        if (window.isLocalPlayerDead) return;
        window.isLocalPlayerDead = true;
        window.STATS.hp = 0;
        if (typeof updateStatBars === 'function') updateStatBars();

        if (typeof window.pushKillFeed === 'function') {
            const wepName = window.activeWeaponId ? (WEAPONS_CONFIG[window.activeWeaponId] ? WEAPONS_CONFIG[window.activeWeaponId].name : "전투") : "전투";
            window.pushKillFeed(shooterName || "자연", STATE.currentUser.name || "신병", wepName);
        }

        if (db && STATE.currentUser && STATE.currentUser.uid) {
            db.ref('users/' + STATE.currentUser.uid + '/deaths').transaction(current => (current || 0) + 1);
            if (shooterName && shooterName !== "낙하 및 추락" && shooterName !== "한파 및 동사" && shooterName !== "추락 부상 악화") {
                let shooterUid = null;
                Object.keys(window.allPlayersData).forEach(uid => {
                    if (window.allPlayersData[uid].name === shooterName) {
                        shooterUid = uid;
                    }
                });
                if (shooterUid) {
                    db.ref('users/' + shooterUid + '/kills').transaction(current => (current || 0) + 1);
                }
            }
        }

        // Exit vehicle if driving
        if (window.inVehicle) {
            window.inVehicle = false;
            if (window.currentVehicle) {
                window.currentVehicle.userData.label.visible = true;
            }
            window.currentVehicle = null;
            const vehHud = document.getElementById('vehicle-hud');
            if (vehHud) vehHud.style.display = 'none';
        }
        if (window.inHelicopter) {
            window.inHelicopter = false;
        }

        // Show glassmorphic red death screen overlay
        const deathOverlay = document.createElement('div');
        deathOverlay.id = 'death-overlay';
        deathOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(139,0,0,0.85); backdrop-filter:blur(10px); display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:Pretendard, sans-serif; z-index:10000; transition: opacity 0.5s;';
        deathOverlay.innerHTML = `
            <h1 style="font-size:3.5rem; font-weight:900; margin-bottom:10px; text-shadow:0 0 20px rgba(0,0,0,0.8); animation: blink 1s infinite;">🚨 전사 (KILLED IN ACTION)</h1>
            <p style="font-size:1.5rem; margin-bottom:20px; color:#ddd;">${shooterName}님의 총에 맞아 전사하였습니다.</p>
            <div id="respawn-timer" style="font-size:1.8rem; font-weight:bold; color:#ffcc00; background:rgba(0,0,0,0.5); padding:10px 30px; border-radius:10px; border:1px solid rgba(255,255,255,0.2); margin-bottom:20px;">5초 후 부활합니다...</div>
            <button id="ad-revive-btn" style="background:#f59e0b; color:black; font-weight:bold; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-size:1.2rem; box-shadow:0 0 15px rgba(245,158,11,0.5); transition:0.2s; font-family:'Pretendard', sans-serif;">📺 광고 보고 제자리 즉시 부활</button>
        `;
        document.body.appendChild(deathOverlay);

        // Drop K2 weapon on death
        window.hasK2 = false;
        if (window.localWeapon) window.localWeapon.visible = false;
        const crosshair = document.getElementById('crosshair');
        if (crosshair) crosshair.style.display = 'none';

        // Write immediate isDead to Firebase presence
        if (db && STATE.currentUser && STATE.currentUser.uid) {
            const localIsJailed = Boolean(STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now());
            db.ref('presence/' + STATE.currentUser.uid).set({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                ry: camera.rotation.y,
                name: STATE.currentUser.name || "신병",
                rank: STATE.currentUser.rank || "이등병",
                isJailed: localIsJailed,
                isDead: true,
                lastSeen: Date.now()
            });
        }

        // Push blood splat coordinates to Firebase
        if (db) {
            db.ref('blood_splats').push({
                x: camera.position.x,
                y: 0.05,
                z: camera.position.z,
                time: Date.now()
            });
        }

        // Start countdown to respawn
        let countdown = 5;
        const interval = setInterval(() => {
            countdown--;
            const timerDiv = document.getElementById('respawn-timer');
            if (timerDiv) {
                timerDiv.textContent = `${countdown}초 후 부활합니다...`;
            }
            if (countdown <= 0) {
                clearInterval(interval);
                respawnPlayer();
            }
        }, 1000);

        // Hook up Ad Revive Button
        const adBtn = deathOverlay.querySelector('#ad-revive-btn');
        if (adBtn) {
            adBtn.onclick = () => {
                clearInterval(interval); // Stop normal countdown
                window.showRewardedAd('revive', (success) => {
                    if (success) {
                        respawnPlayerInPlace();
                    } else {
                        respawnPlayer();
                    }
                });
            };
        }
    };

    const respawnPlayerInPlace = () => {
        if (typeof camera === 'undefined' || !camera) return;
        const overlay = document.getElementById('death-overlay');
        if (overlay) overlay.remove();

        window.STATS.hp = 100;
        window.STATS.hunger = 100;
        window.STATS.stamina = 100;
        if (typeof updateStatBars === 'function') updateStatBars();

        if (velocity) velocity.set(0, 0, 0);
        window.isLocalPlayerDead = false;

        // Clear dead state in Firebase presence
        if (db && STATE.currentUser && STATE.currentUser.uid) {
            const localIsJailed = Boolean(STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now());
            db.ref('presence/' + STATE.currentUser.uid).set({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                ry: camera.rotation.y,
                name: STATE.currentUser.name || "신병",
                rank: STATE.currentUser.rank || "이등병",
                isJailed: localIsJailed,
                isDead: false,
                lastSeen: Date.now()
            });
            db.ref('users/' + STATE.currentUser.uid + '/hit').remove();
        }

        showToast("🏥 응급처치를 마치고 현장에서 즉시 부활하였습니다!", "#22c55e");
    };

    const respawnPlayer = () => {
        if (typeof camera === 'undefined' || !camera) return;
        const overlay = document.getElementById('death-overlay');
        if (overlay) overlay.remove();

        window.STATS.hp = 100;
        window.STATS.hunger = 100;
        window.STATS.stamina = 100;
        if (typeof updateStatBars === 'function') updateStatBars();

        // Respawn position: parade ground (0, 1.6, 0)
        camera.position.set(0, 1.6, 0);
        camera.rotation.set(0, 0, 0);
        if (velocity) velocity.set(0, 0, 0);

        window.isLocalPlayerDead = false;

        // Clear dead state in Firebase presence
        if (db && STATE.currentUser && STATE.currentUser.uid) {
            const localIsJailed = Boolean(STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now());
            db.ref('presence/' + STATE.currentUser.uid).set({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                ry: camera.rotation.y,
                name: STATE.currentUser.name || "신병",
                rank: STATE.currentUser.rank || "이등병",
                isJailed: localIsJailed,
                isDead: false,
                lastSeen: Date.now()
            });
            db.ref('users/' + STATE.currentUser.uid + '/hit').remove();
        }

        showToast("🏥 응급처치를 받고 무사히 부활했습니다!", "#22c55e");
    };

    const updateOtherPlayers = () => {
        if (!window.allPlayersData) return;

        const currentUid = STATE.currentUser ? STATE.currentUser.uid : null;

        // 1. Clean up old players (not in allPlayersData, or inactive for 2 minutes as a fallback)
        Object.keys(window.allPlayersData).forEach(uid => {
            const p = window.allPlayersData[uid];
            if (!p || uid === currentUid || (Date.now() - p.lastSeen > 120000)) {
                if (otherPlayers[uid]) {
                    // Dispose Three.js geometries and materials/textures to prevent GPU memory leaks
                    otherPlayers[uid].mesh.traverse(child => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => {
                                        if (m.map) m.map.dispose();
                                        m.dispose();
                                    });
                                } else {
                                    // Do not dispose shared camo materials, but dispose custom textures/materials
                                    if (!child.userData.isCamo) {
                                        if (child.material.map) child.material.map.dispose();
                                        child.material.dispose();
                                    }
                                }
                            }
                        }
                    });

                    scene.remove(otherPlayers[uid].mesh);
                    if (otherPlayers[uid].label) {
                        otherPlayers[uid].mesh.remove(otherPlayers[uid].label);
                    }
                    delete otherPlayers[uid];
                }
            }
        });

        // 2. Add or update meshes of active players
        Object.keys(window.allPlayersData).forEach(uid => {
            if (uid === currentUid) return;
            const p = window.allPlayersData[uid];
            if (!p) return;

            // Safety check: skip players with undefined or non-numeric coordinates to prevent NaN crashes
            if (typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number' || typeof p.ry !== 'number') return;

            // Inactive check (fallback timeout of 2 minutes)
            if (Date.now() - p.lastSeen > 120000) return;

            const isCreator = (uid === 'master_ree' || p.name === '이주람' || p.username === 'ree1203');
            if (!otherPlayers[uid]) {
                // Create new complex player mesh
                const group = createPlayerModel(isCreator ? 0x000000 : 0x4b5320);
                if (isCreator) {
                    convertToCreatorModel(group, 5);
                }
                group.position.y = 1.6; // Initial offset
                scene.add(group);
                otherPlayers[uid] = { mesh: group, lastColor: isCreator ? 0x000000 : 0x4b5320 };
            } else if (isCreator && !otherPlayers[uid].mesh.userData.isCreator) {
                convertToCreatorModel(otherPlayers[uid].mesh, 5);
            }

            // Store target position for lerp in animate loop (don't lerp here)
            const playerObj = otherPlayers[uid];
            const targetX = p.x;
            const targetY = p.y - 1.6;
            const targetZ = p.z;
            playerObj.targetPos = { 
                x: targetX, 
                y: targetY, 
                z: targetZ, 
                ry: p.ry, 
                isDead: p.isDead,
                pose: p.pose || 'normal',
                activeSkin: p.activeSkin || 'normal',
                rank: p.rank || '이등병',
                isJailed: Boolean(p.isJailed)
            };

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
            if (playerObj.label) {
                playerObj.label.visible = !p.isStealth;
            }

            // Update other player's gas mask mesh
            playerObj.mesh.traverse(child => {
                if (child.userData.isGasMaskPart) {
                    child.visible = Boolean(p.isGasMask);
                }
            });

            const getRankColor = (rank, isJailed) => {
                if (p.isDressUniform) return 0xffffff; // White dress uniform!
                if (isJailed) return 0xffa500;
                const ranksArr = (typeof RANKS !== 'undefined' ? RANKS : []);
                const idx = ranksArr.indexOf(rank);
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
                    if (child.isMesh) {
                        if (child.userData.isCamo) {
                            child.material = newMat;
                        }
                        if (child.userData.isEpaulet) {
                            child.visible = (targetColor === 0xffffff);
                        }
                    }
                });
            }
        });
    };

    // Animate other players toward their target positions (runs every frame)
    const lerpOtherPlayers = () => {
        Object.keys(otherPlayers).forEach(uid => {
            const playerObj = otherPlayers[uid];
            if (!playerObj || !playerObj.targetPos) return;
            const lerpFactor = 0.15;
            const t = playerObj.targetPos;
            playerObj.mesh.position.x += (t.x - playerObj.mesh.position.x) * lerpFactor;
            playerObj.mesh.position.z += (t.z - playerObj.mesh.position.z) * lerpFactor;
            if (t.isDead) {
                playerObj.mesh.rotation.x += (Math.PI / 2 - playerObj.mesh.rotation.x) * lerpFactor;
                playerObj.mesh.position.y += (0.15 - playerObj.mesh.position.y) * lerpFactor;
                if (playerObj.label) playerObj.label.visible = false;
            } else {
                // If prone pose, tilt main model rotation around x axis
                const targetRotX = t.pose === 'prone' ? -Math.PI / 2.2 : 0;
                playerObj.mesh.rotation.x += (targetRotX - playerObj.mesh.rotation.x) * lerpFactor;
                playerObj.mesh.position.y += (t.y - playerObj.mesh.position.y) * lerpFactor;
                if (playerObj.label) playerObj.label.visible = true;
            }
            let diffRot = t.ry - playerObj.mesh.rotation.y;
            diffRot = Math.atan2(Math.sin(diffRot), Math.cos(diffRot));
            playerObj.mesh.rotation.y += diffRot * lerpFactor;

            // Apply custom skins & emotes poses
            window.refreshPlayerSkin(playerObj.mesh, t.activeSkin, t.rank, t.isJailed);
            window.applyPose(playerObj.mesh, t.pose, performance.now() / 1000);
        });
    };
    // 다른 플레이어 업데이트를 window에 노출해 startGame에서도 호출 가능하게 함
    window.updateOtherPlayers = updateOtherPlayers;


    document.getElementById('btn-id-card').onclick = () => {
        if (!STATE.currentUser) return;
        const modal = document.getElementById('id-card-modal');
        document.getElementById('id-name').textContent = STATE.currentUser.name || "신병";
        document.getElementById('id-rank').textContent = STATE.currentUser.rank || "이등병";
        document.getElementById('id-serial').textContent = `24-${STATE.currentUser.uid.slice(0, 8).toUpperCase()}`;
        
        const badgeContainer = document.getElementById('id-badges');
        badgeContainer.innerHTML = '';
        const unlocked = STATE.currentUser.achievements || {};
        ALL_ACHIEVEMENTS.forEach(a => {
            if (unlocked[a.id]) {
                const b = document.createElement('div');
                b.style.cssText = 'width:30px; height:30px; background:rgba(255,255,255,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem; cursor:help;';
                b.title = a.name; b.textContent = a.icon;
                badgeContainer.appendChild(b);
            }
        });
        modal.style.display = 'flex';
    };

    // ====================================================
    // SYSTEM I: AI INSTRUCTOR (TUTORIAL)
    // ====================================================
    let instructor = null;
    let tutorialStep = 0;
    const tutorialLines = [
        "필승! 훈련병 교육을 담당하는 AI 조교다! 내 뒤를 따라와라!",
        "여기는 생활관이다. 휴식과 정비를 하는 곳이지. 기억해둬라!",
        "여기는 사격장이다. 사격 실력이 곧 군인의 생명이다!",
        "여기는 유격장이다! 강인한 체력을 길러야 살아남을 수 있다!",
        "이상 교육 끝! 이제 실전이다. 부디 훌륭한 군인이 되길 바란다!"
    ];
    const tutorialTargets = [
        LOCATIONS['생활관'],
        LOCATIONS['사격장'],
        LOCATIONS['유격장']
    ];

    document.getElementById('btn-tutorial').onclick = () => {
        if (instructor) return alert("이미 교육이 진행 중이다!");
        
        // Create Instructor Model (Red Beret)
        instructor = createPlayerModel(0x222222); // Black uniform
        const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), new THREE.MeshStandardMaterial({color: 0x8b0000}));
        beret.position.y = 1.0; beret.rotation.x = 0.2;
        instructor.children[0].add(beret); // Add to head
        
        instructor.position.set(camera.position.x + 5, 0, camera.position.z + 5);
        scene.add(instructor);
        
        document.getElementById('tutorial-overlay').style.display = 'block';
        updateTutorial();
    };

    const updateTutorial = () => {
        const text = document.getElementById('tutorial-text');
        text.textContent = tutorialLines[tutorialStep];
        
        if (tutorialStep > 0 && tutorialStep <= tutorialTargets.length) {
            const target = tutorialTargets[tutorialStep - 1];
            moveInstructorTo(target);
        }

        setTimeout(() => {
            tutorialStep++;
            if (tutorialStep < tutorialLines.length) updateTutorial();
            else finishTutorial();
        }, 8000);
    };

    const moveInstructorTo = (pos) => {
        if (!instructor) return;
        new TWEEN.Tween(instructor.position)
            .to({ x: pos.x + 2, z: pos.z + 2 }, 6000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    };

    const finishTutorial = () => {
        document.getElementById('tutorial-overlay').style.display = 'none';
        scene.remove(instructor);
        instructor = null;
        tutorialStep = 0;
        showToast("🎓 교육 수료 완료! (+200 EXP)", "#22c55e");
        gainEXP(200, "신병 교육 수료");
    };

window.onload = () => {
    initAuth();
    
    window.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            e.preventDefault();
            if (window.activeWeaponId) {
                window.isAdsMode = !window.isAdsMode;
                showToast(window.isAdsMode ? "🎯 정밀 조준 사격 개시" : "조준 해제", "#3b82f6");
            }
        } else if (e.button === 0) {
            if (window.grenadeThrowingMode) {
                window.grenadeCharging = true;
                window.grenadePower = 0;
            }
        }
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && window.grenadeThrowingMode && window.grenadeCharging) {
            window.grenadeCharging = false;
            window.throwGrenade(window.grenadePower);
        }
    });
    window.addEventListener('contextmenu', (e) => {
        if (window.activeWeaponId) {
            e.preventDefault();
        }
    });
    
    window.startFlightCountdown = () => {
        if (window.flightCountdownRunning) return;
        if (window.flightModeActive) {
            window.flightModeActive = false;
            if (window.localPlayerBody) {
                window.localPlayerBody.traverse(child => {
                    if (child.name === 'flame') {
                        child.visible = false;
                    }
                });
            }
            showToast("✈️ 비행 모드가 비활성화되었습니다.", "#3b82f6");
            return;
        }

        window.flightCountdownRunning = true;
        
        // Create HTML Element for Countdown
        let cdDiv = document.getElementById('flight-countdown-hud');
        if (!cdDiv) {
            cdDiv = document.createElement('div');
            cdDiv.id = 'flight-countdown-hud';
            cdDiv.style.cssText = 'position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 99999; pointer-events: none; font-family: "Pretendard", sans-serif;';
            document.body.appendChild(cdDiv);
        }
        cdDiv.style.display = 'flex';
        
        const countText = document.createElement('div');
        countText.style.cssText = 'font-size: 7rem; font-weight: 900; color: #ff0055; text-shadow: 0 0 30px rgba(255, 0, 85, 0.8); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: scale(0.5);';
        cdDiv.innerHTML = '';
        cdDiv.appendChild(countText);

        const titleText = document.createElement('div');
        titleText.textContent = "🚀 CREATOR FLIGHT SYSTEM INITIATING...";
        titleText.style.cssText = 'font-size: 1.5rem; font-weight: bold; color: #ffffff; text-shadow: 0 0 10px rgba(255,255,255,0.5); margin-bottom: 20px; letter-spacing: 2px;';
        cdDiv.insertBefore(titleText, countText);
        
        let count = 3;
        
        const updateCountdown = () => {
            if (count > 0) {
                countText.textContent = count;
                countText.style.color = count === 3 ? '#ff0055' : (count === 2 ? '#ffaa00' : '#00ff33');
                countText.style.textShadow = `0 0 30px ${countText.style.color}`;
                countText.style.transform = 'scale(1.2)';
                
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.1);
                } catch(e) {}

                setTimeout(() => {
                    countText.style.transform = 'scale(0.8)';
                    count--;
                    updateCountdown();
                }, 1000);
            } else {
                countText.textContent = "LIFT OFF! 🚀";
                countText.style.color = '#ffff00';
                countText.style.textShadow = '0 0 40px #ffff00';
                countText.style.transform = 'scale(1.5)';
                
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.8);
                    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.8);
                } catch(e) {}

                window.flightModeActive = true;
                window.flightCountdownRunning = false;
                
                if (window.velocity) window.velocity.y = 12.0;

                if (window.localPlayerBody) {
                    window.localPlayerBody.traverse(child => {
                        if (child.name === 'flame') {
                            child.visible = true;
                        }
                    });
                }

                showToast("🚀 비행 모드가 활성화되었습니다! [Space]: 상승, [Shift]: 하강", "#ffff00");
                
                setTimeout(() => {
                    cdDiv.style.display = 'none';
                }, 1500);
            }
        };
        
        updateCountdown();
    };

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        keys[e.code] = true;
        keys[e.key] = true;

        if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.key === 'ㅔ' || e.key === 'ㅖ') {
            if (typeof window.toggleTacticalPhone === 'function') {
                window.toggleTacticalPhone();
                e.preventDefault();
                return;
            }
        }
        
        if (e.code === 'KeyO' || e.key === 'o' || e.key === 'O' || e.key === 'ㅐ' || e.key === 'ㅐ') {
            const isCreator = window.localPlayerBody && window.localPlayerBody.userData.isCreator;
            const isRee = STATE.currentUser && STATE.currentUser.username === 'ree1203';
            if (isCreator && isRee) {
                window.startFlightCountdown();
            } else {
                showToast("🔒 이 기능은 제작자 전용 비행 장치입니다.", "#ff3333");
            }
        }
        
        // CCTV Mode overrides
        if (window.isCctvActive) {
            if (e.key === '1') { window.enterCctvMode('cctv_canteen'); e.preventDefault(); return; }
            if (e.key === '2') { window.enterCctvMode('cctv_gym'); e.preventDefault(); return; }
            if (e.key === '3') { window.enterCctvMode('cctv_px'); e.preventDefault(); return; }
            if (e.key === '4') { window.enterCctvMode('cctv_barracks'); e.preventDefault(); return; }
            if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
                window.exitCctvMode();
                e.preventDefault();
                return;
            }
        }
        
        // Weapon switching keys 1, 2, 3
        if (e.key === '1') {
            if (window.availableWeapons && window.availableWeapons[0]) window.equipWeapon(window.availableWeapons[0]);
        }
        if (e.key === '2') {
            if (window.availableWeapons && window.availableWeapons[1]) window.equipWeapon(window.availableWeapons[1]);
        }
        if (e.key === '3') {
            if (window.availableWeapons && window.availableWeapons[2]) window.equipWeapon(window.availableWeapons[2]);
        }
        
        // Prevent default browser action (scrolling) for Spacebar
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
        }
        
        if (e.key === 'Tab' || e.code === 'Tab') {
            e.preventDefault();
            const sb = document.getElementById('scoreboard-overlay');
            if (sb) {
                sb.style.display = 'flex';
                if (typeof window.updateScoreboard === 'function') window.updateScoreboard();
            }
        }
        
        if (e.key === 'c' || e.key === 'C') {
            window.isThirdPerson = !window.isThirdPerson;
            if (window.localPlayerBody) window.localPlayerBody.visible = window.isThirdPerson;
            if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson && window.hasK2;
        }

        if (e.key === 'r' || e.key === 'R') {
            if (typeof window.reloadActiveWeapon === 'function') window.reloadActiveWeapon();
        }

        if (e.key === 'n' || e.key === 'N') {
            if (typeof window.toggleNVG === 'function') window.toggleNVG();
        }
        
        // F key: Enter/Exit all vehicles (helicopter, airplane, tank, truck)
        if (e.key === 'f' || e.key === 'F') {
            if (typeof tryEnterVehicle === 'function') tryEnterVehicle();
        }

        // E key: Proximity interactions (Creator/Sub-Creator Battles)
        if (e.key === 'e' || e.key === 'E') {
            if (typeof window.handleProximityInteraction === 'function') {
                window.handleProximityInteraction();
            }
        }

        // ESC: Stop shooting mode
        if (e.key === 'Escape' && window.shootingMode) {
            if (typeof endShootingRange === 'function') endShootingRange();
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
        keys[e.code] = false;
        keys[e.key] = false;

        if (e.key === 'Tab' || e.code === 'Tab') {
            e.preventDefault();
            const sb = document.getElementById('scoreboard-overlay');
            if (sb) sb.style.display = 'none';
        }

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
                alert("공지사항 채널은 원수님만 작성할 수 있습니다.");
                input.value = '';
                return;
            }

            db.ref(`official_chat/${window.currentOfficialChannel}`).push({
                uid: STATE.currentUser.uid,
                name: STATE.currentUser.name || "신병",
                rank: STATE.currentUser.rank || "이등병",
                text: text,
                timestamp: Date.now()
            });

            input.value = '';
        }
    };

    // Mobile Button Click Logic
    document.getElementById('btn-vehicle').onclick = () => { if (typeof tryEnterVehicle === 'function') tryEnterVehicle(); };
    document.getElementById('btn-view').onclick = () => {
        window.isThirdPerson = !window.isThirdPerson;
        if (window.localPlayerBody) window.localPlayerBody.visible = window.isThirdPerson;
        if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson && window.hasK2;
        showToast(`🎥 시점 변경: ${window.isThirdPerson ? '3인칭' : '1인칭'}`);
    };
    
    // Voice button (Touch Start/End for P-key behavior)
    const voiceBtn = document.getElementById('btn-voice');
    const startVoice = () => {
        if (window.peer && !window.localAudioStream) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                window.localAudioStream = stream;
                document.getElementById('voice-indicator').style.display = 'block';
                Object.keys(otherPlayers).forEach(uid => {
                    const call = window.peer.call('mil_survival_' + uid, stream);
                    if (call) window.activeVoiceCalls.push(call);
                });
            });
        }
    };
    const stopVoice = () => {
        if (window.localAudioStream) {
            window.localAudioStream.getTracks().forEach(track => track.stop());
            window.localAudioStream = null;
            window.activeVoiceCalls.forEach(call => call.close());
            window.activeVoiceCalls = [];
            document.getElementById('voice-indicator').style.display = 'none';
        }
    };
    voiceBtn.ontouchstart = (e) => { e.preventDefault(); startVoice(); };
    voiceBtn.ontouchend = stopVoice;
    voiceBtn.onmousedown = startVoice;
    voiceBtn.onmouseup = stopVoice;

    setupMobileControls();
    setupPCControls();
};

const registerAllCoupons = () => {
    if (!db) return;
    const codes = [
        "3k9V2nR7p", "m5B1x8LqW", "7tZ4j6G2f", "h8N9s1K5v", "D2m7X3r9P", "6wL5c8Y1q", "b4T9k2J6n", "R7s1v4M3z", "5fG8x2D9h", "p1N6c3K8w",
        "4V9r7L2tJ", "z3M8s1X6q", "k5B2p9G4n", "7W1v6R3dF", "x8N4m9T2k", "j2H7s5B9w", "9L1c4P8vX", "r6K3f7M2n", "5D9x1G4tS", "w8V2p6N3b",
        "3mR9k5L7z", "h4B1v8F6q", "X7t2G9n3M", "s5K8p1W4d", "2N9f6R3yJ", "c8L4x7M1k", "6G3s9V2bT", "p5W1n8D4z", "9rK2h7B6v", "f4M1s9X3n",
        "7B6v2L9kP", "t3G8n5W1r", "x9D4m7K2b", "s1R6v3N8f", "5L2p9G4tX", "k8N3w7M1s", "4V9r2B6hZ", "c5T1n8P3q", "9F2s7K4vM", "h1X6b3G8r",
        "2W9p4L7nJ", "m5D1v8R3s", "8K4t9B2fX", "n1G6z3M7w", "v4P9r2S8k", "7L3b6H1xV", "w9N4d7G2m", "k1B8v5T3s", "4R7n2M9pW", "f6X3s8K1t",
        "9G2v4L7bN", "z1P8w5R3k", "5M4n9T2sV", "h7K3x1D8b", "2B9f6W4vM", "s8L1n4G3p", "3V7r2K9xS", "m1N6b8D4t", "k9P3w7R2v", "4G8s1M6fX",
        "b5T2n9K7w", "r1V4d8L3s", "9X7k2B5pG", "h3N8s1F4t", "2M9v6R3xW", "k7B1n4P8z", "5G3s9T2vK", "x1D8b4M6r", "9L4w7N2pS", "f3K8v5G1b",
        "2R7n9M3wV", "s5P1x8B4t", "8H3d7K2vN", "mW4r1L6s", "3G7b2V9pX", "n1X8k4D2r", "k5F9v3M7s", "4T2n8L1wB", "9P7x3G5vK", "h1R6b4N9t",
        "2M8v5S1wG", "k4D9n7B3p", "7X2s8K1vF", "m5G9r4L6t", "1N3w8P2sV", "b7K4x9D1r", "5R2v8G3nM", "x9L1p4T6v", "3F8b7W2nS", "k1V6s4M9p",
        "7N3t8G2vD", "m5B1x9R4w", "8K2n7L3sP", "f1W9p4V6z", "4S7x2M8nT", "b1G6k9D3v", "9R4v7K1sW", "h2L8n5P3m", "5T1w9B4xG", "z7N3s8V1k"
    ];
    codes.forEach(code => {
        const upper = code.toUpperCase();
        db.ref(`server/coupons/${upper}`).once('value').then(snap => {
            if (!snap.exists()) {
                db.ref(`server/coupons/${upper}`).set({
                    coins: 1000,
                    diamonds: 50,
                    active: true,
                    createdAt: Date.now()
                });
            }
        });
        db.ref(`coupons/${upper}`).once('value').then(snap => {
            if (!snap.exists()) {
                db.ref(`coupons/${upper}`).set({
                    rewardCoins: 1000,
                    rewardDiamonds: 50,
                    active: true,
                    createdAt: Date.now()
                });
            }
        });
    });
};

window.redeemGameCoupon = () => {
    const input = document.getElementById('game-coupon-input');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (!code) return alert("쿠폰 코드를 입력하세요!");

    if (!db || !STATE.currentUser || !STATE.currentUser.uid) {
        return alert("서버 연결 확인 중입니다. 잠시 후 다시 시도하세요.");
    }

    const usedCoupons = STATE.currentUser.used_coupons || {};
    if (usedCoupons[code]) {
        return alert("이미 사용한 쿠폰입니다.");
    }

    db.ref(`server/coupons/${code}`).once('value').then(snap => {
        let coupon = snap.val();
        if (!coupon) {
            db.ref(`coupons/${code}`).once('value').then(cSnap => {
                const cCoupon = cSnap.val();
                if (!cCoupon || !cCoupon.active) {
                    return alert("유효하지 않거나 만료된 쿠폰입니다.");
                }
                processRedeem(cCoupon, code);
            });
        } else {
            if (!coupon.active) {
                return alert("유효하지 않거나 만료된 쿠폰입니다.");
            }
            processRedeem(coupon, code);
        }
    });

    const processRedeem = (coupon, code) => {
        // Random reward: 1,000G ~ 10,000G
        const rewardG = Math.floor(Math.random() * 9001) + 1000;
        const rewardDia = Math.floor(Math.random() * 41) + 10; // 10 ~ 50 diamonds

        const currentMoney = STATE.currentUser.money || 0;
        const currentCoins = STATE.currentUser.coins || 0;
        const currentDia = STATE.currentUser.diamonds || 0;

        const updates = {};
        // Reward the user
        updates[`users/${STATE.currentUser.uid}/money`] = currentMoney + rewardG;
        updates[`users/${STATE.currentUser.uid}/coins`] = currentCoins + rewardG;
        updates[`users/${STATE.currentUser.uid}/diamonds`] = currentDia + rewardDia;
        updates[`users/${STATE.currentUser.uid}/used_coupons/${code}`] = true;

        db.ref().update(updates).then(() => {
            alert(`🧧 쿠폰 적용 성공!\n🎉 축하합니다! 랜덤 포상금 +${rewardG.toLocaleString()}G (다이아 +${rewardDia}) 지급되었습니다!\n(이 쿠폰은 기간 및 사용 제한이 없는 무제한 쿠폰입니다.)`);
            input.value = '';
        }).catch(err => {
            alert("쿠폰 적용 실패: " + err.message);
        });
    };
};

window.godModeActive = false;
window.flightModeActive = false;

window.toggleGodModeAdmin = () => {
    window.godModeActive = !window.godModeActive;
    const btn = document.getElementById('btn-admin-god');
    if (btn) {
        btn.textContent = window.godModeActive ? '🛡️ 무적: ON' : '🛡️ 무적: OFF';
        btn.style.background = window.godModeActive ? '#059669' : '#10b981';
    }
    showToast(`🛡️ 무적 모드가 ${window.godModeActive ? '활성화' : '비활성화'}되었습니다.`, window.godModeActive ? '#059669' : '#10b981');
};

window.toggleFlightModeAdmin = () => {
    window.flightModeActive = !window.flightModeActive;
    const btn = document.getElementById('btn-admin-flight');
    if (btn) {
        btn.textContent = window.flightModeActive ? '✈️ 비행: ON' : '✈️ 비행: OFF';
        btn.style.background = window.flightModeActive ? '#22c55e' : '#3b82f6';
    }
    if (!window.flightModeActive) {
        camera.position.y = 1.6;
        if (typeof velocity !== 'undefined') velocity.y = 0;
    }
    showToast(`✈️ 비행 모드가 ${window.flightModeActive ? '활성화' : '비활성화'}되었습니다.`, window.flightModeActive ? '#22c55e' : '#3b82f6');
};

window.teleportAdmin = () => {
    const dest = document.getElementById('admin-teleport-dest').value;
    if (dest === 'selected') {
        const targetUid = document.getElementById('admin-target-user').value;
        if (!targetUid) return alert("텔레포트할 대상 유저를 지정하세요!");
        
        const pData = window.allPlayersData ? window.allPlayersData[targetUid] : null;
        if (pData && pData.x !== undefined && pData.z !== undefined) {
            camera.position.set(pData.x, (pData.y || 0) + 1.6, pData.z);
            showToast(`🚀 ${pData.name || '유저'}님 위치로 텔레포트했습니다!`);
        } else {
            alert("유저의 실시간 위치 정보를 찾을 수 없습니다.");
        }
    } else {
        const loc = LOCATIONS[dest];
        if (loc) {
            camera.position.set(loc.x, 1.6, loc.z);
            showToast(`🚀 ${dest}(으)로 텔레포트했습니다!`);
        }
    }
};

window.spawnItemAdmin = () => {
    const item = document.getElementById('admin-spawn-item').value;
    if (!STATE.currentUser || !STATE.currentUser.uid) return;
    
    if (item === 'apc') {
        if (window.tankMesh) {
            window.tankMesh.position.set(camera.position.x, 0.5, camera.position.z);
            showToast(" 장갑차(전차)를 현재 위치에 소환했습니다!");
        }
    } else if (item === 'heli') {
        if (window.helicopterMesh) {
            window.helicopterMesh.position.set(camera.position.x, 0.5, camera.position.z);
            showToast("🚁 공격 헬기를 현재 위치에 소환했습니다!");
        }
    } else {
        if (db) {
            db.ref(`users/${STATE.currentUser.uid}/inventory`).push(item).then(() => {
                showToast(`🎒 아이템 [${item}]이 인벤토리에 지급되었습니다!`);
                if (item === 'k2') {
                    window.hasK2 = true;
                    if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson;
                    document.getElementById('crosshair').style.display = 'block';
                }
            });
        }
    }
};

window.muteUserAdmin = () => {
    const targetUid = document.getElementById('admin-target-user').value;
    if (!targetUid) return alert("대상을 지정하세요!");
    db.ref(`users/${targetUid}/isMuted`).once('value').then(snap => {
        const current = snap.val() || false;
        db.ref(`users/${targetUid}/isMuted`).set(!current).then(() => {
            showToast(`🔇 대상 유저 음소거 ${!current ? '설정' : '해제'} 완료!`);
        });
    });
};

window.kickUserAdmin = () => {
    const targetUid = document.getElementById('admin-target-user').value;
    if (!targetUid) return alert("대상을 지정하세요!");
    if (confirm("정말 이 유저를 강제 퇴장시키겠습니까?")) {
        db.ref(`users/${targetUid}/kicked`).set(Date.now()).then(() => {
            showToast(`🚪 대상 유저를 강퇴했습니다.`);
        });
    }
};

window.banUserAdmin = () => {
    const targetUid = document.getElementById('admin-target-user').value;
    if (!targetUid) return alert("대상을 지정하세요!");
    if (confirm("⚠️ 정말 이 유저를 영구 정지시키겠습니까?")) {
        db.ref(`users/${targetUid}/isBanned`).set(true).then(() => {
            showToast(`💀 대상 유저를 영구 밴 처리했습니다.`);
        });
    }
};

window.punishUserAdmin = () => {
    const targetUid = document.getElementById('admin-target-user').value;
    if (!targetUid) return alert("대상을 지정하세요!");
    const pType = document.getElementById('admin-punishment-type').value;
    db.ref(`users/${targetUid}/punishment`).set(pType);
    db.ref(`presence/${targetUid}/punishment`).set(pType).then(() => {
        showToast(`🚨 대상 유저에게 군기훈련(${pType})을 부여했습니다.`);
    });
};

window.changeWeatherAdmin = (val) => {
    if (!db) return;
    let idx = 0;
    if (val === 'CLEAR') idx = 0;
    else if (val === 'RAIN') idx = 1;
    else if (val === 'SNOW') idx = 2;
    else if (val === 'FOG') idx = 3;
    db.ref('system/weather').set(idx).then(() => {
        showToast(`날씨 제어 명령이 전달되었습니다!`);
    });
};

window.changeExpRateAdmin = (val) => {
    if (!db) return;
    const rate = parseFloat(val) || 1.0;
    db.ref('system/config').update({ expRate: rate }).then(() => {
        showToast(`경험치 배율이 ${rate}배로 설정되었습니다!`);
    });
};

// ====================================================
// SYSTEM H: PROMOTION REVIEW & EXAM SYSTEM (승급 심사)
// ====================================================
const PROMO_QUIZ_QUESTIONS = [
    {
        q: "대한민국 국군의 주적은 누구인가?",
        a: ["미국 및 서방 우방국", "북한 정권과 북한군", "중화인민공화국", "가상의 국가"],
        correct: 1
    },
    {
        q: "군인의 의무 중 '상관의 직무상 명령에 절대 복종해야 하는 의무'는 무엇인가?",
        a: ["성실의 의무", "비밀엄수의 의무", "복종의 의무", "품위유지의 의무"],
        correct: 2
    },
    {
        q: "대한민국 국군의 창설 목적과 군인의 최종적 사명은 무엇인가?",
        a: ["국가안전보장과 국토수호 (전쟁 승리)", "개인의 체력 단련 및 복지 증진", "군자금 축적 및 세금 징수", "국제 평화 유지 활동만 수행"],
        correct: 0
    }
];
let currentPromoQuizIdx = 0;

window.startPromotionExamFlow = () => {
    if (!STATE.currentUser || !STATE.currentUser.promotionReady) return;
    currentPromoQuizIdx = 0;
    
    // Hide lobby screen temporarily
    const lobby = document.getElementById('lobby-screen');
    if (lobby) lobby.classList.remove('active');
    
    // Show quiz modal
    const modal = document.getElementById('promotion-quiz-modal');
    if (modal) modal.style.display = 'flex';
    
    window.loadPromoQuizQuestion(0);
};

window.loadPromoQuizQuestion = (idx) => {
    currentPromoQuizIdx = idx;
    const qData = PROMO_QUIZ_QUESTIONS[idx];
    if (!qData) return;
    
    document.getElementById('quiz-question-num').textContent = `QUESTION ${idx + 1}/3`;
    document.getElementById('quiz-question-text').textContent = qData.q;
    
    const optionsDiv = document.getElementById('quiz-options');
    optionsDiv.innerHTML = '';
    
    qData.a.forEach((optText, optIdx) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.cssText = 'margin: 5px 0; text-align: left; padding: 12px 15px; font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5); width: 100%; border-radius: 8px; cursor: pointer; transition: 0.2s;';
        btn.textContent = `${optIdx + 1}. ${optText}`;
        btn.onclick = () => window.selectPromoQuizAnswer(optIdx);
        optionsDiv.appendChild(btn);
    });
};

window.selectPromoQuizAnswer = (answerIdx) => {
    const qData = PROMO_QUIZ_QUESTIONS[currentPromoQuizIdx];
    if (answerIdx === qData.correct) {
        showToast('🎯 정답입니다! 다음 문항으로 이동합니다.', '#22c55e');
        if (currentPromoQuizIdx + 1 < PROMO_QUIZ_QUESTIONS.length) {
            window.loadPromoQuizQuestion(currentPromoQuizIdx + 1);
        } else {
            // Passed Quiz
            const modal = document.getElementById('promotion-quiz-modal');
            if (modal) modal.style.display = 'none';
            alert("정신전력 필기시험 합격! 실기 측정을 시작합니다. 연병장 구보 및 사격을 수행하십시오.");
            window.startPromotionPracticalPhase();
        }
    } else {
        // Failed
        const modal = document.getElementById('promotion-quiz-modal');
        if (modal) modal.style.display = 'none';
        
        // Reset promotionReady so they must retake training or retry
        STATE.currentUser.promotionReady = false;
        STATE.currentUser.exp = Math.max(0, STATE.currentUser.exp - 30); // deduct 30 exp as penalty
        db.ref('users/' + STATE.currentUser.uid).update({ promotionReady: false, exp: STATE.currentUser.exp });
        
        alert("🚨 불합격 (오답)! 정신전력 평가에서 탈락하여 진급 누락(진누)되었습니다. 훈련을 다시 이수하십시오. (경험치 감점 -30)");
        if (typeof showLobby === 'function') showLobby();
    }
};

window.startPromotionPracticalPhase = () => {
    // Hide Lobby screen to start in-game exam
    const lobby = document.getElementById('lobby-screen');
    if (lobby) lobby.classList.remove('active');
    
    // Teleport to 심사장 entrance to begin physical test
    if (typeof camera !== 'undefined') {
        camera.position.set(-100, 1.6, -140);
    }
    
    const curRankIdx = RANKS.indexOf(STATE.currentUser.rank);
    window.promoExamActive = true;
    window.promoShootHits = 0;
    window.promoDistanceRun = 0;
    window.promoDistanceTarget = 150; // 150 meters
    window.promoShootHitsNeeded = curRankIdx < 3 ? 5 : 8; // 5 hits for lower ranks, 8 hits for higher ranks
    
    const hud = document.getElementById('promotion-exam-hud');
    if (hud) hud.style.display = 'block';
    
    // Force K2 weapon for the duration of the exam
    window.hasK2 = true;
    if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson;
    const ch = document.getElementById('crosshair');
    if (ch) ch.style.display = 'block';
    
    showToast("⚔️ 진급 실기 측정 시작! 사격장에서 과녁을 맞추고, 연병장을 달리십시오!", '#f59e0b');
    window.updatePromoHUD();
};

window.updatePromoHUD = () => {
    if (!window.promoExamActive) return;
    
    const sEl = document.getElementById('promo-hud-shoot');
    const fEl = document.getElementById('promo-hud-fit');
    
    if (sEl) {
        sEl.textContent = `${window.promoShootHits} / ${window.promoShootHitsNeeded} 명중`;
        sEl.style.color = window.promoShootHits >= window.promoShootHitsNeeded ? '#22c55e' : '#f59e0b';
    }
    
    if (fEl) {
        const pct = Math.floor(window.promoDistanceRun);
        fEl.textContent = `${pct}m / ${window.promoDistanceTarget}m`;
        fEl.style.color = window.promoDistanceRun >= window.promoDistanceTarget ? '#22c55e' : '#f59e0b';
    }
    
    if (window.promoShootHits >= window.promoShootHitsNeeded && window.promoDistanceRun >= window.promoDistanceTarget) {
        window.completePromotionExam();
    }
};

window.completePromotionExam = () => {
    window.promoExamActive = false;
    const hud = document.getElementById('promotion-exam-hud');
    if (hud) hud.style.display = 'none';
    
    const curRankIdx = RANKS.indexOf(STATE.currentUser.rank);
    const nextRank = RANKS[curRankIdx + 1];
    
    if (curRankIdx + 1 >= 4) {
        // NCO/Officer (하사 이상) -> Commander Approval Workflow
        STATE.currentUser.promotionReady = false;
        STATE.currentUser.promotionPending = true;
        
        db.ref('users/' + STATE.currentUser.uid).update({ 
            promotionReady: false, 
            promotionPending: true 
        });
        
        // Push Request to db
        db.ref('promotion_requests/' + STATE.currentUser.uid).set({
            uid: STATE.currentUser.uid,
            username: STATE.currentUser.username,
            name: STATE.currentUser.name,
            currentRank: STATE.currentUser.rank,
            nextRank: nextRank,
            timestamp: Date.now()
        }).then(() => {
            alert("🎉 진급 실기 측정 통과! 하사 이상의 간부 진급은 대장(이주람)의 최종 결재가 필요합니다. 승인을 대기하십시오.");
            if (typeof showLobby === 'function') showLobby();
        });
    } else {
        // Direct Promotion for soldier ranks (이병~병장)
        window.applyPromotion(nextRank);
    }
};

window.applyPromotion = (nextRank) => {
    STATE.currentUser.promotionReady = false;
    STATE.currentUser.promotionPending = false;
    STATE.currentUser.rank = nextRank;
    STATE.currentUser.exp = 0;
    
    db.ref('users/' + STATE.currentUser.uid).update({
        promotionReady: false,
        promotionPending: false,
        rank: nextRank,
        exp: 0
    }).then(() => {
        // Send Chat Announcement
        db.ref('chat').push({
            uid: 'system',
            name: '📢 [부대진급]',
            rank: '지휘소',
            text: `🫡 ${STATE.currentUser.name} 대원이 모든 심사를 통과하고 [${nextRank}](으)로 진급하였습니다! 충성!! 🫡`,
            timestamp: Date.now()
        });
        
        alert(`🎖️ 진급 완료! 축하합니다! 이제 [${nextRank}] 계급입니다.`);
        if (typeof showLobby === 'function') showLobby();
    });
};

// --- Commander Promotion Approval Dashboard Listeners ---
const initPromotionApprovalSync = () => {
    if (!db) return;
    
    // Listen to promotion requests
    db.ref('promotion_requests').on('value', snap => {
        const reqs = snap.val() || {};
        
        // Update Dashboard tab list
        const listDiv = document.getElementById('admin-promotion-list');
        if (listDiv) {
            listDiv.innerHTML = '';
            const keys = Object.keys(reqs);
            if (keys.length === 0) {
                listDiv.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">대기 중인 결재 요청이 없습니다.</div>';
            } else {
                keys.forEach(uid => {
                    const r = reqs[uid];
                    const div = document.createElement('div');
                    div.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 10px;';
                    div.innerHTML = `
                        <div>
                            <div style="font-weight: bold; color: #fff; font-size: 1.05rem;">${r.name} 요원 (${r.username})</div>
                            <div style="font-size: 0.8rem; color: #aaa; margin-top: 4px;">진급: ${r.currentRank} ➡️ <span style="color: var(--accent); font-weight: bold;">${r.nextRank}</span></div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn" style="background: #059669; width: auto; margin: 0; padding: 8px 15px;" onclick="approvePromotion('${uid}', '${r.nextRank}')">결재 승인</button>
                            <button class="btn" style="background: #b91c1c; width: auto; margin: 0; padding: 8px 15px;" onclick="rejectPromotion('${uid}')">반려</button>
                        </div>
                    `;
                    listDiv.appendChild(div);
                });
            }
        }
        
        // Update Game screen Admin HUD panel list
        const hudListDiv = document.getElementById('admin-hud-promo-list');
        if (hudListDiv) {
            hudListDiv.innerHTML = '';
            const keys = Object.keys(reqs);
            if (keys.length === 0) {
                hudListDiv.innerHTML = '<div style="color: #888; text-align: center; font-size: 0.7rem; padding: 5px;">대기 요청 없음</div>';
            } else {
                keys.forEach(uid => {
                    const r = reqs[uid];
                    const div = document.createElement('div');
                    div.style.cssText = 'background: rgba(255,255,255,0.05); padding: 6px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px;';
                    div.innerHTML = `
                        <div style="font-size: 0.72rem;">
                            <span style="font-weight: bold;">${r.name}</span> (${r.currentRank}➡️${r.nextRank})
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="approvePromotion('${uid}', '${r.nextRank}')" style="background: #059669; border: none; color: white; padding: 2px 5px; font-size: 0.65rem; border-radius: 4px; cursor: pointer;">✔️</button>
                            <button onclick="rejectPromotion('${uid}')" style="background: #b91c1c; border: none; color: white; padding: 2px 5px; font-size: 0.65rem; border-radius: 4px; cursor: pointer;">❌</button>
                        </div>
                    `;
                    hudListDiv.appendChild(div);
                });
            }
        }
    });
};

window.approvePromotion = (uid, nextRank) => {
    if (!db) return;
    if (!confirm("이 요원의 간부 승급을 승인 결재하시겠습니까?")) return;
    
    // Update target player rank in database
    db.ref('users/' + uid).update({
        promotionPending: false,
        promotionReady: false,
        rank: nextRank,
        exp: 0
    }).then(() => {
        // Remove Request
        db.ref('promotion_requests/' + uid).remove();
        
        // Log GM action
        if (typeof logAdminAction === 'function') {
            logAdminAction(`승급 승인: ${uid} -> ${nextRank}`);
        }
        
        // Send Chat Announcement
        db.ref('chat').push({
            uid: 'system',
            name: '📢 [부대진급]',
            rank: '지휘소',
            text: `🫡 대장님께서 대상 대원의 자질을 높이 사 [${nextRank}] 임관/진급을 최종 결재하셨습니다! 전 부대 경례!! 🫡`,
            timestamp: Date.now()
        });
        
        showToast("🎖️ 승급 심사 결재가 완료되었습니다!", "#059669");
    });
};

window.rejectPromotion = (uid) => {
    if (!db) return;
    if (!confirm("⚠️ 이 요원의 승급 결재를 반려하시겠습니까?")) return;
    
    db.ref('users/' + uid).update({
        promotionPending: false,
        promotionReady: false,
        exp: 0 // Reset exp to 0 as penalty
    }).then(() => {
        db.ref('promotion_requests/' + uid).remove();
        
        if (typeof logAdminAction === 'function') {
            logAdminAction(`승급 반려: ${uid}`);
        }
        
        showToast("❌ 승급 결재를 반려했습니다. 대상 유저는 진급 누락(진누) 처리되었습니다.", "#b91c1c");
    });
};

// Initialize listeners
setTimeout(initPromotionApprovalSync, 2000);

// ====================================================
// NEW TACTICAL SYSTEMS (Buffs, Branch Skills, Sandbags, Attendance, Cabinet)
// ====================================================

// 1. Shaky Hands (Discipline Debuff) and Buffs
const originalShootRaycast = window.shootPlayerRaycast;
window.shootPlayerRaycast = () => {
    if (window.DISCIPLINE <= 30 && typeof camera !== 'undefined' && camera) {
        camera.rotation.y += (Math.random() - 0.5) * 0.08;
        camera.rotation.x += (Math.random() - 0.5) * 0.05;
        showToast("💨 군기 저하 상태! 조준선이 흔들립니다!", "#ef4444");
    }
    if (originalShootRaycast) originalShootRaycast();
};

// 2. Cold Damage / Snow Weather Logic
setInterval(() => {
    if (!STATE.currentUser || window.isLocalPlayerDead || window.godModeActive) return;
    const isColdWeather = typeof currentWeatherIdx !== 'undefined' && (currentWeatherIdx === 2 || currentWeatherIdx === 3);
    if (isColdWeather) {
        const hasProtection = (window.activeBuffs && (window.activeBuffs.coldProtection > Date.now() || window.activeBuffs.staminaInfinite > Date.now()));
        const barracks = LOCATIONS['생활관'];
        const isInside = barracks && (camera && camera.position.y > 0 && Math.abs(camera.position.x - barracks.x) < 20 && Math.abs(camera.position.z - barracks.z) < 30);
        
        if (!hasProtection && !isInside) {
            window.STATS.hp = Math.max(0, window.STATS.hp - 2);
            if (Math.random() < 0.15) {
                showToast("🥶 동사 위험! 몸을 녹이거나 핫팩/깔깔이를 사용하십시오!", "#ef4444");
            }
            if (window.STATS.hp <= 0) {
                triggerLocalPlayerDeath("한파 및 동사");
            }
            if (typeof updateStatBars === 'function') updateStatBars();
        }
    }
}, 2000);

// 3. activeBuffs HUD updates
window.updateBuffHUD = () => {
    const container = document.getElementById('hud-buffs');
    if (!container) return;
    container.innerHTML = '';
    const now = Date.now();
    if (!window.activeBuffs) return;
    
    if (window.activeBuffs.staminaInfinite > now) {
        const d = document.createElement('div');
        d.style.cssText = 'background: rgba(245, 158, 11, 0.85); color: black; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; border: 1px solid #fff;';
        d.textContent = `⚡ 곱빼기 (${Math.ceil((window.activeBuffs.staminaInfinite - now)/1000)}s)`;
        container.appendChild(d);
        if (window.STATS) window.STATS.stamina = 100; // Force stamina infinite
    }
    if (window.activeBuffs.invisibleName > now) {
        const d = document.createElement('div');
        d.style.cssText = 'background: rgba(88, 101, 242, 0.85); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; border: 1px solid #fff;';
        d.textContent = `🎭 위장은신 (${Math.ceil((window.activeBuffs.invisibleName - now)/1000)}s)`;
        container.appendChild(d);
    }
    if (window.activeBuffs.coldProtection > now) {
        const d = document.createElement('div');
        d.style.cssText = 'background: rgba(56, 189, 248, 0.85); color: black; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; border: 1px solid #fff;';
        d.textContent = `🧥 방한보온 (${Math.ceil((window.activeBuffs.coldProtection - now)/1000)}s)`;
        container.appendChild(d);
    }
};
setInterval(() => {
    if (window.updateBuffHUD) window.updateBuffHUD();
}, 1000);

// 4. Branch Specific Skills (Key V)
window.triggerBranchSkill = () => {
    if (!STATE.currentUser || window.isLocalPlayerDead || !db) return;
    const branch = STATE.currentUser.branch || '육군';
    const now = Date.now();
    if (window.lastSkillTime && now - window.lastSkillTime < 10000) {
        showToast("⏳ 스킬 대기 시간 (10초)", "#ffcc00");
        return;
    }
    window.lastSkillTime = now;

    if (branch === '육군') {
        const x = camera.position.x - Math.sin(camera.rotation.y) * 4;
        const z = camera.position.z - Math.cos(camera.rotation.y) * 4;
        db.ref('system/sandbags').push({
            x: x, y: 0.5, z: z,
            creator: STATE.currentUser.name || "육군대원",
            time: now
        });
        showToast("🪖 육군 전술: 참호(모래주머니)를 구축했습니다!", "#22c55e");
        gainEXP(15, "참호 구축");
    } else if (branch === '해군') {
        const dist = camera.position.distanceTo(new THREE.Vector3(30, 1.6, 80)); // Lake PX Area
        if (dist < 40) {
            showToast("⚓ 해군 작전: 해상 조난자를 성공적으로 구조했습니다!", "#38bdf8");
            gainEXP(20, "조난자 구조");
            changeDiscipline(3, "조난 구조 공로");
        } else {
            showToast("⚓ 해군 작전은 PX 호수 부근에서만 수행 가능합니다!", "#ef4444");
            window.lastSkillTime = 0;
        }
    } else if (branch === '공군') {
        const dist = camera.position.distanceTo(new THREE.Vector3(100, 1.6, -100)); // Shooting range runway
        if (dist < 50) {
            showToast("✈️ 공군 작전: 활주로 유도로 항공기 착륙을 지원했습니다!", "#38bdf8");
            gainEXP(20, "항공기 유도");
            changeDiscipline(3, "착륙 유도 공로");
        } else {
            showToast("✈️ 공군 작전은 사격장 활주로 부근에서만 수행 가능합니다!", "#ef4444");
            window.lastSkillTime = 0;
        }
    } else if (branch === '해병대') {
        const dist = camera.position.distanceTo(new THREE.Vector3(-100, 1.6, 50)); // Training/Obstacle river
        if (dist < 40) {
            showToast("🛡️ 해병대 전술: IBS 고무보트 해안 기습 상륙 성공!", "#deb887");
            gainEXP(20, "IBS 기습 상륙");
            changeDiscipline(3, "상륙 침투 공로");
        } else {
            showToast("🛡️ 해병대 전술은 유격장 수로 부근에서만 수행 가능합니다!", "#ef4444");
            window.lastSkillTime = 0;
        }
    }
};

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'v' || e.key === 'V') {
        window.triggerBranchSkill();
    }
});

// 5. Sandbags Sync
window.sandbagsList = {};
setTimeout(() => {
    if (db && typeof THREE !== 'undefined' && scene) {
        db.ref('system/sandbags').on('child_added', snap => {
            const data = snap.val();
            if (data) {
                const geom = new THREE.BoxGeometry(3, 1, 1.5);
                const mat = new THREE.MeshStandardMaterial({ color: 0x555533, roughness: 0.95 });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(data.x, data.y, data.z);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);
                window.sandbagsList[snap.key] = mesh;
            }
        });
        db.ref('system/sandbags').on('child_removed', snap => {
            const mesh = window.sandbagsList[snap.key];
            if (mesh && scene) {
                scene.remove(mesh);
                delete window.sandbagsList[snap.key];
            }
        });
    }
}, 3000);

// 6. Roll Call (Attendance) & Cabinet Decoration
window.triggerRollCall = () => {
    if (!STATE.currentUser || !db) return;
    const now = Date.now();
    const lastTime = STATE.currentUser.lastRollCallTime || 0;
    if (now - lastTime < 12 * 60 * 60 * 1000) {
        const leftSecs = Math.ceil((12 * 60 * 60 * 1000 - (now - lastTime)) / 1000);
        const leftHrs = Math.floor(leftSecs / 3600);
        const leftMins = Math.floor((leftSecs % 3600) / 60);
        alert(`🫡 오늘 점호 행사는 이미 참여하셨습니다!\n다음 점호 가능 시간까지 ${leftHrs}시간 ${leftMins}분 남았습니다.`);
        return;
    }
    
    STATE.currentUser.money = (STATE.currentUser.money || 0) + 500;
    STATE.currentUser.lastRollCallTime = now;
    db.ref('users/' + STATE.currentUser.uid).update({
        money: STATE.currentUser.money,
        lastRollCallTime: now
    }).then(() => {
        gainEXP(100, "일일 점호 완료");
        showToast("🫡 충성! 아침/저녁 점호 완료! 포상금 +500G, +100 EXP", "#22c55e");
        alert("🫡 충성! 아침/저녁 점호 행사에 정상 참여하여 포상금 500G 및 100 EXP가 지급되었습니다.");
    });
};

window.openGuideModal = () => {
    const gm = document.getElementById('guide-modal');
    if (gm) gm.style.display = 'flex';
};

window.changeVipSkin = (skinId, skinName) => {
    if (!STATE.currentUser || STATE.currentUser.username !== 'ree1203') return;
    
    window.activeSkin = skinId;
    window.isDressUniform = (skinId === 'dress_uniform');
    
    window.refreshPlayerSkin(window.localPlayerBody, skinId, STATE.currentUser.rank, (skinId === 'camo_jail'));
    
    if (db) {
        db.ref('users/' + STATE.currentUser.uid).update({ activeSkin: skinId });
    }
    
    showToast(`👚 의상을 [${skinName}](으)로 변경했습니다!`, "#a855f7");
    
    const vdm = document.getElementById('vip-dress-modal');
    if (vdm) vdm.style.display = 'none';
};

window.openCabinetModal = () => {
    const modal = document.getElementById('cabinet-modal');
    const slotsDiv = document.getElementById('cabinet-slots');
    if (!modal || !slotsDiv) return;
    
    slotsDiv.innerHTML = '<div style="color:#aaa;">인벤토리 불러오는 중...</div>';
    modal.style.display = 'flex';
    
    db.ref('users/' + STATE.currentUser.uid).once('value', snap => {
        const user = snap.val() || {};
        const inv = user.inventory || {};
        const cabinet = user.cabinet || [];
        
        const ownedItems = Object.values(inv);
        slotsDiv.innerHTML = '';
        
        for (let i = 0; i < 3; i++) {
            const slotVal = cabinet[i] || '';
            const itemSelect = document.createElement('select');
            itemSelect.id = `cabinet-slot-${i}`;
            itemSelect.style.cssText = 'width: 100%; padding: 10px; background: #223022; color: white; border: 1px solid var(--tactical-neon); border-radius: 6px; font-weight: bold; margin-bottom: 8px;';
            
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = `비어 있음 (Slot ${i+1})`;
            itemSelect.appendChild(emptyOpt);
            
            const uniqueOwned = Array.from(new Set(ownedItems));
            uniqueOwned.forEach(itemId => {
                const opt = document.createElement('option');
                opt.value = itemId;
                opt.textContent = itemId.toUpperCase();
                if (slotVal === itemId) opt.selected = true;
                itemSelect.appendChild(opt);
            });
            
            const label = document.createElement('label');
            label.style.cssText = 'font-size: 0.75rem; color: #888; display: block; margin-bottom: 4px;';
            label.textContent = `진열 슬롯 ${i+1}`;
            slotsDiv.appendChild(label);
            slotsDiv.appendChild(itemSelect);
        }
    });
};

window.saveCabinetSetup = () => {
    const c1 = document.getElementById('cabinet-slot-0').value;
    const c2 = document.getElementById('cabinet-slot-1').value;
    const c3 = document.getElementById('cabinet-slot-2').value;
    
    const cabinet = [c1, c2, c3].filter(Boolean);
    db.ref('users/' + STATE.currentUser.uid).update({ cabinet: cabinet }).then(() => {
        showToast("🗄️ 개인 관물대 배치가 저장되었습니다!", "#22c55e");
        document.getElementById('cabinet-modal').style.display = 'none';
    });
};

window.enterCctvMode = (cctvId) => {
    window.isCctvActive = true;
    window.cctvScreenId = cctvId;
    if (velocity) velocity.set(0, 0, 0);
    
    if (window.localWeapon) window.localWeapon.visible = false;
    
    const cctvCameras = {
        cctv_canteen: { pos: { x: 60, y: 7, z: 20 }, look: { x: 60, y: 0, z: 0 } },
        cctv_gym: { pos: { x: -30, y: 9, z: 90 }, look: { x: -30, y: 0, z: 80 } },
        cctv_px: { pos: { x: 30, y: 7, z: 90 }, look: { x: 30, y: 0, z: 80 } },
        cctv_barracks: { pos: { x: -60, y: 9, z: 25 }, look: { x: -60, y: 0, z: 0 } }
    };
    
    const camData = cctvCameras[cctvId];
    if (camData) {
        if (!window.cctvPrePosition) {
            window.cctvPrePosition = camera.position.clone();
            window.cctvPreRotation = camera.rotation.clone();
        }
        
        camera.position.set(camData.pos.x, camData.pos.y, camData.pos.z);
        camera.lookAt(new THREE.Vector3(camData.look.x, camData.look.y, camData.look.z));
        
        const cctvOverlay = document.getElementById('cctv-overlay');
        if (cctvOverlay) {
            cctvOverlay.style.display = 'flex';
            let camName = "";
            if (cctvId === 'cctv_canteen') camName = "병영식당 입구 [CH 01]";
            else if (cctvId === 'cctv_gym') camName = "체력단련실 내부 [CH 02]";
            else if (cctvId === 'cctv_px') camName = "WA-MART PX [CH 03]";
            else if (cctvId === 'cctv_barracks') camName = "생활관 진입구 [CH 04]";
            document.getElementById('cctv-camera-name').textContent = camName;
        }
        
        showToast("🛰️ CCTV 화면 전환: " + (cctvId === 'cctv_canteen' ? "식당" : cctvId === 'cctv_gym' ? "체력단련실" : cctvId === 'cctv_px' ? "PX" : "생활관"), "#00ff00");
    }
};

window.exitCctvMode = () => {
    if (!window.isCctvActive) return;
    window.isCctvActive = false;
    if (velocity) velocity.set(0, 0, 0);
    
    if (window.cctvPrePosition) {
        camera.position.copy(window.cctvPrePosition);
        camera.rotation.copy(window.cctvPreRotation);
        window.cctvPrePosition = null;
        window.cctvPreRotation = null;
    }
    
    if (window.localWeapon && !window.isThirdPerson) window.localWeapon.visible = true;
    
    const cctvOverlay = document.getElementById('cctv-overlay');
    if (cctvOverlay) cctvOverlay.style.display = 'none';
    
    showToast("🛰️ CCTV 모니터링을 종료하고 복귀했습니다.", "#deb887");
};

// ====================================================
// MARSHAL'S OFFICE SPECIAL FUNCTION CALLBACKS & SIREN
// ====================================================
let sirenOscillator = null;
let sirenGain = null;
let sirenInterval = null;
let sirenCtx = null;

const startSirenAudio = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        sirenCtx = new AudioContext();
        sirenOscillator = sirenCtx.createOscillator();
        sirenGain = sirenCtx.createGain();
        
        sirenOscillator.type = 'sawtooth';
        sirenOscillator.frequency.setValueAtTime(300, sirenCtx.currentTime);
        sirenGain.gain.setValueAtTime(0.15, sirenCtx.currentTime);
        
        sirenOscillator.connect(sirenGain);
        sirenGain.connect(sirenCtx.destination);
        sirenOscillator.start();
        
        let time = sirenCtx.currentTime;
        sirenInterval = setInterval(() => {
            if (!sirenCtx || sirenCtx.state === 'closed') return;
            const now = sirenCtx.currentTime;
            sirenOscillator.frequency.cancelScheduledValues(now);
            sirenOscillator.frequency.setValueAtTime(sirenOscillator.frequency.value, now);
            sirenOscillator.frequency.linearRampToValueAtTime(800, now + 1.0);
            sirenOscillator.frequency.linearRampToValueAtTime(300, now + 2.0);
        }, 2000);
    } catch (e) {
        console.warn("Siren Audio Context failed:", e);
    }
};

const stopSirenAudio = () => {
    if (sirenInterval) {
        clearInterval(sirenInterval);
        sirenInterval = null;
    }
    if (sirenOscillator) {
        try { sirenOscillator.stop(); } catch(e){}
        sirenOscillator.disconnect();
        sirenOscillator = null;
    }
    if (sirenGain) {
        sirenGain.disconnect();
        sirenGain = null;
    }
    if (sirenCtx) {
        try { sirenCtx.close(); } catch(e){}
        sirenCtx = null;
    }
};

window.triggerGoldenArmory = () => {
    const isMarshal = STATE.currentUser && (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수');
    if (!isMarshal) {
        showToast("🔒 이 무기고는 원수(이주람) 전용입니다!", "#ff3333");
        return;
    }
    window.equipWeapon('golden_k2');
    db.ref('users/' + STATE.currentUser.uid + '/inventory').once('value', snap => {
        const inv = snap.val() || {};
        if (!Object.values(inv).includes('golden_k2')) {
            db.ref('users/' + STATE.currentUser.uid + '/inventory').push('golden_k2');
        }
    });
};

window.triggerEmergencySiren = () => {
    const isMarshal = STATE.currentUser && (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수');
    if (!isMarshal) {
        showToast("🔒 비상 사이렌 단추는 원수(이주람)님만 누를 수 있습니다.", "#ff3333");
        return;
    }
    db.ref('system/siren_emergency').once('value', snap => {
        const nextState = !snap.val();
        db.ref('system/siren_emergency').set(nextState).then(() => {
            showToast(nextState ? "🚨 비상 경보 발령!" : "🟢 비상 경보 해제", nextState ? "#ff3333" : "#00ff00");
        });
    });
};

window.triggerEscapeHatch = () => {
    const isMarshal = STATE.currentUser && (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수');
    if (!isMarshal) {
        showToast("🔒 비밀 탈출구는 원수 전용입니다.", "#ff3333");
        return;
    }
    camera.position.set(0, -38.4, -150);
    showToast("🌀 지하 벙커로 대피했습니다!", "#deb887");
};

window.triggerBunkerExit = () => {
    camera.position.set(0, 1.6, -142);
    showToast("🚀 원수실로 복귀했습니다!", "#deb887");
};

window.triggerWardrobe = () => {
    const isMarshal = STATE.currentUser && (STATE.currentUser.username === 'ree1203' || STATE.currentUser.rank === '원수');
    if (!isMarshal) {
        showToast("🔒 옷장은 원수 전용입니다.", "#ff3333");
        return;
    }
    window.isDressUniform = !window.isDressUniform;
    showToast(window.isDressUniform ? "🎖️ 원수 정복을 장착했습니다!" : " 기성 군복으로 환복했습니다.", "#ffffff");
    window.localPlayerLastColor = null;
};

setTimeout(() => {
    if (db) {
        db.ref('system/siren_emergency').on('value', snap => {
            const active = snap.val();
            const overlay = document.getElementById('emergency-overlay');
            if (overlay) {
                overlay.style.display = active ? 'block' : 'none';
            }
            if (active) {
                showToast("🚨 [비상 계엄] 기지 전체에 비상 사태가 선포되었습니다! 대피하십시오!", "#ff0000");
                if (!window.sirenAudioActive) {
                    window.sirenAudioActive = true;
                    startSirenAudio();
                }
            } else {
                if (window.sirenAudioActive) {
                    window.sirenAudioActive = false;
                    stopSirenAudio();
                }
            }
        });
    }
}, 3000);

// ====================================================
// NEW MILITARY DISCIPLINE (얼차려) SYSTEM
// ====================================================
window.currentPunishment = null;
window.punishmentProgress = 0;
window.punishmentTarget = 0;

window.triggerPunishment = (type, isSelfTriggered = false) => {
    if (!STATE.currentUser) return;
    
    // ree1203 immunity and reflection (skipped if self-triggered for testing)
    if (STATE.currentUser.username === 'ree1203' && !isSelfTriggered) {
        showToast("🛡️ 마스터(ree1203)에게는 얼차려를 부여할 수 없습니다! 징계가 반사되었습니다.", "#ff0000");
        db.ref('users/' + STATE.currentUser.uid + '/punishment').remove();
        
        // Reverse punish: Find other online users and punish them!
        db.ref('presence').once('value', presenceSnap => {
            const players = presenceSnap.val() || {};
            Object.keys(players).forEach(pUid => {
                if (pUid !== STATE.currentUser.uid) {
                    db.ref('users/' + pUid).update({
                        punishment: type,
                        punishmentTime: Date.now() + 60000,
                        punishedBy: 'ree1203'
                    });
                }
            });
        });
        return;
    }
    
    const isSenior = !["훈련병", "이등병", "일등병"].includes(STATE.currentUser.rank);
    window.currentPunishment = type;
    
    const overlay = document.getElementById('punishment-overlay');
    const desc = document.getElementById('punishment-desc');
    const interactive = document.getElementById('punishment-interactive-container');
    const counter = document.getElementById('punishment-counter');
    const progContainer = document.getElementById('punishment-progress-bar-container');
    const progBar = document.getElementById('punishment-progress-bar');
    
    if (!overlay) return;
    
    overlay.style.display = 'flex';
    progContainer.style.display = 'none';
    interactive.innerHTML = '';
    counter.textContent = '';
    
    window.lightningStunActive = true; // Freeze movement
    
    let label = "";
    switch(type) {
        case 'pushups':
            window.punishmentTarget = isSenior ? 100 : 80;
            window.punishmentProgress = 0;
            label = `💪 팔굽혀펴기 훈련 (${isSenior ? '상·병장: 100회' : '일·이병: 80회'})`;
            desc.textContent = `${label}\n아래 마우스 클릭 또는 [Space] 키를 눌러 팔굽혀펴기를 실시하십시오.`;
            
            interactive.innerHTML = `<button onclick="doPushupClick()" style="padding:15px 30px; background:#e11d48; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; color:#fff;">팔굽혀펴기 (Push-up)</button>`;
            
            window.doPushupClick = () => {
                window.punishmentProgress++;
                counter.textContent = `${window.punishmentProgress} / ${window.punishmentTarget} 회 완료`;
                
                // Camera dip animation
                if (typeof camera !== 'undefined') {
                    new TWEEN.Tween(camera.position)
                        .to({ y: 0.5 }, 200)
                        .chain(
                            new TWEEN.Tween(camera.position).to({ y: 1.6 }, 200)
                        )
                        .start();
                }
                
                if (window.punishmentProgress >= window.punishmentTarget) {
                    window.finishPunishment();
                }
            };
            
            // Allow space key as well
            window._punishKeyHandler = (e) => {
                if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    window.doPushupClick();
                }
            };
            window.addEventListener('keydown', window._punishKeyHandler);
            break;
            
        case 'squats':
            window.punishmentTarget = isSenior ? 100 : 80;
            window.punishmentProgress = 0;
            label = `🏋️ 앉았다 일어서기 훈련 (${isSenior ? '상·병장: 100회' : '일·이병: 80회'})`;
            desc.textContent = `${label}\n아래 마우스 클릭 또는 [Space] 키를 눌러 앉았다 일어서기를 실시하십시오.`;
            
            interactive.innerHTML = `<button onclick="doSquatClick()" style="padding:15px 30px; background:#ea580c; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; color:#fff;">앉았다 일어서기 (Squat)</button>`;
            
            window.doSquatClick = () => {
                window.punishmentProgress++;
                counter.textContent = `${window.punishmentProgress} / ${window.punishmentTarget} 회 완료`;
                
                // Camera dip animation
                if (typeof camera !== 'undefined') {
                    new TWEEN.Tween(camera.position)
                        .to({ y: 0.8 }, 200)
                        .chain(
                            new TWEEN.Tween(camera.position).to({ y: 1.6 }, 200)
                        )
                        .start();
                }
                
                if (window.punishmentProgress >= window.punishmentTarget) {
                    window.finishPunishment();
                }
            };
            
            window._punishKeyHandler = (e) => {
                if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    window.doSquatClick();
                }
            };
            window.addEventListener('keydown', window._punishKeyHandler);
            break;
            
        case 'walking':
        case 'running':
            window.lightningStunActive = false; // Allow movement
            window.punishmentTarget = isSenior ? 250 : 180;
            window.punishmentProgress = 0;
            
            label = type === 'walking' ? `🚶 단독군장 보행 (${isSenior ? '상·병장: 4km -> 게임내 250m' : '일·이병: 3km -> 게임내 180m'})` : `🏃 뜀걸음 (${isSenior ? '상·병장: 4km -> 게임내 250m' : '일·이병: 2km -> 게임내 180m'})`;
            desc.textContent = `${label}\n작전 구역을 돌아다니며 규정 거리를 이동하십시오. (다른 행동 금지)`;
            
            progContainer.style.display = 'block';
            progBar.style.width = '0%';
            
            let lastPos = camera.position.clone();
            window._punishInterval = setInterval(() => {
                const dist = camera.position.distanceTo(lastPos);
                if (dist > 0.05) {
                    window.punishmentProgress += dist;
                    const pct = Math.min(100, (window.punishmentProgress / window.punishmentTarget) * 100);
                    progBar.style.width = `${pct}%`;
                    counter.textContent = `${Math.floor(window.punishmentProgress)}m / ${window.punishmentTarget}m 이동 완료`;
                    lastPos = camera.position.clone();
                    
                    if (window.punishmentProgress >= window.punishmentTarget) {
                        clearInterval(window._punishInterval);
                        window.finishPunishment();
                    }
                }
            }, 200);
            break;
            
        case 'circuit':
            window.punishmentTarget = isSenior ? 40 : 30; // seconds
            window.punishmentProgress = window.punishmentTarget;
            label = `🔄 순환식 체력단련 (${isSenior ? '상·병장: 40분 -> 40초' : '일·이병: 30분 -> 30초'})`;
            desc.textContent = `${label}\n체력 증진을 위해 명시된 시간 동안 자리를 지키며 단련하십시오.`;
            
            progContainer.style.display = 'block';
            progBar.style.width = '100%';
            
            window._punishInterval = setInterval(() => {
                window.punishmentProgress--;
                const pct = (window.punishmentProgress / window.punishmentTarget) * 100;
                progBar.style.width = `${pct}%`;
                counter.textContent = `남은 시간: ${window.punishmentProgress}초`;
                
                if (window.punishmentProgress <= 0) {
                    clearInterval(window._punishInterval);
                    window.finishPunishment();
                }
            }, 1000);
            break;
            
        case 'cleaning':
            window.punishmentTarget = 15;
            window.punishmentProgress = 0;
            label = `🧹 특정지역 청소 (15개 구역)`;
            desc.textContent = `${label}\n막사 주변을 청소하십시오. 아래 버튼을 연속으로 눌러 빗자루질을 완료하십시오.`;
            
            interactive.innerHTML = `<button onclick="doCleanClick()" style="padding:15px 30px; background:#10b981; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; color:#fff;">🧹 빗자루질 (Sweep)</button>`;
            
            window.doCleanClick = () => {
                window.punishmentProgress++;
                counter.textContent = `${window.punishmentProgress} / ${window.punishmentTarget} 회 완료`;
                
                if (window.punishmentProgress >= window.punishmentTarget) {
                    window.finishPunishment();
                }
            };
            break;
            
        case 'meditation':
            window.punishmentTarget = isSenior ? 40 : 20;
            window.punishmentProgress = window.punishmentTarget;
            label = `🧘 참선 훈련 (${isSenior ? '상·병장: 40분 -> 40초' : '일·이병: 20분 -> 20초'})`;
            desc.textContent = `${label}\n정신 수양을 위해 움직이지 않고 마음을 가다듬으십시오. (움직이면 시간 리셋)`;
            
            progContainer.style.display = 'block';
            progBar.style.width = '100%';
            
            let startPos = camera.position.clone();
            window._punishInterval = setInterval(() => {
                const moved = camera.position.distanceTo(startPos) > 0.5;
                if (moved) {
                    window.punishmentProgress = window.punishmentTarget; // Reset timer
                    startPos = camera.position.clone();
                    showToast("⚠️ 참선 중에 움직였습니다! 시간이 초기화됩니다.", "#ef4444");
                } else {
                    window.punishmentProgress--;
                }
                const pct = (window.punishmentProgress / window.punishmentTarget) * 100;
                progBar.style.width = `${pct}%`;
                counter.textContent = `남은 참선 시간: ${window.punishmentProgress}초`;
                
                if (window.punishmentProgress <= 0) {
                    clearInterval(window._punishInterval);
                    window.finishPunishment();
                }
            }, 1000);
            break;
            
        case 'reflection':
            overlay.style.display = 'none';
            window.lightningStunActive = true;
            
            const refModal = document.getElementById('reflection-modal');
            const refText = document.getElementById('reflection-textarea');
            const refCount = document.getElementById('reflection-char-count');
            const refReq = document.getElementById('reflection-required-count');
            const refRankInfo = document.getElementById('reflection-rank-info');
            const refBtn = document.getElementById('btn-submit-reflection');
            
            if (refModal && refText && refCount && refReq && refRankInfo && refBtn) {
                refRankInfo.textContent = `${STATE.currentUser.name} (${STATE.currentUser.rank})`;
                const required = isSenior ? 1000 : 500;
                refReq.textContent = required;
                refText.value = '';
                refCount.textContent = '0';
                refCount.style.color = '#ef4444';
                refBtn.disabled = true;
                refBtn.style.opacity = '0.5';
                refBtn.style.cursor = 'not-allowed';
                
                refModal.style.display = 'flex';
                
                refText.oninput = () => {
                    const len = refText.value.length;
                    refCount.textContent = len;
                    if (len >= required) {
                        refCount.style.color = '#22c55e';
                        refBtn.disabled = false;
                        refBtn.style.opacity = '1.0';
                        refBtn.style.cursor = 'pointer';
                    } else {
                        refCount.style.color = '#ef4444';
                        refBtn.disabled = true;
                        refBtn.style.opacity = '0.5';
                        refBtn.style.cursor = 'not-allowed';
                    }
                };
            }
            break;
            
        case 'digging':
            window.punishmentTarget = isSenior ? 60 : 40;
            window.punishmentProgress = 0;
            label = `⛏️ 개인호 파고 되메우기 (${isSenior ? '상·병장: 60분 -> 60회' : '일·이병: 40분 -> 40회'})`;
            desc.textContent = `${label}\n개인 참호를 파고 흙으로 다시 메우십시오. 마우스를 광클하십시오!`;
            
            interactive.innerHTML = `<button onclick="doDigClick()" style="padding:15px 30px; background:#b45309; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer; color:#fff;">⛏️ 삽질 (Dig)</button>`;
            
            window.doDigClick = () => {
                window.punishmentProgress++;
                counter.textContent = `${window.punishmentProgress} / ${window.punishmentTarget} 회 삽질 완료`;
                
                if (typeof camera !== 'undefined') {
                    new TWEEN.Tween(camera.position)
                        .to({ y: 1.0 }, 150)
                        .chain(
                            new TWEEN.Tween(camera.position).to({ y: 1.6 }, 150)
                        )
                        .start();
                }
                
                if (window.punishmentProgress >= window.punishmentTarget) {
                    window.finishPunishment();
                }
            };
            break;
            
        default:
            window.punishmentTarget = 6;
            window.punishmentProgress = 0;
            label = "🚨 군기 훈련 (PT 체조)";
            desc.textContent = `${label}\n자동 PT체조가 집행 중입니다. 자리를 지켜 주십시오.`;
            
            window._punishInterval = setInterval(() => {
                if (camera && camera.position.y <= 1.7) {
                    if (typeof velocity !== 'undefined' && velocity) velocity.y = 8.0;
                }
                window.punishmentProgress++;
                counter.textContent = `${window.punishmentProgress} / 6회 완료`;
                if (window.punishmentProgress >= 6) {
                    clearInterval(window._punishInterval);
                    window.finishPunishment();
                }
            }, 800);
            break;
    }
};

window.finishPunishment = () => {
    if (window._punishKeyHandler) {
        window.removeEventListener('keydown', window._punishKeyHandler);
        window._punishKeyHandler = null;
    }
    if (window._punishInterval) {
        clearInterval(window._punishInterval);
        window._punishInterval = null;
    }
    
    const overlay = document.getElementById('punishment-overlay');
    if (overlay) overlay.style.display = 'none';
    
    window.lightningStunActive = false;
    window.currentPunishment = null;
    
    if (STATE.currentUser && STATE.currentUser.uid && db) {
        db.ref('users/' + STATE.currentUser.uid + '/punishment').remove();
        db.ref('presence/' + STATE.currentUser.uid + '/punishment').remove();
    }
    
    window.changeDiscipline(60, "얼차려 규정 이수 완료");
    if (typeof showToast === 'function') showToast("🫡 군기 훈련을 우수하게 마쳐 부대로 복귀 조치되었습니다!", "#22c55e");
};

window.submitReflectionLetter = () => {
    const text = document.getElementById('reflection-textarea').value;
    const isSenior = !["훈련병", "이등병", "일등병"].includes(STATE.currentUser.rank);
    const required = isSenior ? 1000 : 500;
    
    if (text.length < required) return alert("글자 수가 아직 부족합니다!");
    
    if (db && STATE.currentUser) {
        db.ref('system/reflection_letters').push({
            writer: STATE.currentUser.name,
            rank: STATE.currentUser.rank,
            content: text,
            timestamp: Date.now()
        });
    }
    
    const refModal = document.getElementById('reflection-modal');
    if (refModal) refModal.style.display = 'none';
    
    window.finishPunishment();
};

// ====================================================
// SYSTEM R: REWARDED ADS (보상형 광고 시스템)
// ====================================================
const mockAds = [
    { title: "🥪 군대리아 치킨버거 스페셜", desc: "바삭한 치킨 패티와 달콤한 딸기잼의 환상적인 하모니. 오늘 PX에서 만나보세요!", sponsor: "협찬: 육군 군수사령부 복지단" },
    { title: "🌶️ 맛다시 고추장 볶음 소스", desc: "밥 한 공기 뚝딱! 전투식량과 최상의 궁합을 자랑하는 군인 필수 밥도둑 소스 PX 전격 판매 중.", sponsor: "협찬: 군인공제회 식품사업부" },
    { title: "🧥 황금 깔깔이 패션웨어", desc: "겨울철 완벽한 보온성과 트렌디한 디지털 패턴의 조화. 행정반 승인을 받은 최고의 동계 방한복!", sponsor: "협찬: 국방기술품질원 인증 의류" },
    { title: "🪖 정예 부사관/장교 모집 광고", desc: "대한민국 국방의 미래, 바로 당신입니다. 정예 강군 육군의 일원이 되어 조국 수호의 보람을 느껴보세요!", sponsor: "협찬: 대한민국 국방부 및 육군본부" },
    { title: "🍪 건빵 1+1 특별 사은행사", desc: "오리지널 쌀건빵과 달콤한 별사탕의 완벽한 조합. 주람 마트(PX)에서 오늘 하루만 1+1 제공!", sponsor: "협찬: 주람복지재단 PX유통본부" }
];

window.showRewardedAd = (rewardType, callback) => {
    // 광고 제거: 즉시 완료 처리
    showToast("✨ 광고가 제거되어 보상이 즉시 지급되었습니다!", "#22c55e");
    callback(true);
};

const showMockAd = (rewardType, callback) => {
    const modal = document.getElementById('ad-player-modal');
    if (!modal) {
        console.error("Ad player modal element not found.");
        return callback(false);
    }

    // Select random ad content
    const randomAd = mockAds[Math.floor(Math.random() * mockAds.length)];
    document.getElementById('ad-text-title').textContent = randomAd.title;
    document.getElementById('ad-text-desc').textContent = randomAd.desc;
    document.getElementById('ad-text-sponsor').textContent = randomAd.sponsor;

    // Reset UI state
    const timerText = document.getElementById('ad-timer');
    const progressBar = document.getElementById('ad-progress-bar');
    const closeBtn = document.getElementById('ad-close-btn');

    timerText.textContent = "보상 지급까지 5초 남았습니다...";
    timerText.style.color = "#ef4444";
    
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    // Force a reflow
    void progressBar.offsetWidth;
    progressBar.style.transition = 'width 5s linear';
    progressBar.style.width = '100%';

    closeBtn.disabled = true;
    closeBtn.textContent = "광고 시청 완료 후 닫기";
    closeBtn.style.background = "rgba(255,255,255,0.1)";
    closeBtn.style.color = "#888";
    closeBtn.style.cursor = "not-allowed";

    // Show modal
    modal.style.display = 'flex';

    let countdown = 5;
    const adTimerInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            timerText.textContent = `보상 지급까지 ${countdown}초 남았습니다...`;
        } else {
            clearInterval(adTimerInterval);
            timerText.textContent = "✅ 광고 시청 완료! 보상이 지급되었습니다.";
            timerText.style.color = "#22c55e";

            // Enable close button
            closeBtn.disabled = false;
            closeBtn.textContent = "닫기 및 보상 수령";
            closeBtn.style.background = "linear-gradient(135deg, #4b5320, #556b2f)";
            closeBtn.style.color = "white";
            closeBtn.style.cursor = "pointer";
            closeBtn.style.border = "1px solid #deb887";
            closeBtn.style.boxShadow = "0 4px 15px rgba(75, 83, 32, 0.5)";
        }
    }, 1000);

    closeBtn.onclick = () => {
        if (countdown <= 0) {
            modal.style.display = 'none';
            callback(true);
        }
    };
};

window.triggerFreeMoneyAd = () => {
    if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
    
    window.showRewardedAd('free_money', (success) => {
        if (success) {
            const rewardG = 1000;
            STATE.currentUser.money = (STATE.currentUser.money || 0) + rewardG;
            if (db && STATE.currentUser.uid) {
                db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
            }
            
            // Sync UI in Lobby if lobby stats are rendered
            const lobbyMoney = document.getElementById('lobby-money');
            if (lobbyMoney) {
                lobbyMoney.textContent = STATE.currentUser.money.toLocaleString();
            }
            const hudMoney = document.getElementById('hud-money');
            if (hudMoney) {
                hudMoney.textContent = STATE.currentUser.money.toLocaleString();
            }
            
            showToast(`💰 광고 시청 보상으로 군자금 1,000G가 입금되었습니다!`, "#fbbf24");
        }
    });
};

// ====================================================
// SYSTEM: CREATOR & SUB-CREATOR BOSS BATTLES (제작진 결투)
// ====================================================
window.bossHp = 0;
window.bossMaxHp = 500;
window.bossMesh = null;
window.bossLabel = null;
window.activeBossType = null; // 'creator' or 'sub_creator'
window.activeProximityTarget = null; // 'creator', 'sub_creator', or null
let lastBossAction = 0;

window.bossPhase = 1;
window.isBossEvolving = false;
window.bossSpeedDebuffActive = false;
window.bossShieldActive = false;
window.activeBossProjectiles = [];
window.activeLootDrops = [];

const BOSS_CONFIGS = {
    creator: {
        id: 'ree1203',
        name: '제작진 킹',
        maxHp: 3000,
        color: 0xff0055,
        reward: 0, // Loot items are direct physical drops
        spawnPos: { x: -25, y: 1.6, z: -35 },
        // Lore stats from the official boss card (display only - HP already uses the same x50 scale)
        atk: 12000,
        def: 8500,
        spdLabel: '매우 빠름',
        flightSpdLabel: '초고속',
        manaLabel: 'MAX',
        intLabel: 'MAX',
        weaknesses: ['빛 속성 공격에 취약 (1.5배 피해)', '협동(다중) 공격에 취약', '정면보다 후면 공격에 취약 (1.5배 피해)'],
        taunts: [
            "제작진 킹: '버그 없는 코드는 내 실력, 넌 그냥 유저일 뿐!'",
            "제작진 킹: '내 지휘를 거역할 셈이냐?'",
            "제작진 킹: '이 게임의 룰은 내가 정한다!'",
            "제작진 킹: '그 정도 사격술로 날 꺾을 수 있겠나?'"
        ]
    },
    sub_creator: {
        id: '한space',
        name: '부제작자 한우주 준장',
        maxHp: 400,
        color: 0x3b82f6,
        reward: 3000,
        spawnPos: { x: 25, y: 1.6, z: -35 },
        taunts: [
            "한우주 준장: '부제작진이라고 얕봤다간 큰코다칠 거다!'",
            "한우주 준장: '전술 무기 맛을 한번 보여주지!'",
            "한우주 준장: '서포터의 매운맛을 보여주마!'",
            "한우주 준장: '지휘관의 백업 화력은 장난이 아니라고!'"
        ]
    }
};

const playExplosionSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(10, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch(e){}
};

const playThunderSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(5, ctx.currentTime + 1.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
    } catch(e){}
};

window.updateBossLabelUI = () => {
    if (!window.bossMesh || !window.bossLabel) return;
    const config = BOSS_CONFIGS[window.activeBossType] || BOSS_CONFIGS.creator;
    
    const displayName = (window.activeBossType === 'creator' && window.bossPhase === 2) ? '우주 창조신 제작진' : config.name;
    const displayHp = window.bossHp * 50;
    const displayMaxHp = window.bossMaxHp * 50;

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    if (window.bossPhase === 2) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.8)'; // Purple Aura for Phase 2
    } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.75)'; // Red for normal
    }
    
    ctx.roundRect ? ctx.roundRect(0, 0, 512, 128, 20) : ctx.fillRect(0, 0, 512, 128);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Pretendard';
    ctx.textAlign = 'center';
    ctx.fillText(`[👑 보스] ${displayName}`, 256, 50);
    ctx.font = 'bold 30px Pretendard';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`HP: ${displayHp.toLocaleString()} / ${displayMaxHp.toLocaleString()}`, 256, 100);

    const tex = new THREE.CanvasTexture(canvas);
    window.bossLabel.material.map = tex;
    window.bossLabel.material.needsUpdate = true;
};

window.checkProximityInteractions = () => {
    if (!camera) return;
    
    // Proximity to Creator base (-25, 0, -40)
    const dCreatorX = camera.position.x - (-25);
    const dCreatorZ = camera.position.z - (-40);
    const distCreator = Math.sqrt(dCreatorX * dCreatorX + dCreatorZ * dCreatorZ);

    // Proximity to Sub-Creator base (25, 0, -40)
    const dSubX = camera.position.x - 25;
    const dSubZ = camera.position.z - (-40);
    const distSub = Math.sqrt(dSubX * dSubX + dSubZ * dSubZ);

    const promptHud = document.getElementById('interaction-prompt-hud');
    const promptTitle = document.getElementById('interaction-prompt-title');
    const promptDesc = document.getElementById('interaction-prompt-desc');

    if (window.bossHp > 0) {
        if (promptHud) promptHud.style.display = 'none';
        window.activeProximityTarget = null;
        return;
    }

    if (distCreator <= 8) {
        window.activeProximityTarget = 'creator';
        if (promptHud && promptTitle && promptDesc) {
            promptTitle.textContent = "[E] 제작자 결투 시작";
            promptDesc.textContent = "제작자 ree1203 대장과 1:1 결투를 시작합니다!";
            promptHud.style.display = 'block';
        }
    } else if (distSub <= 8) {
        window.activeProximityTarget = 'sub_creator';
        if (promptHud && promptTitle && promptDesc) {
            promptTitle.textContent = "[E] 부제작자 결투 시작";
            promptDesc.textContent = "부제작자 한space 준장과 1:1 결투를 시작합니다!";
            promptHud.style.display = 'block';
        }
    } else {
        window.activeProximityTarget = null;
        if (promptHud) promptHud.style.display = 'none';
    }
};

window.handleProximityInteraction = () => {
    if (window.activeProximityTarget === 'creator') {
        window.summonCreatorBoss('creator');
    } else if (window.activeProximityTarget === 'sub_creator') {
        window.summonCreatorBoss('sub_creator');
    }
};

window.updateBossStageVisual = () => {
    if (window.activeBossType !== 'creator' || !window.bossMesh) return;
    
    let targetStage = 4;
    if (window.bossPhase === 2) {
        targetStage = 5;
    } else {
        const hpPct = window.bossHp / window.bossMaxHp;
        if (hpPct >= 0.8) targetStage = 1;
        else if (hpPct >= 0.6) targetStage = 2;
        else if (hpPct >= 0.4) targetStage = 3;
        else targetStage = 4;
    }
    
    if (window.bossMesh.userData.creatorStage !== targetStage) {
        convertToCreatorModel(window.bossMesh, targetStage);
        showToast(`👑 제작진 킹이 ${targetStage}단계 형태로 변형됩니다!`, "#a855f7");
    }
};

window.summonCreatorBoss = (bossType = 'creator') => {
    if (bossType === 'creator' && (!STATE.currentUser || STATE.currentUser.username !== 'ree1203')) {
        showToast("🔒 이 보스전은 대장(ree1203)만 진행할 수 있습니다.", "#ff3333");
        return;
    }

    if (window.bossMesh) {
        scene.remove(window.bossMesh);
        if (otherPlayers['creator_boss']) {
            delete otherPlayers['creator_boss'];
        }
        window.bossMesh = null;
    }

    const config = BOSS_CONFIGS[bossType] || BOSS_CONFIGS.creator;
    window.activeBossType = bossType;
    window.bossHp = config.maxHp;
    window.bossMaxHp = config.maxHp;
    window.bossPhase = 1;
    window.isBossEvolving = false;
    window.bossSpeedDebuffActive = false;
    window.bossShieldActive = false;

    // Reset old items / projectiles
    if (window.activeBossProjectiles) {
        window.activeBossProjectiles.forEach(p => scene.remove(p.mesh));
    }
    window.activeBossProjectiles = [];

    if (window.activeLootDrops) {
        window.activeLootDrops.forEach(l => scene.remove(l.mesh));
    }
    window.activeLootDrops = [];

    const group = createPlayerModel(config.color);
    if (bossType === 'creator') {
        convertToCreatorModel(group, 1); // Start at stage 1
    }
    group.position.set(config.spawnPos.x, config.spawnPos.y, config.spawnPos.z);
    
    scene.add(group);
    window.bossMesh = group;

    if (bossType === 'creator') {
        window.updateBossStageVisual();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.roundRect ? ctx.roundRect(0, 0, 512, 128, 20) : ctx.fillRect(0, 0, 512, 128);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Pretendard';
    ctx.textAlign = 'center';
    ctx.fillText(`[👑 보스] ${config.name}`, 256, 50);
    ctx.font = 'bold 30px Pretendard';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`HP: ${(window.bossHp * 50).toLocaleString()} / ${(config.maxHp * 50).toLocaleString()}`, 256, 100);

    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.position.y = 3.2;
    sprite.scale.set(4, 1, 1);
    group.add(sprite);
    window.bossLabel = sprite;

    otherPlayers['creator_boss'] = {
        mesh: group,
        label: sprite,
        lastName: config.name,
        lastColor: config.color
    };

    showToast(`🚨 [보스전] ${config.name}이(가) 나타났습니다! 결투를 시작합니다!`, "#ff3333");
    if (bossType === 'creator' && config.atk) {
        setTimeout(() => {
            showToast(`👑 ${config.name} | 공격력 ${config.atk.toLocaleString()} · 방어력 ${config.def.toLocaleString()} · 이동속도 ${config.spdLabel}`, "#a855f7");
        }, 1200);
        setTimeout(() => {
            showToast(`⚠️ 약점: ${config.weaknesses.join(' / ')}`, "#facc15");
        }, 2600);
    }
};

window.triggerBossEvolution = () => {
    if (!window.bossMesh) return;
    
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 3.0);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 3.0);
        }
    } catch(e){}

    showToast("⚠️ 제작진 킹이 폭주합니다! '우주 창조신 제작진'으로 진화 중...", "#a855f7");
    
    // Shield visual
    const shieldGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const shieldMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.35,
        wireframe: true
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.name = 'bossEvolutionShield';
    window.bossMesh.add(shieldMesh);

    // Purple glowing emissive
    window.bossMesh.traverse(child => {
        if (child.isMesh && child.material) {
            child.material.emissive = new THREE.Color(0xa855f7);
            child.material.emissiveIntensity = 3.0;
        }
    });

    // Orbiting space rocks
    window.orbitingRocks = [];
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x1d1430,
        roughness: 0.9,
        metalness: 0.1
    });
    for (let i = 0; i < 5; i++) {
        const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.15);
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.userData = {
            angle: (i / 5) * Math.PI * 2,
            radius: 2.0 + Math.random() * 0.5,
            speed: 1.2 + Math.random() * 1.0,
            yOffset: -0.6 + Math.random() * 1.2
        };
        window.bossMesh.add(rock);
        window.orbitingRocks.push(rock);
    }

    setTimeout(() => {
        if (!window.bossMesh) return;
        window.bossMesh.remove(shieldMesh);
        
        window.bossHp = 3000; // Refill HP for Phase 2!
        window.bossMaxHp = 3000;
        window.bossPhase = 2;
        window.isBossEvolving = false;

        const config = BOSS_CONFIGS[window.activeBossType] || BOSS_CONFIGS.creator;
        config.name = '우주 창조신 제작진';
        
        window.updateBossStageVisual(); // Set to Stage 5 cosmic creator!
        window.updateBossLabelUI();
        showToast("👑 진화 완료! '우주 창조신 제작진'과의 최종 결투가 시작됩니다!", "#ff00ff");
    }, 3000);
};

window.damageCreatorBoss = (damage, hitPoint) => {
    if (window.bossHp <= 0 || !window.bossMesh || window.isBossEvolving) return;
    
    let finalDamage = damage;
    let isBackAttack = false;
    
    // 1. Co-op Attack Vulnerability (협동 공격 취약)
    let nearbyPlayers = 0;
    if (typeof otherPlayers !== 'undefined' && window.bossMesh) {
        Object.keys(otherPlayers).forEach(uid => {
            if (uid !== 'creator_boss') {
                const otherP = otherPlayers[uid];
                if (otherP && otherP.mesh) {
                    const distToBoss = otherP.mesh.position.distanceTo(window.bossMesh.position);
                    if (distToBoss < 20) {
                        nearbyPlayers++;
                    }
                }
            }
        });
    }
    if (nearbyPlayers > 0) {
        const coOpMult = Math.min(1.5, 1.2 + nearbyPlayers * 0.1);
        finalDamage = Math.floor(finalDamage * coOpMult);
        if (Math.random() < 0.25) {
            showToast(`👥 협동 공격 시너지 발동! 피해량 ${coOpMult.toFixed(1)}배!`, "#3b82f6");
        }
    }

    // 2. Light Vulnerability
    const activeWeapon = window.activeWeaponId;
    if (activeWeapon === 'golden_k2' || activeWeapon === 'marshal_card') {
        finalDamage = Math.floor(finalDamage * 1.5);
    }
    
    // 3. Back Attack Vulnerability
    if (window.bossMesh) {
        const boss = window.bossMesh;
        const bossDir = new THREE.Vector3(Math.sin(boss.rotation.y), 0, Math.cos(boss.rotation.y)).normalize();
        const toPlayer = new THREE.Vector3().subVectors(camera.position, boss.position);
        toPlayer.y = 0;
        toPlayer.normalize();
        
        const dot = bossDir.dot(toPlayer);
        if (dot < -0.2) {
            isBackAttack = true;
            finalDamage = Math.floor(finalDamage * 1.5);
        }
    }
    
    // 4. Shield protection
    if (window.bossShieldActive) {
        finalDamage = Math.max(1, Math.floor(finalDamage * 0.2));
    }
    
    window.bossHp = Math.max(0, window.bossHp - finalDamage);
    window.updateBossStageVisual();

    if (typeof window.spawnBloodSplatMesh === 'function' && hitPoint) {
        window.spawnBloodSplatMesh(hitPoint.x, hitPoint.y, hitPoint.z);
    }

    if (isBackAttack) {
        showToast(`🎯 후면 공격 성공! 1.5배 피해량 입힘!`, "#facc15");
    }

    // Phase 2 triggers at < 40% HP
    if (window.activeBossType === 'creator' && window.bossHp < window.bossMaxHp * 0.4 && window.bossPhase === 1 && !window.isBossEvolving) {
        window.isBossEvolving = true;
        window.triggerBossEvolution();
        window.bossHp = Math.floor(window.bossMaxHp * 0.4); // Keep at trigger
        window.updateBossLabelUI();
        return;
    }

    const config = BOSS_CONFIGS[window.activeBossType] || BOSS_CONFIGS.creator;
    window.updateBossLabelUI();

    if (Math.random() < 0.3) {
        const quote = config.taunts[Math.floor(Math.random() * config.taunts.length)];
        showToast(quote, "#facc15");
    }

    if (window.bossHp <= 0) {
        showToast(`🎉 [결투 승리] ${config.name}을(를) 물리쳤습니다! 보물이 드롭되었습니다!`, "#22c55e");
        
        // Spawn physical loot
        if (typeof window.spawnBossLoot === 'function') {
            window.spawnBossLoot(window.bossMesh.position.clone());
        }

        scene.remove(window.bossMesh);
        delete otherPlayers['creator_boss'];
        window.bossMesh = null;
    }
};

window.executeBossSkill = (type) => {
    if (!window.bossMesh || window.bossHp <= 0 || window.isBossEvolving) return;
    
    const boss = window.bossMesh;
    const player = camera.position;
    
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        }
    } catch(e){}

    const displayName = window.bossPhase === 2 ? '우주 창조신 제작진' : '제작진 킹';

    if (type === 'idea_explosion') {
        showToast(`💡 ${displayName}: '아이디어 폭발!'`, "#a855f7");
        
        const sphereGeo = new THREE.SphereGeometry(0.55, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: 0xa855f7,
            transparent: true,
            opacity: 0.9,
            emissive: 0xa855f7,
            emissiveIntensity: 1.5
        });
        const mesh = new THREE.Mesh(sphereGeo, sphereMat);
        mesh.position.set(boss.position.x, boss.position.y + 0.5, boss.position.z);
        scene.add(mesh);
        
        const dir = new THREE.Vector3().subVectors(player, mesh.position).normalize();
        
        window.activeBossProjectiles.push({
            type: 'idea_explosion',
            mesh: mesh,
            dir: dir,
            speed: 15.0,
            damage: 22,
            createdAt: Date.now(),
            duration: 5000
        });
    }
    else if (type === 'concept_typhoon') {
        showToast(`🌀 ${displayName}: '콘셉트 태풍!'`, "#06b6d4");
        
        const cyGeo = new THREE.CylinderGeometry(0.5, 6.0, 7.0, 16, 1, true);
        const cyMat = new THREE.MeshBasicMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            wireframe: true
        });
        const whirlwind = new THREE.Mesh(cyGeo, cyMat);
        whirlwind.position.set(boss.position.x, boss.position.y, boss.position.z);
        scene.add(whirlwind);
        
        const pullStart = Date.now();
        const pullInterval = setInterval(() => {
            if (!window.bossMesh || window.bossHp <= 0 || Date.now() - pullStart > 2000) {
                clearInterval(pullInterval);
                scene.remove(whirlwind);
                return;
            }
            
            whirlwind.rotation.y += 0.2;
            whirlwind.position.copy(boss.position);
            
            const toBoss = new THREE.Vector3().subVectors(boss.position, camera.position);
            const dist = toBoss.length();
            if (dist > 1.8) {
                toBoss.normalize();
                const deltaPull = 0.18; 
                camera.position.addScaledVector(toBoss, deltaPull);
            }
        }, 16);
    }
    else if (type === 'deadline_hell') {
        showToast(`🚨 ${displayName}: '마감 지옥!' (이동 속도 대폭 감소)`, "#ec4899");
        
        const ringGeo = new THREE.RingGeometry(0.1, 8.0, 32);
        ringGeo.rotation.x = -Math.PI / 2;
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xec4899,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(boss.position.x, 0.1, boss.position.z);
        scene.add(ring);
        
        window.bossSpeedDebuffActive = true;
        
        const ringStart = Date.now();
        const ringInterval = setInterval(() => {
            const elapsed = Date.now() - ringStart;
            if (elapsed > 1000) {
                clearInterval(ringInterval);
                scene.remove(ring);
            } else {
                const scale = elapsed / 1000;
                ring.scale.set(scale * 2.5, scale * 2.5, 1);
                ring.material.opacity = 0.45 * (1.0 - scale);
            }
        }, 16);
        
        setTimeout(() => {
            window.bossSpeedDebuffActive = false;
            showToast("✨ 마감 기한 압박에서 벗어나 이동 속도가 정상화되었습니다.", "#22c55e");
        }, 4000);
    }
    else if (type === 'judgment_launching') {
        showToast(`🔥 ${displayName}: '출시의 심판!'`, "#f97316");
        
        const chargeGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const chargeMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.6 });
        const chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
        chargeMesh.position.set(boss.position.x, boss.position.y + 0.5, boss.position.z);
        scene.add(chargeMesh);
        
        const chargeStart = Date.now();
        const chargeInterval = setInterval(() => {
            const elapsed = Date.now() - chargeStart;
            if (elapsed > 1000) {
                clearInterval(chargeInterval);
                scene.remove(chargeMesh);
                
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const fGeo = new THREE.SphereGeometry(0.4, 16, 16);
                    const fMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
                    const fMesh = new THREE.Mesh(fGeo, fMat);
                    fMesh.position.set(boss.position.x, boss.position.y + 0.5, boss.position.z);
                    scene.add(fMesh);
                    
                    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
                    
                    window.activeBossProjectiles.push({
                        type: 'judgment_fireball',
                        mesh: fMesh,
                        dir: dir,
                        speed: 12.0,
                        damage: 18,
                        createdAt: Date.now(),
                        duration: 4000
                    });
                }
            } else {
                const scale = (elapsed / 1000) * 1.8;
                chargeMesh.scale.set(scale, scale, scale);
                chargeMesh.position.copy(boss.position).y += 0.5;
            }
        }, 16);
    }
    else if (type === 'rocket_dash') {
        showToast(`🚀 ${displayName}: '로켓 돌진!'`, "#ffea00");
        
        boss.userData.isDashing = true;
        
        const boosterFlames = [];
        boss.traverse(child => {
            if (child.name === 'flame') {
                boosterFlames.push(child);
                child.scale.set(2.5, 3.5, 2.5);
            }
        });
        
        const targetDir = new THREE.Vector3().subVectors(player, boss.position);
        targetDir.y = 0;
        targetDir.normalize();
        
        boss.rotation.y = Math.atan2(targetDir.x, targetDir.z);
        
        const dashStart = Date.now();
        const dashInterval = setInterval(() => {
            const elapsed = Date.now() - dashStart;
            
            if (!window.bossMesh || window.bossHp <= 0 || elapsed > 1200) {
                clearInterval(dashInterval);
                if (window.bossMesh) {
                    window.bossMesh.userData.isDashing = false;
                    boosterFlames.forEach(fl => fl.scale.set(1, 1, 1));
                }
                return;
            }
            
            boss.position.addScaledVector(targetDir, 0.45);
            
            const dist = boss.position.distanceTo(player);
            if (dist < 2.4 && !boss.userData.hasHitDashPlayer) {
                boss.userData.hasHitDashPlayer = true;
                
                const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
                const dmg = Math.floor(28 * armorFactor);
                window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
                if (typeof updateStatBars === 'function') updateStatBars();
                
                showToast(`💥 로켓 돌진에 정면으로 들이받혔습니다! (-${dmg} HP)`, "#ef4444");
                playExplosionSound();
                
                if (window.velocity) {
                    window.velocity.addScaledVector(targetDir, 18);
                }
                
                if (window.STATS.hp <= 0 && typeof triggerLocalPlayerDeath === 'function') {
                    triggerLocalPlayerDeath(`${displayName}의 로켓 돌진`);
                }
            }
        }, 16);
        
        boss.userData.hasHitDashPlayer = false;
    }
    else if (type === 'neon_laser') {
        showToast(`⚡ ${displayName}: '네온 레이저!'`, "#e0f2fe");
        
        const start = Date.now();
        let ticks = 0;
        
        const laserInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            if (!window.bossMesh || window.bossHp <= 0 || elapsed > 1500) {
                clearInterval(laserInterval);
                return;
            }
            
            const eyeLeft = new THREE.Vector3(-0.15, 0.5, 0.18).applyMatrix4(boss.matrixWorld);
            const eyeRight = new THREE.Vector3(0.15, 0.5, 0.18).applyMatrix4(boss.matrixWorld);
            const pHead = new THREE.Vector3(player.x, player.y + 0.1, player.z);
            
            const pointsL = [eyeLeft, pHead];
            const pointsR = [eyeRight, pHead];
            
            const geoL = new THREE.BufferGeometry().setFromPoints(pointsL);
            const geoR = new THREE.BufferGeometry().setFromPoints(pointsR);
            
            const mat = new THREE.LineBasicMaterial({ color: 0xa855f7, linewidth: 4 });
            const lineL = new THREE.Line(geoL, mat);
            const lineR = new THREE.Line(geoR, mat);
            
            scene.add(lineL);
            scene.add(lineR);
            
            setTimeout(() => {
                scene.remove(lineL);
                scene.remove(lineR);
            }, 80);
            
            const currentTick = Math.floor(elapsed / 500);
            if (currentTick > ticks) {
                ticks = currentTick;
                
                const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
                const dmg = Math.floor(6 * armorFactor);
                window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
                if (typeof updateStatBars === 'function') updateStatBars();
                showToast(`⚡ 네온 레이저에 직격당했습니다! (-${dmg} HP)`, "#ef4444");
                
                if (window.STATS.hp <= 0 && typeof triggerLocalPlayerDeath === 'function') {
                    triggerLocalPlayerDeath(`${displayName}의 네온 레이저`);
                }
            }
        }, 80);
    }
    else if (type === 'crown_lightning') {
        showToast(`👑 ${displayName}: '왕관 번개!'`, "#38bdf8");
        
        const targetPos = player.clone();
        
        const warnGeo = new THREE.RingGeometry(0.1, 2.5, 32);
        warnGeo.rotation.x = -Math.PI / 2;
        const warnMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const warnMesh = new THREE.Mesh(warnGeo, warnMat);
        warnMesh.position.set(targetPos.x, 0.1, targetPos.z);
        scene.add(warnMesh);
        
        window.activeBossProjectiles.push({
            type: 'lightning_warning',
            mesh: warnMesh,
            targetPos: targetPos,
            damage: 26,
            createdAt: Date.now()
        });
    }
    else if (type === 'wall_of_creation') {
        showToast(`🛡️ ${displayName}: '창조의 벽!' (보스 피해량 80% 감소)`, "#a855f7");
        
        const shieldGeo = new THREE.SphereGeometry(2.2, 24, 24);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0xa855f7,
            transparent: true,
            opacity: 0.2,
            wireframe: true
        });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        boss.add(shieldMesh);
        
        window.bossShieldActive = true;
        
        setTimeout(() => {
            boss.remove(shieldMesh);
            window.bossShieldActive = false;
            showToast("✨ 창조의 벽이 해제되어 보스가 정상 피해를 받습니다.", "#22c55e");
        }, 6000);
    }
    else if (type === 'galaxy_summon') {
        showToast(`🌌 ${displayName}: '은하 소환!' (낙하 소행성 경고)`, "#818cf8");
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!window.bossMesh || window.bossHp <= 0) return;
                
                const offsetAngle = Math.random() * Math.PI * 2;
                const offsetDist = Math.random() * 8.0;
                const targetX = camera.position.x + Math.cos(offsetAngle) * offsetDist;
                const targetZ = camera.position.z + Math.sin(offsetAngle) * offsetDist;
                
                const warnGeo = new THREE.RingGeometry(0.1, 3.2, 24);
                warnGeo.rotation.x = -Math.PI / 2;
                const warnMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
                const warnMesh = new THREE.Mesh(warnGeo, warnMat);
                warnMesh.position.set(targetX, 0.1, targetZ);
                scene.add(warnMesh);
                
                const rockGeo = new THREE.DodecahedronGeometry(0.8);
                const rockMat = new THREE.MeshStandardMaterial({ color: 0x22153b, roughness: 0.8 });
                const rockMesh = new THREE.Mesh(rockGeo, rockMat);
                rockMesh.position.set(targetX, 35.0, targetZ);
                scene.add(rockMesh);
                
                window.activeBossProjectiles.push({
                    type: 'galaxy_rock',
                    mesh: rockMesh,
                    warningMesh: warnMesh,
                    speed: 16.0,
                    damage: 28,
                    createdAt: Date.now()
                });
            }, i * 450);
        }
    }
    else if (type === 'final_creation') {
        showToast(`💥 ${displayName}: '최종 제작!' (치명적인 광역 파괴 발동!)`, "#ff0055");
        
        const originalY = boss.position.y;
        boss.position.y = 4.5;
        
        const targetPos = player.clone();
        const warnGeo = new THREE.RingGeometry(0.1, 15.0, 64);
        warnGeo.rotation.x = -Math.PI / 2;
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const warnMesh = new THREE.Mesh(warnGeo, warnMat);
        warnMesh.position.set(targetPos.x, 0.15, targetPos.z);
        scene.add(warnMesh);
        
        window.activeBossProjectiles.push({
            type: 'final_creation_warning',
            mesh: warnMesh,
            warningMesh: warnMesh,
            targetPos: targetPos,
            damage: 85,
            createdAt: Date.now()
        });
        
        setTimeout(() => {
            if (window.bossMesh) {
                window.bossMesh.position.y = originalY;
            }
        }, 3000);
    }
};

window.triggerRandomBossSkill = () => {
    if (!window.bossMesh || window.bossHp <= 0 || window.isBossEvolving) return;
    
    const skills = [
        'idea_explosion',
        'concept_typhoon',
        'deadline_hell',
        'judgment_launching',
        'rocket_dash',
        'neon_laser',
        'crown_lightning',
        'wall_of_creation',
        'galaxy_summon'
    ];
    
    if (window.bossPhase === 2) {
        skills.push('final_creation');
    }
    
    const chosenSkill = skills[Math.floor(Math.random() * skills.length)];
    window.executeBossSkill(chosenSkill);
};

window.updateBossAI = () => {
    if (!window.bossMesh || window.bossHp <= 0 || window.isBossEvolving) return;
    
    const boss = window.bossMesh;
    const player = camera.position;
    
    const dx = player.x - boss.position.x;
    const dz = player.z - boss.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    if (dist > 60) return;
    
    if (!boss.userData.isDashing) {
        const angle = Math.atan2(dx, dz);
        boss.rotation.y = angle;
    }
    
    if (dist > 4 && !boss.userData.isDashing) {
        const speed = window.bossPhase === 2 ? 0.075 : 0.045;
        const angle = Math.atan2(dx, dz);
        boss.position.x += Math.sin(angle) * speed;
        boss.position.z += Math.cos(angle) * speed;
        boss.position.y = 1.6 + Math.sin(Date.now() / 300) * 0.15;
    }
    
    const now = Date.now();
    
    // Normal shot basic attack
    if (dist < 35 && now - lastBossAction > 1500 && !boss.userData.isCastingSkill && !boss.userData.isDashing) {
        lastBossAction = now;
        
        const config = BOSS_CONFIGS[window.activeBossType] || BOSS_CONFIGS.creator;
        const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
        const baseDmg = window.activeBossType === 'creator' ? (window.bossPhase === 2 ? 22 : 18) : 12;
        const dmg = Math.floor(baseDmg * armorFactor);
        window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
        if (typeof updateStatBars === 'function') updateStatBars();
        
        const dmgInd = document.getElementById('damage-indicator');
        const dmgFlash = document.getElementById('damage-flash-indicator');
        if (dmgInd && dmgFlash) {
            dmgInd.style.display = 'block';
            dmgFlash.style.borderColor = 'rgba(239, 68, 68, 0.8)';
            dmgFlash.style.boxShadow = 'inset 0 0 100px rgba(239, 68, 68, 0.8)';
            setTimeout(() => {
                dmgInd.style.display = 'none';
            }, 200);
        }
        
        const displayName = window.bossPhase === 2 ? '우주 창조신 제작진' : config.name;
        showToast(`💥 ${displayName}의 사격에 당했습니다! (-${dmg} HP)`, "#ef4444");
        
        const points = [
            new THREE.Vector3(boss.position.x, boss.position.y + 0.5, boss.position.z),
            new THREE.Vector3(player.x, player.y - 0.2, player.z)
        ];
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const laserColor = window.activeBossType === 'creator' ? 0xff0000 : 0x00ffff;
        const lineMat = new THREE.LineBasicMaterial({ color: laserColor, linewidth: 2 });
        const laser = new THREE.Line(lineGeo, lineMat);
        scene.add(laser);
        setTimeout(() => scene.remove(laser), 100);
        
        if (window.STATS.hp <= 0) {
            if (typeof triggerLocalPlayerDeath === 'function') {
                triggerLocalPlayerDeath(`${displayName}과의 결투`);
            }
        }
    }
    
    // Cast active skill
    const skillInterval = window.bossPhase === 2 ? 3500 : 5000;
    if (window.activeBossType === 'creator' && now - lastSkillTime > skillInterval && !boss.userData.isDashing) {
        lastSkillTime = now;
        window.triggerRandomBossSkill();
    }
};

window.updateBossProjectiles = (delta) => {
    if (!window.activeBossProjectiles) return;
    
    const player = camera.position;
    const now = Date.now();
    
    for (let i = window.activeBossProjectiles.length - 1; i >= 0; i--) {
        const p = window.activeBossProjectiles[i];
        let removeProj = false;
        
        if (p.type === 'idea_explosion' || p.type === 'judgment_fireball') {
            p.mesh.position.addScaledVector(p.dir, p.speed * delta);
            
            const dist = p.mesh.position.distanceTo(player);
            if (dist < 1.8) {
                removeProj = true;
                
                const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
                const dmg = Math.floor(p.damage * armorFactor);
                window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
                if (typeof updateStatBars === 'function') updateStatBars();
                
                showToast(`💥 보스의 투사체에 맞아 피해를 입었습니다! (-${dmg} HP)`, "#ef4444");
                playExplosionSound();
                
                if (window.STATS.hp <= 0 && typeof triggerLocalPlayerDeath === 'function') {
                    const bossName = window.bossPhase === 2 ? '우주 창조신 제작진' : '제작진 킹';
                    triggerLocalPlayerDeath(`${bossName}의 투사체 공격`);
                }
            }
            
            if (now - p.createdAt > p.duration) {
                removeProj = true;
            }
        }
        else if (p.type === 'lightning_warning') {
            const elapsed = now - p.createdAt;
            if (elapsed > 1200) {
                removeProj = true;
                
                const strikeGeo = new THREE.CylinderGeometry(0.5, 0.5, 60, 16);
                const strikeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
                const strikeMesh = new THREE.Mesh(strikeGeo, strikeMat);
                strikeMesh.position.set(p.targetPos.x, 30, p.targetPos.z);
                scene.add(strikeMesh);
                setTimeout(() => scene.remove(strikeMesh), 200);
                
                playExplosionSound();
                
                const dX = player.x - p.targetPos.x;
                const dZ = player.z - p.targetPos.z;
                const dist = Math.sqrt(dX*dX + dZ*dZ);
                if (dist < 3.5) {
                    const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
                    const dmg = Math.floor(p.damage * armorFactor);
                    window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
                    if (typeof updateStatBars === 'function') updateStatBars();
                    showToast(`⚡ 왕관 번개에 감전되었습니다! (-${dmg} HP)`, "#ef4444");
                    
                    if (window.STATS.hp <= 0 && typeof triggerLocalPlayerDeath === 'function') {
                        triggerLocalPlayerDeath(`제작진 킹의 왕관 번개`);
                    }
                }
            }
        }
        else if (p.type === 'galaxy_rock') {
            p.mesh.position.y -= p.speed * delta;
            p.mesh.rotation.x += 0.03;
            p.mesh.rotation.y += 0.02;
            
            if (p.mesh.position.y <= 0.1) {
                removeProj = true;
                
                playExplosionSound();
                
                const dX = player.x - p.mesh.position.x;
                const dZ = player.z - p.mesh.position.z;
                const dist = Math.sqrt(dX*dX + dZ*dZ);
                if (dist < 4.0) {
                    const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
                    const dmg = Math.floor(p.damage * armorFactor);
                    window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
                    if (typeof updateStatBars === 'function') updateStatBars();
                    showToast(`☄️ 낙하하는 소행성에 충돌했습니다! (-${dmg} HP)`, "#ef4444");
                    
                    if (window.STATS.hp <= 0 && typeof triggerLocalPlayerDeath === 'function') {
                        triggerLocalPlayerDeath(`제작진 킹의 소행성 낙하`);
                    }
                }
                
                if (p.warningMesh && p.warningMesh.parent) {
                    p.warningMesh.parent.remove(p.warningMesh);
                }
            }
        }
        else if (p.type === 'final_creation_warning') {
            const elapsed = now - p.createdAt;
            if (elapsed > 2500) {
                removeProj = true;
                
                const cylGeo = new THREE.CylinderGeometry(15, 15, 80, 32);
                const cylMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
                const cylMesh = new THREE.Mesh(cylGeo, cylMat);
                cylMesh.position.set(p.targetPos.x, 40, p.targetPos.z);
                scene.add(cylMesh);
                
                const innerCylGeo = new THREE.CylinderGeometry(10, 10, 80, 24);
                const innerCylMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.95 });
                const innerCylMesh = new THREE.Mesh(innerCylGeo, innerCylMat);
                innerCylMesh.position.set(p.targetPos.x, 40, p.targetPos.z);
                scene.add(innerCylMesh);
                
                setTimeout(() => {
                    scene.remove(cylMesh);
                    scene.remove(innerCylMesh);
                }, 400);
                
                playThunderSound();
                
                const dX = player.x - p.targetPos.x;
                const dZ = player.z - p.targetPos.z;
                const dist = Math.sqrt(dX*dX + dZ*dZ);
                if (dist < 15.0) {
                    const armorFactor = (window.STATS.armor || 0) > 0 ? 0.6 : 1.0;
                    const dmg = Math.floor(p.damage * armorFactor);
                    window.STATS.hp = Math.max(0, window.STATS.hp - dmg);
                    if (typeof updateStatBars === 'function') updateStatBars();
                    showToast(`💥 최종 제작의 광선에 휩쓸려 치명적인 피해를 입었습니다! (-${dmg} HP)`, "#ff0055");
                    
                    if (window.velocity) window.velocity.y = 30.0;
                    
                    if (window.STATS.hp <= 0 && typeof triggerLocalPlayerDeath === 'function') {
                        triggerLocalPlayerDeath(`우주 창조신 제작진의 최종 제작`);
                    }
                }
                
                if (p.warningMesh && p.warningMesh.parent) {
                    p.warningMesh.parent.remove(p.warningMesh);
                }
            }
        }
        
        if (removeProj) {
            scene.remove(p.mesh);
            window.activeBossProjectiles.splice(i, 1);
        }
    }
};

window.spawnBossLoot = (pos) => {
    if (!window.activeLootDrops) window.activeLootDrops = [];
    
    const items = [
        {
            name: "창조의 왕관",
            color: 0xffd700,
            tier: "전설",
            reward: 10000,
            toastColor: "#facc15",
            createMesh: () => {
                const group = new THREE.Group();
                const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.1 });
                const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), goldMat);
                group.add(band);
                
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2;
                    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), goldMat);
                    spike.position.set(Math.cos(angle) * 0.3, 0.12, Math.sin(angle) * 0.3);
                    spike.rotation.y = -angle;
                    spike.rotation.z = -Math.cos(angle) * 0.15;
                    spike.rotation.x = Math.sin(angle) * 0.15;
                    group.add(spike);
                }
                return group;
            }
        },
        {
            name: "네온 로켓 엔진",
            color: 0xa855f7,
            tier: "영웅",
            reward: 5000,
            toastColor: "#a855f7",
            createMesh: () => {
                const group = new THREE.Group();
                const engMat = new THREE.MeshStandardMaterial({ color: 0x221144, metalness: 0.8, roughness: 0.2 });
                const trimMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 1.5 });
                
                const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 12), engMat);
                group.add(cylinder);
                
                const trim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12), trimMat);
                trim.rotation.x = Math.PI / 2;
                trim.position.y = -0.2;
                group.add(trim);
                return group;
            }
        },
        {
            name: "우주 수정",
            color: 0x00ffff,
            tier: "희귀",
            reward: 2500,
            toastColor: "#06b6d4",
            createMesh: () => {
                const geom = new THREE.OctahedronGeometry(0.25);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0x00ccff,
                    emissive: 0x0055ff,
                    emissiveIntensity: 1.0,
                    roughness: 0.1,
                    metalness: 0.9,
                    transparent: true,
                    opacity: 0.85
                });
                return new THREE.Mesh(geom, mat);
            }
        },
        {
            name: "별 조각",
            color: 0xffea00,
            tier: "일반",
            reward: 1000,
            toastColor: "#eab308",
            createMesh: () => {
                const group = new THREE.Group();
                const starMat = new THREE.MeshStandardMaterial({
                    color: 0xffea00,
                    emissive: 0xffaa00,
                    emissiveIntensity: 0.8,
                    metalness: 0.5,
                    roughness: 0.3
                });
                const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), starMat);
                cone1.rotation.x = Math.PI / 2;
                group.add(cone1);
                
                const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), starMat);
                cone2.rotation.x = -Math.PI / 2;
                group.add(cone2);
                
                return group;
            }
        }
    ];

    items.forEach((item, idx) => {
        const mesh = item.createMesh();
        const angle = (idx / items.length) * Math.PI * 2;
        const radius = 1.8;
        
        const targetX = pos.x + Math.cos(angle) * radius;
        const targetZ = pos.z + Math.sin(angle) * radius;
        const targetY = 1.0;
        
        mesh.position.set(targetX, targetY, targetZ);
        scene.add(mesh);
        
        let light = null;
        if (item.tier === "전설" || item.tier === "영웅") {
            light = new THREE.PointLight(item.color, 1.5, 4);
            light.position.set(0, 0, 0);
            mesh.add(light);
        }
        
        window.activeLootDrops.push({
            name: item.name,
            tier: item.tier,
            reward: item.reward,
            toastColor: item.toastColor,
            mesh: mesh,
            light: light,
            baseY: targetY,
            angleOffset: Math.random() * Math.PI * 2
        });
    });
};

window.updateLootDrops = (delta) => {
    if (!window.activeLootDrops) return;
    
    const player = camera.position;
    const timeSec = performance.now() / 1000;
    
    for (let i = window.activeLootDrops.length - 1; i >= 0; i--) {
        const drop = window.activeLootDrops[i];
        
        drop.mesh.position.y = drop.baseY + Math.sin(timeSec * 2.5 + drop.angleOffset) * 0.18;
        drop.mesh.rotation.y += 1.5 * delta;
        
        const dist = drop.mesh.position.distanceTo(player);
        if (dist < 1.8) {
            scene.remove(drop.mesh);
            window.activeLootDrops.splice(i, 1);
            
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
                    gain.gain.setValueAtTime(0.12, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.3);
                }
            } catch(e){}
            
            if (STATE.currentUser) {
                STATE.currentUser.money = (STATE.currentUser.money || 0) + drop.reward;
                if (db && STATE.currentUser.uid) {
                    db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                }
                
                const lobbyMoney = document.getElementById('lobby-money');
                if (lobbyMoney) lobbyMoney.textContent = STATE.currentUser.money.toLocaleString();
                const hudMoney = document.getElementById('hud-money');
                if (hudMoney) hudMoney.textContent = STATE.currentUser.money.toLocaleString();
            }
            
            showToast(`🎁 [${drop.tier} 아이템] ${drop.name} 획득! (+${drop.reward.toLocaleString()}G)`, drop.toastColor);
        }
    }
};

// ==========================================
// TACTICAL SMARTPHONE / PDA SYSTEM LOGIC
// ==========================================
window.toggleTacticalPhone = () => {
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen || !gameScreen.classList.contains('active')) {
        showToast("⚠️ 전술폰은 연병장 대원 출동(훈련 시작) 후에 사용할 수 있습니다!", "#ff9900");
        return;
    }
    
    const phone = document.getElementById('tactical-phone');
    if (!phone) return;
    
    if (phone.style.display === 'none' || phone.style.display === '') {
        phone.style.display = 'flex';
        // Release pointerlock so mouse cursor is visible
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
        
        // Start real-time GPS updates and stats updates
        window.updatePhoneData();
        window.phoneDataInterval = setInterval(window.updatePhoneData, 500);
        
        // Setup clock
        window.updatePhoneClock();
        window.phoneClockInterval = setInterval(window.updatePhoneClock, 10000);
        
        showToast("📱 전술 단말기를 열었습니다. 마우스 조작을 위해 화면을 터치하십시오.");
    } else {
        phone.style.display = 'none';
        clearInterval(window.phoneDataInterval);
        clearInterval(window.phoneClockInterval);
        window.stopPhoneMusic();
    }
};

window.updatePhoneClock = () => {
    const timeEl = document.getElementById('phone-time');
    if (timeEl) {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = `${hrs}:${mins}`;
    }
};

window.updatePhoneData = () => {
    if (typeof camera !== 'undefined' && camera) {
        const xEl = document.getElementById('phone-gps-x');
        const yEl = document.getElementById('phone-gps-y');
        const zEl = document.getElementById('phone-gps-z');
        if (xEl) xEl.textContent = camera.position.x.toFixed(2);
        if (yEl) yEl.textContent = camera.position.y.toFixed(2);
        if (zEl) zEl.textContent = camera.position.z.toFixed(2);
    }
    
    if (STATE.currentUser) {
        const nameEl = document.getElementById('phone-info-name');
        const rankEl = document.getElementById('phone-info-rank');
        const branchEl = document.getElementById('phone-info-branch');
        const killsEl = document.getElementById('phone-info-kills');
        const deathsEl = document.getElementById('phone-info-deaths');
        
        if (nameEl) nameEl.textContent = STATE.currentUser.name || '신병';
        if (rankEl) rankEl.textContent = `[${STATE.currentUser.rank || '이등병'}]`;
        if (branchEl) branchEl.textContent = STATE.currentUser.branch || '육군';
        if (killsEl) killsEl.textContent = STATE.currentUser.kills || 0;
        if (deathsEl) deathsEl.textContent = STATE.currentUser.deaths || 0;
    }
    
    const pingEl = document.getElementById('phone-info-ping');
    const lobbyPing = document.getElementById('lobby-ping');
    if (pingEl && lobbyPing) {
        pingEl.textContent = lobbyPing.textContent;
    }
};

window.openPhoneApp = (appId) => {
    // Hide home screen
    document.getElementById('phone-home').style.display = 'none';
    // Hide all apps
    document.getElementById('phone-app-px').style.display = 'none';
    document.getElementById('phone-app-support').style.display = 'none';
    document.getElementById('phone-app-gps').style.display = 'none';
    document.getElementById('phone-app-music').style.display = 'none';
    document.getElementById('phone-app-info').style.display = 'none';
    
    // Show specific app
    const appContainer = document.getElementById('phone-app-' + appId);
    if (appContainer) {
        appContainer.style.display = 'flex';
    }
};

window.goPhoneHome = () => {
    // Hide all apps
    document.getElementById('phone-app-px').style.display = 'none';
    document.getElementById('phone-app-support').style.display = 'none';
    document.getElementById('phone-app-gps').style.display = 'none';
    document.getElementById('phone-app-music').style.display = 'none';
    document.getElementById('phone-app-info').style.display = 'none';
    
    // Show home screen
    document.getElementById('phone-home').style.display = 'flex';
};

// PX Delivery App Purchase
window.buyPXItem = (itemKey, cost, itemName) => {
    if (!STATE.currentUser || !STATE.currentUser.uid) return;
    
    const isBoss = STATE.currentUser.username === 'ree1203';
    const userMoney = isBoss ? Infinity : (STATE.currentUser.money || 0);

    if (userMoney < cost) {
        showToast("❌ 군자금이 부족합니다!", "#ff3333");
        return;
    }

    const performPurchase = () => {
        if (db) {
            db.ref(`users/${STATE.currentUser.uid}/inventory`).push(itemKey).then(() => {
                showToast(`🎒 [${itemName}] 배달 완료! 인벤토리를 확인하세요.`, "#10b981");
                if (itemKey === 'k2') {
                    window.hasK2 = true;
                    if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson;
                    document.getElementById('crosshair').style.display = 'block';
                }
            });
        }
    };

    if (isBoss) {
        performPurchase();
    } else {
        db.ref(`users/${STATE.currentUser.uid}/money`).transaction(current => {
            if ((current || 0) >= cost) {
                return current - cost;
            }
            return current;
        }, (error, committed) => {
            if (committed) {
                performPurchase();
            } else {
                showToast("❌ 구매 실패: 군자금이 부족합니다.", "#ff3333");
            }
        });
    }
};

// Vehicle Summoning via Phone
window.callVehicle = (type, cost, name) => {
    if (!STATE.currentUser || !STATE.currentUser.uid) return;
    
    const isBoss = STATE.currentUser.username === 'ree1203';
    const userMoney = isBoss ? Infinity : (STATE.currentUser.money || 0);

    if (userMoney < cost) {
        showToast("❌ 군자금이 부족합니다!", "#ff3333");
        return;
    }

    const spawnVehicle = () => {
        if (type === 'apc') {
            if (window.tankMesh) {
                window.tankMesh.position.set(camera.position.x, 0.5, camera.position.z);
                showToast("🚜 장갑차(전차)가 배달되었습니다!", "#10b981");
            }
        } else if (type === 'heli') {
            if (window.helicopterMesh) {
                window.helicopterMesh.position.set(camera.position.x, 5.0, camera.position.z);
                showToast("🚁 공격 헬기가 공중 배달되었습니다!", "#10b981");
            }
        }
    };

    if (isBoss) {
        spawnVehicle();
    } else {
        db.ref(`users/${STATE.currentUser.uid}/money`).transaction(current => {
            if ((current || 0) >= cost) {
                return current - cost;
            }
            return current;
        }, (error, committed) => {
            if (committed) {
                spawnVehicle();
            } else {
                showToast("❌ 구매 실패: 군자금이 부족합니다.", "#ff3333");
            }
        });
    }
};

// Airstrike Support
window.callAirstrike = (cost) => {
    if (!STATE.currentUser || !STATE.currentUser.uid) return;

    const isBoss = STATE.currentUser.username === 'ree1203';
    const userMoney = isBoss ? Infinity : (STATE.currentUser.money || 0);

    if (userMoney < cost) {
        showToast("❌ 군자금이 부족합니다!", "#ff3333");
        return;
    }

    const launchAirstrike = () => {
        showToast("🚨 [포격 지원 요청 승인] 3초 후 목표 지점에 포격이 시작됩니다!", "#ef4444");
        
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const targetPos = camera.position.clone().add(forward.multiplyScalar(35));
        targetPos.y = 0.1;

        const ringGeo = new THREE.RingGeometry(0.1, 4.0, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(targetPos);
        ring.position.y = 0.15;
        scene.add(ring);

        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            ring.visible = !ring.visible;
            blinkCount++;
            if (blinkCount >= 6) {
                clearInterval(blinkInterval);
                scene.remove(ring);
                
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        const offset = new THREE.Vector3(
                            (Math.random() - 0.5) * 6,
                            0,
                            (Math.random() - 0.5) * 6
                        );
                        const expPos = targetPos.clone().add(offset);
                        
                        const expGeo = new THREE.SphereGeometry(3.5 + Math.random() * 1.5, 16, 16);
                        const expMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
                        const explosion = new THREE.Mesh(expGeo, expMat);
                        explosion.position.copy(expPos);
                        explosion.position.y = 2.0;
                        scene.add(explosion);
                        
                        if (typeof playExplosionSound === 'function') {
                            playExplosionSound();
                        } else {
                            playGunshotSound('k6');
                        }
                        
                        if (window.creatorBossMesh) {
                            const bossDist = explosion.position.distanceTo(window.creatorBossMesh.position);
                            if (bossDist < 8.0) {
                                if (typeof damageCreatorBoss === 'function') {
                                    damageCreatorBoss(50);
                                    showToast("💥 포격이 제작자 보스에게 직격했습니다! (-50 HP)", "#fbbf24");
                                }
                            }
                        }

                        setTimeout(() => {
                            scene.remove(explosion);
                        }, 500);
                    }, i * 350);
                }
            }
        }, 500);
    };

    if (isBoss) {
        launchAirstrike();
    } else {
        db.ref(`users/${STATE.currentUser.uid}/money`).transaction(current => {
            if ((current || 0) >= cost) {
                return current - cost;
            }
            return current;
        }, (error, committed) => {
            if (committed) {
                launchAirstrike();
            } else {
                showToast("❌ 포격 요청 실패: 군자금이 부족합니다.", "#ff3333");
            }
        });
    }
};

// Web Audio API Synthesizer Radio
let phoneAudioCtx = null;
let phoneOscillator = null;
let phoneGainNode = null;
let musicTimeout = null;

window.playPhoneMusic = (songKey) => {
    window.stopPhoneMusic();
    
    const titleEl = document.getElementById('music-playing-title');
    const songName = songKey === 'military_song_1' ? "재생 중: 육군가 🇰🇷" : "재생 중: 멋진 사나이 ⚡";
    if (titleEl) titleEl.textContent = songName;
    
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        phoneAudioCtx = new AudioContextClass();
        
        const notes_army = [
            { note: 261.63, duration: 0.4 }, // C4
            { note: 329.63, duration: 0.4 }, // E4
            { note: 392.00, duration: 0.4 }, // G4
            { note: 523.25, duration: 0.8 }, // C5
            { note: 392.00, duration: 0.4 }, // G4
            { note: 523.25, duration: 0.8 }, // C5
            { note: 440.00, duration: 0.4 }, // A4
            { note: 392.00, duration: 0.8 }, // G4
            { note: 329.63, duration: 0.4 }, // E4
            { note: 261.63, duration: 0.4 }, // C4
            { note: 293.66, duration: 0.4 }, // D4
            { note: 329.63, duration: 0.8 }, // E4
            { note: 293.66, duration: 1.2 }, // D4
        ];
        
        const notes_man = [
            { note: 392.00, duration: 0.3 }, // G4
            { note: 392.00, duration: 0.3 }, // G4
            { note: 440.00, duration: 0.3 }, // A4
            { note: 392.00, duration: 0.6 }, // G4
            { note: 523.25, duration: 0.6 }, // C5
            { note: 392.00, duration: 0.6 }, // G4
            { note: 329.63, duration: 0.6 }, // E4
            { note: 293.66, duration: 1.2 }, // D4
            { note: 392.00, duration: 0.3 }, // G4
            { note: 392.00, duration: 0.3 }, // G4
            { note: 440.00, duration: 0.3 }, // A4
            { note: 392.00, duration: 0.6 }, // G4
            { note: 523.25, duration: 0.6 }, // C5
            { note: 392.00, duration: 0.6 }, // G4
            { note: 293.66, duration: 0.6 }, // D4
            { note: 261.63, duration: 1.2 }, // C4
        ];
        
        const notes = songKey === 'military_song_1' ? notes_army : notes_man;
        let noteIndex = 0;
        
        const playNextNote = () => {
            if (!phoneAudioCtx) return;
            if (noteIndex >= notes.length) {
                noteIndex = 0;
            }
            
            const current = notes[noteIndex];
            phoneOscillator = phoneAudioCtx.createOscillator();
            phoneGainNode = phoneAudioCtx.createGain();
            
            phoneOscillator.type = 'triangle';
            phoneOscillator.frequency.value = current.note;
            
            phoneGainNode.gain.setValueAtTime(0, phoneAudioCtx.currentTime);
            phoneGainNode.gain.linearRampToValueAtTime(0.15, phoneAudioCtx.currentTime + 0.05);
            phoneGainNode.gain.setValueAtTime(0.15, phoneAudioCtx.currentTime + current.duration - 0.05);
            phoneGainNode.gain.linearRampToValueAtTime(0, phoneAudioCtx.currentTime + current.duration);
            
            phoneOscillator.connect(phoneGainNode);
            phoneGainNode.connect(phoneAudioCtx.destination);
            
            phoneOscillator.start();
            phoneOscillator.stop(phoneAudioCtx.currentTime + current.duration);
            
            noteIndex++;
            musicTimeout = setTimeout(playNextNote, current.duration * 1000 + 50);
        };
        
        playNextNote();
    } catch (e) {
        console.error("Audio playback error", e);
    }
};

window.stopPhoneMusic = () => {
    const titleEl = document.getElementById('music-playing-title');
    if (titleEl) titleEl.textContent = "현재 재생 중이지 않음";
    
    if (musicTimeout) {
        clearTimeout(musicTimeout);
        musicTimeout = null;
    }
    if (phoneOscillator) {
        try { phoneOscillator.stop(); } catch(e){}
        phoneOscillator = null;
    }
    if (phoneAudioCtx) {
        try { phoneAudioCtx.close(); } catch(e){}
        phoneAudioCtx = null;
    }
};

