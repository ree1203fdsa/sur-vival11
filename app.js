// app.js - 메인 실행 파일 및 초기화
// (v157: 모듈화 아키텍처 및 한국어 주석 적용)

document.addEventListener('DOMContentLoaded', () => {
    // 1. 파이어베이스 초기화 (설정된 경우)
    if (FIREBASE_ENABLED && typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        
        // 실시간 접속자 수 카운터
        db.ref('presence').on('value', (snap) => {
            const count = snap.val() ? Object.keys(snap.val()).length : 0;
            const el = document.getElementById('lobby-online-badge');
            if (el) el.textContent = `🟢 접속자: ${count}명`;
        });
        
        // 누적 방문자 수 카운터
        db.ref('stats/visitCount').on('value', (snap) => {
            const count = (snap.val() || 0) + 946;
            const el = document.getElementById('lobby-visit-badge');
            if (el) el.textContent = `📊 누적 방문: ${count.toLocaleString()}명`;
        });
    }

    // 2. 인증 및 UI 리스너 초기화
    if (window.initAuth) initAuth();
    
    // 3. 초기 테마 설정 (라이트/다크)
    if (STATE.settings.theme === 'light') {
        document.body.classList.add('light-mode');
    }

    // 4. 바탕화면 초기화
    if (app.updateDesktop) app.updateDesktop();

    // 5. OS 시계 실행
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clockEl = document.getElementById('os-clock');
        if (clockEl) clockEl.textContent = timeStr;
    }, 1000);

        // 전역 공지(브로드캐스트) 리스너
        db.ref('server/broadcast').on('value', snap => {
            const data = snap.val();
            if (data && Date.now() - data.timestamp < 10000) { // 10초 이내 새 공지만
                showToast(`[공지] ${data.message}`, 'success');
            }
        });

        // 점검 모드 감지 (관리자 제외)
        db.ref('server/maintenance').on('value', snap => {
            const isMain = snap.val();
            if (isMain && STATE.currentUser && STATE.currentUser.role !== 'admin' && STATE.currentUser.username !== 'jur1203') {
                alert("서버 점검 중입니다. 잠시 후 다시 시도해주세요.");
                location.reload();
            }
        });

        // 실시간 사용자 상태(차단 등) 모니터링
        if (STATE.currentUser && db) {
            db.ref(`users/${STATE.currentUser.uid}/restrictions`).on('value', snap => {
                const res = snap.val() || {};
                if (res.banned) {
                    alert("🚫 당신의 계정이 관리자에 의해 영구 차단되었습니다.");
                    app.logout();
                }
                // 실시간 로컬 데이터 갱신
                if (STATE.currentUser) STATE.currentUser.restrictions = res;
            });
        }

        console.log("Juram OS 모듈 시스템 v157 초기화 완료.");
});
