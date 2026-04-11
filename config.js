// config.js - 설정, 저장 및 상태 관리
const STORAGE_KEY = 'SURVIVAL_3D_DATA';

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
let isSyncingUsers = false;
let isAdminUserListenerAttached = false;
let isFirebaseChatAttached = false;

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
            username: 'jur1203',
            password: '관리자',
            coins: 999999999,
            diamonds: 999999999,
            health: 100,
            hunger: 100,
            thirst: 100,
            role: 'creator'
        },
        {
            username: 'test',
            password: '123',
            coins: 1000,
            diamonds: 10,
            role: 'user'
        }
    ],
    applications: (savedState && savedState.applications) ? savedState.applications : [],
    settings: (savedState && savedState.settings) ? savedState.settings : {
        sound: true,
        graphics: 'medium',
        fov: 75,
        sens: 1.0,
        dist: 100,
        language: localStorage.getItem('juram_lang') || 'ko',
        theme: localStorage.getItem('juram_theme') || 'dark'
    },
    selectedMap: 'classic',
    currentServerId: null,
    threeScene: null
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
