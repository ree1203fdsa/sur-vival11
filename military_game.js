// military_game.js - Complete 3D Military Simulator Logic
window.onerror = function(message, source, lineno, colno, error) {
    const msgText = message || 'Unknown Runtime Error';
    console.error("Runtime JS Error:", msgText, "at", source, ":", lineno, ":", colno);

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
    "원수실": { x: 0, z: -150, color: 0x11111a, size: [25, 12, 25] }
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

const initAuth = () => {
    document.getElementById('btn-login').onclick = () => {
        if (typeof db === 'undefined' || !db) {
            return alert("데이터베이스 연결 대기 중... 잠시 후 다시 시도하세요.");
        }
        const uid = document.getElementById('login-id').value.trim();
        const pw = document.getElementById('login-pw').value.trim();
        if (!uid || !pw) return alert("입력해주세요!");

        // Master Admin Check (ree1203 - with game, juram1203 - dashboard only)
        if (uid === 'ree1203' && pw === 'hjklfdsa1203') {
            STATE.currentUser = { username: uid, name: '이주람', rank: '원수', branch: '육군', role: 'master', uid: 'master_ree' };
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
        if (lobbyScreen) lobbyScreen.classList.add('active');

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

        // Deploy Field Button
        const deployBtn = document.getElementById('btn-deploy-field');
        if (deployBtn) {
            deployBtn.onclick = () => {
                const ls = document.getElementById('lobby-screen');
                if (ls) ls.classList.remove('active');
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
            } catch (e) {
                console.error("Mute/Kick listener error:", e);
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

        try { initChat(); } catch (e) { console.error("initChat error:", e); }
        try { initTrainingCommandListener(); } catch (e) { console.error("initTrainingCommandListener error:", e); }
        try { init3D(); } catch (e) { console.error("init3D error:", e); }

        // Show Lobby Screen overlay on top of game screen
        try { showLobby(); } catch (e) { console.error("showLobby error:", e); }

        // Show/Initialize Admin panel for ree1203
        try { initAdminPanel(); } catch (e) { console.error("initAdminPanel error:", e); }

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
                        
                        if (window.STATS.hp <= 0) {
                            triggerLocalPlayerDeath(val.shooter || "알 수 없는 플레이어");
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
        const isDaytimeInitial = true;
        const initialSkyColor = 0x87ceeb;
        scene.background = new THREE.Color(initialSkyColor);
        scene.fog = new THREE.Fog(initialSkyColor, 0, 500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.6, 180);
        camera.rotation.order = 'YXZ';

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;

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
            
            const wallMat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.7 });
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

        window.localWeapon = makeWeaponModel('k2');
        window.localWeapon.visible = false;
        camera.add(window.localWeapon);

        // --- Third Person Camera Setup ---
        window.isThirdPerson = false;
        window.thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        window.thirdPersonCamera.position.set(0, 1.5, 5); // Behind and slightly up
        window.thirdPersonCamera.rotation.x = -0.1; // Slight downward tilt
        camera.add(window.thirdPersonCamera);

        // --- Camouflage Materials defined at top of init3D ---

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

            // Golden Epaulets (원수 정복 전용)
            const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
            const lEpaulet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.35), goldMat);
            lEpaulet.position.set(0.55, 1.5, 0);
            lEpaulet.userData.isEpaulet = true;
            lEpaulet.visible = (colorHex === 0xffffff);
            group.add(lEpaulet);

            const rEpaulet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.35), goldMat);
            rEpaulet.position.set(-0.55, 1.5, 0);
            rEpaulet.userData.isEpaulet = true;
            rEpaulet.visible = (colorHex === 0xffffff);
            group.add(rEpaulet);

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
            { id: 'scope', name: '홀로그래픽 조준경', desc: '사격 정확도 향상', price: 3000, emoji: '🔭' },
            { id: 'k2', name: 'K2C1 소총', desc: '고급형 돌격소총', price: 5000, emoji: '🔫' },
            { id: 'k3', name: 'K3 경기관총', desc: '분대지원화기 경기관총 (분대지원화기병용)', price: 6000, emoji: '💥' },
            { id: 'k5', name: 'K5 권총', desc: '휴대용 9mm 권총 (간부용 부무장)', price: 2000, emoji: '🔫' },
            { id: 'k1a', name: 'K1A 기관단총', desc: '가볍고 강력한 기관단총 (특수부대/차량승무원용)', price: 4500, emoji: '🔫' },
            { id: 'k14', name: 'K14 저격소총', desc: '초정밀 볼트액션 저격소총 (특수부대용)', price: 9000, emoji: '🎯' },
            { id: 'k6', name: 'K6 중기관총', desc: '강력한 화력의 12.7mm 중기관총 (중화기병용)', price: 12000, emoji: '🔥' },
            { id: 'silencer', name: '소음기', desc: 'K2 소총 격발음과 총구 화염을 대폭 감소시킴', price: 1500, emoji: '🤫' },
            { id: 'laser_sight', name: '레이저 조준경', desc: 'K2 소총 하단에 적색 조준 가이드 선을 비춤', price: 2000, emoji: '🔴' },
            { id: 'advanced_scope', name: '고배율 스코프', desc: 'K2 소총 장착 시 우클릭으로 극대화된 줌 사용 가능', price: 2500, emoji: '🔭' },
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

        window.hasSilencer = false;
        window.hasLaserSight = false;
        window.hasAdvancedScope = false;

        window.useItem = (key, itemId, name) => {
            if (!STATE.currentUser) return;
            
            if (itemId === 'silencer' || itemId === 'laser_sight' || itemId === 'advanced_scope') {
                if (itemId === 'silencer') {
                    window.hasSilencer = !window.hasSilencer;
                    showToast(window.hasSilencer ? "🤫 소음기를 장착했습니다." : "소음기를 해제했습니다.", "#22c55e");
                } else if (itemId === 'laser_sight') {
                    window.hasLaserSight = !window.hasLaserSight;
                    showToast(window.hasLaserSight ? "🔴 레이저 조준경을 장착했습니다." : "레이저 조준경을 해제했습니다.", "#22c55e");
                } else if (itemId === 'advanced_scope') {
                    window.hasAdvancedScope = !window.hasAdvancedScope;
                    showToast(window.hasAdvancedScope ? "🔭 고배율 스코프를 장착했습니다." : "고배율 스코프를 해제했습니다.", "#22c55e");
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
            const flashIntensity = isGolden ? 20 : 12;
            const flash = new THREE.PointLight(flashColor, flashIntensity, isGolden ? 8 : 6);
            flash.position.set(0.15, -0.1, -0.6);
            camera.add(flash);
            setTimeout(() => {
                camera.remove(flash);
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
                let hitObj = hits[0].object;
                let hitUid = null;
                
                while (hitObj && hitObj !== scene) {
                    if (playerMap[hitObj.uuid]) {
                        hitUid = playerMap[hitObj.uuid];
                        break;
                    }
                    hitObj = hitObj.parent;
                }
                
                if (hitUid) {
                    const hitPlayerName = otherPlayers[hitUid].lastName || hitUid;
                    const damage = (window.WEAPONS_CONFIG && window.WEAPONS_CONFIG[weaponId]) ? window.WEAPONS_CONFIG[weaponId].damage : 25;
                    showToast(`🎯 ${hitPlayerName}을(를) 맞췄습니다! (피해량: ${damage})`, "#ff0000");
                    
                    if (db) {
                        db.ref('users/' + hitUid + '/hit').set({
                            shooter: STATE.currentUser.name || STATE.currentUser.username,
                            damage: damage,
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
            // Raycast check for CCTV monitors in Marshal's Office
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

            // Raycast check for Marshal's Office special interactive objects
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
                    
                    triggerMuzzleFlashAndRecoil();
                    playGunshotSound(window.activeWeaponId);
                    shootPlayerRaycast(window.activeWeaponId);
                }
                return;
            }
            if (window.shootingAmmo <= 0) return;
            window.shootingAmmo--;
            document.getElementById('shooting-ammo').textContent = window.shootingAmmo;

            // Raycast to targets
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const hits = raycaster.intersectObjects(window.shootingTargets);
            if (hits.length > 0) {
                const target = hits[0].object;
                if (!target.userData.hit) {
                    target.userData.hit = true;
                    target.material.color.setHex(0x888888);
                    target.rotation.x = Math.PI / 2;
                    window.shootingScore++;
                    document.getElementById('shooting-score').textContent = window.shootingScore;
                    if (window.promoExamActive) {
                        window.promoShootHits = (window.promoShootHits || 0) + 1;
                        if (typeof updatePromoHUD === 'function') updatePromoHUD();
                    }
                    // EXP + missions + achievements
                    if (typeof gainEXP === 'function') gainEXP(10, '명중');
                    if (typeof trackMission === 'function') trackMission('shootHits', 1);
                    if (typeof unlockAchievement === 'function') {
                        unlockAchievement('first_shot');
                        if (window.shootingScore >= 5) unlockAchievement('sharpshooter');
                    }
                }
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
            lx.fillStyle='#deb887'; lx.font='bold 24px sans-serif'; lx.textAlign='center'; lx.fillText('두돈반 트럭 [G탑승]',128,42);
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
            lx.fillStyle='#ff9900'; lx.font='bold 24px sans-serif'; lx.textAlign='center'; lx.fillText('K2 전차 [G탑승]',128,42);
            const ls = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(lc)}));
            ls.position.set(0, 5, 0); ls.scale.set(10,2.5,1); g.add(ls);
            g.userData.type = 'tank'; g.userData.speed = 0; g.userData.label = ls;
            return g;
        };

        window.truckMesh = makeTruck();
        window.truckMesh.position.set(-70, 0, 50);
        window.truckMesh.userData.id = 'truck';
        scene.add(window.truckMesh);

        window.tankMesh = makeTank();
        window.tankMesh.position.set(-50, 0, 50);
        window.tankMesh.userData.id = 'tank';
        scene.add(window.tankMesh);
        
        if (window.helicopterMesh) window.helicopterMesh.userData.id = 'helicopter';

        db.ref('vehicles').on('value', snap => {
            const data = snap.val();
            if (!data) return;
            const vMap = { 'truck': window.truckMesh, 'tank': window.tankMesh, 'helicopter': window.helicopterMesh };
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
                return;
            }
            const vehicles = [window.truckMesh, window.tankMesh, window.helicopterMesh];
            for (const v of vehicles) {
                if (!v) continue;
                const d = camera.position.distanceTo(v.position);
                if (d < 12) {
                    if (v === window.helicopterMesh && STATE.currentUser.username !== 'ree1203') {
                        alert('이 헬기는 대장 전용입니다!'); return;
                    }
                    window.inVehicle = true;
                    window.currentVehicle = v;
                    v.userData.label.visible = false;
                    const vname = v === window.helicopterMesh ? '🚁 헬기' : v.userData.type === 'tank' ? '🪖 K2전차' : '🚚 두돈반';
                    document.getElementById('vehicle-hud').textContent = `${vname} 탑승 중 | [WASD: 조향] [Q/E: ${v===window.helicopterMesh?'고도':'속도'}] [G: 하차]`;
                    document.getElementById('vehicle-hud').style.display = 'block';
                    camera.position.set(v.position.x, v.position.y + 3, v.position.z);
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
            
            if (window.DISCIPLINE <= 0 && !window.ptActive && !window.godModeActive && !window.isLocalPlayerDead) {
                window.ptActive = true;
                showToast("🚨 군기 0! 강제 얼차려(PT체조)를 실시합니다!", "#ef4444");
                window.lightningStunActive = true; // Freeze controls
                
                let jumps = 0;
                const ptInterval = setInterval(() => {
                    if (camera && camera.position.y <= 1.7) {
                        if (typeof velocity !== 'undefined' && velocity) velocity.y = 8.0;
                    }
                    jumps++;
                    if (jumps >= 6) {
                        clearInterval(ptInterval);
                        window.ptActive = false;
                        window.lightningStunActive = false;
                        window.changeDiscipline(40, "얼차려 완료");
                    }
                }, 800);
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

        const DAILY_MISSIONS = [
            { id: 'dm_shoot3',   name: '사격 훈련 참가',   desc: '사격장에서 3발 이상 명중하기',   target: 3,  rewardG: 500,  rewardExp: 100, trackKey: 'shootHits'  },
            { id: 'dm_chat5',    name: '전우와 대화',       desc: '채팅 메시지 5개 보내기',         target: 5,  rewardG: 300,  rewardExp: 60,  trackKey: 'chatCount'  },
            { id: 'dm_walk',     name: '순찰 완료',         desc: '총 이동거리 500m 달성',          target: 500,rewardG: 400,  rewardExp: 80,  trackKey: 'walkDist'   },
        ];

        // Load or init today's mission progress
        const todayKey = getTodayKey();
        if (!STATE.currentUser.dailyMissions || STATE.currentUser.dailyMissions.date !== todayKey) {
            STATE.currentUser.dailyMissions = { date: todayKey, progress: {}, completed: {} };
        }

        window.trackMission = (key, amount = 1) => {
            if (!STATE.currentUser || STATE.currentUser.dashboardOnly) return;
            const dm = STATE.currentUser.dailyMissions;
            if (dm.date !== getTodayKey()) { dm.date = getTodayKey(); dm.progress = {}; dm.completed = {}; }
            dm.progress[key] = (dm.progress[key] || 0) + amount;
            DAILY_MISSIONS.forEach(m => {
                if (m.trackKey === key && !dm.completed[m.id] && dm.progress[key] >= m.target) {
                    dm.completed[m.id] = true;
                    STATE.currentUser.money = (STATE.currentUser.money || 0) + m.rewardG;
                    db.ref('users/' + STATE.currentUser.uid).update({ money: STATE.currentUser.money });
                    gainEXP(m.rewardExp, '일일 미션 완료');
                    showToast(`📋 미션 완료: ${m.name}! (+${m.rewardG}G +${m.rewardExp}EXP)`, '#22c55e');
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

            db.ref('users').orderByChild('money').limitToLast(20).once('value', snap => {
                const users = [];
                snap.forEach(c => { const u = c.val(); if (u.username && !u.dashboardOnly) users.push(u); });
                users.sort((a, b) => (b.money || 0) - (a.money || 0));
                list.innerHTML = users.slice(0, 10).map((u, i) => {
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
                const vehicles = [window.truckMesh, window.tankMesh, window.helicopterMesh];
                let nearAny = false;
                for(const v of vehicles) { if(v && camera.position.distanceTo(v.position) < 15) nearAny = true; }
                document.getElementById('btn-vehicle').style.display = (nearAny || window.inVehicle) ? 'block' : 'none';
            }
        }, 1000);

        animate();
    };

    const setupPCControls = () => {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        canvas.addEventListener('click', () => {
            const isMobile = /Mobi|Android|iPhone|iPad|PlayBook/i.test(navigator.userAgent);
            if (isMobile) return; // Skip pointer lock only on actual mobile/tablet browsers
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
        const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);
        
        // Rotate searchlights
        if (window.searchlights) {
            const timeSec = time / 1000;
            window.searchlights.forEach(light => {
                light.group.rotation.y = light.baseAngle + Math.sin(timeSec * light.speed) * 0.8;
            });
        }

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
            if (window.inHelicopter) {
                if (keys['KeyW'] || keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 800.0 * delta;
                if (keys['KeyS'] || keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 800.0 * delta;
                if (keys['KeyA'] || keys['a'] || keys['A'] || keys['ArrowLeft']) camera.rotation.y += 1.5 * delta;
                if (keys['KeyD'] || keys['d'] || keys['D'] || keys['ArrowRight']) camera.rotation.y -= 1.5 * delta;
                if (keys['KeyQ'] || keys['q'] || keys['Q']) camera.position.y += 20 * delta;
                if (keys['KeyE'] || keys['e'] || keys['E']) camera.position.y -= 20 * delta;
            } else {
                if (keys['KeyW'] || keys['w'] || keys['W'] || keys['ArrowUp']) velocity.z -= 400.0 * delta;
                if (keys['KeyS'] || keys['s'] || keys['S'] || keys['ArrowDown']) velocity.z += 400.0 * delta;
                if (keys['KeyA'] || keys['a'] || keys['A'] || keys['ArrowLeft']) velocity.x -= 400.0 * delta;
                if (keys['KeyD'] || keys['d'] || keys['D'] || keys['ArrowRight']) velocity.x += 400.0 * delta;
            }
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

            // Apply building collisions (unless flying in a helicopter)
            if (!(window.inHelicopter || (window.inVehicle && window.currentVehicle === window.helicopterMesh))) {
                handleWorldCollisions(camera.position, oldPos);
            }

            // Proximity to Marshal's Office ladder (centered at x: 0, z: -162.4)
            const nearLadder = Math.abs(camera.position.x) < 2.0 && Math.abs(camera.position.z - (-162.4)) < 2.0;

            // Gravity/Floor Check
            let floorY = 1.6;

            // Staircase collision check
            if (Math.abs(dx) < 5 && dz > 0 && dz < 40) {
                floorY = (-dz * 0.5) + 1.6;
            } else if (camera.position.y < -30 && Math.abs(camera.position.x) < 20 && Math.abs(camera.position.z + 150) < 20) {
                // Underground bunker floor level
                floorY = -40 + 1.6;
            } else if (camera.position.y < -10 || (Math.abs(dx) < 20 && Math.abs(dz) < 20 && camera.position.y < 0)) {
                floorY = JAIL_CONFIG.pos.y + 1.6;
            }

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
                        if (velocity.y < -15.0 && !window.godModeActive && !window.isLocalPlayerDead) {
                            camera.position.y = floorY;
                            velocity.y = 0;
                            triggerLocalPlayerDeath("낙하 및 추락");
                            showToast("💀 낙하 충격으로 인해 전사하셨습니다!", "#ff0000");
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
            const isHeli = v === window.helicopterMesh;
            v.position.set(camera.position.x, isHeli ? camera.position.y - 2 : 0, camera.position.z);
            v.rotation.y = camera.rotation.y;
            
            if (isHeli) {
                if (window.heliRotor) window.heliRotor.rotation.y += 20 * delta;
                if (window.heliTailRotor) window.heliTailRotor.rotation.x += 20 * delta;
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
                    lastSeen: Date.now()
                });

                // Update Local Player Body Color for 3rd Person View
                if (window.localPlayerBody) {
                    const getRankColor = (rank, isJailed) => {
                        if (window.isDressUniform) return 0xffffff; // White dress uniform!
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
            <p style="font-size:1.5rem; margin-bottom:30px; color:#ddd;">${shooterName}님의 총에 맞아 전사하였습니다.</p>
            <div id="respawn-timer" style="font-size:2rem; font-weight:bold; color:#ffcc00; background:rgba(0,0,0,0.5); padding:10px 30px; border-radius:10px; border:1px solid rgba(255,255,255,0.2);">5초 후 부활합니다...</div>
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

            if (!otherPlayers[uid]) {
                // Create new complex player mesh
                const group = createPlayerModel(0x4b5320);
                group.position.y = 1.6; // Initial offset
                scene.add(group);
                otherPlayers[uid] = { mesh: group, lastColor: 0x4b5320 };
            }

            // Store target position for lerp in animate loop (don't lerp here)
            const playerObj = otherPlayers[uid];
            const targetX = p.x;
            const targetY = p.y - 1.6;
            const targetZ = p.z;
            playerObj.targetPos = { x: targetX, y: targetY, z: targetZ, ry: p.ry, isDead: p.isDead };

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
                playerObj.mesh.rotation.x += (0 - playerObj.mesh.rotation.x) * lerpFactor;
                playerObj.mesh.position.y += (t.y - playerObj.mesh.position.y) * lerpFactor;
                if (playerObj.label) playerObj.label.visible = true;
            }
            let diffRot = t.ry - playerObj.mesh.rotation.y;
            diffRot = Math.atan2(Math.sin(diffRot), Math.cos(diffRot));
            playerObj.mesh.rotation.y += diffRot * lerpFactor;
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
            if (window.activeWeaponId === 'k14') {
                camera.fov = camera.fov === 75 ? 20 : 75;
                camera.updateProjectionMatrix();
                showToast(camera.fov === 20 ? "🎯 저격 스코프 조준" : "조준 해제", "#3b82f6");
            } else if (window.hasAdvancedScope && (window.activeWeaponId === 'k2' || window.activeWeaponId === 'golden_k2')) {
                camera.fov = camera.fov === 75 ? 12 : 75;
                camera.updateProjectionMatrix();
                showToast(camera.fov === 12 ? "🎯 고배율 조준경 조준" : "조준 해제", "#3b82f6");
            }
        }
    });
    window.addEventListener('contextmenu', (e) => {
        if (window.activeWeaponId === 'k14') {
            e.preventDefault();
        }
    });
    
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        keys[e.code] = true;
        keys[e.key] = true;
        
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
        
        // Perspective Toggle (1st/3rd Person)
        if (e.key === 'r' || e.key === 'R') {
            window.isThirdPerson = !window.isThirdPerson;
            if (window.localPlayerBody) window.localPlayerBody.visible = window.isThirdPerson;
            if (window.localWeapon) window.localWeapon.visible = !window.isThirdPerson && window.hasK2;
        }
        
        // G key: Enter/Exit ground vehicles
        if (e.key === 'g' || e.key === 'G') {
            if (typeof tryEnterVehicle === 'function') tryEnterVehicle();
        }

        // F key: Helicopter (legacy, kept for ree1203)
        if ((e.key === 'f' || e.key === 'F') && window.helicopterMesh) {
            const hPos = window.helicopterMesh.position;
            const dist = Math.sqrt(Math.pow(camera.position.x - hPos.x, 2) + Math.pow(camera.position.z - hPos.z, 2));
            if (dist < 15) {
                if (STATE.currentUser.username !== 'ree1203') { alert("이 헬기는 원수(ree1203) 전용입니다!"); return; }
                window.inHelicopter = !window.inHelicopter;
                if (window.inHelicopter) {
                    alert("🚁 대장 전용 헬기에 탑승했습니다!\n[W/S: 전진/후진] [A/D: 회전] [Q/E: 고도] [F: 내리기]");
                    camera.position.set(hPos.x, hPos.y + 2, hPos.z);
                } else {
                    alert("헬기에서 내렸습니다."); camera.position.y = 1.6;
                }
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

        // Deactivate the coupon globally (one-time use)
        updates[`server/coupons/${code}/active`] = false;
        updates[`server/coupons/${code}/usedBy`] = STATE.currentUser.uid;
        updates[`server/coupons/${code}/usedAt`] = Date.now();
        updates[`server/coupons/${code}/rewardAmount`] = rewardG;

        updates[`coupons/${code}/active`] = false;
        updates[`coupons/${code}/usedBy`] = STATE.currentUser.uid;
        updates[`coupons/${code}/usedAt`] = Date.now();
        updates[`coupons/${code}/rewardAmount`] = rewardG;

        db.ref().update(updates).then(() => {
            alert(`🧧 쿠폰 적용 성공!\n🎉 축하합니다! 랜덤 포상금 +${rewardG.toLocaleString()}G (다이아 +${rewardDia}) 지급되었습니다!\n(이 쿠폰은 사용 완료 처리되어 재사용이 불가능합니다.)`);
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