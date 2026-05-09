// config.js - 설정, 저장 및 상태 관리
const STORAGE_KEY = 'MILITARY_SIM_DATA';

// --- 파이어베이스 시스템 ---
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

// 계급 목록
const RANKS = [
    "이병", "일병", "상병", "병장", 
    "하사", "중사", "상사", "원사", 
    "소위", "중위", "대위", 
    "소령", "중령", "대령", 
    "준장", "소장", "중장", "대장"
];

// 부대 부서 (동굴부대 스타일)
const DIVISIONS = [
    "육군본부", "군사경찰 (MP)", "교육사령부", "특수전사령부", "정보사령부"
];

// 팀 목록
const TEAMS = {
    SOLDIER: { name: "국군", color: 0x4b5320 },
    RAIDER: { name: "레이더", color: 0x8b0000 }
};

// 데이터 로드 함수
const loadData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("데이터 로드 실패", e);
        }
    }
    return null;
};

const savedState = loadData();

// 전역 상태 데이터
const STATE = {
    currentUser: null,
    users: savedState ? savedState.users : [
        {
            username: 'ree1203',
            password: 'hjklfdsa1203',
            name: '이주람',
            rank: '대장',
            branch: '육군',
            role: 'creator'
        }
    ],
    settings: (savedState && savedState.settings) ? savedState.settings : {
        sound: true,
        graphics: 'high',
        fov: 75,
        sens: 1.0,
        language: 'ko',
        theme: 'military-dark'
    }
};

// 데이터 저장 함수
const saveData = () => {
    const dataToSave = {
        users: STATE.users,
        applications: STATE.applications,
        settings: STATE.settings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

    if (db && STATE.currentUser && !STATE.currentUser.isGuest) {
        const uid = STATE.currentUser.uid;
        if (uid) {
            db.ref('users/' + uid).set(STATE.currentUser).catch(e => console.error("서버 저장 실패", e));
        }
    }
};

window.STATE = STATE;
window.saveData = saveData;
window.loadData = loadData;
