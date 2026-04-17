// os.js - 주람 OS 창 관리 및 바탕화면 로직
const app = window.app = {
    activeWindows: new Set(),
    windowConfigs: {
        'win-play': { title: '생존 시작', icon: '⛺', screenId: 'menu-screen' },
        'win-shop': { title: '상점', icon: '💰', screenId: 'shop-screen' },
        'win-quests': { title: '퀘스트', icon: '📜', screenId: 'quest-screen' },
        'win-settings': { title: '설정', icon: '⚙️', screenId: 'settings-screen' },
        'win-store': { title: '주람 스토어', icon: '🛍️', screenId: 'store-screen' },
        'win-scanner': { title: '스캐너', icon: '🔍', screenId: 'scanner-screen' },
        'win-mail': { title: '메일', icon: '✉️', screenId: 'mail-screen' },
        'win-admin': { title: '마스터 센터', icon: '🛡️', screenId: 'admin-screen' },
        'win-chat': { title: '전체 채팅', icon: '💬', screenId: 'chat-screen' },
        'win-browser': { title: '브라우저', icon: '🌐', screenId: 'browser-screen' },
        'win-gram': { title: '주람스타그램', icon: '📷', screenId: 'gram-screen' },
        'win-openchat': { title: '오픈채팅', icon: '💬', screenId: 'openchat-screen' },
        'win-paint': { title: '페인팅', icon: '🎨', screenId: 'paint-screen' },
        'win-ai': { title: '주람 AI', icon: '🤖', screenId: 'ai-screen' },
        'win-bank': { title: '주람 뱅크', icon: '🏦', screenId: 'bank-screen' },
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
        // [보안] 마스터 제어 센터는 오직 jur1203만 접근 가능
        if (winId === 'win-admin' && (!STATE.currentUser || STATE.currentUser.username !== 'jur1203')) {
            showToast('⚠️ 하이퍼 보안 프로토콜 가동: 최강좌 전용 구역입니다.', 'error');
            return;
        }

        if (STATE.currentUser && STATE.currentUser.restrictions) {
            const res = STATE.currentUser.restrictions;
            if (winId === 'win-store' && res.noStore) {
                return showToast('🚫 스토어 접근 권한이 정지되었습니다.', 'error');
            }
            // 앱별 개별 차단 (disabledApps)
            const disabledApps = res.disabledApps || {};
            const appIdMap = {
                'win-bank': 'bank', 'win-mail': 'mail', 'win-store': 'store',
                'win-browser': 'browser', 'win-ai': 'ai', 'win-openchat': 'chat',
                'win-gram': 'gram', 'win-paint': 'paint'
            };
            const appKey = appIdMap[winId];
            if (appKey && disabledApps[appKey]) {
                return showToast('🔒 관리자에 의해 이 앱이 일시 차단되었습니다.', 'error');
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
        if (winId === 'win-admin') {
            app.loadAdminData();
            app.refreshUltimateStats();
            app.watchPendingApprovals();
            app.watchTraffic();
        }

        // [트래픽 보고] 현재 열린 창을 서버에 보고
        if (db && STATE.currentUser && !STATE.currentUser.isGhost) {
            db.ref(`server/traffic/${STATE.currentUser.uid}`).set({
                username: STATE.currentUser.username,
                app: config.title,
                time: Date.now()
            });
        }
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
        
        desktopEl.innerHTML = '';
        
        // 아이콘 기본 순서
        const defaultOrder = ['win-store', 'win-browser', 'win-scanner', 'win-mail', 'win-gram', 'win-openchat', 'win-paint', 'win-ai', 'win-bank'];
        
        // 관리자/최강좌 아이콘 추가 로직
        if (STATE.currentUser) {
            if (STATE.currentUser.username === 'jur1203' && !defaultOrder.includes('win-admin')) defaultOrder.unshift('win-admin');
        }

        const savedOrder = localStorage.getItem('desktop_order');
        let currentOrder = savedOrder ? JSON.parse(savedOrder) : defaultOrder;
        
        // 필터링 (유효하지 않은 winId 제거 및 누락된 것 추가)
        currentOrder = currentOrder.filter(id => app.windowConfigs[id]);
        defaultOrder.forEach(id => { if(!currentOrder.includes(id)) currentOrder.push(id); });

        currentOrder.forEach(winId => {
            // [보안] 권한 없는 아이콘은 렌더링하지 않음
            if (winId === 'win-admin') {
                if (!STATE.currentUser || STATE.currentUser.username !== 'jur1203') return;
            }

            const config = app.windowConfigs[winId];
            if (!config) return;

            const iconDiv = document.createElement('div');
            iconDiv.className = 'desktop-icon';
            iconDiv.draggable = true;
            iconDiv.dataset.id = winId;
            iconDiv.onclick = () => {
                if (winId === 'win-admin') { app.openWindow(winId); app.loadAdminUsers(); }
                else app.openWindow(winId);
            };
            
            // 드래그 앤 드롭 리스너
            iconDiv.ondragstart = (e) => { e.dataTransfer.setData('text/plain', winId); iconDiv.style.opacity = '0.5'; };
            iconDiv.ondragend = () => iconDiv.style.opacity = '1';
            iconDiv.ondragover = (e) => e.preventDefault();
            iconDiv.ondrop = (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId !== winId) app.reorderIcons(draggedId, winId);
            };

            let iconStyle = '';
            let labelStyle = '';
            if (winId === 'win-ultimate-admin') {
                iconStyle = 'text-shadow: 0 0 15px #8b00ff; animation: pulse 2s infinite;';
                labelStyle = 'color:#d8b4fe; font-weight: 900;';
            } else if (winId === 'win-admin') {
                iconStyle = 'text-shadow: 0 0 10px #ff5252;';
                labelStyle = 'color:#ffbaba; font-weight: bold;';
            }

            iconDiv.innerHTML = `
                <div class="icon" style="${iconStyle}">${config.icon}</div>
                <div class="label" style="${labelStyle}">${config.title}</div>
            `;
            desktopEl.appendChild(iconDiv);
        });

        // 관리자 원격 제어 감시 시작
        if (STATE.currentUser && !app._adminWatcherActive) {
            app.startAdminWatcher();
        }
    },
    reorderIcons: (fromId, toId) => {
        const savedOrder = localStorage.getItem('desktop_order');
        let order = savedOrder ? JSON.parse(savedOrder) : ['win-store', 'win-browser', 'win-scanner', 'win-mail', 'win-gram', 'win-openchat', 'win-paint', 'win-ai', 'win-pass'];
        const fromIdx = order.indexOf(fromId);
        const toIdx = order.indexOf(toId);
        if (fromIdx > -1 && toIdx > -1) {
            order.splice(fromIdx, 1);
            order.splice(toIdx, 0, fromId);
            localStorage.setItem('desktop_order', JSON.stringify(order));
            app.updateDesktop();
        }
    },
    // ---- [ JURAM BANK SYSTEM 2.0 ] ---- //
    switchBankTab: (tabId) => {
        document.querySelectorAll('.bank-tab').forEach(t => t.classList.add('hidden'));
        const target = document.getElementById(`bank-tab-${tabId}`);
        if (target) target.classList.remove('hidden');
        
        // Update Tab Button Styles
        document.querySelectorAll('#bank-screen .settings-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
        });
    },

    initBank: () => {
        if (!db || !STATE.currentUser) return;
        
        // 데이터 실시간 동기화
        db.ref(`users/${STATE.currentUser.uid}/bank`).on('value', snap => {
            const data = snap.val() || { accounts: [], cards: [], history: [], credit: 650 };
            
            // 1. 홈 화면 업데이트
            document.getElementById('bank-balance-display-modern').textContent = STATE.currentUser.coins.toLocaleString();
            document.getElementById('bank-credit-score-big').textContent = data.credit || 650;
            app.updateCreditRank(data.credit || 650);

            // 2. 거래 내역 (History)
            const historyList = document.getElementById('bank-history-list-modern');
            if (historyList) {
                historyList.innerHTML = '';
                const history = data.history ? Object.values(data.history) : [];
                history.slice(-4).reverse().forEach(h => {
                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #f1f5f9; font-size:0.85rem;';
                    div.innerHTML = `<span>${h.type}</span><span style="font-weight:700; color:${h.amount>0?'#059669':'#dc2626'}">${h.amount>0?'+':''}${h.amount.toLocaleString()}</span>`;
                    historyList.appendChild(div);
                });
            }

            // 3. 계좌/통장 목록 (Accounts)
            const accList = document.getElementById('bank-accounts-list');
            if (accList) {
                accList.innerHTML = '';
                const accounts = data.accounts || [{ name: '기본 입출금 통장', balance: STATE.currentUser.coins, type: '주거래', id: 'main' }];
                accounts.forEach(acc => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background:#fff; border:1px solid #e2e8f0; border-radius:15px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.02);';
                    card.innerHTML = `
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:5px;">${acc.type}</div>
                        <div style="font-weight:800; font-size:1.1rem; margin-bottom:15px;">${acc.name}</div>
                        <div style="text-align:right; font-size:1.3rem; font-weight:900;">${acc.balance.toLocaleString()} 🪙</div>
                    `;
                    accList.appendChild(card);
                });
            }

            // 4. 카드 목록 (Cards)
            const cardList = document.getElementById('bank-cards-list');
            if (cardList) {
                const addCardBtn = cardList.querySelector('div[onclick]');
                cardList.innerHTML = '';
                const cards = data.cards || [];
                cards.forEach(c => {
                    const card = document.createElement('div');
                    card.style.cssText = `width:320px; height:180px; border-radius:15px; background:${c.color || '#1e293b'}; color:#fff; padding:25px; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);`;
                    card.innerHTML = `
                        <div style="font-weight:800; font-size:1.2rem; letter-spacing:1px;">JURAM PAY</div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                            <div>
                                <div style="font-size:0.9rem; opacity:0.8; letter-spacing:2px;">•••• •••• •••• ${c.last4}</div>
                                <div style="font-size:0.7rem; margin-top:5px; text-transform:uppercase;">${STATE.currentUser.username}</div>
                            </div>
                            <div style="font-size:1.5rem;">${c.type==='visa'?'💳': '💎'}</div>
                        </div>
                        <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:rgba(255,255,255,0.05); border-radius:50%;"></div>
                    `;
                    cardList.appendChild(card);
                });
                if (addCardBtn) cardList.appendChild(addCardBtn);
            }
        });
    },

    updateCreditRank: (score) => {
        const rankText = document.getElementById('bank-credit-rank-text');
        const userRank = document.getElementById('bank-user-credit');
        
        let tier = 7; let tierName = "주의군"; let color = "#94a3b8";
        
        if (score >= 950) { tier = 1; tierName = "최상위 (VVIP)"; color = "#00ffff"; }
        else if (score >= 900) { tier = 2; tierName = "우량 (Platinum)"; color = "#e5e7eb"; }
        else if (score >= 850) { tier = 3; tierName = "신뢰 (Gold)"; color = "#fbbf24"; }
        else if (score >= 800) { tier = 4; tierName = "일반 (Silver)"; color = "#94a3b8"; }
        else if (score >= 750) { tier = 5; tierName = "보통 (Bronze)"; color = "#cd7f32"; }
        else if (score >= 700) { tier = 6; tierName = "관리 대상"; color = "#666"; }
        else if (score >= 600) { tier = 7; tierName = "주의"; color = "#f87171"; }
        else if (score >= 500) { tier = 8; tierName = "경고"; color = "#ef4444"; }
        else if (score >= 300) { tier = 9; tierName = "위험"; color = "#b91c1c"; }
        else { tier = 10; tierName = "파산/정지"; color = "#7f1d1d"; }
        
        if (rankText) {
            rankText.textContent = `${tier}등급 (${tierName})`;
            rankText.style.color = color;
        }
        if (userRank) {
            userRank.textContent = `신용 등급: ${tier}등급 - ${tierName} (${score}점)`;
            userRank.style.color = color;
        }
    },

    bankTransfer: () => {
        const recipient = document.getElementById('bank-recipient-modern').value.trim();
        const amount = parseInt(document.getElementById('bank-amount-modern').value);
        if (!recipient || isNaN(amount) || amount <= 0) return showToast('송금 정보를 정확히 입력하세요.', 'error');
        if (STATE.currentUser.coins < amount) return showToast('잔액이 부족합니다.', 'error');
        if (recipient === STATE.currentUser.username) return showToast('본인에게는 송금할 수 없습니다.', 'error');

        db.ref('users').orderByChild('username').equalTo(recipient).once('value', snap => {
            if (!snap.exists()) return showToast('존재하지 않는 사용자입니다.', 'error');
            const targetUid = Object.keys(snap.val())[0];

            // 자산 이동
            STATE.currentUser.coins -= amount;
            saveData(); updateUI();
            db.ref(`users/${targetUid}/coins`).transaction(c => (c || 0) + amount);

            // 거래 기록
            const time = Date.now();
            db.ref(`users/${STATE.currentUser.uid}/bank/history`).push({ type: `송금 (${recipient})`, amount: -amount, time });
            db.ref(`users/${targetUid}/bank/history`).push({ type: `입금 (${STATE.currentUser.username})`, amount, time });

            // 신용 점수 소폭 상승 (거래 실적)
            db.ref(`users/${STATE.currentUser.uid}/bank/credit`).transaction(s => (s || 650) + 1);

            showToast(`${recipient}님께 ${amount.toLocaleString()}코인 송금 완료!`, 'success');
            document.getElementById('bank-recipient-modern').value = '';
            document.getElementById('bank-amount-modern').value = '';
        });
    },

    bankCreateAccount: () => {
        const name = prompt('계좌 이름을 입력하세요 (예: 비상금 통장):');
        if (!name) return;
        db.ref(`users/${STATE.currentUser.uid}/bank/accounts`).once('value', snap => {
            const list = snap.val() || [];
            list.push({ name, balance: 0, type: '자유적금', id: Date.now() });
            db.ref(`users/${STATE.currentUser.uid}/bank/accounts`).set(list);
            showToast('새 계좌가 개설되었습니다!', 'success');
        });
    },

    bankIssueCard: () => {
        if (!confirm('새로운 주람 페이 카드를 발급하시겠습니까? (발급비 100코인)')) return;
        if (STATE.currentUser.coins < 100) return showToast('발급 비용이 부족합니다.', 'error');

        STATE.currentUser.coins -= 100;
        saveData(); updateUI();

        const colors = ['#1e293b', '#0f172a', '#334155', '#4b5563', '#1e1b4b'];
        const newCard = {
            last4: Math.floor(1000 + Math.random() * 9000),
            color: colors[Math.floor(Math.random() * colors.length)],
            type: Math.random() > 0.5 ? 'visa' : 'master',
            issuedAt: Date.now()
        };

        db.ref(`users/${STATE.currentUser.uid}/bank/cards`).once('value', snap => {
            const list = snap.val() || [];
            list.push(newCard);
            db.ref(`users/${STATE.currentUser.uid}/bank/cards`).set(list);
            showToast('주람 페이 카드가 발급되었습니다!', 'success');
        });
    },
    // 설정 탭 프론트엔드 액션
    switchSettingsTab: (tabId) => {
        // Hide all tabs
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.add('hidden'));
        const target = document.getElementById(`set-tab-${tabId}`);
        if (target) target.classList.remove( 'hidden');
        if (tabId === 'coupons') app.updateCouponUI();
        
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
                listEl.innerHTML = '';
                
                const myPurchases = STATE.currentUser?.purchased_apps || {};
                
                Object.keys(apps).reverse().forEach(key => {
                    const appData = apps[key];
                    const card = document.createElement('div');
                    card.className = 'glass-panel';
                    card.style.cssText = 'padding: 20px; text-align: left; background: rgba(255,255,255,0.05); border-radius: 12px; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 10px;';
                    card.onmouseover = () => card.style.transform = 'translateY(-5px)';
                    card.onmouseout = () => card.style.transform = 'translateY(0)';
                    
                    const emj = appData.category === '게임' ? '🎮' : appData.category === '엔터테인먼트' ? '🎬' : '🛠️';
                    const price = appData.price || 0;
                    const isBought = myPurchases[key] || appData.creator === STATE.currentUser?.username || price === 0;
                    
                    let actionBtn = '';
                    if (isBought) {
                        actionBtn = `<button class="btn primary" onclick="app.secureStoreOpen('${appData.url}')" style="border-radius: 8px; font-weight: 800; width: 100%; border: none; padding: 12px;">다운로드 (실행)</button>`;
                    } else {
                        actionBtn = `<button class="btn" onclick="app.purchaseApp('${key}', ${price})" style="border-radius: 8px; font-weight: 800; width: 100%; height: 45px; background: #ffd700; color: #000; border: none;">💰 ${price.toLocaleString()} 코인에 구매</button>`;
                    }

                    card.innerHTML = `
                        <div style="font-size: 2.8rem; margin-bottom: 5px; height: 60px; display:flex; align-items:center;">${emj}</div>
                        <div>
                            <h3 style="font-size: 1.25rem; font-weight: 800; color:#fff; margin-bottom: 2px;">${appData.title}</h3>
                            <p style="color: #68f7b5; font-size: 0.75rem; font-weight:600; margin-bottom: 8px;">👤 ${appData.creator} • ${appData.category}</p>
                            <p style="color: #aaa; font-size: 0.82rem; line-height: 1.4; margin-bottom: 12px; min-height: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${appData.description || '상세 설명이 없습니다.'}</p>
                        </div>
                        <div style="margin-top: auto;">
                            ${actionBtn}
                        </div>
                    `;
                    listEl.appendChild(card);
                });
            });
            app.storeInitialized = true;
        }
        
        // 권한에 따른 내 앱 등록 / 구매 버튼 표시
        if (STATE.currentUser) {
            const role = STATE.currentUser.role;
            const canPost = role === 'creator' || role === 'admin' || role === 'manager';
            const addBtn = document.getElementById('store-btn-add-app');
            const buyPanel = document.getElementById('store-buy-perk-panel');
            if (addBtn) {
                if (canPost) addBtn.classList.remove('hidden');
                else addBtn.classList.add('hidden');
            }
            if (buyPanel) {
                if (canPost) buyPanel.style.display = 'none';
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
        // [보안] 역할(Role) 자동 변경 기능 삭제 - 관리자 승인이 필요함
        showToast('죄송합니다. 현재 권한 구입 기능은 관리자 심사제로 변경되었습니다.', 'info');
    },
    // 파이어베이스 DB에 스토어 앱 업로드 (전 기기 동기화)
    registerApp: () => {
        if (!STATE.currentUser) return;
        const role = STATE.currentUser.role;
        if (role !== 'creator' && role !== 'admin' && role !== 'manager') return showToast('앱 등록 권한이 없습니다.', 'error');
        const title = document.getElementById('store-app-title').value.trim();
        const cat = document.getElementById('store-app-category').value;
        const url = document.getElementById('store-app-url').value.trim();
        const desc = document.getElementById('store-app-desc').value.trim();
        const price = parseInt(document.getElementById('store-app-price').value) || 0;
        
        if (!title || !url) return showToast('이름과 URL을 모두 입력해주세요.', 'error');
        if (title.length > 20) return showToast('이름이 너무 깁니다.', 'error');
        if (!url.startsWith('http')) return showToast('http 또는 https로 시작하는 URL을 입력해주세요.', 'error');
        
        if (db) {
            showToast('창조의 정수 업로드 중...', 'info');
            db.ref('store_apps').push({
                title: title, 
                category: cat, 
                url: url, 
                description: desc,
                price: price,
                creator: STATE.currentUser.username,
                creatorUid: STATE.currentUser.uid,
                timestamp: Date.now()
            }).then(() => {
                showToast(`🚀 앱 '${title}' 등록 완료! 제작자로서의 수익을 기대하세요.`, 'success');
                app.cancelStoreRegister();
                document.getElementById('store-app-title').value = '';
                document.getElementById('store-app-url').value = '';
                document.getElementById('store-app-desc').value = '';
                document.getElementById('store-app-price').value = '0';
            }).catch(e => showToast('서버 오류: ' + e.message, 'error'));
        } else {
            showToast('데이터베이스 참조를 찾을 수 없습니다.', 'error');
        }
    },

    // 앱 구매 시스템
    purchaseApp: (appId, price) => {
        if (!STATE.currentUser || !db) return showToast('로그인이 필요합니다.', 'error');
        if ((STATE.currentUser.coins || 0) < price) {
            return showToast(`💸 코인이 부족합니다. (필요: ${price.toLocaleString()} 코인)`, 'error');
        }

        if (confirm(`'${price.toLocaleString()} 코인'을 지불하고 이 앱을 영구 소장하시겠습니까?`)) {
            showToast('결제 처리 중...', 'info');
            
            // 1. 구매자 코인 차감 및 구매 목록 추가
            const myUid = STATE.currentUser.uid;
            db.ref('store_apps/' + appId).once('value').then(snap => {
                const appData = snap.val();
                if (!appData) throw new Error('앱 정보를 찾을 수 없습니다.');
                
                const creatorUid = appData.creatorUid;
                
                // 트랜잭션: 구매자 코인 감소
                db.ref(`users/${myUid}/coins`).transaction(c => (c || 0) - price);
                // 구매 목록 기록
                db.ref(`users/${myUid}/purchased_apps/${appId}`).set(true);
                
                // 2. 제작자에게 이익(Profit) 전달
                if (creatorUid) {
                    db.ref(`users/${creatorUid}/coins`).transaction(c => (c || 0) + price);
                    // 제작자 알림
                    db.ref(`rammail/${creatorUid}/inbox`).push({
                        sender: 'SYSTEM',
                        recipient: appData.creator,
                        subject: `💰 앱 판매 수익 정산 완료!`,
                        body: `'${appData.title}' 앱이 한 부 판매되어 ${price.toLocaleString()} 코인이 귀하의 계좌로 입금되었습니다.`,
                        timestamp: Date.now(),
                        read: false
                    });
                }
                
                showToast('✅ 결제가 완료되었습니다! 이제 앱을 사용할 수 있습니다.', 'success');
                
                // 로컬 상태 업데이트
                STATE.currentUser.coins -= price;
                if (!STATE.currentUser.purchased_apps) STATE.currentUser.purchased_apps = {};
                STATE.currentUser.purchased_apps[appId] = true;
                
                if (typeof updateUI === 'function') updateUI();
                app.initStore(); // 스토어 다시 그리기
            }).catch(err => {
                showToast('결제 오류: ' + err.message, 'error');
            });
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
        if (!STATE.currentUser) return;
        const role = STATE.currentUser.role;
        if (role !== 'admin' && role !== 'manager' && STATE.currentUser.username !== 'jur1203') return;
        if (typeof db === 'undefined' || !db) return showToast('데이터베이스에 연결할 수 없습니다.', 'error');
        
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
        
        // 필터링 적용 (게스트 계정 및 고스트 모드)
        if (filterVal === 'guest') {
            userArr = userArr.filter(u => u.isGuest === true || String(u.username).includes('게스트'));
        }
        
        // [보안] 고스트 모드인 마스터 계정은 유저 리스트에서 숨김 (단, 본인에게는 보임)
        userArr = userArr.filter(u => {
            if (u.isGhost && STATE.currentUser.username !== 'jur1203') return false;
            return true;
        });
        
        // 정렬 적용
        if (filterVal === 'coins') {
            userArr.sort((a, b) => (b.coins || 0) - (a.coins || 0));
        } else if (filterVal === 'diamonds') {
            userArr.sort((a, b) => (b.diamonds || 0) - (a.diamonds || 0));
        } else if (filterVal === 'role') {
            const rW = { 'admin': 5, 'manager': 4, 'creator': 3, 'vip': 2, 'user': 1 };
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
            
            // 베지 렌더링
            let badgesHtml = '';
            const bMap = { 'top': '🏆', 'winner': '👑', 'hot': '🔥', 'rich': '💎', 'bug': '🐞', 'king': '⭐' };
            if (u.badges) {
                Object.keys(u.badges).forEach(bKey => {
                    if (bMap[bKey]) badgesHtml += `<span title="${bKey}">${bMap[bKey]}</span>`;
                });
            }
            if (u.username === 'jur1203') badgesHtml += '<span style="animation: ultimate-glow 1s infinite alternate;">🌌</span>';

            div.innerHTML = `
                <div>
                    <div style="font-weight:800; color:#fff; font-size: 1.1rem; display:flex; align-items:center; gap:5px;">
                        ${u.isWanted ? '🏴‍☠️ ' : ''}${u.username} ${isGuestBadge} <span style="font-size:0.9rem;">${badgesHtml}</span>
                    </div>
                    <div style="font-size:0.85rem; color:#aaa; margin-top: 4px;">
                        등급: <span style="color: ${u.role==='admin'?'#ff5252':u.role==='manager'?'#ff9800':u.role==='creator'?'#ffd700':u.role==='vip'?'#00e5ff':'#64b5f6'}">${u.role || 'user'}</span> 
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
        
        // 상세 제한 사항 로드
        const res = u.restrictions || {};
        document.getElementById('admin-ed-ban').checked = res.banned || false;
        document.getElementById('admin-ed-nochat').checked = res.noChat || false;
        document.getElementById('admin-ed-nostore').checked = res.noStore || false;
        document.getElementById('admin-ed-shadow').checked = res.shadowBanned || false;
        document.getElementById('admin-ed-freeze').checked = res.uiFrozen || false;
        document.getElementById('admin-ed-warnings').value = u.warnings || 0;
        document.getElementById('admin-ed-credit').value = (u.bank && u.bank.credit) !== undefined ? u.bank.credit : 650;

        // 베지 데이터 로드
        const userBadges = u.badges || {};
        document.querySelectorAll('.adm-badge-cb').forEach(cb => {
            cb.checked = userBadges[cb.value] ? true : false;
        });

        // 앱 권한 그리드 생성
        const appsGrid = document.getElementById('admin-ed-apps-grid');
        appsGrid.innerHTML = '';
        const disabledApps = res.disabledApps || {};
        
        // 런타임에 정의된 앱 목록 사용
        const availableApps = [
            { id: 'bank', name: '은행' },
            { id: 'mail', name: '메일' },
            { id: 'store', name: '스토어' },
            { id: 'browser', name: '브라우저' },
            { id: 'ai', name: 'JuRam-AI' },
            { id: 'chat', name: '오픈채팅' },
            { id: 'gram', name: '그램' },
            { id: 'paint', name: '페인팅' }
        ];

        availableApps.forEach(appNode => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '5px';
            label.style.fontSize = '0.7rem';
            label.innerHTML = `<input type="checkbox" class="adm-app-perm" data-app="${appNode.id}" ${disabledApps[appNode.id] ? 'checked' : ''}> ${appNode.name}`;
            appsGrid.appendChild(label);
        });
        
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
        
        const disabledApps = {};
        document.querySelectorAll('.adm-app-perm').forEach(cb => {
            if (cb.checked) disabledApps[cb.getAttribute('data-app')] = true;
        });

        const restrictions = {
            banned: document.getElementById('admin-ed-ban').checked,
            noChat: document.getElementById('admin-ed-nochat').checked,
            noStore: document.getElementById('admin-ed-nostore').checked,
            shadowBanned: document.getElementById('admin-ed-shadow').checked,
            uiFrozen: document.getElementById('admin-ed-freeze').checked,
            disabledApps: disabledApps
        };
        
        const warnings = parseInt(document.getElementById('admin-ed-warnings').value) || 0;
        const credit = parseInt(document.getElementById('admin-ed-credit').value) || 650;
        
        // 베지 데이터 수집
        const badges = {};
        document.querySelectorAll('.adm-badge-cb').forEach(cb => {
            if (cb.checked) badges[cb.value] = true;
        });

        // 👑 [최강좌 보호] jur1203은 다른 사람이 권한이나 제한을 수정할 수 없음
        if (app.adminUserCache[uid].username === 'jur1203' && STATE.currentUser.username !== 'jur1203') {
            return showToast('🚫 이 세계의 최강좌는 수정할 수 없습니다.', 'error');
        }

        showToast('데이터 강제 덮어쓰기 중...', 'info');
        db.ref(`users/${uid}`).update({ 
            role: role, 
            coins: coins, 
            diamonds: dia,
            warnings: warnings,
            restrictions: restrictions,
            badges: badges,
            "bank/credit": credit
        }).then(() => {
            showToast('데이터가 완벽히 수정되었습니다!', 'success');
            app.logAdminAction(`유저 데이터 수정: ${uid} (Role: ${role}, Coins: ${coins})`);
            app.loadAdminUsers(); // 리스트 갱신
            document.getElementById('admin-editor-panel').style.display = 'none';
        });
    },
    deleteAdminUser: () => {
        const uid = document.getElementById('admin-ed-uid').value;
        const u = app.adminUserCache[uid];
        if (!uid || !db || !u) return;
        
        if (u.username === 'jur1203') return showToast('🚫 최강좌를 우주에서 지울 수는 없습니다.', 'error');

        if (confirm(`진짜로 '${u.username}' 계정을 영구 삭제하시겠습니까?\n이 데이터는 다신 복구할 수 없습니다!!`)) {
            db.ref(`users/${uid}`).remove().then(() => {
                showToast(`💀 계정 '${u.username}' 영구 삭제 됨`, 'success');
                app.logAdminAction(`유저 영구 삭제: ${u.username} (${uid})`);
                app.loadAdminUsers(); // 리스트 갱신
                document.getElementById('admin-editor-panel').style.display = 'none';
            });
        }
    },
    
    addAdminWarning: () => {
        const input = document.getElementById('admin-ed-warnings');
        input.value = parseInt(input.value) + 1;
        showToast('경고가 추가되었습니다. (저장 버튼을 눌러야 확정됩니다)', 'info');
    },

    kickAdminUser: () => {
        const uid = document.getElementById('admin-ed-uid').value;
        if (!uid || !db) return;
        const u = app.adminUserCache[uid];
        if (u && u.username === 'jur1203') return showToast('🚫 최강좌를 킥할 수는 없습니다. 오히려 당신이 튕겨나갈 수 있습니다.', 'error');
        
        if (confirm('이 유저를 즉시 서버에서 튕겨낼까요?')) {
            db.ref(`users/${uid}/restrictions/kicked`).set(Date.now()).then(() => {
                showToast('킥 명령이 전달되었습니다.', 'success');
                app.logAdminAction(`유저 강제 킥: ${uid}`);
            });
        }
    },

    approveStoreApp: (appId) => {
        if (!db) return;
        db.ref(`store_apps/${appId}`).update({ status: 'approved' }).then(() => {
            showToast('앱이 승인되었습니다.', 'success');
            app.renderAdminStoreList();
        });
    },

    // ---- [ REAL-TIME ADMIN WATCHER ] ---- //
    _adminWatcherActive: false,
    startAdminWatcher: () => {
        if (!db || !STATE.currentUser || app._adminWatcherActive) return;
        app._adminWatcherActive = true;

        db.ref(`users/${STATE.currentUser.uid}/restrictions`).on('value', snap => {
            const res = snap.val() || {};

            // [실시간 킥(Kick) 감지]
            if (res.kicked) {
                db.ref(`users/${STATE.currentUser.uid}/restrictions/kicked`).remove();
                alert('⚡ 관리자에 의해 강제 퇴장되었습니다.');
                if (auth) auth.signOut();
                STATE.currentUser = null;
                app._adminWatcherActive = false;
                location.reload();
                return;
            }

            // [UI 프리즈 감지]
            const overlay = document.getElementById('admin-freeze-overlay');
            if (overlay) {
                overlay.style.display = res.uiFrozen ? 'flex' : 'none';
            }

            // [현재 유저 제한 상태 동기화]
            if (STATE.currentUser) {
                STATE.currentUser.restrictions = res;
            }
        });

        // [경고 3회 자동 밴]
        db.ref(`users/${STATE.currentUser.uid}/warnings`).on('value', snap => {
            const w = snap.val() || 0;
            if (w >= 3 && STATE.currentUser) {
                db.ref(`users/${STATE.currentUser.uid}/restrictions/banned`).set(true);
                alert('⛔ 경고 3회 누적으로 계정이 자동 정지되었습니다.');
                if (auth) auth.signOut();
                location.reload();
            }
        });

        console.log('[AdminWatcher] 관리자 감시 활성화 완료');
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
            // [수정] 배경화면(desktop)에서 시작된 터치인지 확인 + 열린 창이 없을 때만 작동
            const isDesktop = e.target.id === 'desktop' || e.target.classList.contains('desktop');
            if (app.activeWindows.size > 0 || !isDesktop) {
                app.touchStartY = null; // 제스처 취소
                return;
            }
            app.touchStartY = e.touches[0].clientY;
        }, { passive: true });

        layer.addEventListener('touchend', (e) => {
            if (app.touchStartY === null) return;
            
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
            app.touchStartY = null;
        }, { passive: true });
        
        console.log("배경화면 전용 스와이프 시스템 활성화됨.");
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
        document.querySelectorAll('#admin-screen .admin-tab').forEach(t => {
            t.classList.remove('active');
            t.style.borderBottomColor = 'transparent';
            t.style.color = '#aaa';
        });

        const target = document.getElementById(`admin-tab-${tabId}`);
        const btn = document.getElementById(`adm-btn-${tabId}`);
        if (target) target.classList.remove('hidden');
        if (btn) {
            btn.classList.add('active');
            btn.style.borderBottomColor = tabId === 'mythic' ? '#8b00ff' : '#ff5252';
            btn.style.color = '#fff';
        }
        
        if (tabId === 'users') app.loadAdminUsers();
        if (tabId === 'economy') app.loadAdminStats();
        if (tabId === 'store') app.renderAdminStoreList();
        if (tabId === 'security') app.initAdminLogs();
        if (tabId === 'mythic') {
            app.refreshUltimateStats();
            app.watchPendingApprovals();
            app.watchTraffic();
        }
    },

    loadAdminStats: () => {
        if (!db) return;
        db.ref('users').once('value').then(snap => {
            const users = snap.val() || {};
            let totalCoins = 0;
            let totalDia = 0;
            let count = 0;

            Object.values(users).forEach(u => {
                totalCoins += (u.coins || 0);
                totalDia += (u.diamonds || 0);
                count++;
            });
            
            const coinsEl = document.getElementById('adm-stat-total-coins');
            const diaEl = document.getElementById('adm-stat-total-dia');
            
            if (coinsEl) coinsEl.textContent = `${totalCoins.toLocaleString()} 🪙`;
            if (diaEl) diaEl.textContent = `${totalDia.toLocaleString()} 💎`;
            
            app.logAdminAction(`경제 통계 갱신 완료 (총 유저: ${count}명)`);
        });
    },

    logAdminAction: (msg) => {
        const consoleEl = document.getElementById('admin-log-console');
        if (!consoleEl) return;
        const time = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.innerHTML = `<span style="color:#888;">[${time}]</span> <span style="color:#ffeb3b;">[ADM]</span> ${msg}`;
        consoleEl.appendChild(div);
        consoleEl.scrollTop = consoleEl.scrollHeight;
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
                const status = data.status || 'pending';
                const statusColor = status === 'approved' ? '#4ade80' : '#fbbf24';
                const statusText = status === 'approved' ? '승인됨' : '대기중';

                tr.innerHTML = `
                    <td style="padding: 15px; font-weight:800;">${data.title}</td>
                    <td style="padding: 15px; color:#aaa;">${data.creator}</td>
                    <td style="padding: 15px;"><span style="color:${statusColor}; font-size:0.8rem; font-weight:800;">${statusText}</span></td>
                    <td style="padding: 15px; display:flex; gap:5px;">
                        ${status === 'pending' ? `<button class="btn primary" style="padding:4px 10px; font-size:0.75rem;" onclick="app.approveStoreApp('${id}')">승인</button>` : ''}
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

    // ---- [ JURAM-GRAM LOGIC ] ---- //
    initGram: () => {
        if (!db) return;
        db.ref('gram_posts').on('value', snap => {
            const posts = snap.val() || {};
            const feed = document.getElementById('gram-feed');
            if (!feed) return;
            feed.innerHTML = '';
            Object.entries(posts).reverse().forEach(([id, p]) => {
                const item = document.createElement('div');
                item.style.cssText = 'width: 100%; max-width: 450px; background: #000; border: 1px solid #222; border-radius: 8px; overflow: hidden;';
                
                // Comments HTML
                let commentsHtml = '';
                const comments = p.comments ? Object.values(p.comments) : [];
                comments.forEach(c => {
                    commentsHtml += `<div style="font-size: 0.8rem; margin-bottom: 3px;"><span style="font-weight: 700;">${c.user}</span> ${c.text}</div>`;
                });

                item.innerHTML = `
                    <div style="padding: 12px; display: flex; align-items: center; gap: 10px;">
                        <div style="width:32px; height:32px; background:#444; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem;">👤</div>
                        <div style="font-weight: 700; font-size: 0.9rem;">${p.user}</div>
                    </div>
                    <img src="${p.imageUrl}" style="width: 100%; display: block; background: #111;">
                    <div style="padding: 12px;">
                        <div style="display: flex; gap: 15px; margin-bottom: 10px; font-size: 1.2rem;">
                            <span style="cursor: pointer;" onclick="app.likeGramPost('${id}')">❤️</span> 💬 ✈️
                        </div>
                        <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 5px;">좋아요 ${p.likes || 0}개</div>
                        <div style="font-size: 0.9rem; margin-bottom: 10px;"><span style="font-weight: 700;">${p.user}</span> ${p.caption}</div>
                        
                        <div id="gram-comments-${id}" style="border-top: 1px solid #222; padding-top: 10px; max-height: 100px; overflow-y: auto; margin-bottom: 10px;">
                            ${commentsHtml || '<div style="color: #666; font-size: 0.8rem;">첫 댓글을 남겨보세요.</div>'}
                        </div>

                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="gram-comment-input-${id}" placeholder="댓글 달기..." style="flex: 1; background: transparent; border: none; border-bottom: 1px solid #333; color: white; font-size: 0.85rem; padding: 5px 0; outline: none;">
                            <button onclick="app.postGramComment('${id}')" style="background: transparent; border: none; color: #0095f6; font-weight: 700; font-size: 0.85rem; cursor: pointer;">게시</button>
                        </div>
                    </div>
                `;
                feed.appendChild(item);
            });
        });
    },
    openGramUpload: () => document.getElementById('gram-upload-modal').classList.remove('hidden'),
    postToGram: () => {
        const url = document.getElementById('gram-img-url').value.trim();
        const cap = document.getElementById('gram-caption').value.trim();
        if (!url || !db) return showToast('이미지 URL을 입력하세요.', 'error');
        db.ref('gram_posts').push({
            user: STATE.currentUser.username,
            imageUrl: url,
            caption: cap,
            likes: 0,
            timestamp: Date.now()
        }).then(() => {
            document.getElementById('gram-upload-modal').classList.add('hidden');
            document.getElementById('gram-img-url').value = '';
            document.getElementById('gram-caption').value = '';
            showToast('성공적으로 포스팅되었습니다!', 'success');
        });
    },
    likeGramPost: (id) => {
        if (!db) return;
        db.ref(`gram_posts/${id}/likes`).transaction(c => (c || 0) + 1);
    },
    postGramComment: (postId) => {
        const input = document.getElementById(`gram-comment-input-${postId}`);
        const text = input.value.trim();
        if (!text || !db || !STATE.currentUser) return;

        db.ref(`gram_posts/${postId}/comments`).push({
            user: STATE.currentUser.username,
            text: text,
            timestamp: Date.now()
        }).then(() => {
            input.value = '';
            showToast('댓글을 달았습니다!', 'success');
        });
    },

    // ---- [ OPEN CHAT LOGIC ] ---- //
    currentChatRoom: 'global',
    joinChatRoom: (roomId) => {
        app.currentChatRoom = roomId;
        const titles = { 'global': '🌐 전역 로비', 'trade': '⚖️ 거래/장터', 'build': '🏗️ 건축/노하우' };
        document.getElementById('openchat-active-title').textContent = titles[roomId] || roomId;
        
        document.querySelectorAll('.chat-room-item').forEach(el => {
            el.classList.remove('active');
            el.style.background = 'transparent';
        });
        
        const msgEnv = document.getElementById('openchat-messages');
        if (!msgEnv || !db) return;
        msgEnv.innerHTML = '<div style="text-align:center; color:#888; padding:10px;">채팅방 연결 중...</div>';
        
        db.ref(`rooms/${roomId}/messages`).off();
        db.ref(`rooms/${roomId}/messages`).limitToLast(50).on('value', snap => {
            msgEnv.innerHTML = '';
            const msgs = snap.val() || {};
            Object.entries(msgs).forEach(([msgId, m]) => {
                const isMe = m.user === STATE.currentUser.username;
                const userRole = (m.role || 'user'); // 역할이 저장되어 있다고 가정하거나 가져와야 함. 일단 기본은 m.user로 판단
                const isAdmin = STATE.currentUser.username === 'jur1203' || STATE.currentUser.role === 'admin' || STATE.currentUser.role === 'manager';
                const div = document.createElement('div');
                div.style.cssText = `display: flex; flex-direction: column; align-items: ${isMe?'flex-end':'flex-start'}; margin-bottom: 12px; position: relative;`;
                
                let deleteBtn = '';
                if (isAdmin) {
                    deleteBtn = `<span onclick="app.deleteOpenChatMessage('${roomId}', '${msgId}')" style="cursor: pointer; font-size: 0.7rem; color: #ff5252; margin-left: 10px; vertical-align: middle;">[삭제]</span>`;
                }

                let badge = '';
                const isUltimate = m.user === 'jur1203';
                const bMap = { 'top': '🏆', 'winner': '👑', 'hot': '🔥', 'rich': '💎', 'bug': '🐞', 'king': '⭐' };
                let userBadgesHtml = '';
                if (m.badges) {
                    Object.keys(m.badges).forEach(bKey => {
                        if (bMap[bKey]) userBadgesHtml += bMap[bKey];
                    });
                }

                if (isUltimate) badge = '<span style="color:#fff; font-weight:900; background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 5px rgba(255,255,255,0.8)); text-shadow: 0 0 10px rgba(255,255,255,0.5);">[🪐최강좌]</span>';
                else if (m.role === 'admin') badge = '<span style="color:#ff5252; font-weight:900;">[ADMIN]</span>';
                else if (m.role === 'manager') badge = '<span style="color:#ff9800; font-weight:800;">[MANAGER]</span>';
                else if (m.role === 'creator') badge = '<span style="color:#ffd700; font-weight:800;">[CREATOR]</span>';
                else if (m.role === 'vip') badge = '<span style="color:#00e5ff; font-weight:800;">[VIP]</span>';

                const msgStyle = isUltimate ? 
                    `max-width: 80%; padding: 10px 18px; border-radius: 15px; font-size: 1rem; font-weight: 800; background: linear-gradient(135deg, #1a1a1a 0%, #000 100%); color: #fff; border: 2px solid; border-image: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff) 1; box-shadow: 0 0 20px rgba(255,255,255,0.2); animation: ultimate-msg-glow 2s infinite;` :
                    `max-width: 80%; padding: 8px 15px; border-radius: 15px; font-size: 0.9rem; background: ${isMe?'#007bff':'#fff'}; color: ${isMe?'#fff':'#333'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);`;

                div.innerHTML = `
                    <div style="font-size: 0.75rem; color: #888; margin: 0 5px 2px; display:flex; align-items:center; gap:4px;">
                        ${badge} <span style="font-weight:700;">${m.user}</span> <span style="font-size:0.7rem;">${userBadgesHtml}</span> ${deleteBtn}
                    </div>
                    <div style="${msgStyle}">
                        ${m.text}
                    </div>
                `;
                msgEnv.appendChild(div);
            });
            msgEnv.scrollTop = msgEnv.scrollHeight;
        });
    },
    deleteOpenChatMessage: (roomId, msgId) => {
        if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
        if (db) {
            db.ref(`rooms/${roomId}/messages/${msgId}`).remove().then(() => {
                showToast('메시지가 삭제되었습니다.', 'success');
            });
        }
    },
    sendOpenChatMessage: () => {
        const input = document.getElementById('openchat-input');
        const text = input.value.trim();
        if (!text || !db) return;
        db.ref(`rooms/${app.currentChatRoom}/messages`).push({
            user: STATE.currentUser.username,
            role: STATE.currentUser.role || 'user',
            badges: STATE.currentUser.badges || {},
            text: text,
            timestamp: Date.now()
        });
        input.value = '';
    },

    // ---- [ JURAM PAINTING LOGIC ] ---- //
    ctx: null,
    drawing: false,
    initPaint: () => {
        const canvas = document.getElementById('paint-canvas');
        if (!canvas) return;
        const container = canvas.parentElement;
        canvas.width = container.clientWidth * 0.9;
        canvas.height = container.clientHeight * 0.9;
        app.ctx = canvas.getContext('2d');
        app.ctx.lineCap = 'round';
        app.ctx.lineJoin = 'round';

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX || e.touches[0].clientX) - rect.left,
                y: (e.clientY || e.touches[0].clientY) - rect.top
            };
        };

        const start = (e) => { app.drawing = true; draw(e); };
        const end = () => { app.drawing = false; app.ctx.beginPath(); };
        const draw = (e) => {
            if (!app.drawing) return;
            const pos = getPos(e);
            app.ctx.lineWidth = document.getElementById('paint-size').value;
            app.ctx.strokeStyle = document.getElementById('paint-color').value;
            app.ctx.lineTo(pos.x, pos.y);
            app.ctx.stroke();
            app.ctx.beginPath();
            app.ctx.moveTo(pos.x, pos.y);
        };

        canvas.onmousedown = start; canvas.ontouchstart = (e) => { e.preventDefault(); start(e); };
        canvas.onmouseup = end; canvas.ontouchend = end;
        canvas.onmousemove = draw; canvas.ontouchmove = (e) => { e.preventDefault(); draw(e); };
    },
    clearCanvas: () => {
        if (app.ctx) app.ctx.clearRect(0, 0, 2000, 2000);
    },
    saveCanvas: () => {
        showToast('그림이 주람 갤러리에 저장되었습니다! (데모)', 'success');
    },

    // ---- [ JURAM AI LOGIC ] ---- //
    askAI: () => {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text) return;

        const msgEnv = document.getElementById('ai-messages');
        const userMsg = document.createElement('div');
        userMsg.style.cssText = 'align-self: flex-end; max-width: 80%; padding: 12px 18px; background: #0084ff; color: white; border-radius: 18px 18px 4px 18px; font-size: 0.95rem;';
        userMsg.textContent = text;
        msgEnv.appendChild(userMsg);
        input.value = '';
        msgEnv.scrollTop = msgEnv.scrollHeight;

        // AI Response Logic
        setTimeout(() => {
            const aiMsg = document.createElement('div');
            aiMsg.style.cssText = 'align-self: flex-start; max-width: 80%; padding: 12px 18px; background: white; border-radius: 18px 18px 18px 4px; border: 1px solid #ddd; font-size: 0.95rem; line-height: 1.5;';
            
            let response = "죄송해요, 그 질문은 잘 이해하지 못했어요. '조합법', '서바이벌 규칙', '운영진' 등에 대해 물어봐 주세요!";
            const q = text.toLowerCase();

            if (q.includes('조합') || q.includes('아이템')) response = "**아이템 조합 가이드:**<br>1. 돌 도끼: 돌(x3) + 나무(x2)<br>2. 철 곡괭이: 철괴(x3) + 나무(x2)<br>3. 작업대 근처에서 마우스 우클릭으로 제작 가능합니다.";
            else if (q.includes('규칙') || q.includes('금지')) response = "**서버 주요 규칙:**<br>- 타인 비하 및 욕설 금지<br>- 비인가 프로그램(핵) 사용 금지<br>- 마스터의 지시에 따라 평화롭게 생존하세요!";
            else if (q.includes('마스터') || q.includes('관리자')) response = "현재 생존 서버의 마스터는 **jur1203**님입니다. 문의사항은 메일을 이용해 주세요.";
            else if (q.includes('코인') || q.includes('돈')) response = "코인은 광물을 캐거나 나무를 베어 얻을 수 있습니다. 다이아는 아주 깊은 곳에서만 나옵니다!";
            else if (q.includes('안녕')) response = "반가워요! 저는 주람 OS의 마스코트 AI입니다. 무엇이든 물어보세요!";

            aiMsg.innerHTML = response;
            msgEnv.appendChild(aiMsg);
            msgEnv.scrollTop = msgEnv.scrollHeight;
        }, 800);
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
    },

    // ---- [ DAILY REWARD SYSTEM ] ---- //
    claimDailyReward: () => {
        if (!db || !STATE.currentUser || STATE.currentUser.isGuest) {
            return showToast('게스트는 보상을 받을 수 없습니다.', 'warning');
        }

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        
        db.ref(`users/${STATE.currentUser.uid}/last_daily`).once('value').then(snap => {
            const lastClaim = snap.val();
            if (lastClaim === todayStr) {
                return showToast('이미 오늘의 보상을 받으셨습니다. 내일 다시 와주세요!', 'info');
            }

            // 보상 지급 (100코인, 1다이아)
            STATE.currentUser.coins = (STATE.currentUser.coins || 0) + 100;
            STATE.currentUser.diamonds = (STATE.currentUser.diamonds || 0) + 1;
            
            // 기록 저장
            db.ref(`users/${STATE.currentUser.uid}/last_daily`).set(todayStr);
            saveData(); updateUI();
            app.updateCouponUI();
            
            showToast('🎁 일일 보상 수령 완료! (100코인, 1다이아)', 'success');
        });
    },

    updateCouponUI: () => {
        if (!db || !STATE.currentUser) return;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        
        db.ref(`users/${STATE.currentUser.uid}/last_daily`).once('value').then(snap => {
            const btn = document.getElementById('btn-daily-reward');
            if (!btn) return;
            if (snap.val() === todayStr) {
                btn.textContent = '수령 완료';
                btn.style.background = '#444';
                btn.style.cursor = 'default';
                btn.disabled = true;
            } else {
                btn.textContent = '보상 받기';
                btn.style.background = '#ff5252';
                btn.disabled = false;
            }
        });
    }
};

