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

        if (FIREBASE_ENABLED && auth) {
            showToast('서버 연결 중...', 'info');
            const email = getFirebaseEmail(userIn);
            auth.signInWithEmailAndPassword(email, passIn)
                .then((userCredential) => {
                    const user = userCredential.user;
                    db.ref('users/' + user.uid).once('value').then((snapshot) => {
                        const userData = snapshot.val();
                        STATE.currentUser = { ...(userData || {}), uid: user.uid, username: userIn };
                        if (isCreator) STATE.currentUser.role = 'creator';
                        
                        showToast(`환영합니다, ${STATE.currentUser.username}님!`, 'success');
                        saveData(); updateUI(); app.updateDesktop();
                        showScreen('menu-screen');
                    });
                }).catch(err => {
                    showToast(`로그인 실패: ${err.message}`, 'error');
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
        
        // 강력한 비밀번호 검증 (8자 이상, 대소문자, 숫자, 특수문자 모두 포함)
        const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})");
        if (!strongRegex.test(passIn)) {
            errEl.textContent = '경고: 영문 대/소문자, 숫자, 특수기호(!@#$%^&*)를 모두 포함하여 8자 이상 안전하게 설정해야 합니다.';
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
                        role: 'user',
                        coins: 1000,
                        diamonds: 50,
                        health: 100, hunger: 100, thirst: 100,
                        createdAt: Date.now()
                    };
                    // 데이터베이스에 유저 초기 정보 저장
                    return db.ref('users/' + user.uid).set(defaultData).then(() => {
                        showToast(`가입 완료! 람메일(${userIn})님 환영합니다.`, 'success');
                        STATE.currentUser = { ...defaultData, uid: user.uid };
                        saveData(); updateUI(); 
                        if (window.app && window.app.updateDesktop) app.updateDesktop();
                        showScreen('menu-screen');
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
};
