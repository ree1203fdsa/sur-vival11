// ui.js - 오디오, 알림 및 화면 관리 로직
let audioCtx = null;

// 사운드 재생 함수
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
                osc.start(now); osc.stop(now + 0.1);
                break;
            case 'success':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
                break;
            case 'error':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.3);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
                break;
        }
    } catch (e) { console.warn("오디오 시스템 오류", e); }
};

// 토스트 알림 표시
const showToast = (message, type = 'info') => {
    if (type === 'error') playSound('error');
    else if (type === 'success') playSound('success');
    
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
};

// 화면 전환 함수
const showScreen = (screenId) => {
    if (screenId === 'menu-screen' || screenId === 'os-layer') {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const osLayer = document.getElementById('os-layer');
        if (osLayer) { osLayer.classList.remove('hidden'); osLayer.classList.add('active'); }
        if (STATE.currentUser) {
            const startUserEl = document.getElementById('start-username');
            if (startUserEl) startUserEl.textContent = STATE.currentUser.username;
            updateUI();
        }
        return;
    }

    document.querySelectorAll('.screen').forEach(el => {
        if (el.id !== screenId) { el.classList.remove('active'); el.classList.add('hidden'); }
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        setTimeout(() => { target.classList.add('active'); if (screenId === 'menu-screen') updateUI(); }, 10);
    }
};

// UI 데이터 동기화
const updateUI = () => {
    if (!STATE.currentUser) return;
    const user = STATE.currentUser;
    const isAD = user.role === 'admin' || user.role === 'creator';
    
    const elements = {
        'current-username': user.username,
        'coin-amount': isAD ? '무제한' : (user.coins || 0).toLocaleString(),
        'diamond-amount': isAD ? '무제한' : (user.diamonds || 0).toLocaleString(),
    };

    for (let id in elements) {
        const el = document.getElementById(id);
        if (el) el.textContent = elements[id];
    }
    
    
    // 관리자 버튼 표시 여부
    const adminBtn = document.getElementById('btn-admin');
    if (adminBtn) {
        if (isAD) adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
        adminBtn.onclick = () => app.openWindow('win-admin');
    }
    
    // 작업표시줄 등 업데이트
    if (window.app && app.updateTaskbar) app.updateTaskbar();
};

window.playSound = playSound;
window.showToast = showToast;
window.showScreen = showScreen;
window.updateUI = updateUI;