// ---- [ ULTIMATE CONTROL LOGIC ] ---- //
app.toggleGlobalFreeze = () => {
    if (!db) return;
    db.ref('server/global_freeze').once('value').then(snap => {
        const current = snap.val() || false;
        db.ref('server/global_freeze').set(!current);
        showToast(`전 세계 동결 상태: ${!current ? 'ON' : 'OFF'}`, 'success');
    });
};

app.wipeAllChats = () => {
    if (!confirm('💥 전 세계의 모든 채팅 기록을 영구 소거하시겠습니까?')) return;
    if (db) {
        db.ref('rooms').remove().then(() => {
            showToast('전역 채팅방이 완벽하게 초기화되었습니다.', 'success');
        });
    }
};

app.sendUltimateBroadcast = () => {
    const msg = document.getElementById('ultimate-broadcast-msg').value.trim();
    if (!msg || !db) return;
    db.ref('server/broadcast').set({
        message: `🌌 [ULTIMATE] ${msg}`,
        sender: 'THE ULTIMATE',
        timestamp: Date.now(),
        style: 'ultimate'
    }).then(() => {
        document.getElementById('ultimate-broadcast-msg').value = '';
        showToast('신화적 공지가 우주로 전송되었습니다.', 'success');
    });
};

app.injectWealth = (type, amount) => {
    if (!STATE.currentUser || !db) return;
    STATE.currentUser[type] = (STATE.currentUser[type] || 0) + amount;
    saveData(); updateUI();
    showToast(`💰 최강좌의 위엄으로 ${type} +${amount.toLocaleString()} 획득!`, 'success');
};

