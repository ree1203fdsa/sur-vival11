// os.js - 주람 OS 창 관리 및 바탕화면 로직
const app = window.app = {
    activeWindows: new Set(),
    windowConfigs: {
        'win-play': { title: '생존 시작', icon: '⛺', screenId: 'menu-screen' },
        'win-shop': { title: '상점', icon: '💰', screenId: 'shop-screen' },
        'win-chat': { title: '전체 채팅', icon: '💬', screenId: 'chat-screen' },
        'win-quests': { title: '퀘스트', icon: '📜', screenId: 'quest-screen' },
        'win-admin': { title: '관리자 모드', icon: '🛡️', screenId: 'admin-screen' },
        'win-settings': { title: '설정', icon: '⚙️', screenId: 'settings-screen' },
        'win-store': { title: '주람 스토어', icon: '🛍️', screenId: 'store-screen' },
        'win-browser': { title: 'PlayTech 브라우저', icon: '🌐', screenId: 'browser-screen' },
        'win-scanner': { title: '쾌속 로그인', icon: '📷', screenId: 'scanner-screen' },
        'win-mail': { title: 'RamMail', icon: '📧', screenId: 'rammail-screen' }
    },
    // 테마 설정
    setTheme: (theme) => {
        if (!theme) theme = 'dark';
        STATE.settings.theme = theme;
        if (theme === 'light') document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
        localStorage.setItem('juram_theme', theme);
        if (STATE.currentUser && db) db.ref(`users/${STATE.currentUser.uid}/settings/theme`).set(theme);
    },
    // 언어 설정
    setLanguage: (lang) => {
        if (!lang) lang = 'ko';
        STATE.settings.language = lang;
        localStorage.setItem('juram_lang', lang);
        showToast(lang === 'ko' ? '언어가 변경되었습니다.' : 'Language changed.', 'success');
        app.updateDesktop();
    },
    // 창 열기
    openWindow: (winId) => {
        if (STATE.currentUser && STATE.currentUser.restrictions) {
            const res = STATE.currentUser.restrictions;
            if (winId === 'win-store' && res.noStore) {
                return showToast('🚫 스토어 접근 권한이 정지되었습니다.', 'error');
            }
        }

        if (app.activeWindows.has(winId)) { app.focusWindow(winId); return; }
        const config = app.windowConfigs[winId];
        if (!config) return;

        const winEl = document.createElement('div');
        winEl.id = winId;
        winEl.className = 'window';
        winEl.innerHTML = `
            <div class="window-header" onmousedown="app.startDragWindow(event, '${winId}')">
                <div class="window-title">${config.icon} ${config.title}</div>
                <div class="window-controls">
                    <div class="window-ctrl close" onclick="app.closeWindow('${winId}')">×</div>
                </div>
            </div>
            <div class="window-content" id="${winId}-content"></div>
        `;
        document.getElementById('window-layer').appendChild(winEl);
        app.activeWindows.add(winId);
        app.focusWindow(winId);
        app.updateTaskbar();

        const screenEl = document.getElementById(config.screenId);
        if (screenEl) {
            document.getElementById(`${winId}-content`).appendChild(screenEl);
            screenEl.classList.remove('hidden');
            screenEl.classList.add('active');
        }

        // 스토어 열 때 데이터베이스 연결
        if (winId === 'win-store') app.initStore();
        // 스캐너 열 때 카메라 구동
        if (winId === 'win-scanner') setTimeout(() => app.startScanner(), 500);
        // 메일 열 때 로딩
        if (winId === 'win-mail') app.switchMailView('inbox');
        // 관리자 열 때 데이터 로드
        if (winId === 'win-admin') app.loadAdminData();
    },
    // 창 닫기
    closeWindow: (winId) => {
        const winEl = document.getElementById(winId);
        if (winEl) {
            const config = app.windowConfigs[winId];
            const screenEl = document.getElementById(config.screenId);
            if (screenEl) { document.body.appendChild(screenEl); screenEl.classList.add('hidden'); }
            winEl.remove();
            app.activeWindows.delete(winId);
            app.updateTaskbar();
        }
    },
    // 창에 포커스 주기
    focusWindow: (winId) => {
        document.querySelectorAll('.window').forEach(w => w.classList.remove('focused', 'active'));
        const winEl = document.getElementById(winId);
        if (winEl) { winEl.classList.add('focused', 'active'); winEl.style.display = 'flex'; }
        app.updateTaskbar();
    },
    // 작업표시줄 업데이트
    updateTaskbar: () => {
        const container = document.getElementById('taskbar-items');
        if (!container) return;
        container.innerHTML = '';
        app.activeWindows.forEach(winId => {
            const config = app.windowConfigs[winId];
            const item = document.createElement('div');
            item.className = 'taskbar-item active';
            item.innerHTML = `<span>${config.icon}</span>`;
            item.onclick = () => app.focusWindow(winId);
            container.appendChild(item);
        });
    },
    // 시작 메뉴 토글
    toggleStartMenu: () => {
        const menu = document.getElementById('start-menu');
        if (menu) menu.classList.toggle('active');
    },
    // ---- [ ANDROID NAVIGATION FUNCTIONS ] ---- //
    closeAllWindows: () => {
        // [HOME BUTTON]
        document.querySelectorAll('.window').forEach(w => w.classList.add('hidden'));
        app.toggleStartMenu(); // Hide start menu if open
        const menu = document.getElementById('start-menu');
        if(menu) menu.classList.remove('active');
    },
    closeTopWindow: () => {
        // [BACK BUTTON]
        // Get all visible windows and close the top-most one (highest z-index or last in DOM)
        const visibleWindows = Array.from(document.querySelectorAll('.window:not(.hidden)'));
        if (visibleWindows.length > 0) {
            visibleWindows.sort((a,b) => (parseInt(a.style.zIndex||0) - parseInt(b.style.zIndex||0)));
            visibleWindows.pop().classList.add('hidden'); // Close the top one
        } else {
            // If no windows, maybe close start menu
            const menu = document.getElementById('start-menu');
            if(menu) menu.classList.remove('active');
        }
    },
    // ---- [ SETTINGS FUNCTIONS ] ---- //
    downloadLanguage: (langName) => {
        showToast(`${langName} 언어 팩 파일을 서버에서 다운로드합니다... (0%)`, 'info');
        setTimeout(() => {
            showToast(`${langName} 다운로드 중... (45%)`, 'info');
            setTimeout(() => {
                showToast(`${langName} 언어 팩 적용 완료! 시스템 재시작 대기중.`, 'success');
            }, 1500);
        }, 1500);
    },
    // ---- [ QR CROSS-DEVICE LOGIN ] ---- //
    qrListener: null,
    showQRLogin: () => {
        const modal = document.getElementById('qr-scan-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        
        // 1. 보안용 실시간 고유 토큰 생성
        const qrToken = 'qr_' + Date.now() + '_' + Math.floor(Math.random()*10000);
        const loginUrl = window.location.origin + window.location.pathname + '?qrToken=' + qrToken;
        
        // 2. 화면에 표시할 QR 이미지 업데이트 (설정된 URL 포함)
        document.getElementById('qr-img').src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(loginUrl);
        
        // 3. 애니메이션 시작
        let isDown = true;
        const line = document.getElementById('qr-scan-line');
        const interval = setInterval(() => {
            line.style.top = isDown ? '200px' : '0px';
            isDown = !isDown;
        }, 1000);

        // 4. 파이어베이스 실시간 대기열 개통
        if (typeof db !== 'undefined' && db) {
            db.ref('qr_auth/' + qrToken).set({ status: 'pending' });
            
            // 승인 여부 실시간 리스너 장착
            app.qrListener = db.ref('qr_auth/' + qrToken).on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.status === 'approved' && data.user) {
                    clearInterval(interval);
                    modal.style.display = 'none';
                    
                    // 기기 동기화 성공! 다른 기기(폰)에서 보낸 계정 정보로 로그인
                    STATE.currentUser = data.user;
                    saveData(); updateUI(); app.updateDesktop(); showScreen('menu-screen');
                    showToast(`📷 모바일 연동 완료! 환영합니다, ${data.user.username}님!`, 'success');
                    
                    // 보안을 위해 리스너 해제 및 디비 파기
                    db.ref('qr_auth/' + qrToken).off('value', app.qrListener);
                    db.ref('qr_auth/' + qrToken).remove();
                }
            });
        } else {
            showToast("네트워크 데이터베이스 연결이 끊겨 QR 생성에 실패했습니다.", "error");
            modal.style.display = 'none';
            clearInterval(interval);
        }
        
        // 5. 모달 닫기 버튼 이벤트 재할당 (리스너 클리어)
        document.getElementById('btn-close-qr').onclick = () => {
            modal.style.display = 'none';
            clearInterval(interval);
            if (typeof db !== 'undefined' && db && app.qrListener) db.ref('qr_auth/' + qrToken).off('value', app.qrListener);
        };
    },
    // ---- [ QR SCANNER APP LOGIC ] ---- //
    html5QrCode: null,
    startScanner: () => {
        if (!document.getElementById("qr-reader")) return;
        app.html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 15, qrbox: { width: 250, height: 250 } };
        
        app.html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            (decodedText) => {
                // QR 코드 인식 성공 시
                app.stopScanner();
                app.closeWindow('win-scanner');
                
                if (decodedText.includes('qrToken=')) {
                    showToast("로그인 QR 감지! 승인 중...", "info");
                    try {
                        const url = new URL(decodedText);
                        const token = url.searchParams.get('qrToken');
                        if (token && typeof db !== 'undefined' && db && STATE.currentUser) {
                            db.ref('qr_auth/' + token).set({
                                status: 'approved',
                                user: STATE.currentUser
                            }).then(() => {
                                showToast("로그인 승인 완료! 다른 기기에서 접속됩니다.", "success");
                            });
                        } else if (!STATE.currentUser) {
                            showToast("로그인이 되어있지 않아 승인할 수 없습니다.", "error");
                        }
                    } catch(e) {
                        showToast("잘못된 QR 데이터입니다.", "error");
                    }
                } else {
                    showToast("서바이벌 로그인용 QR이 아닙니다.", "warning");
                }
            },
            (errorMessage) => { /* 스캔 중 에러는 무시 (반복 실행됨) */ }
        ).catch((err) => {
            showToast("카메라 권한이 없거나 장치를 찾을 수 없습니다.", "error");
            console.error(err);
        });
    },
    stopScanner: () => {
        if (app.html5QrCode) {
            app.html5QrCode.stop().then(() => {
                app.html5QrCode = null;
                const reader = document.getElementById("qr-reader");
                if (reader) reader.innerHTML = "";
            }).catch(err => console.error("스캐너 정지 오류", err));
        }
    },
    // ---- [ RAMMAIL SYSTEM ] ---- //
    switchMailView: (view) => {
        const views = ['mail-list-view', 'mail-compose-view', 'mail-read-view'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if(el) el.classList.add('hidden');
        });
        const target = document.getElementById(`mail-${view}-view`);
        if(target) target.classList.remove('hidden');
        
        // Update nav active state
        document.querySelectorAll('.mail-nav-item').forEach(item => {
            const onclick = item.getAttribute('onclick');
            if (onclick && onclick.includes(view)) {
                item.classList.add('active');
                item.style.background = '#feebeb';
            } else {
                item.classList.remove('active');
                item.style.background = 'transparent';
            }
        });
        
        if (view === 'inbox' || view === 'sent') app.loadMails(view);
    },
    sendMail: () => {
        const to = document.getElementById('mail-to').value.trim();
        const subject = document.getElementById('mail-subject').value.trim();
        const body = document.getElementById('mail-body').value.trim();
        
        if (!to || !subject || !body) {
            showToast("모든 항목을 입력해주세요.", "error");
            return;
        }
        
        if (typeof db === 'undefined' || !db) { showToast("데이터베이스 연결이 없습니다.", "error"); return; }
        
        showToast("메일 전송 중...", "info");
        db.ref('users').once('value').then(snap => {
            const users = snap.val() || {};
            const recipientEntry = Object.entries(users).find(([uid, data]) => data.username === to);
            
            if (!recipientEntry) {
                showToast("해당 아이디를 가진 사용자가 없습니다.", "error");
                return;
            }
            
            const recipientUid = recipientEntry[0];
            const mailData = {
                sender: STATE.currentUser.username,
                recipient: to,
                subject,
                body,
                timestamp: Date.now(),
                read: false
            };
            
            // Send to recipient's inbox
            db.ref(`rammail/${recipientUid}/inbox`).push(mailData);
            // Save to sender's sent box
            db.ref(`rammail/${STATE.currentUser.uid}/sent`).push(mailData);
            
            showToast(`${to}님께 메일을 보냈습니다!`, "success");
            app.switchMailView('sent');
        }).catch(err => showToast("서버 오류: " + err.message, "error"));
    },
    loadMails: (folder = 'inbox') => {
        const container = document.getElementById('mail-items-container');
        if(!container) return;
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">로딩 중...</div>';
        
        if (typeof db === 'undefined' || !db || !STATE.currentUser) return;
        
        db.ref(`rammail/${STATE.currentUser.uid}/${folder}`).once('value').then(snap => {
            const mails = snap.val() || {};
            const mailArr = Object.entries(mails).map(([id, data]) => ({ id, ...data }));
            mailArr.sort((a,b) => b.timestamp - a.timestamp);
            
            container.innerHTML = '';
            if (mailArr.length === 0) {
                container.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">표시할 메일이 없습니다.</div>';
                return;
            }
            
            mailArr.forEach(m => {
                const item = document.createElement('div');
                item.style.cssText = `padding: 15px 25px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center; background: ${(!m.read && folder==='inbox') ? '#f2f6ff' : 'white'}; transition: background 0.2s;`;
                item.onmouseover = () => item.style.background = '#f1f3f4';
                item.onmouseout = () => item.style.background = (!m.read && folder==='inbox') ? '#f2f6ff' : 'white';
                item.onclick = () => app.readMail(m, folder);
                
                const date = new Date(m.timestamp).toLocaleDateString();
                item.innerHTML = `
                    <div style="width: 140px; font-weight: 800; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${folder === 'inbox' ? m.sender : '받는이: ' + m.recipient}</div>
                    <div style="flex: 1; font-weight: ${(!m.read && folder==='inbox') ? '800' : '400'}; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.subject}</div>
                    <div style="width: 100px; text-align: right; color: #9aa0a6; font-size: 0.82rem;">${date}</div>
                `;
                container.appendChild(item);
            });
        }).catch(err => {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: #ff5252;">데이터 로드 실패</div>';
        });
    },
    readMail: (mail, folder) => {
        app.switchMailView('read');
        document.getElementById('read-mail-subject').textContent = mail.subject;
        document.getElementById('read-mail-sender').textContent = folder === 'inbox' ? mail.sender : `받는이: ${mail.recipient}`;
        document.getElementById('read-mail-date').textContent = new Date(mail.timestamp).toLocaleString();
        document.getElementById('read-mail-body').textContent = mail.body;
        
        // Mark as read in DB
        if (folder === 'inbox' && !mail.read && typeof db !== 'undefined' && db) {
            db.ref(`rammail/${STATE.currentUser.uid}/inbox/${mail.id}`).update({ read: true });
        }
    },
    // 바탕화면 아이콘 업데이트
    updateDesktop: () => {
        const desktopEl = document.getElementById('desktop');
        if (!desktopEl) return;
        let adminIcon = '';
        if (STATE.currentUser && (STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'creator' || (STATE.currentUser.username && STATE.currentUser.username.toLowerCase() === 'jur1203'))) {
            adminIcon = `
            <div class="desktop-icon" onclick="app.openWindow('win-admin'); app.loadAdminUsers();">
                <div class="icon" style="text-shadow: 0 0 10px #ff5252;">🛡️</div>
                <div class="label" style="color:#ffbaba; font-weight: bold;">마스터 제어 센터</div>
            </div>`;
        }
        
        desktopEl.innerHTML = `
            <div class="desktop-icon" onclick="app.openWindow('win-store')">
                <div class="icon">🛍️</div>
                <div class="label">주람 스토어</div>
            </div>
            <div class="desktop-icon" onclick="app.openWindow('win-browser')">
                <div class="icon">🌐</div>
                <div class="label" style="line-height:1.2;">PlayTech 브라우저</div>
            </div>
            <div class="desktop-icon" onclick="app.openWindow('win-scanner')">
                <div class="icon" style="filter: drop-shadow(0 0 5px #64b5f6);">📷</div>
                <div class="label">쾌속 로그인</div>
            </div>
            <div class="desktop-icon" onclick="app.openWindow('win-mail')">
                <div class="icon" style="filter: drop-shadow(0 0 8px rgba(234, 67, 53, 0.4));">📧</div>
                <div class="label">RamMail</div>
            </div>
            ${adminIcon}
        `;
    },
    // 설정 탭 프론트엔드 액션
    switchSettingsTab: (tabId) => {
        // Hide all tabs
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.add('hidden'));
        const target = document.getElementById(`set-tab-${tabId}`);
        if (target) target.classList.remove('hidden');
        
        // Update Sidebar Active Style
        document.querySelectorAll('.settings-item').forEach(item => {
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`('${tabId}')`)) {
                item.style.background = 'rgba(255,255,255,0.05)';
                item.style.color = '#fff';
            } else {
                item.style.background = 'transparent';
                item.style.color = '#ccc';
            }
        });

        if (tabId === 'parental') app.updateParentalUI();
    },
    // 전체화면 토글
    toggleFullScreen: () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    },
    // 상점 스토어 동기화 및 초기화
    initStore: () => {
        if (!app.storeInitialized && typeof db !== 'undefined' && db) {
            // Firebase Realtime DB에서 앱 실시간 목록 가져오기
            db.ref('store_apps').on('value', (snap) => {
                const apps = snap.val() || {};
                const listEl = document.getElementById('store-app-list');
                if (!listEl) return;
                listEl.innerHTML = ''; // 초기화
                Object.keys(apps).reverse().forEach(key => { // 최신순
                    const appData = apps[key];
                    const card = document.createElement('div');
                    card.className = 'glass-panel';
                    card.style.cssText = 'padding: 20px; text-align: left; background: rgba(255,255,255,0.05); border-radius: 12px; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
                    card.onmouseover = () => card.style.transform = 'translateY(-5px)';
                    card.onmouseout = () => card.style.transform = 'translateY(0)';
                    
                    const emj = appData.category === '게임' ? '🎮' : appData.category === '엔터테인먼트' ? '🎬' : '🛠️';
                    card.innerHTML = `
                        <div style="font-size: 2.8rem; margin-bottom: 12px; height: 60px; display:flex; align-items:center;">${emj}</div>
                        <h3 style="font-size: 1.25rem; font-weight: 800; color:#fff; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${appData.title}</h3>
                        <p style="color: #68f7b5; font-size: 0.85rem; font-weight:600; margin-bottom: 15px;">👤 ${appData.creator} <span style="color:#aaa; font-weight:400;">• ${appData.category}</span></p>
                        <button class="btn primary" onclick="app.secureStoreOpen('${appData.url}')" style="border-radius: 8px; font-weight: 800; width: 100%; border: none; padding: 12px;">다운로드 (실행)</button>
                    `;
                    listEl.appendChild(card);
                });
            });
            app.storeInitialized = true;
        }
        
        // 권한에 따른 내 앱 등록 / 구매 버튼 표시
        if (STATE.currentUser) {
            const isCr = STATE.currentUser.role === 'creator' || STATE.currentUser.role === 'admin';
            const addBtn = document.getElementById('store-btn-add-app');
            const buyPanel = document.getElementById('store-buy-perk-panel');
            if (addBtn) {
                if (isCr) addBtn.classList.remove('hidden');
                else addBtn.classList.add('hidden');
            }
            if (buyPanel) {
                if (isCr) buyPanel.style.display = 'none';
                else buyPanel.style.display = 'flex';
            }
        }
    },
    // 상점 등록 팝업 제어
    openStoreRegister: () => {
        document.getElementById('store-list-view').classList.add('hidden');
        document.getElementById('store-register-form').classList.remove('hidden');
    },
    cancelStoreRegister: () => {
        document.getElementById('store-register-form').classList.add('hidden');
        document.getElementById('store-list-view').classList.remove('hidden');
    },
    // 상점 권한 구입
    buyPromotePerk: () => {
        if (!STATE.currentUser) return showToast('로그인이 필요합니다.', 'error');
        if (STATE.currentUser.coins < 300) return showToast('코인이 부족합니다! (300 코인 필요)', 'error');
        
        STATE.currentUser.coins -= 300;
        STATE.currentUser.role = 'creator';
        saveData(); updateUI(); app.initStore();
        showToast('🎉 크리에이터 권한 획득! 앱을 등록해보세요.', 'success');
    },
    // 파이어베이스 DB에 스토어 앱 업로드 (전 기기 동기화)
    registerApp: () => {
        if (!STATE.currentUser || STATE.currentUser.role !== 'creator') return showToast('크리에이터가 아닙니다.', 'error');
        const title = document.getElementById('store-app-title').value.trim();
        const cat = document.getElementById('store-app-category').value;
        const url = document.getElementById('store-app-url').value.trim();
        
        if (!title || !url) return showToast('이름과 URL을 모두 입력해주세요.', 'error');
        if (title.length > 20) return showToast('이름이 너무 깁니다.', 'error');
        if (!url.startsWith('http')) return showToast('http 또는 https로 시작하는 URL을 입력해주세요.', 'error');
        
        if (db) {
            showToast('데이터베이스에 업로드 중...', 'info');
            db.ref('store_apps').push({
                title: title, category: cat, url: url, 
                creator: STATE.currentUser.username, timestamp: Date.now()
            }).then(() => {
                showToast('🚀 앱 업로드 완료! 모든 사람의 스토어에 추가되었습니다.', 'success');
                app.cancelStoreRegister();
                document.getElementById('store-app-title').value = '';
                document.getElementById('store-app-url').value = '';
            }).catch(e => showToast('서버 오류: ' + e.message, 'error'));
        } else {
            showToast('데이터베이스 참조를 찾을 수 없습니다.', 'error');
        }
    },
    // 브라우저 네비게이션 엔진
    navigateBrowser: (query) => {
        if (!query.trim()) return;
        document.getElementById('browser-home').style.display = 'none';
        document.getElementById('browser-results').classList.remove('hidden');
        document.getElementById('browser-address').value = query;
        
        const listEl = document.getElementById('browser-results-list');
        listEl.innerHTML = `<div style="text-align:center; padding: 50px;"><p style="font-size: 1.2rem; font-weight:600; color:#34A853;">"${query}" 찾는 중...</p></div>`;
        
        setTimeout(() => {
            if (query.startsWith('http')) {
                listEl.innerHTML = `<iframe src="${query}" style="width:100%; height:80vh; border:none; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);"></iframe>`;
            } else {
                listEl.innerHTML = `
                    <div style="font-size:0.9rem; color:#70757a; margin-bottom: 20px;">검색 결과 약 1,240개</div>
                    <div style="margin-bottom: 30px;">
                        <a href="#" onclick="window.app.navigateBrowser('https://ko.wikipedia.org/wiki/${query}')" style="font-size: 1.2rem; color: #1a0dab; text-decoration: none; font-weight:600;">${query} - 위키백과</a><br>
                        <span style="color: #006621; font-size: 0.85rem;">https://ko.wikipedia.org/wiki/${query}</span>
                        <p style="color: #4d5156; font-size: 0.95rem; margin-top:5px;">${query}에 대한 위키백과 문서입니다...</p>
                    </div>
                `;
            }
        }, 1000);
    },
    // ---- [ MASTER ADMIN MODULE ] ---- //
    loadAdminUsers: () => {
        if (!STATE.currentUser || (STATE.currentUser.role !== 'admin' && STATE.currentUser.username !== 'jur1203')) return;
        if (typeof db === 'undefined' || !db) return showToast('데이터베이스에 연결할 수 없습니다. 온라인 상태인지 확인하세요.', 'error');
        
        showToast('유저 데이터베이스를 불러오는 중...', 'info');
        db.ref('users').once('value').then(snap => {
            const users = snap.val() || {};
            app.adminUserCache = users; // 로컬 임시저장
            app.renderAdminUserList();
        });
    },
    renderAdminUserList: () => {
        const users = app.adminUserCache;
        if (!users) return;
        
        const listEl = document.getElementById('admin-user-list');
        const cntEl = document.getElementById('admin-user-count');
        const filterEl = document.getElementById('admin-user-filter');
        if (!listEl) return;
        
        listEl.innerHTML = '';
        let filterVal = filterEl ? filterEl.value : 'default';
        
        // 객체를 배열로 변환
        let userArr = Object.keys(users).map(uid => ({ uid, ...users[uid] }));
        
        // 필터링 적용 (게스트 계정)
        if (filterVal === 'guest') {
            userArr = userArr.filter(u => u.isGuest === true || String(u.username).includes('게스트'));
        }
        
        // 정렬 적용
        if (filterVal === 'coins') {
            userArr.sort((a, b) => (b.coins || 0) - (a.coins || 0));
        } else if (filterVal === 'diamonds') {
            userArr.sort((a, b) => (b.diamonds || 0) - (a.diamonds || 0));
        } else if (filterVal === 'role') {
            const rW = { 'admin': 3, 'creator': 2, 'user': 1 };
            userArr.sort((a, b) => (rW[b.role || 'user'] || 1) - (rW[a.role || 'user'] || 1));
        } else {
            // 기본 (가입 최신순 등 뒤집기)
            userArr.reverse();
        }
        
        userArr.forEach(u => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 8px; margin-bottom: 5px;';
            div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
            div.onmouseout = () => div.style.background = 'transparent';
            div.onclick = () => app.selectAdminUser(u.uid, u);
            
            const isGuestBadge = (u.isGuest || String(u.username).includes('게스트')) ? '<span style="font-size:0.75rem; background:#444; padding:2px 6px; border-radius:4px; margin-left:6px;">게스트</span>' : '';
            
            div.innerHTML = `
                <div>
                    <div style="font-weight:800; color:#fff; font-size: 1.1rem; display:flex; align-items:center;">
                        ${u.username} ${isGuestBadge}
                    </div>
                    <div style="font-size:0.85rem; color:#aaa; margin-top: 4px;">
                        등급: <span style="color: ${u.role==='admin'?'#ff5252':u.role==='creator'?'#ffd700':'#64b5f6'}">${u.role || 'user'}</span> 
                        | 🪙 ${u.coins || 0} | 💎 ${u.diamonds || 0}
                    </div>
                </div>
                <div style="font-size:1.4rem;">⚙️</div>
            `;
            listEl.appendChild(div);
        });
        
        if(cntEl) cntEl.textContent = `(${userArr.length}명)`;
    },
    selectAdminUser: (uid, u) => {
        const panel = document.getElementById('admin-editor-panel');
        panel.style.display = 'flex';
        document.getElementById('admin-ed-title').textContent = `${u.username} 정보 수정`;
        document.getElementById('admin-ed-uid').value = uid;
        document.getElementById('admin-ed-role').value = u.role || 'user';
        document.getElementById('admin-ed-coins').value = u.coins || 0;
        document.getElementById('admin-ed-diamonds').value = u.diamonds || 0;
        
        // 제한 사항(Restrictions) 로드
        const res = u.restrictions || {};
        document.getElementById('admin-ed-ban').checked = res.banned || false;
        document.getElementById('admin-ed-nochat').checked = res.noChat || false;
        document.getElementById('admin-ed-nostore').checked = res.noStore || false;
        
        // 모바일 화면을 위해 부드럽게 스크롤 내리기
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    },
    saveAdminUser: () => {
        const uid = document.getElementById('admin-ed-uid').value;
        if (!uid || !db || !app.adminUserCache[uid]) return;
        
        const role = document.getElementById('admin-ed-role').value;
        const coins = parseInt(document.getElementById('admin-ed-coins').value) || 0;
        const dia = parseInt(document.getElementById('admin-ed-diamonds').value) || 0;
        
        const restrictions = {
            banned: document.getElementById('admin-ed-ban').checked,
            noChat: document.getElementById('admin-ed-nochat').checked,
            noStore: document.getElementById('admin-ed-nostore').checked
        };
        
        showToast('데이터 강제 덮어쓰기 중...', 'info');
        db.ref(`users/${uid}`).update({ 
            role: role, 
            coins: coins, 
            diamonds: dia,
            restrictions: restrictions 
        }).then(() => {
            showToast('데이터가 완벽히 수정되었습니다!', 'success');
            app.loadAdminUsers(); // 리스트 갱신
            document.getElementById('admin-editor-panel').style.display = 'none';
        });
    },
    deleteAdminUser: () => {
        const uid = document.getElementById('admin-ed-uid').value;
        const u = app.adminUserCache[uid];
        if (!uid || !db || !u) return;
        
        if (confirm(`진짜로 '${u.username}' 계정을 영구 삭제하시겠습니까?\n이 데이터는 다신 복구할 수 없습니다!!`)) {
            db.ref(`users/${uid}`).remove().then(() => {
                showToast(`💀 계정 '${u.username}' 영구 삭제 됨`, 'success');
                app.loadAdminUsers(); // 리스트 갱신
                document.getElementById('admin-editor-panel').style.display = 'none';
            });
        }
    },
    // 로그아웃
    logout: () => {
        if (confirm("로그아웃 하시겠습니까?")) {
            if (auth) auth.signOut();
            STATE.currentUser = null;
            location.reload();
        }
    },
    // ---- [ TOUCH GESTURES (ANDROID APP DRAWER) ] ---- //
    touchStartY: 0,
    initTouchGestures: () => {
        const layer = document.getElementById('os-layer');
        if (!layer) return;

        layer.addEventListener('touchstart', (e) => {
            app.touchStartY = e.touches[0].clientY;
        }, { passive: true });

        layer.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            const diffY = app.touchStartY - endY;

            // 위로 스와이프 (Android App Drawer 열기)
            if (diffY > 100) {
                const menu = document.getElementById('start-menu');
                if (menu && !menu.classList.contains('active')) {
                    app.toggleStartMenu(true);
                }
            }
            // 아래로 스와이프 (Drawer 닫기)
            if (diffY < -100) {
                const menu = document.getElementById('start-menu');
                if (menu && menu.classList.contains('active')) {
                    app.toggleStartMenu(false);
                }
            }
        }, { passive: true });
        
        console.log("모바일 스와이프 드로워 시스템 활성화됨.");
    },
    
    toggleStartMenu: (forceState) => {
        const menu = document.getElementById('start-menu');
        if (!menu) return;
        
        if (forceState === true) menu.classList.add('active');
        else if (forceState === false) menu.classList.remove('active');
        else menu.classList.toggle('active');
    },

    // ---- [ MASTER ADMIN EXTENSION ] ---- //
    switchAdminTab: (tabId) => {
        document.querySelectorAll('.admin-content-panel').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.admin-tab').forEach(t => {
            t.classList.remove('active');
            t.style.borderBottomColor = 'transparent';
            t.style.color = '#aaa';
        });

        const target = document.getElementById(`admin-tab-${tabId}`);
        const btn = document.getElementById(`tab-btn-${tabId}`);
        if (target) target.classList.remove('hidden');
        if (btn) {
            btn.classList.add('active');
            btn.style.borderBottomColor = '#ff5252';
            btn.style.color = '#fff';
        }
        
        if (tabId === 'store') app.renderAdminStoreList();
        if (tabId === 'security') app.initAdminLogs();
    },

    loadAdminData: () => {
        app.loadAdminUsers();
        app.checkMaintenanceStatus();
        showToast('전역 마스터 데이터 동기화 중...', 'info');
    },

    broadcastAdminMessage: () => {
        const msg = document.getElementById('admin-broadcast-msg').value.trim();
        if (!msg || !db) return;
        
        db.ref('server/broadcast').set({
            message: msg,
            sender: STATE.currentUser.username,
            timestamp: Date.now()
        }).then(() => {
            showToast('전역 공지사항이 즉시 발송되었습니다.', 'success');
            document.getElementById('admin-broadcast-msg').value = '';
        });
    },

    checkMaintenanceStatus: () => {
        if (!db) return;
        db.ref('server/maintenance').on('value', snap => {
            const isMain = snap.val();
            const btn = document.getElementById('admin-btn-maintenance');
            if (btn) {
                btn.textContent = isMain ? 'ON (발동 중)' : 'OFF';
                btn.style.background = isMain ? '#ff5252' : '#444';
            }
        });
    },

    toggleMaintenance: () => {
        if (!db) return;
        db.ref('server/maintenance').once('value').then(snap => {
            const current = snap.val() || false;
            db.ref('server/maintenance').set(!current);
            showToast(`점검 모드를 ${!current ? '활성화' : '비활성화'} 했습니다.`, 'info');
        });
    },

    createCoupon: () => {
        const code = document.getElementById('admin-coupon-code').value.trim().toUpperCase();
        const coins = parseInt(document.getElementById('admin-coupon-coin').value) || 0;
        const dia = parseInt(document.getElementById('admin-coupon-dia').value) || 0;
        
        if (!code || !db) return showToast('코드를 입력하세요.', 'error');
        
        db.ref(`server/coupons/${code}`).set({
            coins, diamonds: dia, active: true, createdAt: Date.now()
        }).then(() => {
            showToast(`쿠폰 [${code}] 이(가) 정식 발행되었습니다.`, 'success');
            document.getElementById('admin-coupon-code').value = '';
        });
    },

    renderAdminStoreList: () => {
        if (!db) return;
        db.ref('store_apps').once('value').then(snap => {
            const apps = snap.val() || {};
            const listEl = document.getElementById('admin-store-list');
            if (!listEl) return;
            listEl.innerHTML = '';
            
            Object.entries(apps).forEach(([id, data]) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                tr.innerHTML = `
                    <td style="padding: 15px; font-weight:800;">${data.title}</td>
                    <td style="padding: 15px; color:#aaa;">${data.creator}</td>
                    <td style="padding: 15px;"><span style="background:#333; padding:2px 8px; border-radius:4px; font-size:0.75rem;">${data.category}</span></td>
                    <td style="padding: 15px;">
                        <button class="btn" style="background:rgba(255,82,82,0.1); color:#ff5252; border:1px solid #ff5252; padding:4px 10px; font-size:0.75rem;" onclick="app.deleteStoreApp('${id}')">삭제</button>
                    </td>
                `;
                listEl.appendChild(tr);
            });
        });
    },

    deleteStoreApp: (id) => {
        if (confirm('이 앱을 스토어에서 영구 삭제할까요?') && db) {
            db.ref(`store_apps/${id}`).remove().then(() => {
                showToast('앱이 삭제되었습니다.', 'success');
                app.renderAdminStoreList();
            });
        }
    },

    initAdminLogs: () => {
        if (!db || app.logsInitialized) return;
        const logEl = document.getElementById('admin-log-console');
        
        // Listen for all chats
        db.ref('chats').limitToLast(20).on('child_added', snap => {
            const data = snap.val();
            const time = new Date(data.timestamp).toLocaleTimeString();
            const p = document.createElement('div');
            p.style.marginBottom = '4px';
            p.innerHTML = `<span style="color:#888;">[${time}]</span> <span style="color:#64b5f6;">${data.user}:</span> ${data.text}`;
            logEl.appendChild(p);
            logEl.scrollTop = logEl.scrollHeight;
        });

        // Listen for logins (if presence is used)
        db.ref('presence').on('child_added', snap => {
            const p = document.createElement('div');
            p.style.color = '#ffeb3b';
            p.innerHTML = `> [LOGIN] ${snap.key} 계정 접속 감지`;
            logEl.appendChild(p);
            logEl.scrollTop = logEl.scrollHeight;
        });
        
        app.logsInitialized = true;
    },

    clearAdminLogs: () => {
        const logEl = document.getElementById('admin-log-console');
        if (logEl) logEl.innerHTML = '[SYSTEM] 로그 버퍼가 초기화되었습니다.<br>';
    },

    // ---- [ USER REDEEM SYSTEM ] ---- //
    redeemCoupon: () => {
        const input = document.getElementById('user-coupon-input');
        const code = input.value.trim().toUpperCase();
        if (!code) return;

        if (!db || !STATE.currentUser) return showToast('서버 연결이 필요합니다.', 'error');
        if (STATE.currentUser.isGuest) return showToast('게스트는 쿠폰을 사용할 수 없습니다.', 'warning');

        showToast('코드 확인 중...', 'info');
        db.ref(`server/coupons/${code}`).once('value').then(snap => {
            const coupon = snap.val();
            if (!coupon || !coupon.active) return showToast('유효하지 않거나 만료된 코드입니다.', 'error');

            // 이미 사용했는지 체크 (사용자 필드에 기록)
            const usedRef = db.ref(`users/${STATE.currentUser.uid}/used_coupons/${code}`);
            usedRef.once('value').then(usedSnap => {
                if (usedSnap.exists()) return showToast('이미 사용한 코드입니다.', 'warning');

                // 보상 지급
                STATE.currentUser.coins = (STATE.currentUser.coins || 0) + (coupon.coins || 0);
                STATE.currentUser.diamonds = (STATE.currentUser.diamonds || 0) + (coupon.diamonds || 0);

                // 기록 저장
                usedRef.set(true);
                saveData(); updateUI();
                input.value = '';
                showToast(`🧧 쿠폰 적용 성공! 🪙+${coupon.coins} 💎+${coupon.diamonds}`, 'success');
            });
        });
    },

    // ---- [ PARENTAL CONTROL SYSTEM ] ---- //
    secureStoreOpen: (url) => {
        const settings = STATE.currentUser.settings || {};
        if (settings.parentalEnabled && settings.parentalPin) {
            const inputPin = prompt("🧒 자녀 보호 기능이 활성화되어 있습니다.\n승인을 위해 PIN 번호 4자리를 입력하세요:");
            if (inputPin === settings.parentalPin) {
                window.open(url, '_blank');
            } else {
                showToast("PIN 번호가 일치하지 않습니다. 접근이 차단되었습니다.", "error");
            }
        } else {
            window.open(url, '_blank');
        }
    },

    toggleParentalControl: () => {
        if (!STATE.currentUser) return;
        const current = (STATE.currentUser.settings && STATE.currentUser.settings.parentalEnabled) || false;
        
        if (!current) {
            // 켜려고 할 때
            document.getElementById('parental-pin-setup').classList.remove('hidden');
            showToast("보호 기능을 켜려면 먼저 4자리 PIN을 설정해주세요.", "info");
        } else {
            // 끄려고 할 때
            const pin = prompt("보호 기능을 해제하려면 기존 PIN 번호를 입력하세요:");
            if (pin === STATE.currentUser.settings.parentalPin) {
                STATE.currentUser.settings.parentalEnabled = false;
                app.saveParentalSettings();
                showToast("자녀 보호 기능이 해제되었습니다.", "success");
            } else {
                showToast("PIN 번호가 틀렸습니다.", "error");
            }
        }
    },

    saveParentalPin: () => {
        const pin = document.getElementById('parental-pin-input').value;
        if (!/^\d{4}$/.test(pin)) {
            return showToast("PIN 번호는 숫자 4자리여야 합니다.", "error");
        }
        
        if (!STATE.currentUser.settings) STATE.currentUser.settings = {};
        STATE.currentUser.settings.parentalPin = pin;
        STATE.currentUser.settings.parentalEnabled = true;
        
        app.saveParentalSettings();
        document.getElementById('parental-pin-setup').classList.add('hidden');
        document.getElementById('parental-pin-input').value = '';
        showToast("자녀 보호 PIN 설정 및 보호 활성화 완료!", "success");
    },

    saveParentalSettings: () => {
        if (db && STATE.currentUser) {
            db.ref(`users/${STATE.currentUser.uid}/settings`).update({
                parentalEnabled: STATE.currentUser.settings.parentalEnabled,
                parentalPin: STATE.currentUser.settings.parentalPin
            });
        }
        app.updateParentalUI();
    },

    updateParentalUI: () => {
        const settings = (STATE.currentUser && STATE.currentUser.settings) || {};
        const isEn = settings.parentalEnabled;
        const statusText = document.getElementById('parental-status-text');
        const toggleBtn = document.getElementById('btn-toggle-parental');
        
        if (statusText) {
            statusText.textContent = isEn ? "현재 켜짐 (스토어 보호 중)" : "현재 꺼져 있음 (보호 미작동)";
            statusText.style.color = isEn ? "#00ff88" : "#ff5252";
        }
        if (toggleBtn) {
            toggleBtn.textContent = isEn ? "보호 끄기" : "보호 켜기";
        }
    }
};

window.app = app;
// OS 초기화 시 제스처 구동
setTimeout(() => { if(window.app && window.app.initTouchGestures) window.app.initTouchGestures(); }, 1000);
