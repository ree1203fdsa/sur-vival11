// auth.js - 군대 시뮬레이션 인증 로직

const initAuth = () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const goRegBtn = document.getElementById('go-to-register');
    const goLoginBtn = document.getElementById('go-to-login');
    const branchGrid = document.querySelector('.branch-grid');
    const confirmBranchBtn = document.getElementById('confirm-branch');

    let selectedBranch = null;

    // 화면 전환
    goRegBtn.onclick = () => showScreen('register-screen');
    goLoginBtn.onclick = () => showScreen('login-screen');

    // 로그인 핸들러
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        // 관리자 계정 체크
        if (username === 'ree1203' && password === 'hjklfdsa1203') {
            STATE.currentUser = STATE.users.find(u => u.username === 'ree1203');
            completeLogin();
            return;
        }

        if (FIREBASE_ENABLED && auth) {
            const email = `${username}@military.com`;
            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    db.ref('users/' + user.uid).once('value').then(snap => {
                        const userData = snap.val();
                        if (userData) {
                            STATE.currentUser = { ...userData, uid: user.uid };
                            if (!STATE.currentUser.branch) {
                                showScreen('branch-screen');
                            } else {
                                completeLogin();
                            }
                        }
                    });
                })
                .catch(err => alert("로그인 실패: " + err.message));
        } else {
            // 로컬 모드
            const found = STATE.users.find(u => u.username === username && u.password === password);
            if (found) {
                STATE.currentUser = found;
                if (!STATE.currentUser.branch) {
                    showScreen('branch-screen');
                } else {
                    completeLogin();
                }
            } else {
                alert("아이디 또는 비밀번호가 틀립니다.");
            }
        }
    };

    // 회원가입 핸들러
    registerForm.onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const name = document.getElementById('reg-name').value.trim();
        const password = document.getElementById('reg-password').value;

        if (FIREBASE_ENABLED && auth) {
            const email = `${username}@military.com`;
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    const newUser = {
                        username,
                        name,
                        rank: '이병',
                        branch: null,
                        role: 'user',
                        jailTime: 0,
                        createdAt: Date.now()
                    };
                    db.ref('users/' + user.uid).set(newUser).then(() => {
                        alert("회원가입 성공! 로그인해주세요.");
                        showScreen('login-screen');
                    });
                })
                .catch(err => alert("가입 실패: " + err.message));
        } else {
            // 로컬 모드
            const newUser = {
                username,
                name,
                rank: '이병',
                branch: null,
                role: 'user',
                password
            };
            STATE.users.push(newUser);
            saveData();
            alert("회원가입 성공 (로컬)!");
            showScreen('login-screen');
        }
    };

    // 병과 및 팀 선택
    if (branchGrid) {
        branchGrid.querySelectorAll('.branch-card').forEach(card => {
            card.onclick = () => {
                if (card.dataset.team) {
                    // 팀 선택
                    branchGrid.querySelectorAll('.branch-card[data-team]').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedTeam = card.dataset.team;
                    
                    if (selectedTeam === 'SOLDIER') {
                        document.getElementById('branch-selection-area').style.display = 'block';
                    } else {
                        document.getElementById('branch-selection-area').style.display = 'none';
                        selectedBranch = '레이더 연합';
                    }
                } else if (card.dataset.branch) {
                    // 병과 선택
                    document.querySelectorAll('.branch-card[data-branch]').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedBranch = card.dataset.branch;
                }
            };
        });
    }

    confirmBranchBtn.onclick = () => {
        if (!selectedTeam) {
            alert("팀을 선택해주세요.");
            return;
        }
        if (selectedTeam === 'SOLDIER' && !selectedBranch) {
            alert("병과를 선택해주세요.");
            return;
        }

        STATE.currentUser.team = selectedTeam;
        STATE.currentUser.branch = selectedBranch;
        
        if (FIREBASE_ENABLED && db && STATE.currentUser.uid) {
            db.ref('users/' + STATE.currentUser.uid).update({ 
                team: selectedTeam,
                branch: selectedBranch 
            }).then(() => {
                completeLogin();
            });
        } else {
            saveData();
            completeLogin();
        }
    };
};

const completeLogin = () => {
    document.getElementById('hud-rank').textContent = STATE.currentUser.team === 'RAIDER' ? '테러리스트' : STATE.currentUser.rank;
    document.getElementById('hud-branch').textContent = STATE.currentUser.branch;
    document.getElementById('hud-name').textContent = STATE.currentUser.name;

    if (STATE.currentUser.team === 'RAIDER') {
        document.querySelector('.rank-badge').style.borderLeftColor = 'var(--danger)';
    }

    if (STATE.currentUser.rank === '대장') {
        document.getElementById('admin-panel').style.display = 'block';
    }

    showScreen('game-ui');
};