app.seizeUserWealth = () => {
    const target = document.getElementById('ultimate-seize-username').value.trim();
    if (!target || !db) return;
    
    db.ref('users').once('value').then(snap => {
        const users = snap.val() || {};
        const uid = Object.keys(users).find(k => users[k].username === target);
        if (uid) {
            db.ref(`users/${uid}`).update({ coins: 0, diamonds: 0 }).then(() => {
                showToast(`${target}님의 전 재산을 성공적으로 압수했습니다.`, 'success');
            });
        } else showToast('유저를 찾을 수 없습니다.', 'error');
    });
};

app.refreshUltimateStats = () => {
    const layer = document.getElementById('ultimate-security-layer');
    if (layer) {
        layer.style.display = 'flex';
        setTimeout(() => layer.style.display = 'none', 1500);
    }
    showToast('모든 시스템 코어 동기화 완료.', 'info');
};

// ---- [ 가입 승인 시스템 로직 ] ---- //
app.watchPendingApprovals = () => {
    if (!db || !STATE.currentUser || STATE.currentUser.username !== 'jur1203') return;
    
    db.ref('users').on('value', snap => {
        const users = snap.val() || {};
        const listEl = document.getElementById('pending-approval-list');
        const countEl = document.getElementById('pending-count');
        if (!listEl || !countEl) return;
        
        const pending = Object.keys(users).filter(uid => users[uid].isApproved === false);
        countEl.textContent = pending.length;
        
        if (pending.length === 0) {
            listEl.innerHTML = '<div style="color: #666; font-size: 0.8rem; text-align: center; padding: 10px;">대기 중인 회원이 없습니다.</div>';
            return;
        }
        
        listEl.innerHTML = pending.map(uid => {
            const u = users[uid];
            return `
                <div class="glass-panel" style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); margin-bottom:5px;">
                    <div>
                        <div style="color:#fff; font-weight:700; font-size:0.9rem;">${u.username}</div>
                        <div style="color:#666; font-size:0.7rem;">${new Date(u.createdAt).toLocaleString()}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn" style="background:#10b981; color:white; padding:5px 10px; font-size:0.75rem;" onclick="app.approveUser('${uid}')">승인</button>
                        <button class="btn" style="background:#ef4444; color:white; padding:5px 10px; font-size:0.75rem;" onclick="app.rejectUser('${uid}')">거절</button>
                    </div>
                </div>
            `;
        }).join('');
    });
};

