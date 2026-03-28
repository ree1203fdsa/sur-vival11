// --- PERSISTENCE ---
const STORAGE_KEY = 'SURVIVAL_3D_DATA';

// --- FIREBASE SYSTEM (OPTIONAL MULTIPLAYER & CHAT) ---
// 아래 값을 발급받은 Firebase 정보로 채우고 false를 true로 바꾸면 서버 연동이 시작됩니다!
const FIREBASE_ENABLED = true;
const firebaseConfig = {
    apiKey: "AIzaSyCAaUYvodBomR0oue6wJ5siLRQbI9o1JHo",
    authDomain: "survival-8fa1c.firebaseapp.com",
    databaseURL: "https://survival-8fa1c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "survival-8fa1c",
    storageBucket: "survival-8fa1c.firebasestorage.app",
    messagingSenderId: "965848930070",
    appId: "1:965848930070:web:f3301c77fb94f99dd42237",
    measurementId: "G-KEF6NJTG6H"
};

let db = null;
let auth = null;
let isSyncingUsers = false;
let isFirebaseChatAttached = false;
const syncAllUsers = (force = false) => {
    if (isSyncingUsers && !force) return;

    if (db && STATE.currentUser && (STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator')) {
        isSyncingUsers = true;

        // Init Chat for Admin
        if (STATE.currentUser && (STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator')) {
            // Re-sync logic here if needed
        }

        // try primary path
        db.ref('users').once('value').then((snapshot) => {
            const allUsers = snapshot.val();
            if (allUsers) {
                // Deduplicate by username to prevent showing same account multiple times
                const uniqueUsers = [];
                const seenNames = new Set();
                
                Object.keys(allUsers).forEach(uid => {
                    const u = allUsers[uid];
                    if (u && u.username && !seenNames.has(u.username.toLowerCase())) {
                        uniqueUsers.push({ ...u, uid: uid });
                        seenNames.add(u.username.toLowerCase());
                    }
                });

                STATE.users = uniqueUsers;
                forceEssentialAccounts();
                actualRenderAdminUserList();
            }
            isSyncingUsers = false;
        }).catch((error) => {
            console.warn("User list sync error handled silently:", error.message);
            isSyncingUsers = false;
            // Provide more actionable feedback only if it's the master
            if (STATE.currentUser.username === 'ree1203fdsa' && error.code === 'PERMISSION_DENIED') {
                showToast("데이터베이스 권한 오류: 콘솔에서 룰 설정을 확인해주세요. (게임 플레이는 가능)", 'warning');
            }
        });
    }
};

if (FIREBASE_ENABLED && typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();

    // persistent login check (Auto-login disabled per user request)
    auth.onAuthStateChanged((user) => {
        // Automatically sign out if there's a residual session, enforcing manual login
        if (user && !STATE.currentUser) {
            auth.signOut().catch(e => console.error("Sign out error", e));
        }
    });
}

const loadData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Data load failed", e);
        }
    }
    return null;
};

const saveData = () => {
    const dataToSave = {
        users: STATE.users,
        applications: STATE.applications,
        settings: STATE.settings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

    // Firebase Data Sync
    if (db && STATE.currentUser && !STATE.currentUser.isGuest) {
        // UID가 있는 경우 (Firebase Auth 로그인 상태)
        const uid = STATE.currentUser.uid;
        if (uid) {
            db.ref('users/' + uid).set(STATE.currentUser).catch(e => console.error(e));
        }

        // 전체 유저 목록 동기화 (관리자용 - 필요 시 활성화)
        // db.ref('game_data').set(dataToSave).catch(e => console.error(e));
    }
};

const savedState = loadData();

// --- HELPERS ---
const syncDataFromStorage = () => {
    const saved = loadData();
    if (saved) {
        STATE.users = saved.users || [];
        STATE.applications = saved.applications || [];

        // Update currentUser reference if they are in the new users list
        if (STATE.currentUser) {
            const updatedUser = STATE.users.find(u => u.username === STATE.currentUser.username);
            if (updatedUser) STATE.currentUser = updatedUser;
        }
    }
};

// State Management
const STATE = {
    currentUser: null,
    users: savedState ? savedState.users : [
        {
            username: 'ree1203fdsa',
            password: '관리자',
            coins: 999999999,
            diamonds: 999999999,
            wood: 0,
            stone: 0,
            iron: 0,
            gold: 0,
            health: 100,
            hunger: 100,
            thirst: 100,
            treasures: 0,
            role: 'creator'
        },
        {
            username: 'test',
            password: '123',
            phone: '010-1234-5678',
            coins: 1000,
            diamonds: 10,
            wood: 0,
            stone: 0,
            iron: 0,
            gold: 0,
            health: 100,
            hunger: 100,
            thirst: 100,
            treasures: 0,
            role: 'user'
        }
    ],
    applications: (savedState && savedState.applications) ? savedState.applications : [],
    settings: (savedState && savedState.settings) ? savedState.settings : {
        sound: true,
        graphics: 'medium',
        fov: 75,
        sens: 1.0,
        dist: 100
    },
    selectedMap: 'classic',
    threeScene: null
};

// --- AUDIO SYSTEM ---
let audioCtx = null;
const playSound = (type = 'click') => {
    try {
        if (!STATE.settings.sound) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        
        switch(type) {
            case 'click':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
        case 'hover':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        case 'success':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        case 'error':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        case 'open':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
    }
    } catch (e) {
        console.warn("Audio system error:", e);
    }
};

// --- BGM SYSTEM ---
let bgmAudio = null;
const BGM_URL = 'solarflex-roblox-minecraft-fortnite-video-game-music-491492 (3).mp3';

const initBGM = () => {
    if (bgmAudio) return;
    bgmAudio = new Audio(BGM_URL);
    bgmAudio.loop = true;
    bgmAudio.volume = 0.3;
    
    // Attempt play on first user interaction (browser policy)
    const playOnInteract = () => {
        if (STATE.settings.sound && bgmAudio.paused) {
            bgmAudio.play().catch(e => console.warn("BGM play failed:", e));
        }
        window.removeEventListener('mousedown', playOnInteract);
        window.removeEventListener('keydown', playOnInteract);
        window.removeEventListener('touchstart', playOnInteract);
    };
    window.addEventListener('mousedown', playOnInteract);
    window.addEventListener('keydown', playOnInteract);
    window.addEventListener('touchstart', playOnInteract);
};

const updateBGMPlaying = () => {
    if (!bgmAudio) initBGM();
    if (STATE.settings.sound) {
        if (bgmAudio.paused) bgmAudio.play().catch(e => {});
    } else {
        bgmAudio.pause();
    }
};

// --- DATA SANITY CHECK (Master & Test Recovery) ---
const forceEssentialAccounts = () => {
    // 1. Master Account Recovery
    const masters = ['ree1203fdsa'];
    masters.forEach(name => {
        const u = STATE.users.find(user => user.username === name);
        if (u) {
            u.role = 'creator';
            u.password = '관리자'; // Force update to requested password
        } else {
            STATE.users.unshift({
                username: name,
                password: '관리자',
                coins: 999999999,
                diamonds: 999999999,
                health: 100,
                hunger: 100,
                thirst: 100,
                role: 'creator'
            });
        }

        // Force state if current user matches
        if (STATE.currentUser && STATE.currentUser.username === name) {
            STATE.currentUser.role = 'creator';
        }
    });

    // 2. Test Account Recovery
    const testAccount = STATE.users.find(u => u.username === 'test');
    if (!testAccount) {
        STATE.users.push({
            username: 'test',
            password: '123',
            phone: '010-1234-5678',
            coins: 1000,
            diamonds: 10,
            wood: 0,
            treasures: 0,
            role: 'user'
        });
    }
    saveData();
};
forceEssentialAccounts();

// --- PURGE DELETED ACCOUNTS ---
// (Purge logic removed to protect active accounts)

// --- UTILS & UI ---
const showToast = (message, type = 'info') => {
    if (type === 'error') playSound('error');
    else if (type === 'success') playSound('success');
    else playSound('open');

    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 3000);
};

const showScreen = (screenId) => {
    playSound('open');
    // Hide all screens except the target
    document.querySelectorAll('.screen').forEach(el => {
        if (el.id !== screenId) {
            el.classList.remove('active');
            setTimeout(() => {
                if (!el.classList.contains('active')) {
                    el.classList.add('hidden'); // Wait for fade out
                }
            }, 500);
        }
    });

    // Show target screen
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    // small delay to allow display:block to apply before animating opacity
    setTimeout(() => {
        target.classList.add('active');
        // Re-sync admin button when returning to menu
        if (screenId === 'menu-screen' && STATE.currentUser) updateUI();
    }, 10);

    // Toggle aurora background based on screen
    const bgWrapper = document.querySelector('.bg-wrapper');
    if (bgWrapper) {
        if (screenId.includes('ann-')) {
            bgWrapper.style.display = 'none'; // Hide completely for announcements
        } else {
            bgWrapper.style.display = 'block'; // Show for all other screens
        }
    }

    // Orientation check for game screen on mobile
    const warning = document.getElementById('orientation-warning');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (screenId === 'game-screen' && isTouch) {
        if (window.innerHeight > window.innerWidth) {
            warning.classList.remove('hidden');
        }
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => { });
        }
    } else {
        warning.classList.add('hidden');
    }
};

const updateUI = () => {
    if (!STATE.currentUser) return;

    // Top bar
    document.getElementById('current-username').textContent = STATE.currentUser.username;

    const user = STATE.currentUser;
    const userLvl = document.getElementById('user-level');
    const userXpBar = document.getElementById('user-xp-bar');
    if (userLvl) {
        user.level = user.level || 1;
        user.xp = user.xp || 0;
        userLvl.textContent = `Lv.${user.level}`;
        const xpNeeded = user.level * 100;
        const pct = Math.min(100, (user.xp / xpNeeded) * 100);
        if (userXpBar) userXpBar.style.width = `${pct}%`;
    }

    // Resource UI
    const isAD = STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator';
    document.getElementById('coin-amount').textContent = isAD ? '무제한' : STATE.currentUser.coins.toLocaleString();
    document.getElementById('diamond-amount').textContent = isAD ? '무제한' : STATE.currentUser.diamonds.toLocaleString();
    const stoneAmountEl = document.getElementById('stone-amount');
    if (stoneAmountEl) stoneAmountEl.textContent = isAD ? '무제한' : (STATE.currentUser.stone || 0).toLocaleString();
    const ironAmountEl = document.getElementById('iron-amount');
    if (ironAmountEl) ironAmountEl.textContent = isAD ? '무제한' : (STATE.currentUser.iron || 0).toLocaleString();
    const goldAmountEl = document.getElementById('gold-amount');
    if (goldAmountEl) goldAmountEl.textContent = isAD ? '무제한' : (STATE.currentUser.gold || 0).toLocaleString();

    const healthBar = document.querySelector('.health-bar');
    const healthText = document.getElementById('health-text');
    if (healthBar) {
        if (STATE.currentUser.health === undefined) STATE.currentUser.health = 100;
        const hp = Math.ceil(STATE.currentUser.health);
        healthBar.style.width = `${hp}%`;
        if (healthText) healthText.textContent = `${hp}%`;
    }

    // Hunger Bar sync
    const hungerBar = document.getElementById('hunger-bar');
    const hungerText = document.getElementById('hunger-text');
    if (hungerBar) {
        if (STATE.currentUser.hunger === undefined) STATE.currentUser.hunger = 100;
        const hg = Math.ceil(STATE.currentUser.hunger);
        hungerBar.style.width = `${hg}%`;
        if (hungerText) hungerText.textContent = `${hg}%`;
    }

    // Thirst Bar sync
    const thirstBar = document.getElementById('thirst-bar');
    const thirstText = document.getElementById('thirst-text');
    if (thirstBar) {
        if (STATE.currentUser.thirst === undefined) STATE.currentUser.thirst = 100;
        const th = Math.ceil(STATE.currentUser.thirst);
        thirstBar.style.width = `${th}%`;
        if (thirstText) thirstText.textContent = `${th}%`;
    }

    // Shop UI
    const shopCoinEls = document.querySelectorAll('.shop-coin-amount');
    const shopDiamondEls = document.querySelectorAll('.shop-diamond-amount');
    shopCoinEls.forEach(el => el.textContent = isAD ? '무제한' : STATE.currentUser.coins.toLocaleString());
    shopDiamondEls.forEach(el => el.textContent = isAD ? '무제한' : STATE.currentUser.diamonds.toLocaleString());

    // Inventory UI
    const woodCountEl = document.getElementById('inv-wood-count');
    if (woodCountEl) {
        woodCountEl.textContent = isAD ? '무제한' : (user.wood || 0).toLocaleString();
    }
    const stoneCountEl = document.getElementById('inv-stone-count');
    if (stoneCountEl) {
        stoneCountEl.textContent = isAD ? '무제한' : (user.stone || 0).toLocaleString();
    }
    const ironCountEl = document.getElementById('inv-iron-count');
    if (ironCountEl) {
        ironCountEl.textContent = isAD ? '무제한' : (user.iron || 0).toLocaleString();
    }
    const goldCountEl = document.getElementById('inv-gold-count');
    if (goldCountEl) {
        goldCountEl.textContent = isAD ? '무제한' : (user.gold || 0).toLocaleString();
    }
    const appleCountEl = document.getElementById('inv-apple-count');
    if (appleCountEl) {
        appleCountEl.textContent = isAD ? '무제한' : (user.food || 0).toLocaleString();
    }
    const diaCount = document.getElementById('inv-diamond-count');
    if (diaCount) diaCount.textContent = isAD ? '무제한' : (user.diamonds || 0).toLocaleString();

    const wbSlot = document.getElementById('inv-workbench-slot');
    const wbCount = document.getElementById('inv-workbench-count');
    if (user.workbench > 0) {
        if (wbSlot) wbSlot.classList.remove('hidden');
        if (wbCount) wbCount.textContent = user.workbench;
    } else {
        if (wbSlot) wbSlot.classList.add('hidden');
    }

    const saSlot = document.getElementById('inv-steel_axe-slot');
    const saCount = document.getElementById('inv-steel_axe-count');
    if (user.steel_axe > 0) {
        if (saSlot) saSlot.classList.remove('hidden');
        if (saCount) saCount.textContent = user.steel_axe;
    } else {
        if (saSlot) saSlot.classList.add('hidden');
    }

    const bowSlot = document.getElementById('inv-bow-slot');
    const bowCount = document.getElementById('inv-bow-count');
    if (user.bow > 0) {
        if (bowSlot) bowSlot.classList.remove('hidden');
        if (bowCount) bowCount.textContent = user.bow;
    } else {
        if (bowSlot) bowSlot.classList.add('hidden');
    }

    const campfireSlot = document.getElementById('inv-campfire-slot');
    const campfireCount = document.getElementById('inv-campfire-count');
    if (user.campfire > 0) {
        if (campfireSlot) campfireSlot.classList.remove('hidden');
        if (campfireCount) campfireCount.textContent = user.campfire;
    } else {
        if (campfireSlot) campfireSlot.classList.add('hidden');
    }

    // Admin Button Visibility
    const adminBtn = document.getElementById('btn-admin');
    const supportBtn = document.getElementById('btn-support');

    if (STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator') {
        adminBtn.classList.remove('hidden');
        if (supportBtn) supportBtn.classList.add('hidden');
    } else {
        adminBtn.classList.add('hidden');
        if (supportBtn) supportBtn.classList.remove('hidden');
    }

    // Refresh Shop Prices
    const treasureCount = STATE.currentUser.treasures || 0;
    const currentTreasurePrice = 164 + (treasureCount * 20);
    const treasureBuyBtn = document.querySelector('.shop-item .buy-btn'); // Assuming first one is treasure
    if (treasureBuyBtn && treasureBuyBtn.getAttribute('onclick').includes('treasure')) {
        treasureBuyBtn.innerHTML = `${currentTreasurePrice.toLocaleString()} <span class="icon">🪙</span>`;
    }
};

const CREATOR_ACCOUNTS = ['ree1203fdsa'];
const getFirebaseEmail = (username) => {
    return username.indexOf('@') > -1 ? username : `${username}@survival-3d.com`;
};

let failedLoginAttempts = 0;
let loginCooldownTimer = null;
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 3;

// Password Visibility Toggle
const togglePwdBtn = document.getElementById('toggle-password');
const pwdInput = document.getElementById('password');
if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
        if (pwdInput.type === 'password') {
            pwdInput.type = 'text';
            togglePwdBtn.textContent = '🔒'; // Hide icon
        } else {
            pwdInput.type = 'password';
            togglePwdBtn.textContent = '👁️'; // Show icon
        }
    });
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();
    const isCreator = CREATOR_ACCOUNTS.some(acc => acc.toLowerCase() === userIn.toLowerCase());

    // MASTER EMERGENCY BYPASS
    const MASTER_EMERGENCY_PW = "관리자";
    const MASTER_EMERGENCY_PW2 = "크리에이터";

    if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        // Allow ONLY master password to bypass the timed lockdown
        if (!(isCreator && (passIn === MASTER_EMERGENCY_PW || passIn === MASTER_EMERGENCY_PW2))) {
            showToast(`너무 많은 로그인 시도 실패. 잠시 후 🕒 다시 시도해 주세요.`, 'error');
            return;
        }
    }

    if (FIREBASE_ENABLED && auth) {
        // PRE-FIREBASE BYPASS: Prevent 'too-many-requests' by skipping standard auth if using emergency password
        if (isCreator && (passIn === MASTER_EMERGENCY_PW || passIn === MASTER_EMERGENCY_PW2)) {
            failedLoginAttempts = 0; // Reset attempts on successful master bypass

            showToast('파이어베이스를 완전히 우회하여 마스터로 즉시 진입합니다! 👑', 'success');

            // Bypass Firebase Auth entirely to avoid ANY errors (too-many-requests, operation-not-allowed)
            STATE.currentUser = {
                username: userIn,
                role: 'creator',
                coins: 99999,
                uid: 'jmWwoOKoUbdHaYJR96OqP5GsD2z1' // The known actual UID for ree1203fdsa from previous screenshots
            };

            // Try to sync with offline storage as a fallback
            saveData();

            updateUI();
            showScreen('menu-screen');
            return;
        }

        const loginBtn = document.querySelector('#login-form button[type="submit"]');
        if (loginBtn) loginBtn.disabled = true;

        showToast('서버 연결 및 확인 중...', 'info');
        const email = getFirebaseEmail(userIn);
        auth.signInWithEmailAndPassword(email, passIn)
            .then((userCredential) => {
                if (loginBtn) loginBtn.disabled = false;
                failedLoginAttempts = 0; // Reset on success
                const user = userCredential.user;
                db.ref('users/' + user.uid).once('value').then((snapshot) => {
                    const userData = snapshot.val();
                    if (userData) {
                        STATE.currentUser = { ...userData, uid: user.uid };
                        // Force creator role for master accounts always, regardless of DB data
                        if (isCreator) {
                            STATE.currentUser.role = 'creator';
                            db.ref('users/' + user.uid + '/role').set('creator');
                        }
                        showToast(`환영합니다, ${STATE.currentUser.username}님!`, 'success');
                        initFirebaseChatListener();
                        if (STATE.currentUser.role === 'creator') syncAllUsers();
                        updateUI();
                        showScreen('menu-screen');
                    } else if (isCreator) {
                        const masterData = { username: userIn, role: 'creator', coins: 99999, uid: user.uid };
                        db.ref('users/' + user.uid).set(masterData);
                        STATE.currentUser = masterData;
                        showToast('마스터 계정 데이터 생성 완료!', 'success');
                        initFirebaseChatListener();
                        syncAllUsers();
                        updateUI();
                        showScreen('menu-screen');
                    }
                });
            }).catch(err => {
                if (loginBtn) loginBtn.disabled = false;

                let msg = '로그인 실패';
                if (err.code === 'auth/user-not-found') msg = '존재하지 않는 아이디입니다.';
                else if (err.code === 'auth/wrong-password') {
                    msg = '비밀번호가 일치하지 않습니다.';
                    failedLoginAttempts++;
                }
                else if (err.code === 'auth/invalid-login-credentials') {
                    msg = '비밀번호가 틀렸거나 없는 계정입니다.';
                    failedLoginAttempts++;
                }
                else if (err.code === 'auth/too-many-requests') {
                    msg = '너무 많이 시도하여 서버 차단됨. 잠시 후 다시 시도하세요.';
                    failedLoginAttempts = MAX_FAILED_ATTEMPTS; // Trigger local block too
                }
                else msg = `오류: ${err.message}`;

                showToast(msg, 'error');

                if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                    showToast(`🚨 보안 시스템 발동! ${COOLDOWN_MINUTES}분 후 다시 로그인할 수 있습니다.`, 'error');
                    if (loginCooldownTimer) clearTimeout(loginCooldownTimer);
                    loginCooldownTimer = setTimeout(() => {
                        failedLoginAttempts = 0;
                        showToast(`✅ 차단이 해제되었습니다. 다시 시도 가능합니다.`, 'success');
                    }, COOLDOWN_MINUTES * 60 * 1000);
                }
            });
    } else {
        syncDataFromStorage();
        const foundUser = STATE.users.find(u => u.username === userIn && u.password === passIn);
        if (foundUser) {
            STATE.currentUser = foundUser;
            if (isCreator) STATE.currentUser.role = 'creator';
            showToast(`환영합니다, ${foundUser.username}님!`, 'success');
            updateUI();
            showScreen('menu-screen');
        } else {
            showToast('아이디 또는 비밀번호가 잘못되었습니다.', 'error');
        }
    }
});

