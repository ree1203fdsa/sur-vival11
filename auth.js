// auth.js - Authentication and User Session Management

function initAuth() {
    const loginBtn = document.getElementById('btn-login');
    const guestBtn = document.getElementById('btn-guest');
    if (!loginBtn) return;

    guestBtn.onclick = guestLogin;
    
    loginBtn.onclick = () => {
        const idInput = document.getElementById('login-id');
        const pwInput = document.getElementById('login-pw');
        
        if (!idInput || !pwInput) {
            console.error("Login inputs not found");
            return;
        }

        const username = idInput.value.trim();
        const password = pwInput.value.trim();

        if (!username || !password) {
            alert("군번과 암호를 입력하십시오.");
            return;
        }

        // 1. Check Master Admin First (Config.js 기반)
        const admin = STATE.users.find(u => u.username === username && u.password === password);
        
        if (admin) {
            STATE.currentUser = {
                uid: username, // Admin uses username as UID for simplicity
                username: admin.username,
                name: admin.name,
                rank: admin.rank,
                branch: admin.branch,
                role: admin.role
            };
            finalizeLogin();
            return;
        }

        // 2. Firebase Database Login
        if (FIREBASE_ENABLED && db) {
            db.ref('users').orderByChild('username').equalTo(username).once('value', (snap) => {
                const users = snap.val();
                if (users) {
                    const uid = Object.keys(users)[0];
                    const user = users[uid];
                    if (user.password === password) {
                        STATE.currentUser = { ...user, uid: uid };
                        finalizeLogin();
                    } else {
                        alert("암호가 일치하지 않습니다.");
                    }
                } else {
                    // Auto-register if user doesn't exist (For test/demo)
                    autoRegister(username, password);
                }
            });
        } else {
            alert("네트워크 연결을 확인하십시오. (Firebase Disabled)");
        }
    };

    const googleBtn = document.getElementById('btn-google-login');
    if (googleBtn) {
        googleBtn.onclick = () => {
            if (typeof firebase === 'undefined' || !auth) {
                return alert("Firebase가 초기화되지 않았거나 로드 중입니다.");
            }
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then((result) => {
                const user = result.user;
                if (!user) return;

                db.ref('users/' + user.uid).once('value', (snap) => {
                    let userData = snap.val();
                    if (userData) {
                        STATE.currentUser = { ...userData, uid: user.uid };
                        if (STATE.currentUser.isBanned) {
                            auth.signOut();
                            return alert("당신의 계정은 관리자에 의해 정지되었습니다.");
                        }
                        if (STATE.currentUser.jailTime && STATE.currentUser.jailTime > Date.now()) {
                            auth.signOut();
                            alert("현재 영창에 수감 중입니다! 남은 시간: " + Math.ceil((STATE.currentUser.jailTime - Date.now()) / 60000) + "분");
                            return;
                        }
                        finalizeLogin();
                    } else {
                        // Auto register Google user
                        const newUser = {
                            username: user.email ? user.email.split('@')[0] : 'google_' + Math.floor(Math.random() * 100000),
                            name: user.displayName || '구글 요원',
                            rank: '이등병',
                            branch: '육군',
                            role: 'user',
                            team: 'SOLDIER',
                            email: user.email || ''
                        };
                        db.ref('users/' + user.uid).set(newUser).then(() => {
                            STATE.currentUser = { ...newUser, uid: user.uid };
                            finalizeLogin();
                        });
                    }
                });
            }).catch((err) => {
                console.error("Google Login Error:", err);
                alert("구글 로그인 실패: " + err.message);
            });
        };
    }
}

function autoRegister(username, password) {
    const newUser = {
        username: username,
        password: password,
        name: username + " 요원",
        rank: "이등병",
        branch: "육군",
        role: "user",
        team: "SOLDIER"
    };

    if (db) {
        const newRef = db.ref('users').push();
        newRef.set(newUser).then(() => {
            STATE.currentUser = { ...newUser, uid: newRef.key };
            alert("신병으로 등록되었습니다. 작전을 시작합니다!");
            finalizeLogin();
        });
    }
}

function guestLogin() {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const guestUser = {
        uid: "guest_" + randomId,
        username: "guest_" + randomId,
        name: "게스트_" + randomId,
        rank: "이등병",
        branch: "방문객",
        role: "guest",
        team: "SOLDIER",
        isGuest: true
    };
    
    STATE.currentUser = guestUser;
    alert("방문객 신분으로 임시 입영합니다.");
    finalizeLogin();
}

function finalizeLogin() {
    // Save to HUD
    document.getElementById('hud-name').textContent = STATE.currentUser.name;
    document.getElementById('hud-rank').textContent = STATE.currentUser.rank;
    document.getElementById('hud-branch').textContent = STATE.currentUser.branch;

    // Switch Screen
    showScreen('game-ui');
    
    // Welcome Message
    sendMessage(`🫡 [입영] ${STATE.currentUser.name} (${STATE.currentUser.rank}) 요원이 작전 구역에 진입했습니다.`);
}

window.initAuth = initAuth;
