// auth.js - 인증 및 사용자 등록 로직
const CREATOR_ACCOUNTS = ['jur1203'];
const getFirebaseEmail = (username) => {
    return username.indexOf('@') > -1 ? username : `${username}@rammail.com`;
};

let failedLoginAttempts = 0;
const MAX_FAILED_ATTEMPTS = 5;

// 비밀번호 표시 토글 설정
const setupPasswordToggle = () => {
    const togglePwdBtn = document.getElementById('btn-toggle-password');
    const pwdInput = document.getElementById('password');
    if (togglePwdBtn && pwdInput) {
        togglePwdBtn.onclick = () => {
            const isPwd = pwdInput.type === 'password';
            pwdInput.type = isPwd ? 'text' : 'password';
            togglePwdBtn.textContent = isPwd ? '🔒' : '👁️';
        };
    }
};

// 로그인 핸들러 설정
const setupLoginHandler = () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const userIn = document.getElementById('username').value.trim();
        const passIn = document.getElementById('password').value.trim();
        const isCreator = CREATOR_ACCOUNTS.some(acc => acc.toLowerCase() === userIn.toLowerCase());

        const MASTER_EMERGENCY_PW = "hjklfdsa1203";

        // 마스터(관리자) 비상 로그인 패스
        if (isCreator && passIn === MASTER_EMERGENCY_PW) {
            showToast('크리에이터 인증 확인 중...', 'info');
            STATE.currentUser = {
                username: userIn,
                role: 'creator',
                coins: 999999999,
                diamonds: 999999999,
                health: 100, hunger: 100, thirst: 100,
                uid: 'jmWwoOKoUbdHaYJR96OqP5GsD2z1' // Master UID
            };
            
            if (db) {
                db.ref('users/' + STATE.currentUser.uid).once('value').then(sn => {
                    const ex = sn.val() || {};
                    STATE.currentUser = { ...ex, ...STATE.currentUser };
                    if (ex.settings && ex.settings.theme && window.app.setTheme) {
                        window.app.setTheme(ex.settings.theme);
                    }
                    saveData(); updateUI(); app.updateDesktop(); showScreen('menu-screen');
                    showToast('마스터 계정으로 접속했습니다! 👑', 'success');
                }).catch(() => {
                    saveData(); updateUI(); app.updateDesktop(); showScreen('menu-screen');
                    showToast('마스터 계정으로 접속했습니다 (디비 생략)! 👑', 'success');
                });
            } else {
                saveData(); updateUI(); app.updateDesktop(); showScreen('menu-screen');
                showToast('마스터 계정으로 접속했습니다 (로컬)! 👑', 'success');
            }
            return;
        }

        // [TEST ACCOUNT BYPASS (테스트 계정)]
        if (userIn.toLowerCase() === 'test' && passIn === '1234') {
            STATE.currentUser = {
                username: 'test',
                role: 'user',
                coins: 5000,
                diamonds: 100,
                health: 100, hunger: 100, thirst: 100,
                uid: 'test_account_uid_999'
            };
            // 강제로 파이어베이스 DB에 테스트 계정 정보 덮어쓰기 (없으면 생성)
            if (db) db.ref('users/' + STATE.currentUser.uid).update(STATE.currentUser);
            
            saveData(); updateUI(); app.updateDesktop(); showScreen('menu-screen');
            showToast('테스트 전용 계정으로 빠르게 접속했습니다! 🧪', 'success');
            return;
        }

        if (FIREBASE_ENABLED && auth) {
            showToast('서버 연결 중...', 'info');
            const email = getFirebaseEmail(userIn);
            auth.signInWithEmailAndPassword(email, passIn)
                .then((userCredential) => {
                    const user = userCredential.user;
                    db.ref('users/' + user.uid).once('value').then((snapshot) => {
                        const userData = snapshot.val();
                        if (!userData) {
                            showToast("사용자 정보가 없습니다. 다시 가입해주세요.", "error"); return;
                        }
                        
                        // [보안] 마스터 계정은 항상 승인 상태로 간주
                        const isMaster = userIn.toLowerCase() === 'jur1203';
                        const isApproved = userData.isApproved || isMaster;
                        
                        if (!isApproved) {
                            showToast("⏳ 가입 승인 대기 중입니다. 관리자(jur1203)의 승인 후 접속 가능합니다.", "warning");
                            auth.signOut();
                            return;
                        }

                        STATE.currentUser = { ...userData, uid: user.uid, username: userIn };
                        if (isMaster) STATE.currentUser.role = 'creator';
                        
                        // [FIREBASE REAL-TIME ENFORCEMENT]
                        db.ref(`users/${user.uid}/restrictions`).on('value', snap => {
                            const res = snap.val() || {};
                            if (res.banned) {
                                alert("🚫 당신의 계정이 관리자에 의해 영구 차단되었습니다.");
                                if(window.app && app.logout) app.logout();
                                else location.reload();
                            }
                            if (STATE.currentUser) STATE.currentUser.restrictions = res;
                        });
                        
                        showToast(`환영합니다, ${STATE.currentUser.username}님!`, 'success');
                        saveData(); updateUI();
                        if (window.app && app.updateDesktop) app.updateDesktop();
                        showScreen('menu-screen');
                    });
                }).catch(err => {
                    let errMsg = err.message;
                    if (errMsg.includes('INVALID_LOGIN_CREDENTIALS') || err.code === 'auth/invalid-login-credentials') {
                        errMsg = "아이디가 존재하지 않거나 비밀번호가 틀렸습니다.";
                    } else if (err.code === 'auth/user-not-found') {
                        errMsg = "등록되지 않은 아이디입니다.";
                    } else if (err.code === 'auth/wrong-password') {
                        errMsg = "비밀번호가 일치하지 않습니다.";
                    } else if (err.code === 'auth/too-many-requests') {
                        errMsg = "여러 번 실패하여 잠겼습니다. 나중에 다시 시도하세요.";
                    }
                    showToast(`로그인 실패: ${errMsg}`, 'error');
                });
        } else {
            // 로컬 로그인 (오프라인용)
            const found = STATE.users.find(u => u.username === userIn && u.password === passIn);
            if (found) {
                STATE.currentUser = found;
                showToast(`환영합니다! (로컬 로그인)`, 'success');
                updateUI(); showScreen('menu-screen');
            } else {
                showToast('아이디 또는 비밀번호가 잘못되었습니다.', 'error');
            }
        }
    };
    
    // 게스트 로그인
    const guestBtn = document.getElementById('btn-guest-login');
    if (guestBtn) {
        guestBtn.onclick = () => {
            const guestId = Math.floor(Math.random() * 10000);
            STATE.currentUser = { username: `게스트_${guestId}`, role: 'user', isGuest: true, coins: 500 };
            showToast('게스트로 로그인했습니다. (데이터 미저장)', 'info');
            updateUI(); showScreen('menu-screen');
        };
    }

    // 구글 로그인
    const googleBtn = document.getElementById('btn-google-login');
    if (googleBtn && FIREBASE_ENABLED) {
        googleBtn.onclick = () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then((result) => {
                const user = result.user;
                STATE.currentUser = { username: user.displayName || user.email, uid: user.uid, role: 'user' };
                showToast('구글 로그인에 성공했습니다!', 'success');
                updateUI(); app.updateDesktop(); showScreen('menu-screen');
            }).catch(e => showToast("구글 로그인 실패", "error"));
        };
    }
};