const masterSignupBtn = document.getElementById('btn-master-signup');
if (masterSignupBtn) {
    masterSignupBtn.addEventListener('click', () => {
        showScreen('signup-screen');
    });
}

const guestLoginBtn = document.getElementById('btn-guest-login');
if (guestLoginBtn) {
    guestLoginBtn.addEventListener('click', () => {
        const guestId = Math.floor(Math.random() * 10000);
        const guestUser = {
            username: `Guest_${guestId}`,
            password: '',
            role: 'user',
            coins: 500,
            diamonds: 5,
            wood: 0,
            treasures: 0,
            isGuest: true
        };
        STATE.currentUser = guestUser;
        showToast(`게스트 계정으로 로그인했습니다. (나갈 시 초기화됩니다)`, 'info');
        updateUI();
        showScreen('menu-screen');
    });
}

const googleLoginBtn = document.getElementById('btn-google-login');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        if (!FIREBASE_ENABLED || !auth) {
            showToast('서버(Firebase)가 연결되지 않아 구글 로그인을 사용할 수 없습니다.', 'error');
            return;
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        showToast('구글 로그인 창을 여는 중...', 'info');

        auth.signInWithPopup(provider).then((result) => {
            const user = result.user;

            // Check if user exists in DB
            db.ref('users/' + user.uid).once('value').then((snapshot) => {
                const userData = snapshot.val();
                if (userData) {
                    STATE.currentUser = { ...userData, uid: user.uid };
                    showToast(`환영합니다, ${userData.username}님! (구글 로그인)`, 'success');
                } else {
                    // Create new user Data from Google
                    // Extract email prefix or use displayName
                    let newUsername = user.displayName;
                    if (!newUsername && user.email) {
                        newUsername = user.email.split('@')[0];
                    }
                    if (!newUsername) newUsername = "GoogleUser_" + Math.floor(Math.random() * 10000);

                    const newUser = {
                        username: newUsername,
                        role: CREATOR_ACCOUNTS.includes(newUsername) ? 'creator' : 'user',
                        coins: 1000,
                        diamonds: 10,
                        wood: 0,
                        stone: 0,
                        iron: 0,
                        gold: 0,
                        health: 100,
                        hunger: 100,
                        thirst: 100,
                        treasures: 0,
                        phone: user.phoneNumber || '',
                        uid: user.uid
                    };
                    db.ref('users/' + user.uid).set(newUser);
                    STATE.currentUser = newUser;
                    showToast(`구글 계정으로 신규 가입되었습니다, ${newUsername}님!`, 'success');
                }

                initFirebaseChatListener();
                if (STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator') syncAllUsers();
                updateUI();
                showScreen('menu-screen');
            });

        }).catch((error) => {
            console.error(error);
            if (error.code === 'auth/operation-not-allowed') {
                showToast('Firebase에서 Google 로그인이 켜져있지 않습니다! 개발자 설정을 확인하세요.', 'error');
            } else {
                showToast(`구글 로그인 실패 (${error.code}): ${error.message}`, 'error');
            }
        });
    });
}

// --- PUBLIC REGISTER LOGIC ---
document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const userIn = document.getElementById('reg-new-username').value.trim();
    const passIn = document.getElementById('reg-new-password').value.trim();
    const passIn2 = document.getElementById('reg-new-password2').value.trim();
    const phoneIn = document.getElementById('reg-new-phone').value.trim();
    const errorEl = document.getElementById('register-error');

    if (passIn !== passIn2) {
        errorEl.textContent = '비밀번호가 일치하지 않습니다.';
        return;
    }

    if (passIn.length < 6) {
        errorEl.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
        return;
    }

    showToast('회원가입 처리 중...', 'info');

    if (FIREBASE_ENABLED && auth) {
        const email = getFirebaseEmail(userIn);
        auth.createUserWithEmailAndPassword(email, passIn)
            .then((userCredential) => {
                const user = userCredential.user;
                const userData = {
                    username: userIn,
                    role: userIn === 'ree1203fdsa' ? 'creator' : 'user',
                    coins: 1000,
                    diamonds: 10,
                    health: 100,
                    hunger: 100,
                    thirst: 100,
                    phone: phoneIn,
                    uid: user.uid
                };
                db.ref('users/' + user.uid).set(userData).then(() => {
                    showToast('회원가입 성공! 로그인 해주세요.', 'success');
                    showScreen('login-screen');
                });
            }).catch(err => {
                if (err.code === 'auth/email-already-in-use') errorEl.textContent = '이미 사용 중인 아이디입니다.';
                else errorEl.textContent = `오류: ${err.message}`;
            });
    } else {
        // Offline / Testing
        const newUser = { username: userIn, password: passIn, phone: phoneIn, coins: 1000, role: 'user' };
        STATE.users.push(newUser);
        saveData();
        showToast('계정이 생성되었습니다 (로컬)', 'success');
        showScreen('login-screen');
    }
});

document.getElementById('btn-goto-register').addEventListener('click', () => {
    showScreen('register-screen');
});

// Admin Panel Signup (Legacy/Offline)
document.getElementById('signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const userIn = document.getElementById('reg-username').value.trim();
    const passIn = document.getElementById('reg-password').value.trim();
    const phoneIn = document.getElementById('reg-phone').value.trim();

    if (!userIn || !passIn) {
        showToast('정보를 입력해주세요.', 'error');
        return;
    }

    if (STATE.users.find(u => u.username === userIn)) {
        showToast('이미 존재하는 아이디입니다.', 'error');
        return;
    }

    const newUser = {
        username: userIn,
        password: passIn,
        phone: phoneIn,
        coins: 1000,
        diamonds: 10,
        wood: 0,
        treasures: 0,
        role: 'user'
    };

    STATE.users.push(newUser);
    saveData();
    showToast('신규 유저가 생성되었습니다.', 'success');

    // Clear and go back to admin
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-phone').value = '';

    showScreen('admin-screen');
    renderAdminUserList();
});

document.getElementById('btn-logout').addEventListener('click', () => {
    if (auth) auth.signOut();
    STATE.currentUser = null;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showScreen('login-screen');
    showToast('로그아웃 되었습니다.', 'info');
});

// --- SETTINGS LOGIC moved to app object ---


document.getElementById('btn-toggle-sound').addEventListener('click', () => {
    STATE.settings.sound = !STATE.settings.sound;
    saveData();
    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn.textContent = STATE.settings.sound ? '소리 켜짐' : '소리 꺼짐';
    soundBtn.className = STATE.settings.sound ? 'btn primary' : 'btn';
    updateBGMPlaying();
});

document.getElementById('select-graphics').addEventListener('change', (e) => {
    STATE.settings.graphics = e.target.value;
    saveData();
    showToast('그래픽 설정이 변경되었습니다. (일부 설정은 재시작 시 적용)', 'info');
});

document.getElementById('range-fov').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    STATE.settings.fov = val;
    document.getElementById('val-fov').textContent = val;
    if (STATE.threeScene && STATE.threeScene.camera) {
        STATE.threeScene.camera.fov = val;
        STATE.threeScene.camera.updateProjectionMatrix();
    }
});
document.getElementById('range-fov').addEventListener('change', saveData);

document.getElementById('range-sens').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    STATE.settings.sens = val;
    document.getElementById('val-sens').textContent = val.toFixed(1);
});
document.getElementById('range-sens').addEventListener('change', saveData);

document.getElementById('range-dist').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    STATE.settings.dist = val;
    document.getElementById('val-dist').textContent = val;
    if (STATE.threeScene && STATE.threeScene.scene && STATE.threeScene.scene.fog) {
        STATE.threeScene.camera.far = val * 2;
        STATE.threeScene.camera.updateProjectionMatrix();
        STATE.threeScene.scene.fog.far = val;
    }
});
document.getElementById('range-dist').addEventListener('change', saveData);

document.getElementById('btn-delete-account-self').addEventListener('click', () => {
    if (confirm("정말로 계정을 삭제하시겠습니까? 돌이킬 수 없습니다!")) {
        const username = STATE.currentUser.username;
        STATE.users = STATE.users.filter(u => u.username !== username);
        // clean up applications if any
        if (STATE.applications) {
            STATE.applications = STATE.applications.filter(a => a.username !== username);
        }
        STATE.currentUser = null;
        saveData();

        showToast('계정이 삭제되었습니다.', 'success');
        showScreen('login-screen');
    }
});

// Go to public register screen
document.getElementById('btn-goto-register').addEventListener('click', () => {
    document.getElementById('register-error').textContent = '';
    document.getElementById('reg-new-username').value = '';
    document.getElementById('reg-new-password').value = '';
    document.getElementById('reg-new-password2').value = '';
    document.getElementById('reg-new-phone').value = '';
    showScreen('register-screen');
});

// Public register form submit
document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
        const errEl = document.getElementById('register-error');
        errEl.textContent = '';

        const id = document.getElementById('reg-new-username').value.trim();
        const pw = document.getElementById('reg-new-password').value.trim();
        const pw2 = document.getElementById('reg-new-password2').value.trim();
        const phone = document.getElementById('reg-new-phone').value.trim();

        // Validation
        if (id.length < 4) { errEl.textContent = '❌ 아이디는 4자 이상이어야 합니다.'; return; }
        if (pw.length < 6) { errEl.textContent = '❌ 비밀번호는 6자 이상이어야 합니다.'; return; }
        if (pw !== pw2) { errEl.textContent = '❌ 비밀번호가 일치하지 않습니다.'; return; }

        if (FIREBASE_ENABLED && auth) {
            const email = getFirebaseEmail(id);
            auth.createUserWithEmailAndPassword(email, pw)
                .then((userCredential) => {
                    const user = userCredential.user;
                    const newUser = {
                        username: id,
                        phone: phone || '',
                        coins: 1000,
                        diamonds: 10,
                        wood: 0,
                        stone: 0,
                        iron: 0,
                        gold: 0,
                        health: 100,
                        hunger: 100,
                        thirst: 100,
                        treasures: 0,
                        role: CREATOR_ACCOUNTS.includes(id) ? 'creator' : 'user',
                        uid: user.uid
                    };
                    // Initial save to Firebase
                    db.ref('users/' + user.uid).set(newUser).then(() => {
                        STATE.currentUser = newUser;
                        showToast(`🎉 환영합니다, ${id}님! 서버에 계정이 생성되었습니다.`, 'success');
                        updateUI();
                        showScreen('menu-screen');
                    });
                })
                .catch((error) => {
                    console.error("Firebase Registration Error:", error);
                    errEl.textContent = '❌ 가입 실패: ' + error.message;
                });
        } else {
            console.log("Starting local registration for:", id);
            syncDataFromStorage();
            if (STATE.users.find(u => u.username === id)) {
                console.warn("User already exists:", id);
                errEl.textContent = '❌ 이미 사용 중인 아이디입니다.';
                return;
            }

            const newUser = {
                username: id,
                password: pw,
                phone: phone || '',
                coins: 1000,
                diamonds: 10,
                wood: 0,
                stone: 0,
                iron: 0,
                gold: 0,
                health: 100,
                hunger: 100,
                thirst: 100,
                treasures: 0,
                role: 'user'
            };

            STATE.users.push(newUser);
            saveData();
            console.log("User successfully registered locally:", id);

            // Auto-login after signup
            STATE.currentUser = newUser;
            showToast(`🎉 환영합니다, ${id}님! 가입이 완료되었습니다.`, 'success');
            updateUI();
            showScreen('menu-screen');
            setTimeout(() => updateUI(), 50);
        }
    } catch (err) {
        console.error("Critical Registration Form Error:", err);
        showToast("회원가입 처리 중 오류가 발생했습니다. 콘솔을 확인하세요.", 'error');
    }
});

// Toggle password visibility
document.getElementById('toggle-password').addEventListener('click', () => {
    const pwdInput = document.getElementById('password');
    const toggleBtn = document.getElementById('toggle-password');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.textContent = '🔒';
    } else {
        pwdInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    // Check for Ban
    if (STATE.currentUser && STATE.currentUser.banUntil) {
        const remaining = STATE.currentUser.banUntil - Date.now();
        if (remaining > 0) {
            const hours = Math.ceil(remaining / (1000 * 60 * 60));
            showToast(`욕설 사용으로 인해 게임 입장이 차단되었습니다. (남은 시간: 약 ${hours}시간)`, 'error');
            return;
        } else {
            // Ban expired
            delete STATE.currentUser.banUntil;
            saveData();
        }
    }
    console.log("Showing Map Selection Screen...");
    showScreen('map-selection-screen');
});

document.getElementById('btn-shop').addEventListener('click', () => {
    showScreen('shop-screen');
});

document.getElementById('btn-quest').addEventListener('click', () => {
    renderQuests();
    showScreen('quest-screen');
});

document.getElementById('btn-support').addEventListener('click', () => {
    showScreen('apply-screen');
});

document.getElementById('btn-tutorial').addEventListener('click', () => {
    app.openTutorial();
});


document.getElementById('btn-chat').addEventListener('click', () => {
    showScreen('chat-screen');
    renderChat();
});

document.getElementById('btn-mypage').addEventListener('click', () => {
    renderMyPage();
    showScreen('mypage-screen');
});

let currentMultiTab = 'global';

const ensureFriendCode = () => {
    if (!STATE.currentUser || STATE.currentUser.isGuest) return;
    
    // --- Presence Sync ---
    if (FIREBASE_ENABLED && db) {
        const presenceRef = db.ref('presence/' + STATE.currentUser.uid);
        presenceRef.set({
            username: STATE.currentUser.username,
            lastSeen: Date.now()
        });
        presenceRef.onDisconnect().remove();
    }

    if (STATE.currentUser.friendCode) {
        const el = document.getElementById('my-friend-code');
        if (el) el.textContent = STATE.currentUser.friendCode;
        return;
    }

    // Generate random 6 digits
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    STATE.currentUser.friendCode = code;
    saveData();

    if (FIREBASE_ENABLED && db) {
        db.ref('users/' + STATE.currentUser.uid + '/friendCode').set(code);
        db.ref('friend_codes/' + code).set({
            uid: STATE.currentUser.uid,
            username: STATE.currentUser.username
        });
    }
    const el = document.getElementById('my-friend-code');
    if (el) el.textContent = code;
};

const switchTab = (tab) => {
    currentMultiTab = tab;
    const btnGlobal = document.getElementById('btn-tab-global');
    const btnFriends = document.getElementById('btn-tab-friends');
    if (btnGlobal) btnGlobal.classList.toggle('active', tab === 'global');
    if (btnFriends) btnFriends.classList.toggle('active', tab === 'friends');
    
    // Toggle friend add UI
    const addUI = document.getElementById('friend-add-by-code');
    if (addUI) {
        if (tab === 'friends') {
            addUI.classList.remove('hidden');
            addUI.style.display = 'flex';
        } else {
            addUI.classList.add('hidden');
            addUI.style.display = 'none';
        }
    }

    renderMultiplayerList();
};

const addFriendByCode = () => {
    const input = document.getElementById('input-friend-code');
    const code = input.value.trim();
    if (code.length !== 6 || isNaN(code)) {
        showToast("정확한 6자리 숫자를 입력해 주세요.", "error");
        return;
    }

    if (!db) {
        showToast("서버 연결이 필요합니다.", "error");
        return;
    }

    db.ref('friend_codes/' + code).once('value').then(snap => {
        const target = snap.val();
        if (!target) {
            showToast("존재하지 않는 코드입니다.", "error");
            return;
        }
        if (target.uid === STATE.currentUser.uid) {
            showToast("자신은 친구로 추가할 수 없습니다.", "error");
            return;
        }
        
        addFriend(target.uid, target.username);
        input.value = '';
    }).catch(e => {
        showToast("코드 확인 중 오류가 발생했습니다.", "error");
    });
};

const addFriend = (uid, name) => {
    if (!STATE.currentUser || STATE.currentUser.isGuest) {
        showToast("회원가입 계정만 친구 추가가 가능합니다.", "error");
        return;
    }
    if (uid === STATE.currentUser.uid) return;
    
    if (!STATE.currentUser.friends) STATE.currentUser.friends = {};
    if (STATE.currentUser.friends[uid]) {
        showToast("이미 친구인 플레이어입니다.", "info");
        return;
    }

    const friendData = { username: name, addedAt: Date.now() };
    STATE.currentUser.friends[uid] = friendData;
    saveData();
    if (FIREBASE_ENABLED && db) {
        db.ref('users/' + STATE.currentUser.uid + '/friends/' + uid).set(friendData);
    }
    showToast(`⭐ ${name}님을 친구 목록에 추가했습니다!`, "success");
    renderMultiplayerList();
};

const removeFriend = (uid) => {
    if (!STATE.currentUser || !STATE.currentUser.friends) return;
    const name = STATE.currentUser.friends[uid]?.username || "플레이어";
    delete STATE.currentUser.friends[uid];
    saveData();
    if (FIREBASE_ENABLED && db) {
        db.ref('users/' + STATE.currentUser.uid + '/friends/' + uid).remove();
    }
    showToast(`🗑️ ${name}님을 친구 목록에서 삭제했습니다.`, "info");
    renderMultiplayerList();
};