app.approveUser = (uid) => {
    if (!db) return;
    db.ref(`users/${uid}`).update({ isApproved: true }).then(() => {
        showToast('유저 가입을 최종 승인했습니다.', 'success');
    });
};

app.rejectUser = (uid) => {
    if (!db || !confirm('회원 가입 신청을 거절하고 삭제하시겠습니까?')) return;
    db.ref(`users/${uid}`).remove().then(() => {
        showToast('가입 신청을 반려했습니다.', 'info');
    });
};

app.sendUltimateTTS = () => {
    const msg = document.getElementById('ultimate-tts-msg').value.trim();
    if (!msg || !db) return;
    db.ref('server/voice_broadcast').set({ text: msg, time: Date.now() }).then(() => {
        document.getElementById('ultimate-tts-msg').value = '';
        showToast('전 구역에 목소리를 울려 퍼뜨렸습니다.', 'success');
    });
};

app.setGlobalTheme = () => {
    const theme = document.getElementById('ultimate-theme-select').value;
    if (db) db.ref('server/global_theme').set(theme);
    showToast(`전 세계 테마를 ${theme}로 동기화 중...`, 'info');
};

app.remoteControl = (cmd) => {
    const targetName = document.getElementById('ultimate-target-user').value.trim();
    if (!targetName || !db) return;
    db.ref('users').once('value').then(snap => {
        const users = snap.val() || {};
        const uid = Object.keys(users).find(k => users[k].username === targetName);
        if (uid) {
            db.ref(`users/${uid}/remote_cmd`).set({ cmd: cmd, time: Date.now() });
            showToast(`${targetName} 유저에게 원격 명령을 하달했습니다.`, 'success');
        } else showToast('유저를 찾을 수 없습니다.', 'error');
    });
};