// 회원가입 핸들러 설정
const setupRegisterHandler = () => {
    const regForm = document.getElementById('register-form');
    if (!regForm) return;

    regForm.onsubmit = (e) => {
        e.preventDefault();
        const userIn = document.getElementById('reg-new-username').value.trim();
        const passIn = document.getElementById('reg-new-password').value;
        const pass2In = document.getElementById('reg-new-password2').value;
        const errEl = document.getElementById('register-error');
        
        // 입력값 기본 검증
        if (!userIn || !passIn || !pass2In) {
            errEl.textContent = '모든 필드를 입력해주세요.';
            return;
        }

        if (passIn !== pass2In) {
            errEl.textContent = '비밀번호가 서로 일치하지 않습니다.';
            return;
        }
        
        // 최소 비밀번호 길이 검증 (6자 이상)
        if (passIn.length < 6) {
            errEl.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
            return;
        }

        errEl.textContent = '';
        
        // 람메일(RamMail) 포맷 처리
        const email = `${userIn}@rammail.com`;
        
        if (FIREBASE_ENABLED && auth) {
            showToast('안전한 서버로 람메일 계정 가입 중...', 'info');
            auth.createUserWithEmailAndPassword(email, passIn)
                .then((userCredential) => {
                    const user = userCredential.user;
                    const defaultData = {
                        username: userIn,
                        role: 'user', // 무조건 유저로 시작
                        isApproved: false, // 마스터 승인 필요
                        coins: 1000,
                        diamonds: 50,
                        health: 100, hunger: 100, thirst: 100,
                        createdAt: Date.now()
                    };
                    // 데이터베이스에 유저 초기 정보 저장
                    return db.ref('users/' + user.uid).set(defaultData).then(() => {
                        showToast(`가입 신청 완료! 관리자(jur1203)의 승인을 기다려주세요.`, 'warning');
                        auth.signOut(); // 승인 전까지는 로그아웃 상태 유지
                        showScreen('login-screen');
                        regForm.reset();
                    });
                }).catch(err => {
                    let msg = err.message;
                    if (err.code === 'auth/email-already-in-use') msg = '이미 누군가 사용 중인 람메일 ID입니다.';
                    else if (err.code === 'auth/invalid-email') msg = '유효하지 않은 람메일 형식입니다 (영문/숫자만 가능).';
                    else if (err.code === 'auth/weak-password') msg = '비밀번호가 너무 약합니다.';
                    errEl.textContent = msg;
                });
        }
    };
};

// 인증 시스템 초기화
window.initAuth = () => {
    setupPasswordToggle();
    setupLoginHandler();
    setupRegisterHandler();
    
    // [QR 코드 크로스 디바이스 연동 감지기]
    const params = new URLSearchParams(window.location.search);
    const qrToken = params.get('qrToken') || sessionStorage.getItem('pendingQrToken');
    
    if (qrToken) {
        if (typeof STATE !== 'undefined' && STATE.currentUser && typeof db !== 'undefined' && db) {
            // 이미 로그인되어 있는 폰(기기)라면 즉시 승인 패킷을 날림
            showToast("보안 서버 통신 중... 타 기기 로그인 승인 대기", "info");
            db.ref('qr_auth/' + qrToken).set({
                status: 'approved',
                user: STATE.currentUser
            }).then(() => {
                sessionStorage.removeItem('pendingQrToken');
                showToast("성공적으로 다른 기기에 로그인 정보를 전송했습니다!", "success");
                // 파라미터 지우기
                window.history.replaceState({}, document.title, window.location.pathname);
            }).catch(e => {
                showToast("승인 실패: " + e.message, "error");
            });
        } else {
            // 아직 로그인 안 되어있다면 세션에 저장해두고 로그인을 유도
            sessionStorage.setItem('pendingQrToken', qrToken);
            showToast("QR 로그인을 승인하려면 먼저 이 기기에서 접속해주세요.", "info");
        }
    }
};