// --- MULTIPLAYER LOBBY LOGIC ---
const renderMultiplayerList = () => {
    const listEl = document.getElementById('multiplayer-player-list');
    const loadingEl = document.getElementById('multiplayer-loading');
    if (!listEl) return;

    if (!db || !FIREBASE_ENABLED) {
        loadingEl.textContent = '❌ 서버에 연결할 수 없습니다. (오프라인 모드)';
        loadingEl.style.display = 'block';
        listEl.innerHTML = '';
        return;
    }

    loadingEl.style.display = 'block';
    loadingEl.textContent = currentMultiTab === 'global' ? '플레이어 목록 불러오는 중...' : '친구 목록 불러오는 중...';
    listEl.innerHTML = '';

    // Fetch players (ingame), presence (global online), and friends
    Promise.all([
        db.ref('players').once('value'),
        db.ref('presence').once('value'),
        db.ref('users/' + (STATE.currentUser?.uid || 'none') + '/friends').once('value')
    ]).then(([playerSnap, presenceSnap, friendSnap]) => {
        const inGamePlayers = playerSnap.val() || {};
        const presence = presenceSnap.val() || {};
        const friends = friendSnap.val() || {};
        loadingEl.style.display = 'none';
        
        // Merge in-game and presence for a total online list
        const onlineUids = new Set([...Object.keys(inGamePlayers), ...Object.keys(presence)]);

        if (currentMultiTab === 'global') {
            if (onlineUids.size === 0) {
                listEl.innerHTML = '<div style="text-align:center; color:#aaa; margin: 30px 0;">현재 접속 중인 플레이어가 없습니다. 🏜️</div>';
                return;
            }

            onlineUids.forEach(uid => {
                const pGame = inGamePlayers[uid];
                const pPres = presence[uid];
                if (!pGame && !pPres) return; // safety

                const username = pGame?.username || pPres?.username || 'Unknown';
                const isSelf = STATE.currentUser && uid === STATE.currentUser.uid;
                const isFriend = friends[uid];
                
                const mapNames = { 'classic': '🌲 클래식', 'ocean': '🏝️ 바다', 'snow': '❄️ 설산' };
                const mapLabel = pGame ? (mapNames[pGame.mapId] || pGame.mapId) : '로비';

                const row = document.createElement('div');
                row.className = 'user-list-row';
                row.style.display = 'grid';
                row.style.gridTemplateColumns = '1.2fr 1fr auto';
                row.style.alignItems = 'center';
                row.style.padding = '12px';
                row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                
                row.innerHTML = `
                    <div style="font-weight: bold; color: #fff;">
                        ${username} 
                        ${isSelf ? '<span class="badge admin">나</span>' : ''}
                        ${isFriend ? '<span style="color:#ffd700; font-size:0.8rem; margin-left:5px;">⭐</span>' : ''}
                    </div>
                    <span style="font-size: 0.8rem; color: #00e5ff;">📍 ${mapLabel}</span>
                    <div style="display: flex; gap: 5px;">
                        ${(!isSelf && !isFriend) ? `<button class="btn secondary" style="padding: 6px; font-size: 0.75rem;" onclick="app.addFriend('${uid}', '${username}')">⭐ 친구추가</button>` : ''}
                        ${!isSelf ? `<button class="btn primary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="app.showScreen('map-selection-screen')">${pGame ? '참여하기' : '멀티플레이'}</button>` : ''}
                    </div>
                `;
                listEl.appendChild(row);
            });
        } else {
            // FRIENDS TAB
            const friendUids = Object.keys(friends);
            if (friendUids.length === 0) {
                listEl.innerHTML = '<div style="text-align:center; color:#aaa; margin: 30px 0;">아직 친구가 없습니다. <br>글로벌 탭에서 친구를 추가해보세요! 🤝</div>';
                return;
            }

            friendUids.forEach(uid => {
                const f = friends[uid];
                const pGame = inGamePlayers[uid];
                const isOnline = onlineUids.has(uid);
                
                const mapNames = { 'classic': '🌲 클래식', 'ocean': '🏝️ 바다', 'snow': '❄️ 설산' };
                const mapLabel = pGame ? (mapNames[pGame.mapId] || pGame.mapId) : (isOnline ? '로비' : '오프라인');

                const row = document.createElement('div');
                row.className = 'user-list-row';
                row.style.display = 'grid';
                row.style.gridTemplateColumns = '1.2fr 1fr auto';
                row.style.alignItems = 'center';
                row.style.padding = '12px';
                row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                row.style.opacity = isOnline ? '1' : '0.6';
                
                row.innerHTML = `
                    <span style="font-weight: bold; color: ${isOnline ? '#ffd700' : '#aaa'};">${f.username || 'Unknown'}</span>
                    <span style="font-size: 0.8rem; color: ${isOnline ? '#00e5ff' : '#666'};">${isOnline ? '📍 ' + mapLabel : '💤 오프라인'}</span>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn secondary" style="padding: 6px; font-size: 0.75rem; border-color: rgba(255,82,82,0.3); color: #ff5252;" onclick="app.removeFriend('${uid}')">삭제</button>
                        ${isOnline ? `<button class="btn primary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="app.showScreen('map-selection-screen')">${pGame ? '참여하기' : '멀티플레이'}</button>` : ''}
                    </div>
                `;
                listEl.appendChild(row);
            });
        }
    }).catch(err => {
        console.error("Multiplayer/Friend list error:", err);
        loadingEl.textContent = '⚠️ 목록을 불러오는 중 오류가 발생했습니다.';
    });
};

document.getElementById('btn-multiplayer').addEventListener('click', () => {
    showScreen('multiplayer-screen');
    ensureFriendCode();
    switchTab('global'); // default to global
});

const adminMenuBtn = document.getElementById('btn-admin');
if (adminMenuBtn) {
    adminMenuBtn.addEventListener('click', () => {
        renderAdminUserList();
        renderAdminApplicationList();
        showScreen('admin-screen');
    });
}
// --- CROSS-TAB SYNC ---
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
        syncDataFromStorage();
        // Auto-refresh UI if on specific screens
        const adminScreen = document.getElementById('admin-screen');
        if (adminScreen && !adminScreen.classList.contains('hidden')) {
            renderAdminUserList();
            renderAdminApplicationList();
        }
        const myPage = document.getElementById('mypage-screen');
        if (myPage && !myPage.classList.contains('hidden')) {
            renderMyPage();
        }

        updateUI();
    }
});

document.getElementById('btn-admin').addEventListener('click', () => {
    const role = STATE.currentUser.role;
    if (role === 'admin' || role === 'creator') {
        const isMaster = CREATOR_ACCOUNTS.includes(STATE.currentUser.username.toLowerCase());
        const msBtn = document.getElementById('btn-master-signup');
        if (msBtn) {
            if (isMaster) msBtn.classList.remove('hidden');
            else msBtn.classList.add('hidden');
        }

        syncAllUsers(true); 
        showScreen('admin-screen');
        actualRenderAdminUserList();
        renderAdminApplicationList();
        renderAdminLiveMonitoring(); // Start real-time monitoring
    }
});

let adminLiveListener = null;
function renderAdminLiveMonitoring() {
    const listEl = document.getElementById('admin-live-list');
    const countEl = document.getElementById('admin-online-count');
    if (!listEl || !db) return;

    if (adminLiveListener) {
        db.ref('presence').off('value', adminLiveListener);
    }

    adminLiveListener = db.ref('presence').on('value', (presenceSnap) => {
        db.ref('players').once('value').then(playerSnap => {
            const presence = presenceSnap.val() || {};
            const players = playerSnap.val() || {};
            const allOnlineUids = new Set([...Object.keys(presence), ...Object.keys(players)]);
            
            listEl.innerHTML = '';
            countEl.textContent = `${allOnlineUids.size}명`;

            if (allOnlineUids.size === 0) {
                listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">현재 실시간 접속자가 없습니다.</div>';
                return;
            }

            allOnlineUids.forEach(uid => {
                const pPres = presence[uid];
                const pGame = players[uid];
                const username = pPres?.username || pGame?.username || 'Unknown';
                const mapNames = { 'classic': '🌲 클래식', 'ocean': '🏝️ 바다', 'snow': '❄️ 설산' };
                const loc = pGame ? mapNames[pGame.mapId] || pGame.mapId : '🏠 로비/메뉴';
                const status = pGame ? '🎮 게임 중' : '💤 대기 중';
                const lastSeen = pPres?.lastSeen ? new Date(pPres.lastSeen).toLocaleTimeString() : '-';

                const row = document.createElement('div');
                row.className = 'user-list-row';
                row.style.cssText = 'display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);';
                row.innerHTML = `
                    <span style="font-weight:bold; color:#00e5ff;">${username}</span>
                    <span style="font-size:0.9rem; color:#fff;">${loc}</span>
                    <span style="font-size:0.85rem; color:${pGame ? '#00ff88' : '#ffd700'};">${status}</span>
                    <span style="font-size:0.8rem; color:#aaa;">${lastSeen}</span>
                `;
                listEl.appendChild(row);
            });
        });
    });
}

// --- APPLICATION LOGIC ---
document.getElementById('apply-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = document.getElementById('apply-reason').value.trim();

    if (STATE.applications.find(a => a.username === STATE.currentUser.username && a.status === 'pending')) {
        showToast('이미 심사 중인 지원서가 있습니다.', 'error');
        return;
    }

    STATE.applications.push({
        username: STATE.currentUser.username,
        reason: reason,
        status: 'pending',
        timestamp: new Date().toLocaleString()
    });

    saveData();
    showToast('지원서가 제출되었습니다!', 'success');
    document.getElementById('apply-reason').value = '';
    showScreen('menu-screen');
});

// --- SHOP LOGIC ---
const app = window.app = {
    showScreen,
    startWithMap: (mapId) => {
        console.log("startWithMap called with:", mapId);
        // alert("맵을 생성합니다: " + mapId);
        try {
            STATE.selectedMap = mapId;
            showScreen('loading-screen');
            const loadingBar = document.getElementById('loading-bar');
            const loadingText = document.getElementById('loading-text');
            let progress = 0;
            loadingBar.style.width = '0%';
            loadingText.textContent = '지형 정보 확인 중...';

            const interval = setInterval(() => {
                progress += Math.random() * 15 + 5;
                if (progress > 100) progress = 100;
                loadingBar.style.width = `${progress}%`;
                loadingText.textContent = progress < 40 ? `매핑 데이터 로드 중... (${Math.floor(progress)}%)` : 
                                         progress < 80 ? `환경 파라미터 최적화 중... (${Math.floor(progress)}%)` : 
                                         `월드 진입 준비 중... (${Math.floor(progress)}%)`;
                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        showScreen('game-screen');
                        setTimeout(() => {
                            try {
                                init3DGame();
                            } catch (e) {
                                console.error("Internal start error:", e);
                                showToast("게임 시작 오류: " + e.message, "error");
                                showScreen('menu-screen');
                            }
                        }, 100);
                    }, 400);
                }
            }, 120);
        } catch (err) {
            console.error("StartWithMap Error:", err);
            showToast("맵 선택 오류: " + err.message, "error");
        }
    },
    openTutorial: () => {
        const active = document.querySelector('.screen.active');
        STATE.lastActiveScreen = active ? active.id : 'menu-screen';
        showScreen('tutorial-screen');
        if (document.pointerLockElement) document.exitPointerLock();
    },
    closeTutorial: () => {
        showScreen(STATE.lastActiveScreen || 'menu-screen');
        // If returning to game, try to re-lock pointer
        if (STATE.lastActiveScreen === 'game-screen' && STATE.threeScene) {
            setTimeout(() => {
                if (STATE.threeScene && !document.pointerLockElement) {
                    STATE.threeScene.renderer.domElement.requestPointerLock();
                }
            }, 600); // Wait for screen transition
        }
    },
    openSettings: () => {
        playSound('click');
        const modal = document.getElementById('settings-modal');
        if (modal) {
            // Sync values before showing
            const set = STATE.settings;
            if (document.getElementById('select-graphics')) document.getElementById('select-graphics').value = set.graphics || 'medium';
            if (document.getElementById('range-fov')) {
                document.getElementById('range-fov').value = set.fov || 75;
                document.getElementById('val-fov').textContent = set.fov || 75;
            }
            if (document.getElementById('range-sens')) {
                document.getElementById('range-sens').value = set.sens || 1.0;
                document.getElementById('val-sens').textContent = (set.sens || 1.0).toFixed(1);
            }
            if (document.getElementById('range-dist')) {
                document.getElementById('range-dist').value = set.dist || 100;
                document.getElementById('val-dist').textContent = set.dist || 100;
            }
            if (document.getElementById('btn-toggle-sound')) {
                const soundBtn = document.getElementById('btn-toggle-sound');
                soundBtn.textContent = set.sound ? '소리 켜짐' : '소리 꺼짐';
                soundBtn.className = set.sound ? 'btn primary' : 'btn';
            }

            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('show'), 10);
            if (document.pointerLockElement) document.exitPointerLock();
        }
    },
    closeSettings: () => {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    },



    buyItem: (itemType, cost) => {
        let finalCost = cost;
        if (itemType === 'treasure') {
            const count = STATE.currentUser.treasures || 0;
            finalCost = 164 + (count * 20);
        }

        if (STATE.currentUser.coins >= finalCost) {
            STATE.currentUser.coins -= finalCost;
            if (itemType === 'treasure') {
                STATE.currentUser.treasures = (STATE.currentUser.treasures || 0) + 1;
                showToast(`보물 상자를 구매했습니다! (가격 상승: +20🪙)`, 'success');
            }
            updateUI();
            saveData();
        } else {
            showToast('코인이 부족합니다.', 'error');
        }
    },

    exchangeCoins: (amount) => {
        if (STATE.currentUser.coins >= amount) {
            STATE.currentUser.coins -= amount;
            STATE.currentUser.diamonds += (amount * 2);
            showToast(`코인 ${amount}개를 다이아몬드 ${amount * 2}개로 교환했습니다.`, 'success');
            updateUI();
            saveData();
        } else {
            showToast('교환할 코인이 부족합니다.', 'error');
        }
    },

    buyLuckyBox: (type, cost) => {
        if (STATE.currentUser.coins >= cost) {
            STATE.currentUser.coins -= cost;

            // Random reward logic
            let rewardType = Math.random() > 0.5 ? 'coins' : 'diamonds';
            let rewardAmount = 0;

            if (type === 'small') {
                rewardAmount = Math.floor(Math.random() * 300);
            } else if (type === 'medium') {
                rewardAmount = Math.floor(Math.random() * 3000);
            } else if (type === 'large') {
                rewardAmount = Math.floor(Math.random() * 50000);
                rewardType = 'diamonds'; // Large box always gives diamonds
            }

            STATE.currentUser[rewardType] += rewardAmount;

            let symbol = rewardType === 'coins' ? '🪙' : '💎';
            showToast(`행운 돈상자 열림! ${rewardAmount} ${symbol} 획득!`, 'success');
            updateUI();
            saveData();
        } else {
            showToast('코인이 부족합니다.', 'error');
        }
    },

    // --- ADMIN LOGIC ---
    deleteUser: (index) => {
        const role = STATE.currentUser.role;
        if (role !== 'admin' && role !== 'creator') return;

        const userToDel = STATE.users[index];
        const isMaster = CREATOR_ACCOUNTS.includes(STATE.currentUser.username);

        // Cannot delete self
        if (userToDel.username === STATE.currentUser.username) {
            showToast('자신의 계정은 삭제할 수 없습니다.', 'error');
            return;
        }

        // Only master (creator) can delete admin/creator accounts
        if ((userToDel.role === 'admin' || userToDel.role === 'creator') && !isMaster) {
            showToast('일반 관리자는 다른 관리자를 삭제할 수 없습니다.', 'error');
            return;
        }

        // Prevent deletion of protected accounts
        if (userToDel.username === 'test') {
            showToast('테스트 계정은 삭제할 수 없습니다.', 'error');
            return;
        }

        STATE.users.splice(index, 1);
        saveData();
        showToast('유저가 삭제되었습니다.', 'success');
        renderAdminUserList();
    },

    changeUserRole: (index, newRole) => {
        const role = STATE.currentUser.role;
        if (role !== 'admin' && role !== 'creator') return;

        const targetUser = STATE.users[index];
        const isMaster = CREATOR_ACCOUNTS.includes(STATE.currentUser.username);

        // Only creator (master) can assign admin/creator or demote them
        if ((newRole === 'admin' || newRole === 'creator' || targetUser.role === 'admin' || targetUser.role === 'creator') && !isMaster && targetUser.username !== STATE.currentUser.username) {
            showToast('관리자 등급 변경 권한이 없습니다.', 'error');
            renderAdminUserList(); // Reset select
            return;
        }

        targetUser.role = newRole;
        saveData();
        showToast(`${targetUser.username}님의 계급이 ${newRole.toUpperCase()}로 변경되었습니다.`, 'success');

        renderAdminUserList();
        updateUI(); // 만약 본인의 등급을 바꿨을 때 UI 갱신을 위해
    },

    exitGame: () => {
        if (STATE.threeScene) {
            // Clean up 3D scene completely
            if (STATE.threeScene.animationId) {
                cancelAnimationFrame(STATE.threeScene.animationId);
            }
            if (STATE.threeScene.weatherInterval) {
                clearInterval(STATE.threeScene.weatherInterval);
            }
            const canvas = STATE.threeScene.canvas;
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            STATE.threeScene = null;
        }
        showScreen('menu-screen');
    },

    approveApplication: (index) => {
        const app = STATE.applications[index];
        const user = STATE.users.find(u => u.username === app.username);
        if (user) {
            user.role = 'admin';
            app.status = 'approved';
            showToast(`${app.username}님이 관리자로 승인되었습니다.`, 'success');
            renderAdminApplicationList();
            renderAdminUserList();
            updateUI();
            saveData();
        }
    },

    rejectApplication: (index) => {
        STATE.applications[index].status = 'rejected';
        saveData();
        showToast('지원서가 거절되었습니다.', 'info');
        renderAdminApplicationList();
    },

    // --- PASSWORD CHANGE LOGIC ---
    openPwModal: (index) => {
        const user = STATE.users[index];
        const isMaster = CREATOR_ACCOUNTS.includes(STATE.currentUser.username);

        // Only master can change other admins' password
        if (user.role === 'admin' && !isMaster && user.username !== STATE.currentUser.username) {
            showToast('다른 관리자의 비밀번호를 바꿀 권한이 없습니다.', 'error');
            return;
        }

        document.getElementById('pw-modal-target-user').textContent = `유저: ${user.username}`;
        document.getElementById('new-pw-input').value = '';
        document.getElementById('pw-modal').classList.add('show');
        document.getElementById('pw-modal').classList.remove('hidden');

        // Setup confirm button
        const confirmBtn = document.getElementById('btn-confirm-pw');
        confirmBtn.onclick = () => {
            const newPw = document.getElementById('new-pw-input').value.trim();
            if (newPw) {
                user.password = newPw;
                saveData();
                showToast(`${user.username}님의 비밀번호가 변경되었습니다.`, 'success');
                app.closePwModal();
            } else {
                showToast('비밀번호를 입력해주세요.', 'error');
            }
        };
    },

    closePwModal: () => {
        document.getElementById('pw-modal').classList.remove('show');
        setTimeout(() => {
            if (!document.getElementById('pw-modal').classList.contains('show')) {
                document.getElementById('pw-modal').classList.add('hidden');
            }
        }, 300);
    },

    openTreasure: () => {
        const user = STATE.currentUser;
        if (!user) return;
        if (user.role !== 'admin' && (!user.treasures || user.treasures <= 0)) {
            showToast('보물 상자가 없습니다.', 'error');
            return;
        }

        if (user.role !== 'admin') {
            user.treasures -= 1;
        }

        // Random Rewards: 50% coins, 50% diamonds
        const isDiamonds = Math.random() > 0.5;
        const amount = isDiamonds ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 500) + 100;
        const rewardType = isDiamonds ? 'diamonds' : 'coins';
        const symbol = isDiamonds ? '💎' : '🪙';

        user[rewardType] += amount;

        showToast(`보물 상자를 열었습니다! ${amount} ${symbol} 획득!`, 'success');
        renderMyPage();
        updateUI();
        saveData();
    },

    setSkin: (skinName) => {
        if (!STATE.currentUser) return;
        STATE.currentUser.skin = skinName;
        saveData();
        showToast('캐릭터 스킨이 변경되었습니다.', 'success');
        renderMyPage();
    },

    openCraftModal: () => {
        const modal = document.getElementById('craft-modal');
        modal.classList.add('show');
        modal.classList.remove('hidden');
        if (document.pointerLockElement) document.exitPointerLock();

        // Check proximity to workbench in the 3D scene
        let isNearWorkbench = false;
        if (STATE.threeScene && STATE.threeScene.scene) {
            const playerPos = STATE.threeScene.playerGroup.position;
            const workbenches = STATE.threeScene.scene.userData.structures.filter(s => s.userData.isWorkbench);

            for (const wb of workbenches) {
                if (wb.position.distanceTo(playerPos) < 5) {
                    isNearWorkbench = true;
                    break;
                }
            }
        }

        // Visual feedback in modal for items requiring workbench
        const advancedItems = ['steel_axe', 'bow', 'campfire'];
        advancedItems.forEach(id => {
            const el = document.getElementById(`craft-${id}`);
            if (el) {
                const btn = el.querySelector('button');
                const warning = el.querySelector('p');
                if (isNearWorkbench || STATE.currentUser.role === 'admin') {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    if (warning) warning.style.color = '#4caf50';
                    if (warning) warning.textContent = '✅ 제작대 근처입니다';
                } else {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    if (warning) warning.style.color = '#ffeb3b';
                    if (warning) warning.textContent = '⚠️ 제작대 근처에서 가능';
                }
            }
        });

        STATE.isNearWorkbench = isNearWorkbench;
    },

    closeCraftModal: () => {
        const modal = document.getElementById('craft-modal');
        modal.classList.remove('show');
        setTimeout(() => {
            if (!modal.classList.contains('show')) {
                modal.classList.add('hidden');
            }
        }, 300);
    },

    craftItem: (itemType) => {
        const user = STATE.currentUser;
        const isAD = user.role === 'admin';

        if (itemType === 'workbench') {
            const cost = 5;
            if (user.wood >= cost || isAD) {
                if (!isAD) user.wood -= cost;
                user.workbench = (user.workbench || 0) + 1;
                app.updateQuestProgress('craft', 1);
                showToast('제작대를 성공적으로 제작했습니다!', 'success');
                updateUI();
                saveData();
                app.closeCraftModal();
            } else {
                showToast(`나무가 부족합니다! (${cost}개 필요)`, 'error');
            }
        } else if (itemType === 'steel_axe' || itemType === 'bow' || itemType === 'campfire') {
            if (!STATE.isNearWorkbench && !isAD) {
                showToast('제작대 근처로 가서 제작해 주세요!', 'error');
                return;
            }

            const costs = {
                steel_axe: { wood: 10, coins: 100 },
                bow: { wood: 15, coins: 150 },
                campfire: { wood: 5, iron: 2 }
            };
            const cost = costs[itemType];

            const hasWood = cost.wood ? (user.wood >= cost.wood) : true;
            const hasIron = cost.iron ? (user.iron >= cost.iron) : true;
            const hasCoins = cost.coins ? (user.coins >= cost.coins) : true;

            if ((hasWood && hasIron && hasCoins) || isAD) {
                if (!isAD) {
                    if (cost.wood) user.wood -= cost.wood;
                    if (cost.iron) user.iron -= cost.iron;
                    if (cost.coins) user.coins -= cost.coins;
                }
                user[itemType] = (user[itemType] || 0) + 1;
                app.updateQuestProgress('craft', 1);

                let itemName = itemType;
                if (itemType === 'steel_axe') itemName = '강철 도끼';
                if (itemType === 'bow') itemName = '활';
                if (itemType === 'campfire') itemName = '모닥불';

                showToast(`${itemName}을(를) 제작했습니다!`, 'success');
                updateUI();
                saveData();
                app.closeCraftModal();
            } else {
                showToast('자원이 부족합니다!', 'error');
            }
        }
    },

    mobileAction: (action) => {
        if (!STATE.threeScene) return;

        switch (action) {
            case 'attack':
                if (isBuildMode) {
                    // Trigger placement
                    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                } else {
                    // Trigger attack
                    const mouseEvent = new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    if (STATE.threeScene && STATE.threeScene.canvas) {
                        STATE.threeScene.canvas.dispatchEvent(mouseEvent);
                    }
                }
                break;
            case 'jump':
                if (STATE.threeScene.setMoveKey) {
                    STATE.threeScene.setMoveKey('Space', true);
                    setTimeout(() => STATE.threeScene.setMoveKey('Space', false), 100);
                }
                break;
            case 'build':
                // Manually toggle
                isBuildMode = !isBuildMode;
                const guide = document.getElementById('build-guide');
                const attackBtn = document.getElementById('mobile-attack-btn');
                if (isBuildMode) {
                    if (guide) guide.classList.remove('hidden');
                    if (attackBtn) attackBtn.textContent = 'PLACE';
                    showToast('건설 모드 활성화 (설치하려면 PLACE 클릭)', 'info');
                } else {
                    if (guide) guide.classList.add('hidden');
                    if (attackBtn) attackBtn.textContent = 'ATTACK';
                }
                break;
        }
    },

    toggleInventory: () => {
        if (!STATE.threeScene) return;
        const inv = document.querySelector('.inventory-hud');
        if (!inv) return;

        const isInvOpen = !inv.classList.contains('hidden');
        if (isInvOpen) {
            inv.classList.add('hidden');
            STATE.threeScene.renderer.domElement.requestPointerLock();
        } else {
            inv.classList.remove('hidden');
            if (document.pointerLockElement) document.exitPointerLock();
        }
    },

    updateQuestProgress: (type, amount = 1) => {
        const user = STATE.currentUser;
        if (!user) return;
        if (!user.quests) user.quests = {};

        defaultQuests.forEach((q, idx) => {
            if (q.type === type) {
                user.quests[idx] = (user.quests[idx] || 0) + amount;
            }
        });
    },

    addXP: (amount) => {
        const user = STATE.currentUser;
        if (!user || user.role === 'admin' || user.role === 'creator') return;

        user.xp = (user.xp || 0) + amount;
        user.level = user.level || 1;

        let xpNeeded = user.level * 100;
        let leveledUp = false;

        while (user.xp >= xpNeeded) {
            user.xp -= xpNeeded;
            user.level++;
            xpNeeded = user.level * 100;
            leveledUp = true;
        }

        if (leveledUp) {
            app.updateQuestProgress('level', user.level);
            showToast(`🎉 레벨 업! Lv.${user.level}이 되었습니다!`, 'success');
        }
    },

    claimQuestReward: (idx) => {
        const user = STATE.currentUser;
        if (!user.quests) return;
        const q = defaultQuests[idx];
        const progress = user.quests[idx] || 0;

        if (progress >= q.target && !user.questClaimed[idx]) {
            user.questClaimed[idx] = true;
            user.coins += q.reward;
            app.addXP(q.reward);
            showToast(`퀘스트 보상 획득! (+${q.reward}🪙, +${q.reward}XP)`, 'success');
            renderQuests();
            updateUI();
            saveData();
        }
    },
    switchTab,
    addFriend,
    addFriendByCode,
    removeFriend,
    addVoteOptionField,
    applyVoteTemplate,
    sendGlobalNotification: () => {
        const type = document.getElementById('admin-notif-type').value;
        const msg = document.getElementById('admin-notif-msg').value.trim();
        if (!msg) return showToast("메시지를 입력하세요.", "error");
        if (!db) return;

        db.ref('global_notifications').push({
            type: type,
            message: msg,
            sender: STATE.currentUser.username,
            timestamp: Date.now()
        }).then(() => {
            showToast("서버 알림을 발송했습니다!", "success");
            document.getElementById('admin-notif-msg').value = '';
        });
    }
};

const defaultQuests = [
    { id: 'gather_wood', title: '나무꾼', desc: '나무 10개를 채집하세요', type: 'wood', target: 10, reward: 50, icon: '🌲' },
    { id: 'gather_stone', title: '석공', desc: '돌 10개를 채집하세요', type: 'stone', target: 10, reward: 50, icon: '🪨' },
    { id: 'kill_monster', title: '어둠의 사냥꾼', desc: '괴물을 3마리 처치하세요', type: 'kill', target: 3, reward: 200, icon: '⚔️' },
    { id: 'hunt_animal', title: '생존 사냥꾼', desc: '동물을 5마리 사냥하세요', type: 'hunt', target: 5, reward: 150, icon: '🍖' },
    { id: 'collect_coins', title: '코인 수집가', desc: '코인 300개를 수집하세요', type: 'coins', target: 300, reward: 100, icon: '🪙' },
    { id: 'diamond_miner', title: '보석 광부', desc: '다이아몬드 5개를 찾으세요', type: 'diamonds', target: 5, reward: 500, icon: '💎' },
    { id: 'craft_expert', title: '제작의 달인', desc: '아이템을 3번 제작하세요', type: 'craft', target: 3, reward: 100, icon: '🛠️' },
    { id: 'builder_king', title: '건축왕', desc: '구조물을 5개 설치하세요', type: 'build', target: 5, reward: 150, icon: '🏰' },
    { id: 'gourmet', title: '미식가', desc: '음식을 10번 섭취하세요', type: 'eat', target: 10, reward: 80, icon: '🍎' },
    { id: 'hydro_pro', title: '수분 보충', desc: '물을 5번 섭취하세요', type: 'drink', target: 5, reward: 80, icon: '💧' },
    { id: 'level_master', title: '성장 전문가', desc: '레벨 5에 도달하세요', type: 'level', target: 5, reward: 1000, icon: '🌟' }
];

const renderQuests = () => {
    const listEl = document.getElementById('quest-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const user = STATE.currentUser;
    if (!user.quests) user.quests = {};
    if (!user.questClaimed) user.questClaimed = {};

    defaultQuests.forEach((q, idx) => {
        const progress = Math.min(user.quests[idx] || 0, q.target);
        const percent = (progress / q.target) * 100;
        const isComplete = progress >= q.target;
        const isClaimed = user.questClaimed[idx];

        let btnClass = 'btn-claim';
        let btnText = '진행 중';
        if (isClaimed) {
            btnClass += ' completed';
            btnText = '완료됨';
        } else if (isComplete) {
            btnClass += ' ready';
            btnText = '보상 받기';
        }

        const el = document.createElement('div');
        el.className = 'quest-item';
        el.innerHTML = `
            <div class="quest-icon">${q.icon}</div>
            <div class="quest-details">
                <h3>${q.title}</h3>
                <p>${q.desc}</p>
                <div class="quest-progress-wrap">
                    <div class="quest-progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="quest-progress-text">${progress} / ${q.target}</div>
            </div>
            <div class="quest-actions">
                <div class="quest-reward">${q.reward} 🪙</div>
                <button class="${btnClass}" onclick="app.claimQuestReward(${idx})">${btnText}</button>
            </div>
        `;
        listEl.appendChild(el);
    });
};

const renderMyPage = () => {
    const user = STATE.currentUser;
    if (!user) return;

    const isAD = user.role === 'admin' || user.role === 'creator';
    document.getElementById('my-username').textContent = user.username;

    const roleBadge = document.getElementById('my-role-badge');
    roleBadge.textContent = user.role.toUpperCase();
    roleBadge.className = `badge ${user.role}`;

    const myLevel = document.getElementById('my-level-badge');
    const myXpBar = document.getElementById('my-xp-bar');
    const myXpText = document.getElementById('my-xp-text');
    if (myLevel) {
        user.level = user.level || 1;
        user.xp = user.xp || 0;
        const isADmin = user.role === 'admin' || user.role === 'creator';
        myLevel.textContent = isADmin ? 'MAX' : `Lv.${user.level}`;
        const xpNeeded = user.level * 100;
        const pct = isADmin ? 100 : Math.min(100, (user.xp / xpNeeded) * 100);
        if (myXpBar) myXpBar.style.width = `${pct}%`;
        if (myXpText) myXpText.textContent = isADmin ? 'MAX / MAX XP' : `${user.xp} / ${xpNeeded} XP`;
    }

    document.getElementById('my-phone').textContent = user.phone || '등록되지 않음';
    document.getElementById('my-coins').textContent = isAD ? '무제한' : user.coins.toLocaleString();
    document.getElementById('my-diamonds').textContent = isAD ? '무제한' : user.diamonds.toLocaleString();
    document.getElementById('my-wood').textContent = isAD ? '무제한' : (user.wood || 0).toLocaleString();
    document.getElementById('my-health').textContent = isAD ? 'MAX' : `${Math.ceil(user.health || 100)}%`;

    // Treasure display
    const treasureCount = user.treasures || 0;
    document.getElementById('my-treasures').textContent = isAD ? '무제한' : treasureCount.toLocaleString();

    const openBtn = document.getElementById('btn-open-treasure');
    if (treasureCount > 0 || isAD) {
        openBtn.classList.remove('hidden');
    } else {
        openBtn.classList.add('hidden');
    }

    // Update Skin selection highlight
    const currentSkin = user.skin || 'green';
    const skinBtns = document.querySelectorAll('.skin-btn');
    skinBtns.forEach(btn => {
        if (btn.dataset.skin === currentSkin) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
};

const renderAdminApplicationList = () => {
    const listEl = document.getElementById('admin-apply-list');
    listEl.innerHTML = '';

    STATE.applications.forEach((appItem, index) => {
        const row = document.createElement('div');
        row.className = 'application-list-row';

        row.innerHTML = `
            <span>${appItem.username}</span>
            <span class="reason-text" title="${appItem.reason}">${appItem.reason}</span>
            <span><span class="badge ${appItem.status}">${appItem.status}</span></span>
            <span>
                ${appItem.status === 'pending' ? `
                    <button class="btn primary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="app.approveApplication(${index})">승인</button>
                    <button class="btn secondary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="app.rejectApplication(${index})">거절</button>
                ` : '-'}
            </span>
        `;
        listEl.appendChild(row);
    });
};

const renderAdminUserList = () => {
    // If Firebase is enabled and we are admin, try to sync latest users first
    if (FIREBASE_ENABLED && db && STATE.currentUser && (STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator')) {
        syncAllUsers();
    }
    actualRenderAdminUserList();
};

const actualRenderAdminUserList = () => {
    const listEl = document.getElementById('admin-user-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const isMaster = CREATOR_ACCOUNTS.includes(STATE.currentUser.username);

    STATE.users.forEach((user, index) => {
        const row = document.createElement('div');
        row.className = 'user-list-row';

        const isTargetMaster = CREATOR_ACCOUNTS.includes(user.username);
        const isSelf = user.username === STATE.currentUser.username;

        // Feature: Admin ree1203fdsa can see passwords
        const passwordDisplay = isMaster ? `<br><small style="color:var(--text-muted)">PW: ${user.password}</small>` : '';

        row.innerHTML = `
            <span>${user.username} ${isTargetMaster ? '<span class="badge admin" style="font-size: 0.6rem; padding: 0.1rem 0.3rem;">마스터</span>' : ''}${passwordDisplay}</span>
            <span>${user.phone || '-'}</span>
            <span>${user.coins.toLocaleString()}</span>
            <span>${user.diamonds.toLocaleString()}</span>
            <span>
                <select class="role-select" 
                    onchange="app.changeUserRole(${index}, this.value)" 
                    ${(isTargetMaster || (!isMaster && user.role === 'admin')) ? 'disabled' : ''}>
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>유저</option>
                    <option value="vip" ${user.role === 'vip' ? 'selected' : ''}>VIP</option>
                    <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>매니저</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>관리자</option>
                    <option value="creator" ${user.role === 'creator' ? 'selected' : ''}>크리에이터</option>
                </select>
            </span>
            <span style="display: flex; gap: 0.5rem; justify-content: flex-start;">
                ${isSelf ?
                '<span class="badge admin">본인</span>' :
                `
                    <button class="btn primary" 
                        style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background: var(--secondary-color); color: var(--bg-dark); box-shadow: none; ${(!isMaster && user.role === 'admin') ? 'opacity: 0.5; cursor: not-allowed;' : ''}" 
                        onclick="app.openPwModal(${index})">PW 변경</button>
                    <button class="btn secondary" 
                        style="padding: 0.3rem 0.6rem; font-size: 0.75rem; ${(!isMaster && user.role === 'admin') ? 'opacity: 0.5; cursor: not-allowed;' : ''}" 
                        onclick="app.deleteUser(${index})">삭제</button>
                    `
            }
            </span>
        `;
        listEl.appendChild(row);
    });
};

// --- 3D GAME LOGIC (THREE.JS) ---
function init3DGame() {
    try {
        const mapType = STATE.selectedMap || 'classic';
        console.log("Initializing 3D Game with map:", mapType);
        const container = document.getElementById('game-screen');
        if (!container) throw new Error("Game container not found");

    const scene = new THREE.Scene();

    // --- WEATHER SYSTEM ---
    const weathers = {
        clear: { bg: 0x87CEEB, fog: 0x87CEEB, fogDensity: 0.01, particles: null },
        rain: { bg: 0x444455, fog: 0x444455, fogDensity: 0.05, particles: 'rain' },
        snow: { bg: 0xdddddd, fog: 0xdddddd, fogDensity: 0.04, particles: 'snow' },
        foggy: { bg: 0x888888, fog: 0x888888, fogDensity: 0.1, particles: null }
    };
    let currentWeather = mapType === 'snow' ? 'snow' : 'clear';
    
    // --- PARTICLE SETUP ---
    const particleCount = 2000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) positions[i] = (Math.random() - 0.5) * 100;
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({ color: 0xaaaaaf, size: 0.1, transparent: true, opacity: 0.6 });
    const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
    const particles = new THREE.Points(particleGeometry, rainMat);
    particles.visible = (currentWeather !== 'clear');
    if (currentWeather === 'snow') particles.material = snowMat;
    scene.add(particles);

    function setWeather(type) {
        currentWeather = type;
        const w = weathers[type];
        scene.background.setHex(w.bg);
        if (scene.fog) {
            scene.fog.color.setHex(w.fog);
            scene.fog.near = 1;
            scene.fog.far = 100 / (w.fogDensity * 15);
        }
        particles.visible = !!w.particles;
        particles.material = w.particles === 'snow' ? snowMat : rainMat;
    }

    const startWeather = weathers[currentWeather];
    scene.background = new THREE.Color(startWeather.bg);
    scene.fog = new THREE.Fog(startWeather.fog, 1, STATE.settings.dist || 100);

    const weatherInterval = setInterval(() => {
        const types = Object.keys(weathers);
        const next = types[Math.floor(Math.random() * types.length)];
        setWeather(next);
    }, 30000); // Change every 30 seconds for variety

    // --- SWEAT SYSTEM ---
    const sweatCount = 15;
    const sweatGeometry = new THREE.BufferGeometry();
    const sweatPos = new Float32Array(sweatCount * 3);
    for (let i = 0; i < sweatCount * 3; i++) sweatPos[i] = 0;
    sweatGeometry.setAttribute('position', new THREE.BufferAttribute(sweatPos, 3));
    const sweatMat = new THREE.PointsMaterial({ color: 0x00e5ff, size: 0.05, transparent: true, opacity: 0.8 });
    const sweatParticles = new THREE.Points(sweatGeometry, sweatMat);
    sweatParticles.visible = false;
    scene.add(sweatParticles);


    const camera = new THREE.PerspectiveCamera(STATE.settings.fov || 75, window.innerWidth / window.innerHeight, 0.1, (STATE.settings.dist || 100) * 2);

    // Color mapping based on skin
    const skinColors = {
        green: 0x00ff88,
        blue: 0x00e5ff,
        red: 0xff3366,
        yellow: 0xffd700
    };
    const playerColor = skinColors[STATE.currentUser.skin || 'green'];

    // Player Representation
    const playerGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 16);
    const bodyMat = new THREE.MeshPhongMaterial({ color: playerColor, emissive: playerColor, emissiveIntensity: 0.2 });
    const playerBody = new THREE.Mesh(bodyGeo, bodyMat);
    playerBody.position.y = 0.8;
    playerBody.castShadow = true;
    playerGroup.add(playerBody);

    // Arms and Tool
    const armGroup = new THREE.Group();
    armGroup.position.set(0, 1.2, 0); // Shoulder height
    playerGroup.add(armGroup);

    const armMat = new THREE.MeshPhongMaterial({ color: playerColor });
    const armGeo = new THREE.BoxGeometry(0.1, 0.1, 0.5);

    // Left Arm
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.4, 0, -0.2);
    armGroup.add(leftArm);

    // Right Arm (Holding the Tool)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.4, 0, -0.2);
    armGroup.add(rightArmGroup);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.z = 0.2; // Move pivot
    rightArmGroup.add(rightArm);

    // Simple Axe/Tool
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6);
    const handleMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = 0.5;
    rightArmGroup.add(handle);

    const headGeo = new THREE.BoxGeometry(0.1, 0.2, 0.2);
    const headMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0, 0.75);
    rightArmGroup.add(head);

    scene.add(playerGroup);
    
    // --- MULTIPLAYER SETUP ---
    const ghostPlayers = new Map();
    const createGhostPlayer = (id, data) => {
        const group = new THREE.Group();
        const gBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 })
        );
        gBody.position.y = 0.8;
        group.add(gBody);

        // Name tag
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,256,64);
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(data.username || 'Player', 128, 45);
        
        const tex = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
        sprite.position.y = 2.0;
        sprite.scale.set(2, 0.5, 1);
        group.add(sprite);

        scene.add(group);
        return group;
    };

    let multiplayerListener = null;
    if (FIREBASE_ENABLED && db && STATE.currentUser && !STATE.currentUser.isGuest) {
        const playerRef = db.ref('players/' + STATE.currentUser.uid);
        // Remove on disconnect
        playerRef.onDisconnect().remove();

        multiplayerListener = db.ref('players').on('value', (snapshot) => {
            const allPlayers = snapshot.val() || {};
            
            // Remove players who left
            for (const [id, ghost] of ghostPlayers) {
                if (!allPlayers[id]) {
                    scene.remove(ghost);
                    ghostPlayers.delete(id);
                }
            }

            // Update/Add players
            Object.keys(allPlayers).forEach(id => {
                if (id === STATE.currentUser.uid) return;
                const data = allPlayers[id];
                let ghost = ghostPlayers.get(id);
                if (!ghost) {
                    ghost = createGhostPlayer(id, data);
                    ghostPlayers.set(id, ghost);
                }
                // Update position (soft interpolation can be added later)
                ghost.position.set(data.x || 0, data.y || 0, data.z || 0);
                ghost.rotation.y = data.ry || 0;
            });
        });
    }

    let lastSyncTime = 0;
    const syncMyPosition = () => {
        if (!FIREBASE_ENABLED || !db || !STATE.currentUser || STATE.currentUser.isGuest) return;
        const now = Date.now();
        if (now - lastSyncTime < 100) return; // 10 FPS sync
        lastSyncTime = now;

        db.ref('players/' + STATE.currentUser.uid).set({
            username: STATE.currentUser.username,
            x: playerGroup.position.x,
            y: playerGroup.position.y,
            z: playerGroup.position.z,
            ry: playerGroup.rotation.y,
            mapId: mapType,
            time: now
        }).catch(e => console.warn("Multiplayer sync error:", e));
    };

    let isThirdPerson = false;
    let isSwinging = false;
    let swingProgress = 0;
    let cameraPitch = 0;
    const mouseSense = 0.002 * (STATE.settings.sens || 1.0);
    const reachRange = 5.0; // 상호작용 사정거리 (Reach Distance)

    const swingTool = () => {
        if (!isSwinging) {
            isSwinging = true;
            swingProgress = 0;
        }
    };

    const renderer = new THREE.WebGLRenderer({ antialias: STATE.settings.graphics !== 'low' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = STATE.settings.graphics !== 'low';
    if (STATE.settings.graphics === 'high') {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.insertBefore(renderer.domElement, document.getElementById('game-ui'));

    // Pointer Lock for Mouse Control
    // Higher-level click listener to make it easier to lock mouse
    container.addEventListener('click', (e) => {
        // Don't lock if clicking on UI buttons/modals
        if (e.target.closest('.glass-btn') || e.target.closest('.btn') || e.target.closest('.modal-content')) return;

        if (document.getElementById('game-screen').classList.contains('hidden')) return;
        renderer.domElement.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === renderer.domElement) {
            const currentSens = 0.002 * (STATE.settings.sens || 1.0);
            playerGroup.rotation.y -= (e.movementX || 0) * currentSens;
            cameraPitch -= (e.movementY || 0) * currentSens;
            cameraPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, cameraPitch));
        }
    });

    // Pointer Lock Change Listener for visual feedback
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement === renderer.domElement;
        const hint = document.getElementById('mouse-hint');
        if (hint) {
            if (isLocked) hint.style.display = 'none';
            else if (!document.getElementById('game-screen').classList.contains('hidden')) {
                hint.style.display = 'block';
            }
        }
    });

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(20, 20, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Flat Ground -> Island
    // --- BIOME DEFINITIONS ---
    const BIOME = {
        SNOW: { color: 0xffffff, treeColor: 0xeeeeee, name: 'Snowy Plains' },
        OAK: { color: 0x228B22, treeColor: 0x006400, name: 'Oak Forest' },
        MOUNTAIN: { color: 0x8B4513, treeColor: 0x2d4c2d, name: 'Highlands' }
    };

    const mapTypeLocal = mapType; // just in case local scope is needed for some logic, but usually mapType is enough

    function getBiomeAt(x, z) {
        if (mapType === 'snow') return BIOME.SNOW;
        if (mapType === 'ocean') {
             const d = Math.sqrt(x*x + z*z);
             if (d < 15) return BIOME.OAK; // Center island
             return { color: 0x1976d2, name: 'Ocean' };
        }
        if (x < -30) return BIOME.SNOW;
        if (x > 30) return BIOME.MOUNTAIN;
        return BIOME.OAK;
    }

    // Flat Ground -> Multi-Biome Terrain
    const terrainSize = 300;
    const segments = 64;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((segments + 1) * (segments + 1) * 3), 3));

    const posAttr = groundGeo.attributes.position;
    const colorAttr = groundGeo.attributes.color;
    const tempColor = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const dist = Math.sqrt(vx * vx + vy * vy);
        let h = 0;

        if (mapType === 'ocean') {
            if (dist < 15) h = Math.sin(vx*0.5)*0.5 + 0.5;
            else h = -3 - (dist-15)*0.2;
        } else if (mapType === 'snow') {
            h = Math.sin(vx*0.1)*Math.cos(vy*0.1)*3 + Math.random()*0.5;
        } else {
            if (vx > 30 && dist <= 80) {
                h = Math.sin(vx * 0.2) * Math.cos(vy * 0.2) * 5 + 3;
                h += Math.sin(vx * 0.5) * 1.5;
            }
            if (dist > 80) h -= Math.min(5, (dist - 80) * 0.4);
        }
        posAttr.setZ(i, h);

        const biome = getBiomeAt(vx, vy);
        tempColor.set(biome.color);
        if (biome === BIOME.SNOW) tempColor.offsetHSL(0.01, 0, (Math.random()-0.5)*0.05);
        else if (biome === BIOME.OAK) tempColor.offsetHSL((Math.random()-0.5)*0.1, 0, (Math.random()-0.5)*0.1);
        else if (mapType === 'ocean' && dist >= 15) tempColor.set(0x1a237e);
        
        colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }
    groundGeo.computeVertexNormals();

    function getHeightAt(x, z) {
        const dist = Math.sqrt(x * x + z * z);
        if (mapType === 'ocean') {
            if (dist < 15) return Math.sin(x*0.5)*0.5 + 0.5;
            return -3 - (dist-15)*0.2;
        }
        if (mapType === 'snow') return Math.sin(x*0.1)*Math.cos(z*0.1)*3;
        
        let h = 0;
        if (x > 30 && dist <= 80) {
            h = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 5 + 3;
            h += Math.sin(x * 0.5) * 1.5;
        }
        if (dist > 80) h -= Math.min(5, (dist - 80) * 0.4);
        return h;
    }

    const groundMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 10 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.isGround = true;
    scene.add(ground);

    // Ocean Plane
    const oceanGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);
    const oceanMat = new THREE.MeshPhongMaterial({ color: 0x1ca3ec, transparent: true, opacity: 0.7 });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1.5;
    ocean.receiveShadow = true;
    scene.add(ocean);

    // Sea Creatures
    scene.userData.seaCreatures = [];
    const fishGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
    fishGeo.rotateX(Math.PI / 2);
    const fishMat = new THREE.MeshPhongMaterial({ color: 0xffa500 });

    const sharkGeo = new THREE.ConeGeometry(0.6, 2.5, 8);
    sharkGeo.rotateX(Math.PI / 2);
    const sharkMat = new THREE.MeshPhongMaterial({ color: 0x444455 });

    function spawnSeaCreature(type, x, z) {
        const isShark = type === 'shark';
        const mesh = new THREE.Mesh(isShark ? sharkGeo : fishGeo, isShark ? sharkMat : fishMat);
        mesh.position.set(x, -2, z);
        mesh.userData = {
            isShark,
            health: isShark ? 200 : 20,
            angle: Math.random() * Math.PI * 2,
            speed: isShark ? 0.08 : 0.04
        };
        scene.add(mesh);
        scene.userData.seaCreatures.push(mesh);
    }

    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad = 85 + Math.random() * 40;
        spawnSeaCreature(i < 8 ? 'shark' : 'fish', Math.cos(angle) * rad, Math.sin(angle) * rad);
    }

    // --- GAME SYSTEMS DATA ---
    scene.userData.mineables = [];
    scene.userData.collectibles = [];
    scene.userData.monsters = [];
    scene.userData.animals = [];
    scene.userData.structures = [];
    scene.userData.digMarks = [];
    let dayTime = 12; // Start at noon
    let isBuildMode = false;

    const monsterGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const monsterMat = new THREE.MeshPhongMaterial({ color: 0x330000, emissive: 0xaa0000, emissiveIntensity: 0.1 });

    function spawnMonster(x, z) {
        const monster = new THREE.Mesh(monsterGeo, monsterMat);
        monster.position.set(x, 0.9, z);
        monster.userData = { health: 100, isMonster: true };
        scene.add(monster);
        scene.userData.monsters.push(monster);
    }

    // --- ANIMAL SYSTEM ---
    const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    const pigMat = new THREE.MeshPhongMaterial({ color: 0xffadc6 });
    const cowMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const sheepMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const woolMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee });

    function createAnimal(type) {
        const group = new THREE.Group();
        let body, head, snout, ears, horns, wool;

        if (type === 'pig') {
            body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.9), pigMat);
            head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pigMat);
            head.position.set(0, 0.2, 0.5);
            snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.1), new THREE.MeshPhongMaterial({ color: 0xff8da1 }));
            snout.position.set(0, 0.15, 0.7);
            group.add(body, head, snout);
        } else if (type === 'cow') {
            body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.2), cowMat);
            // Black spots
            for (let i = 0; i < 5; i++) {
                const spot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.01), new THREE.MeshPhongMaterial({ color: 0x222222 }));
                spot.position.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 1.2);
                if (Math.abs(spot.position.x) > 0.35) spot.rotation.y = Math.PI / 2;
                group.add(spot);
            }
            head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), cowMat);
            head.position.set(0, 0.3, 0.7);
            const hornGeo = new THREE.ConeGeometry(0.05, 0.2, 4);
            const hornL = new THREE.Mesh(hornGeo, new THREE.MeshPhongMaterial({ color: 0xcccccc }));
            hornL.position.set(-0.2, 0.7, 0.7);
            const hornR = hornL.clone();
            hornR.position.x = 0.2;
            group.add(body, head, hornL, hornR);
        } else if (type === 'sheep') {
            body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.0), woolMat);
            wool = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), woolMat);
            wool.scale.set(1, 0.8, 1.3);
            head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshPhongMaterial({ color: 0xddccbb }));
            head.position.set(0, 0.2, 0.6);
            group.add(body, wool, head);
        }

        // Add 4 legs
        for (let i = 0; i < 4; i++) {
            const leg = new THREE.Mesh(legGeo, type === 'pig' ? pigMat : (type === 'cow' ? cowMat : new THREE.MeshPhongMaterial({ color: 0xddccbb })));
            const x = (i < 2 ? 1 : -1) * (type === 'cow' ? 0.3 : 0.2);
            const z = (i % 2 === 0 ? 1 : -1) * (type === 'cow' ? 0.4 : 0.3);
            leg.position.set(x, -0.4, z);
            group.add(leg);
        }

        group.castShadow = true;
        group.traverse(child => { if (child.isMesh) child.castShadow = true; child.receiveShadow = true; });
        return group;
    }

    function spawnAnimal(type, x, z) {
        const animal = createAnimal(type);
        const h = getHeightAt(x, z);
        animal.position.set(x, h + 0.6, z);
        animal.userData = {
            type,
            health: 50,
            isAnimal: true,
            targetAngle: Math.random() * Math.PI * 2,
            wait: 0,
            speed: 0.02
        };
        scene.add(animal);
        scene.userData.animals.push(animal);
    }

    const wallGeo = new THREE.BoxGeometry(2, 2.5, 0.4);
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
    function placeWall(pos, rot) {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.copy(pos);
        wall.position.y += 1.25;
        wall.rotation.copy(rot);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        scene.userData.structures.push(wall);
        app.updateQuestProgress('build', 1);
        showToast('벽을 건설했습니다! (🪵 -5)', 'success');
    }

    const workbenchGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
    const workbenchMat = new THREE.MeshPhongMaterial({ color: 0x8d6e63 });
    function placeWorkbench(pos, rot) {
        const wb = new THREE.Mesh(workbenchGeo, workbenchMat);
        wb.position.copy(pos);
        wb.position.y += 0.4;
        wb.rotation.copy(rot);
        wb.castShadow = true;
        wb.receiveShadow = true;
        wb.userData = { isWorkbench: true };
        scene.add(wb);
        scene.userData.structures.push(wb);
        app.updateQuestProgress('build', 1);
        showToast('제작대를 배치했습니다!', 'success');
    }

    const campfireGeo = new THREE.ConeGeometry(0.6, 0.8, 6);
    const campfireMat = new THREE.MeshPhongMaterial({ color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 1.0 });
    const logGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8);
    const logMat = new THREE.MeshPhongMaterial({ color: 0x5d4037 });

    function placeCampfire(pos, rot) {
        const cfGroup = new THREE.Group();
        cfGroup.position.copy(pos);
        cfGroup.position.y += 0.4;
        cfGroup.rotation.copy(rot);

        // Logs at base
        for (let i = 0; i < 4; i++) {
            const log = new THREE.Mesh(logGeo, logMat);
            log.rotation.z = Math.PI / 2;
            log.rotation.x = (i * Math.PI) / 2;
            log.position.y = -0.3;
            cfGroup.add(log);
        }

        const fire = new THREE.Mesh(campfireGeo, campfireMat);
        cfGroup.add(fire);
        
        // Add light
        const fireLight = new THREE.PointLight(0xffaa00, 2.5, 18);
        fireLight.position.set(0, 0.8, 0);
        fireLight.castShadow = true;
        cfGroup.add(fireLight);
        
        // Flicker effect (added to userData.update for animate loop)
        cfGroup.userData = { 
            isCampfire: true,
            light: fireLight,
            baseIntensity: 2.5,
            update: () => {
                fireLight.intensity = cfGroup.userData.baseIntensity + (Math.random() - 0.5) * 0.8;
                fire.scale.set(1 + (Math.random() - 0.5) * 0.1, 1 + (Math.random() - 0.5) * 0.2, 1 + (Math.random() - 0.5) * 0.1);
            }
        };
        
        scene.add(cfGroup);
        scene.userData.structures.push(cfGroup);
        app.updateQuestProgress('build', 1);
        showToast('모닥불을 배치했습니다! (온도 상승 🔥)', 'success');
    }

    // --- TREE SPAWNING (BIOME SENSITIVE) ---
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2);
    const coneGeo = new THREE.ConeGeometry(1, 4, 8);
    const sphereGeo = new THREE.SphereGeometry(1.2, 8, 8);

    function spawnTree(x, z) {
        if (Math.abs(x) < 5 && Math.abs(z) < 5) return;

        const biome = getBiomeAt(x, z);
        const treeGroup = new THREE.Group();
        const treeH = getHeightAt(x, z);
        treeGroup.position.set(x, treeH, z);

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(0, 1, 0);
        trunk.castShadow = true;
        treeGroup.add(trunk);

        let leaves;
        if (biome === BIOME.SNOW) {
            leaves = new THREE.Mesh(coneGeo, new THREE.MeshPhongMaterial({ color: 0xffffff }));
            leaves.position.set(0, 3, 0);
            treeGroup.userData = { isWood: true, hits: 5 };
        } else if (biome === BIOME.OAK) {
            leaves = new THREE.Mesh(sphereGeo, new THREE.MeshPhongMaterial({ color: 0x006400 }));
            leaves.position.set(0, 2.5, 0);
            leaves.scale.set(1.5, 1.2, 1.5);
            treeGroup.userData = { isWood: true, hits: 4 };
        } else {
            leaves = new THREE.Mesh(coneGeo, new THREE.MeshPhongMaterial({ color: 0x223322 }));
            leaves.position.set(0, 4, 0);
            leaves.scale.set(0.8, 1.8, 0.8);
            treeGroup.userData = { isWood: true, hits: 6 };
        }

        leaves.castShadow = true;
        treeGroup.add(leaves);

        scene.add(treeGroup);
        scene.userData.mineables.push(trunk, leaves);
    }

    for (let i = 0; i < 120; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        spawnTree(x, z);
    }

    // Spawn Initial Animals
    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        const b = getBiomeAt(x, z);
        let type = 'pig';
        if (b === BIOME.SNOW) type = 'sheep';
        else if (b === BIOME.MOUNTAIN) type = 'cow';
        else type = Math.random() > 0.5 ? 'pig' : 'sheep';
        spawnAnimal(type, x, z);
    }

    // Dig mark assets
    const digMarkGeo = new THREE.CircleGeometry(0.5, 8);
    const digMarkMat = new THREE.MeshPhongMaterial({ color: 0x3d2b1f, side: THREE.DoubleSide });

    function createDigMark(point) {
        const mark = new THREE.Mesh(digMarkGeo, digMarkMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.copy(point);
        mark.position.y += 0.01; // Tiny lift to prevent z-fighting
        mark.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1);
        scene.add(mark);

        scene.userData.digMarks.push(mark);
        // Limit total marks to 50
        if (scene.userData.digMarks.length > 50) {
            const oldest = scene.userData.digMarks.shift();
            scene.remove(oldest);
        }
    }

    // Rock spawning (More in mountains)
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
    const rockMat = new THREE.MeshPhongMaterial({ color: 0x808080 });

    function spawnRock(x, z) {
        if (Math.abs(x) < 8 && Math.abs(z) < 8) return;

        const rock = new THREE.Mesh(rockGeo, rockMat);
        const rockH = getHeightAt(x, z);
        rock.position.set(x, rockH + 0.4, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const scale = 1 + Math.random();
        rock.scale.set(scale, scale * 0.6, scale);
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.userData = { isStone: true, hits: 6 };
        scene.add(rock);
        scene.userData.mineables.push(rock);
    }

    for (let i = 0; i < 60; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        const biome = getBiomeAt(x, z);

        // Increase rock density in mountains
        if (biome === BIOME.MOUNTAIN) {
            spawnRock(x, z);
            if (Math.random() > 0.5) spawnRock(x + 2, z + 2);
        } else if (Math.random() > 0.5) {
            spawnRock(x, z);
        }
    }

    // --- ITEM SPAWNING SYSTEM ---
    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16);
    const coinMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 80 });
    const diaGeo = new THREE.OctahedronGeometry(0.3);
    const diaMat = new THREE.MeshPhongMaterial({ color: 0x00e5ff, shininess: 100 });
    const appleGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const appleMat = new THREE.MeshPhongMaterial({ color: 0xff3366 });

    // Water Droplet Shape (Lathe)
    const waterPoints = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        // Teardrop profile: narrow at t=1 (top), rounded at t=0 (bottom)
        const r = Math.sin(Math.PI * t) * (0.25 * (1 - t * 0.7));
        waterPoints.push(new THREE.Vector2(r, (t - 0.5) * -0.6));
    }
    const waterGeo = new THREE.LatheGeometry(waterPoints, 16);
    const waterMat = new THREE.MeshPhongMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.6,
        shininess: 100,
        emissive: 0x002233
    });

    function spawnWorldItem(type, x, z) {
        let mesh;
        if (type === 'coin') {
            mesh = new THREE.Mesh(coinGeo, coinMat);
            mesh.rotation.x = Math.PI / 2;
            mesh.userData = { type: 'coins', amount: Math.floor(Math.random() * 50) + 10, symbol: '🪙' };
        } else if (type === 'diamond') {
            mesh = new THREE.Mesh(diaGeo, diaMat);
            mesh.userData = { type: 'diamonds', amount: Math.floor(Math.random() * 5) + 1, symbol: '💎' };
        } else if (type === 'water') {
            mesh = new THREE.Mesh(waterGeo, waterMat);
            mesh.userData = { type: 'thirst', amount: 30, symbol: '💧' };
        } else if (type === 'meat') {
            const meatGroup = new THREE.Group();
            const meatPart = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.25), new THREE.MeshPhongMaterial({ color: 0xff5252, shininess: 40 }));
            const bonePart = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), new THREE.MeshPhongMaterial({ color: 0xfafafa }));
            bonePart.rotation.z = Math.PI / 3;
            bonePart.position.set(0.1, 0, 0);
            meatGroup.add(meatPart, bonePart);
            mesh = meatGroup;
            mesh.userData = { type: 'hunger', amount: 45, symbol: '🍖' };
        } else {
            mesh = new THREE.Mesh(appleGeo, appleMat);
            mesh.userData = { type: 'hunger', amount: 20, symbol: '🍎' };
        }
        mesh.position.set(x, getHeightAt(x, z) + 0.5, z);
        mesh.castShadow = true;
        mesh.userData.isCollectible = true;
        scene.add(mesh);
        scene.userData.collectibles.push(mesh);
    }

    // --- GOLEM DUNGEON SYSTEM ---
    const stoneBrickMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const dungeonWallGeo = new THREE.BoxGeometry(2, 4, 1);
    const golemMat = new THREE.MeshPhongMaterial({ color: 0x555555, emissive: 0x222222 });

    function spawnGolemDungeon(x, z) {
        const dungeonGroup = new THREE.Group();
        const baseH = getHeightAt(x, z);
        dungeonGroup.position.set(x, baseH, z);

        // 1. Create walls (5x5 square)
        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                if (Math.abs(i) === 2 || Math.abs(j) === 2) {
                    if (i === 0 && j === 2) continue; // Entrance
                    const wall = new THREE.Mesh(dungeonWallGeo, stoneBrickMat);
                    wall.position.set(i * 2, 2, j * 2);
                    if (i === 2 || i === -2) wall.rotation.y = Math.PI / 2;
                    dungeonGroup.add(wall);
                }
            }
        }
        
        // 2. Golem Boss
        const golem = new THREE.Group();
        const gBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1), golemMat);
        const gHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), golemMat);
        gHead.position.y = 1.4;
        const gLimb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), golemMat);
        const gArmL = gLimb.clone(); gArmL.position.set(-1, 0.5, 0);
        const gArmR = gLimb.clone(); gArmR.position.set(1, 0.5, 0);
        const gLegL = gLimb.clone(); gLegL.position.set(-0.4, -1.2, 0);
        const gLegR = gLimb.clone(); gLegR.position.set(0.4, -1.2, 0);
        golem.add(gBody, gHead, gArmL, gArmR, gLegL, gLegR);
        golem.position.set(0, 2.7, 0);
        golem.scale.set(1.5, 1.5, 1.5);
        golem.userData = { health: 800, isMonster: true, isGolem: true };
        dungeonGroup.add(golem);
        scene.userData.monsters.push(golem);

        // 3. Treasure Chest
        const chest = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.8), new THREE.MeshPhongMaterial({ color: 0xffd700 }));
        chest.position.set(1, 0.4, -1);
        chest.userData = { 
            isTreasure: true, 
            isCollectible: true, // Allow picking up
            type: 'treasure', 
            yield: { coins: 500, diamonds: 25 },
            symbol: '🎁'
        };
        dungeonGroup.add(chest);
        scene.userData.collectibles.push(chest);

        scene.add(dungeonGroup);
        scene.userData.structures.push(dungeonGroup);
    }

    // Spawn initial items
    for (let i = 0; i < 60; i++) {
        const rand = Math.random();
        let type = 'coin';
        if (rand > 0.9) type = 'diamond';
        else if (rand > 0.75) type = 'food';
        else if (rand > 0.6) type = 'water';

        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
        spawnWorldItem(type, x, z);
        
        // Very rare chance for Golem Dungeon (0.5%)
        if (Math.random() < 0.005) {
             const dx = (Math.random() - 0.5) * 200;
             const dz = (Math.random() - 0.5) * 200;
             if (Math.abs(dx) > 30 || Math.abs(dz) > 30) spawnGolemDungeon(dx, dz);
        }
    }

    // Basic Movement Logic
    const keys = {};
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'KeyR') {
            isThirdPerson = !isThirdPerson;
            showToast(isThirdPerson ? '3인칭 시점 (TPP)' : '1인칭 시점 (FPP)', 'info');
        }
        if (e.code === 'KeyB') {
            isBuildMode = !isBuildMode;
            const guide = document.getElementById('build-guide');
            const attackBtn = document.getElementById('mobile-attack-btn');
            if (isBuildMode) {
                if (guide) guide.classList.remove('hidden');
                if (attackBtn) attackBtn.textContent = 'PLACE';
                showToast('건설 모드 활성화 (클릭하여 설치)', 'info');
            } else {
                if (guide) guide.classList.add('hidden');
                if (attackBtn) attackBtn.textContent = 'ATTACK';
            }
        }
        if (e.code === 'KeyE') {
            app.toggleInventory();
        }
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    const speed = 0.1;
    let velocityY = 0;
    const gravity = 0.005;
    const jumpForce = 0.15;
    let canJump = true;
    let isCrouching = false;
    let animationId;

    function animate() {
        if (!STATE.threeScene) return;
        animationId = requestAnimationFrame(animate);
        STATE.threeScene.animationId = animationId;

        // --- 1. MOVEMENT & STATS ---
        isCrouching = keys['ShiftLeft'] || keys['ShiftRight'];
        const isSwimming = playerGroup.position.y < -1.0;
        const currentSpeed = (isCrouching ? speed * 0.5 : speed) * (isSwimming ? 0.6 : 1);
        const headHeight = isCrouching && !isSwimming ? 0.8 : 1.6;

        playerBody.position.y += ((isCrouching ? 0.4 : 0.8) - playerBody.position.y) * 0.2;
        playerBody.scale.y += ((isCrouching ? 0.5 : 1.0) - playerBody.scale.y) * 0.2;

        const oldX = playerGroup.position.x;
        const oldZ = playerGroup.position.z;

        if (keys['KeyW']) playerGroup.translateZ(-currentSpeed);
        if (keys['KeyS']) playerGroup.translateZ(currentSpeed);
        if (keys['KeyA']) playerGroup.translateX(-currentSpeed);
        if (keys['KeyD']) playerGroup.translateX(currentSpeed);

        const checkCollision = (px, pz) => {
            // Only check nearby objects for performance
            for (let m of scene.userData.mineables) {
                // Determine true world position
                const tx = (m.parent && m.parent.type !== 'Scene') ? m.parent.position.x : m.position.x;
                const tz = (m.parent && m.parent.type !== 'Scene') ? m.parent.position.z : m.position.z;
                
                const dx = px - tx;
                const dz = pz - tz;
                if (dx*dx + dz*dz < 0.64) return true; // 0.8 radius check
            }
            return false;
        };

        if (checkCollision(playerGroup.position.x, playerGroup.position.z)) {
            playerGroup.position.x = oldX;
            playerGroup.position.z = oldZ;
        }

        // Jump & Gravity
        if (keys['Space'] && canJump && !isCrouching) {
            velocityY = jumpForce;
            canJump = false;
        }
        const terrainH = getHeightAt(playerGroup.position.x, playerGroup.position.z);
        playerGroup.position.y += velocityY;
        if (playerGroup.position.y > terrainH) {
            velocityY -= gravity;
        } else {
            playerGroup.position.y = terrainH;
            velocityY = 0;
            canJump = true;
        }

        // --- 2. CAMERA ---
        if (isThirdPerson) {
            const offset = new THREE.Vector3(0, headHeight + 2, 5).applyQuaternion(playerGroup.quaternion);
            camera.position.copy(playerGroup.position).add(offset);
            camera.lookAt(playerGroup.position.x, playerGroup.position.y + headHeight * 0.75, playerGroup.position.z);
            playerBody.visible = true;
        } else {
            camera.position.copy(playerGroup.position);
            camera.position.y += headHeight;
            camera.rotation.order = 'YXZ';
            camera.rotation.set(cameraPitch, playerGroup.rotation.y, 0);
            playerBody.visible = false;
        }

        // --- 3. AI & INTERACTIVE ---
        const now = Date.now();
        // Monsters
        scene.userData.monsters.forEach(m => {
            const d = m.position.distanceTo(playerGroup.position);
            if (d < (m.userData.isGolem ? 20 : 10)) {
                m.lookAt(playerGroup.position.x, m.position.y, playerGroup.position.z);
                m.translateZ(m.userData.isGolem ? 0.02 : 0.04);
                if (d < 1.5 && now % 1000 < 20) {
                    STATE.currentUser.health -= (m.userData.isGolem ? 20 : 8);
                    showToast(m.userData.isGolem ? '골렘의 일격! 💥' : '괴물 공격!', 'error');
                    updateUI();
                }
            }
        });

        // Animals
        scene.userData.animals.forEach(a => {
            const d = a.position.distanceTo(playerGroup.position);
            if (d < 4) {
                a.userData.targetAngle = Math.atan2(a.position.x - playerGroup.position.x, a.position.z - playerGroup.position.z);
                a.translateZ(0.08);
            } else {
                a.rotation.y = a.userData.targetAngle;
                a.translateZ(0.02);
                if (Math.random() < 0.005) a.userData.targetAngle = Math.random() * Math.PI * 2;
            }
            a.position.y = getHeightAt(a.position.x, a.position.z) + 0.6;
        });

        // Collectibles Loop Optimization
        for (let i = scene.userData.collectibles.length - 1; i >= 0; i--) {
            const item = scene.userData.collectibles[i];
            item.rotation.y += 0.02;
            // Simplified bobbing
            item.position.y = getHeightAt(item.position.x, item.position.z) + 0.5 + Math.sin(now * 0.005) * 0.1;

            if (item.userData.symbol === '🍖' && item.position.distanceTo(playerGroup.position) < 2) {
                STATE.currentUser.hunger = Math.min(100, (STATE.currentUser.hunger || 100) + 30);
                scene.remove(item);
                scene.userData.collectibles.splice(i, 1);
                updateUI();
            }
        }

        // Survival & Projectiles Throttled
        if (now % 1000 < 20) {
            STATE.currentUser.hunger = Math.max(0, (STATE.currentUser.hunger || 100) - 0.1);
            STATE.currentUser.thirst = Math.max(0, (STATE.currentUser.thirst || 100) - 0.15);
            if (STATE.currentUser.hunger <= 0 || STATE.currentUser.thirst <= 0) STATE.currentUser.health -= 1;
            updateUI();
            if (STATE.currentUser.health <= 0) { app.exitGame(); showToast('생존 실패...', 'error'); }
        }

        // --- 4. WEATHER & PROJECTILES ---
        if (particles.visible) {
            const pos = particleGeometry.attributes.position.array;
            const pSpeed = currentWeather === 'snow' ? 0.05 : 0.4;
            for (let i = 0; i < particleCount; i++) {
                pos[i * 3 + 1] -= pSpeed;
                if (pos[i * 3 + 1] < -5) pos[i * 3 + 1] = 50;
            }
            particleGeometry.attributes.position.needsUpdate = true;
            particles.position.set(playerGroup.position.x, 0, playerGroup.position.z);
        }

        // Arrows (Projectiles) update
        if (scene.userData.projectiles) {
            scene.userData.projectiles.forEach((p, idx) => {
                p.position.add(p.userData.velocity);
                p.userData.life--;
                if (p.userData.life <= 0) {
                    scene.remove(p);
                    scene.userData.projectiles.splice(idx, 1);
                }
            });
        }

        // --- 3. MULTIPLAYER SYNC ---
        syncMyPosition();

        renderer.render(scene, camera);
    }

    // Save to state to allow cleanup
    STATE.threeScene = {
        scene,
        camera,
        renderer,
        canvas: renderer.domElement,
        weatherInterval,
        playerGroup,
        setMoveKey: (code, val) => {
            keys[code] = val;
            // Immediate trigger if specialized
            if (code === 'KeyB' && val) {
                // Manually trigger B key logic since it's an event listener usually
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
            }
        }
    };

    animate();

    // Raycaster for Attacking / Mining / Collecting
    const raycaster = new THREE.Raycaster();
    const centerVec = new THREE.Vector2(0, 0); // screen center
    const crosshair = document.querySelector('.crosshair');

    window.addEventListener('mousedown', (e) => {
        if (!STATE.threeScene || document.getElementById('game-screen').classList.contains('hidden')) return;

        if (isBuildMode) {
            // Priority: Place Campfire if held, else Workbench if held, else Wall
            if (STATE.currentUser.campfire > 0) {
                if (STATE.currentUser.role !== 'admin') STATE.currentUser.campfire--;
                const pos = playerGroup.position.clone();
                const forward = new THREE.Vector3(0, 0, -2);
                forward.applyQuaternion(playerGroup.quaternion);
                pos.add(forward);
                placeCampfire(pos, playerGroup.rotation);
                updateUI();
            } else if (STATE.currentUser.workbench > 0) {
                if (STATE.currentUser.role !== 'admin') STATE.currentUser.workbench--;
                const pos = playerGroup.position.clone();
                const forward = new THREE.Vector3(0, 0, -2);
                forward.applyQuaternion(playerGroup.quaternion);
                pos.add(forward);
                placeWorkbench(pos, playerGroup.rotation);
                updateUI();
            } else if (STATE.currentUser.wood >= 5 || STATE.currentUser.role === 'admin') {
                if (STATE.currentUser.role !== 'admin') STATE.currentUser.wood -= 5;
                const pos = playerGroup.position.clone();
                const forward = new THREE.Vector3(0, 0, -2);
                forward.applyQuaternion(playerGroup.quaternion);
                pos.add(forward);
                placeWall(pos, playerGroup.rotation);
                updateUI();
            } else {
                showToast('나무가 부족합니다! (5개 필요)', 'error');
            }
            return;
        }

        // Play swinging animation
        swingTool();

        // Play crosshair animation
        crosshair.classList.add('active');
        setTimeout(() => crosshair.classList.remove('active'), 100);

        raycaster.setFromCamera(centerVec, camera);

        // 0. Check intersection with Monsters
        const monsterIntersects = raycaster.intersectObjects(scene.userData.monsters);
        if (monsterIntersects.length > 0 && monsterIntersects[0].distance < reachRange) {
            const monster = monsterIntersects[0].object;
            monster.userData.health -= 40;
            showToast('괴물을 타격했습니다!', 'success');

            if (monster.userData.health <= 0) {
                scene.remove(monster);
                scene.userData.monsters = scene.userData.monsters.filter(m => m !== monster);
                STATE.currentUser.coins += 50;
                app.updateQuestProgress('kill', 1);
                app.addXP(50);
                showToast('괴물을 처치했습니다! (+50🪙, +50XP)', 'success');
                updateUI();
            }
            return;
        }

        // 0.1 Check intersection with Animals
        const animalIntersects = raycaster.intersectObjects(scene.userData.animals, true);
        if (animalIntersects.length > 0 && animalIntersects[0].distance < reachRange) {
            let animal = animalIntersects[0].object;
            // Traverse up to find the Group which holds the userData
            while (animal.parent && !animal.userData.isAnimal) {
                animal = animal.parent;
            }

            if (animal.userData.isAnimal) {
                const typeName = animal.userData.type === 'pig' ? '돼지' : (animal.userData.type === 'cow' ? '소' : '양');
                animal.userData.health -= 25;
                showToast(`${typeName}를 공격했습니다!`, 'success');

                // Flee faster
                animal.userData.targetAngle = Math.atan2(animal.position.x - playerGroup.position.x, animal.position.z - playerGroup.position.z);
                animal.userData.speed = 0.15;
                animal.userData.wait = 0;

                if (animal.userData.health <= 0) {
                    spawnWorldItem('meat', animal.position.x, animal.position.z);
                    scene.remove(animal);
                    scene.userData.animals = scene.userData.animals.filter(a => a !== animal);
                    app.updateQuestProgress('hunt', 1);
                    app.addXP(20);
                    showToast(`${typeName} 사냥 성공! 고기를 떨어뜨렸습니다. (+20XP)`, 'success');
                }
                return;
            }
        }

        // 1. Check intersection with collectibles (Items on ground)
        const itemIntersects = raycaster.intersectObjects(scene.userData.collectibles);
        if (itemIntersects.length > 0 && itemIntersects[0].distance < reachRange) {
            const item = itemIntersects[0].object;
            const data = item.userData;

            if (data.type === 'treasure') {
                const yield = data.yield;
                STATE.currentUser.coins += yield.coins;
                STATE.currentUser.diamonds += yield.diamonds;
                showToast(`💎 전설적인 보물 발견! (🪙 +${yield.coins}, 💎 +${yield.diamonds})`, 'success');
                playSound('success');
            } else if (data.type === 'hunger') {
                STATE.currentUser.hunger = Math.min(100, (STATE.currentUser.hunger || 0) + data.amount);
                STATE.currentUser.health = Math.min(100, (STATE.currentUser.health || 0) + 5);
                app.updateQuestProgress('eat', 1);
                showToast(`사과(+${data.amount}🍎) 획득! 허기가 회복되었습니다.`, 'success');
            } else if (data.type === 'thirst') {
                STATE.currentUser.thirst = Math.min(100, (STATE.currentUser.thirst || 0) + data.amount);
                app.updateQuestProgress('drink', 1);
                showToast(`물(+${data.amount}💧) 획득! 갈증이 해소되었습니다.`, 'success');
            } else {
                STATE.currentUser[data.type] += data.amount;
                app.updateQuestProgress(data.type, data.amount);
                showToast(`${data.type === 'coins' ? '코인' : '다이아몬드'}(+${data.amount}${data.symbol}) 획득!`, 'success');
            }

            scene.remove(item);
            scene.userData.collectibles = scene.userData.collectibles.filter(i => i !== item);

            updateUI();
            saveData();
            return; // Don't process mining if we picked up an item
        }

        // 2. Check intersection with mineables (Trees & Rocks)
        const mineIntersects = raycaster.intersectObjects(scene.userData.mineables);

        if (mineIntersects.length > 0 && mineIntersects[0].distance < reachRange) {
            const hitObj = mineIntersects[0].object;
            const target = hitObj.parent;

            if (target && target.userData && target.userData.isWood) {
                const dmg = (STATE.currentUser.steel_axe > 0) ? 2 : 1;
                target.userData.hits -= dmg;

                // Visual feedback
                target.scale.set(1.1, 0.9, 1.1);
                setTimeout(() => { if (target.parent) target.scale.set(1, 1, 1); }, 100);

                if (target.userData.hits <= 0) {
                    scene.remove(target);
                    scene.userData.mineables = scene.userData.mineables.filter(m => m.parent !== target);
                    STATE.currentUser.wood = (STATE.currentUser.wood || 0) + 1;
                    app.updateQuestProgress('wood', 1);
                    app.addXP(10);
                    showToast('나무(+1🪵, +10XP) 획득!', 'success');
                    updateUI();
                    saveData();
                } else {
                    showToast(`나무 타격! (남은 횟수: ${Math.max(0, target.userData.hits)})`, 'info');
                }
            } else if (hitObj.userData.isStone) {
                const rock = hitObj;
                const dmg = (STATE.currentUser.steel_axe > 0) ? 2 : 1;
                rock.userData.hits -= dmg;

                // Visual feedback: Shrink slightly
                rock.scale.multiplyScalar(0.95);
                setTimeout(() => { if (rock.parent) rock.scale.multiplyScalar(1.0526); }, 100);

                if (rock.userData.hits <= 0) {
                    const amount = 3 + Math.floor(Math.random() * 4);
                    STATE.currentUser.stone = (STATE.currentUser.stone || 0) + amount;
                    
                    // Added Iron drop chance
                    let ironGained = 0;
                    if (Math.random() < 0.3) {
                        ironGained = 1 + Math.floor(Math.random() * 2);
                        STATE.currentUser.iron = (STATE.currentUser.iron || 0) + ironGained;
                    }

                    app.updateQuestProgress('stone', amount);
                    const xpGain = amount * 2;
                    app.addXP(xpGain);
                    scene.remove(rock);
                    scene.userData.mineables = scene.userData.mineables.filter(m => m !== rock);
                    
                    let msg = `돌(+${amount}🪨)을 채굴했습니다!`;
                    if (ironGained > 0) msg += ` 철(+${ironGained}⛓️)도 발견했습니다!`;
                    showToast(msg, 'success');
                    updateUI();
                    saveData();
                } else {
                    showToast(`돌 타격! (남은 횟수: ${Math.max(0, rock.userData.hits)})`, 'info');
                }
            }
        }

        // 3. Digging the ground
        const groundIntersects = raycaster.intersectObject(ground);
        if (groundIntersects.length > 0 && groundIntersects[0].distance < reachRange) {
            // Check cooldown (0.5s)
            const now = Date.now();
            if (!STATE.lastDigTime || now - STATE.lastDigTime > 500) {
                STATE.lastDigTime = now;

                // Yield Stone (100%)
                STATE.currentUser.stone = (STATE.currentUser.stone || 0) + 1;
                app.updateQuestProgress('stone', 1);
                app.addXP(2);
                let gainedMsg = '돌(+1🪨, +2XP)';

                // Random Rare Minerals
                const rand = Math.random();
                if (rand < 0.05) {
                    STATE.currentUser.diamonds = (STATE.currentUser.diamonds || 0) + 1;
                    gainedMsg += ', 다이아(+1💎)';
                } else if (rand < 0.15) {
                    STATE.currentUser.gold = (STATE.currentUser.gold || 0) + 1;
                    gainedMsg += ', 금(+1📀)';
                } else if (rand < 0.35) {
                    STATE.currentUser.iron = (STATE.currentUser.iron || 0) + 1;
                    gainedMsg += ', 철(+1⛓️)';
                }

                showToast(`땅을 파서 ${gainedMsg} 획득!`, 'success');
                createDigMark(groundIntersects[0].point);
                updateUI();
                saveData();
            }
        }
    });

    const arrowGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const arrowMat = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
    scene.userData.projectiles = [];

    // Bow Shoot listener
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF' && STATE.currentUser.bow > 0 && !document.getElementById('game-screen').classList.contains('hidden')) {
            // Shoot Arrow
            const arrow = new THREE.Mesh(arrowGeo, arrowMat);
            arrow.rotation.copy(camera.rotation);
            arrow.rotateX(Math.PI / 2);

            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);

            arrow.position.copy(camera.position).add(direction.clone().multiplyScalar(1));
            arrow.userData = {
                velocity: direction.multiplyScalar(0.8),
                life: 100
            };

            scene.add(arrow);
            scene.userData.projectiles.push(arrow);
            showToast('화살 발사!', 'info');
        }
    });

    // Handle Window Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Dynamic Orientation Warning Update
        const warning = document.getElementById('orientation-warning');
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouch && document.getElementById('game-screen').classList.contains('active')) {
            if (window.innerHeight > window.innerWidth) {
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        }
    });

    // --- MOBILE TOUCH LOGIC ---
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
        document.getElementById('mobile-controls').style.display = 'block';
        // document.querySelector('.crosshair').style.display = 'none'; // Keep crosshair even on mobile per user request

        // 1. Joystick Logic
        const joystickArea = document.getElementById('joystick-area');
        const joystickKnob = document.getElementById('joystick-knob');
        let joystickCenter = { x: 0, y: 0 };

        joystickArea.addEventListener('touchstart', (e) => {
            const rect = joystickArea.getBoundingClientRect();
            joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }, { passive: true });

        joystickArea.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const dx = touch.clientX - joystickCenter.x;
            const dy = touch.clientY - joystickCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 60;

            if (dist === 0) return;

            const limitedDx = (dx / dist) * Math.min(dist, maxDist);
            const limitedDy = (dy / dist) * Math.min(dist, maxDist);

            joystickKnob.style.transform = `translate(calc(-50% + ${limitedDx}px), calc(-50% + ${limitedDy}px))`;

            // Movement keys simulation
            const threshold = 20;
            keys['KeyW'] = limitedDy < -threshold;
            keys['KeyS'] = limitedDy > threshold;
            keys['KeyA'] = limitedDx < -threshold;
            keys['KeyD'] = limitedDx > threshold;
        }, { passive: false });

        joystickArea.addEventListener('touchend', () => {
            joystickKnob.style.transform = `translate(-50%, -50%)`;
            keys['KeyW'] = keys['KeyS'] = keys['KeyA'] = keys['KeyD'] = false;
        }, { passive: true });

        // 2. Touch Look Logic
        const lookArea = document.getElementById('touch-look-area');
        let lastTouch = null;

        lookArea.addEventListener('touchstart', (e) => {
            lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });

        lookArea.addEventListener('touchmove', (e) => {
            if (!lastTouch) return;
            const touch = e.touches[0];
            const dx = touch.clientX - lastTouch.x;
            const dy = touch.clientY - lastTouch.y;

            const sensitivity = 0.005;
            playerGroup.rotation.y -= dx * sensitivity;
            cameraPitch -= dy * sensitivity;
            cameraPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, cameraPitch));

            lastTouch = { x: touch.clientX, y: touch.clientY };
        }, { passive: true });

        lookArea.addEventListener('touchend', () => {
            lastTouch = null;
        }, { passive: true });
        }
    } catch (err) {
        console.error("CRITICAL GAME ERROR:", err);
        showToast("게임 로딩 중 치명적 오류: " + err.message, "error");
        showScreen('menu-screen');
    }
}


const initFirebaseChatListener = () => {
    if (db && !isFirebaseChatAttached) {
        const chatMsgs = document.getElementById('chat-messages');
        if (chatMsgs) chatMsgs.innerHTML = ''; // Clear only once at first start

        // Listen to additions (Real-time)
        db.ref('chats').orderByChild('time').limitToLast(50).on('child_added', snapshot => {
            isFirebaseChatAttached = true;
            const msg = snapshot.val();
            if (!document.querySelector(`.chat-msg[data-id="${msg.id}"]`)) {
                const type = (STATE.currentUser && msg.sender === STATE.currentUser.username) ? 'me' : 'other';
                addChatMsgUI(msg.sender, msg.text, type, msg.id);
            }
        }, (err) => {
            console.warn("Chat listener failed due to permissions, falling back to offline mode.");
            isFirebaseChatAttached = true; // Prevent multiple retries
        });

        // Listen to deletions
        db.ref('chats').on('child_removed', snapshot => {
            const key = snapshot.key;
            const el = document.querySelector(`.chat-msg[data-id="${key}"]`);
            if (el) el.remove();
        }, (err) => {
            // Ignore permission error here
        });
    }
};

const renderChat = () => {
    const chatMsgs = document.getElementById('chat-messages');
    if (!chatMsgs) return;

    const isOnline = db && auth && auth.currentUser;

    if (isOnline) {
        if (!isFirebaseChatAttached) {
            initFirebaseChatListener();
        }
        // Force scroll to bottom on entry
        setTimeout(() => {
            chatMsgs.scrollTop = chatMsgs.scrollHeight;
        }, 100);
    } else {
        // Fallback to offline local chat
        if (!document.querySelector('.chat-msg.system.offline-mode')) {
            chatMsgs.innerHTML = '<div class="chat-msg system offline-mode">채팅방에 입장했습니다. (오프라인 모드)</div>';
            const savedChats = JSON.parse(localStorage.getItem('SURVIVAL_CHATS') || '[]');
            savedChats.forEach(msg => {
                const type = (STATE.currentUser && msg.sender === STATE.currentUser.username) ? 'me' : 'other';
                addChatMsgUI(msg.sender, msg.text, type, msg.id);
            });
        }
        setTimeout(() => {
            chatMsgs.scrollTop = chatMsgs.scrollHeight;
        }, 100);
    }
};

const addChatMsgUI = (sender, text, type = 'other', id = null) => {
    const chatMsgs = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${type}`;
    if (id) msgDiv.dataset.id = id;

    if (type !== 'system') {
        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = sender;
        msgDiv.appendChild(senderSpan);

        // Feature: Master Admin Deletion
        if (STATE.currentUser && STATE.currentUser.username === 'ree1203fdsa' && id) {
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '❌';
            delBtn.style.cssText = 'float:right; background:none; border:none; cursor:pointer; font-size:0.75rem; margin-left:8px; opacity:0.6;';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteChatMessage(id);
            };
            senderSpan.appendChild(delBtn);
        }
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    msgDiv.appendChild(textSpan);

    chatMsgs.appendChild(msgDiv);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
};

const deleteChatMessage = (id) => {
    if (confirm('이 메시지를 삭제하시겠습니까?')) {
        const isOnline = db && auth && auth.currentUser;
        if (isOnline) {
            db.ref('chats/' + id).remove().catch(err => {
                // If it fails on server, try local offline deletion
                let savedChats = JSON.parse(localStorage.getItem('SURVIVAL_CHATS') || '[]');
                savedChats = savedChats.filter(m => m.id !== id);
                localStorage.setItem('SURVIVAL_CHATS', JSON.stringify(savedChats));
                document.getElementById('chat-messages').innerHTML = '';
                renderChat();
            });
        } else {
            let savedChats = JSON.parse(localStorage.getItem('SURVIVAL_CHATS') || '[]');
            savedChats = savedChats.filter(m => m.id !== id);
            localStorage.setItem('SURVIVAL_CHATS', JSON.stringify(savedChats));
            document.getElementById('chat-messages').innerHTML = '';
            renderChat();
        }
    }
};

// Internal function to save and broadcast
const addChatMsg = (sender, text, type = 'other', isInternal = false) => {
    const msgId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);

    // If bypass is used, auth.currentUser will be null. 
    // We should fallback to local UI gracefully if Firebase throws permission denied.
    const isOnline = db && auth && auth.currentUser;

    if (isOnline && !isInternal) {
        db.ref('chats/' + msgId).set({
            id: msgId,
            sender: sender,
            text: text,
            time: Date.now()
        }).then(() => {
            console.log("Chat sent to server.");
        }).catch(err => {
            console.warn("Chat send error fallback to local:", err);
            // Fallback to local UI if server fails silently
            const savedChats = JSON.parse(localStorage.getItem('SURVIVAL_CHATS') || '[]');
            savedChats.push({ id: msgId, sender, text, time: Date.now() });
            if (savedChats.length > 50) savedChats.shift();
            localStorage.setItem('SURVIVAL_CHATS', JSON.stringify(savedChats));
            addChatMsgUI(sender, text, 'me', msgId);
        });
    } else if (!isInternal) {
        const savedChats = JSON.parse(localStorage.getItem('SURVIVAL_CHATS') || '[]');
        savedChats.push({ id: msgId, sender, text, time: Date.now() });
        if (savedChats.length > 50) savedChats.shift();
        localStorage.setItem('SURVIVAL_CHATS', JSON.stringify(savedChats));
        addChatMsgUI(sender, text, type, msgId);
    } else {
        addChatMsgUI(sender, text, type, msgId);
    }
};

// Listener for other tabs
window.addEventListener('storage', (e) => {
    if (e.key === CHAT_STORAGE_KEY && !db) {
        renderChat(); // Re-render everything to handle deletions and additions correctly
    }
});

// --- PROFANITY FILTER ---
const FORBIDDEN_WORDS = ['씨발', '시발', 'ㅅㅂ', '개새끼', '병신', 'ㅄ', '존나', '좆', '미친'];

document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text && STATE.currentUser) {
        console.log("Attempting to send chat:", text);
        // Profanity Check
        const hasProfanity = FORBIDDEN_WORDS.some(word => text.includes(word));

        if (hasProfanity) {
            const banDuration = 24 * 60 * 60 * 1000; // 1 day
            STATE.currentUser.banUntil = Date.now() + banDuration;
            saveData();

            showToast('비속어 감지됨! 1일간 게임 입장이 금지됩니다.', 'error');
            addChatMsgUI('System', `${STATE.currentUser.username}님이 비속어 사용으로 1일 정지되었습니다.`, 'system');
            input.value = '';
            return;
        }

        addChatMsg(STATE.currentUser.username, text, 'me');
        input.value = '';

        // Simulating a bot response
        if (text.includes('안녕')) {
            setTimeout(() => addChatMsg('AI_Bot', '반갑습니다! 무엇을 도와드릴까요?', 'other', false), 1000);
        }
    }
});

// --- FORGOT PASSWORD ---
document.getElementById('btn-forgot-password').addEventListener('click', () => {
    const userIn = document.getElementById('username').value.trim();
    if (!userIn) {
        showToast('먼저 아이디 칸에 아이디를 입력해 주세요!', 'info');
        return;
    }

    const isCreator = CREATOR_ACCOUNTS.some(acc => acc.toLowerCase() === userIn.toLowerCase());

    if (isCreator) {
        // Master accounts can reset via special prompt
        const answer = prompt(`[보안 확인] ${userIn} 마스터님, 본인 확인을 위해 "관리자 비밀번호 초기화"라고 입력해 주세요.`);
        if (answer === "관리자 비밀번호 초기화") {
            const patternCorrect = confirm("패턴을 성공적으로 그리셨나요? 패턴이 맞아야 리셋이 가능합니다.");
            if (patternCorrect) {
                const newPw = prompt("새로 사용할 비밀번호를 입력하세요 (6자 이상)");
                if (newPw && newPw.length >= 6) {
                    // Since we can't easily change Firebase Auth PW from client without old PW,
                    // we advise the most practical way for creator.
                    showToast('서버 관리자 시스템에 요청이 전송되었습니다. (실제 리셋은 Firebase Console의 Authentication에서 해당 유저 삭제 후 재가입을 권장합니다.)', 'info');
                    alert(`[개발자 가이드]\n현재 보안 정책상 클라이언트에서 직접 비밀번호를 강제 변경할 수 없습니다.\n\n가장 빠른 방법:\n1. Firebase Console 접속\n2. Authentication에서 ${userIn} 삭제\n3. 게임에서 새 비밀번호로 다시 가입`);
                } else {
                    showToast('비밀번호가 너무 짧습니다.', 'error');
                }
            }
        }
    } else {
        // Regular users
        showToast(`'${userIn}' 계정은 Firebase Authentication을 통해 비밀번호 재설정 이메일이 발송되어야 합니다. (현재는 관리자에게 문의하세요)`, 'info');
    }
});

// --- ANNOUNCEMENT SYSTEM ---
let currentAnnId = null;
let annListener = null;
let annCommentsListener = null;
let currentAnnFilter = 'all';

const renderAnnouncements = (filter = 'all') => {
    currentAnnFilter = filter;
    const listEl = document.getElementById('announcement-list');
    if (!listEl) return;

    // Update Tab UI
    const tabs = document.querySelectorAll('#ann-tabs .btn');
    tabs.forEach(btn => {
        const onClickStr = btn.getAttribute('onclick');
        if (onClickStr.includes(`'${filter}'`)) {
            btn.style.background = 'rgba(0,255,136,0.2)';
            btn.style.color = '#00ff88';
            btn.style.border = '1px solid #00ff88';
        } else {
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.color = '#ccc';
            btn.style.border = '1px solid #444';
        }
    });

    // Check if master
    let isMaster = false;
    if (STATE.currentUser) {
        if (STATE.currentUser.role === 'creator' || STATE.currentUser.role === 'admin') isMaster = true;
        if (STATE.currentUser.username && STATE.currentUser.username.toLowerCase() === 'ree1203fdsa') isMaster = true;
        if (STATE.currentUser.username && CREATOR_ACCOUNTS.includes(STATE.currentUser.username)) isMaster = true;
    }
    const btnNew = document.getElementById('btn-new-announcement');
    if (btnNew) {
        if (isMaster) {
            btnNew.style.display = 'inline-flex';
            btnNew.style.setProperty('display', 'inline-flex', 'important');
            btnNew.style.visibility = 'visible';
            btnNew.style.opacity = '1';
        } else {
            btnNew.style.display = 'none';
        }
    }

    const isOnline = db;
    if (isOnline) {
        if (annListener) db.ref('announcements').off('value', annListener);
        listEl.innerHTML = '<div style="text-align:center; color:#fff;">불러오는 중...</div>';

        annListener = db.ref('announcements').on('value', snapshot => {
            const data = snapshot.val();
            listEl.innerHTML = '';
            if (!data) {
                listEl.innerHTML = '<div style="text-align:center; color:#ccc;">등록된 공지사항이 없습니다.</div>';
                return;
            }

            // Sort by time descending
            let posts = Object.values(data).sort((a, b) => b.time - a.time);
            
            // Filter by type
            if (filter !== 'all') {
                posts = posts.filter(p => p.type === filter);
            }

            if (posts.length === 0) {
                listEl.innerHTML = `<div style="text-align:center; color:#ccc; padding: 20px;">'${filter}' 카테고리에 등록된 글이 없습니다.</div>`;
                return;
            }

            posts.forEach(post => {
                const div = document.createElement('div');
                
                // Color based on type
                let typeColor = '#ffd54f';
                let typeName = '📢 공지';
                let typeBg = 'rgba(235, 183, 28, 0.1)';
                let typeBorder = 'rgba(209, 164, 29, 0.4)';

                if (post.type === 'event') {
                    typeColor = '#ff5252';
                    typeName = '🎁 이벤트';
                    typeBg = 'rgba(255, 82, 82, 0.1)';
                    typeBorder = 'rgba(255, 82, 82, 0.4)';
                } else if (post.type === 'update') {
                    typeColor = '#64b5f6';
                    typeName = '🛠️ 업데이트';
                    typeBg = 'rgba(100, 181, 246, 0.1)';
                    typeBorder = 'rgba(100, 181, 246, 0.4)';
                }

                div.style.cssText = `background: ${typeBg}; border: 1px solid ${typeBorder}; padding: 15px; border-radius: 8px; cursor: pointer; transition: 0.2s; position: relative;`;
                div.onclick = () => openAnnouncementDetail(post);

                const d = new Date(post.time);
                const dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                const commentCount = post.comments ? Object.keys(post.comments).length : 0;

                div.innerHTML = `
                    <div style="font-size: 0.7rem; color: ${typeColor}; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">${typeName}</div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #fff; margin-bottom: 5px;">${post.title}</div>
                    <div style="font-size: 0.8rem; color: #aaa; display: flex; justify-content: space-between;">
                        <span>작성자: ${post.author}</span>
                        <span>${dateStr} | 댓글 ${commentCount}</span>
                    </div>
                `;
                listEl.appendChild(div);
            });
        }, err => {
            listEl.innerHTML = '<div style="text-align:center; color:#ccc;">공지사항을 불러오지 못했습니다. (권한 없음)</div>';
        });
    } else {
        listEl.innerHTML = '<div style="text-align:center; color:#ccc;">오프라인/에러 모드에서는 공지사항을 볼 수 없습니다.</div>';
    }
};

// Expose these carefully to a global context if needed or just use via button
const openAnnouncementDetail = (post) => {
    playSound('click');
    currentAnnId = post.id;
    app.showScreen('ann-detail-screen');

    document.getElementById('ann-detail-title').textContent = post.title;
    document.getElementById('ann-detail-author').textContent = post.author;
    const d = new Date(post.time);
    document.getElementById('ann-detail-date').textContent = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    document.getElementById('ann-detail-content').textContent = post.content;

    // --- VOTE AREA ---
    const voteArea = document.getElementById('ann-vote-area');
    if (post.voteOptions && post.voteOptions.length > 0) {
        voteArea.style.display = 'block';
        renderVotes(post);
    } else {
        voteArea.style.display = 'none';
    }

    // --- MINI GAME AREA ---
    const gameArea = document.getElementById('ann-event-game-area');
    if (post.type === 'event' || post.hasWheel) {
        gameArea.style.display = 'block';
        const spinBtn = document.getElementById('btn-open-wheel');
        // Using onclick for simple override
        spinBtn.onclick = (e) => {
            e.stopPropagation();
            initWheel(post.id);
        };
    } else {
        gameArea.style.display = 'none';
    }

    const isOnline = db; // allow db attempt even if auth is bypassed
    const listEl = document.getElementById('ann-comments-list');
    listEl.innerHTML = '';
    document.getElementById('ann-comment-count').textContent = '0';

    if (isOnline) {
        if (annCommentsListener) db.ref('announcements/' + post.id + '/comments').off('value', annCommentsListener);

        annCommentsListener = db.ref('announcements/' + post.id + '/comments').on('value', snapshot => {
            const data = snapshot.val();
            listEl.innerHTML = '';
            if (!data) {
                document.getElementById('ann-comment-count').textContent = '0';
                listEl.innerHTML = '<div style="text-align:center; color:#aaa; font-size: 0.8rem;">첫 번째 댓글을 남겨보세요!</div>';
                return;
            }

            const comments = Object.values(data).sort((a, b) => a.time - b.time);
            document.getElementById('ann-comment-count').textContent = comments.length;

            comments.forEach(c => {
                const cDiv = document.createElement('div');
                cDiv.style.cssText = 'background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 0.9rem; position: relative;';
                const isMasterUser = CREATOR_ACCOUNTS.some(acc => acc.toLowerCase() === c.author.toLowerCase());
                const isAuthor = STATE.currentUser && STATE.currentUser.username === c.author;
                const canDelete = isAuthor || (STATE.currentUser && (STATE.currentUser.role === 'creator' || STATE.currentUser.role === 'admin'));

                cDiv.innerHTML = `
                    <div style="font-size: 0.75rem; color: ${isMasterUser ? '#ff5252' : '#aaa'}; font-weight: bold; margin-bottom: 3px;">
                        ${isMasterUser ? '👑 ' : ''}${c.author}
                    </div>
                    <div style="color: #eee;">${c.text}</div>
                    ${canDelete ? `<button onclick="deleteAnnComment('${post.id}', '${c.id}')" style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: #ff5252; cursor: pointer; font-size: 0.7rem;">✕</button>` : ''}
                `;
                listEl.appendChild(cDiv);
            });
            listEl.scrollTop = listEl.scrollHeight;
        });
    }

    // Deletion visibility
    const delBtn = document.getElementById('btn-delete-ann');
    const isAdmin = STATE.currentUser && (STATE.currentUser.role === 'creator' || STATE.currentUser.role === 'admin');
    const isPostAuthor = STATE.currentUser && STATE.currentUser.username === post.author;
    if (delBtn) {
        if (isAdmin || isPostAuthor) {
            delBtn.style.display = 'block';
            delBtn.onclick = () => {
                if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
                    db.ref('announcements/' + post.id).remove().then(() => {
                        showToast('공지가 삭제되었습니다.', 'success');
                        app.showScreen('ann-list-screen');
                    });
                }
            };
        } else {
            delBtn.style.display = 'none';
        }
    }
};

let voteListener = null;
const renderVotes = (post) => {
    const optionsEl = document.getElementById('ann-vote-options');
    if (!db) return;

    if (voteListener) db.ref('announcements/' + post.id + '/votes').off('value', voteListener);

    voteListener = db.ref('announcements/' + post.id + '/votes').on('value', snapshot => {
        const votes = snapshot.val() || {};
        const totalVotes = Object.keys(votes).length;
        const myVote = STATE.currentUser ? votes[STATE.currentUser.uid] : null;

        optionsEl.innerHTML = '';
        post.voteOptions.forEach((opt, idx) => {
            const count = Object.values(votes).filter(v => v === idx).length;
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isMyVote = myVote === idx;

            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.cssText = `
                width: 100%;
                text-align: left;
                padding: 15px;
                margin-bottom: 8px;
                background: ${isMyVote ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)'};
                border: 2px solid ${isMyVote ? '#00ff88' : 'rgba(255,255,255,0.1)'};
                color: #fff;
                border-radius: 12px;
                position: relative;
                overflow: hidden;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
                font-weight: bold;
                display: block;
            `;
            
            // Percentage bar
            const fill = document.createElement('div');
            fill.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: ${percent}%;
                background: ${isMyVote ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.05)'};
                z-index: 1;
                transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            btn.appendChild(fill);

            const content = document.createElement('div');
            content.style.cssText = `position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center;`;
            content.innerHTML = `
                <span>${opt} ${isMyVote ? ' ✅' : ''}</span>
                <span style="font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 20px;">${count}표 (${percent}%)</span>
            `;
            btn.appendChild(content);

            btn.onmouseover = () => { btn.style.transform = 'translateX(5px)'; btn.style.background = 'rgba(255,255,255,0.08)'; };
            btn.onmouseout = () => { btn.style.transform = 'translateX(0)'; btn.style.background = isMyVote ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)'; };
            
            btn.onclick = () => {
                playSound('click');
                castVote(post.id, idx);
            };
            optionsEl.appendChild(btn);
        });
    });
};

const castVote = (postId, optionIndex) => {
    if (!STATE.currentUser || STATE.currentUser.isGuest) return showToast("로그인 후 투표가 가능합니다.", "warning");
    db.ref('announcements/' + postId + '/votes/' + STATE.currentUser.uid).set(optionIndex).then(() => {
        showToast("투표가 반영되었습니다!", "success");
    });
};

// --- LUCKY WHEEL LOGIC ---
let isSpinning = false;
const wheelPrizes = [
    { text: '100🪙', color: '#ff5252', reward: 100 },
    { text: '꽝', color: '#222', reward: 0 },
    { text: '500🪙', color: '#ffb142', reward: 500 },
    { text: '💎 1개', color: '#00e5ff', reward: 0, diamonds: 1 },
    { text: '300🪙', color: '#ff5252', reward: 300 },
    { text: '꽝', color: '#222', reward: 0 },
    { text: '💎 5개', color: '#ff7043', reward: 0, diamonds: 5 },
    { text: '1000🪙', color: '#ffd700', reward: 1000 }
];

function initWheel(eventId) {
    const modal = document.getElementById('wheel-modal');
    if (!modal) return;
    
    isSpinning = false; // Reset state just in case
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; 
    modal.style.setProperty('display', 'flex', 'important');
    
    // Draw initial wheel
    setTimeout(() => {
        const canvas = document.getElementById('wheel-canvas');
        if (canvas) {
            canvas.width = 300; // Force size
            canvas.height = 300;
            drawWheel(0);
        }
    }, 100);
    
    const spinBtn = document.getElementById('btn-spin-wheel');
    spinBtn.onclick = (e) => {
        e.stopPropagation();
        playSound('click');
        spinWheel(eventId);
    };
}

function drawWheel(angle = 0) {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = canvas.width / 2;
    const sliceAngle = (Math.PI * 2) / wheelPrizes.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    wheelPrizes.forEach((p, i) => {
        const start = angle + i * sliceAngle;
        const end = start + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(p.text, radius - 20, 5);
        ctx.restore();
    });
}

function spinWheel(eventId) {
    if (isSpinning) return;
    
    // Check account status
    if (!STATE.currentUser || STATE.currentUser.isGuest) {
        showToast("보상 수령을 위해 먼저 로그인해 주세요! (게스트 참여 불가)", "warning");
        return;
    }

    // Check if already spun
    const lastSpin = localStorage.getItem('last_spin_' + eventId + '_' + STATE.currentUser.uid);
    if (lastSpin) {
        showToast("이 이벤트는 이미 참여하셨습니다!", "info");
        return;
    }

    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) {
        showToast("데이터 오류: 돌림판을 찾을 수 없습니다.", "error");
        return;
    }

    playSound('click');
    isSpinning = true;
    
    const spins = 7 + Math.random() * 5; // More spins for dramatic effect
    const totalRotation = spins * 360;
    const duration = 5000; // 5 seconds
    const start = performance.now();

    function animate(time) {
        const elapsed = time - start;
        const t = Math.min(elapsed / duration, 1);
        
        // Easing out cubic
        const easeOut = 1 - Math.pow(1 - t, 3);
        const rotation = easeOut * totalRotation;
        
        drawWheel((rotation * Math.PI) / 180);

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            // Calculate prize based on final rotation
            const finalAngle = (rotation % 360);
            const prizeIdx = Math.floor(((360 - (finalAngle + 90) % 360) % 360) / (360 / wheelPrizes.length));
            const win = wheelPrizes[prizeIdx];
            
            showWinnerModal(win, eventId);
        }
    }
    
    requestAnimationFrame(animate);
}

function showWinnerModal(win, eventId) {
    if (win.reward > 0) {
        STATE.currentUser.coins += win.reward;
        showToast(`축하합니다! ${win.text}을 획득했습니다! 🎁`, "success");
    } else if (win.diamonds > 0) {
        STATE.currentUser.diamonds = (STATE.currentUser.diamonds || 0) + win.diamonds;
        showToast(`대박! 다이아몬드 ${win.diamonds}개를 획득했습니다! 💎`, "success");
    } else {
        showToast("아쉽네요! 다음 기회에... 😢", "info");
    }
    
    saveData();
    localStorage.setItem('last_spin_' + eventId + '_' + STATE.currentUser.uid, Date.now());
    setTimeout(() => {
        document.getElementById('wheel-modal').classList.add('hidden');
    }, 2000);
}

function deleteAnnComment(postId, commentId) {
    if (confirm('댓글을 삭제하시겠습니까?')) {
        db.ref(`announcements/${postId}/comments/${commentId}`).remove().catch(e => {
            showToast('댓글 삭제 실패: ' + e.message, 'error');
        });
    }
}

const btnAnnouncements = document.getElementById('btn-announcements');
if (btnAnnouncements) {
    btnAnnouncements.addEventListener('click', () => {
        playSound('click');
        app.showScreen('ann-list-screen');
        renderAnnouncements();
    });
}

const btnNewAnn = document.getElementById('btn-new-announcement');
if (btnNewAnn) {
    btnNewAnn.addEventListener('click', () => {
        const modal = document.getElementById('ann-create-modal');
        if (modal) {
            document.getElementById('new-ann-title').value = '';
            document.getElementById('new-ann-content').value = '';
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('show'), 10);
            const panel = modal.querySelector('.glass-panel');
            if (panel) panel.style.transform = 'scale(1)';
        }
    });
}

function addVoteOptionField(val = '') {
    const list = document.getElementById('new-ann-vote-options-list');
    if (!list) return;
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.innerHTML = `
        <input type="text" class="vote-opt-input" placeholder="옵션 이름" value="${val}" style="flex:1; padding:12px; background:rgba(0,0,0,0.5); border:1px solid #444; color:#fff; border-radius:8px; font-size:0.95rem;">
        <button class="btn" style="background:rgba(255,82,82,0.2); color:#ff5252; padding:0 12px; border:1px solid rgba(255,82,82,0.3); border-radius:8px;" onclick="this.parentElement.remove()">✕</button>
    `;
    list.appendChild(div);
}

function applyVoteTemplate(theme) {
    const list = document.getElementById('new-ann-vote-options-list');
    list.innerHTML = '';
    const templates = {
        'content': ['신규 무기', '신규 맵', '신규 펫', '신규 코스튬'],
        'gameplay': ['최적화 강화', '밸런스 패치', 'UI/UX 개선', '버그 수정'],
        'event': ['퀴즈 대항전', '보물찾기', '생존 왕 선발', '낚시 대회'],
        'custom': ['', '']
    };
    if (templates[theme]) {
        templates[theme].forEach(opt => addVoteOptionField(opt));
    }
}

const btnSubmitAnn = document.getElementById('btn-submit-ann');
if (btnSubmitAnn) {
    btnSubmitAnn.addEventListener('click', () => {
        const type = document.getElementById('new-ann-type').value;
        const title = document.getElementById('new-ann-title').value.trim();
        const content = document.getElementById('new-ann-content').value.trim();
        const hasWheel = document.getElementById('new-ann-has-wheel').checked;
        
        let voteOptions = null;
        if (type === 'event') {
            const inputs = document.querySelectorAll('.vote-opt-input');
            voteOptions = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
            if (voteOptions.length === 0) voteOptions = null;
        }

        if (!title || !content) {
            showToast('제목과 내용을 모두 입력해주세요.', 'error');
            return;
        }

        const isOnline = db;
        if (isOnline) {
            const id = 'ann_' + Date.now();
            const postData = {
                id: id,
                type: type,
                title: title,
                content: content,
                author: STATE.currentUser.username,
                time: Date.now(),
                hasWheel: hasWheel
            };
            if (voteOptions) postData.voteOptions = voteOptions;

            db.ref('announcements/' + id).set(postData).then(() => {
                showToast('공지가 성공적으로 등록되었습니다.', 'success');
                const modal = document.getElementById('ann-create-modal');
                if (modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.classList.add('hidden'), 300);
                    modal.style.display = 'none';
                    // Reset field
                    document.getElementById('new-ann-vote-options-list').innerHTML = '';
                    document.getElementById('new-ann-vote-theme').value = '';
                    document.getElementById('new-ann-has-wheel').checked = false;
                }
            }).catch(e => {
                showToast('공지 등록 실패: ' + e.message, 'error');
            });
        } else {
            showToast('현재 오프라인 모드라 공지를 쓸 수 없습니다.', 'error');
        }
    });
}

const annForm = document.getElementById('ann-comment-form');
if (annForm) {
    annForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('ann-comment-input');
        const text = input.value.trim();
        if (!text || !currentAnnId) return;

        const isOnline = db; // allow db attempt even if auth is bypassed
        if (isOnline) {
            const cId = 'com_' + Date.now() + Math.random().toString(36).substr(2, 4);
            db.ref('announcements/' + currentAnnId + '/comments/' + cId).set({
                id: cId,
                author: STATE.currentUser.username,
                text: text,
                time: Date.now()
            }).then(() => {
                input.value = '';
            }).catch(e => {
                showToast('댓글 등록 실패: ' + e.message, 'error');
            });
        } else {
            showToast('오프라인 모드에서는 댓글을 쓸 수 없습니다.', 'warning');
        }
    });
}

// --- GLOBAL NOTIFICATIONS ---
let lastNotifTime = Date.now();
function initGlobalNotifications() {
    if (!db) return;
    db.ref('global_notifications').limitToLast(1).on('child_added', (snap) => {
        const data = snap.val();
        if (!data) return;
        // Only show if it's new (not old history on load)
        if (data.timestamp > lastNotifTime) {
            showToast(`📣 [서버 공지] ${data.message}`, data.type || 'info');
            playSound('level-up'); // Notification sound
        }
    });
}

const renderNotificationHistory = () => {
    const listEl = document.getElementById('notif-history-list');
    if (!listEl || !db) return;

    listEl.innerHTML = '<div style="text-align:center; padding: 20px; color: #aaa;">불러오는 중...</div>';
    
    db.ref('global_notifications').limitToLast(30).once('value').then(snap => {
        const data = snap.val();
        if (!data) {
            listEl.innerHTML = '<div style="text-align:center; color:#666; padding: 40px 0;">최근 알림이 없습니다.</div>';
            return;
        }

        const list = Object.values(data).sort((a,b) => b.timestamp - a.timestamp);
        listEl.innerHTML = '';
        
        list.forEach(n => {
            const date = new Date(n.timestamp);
            const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
            const colors = { 'info': '#00e5ff', 'warning': '#ff5252', 'success': '#00ff88' };
            const borderColor = colors[n.type] || '#444';
            
            const div = document.createElement('div');
            div.style.cssText = `background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; border-left: 4px solid ${borderColor};`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.8rem; color:#aaa;">
                    <span>📣 ${n.sender || 'System'}</span>
                    <span>${timeStr}</span>
                </div>
                <div style="color:#fff; line-height:1.4; font-size:0.95rem;">${n.message}</div>
            `;
            listEl.appendChild(div);
        });
    });
};

document.getElementById('btn-notif-center').addEventListener('click', () => {
    playSound('click');
    app.showScreen('notif-center-screen');
    renderNotificationHistory();
});

// Initial Setup
setTimeout(() => {
    // Show login screen by default on load
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-screen').classList.remove('hidden');
    initGlobalNotifications();
}, 100);