app.toggleWanted = () => {
    const targetName = document.getElementById('ultimate-target-user').value.trim();
    if (!targetName || !db) return;
    db.ref('users').once('value').then(snap => {
        const users = snap.val() || {};
        const uid = Object.keys(users).find(k => users[k].username === targetName);
        if (uid) {
            const current = users[uid].isWanted || false;
            db.ref(`users/${uid}/isWanted`).set(!current);
            showToast(`${targetName} 유저의 현상 수배 상태: ${!current ? 'ON' : 'OFF'}`, 'info');
        } else showToast('유저를 찾을 수 없습니다.', 'error');
    });
};

app.applyGlobalEconomy = (type) => {
    const valInput = document.getElementById('ultimate-economy-val');
    const val = valInput ? parseInt(valInput.value) : 10;
    if (isNaN(val) || !db) return;
    db.ref('server/economy_action').set({ type: type, percent: val, time: Date.now() });
    showToast(`전 세계 경제 조정 발동: ${type === 'tax' ? '세금' : '지원금'} ${val}%`, 'warning');
};

app.toggleGhostMode = () => {
    if (!STATE.currentUser || !db) return;
    const current = STATE.currentUser.isGhost || false;
    db.ref(`users/${STATE.currentUser.uid}/isGhost`).set(!current).then(() => {
        STATE.currentUser.isGhost = !current;
        const btn = document.getElementById('ultimate-btn-ghost');
        if (btn) {
            btn.textContent = !current ? 'ON' : 'OFF';
            btn.style.background = !current ? '#10b981' : '#444';
        }
        showToast(`고스트 모드: ${!current ? '활성화' : '비활성화'}`, 'info');
    });
};

app.watchTraffic = () => {
    if (!db) return;
    db.ref('server/traffic').on('value', snap => {
        const traffic = snap.val() || {};
        const listEl = document.getElementById('ultimate-traffic-list');
        if (!listEl) return;
        
        const now = Date.now();
        const lines = Object.keys(traffic).map(uid => {
            const data = traffic[uid];
            if (now - data.time > 60000) return ''; 
            return `<div><span style="color:#fff;">${data.username}</span>: <span style="color:#00e5ff;">${data.app}</span></div>`;
        }).filter(l => l !== '');
        
        listEl.innerHTML = lines.length ? lines.join('') : '<div style="text-align:center;">미접속 유저 없음</div>';
    });
};

app.ultimateAction = (type) => {
    if (!db) return;
    if (type === 'shake') {
        db.ref('server/effects/shake').set(Date.now());
        showToast('전 세계에 파멸의 진동을 선언했습니다.', 'warning');
    } else if (type === 'fireworks') {
        db.ref('server/effects/fireworks').set(Date.now());
        showToast('하늘에 최강좌의 불꽃이 피어납니다.', 'success');
    } else if (type === 'maintenance') {
        db.ref('server/maintenance_mode').once('value').then(snap => {
            const current = snap.val() || false;
            db.ref('server/maintenance_mode').set(!current);
            showToast(`점검 모드: ${!current ? '진입' : '해제'}`, 'info');
        });
    } else if (type === 'rain') {
        db.ref('server/events/gold_rain').set(Date.now());
        showToast('전 국민에게 1만 골드의 은총을 내렸습니다.', 'success');
    }
};

// [글로벌 효과 리스너]
if (db) {
    db.ref('server/effects/shake').on('value', snap => {
        if (!snap.val()) return;
        document.body.style.animation = 'ultimate-shake 0.5s';
        setTimeout(() => document.body.style.animation = '', 500);
    });
    
    db.ref('server/effects/fireworks').on('value', snap => {
        if (!snap.val()) return;
        // 간단한 불꽃 효과 (브로드캐스트 스타일 활용)
        showToast('🎆🎆 전 구역에 축포가 터집니다! 🎆🎆', 'success');
        document.body.style.background = 'radial-gradient(circle, #ff00ff, #000)';
        setTimeout(() => document.body.style.background = '', 1000);
    });

    db.ref('server/events/gold_rain').on('value', snap => {
        if (!snap.val() || !STATE.currentUser) return;
        // 본인이 뿌렸을 때 중복 지급 방지 로직 (옵션)
        STATE.currentUser.coins = (STATE.currentUser.coins || 0) + 10000;
        saveData(); updateUI();
        showToast('🌧️ 최강좌의 은총으로 10,000 코인이 내렸습니다!', 'success');
    });

    db.ref('server/maintenance_mode').on('value', snap => {
        const isMaint = snap.val();
        if (isMaint && STATE.currentUser && STATE.currentUser.username !== 'jur1203') {
            alert('🛠️ 현재 시스템 점검 중입니다. 잠시 후 다시 접속해 주세요.');
            location.reload();
        }
    });

    // [신화급: 보이스 브로드캐스트]
    db.ref('server/voice_broadcast').on('value', snap => {
        const data = snap.val();
        if (!data || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(data.text);
        utterance.lang = 'ko-KR';
        utterance.pitch = 0.8; // 마스터의 웅장한 목소리
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
        showToast(`📢 [MASTER VOICE]: ${data.text}`, 'info');
    });

    // [신화급: 전역 테마 동기화]
    db.ref('server/global_theme').on('value', snap => {
        const theme = snap.val();
        if (theme && window.app && app.setTheme) app.setTheme(theme);
    });

    // [신화급: 원격 제어 명령]
    if (STATE.currentUser) {
        db.ref(`users/${STATE.currentUser.uid}/remote_cmd`).on('value', snap => {
            const data = snap.val();
            if (!data) return;
            if (data.cmd === 'close_all') {
                app.activeWindows.forEach(id => app.closeWindow(id));
                showToast('🛑 관리자의 명령으로 모든 앱이 종료되었습니다.', 'warning');
            }
            db.ref(`users/${STATE.currentUser.uid}/remote_cmd`).remove(); // 일회성
        });

        // [신화급: 경제 조정 감지]
        db.ref('server/economy_action').on('value', snap => {
            const act = snap.val();
            if (!act || !STATE.currentUser || STATE.currentUser.username === 'jur1203') return;
            
            const amt = Math.floor(STATE.currentUser.coins * (act.percent / 100));
            if (act.type === 'tax') {
                STATE.currentUser.coins -= amt;
                showToast(`💸 [전역 세금] 자산의 ${act.percent}%(${amt}코인)가 징수되었습니다.`, 'error');
            } else {
                STATE.currentUser.coins += amt;
                showToast(`🎁 [재난 지원금] 자산의 ${act.percent}%(${amt}코인)가 지급되었습니다!`, 'success');
            }
            saveData(); updateUI();
        });
    }
}

// OS 초기화 시 제스처 구동
setTimeout(() => { if(window.app && window.app.initTouchGestures) window.app.initTouchGestures(); }, 1000);

// 최강좌 효과를 위한 스타일 추가
const style = document.createElement('style');
style.innerHTML = `
    @keyframes ultimate-shake {
        0% { transform: translate(1px, 1px) rotate(0deg); }
        10% { transform: translate(-1px, -2px) rotate(-1deg); }
        20% { transform: translate(-3px, 0px) rotate(1deg); }
        30% { transform: translate(3px, 2px) rotate(0deg); }
        40% { transform: translate(1px, -1px) rotate(1deg); }
        50% { transform: translate(-1px, 2px) rotate(-1deg); }
        60% { transform: translate(-3px, 1px) rotate(0deg); }
        70% { transform: translate(3px, 1px) rotate(-1deg); }
        80% { transform: translate(-1px, -1px) rotate(1deg); }
        90% { transform: translate(1px, 2px) rotate(0deg); }
        100% { transform: translate(1px, -2px) rotate(-1deg); }
    }
    @keyframes ultimate-glow {
        0% { filter: drop-shadow(0 0 2px #fff); transform: scale(1); }
        100% { filter: drop-shadow(0 0 10px #ff00ff); transform: scale(1.2); }
    }
    @keyframes ultimate-msg-glow {
        0% { box-shadow: 0 0 5px rgba(255,255,255,0.2); }
        50% { box-shadow: 0 0 20px rgba(139,0,255,0.4); }
        100% { box-shadow: 0 0 5px rgba(255,255,255,0.2); }
    }
`;
document.head.appendChild(style);

// ---- [ 소스 코드 보호 보안 시스템 ] ---- //
app.triggerLockdown = () => {
    const el = document.getElementById('security-lockdown');
    if (el) el.style.display = 'flex';
};

app.unlockSystem = () => {
    const pw = document.getElementById('lockdown-pw').value;
    const masterKey = "juram1203";
    if (pw === masterKey) {
        STATE.securityUnlocked = true; // 세션 동안 잠금 해제 상태 유지
        document.getElementById('security-lockdown').style.display = 'none';
        document.getElementById('lockdown-pw').value = '';
        showToast('🔓 보호 모드가 해제되었습니다. 이제 사이트를 이용할 수 있습니다.', 'success');
    } else {
        showToast('❌ 비밀번호가 일치하지 않습니다.', 'error');
        document.getElementById('lockdown-pw').style.borderColor = '#fb7185';
        setTimeout(() => document.getElementById('lockdown-pw').style.borderColor = 'rgba(255,255,255,0.2)', 500);
    }
};

window.addEventListener('keydown', (e) => {
    // 최강좌(jur1203) 또는 이미 비밀번호를 푼 유저는 면제
    if (STATE.securityUnlocked || (STATE.currentUser && STATE.currentUser.username === 'jur1203')) return;

    const isCtrlU = (e.ctrlKey && (e.key === 'u' || e.key === 'U'));
    const isCtrlShiftI = (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I'));
    const isCtrlShiftJ = (e.ctrlKey && e.shiftKey && (e.key === 'j' || e.key === 'J'));
    const isF12 = (e.key === 'F12');

    if (isCtrlU || isCtrlShiftI || isCtrlShiftJ || isF12) {
        e.preventDefault();
        app.triggerLockdown();
        return false;
    }
});

window.addEventListener('contextmenu', (e) => {
    // 최강좌(jur1203) 또는 이미 비밀번호를 푼 유저는 허용
    if (STATE.securityUnlocked || (STATE.currentUser && STATE.currentUser.username === 'jur1203')) return;
    
    e.preventDefault();
    app.triggerLockdown();
    return false;
});
