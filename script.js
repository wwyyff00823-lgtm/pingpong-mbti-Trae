const STORAGE_KEYS = {
    USER_ID: 'ping_user_id',
    USER_LEVEL: 'userLevel',
    ANSWERS: 'answers',
    INTEGRITY_SCORE: 'integrityScore',
    MBTI_TYPE: 'mbtiType',
    LAST_PAID_RESULT: 'lastPaidResult',
    ORDER_NO: 'currentOrderNo'
};

function generateUserId() {
    let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    }
    return userId;
}

function getClientIP() {
    return new Promise((resolve) => {
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => resolve(data.ip))
            .catch(() => resolve('unknown_' + Math.random().toString(36).substr(2, 6)));
    });
}

async function createOrder(amount, level, mbtiType) {
    const userId = generateUserId();
    const ip = await getClientIP();
    
    const response = await fetch('/.netlify/functions/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount,
            userId,
            ip,
            level,
            mbtiType
        })
    });
    return response.json();
}

async function checkOrder(orderNo) {
    const response = await fetch(`/.netlify/functions/check-order?orderNo=${orderNo}`);
    return response.json();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    } else {
        alert(msg);
    }
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function checkAnswerConsistency(answers) {
    const q5 = answers[4];
    const q25 = answers[24];
    
    if (!q5 || !q25) return true;
    
    const q5Radical = q5.includes('激进') || q5.includes('搏杀') || q5.includes('主动进攻');
    const q25Conservative = q25.includes('保守') || q25.includes('稳') || q25.includes('防守');
    
    return !(q5Radical && q25Conservative);
}

function calculateMBTI(answers) {
    let eScore = 0, iScore = 0;
    let sScore = 0, nScore = 0;
    let tScore = 0, fScore = 0;
    let jScore = 0, pScore = 0;

    const scoringMap = {
        0: { e: ['A', 'B'], i: ['C', 'D'] },
        1: { e: ['A', 'B'], i: ['C', 'D'] },
        2: { s: ['A', 'B'], n: ['C', 'D'] },
        3: { s: ['A', 'B'], n: ['C', 'D'] },
        4: { t: ['A', 'B'], f: ['C', 'D'] },
        5: { t: ['A', 'B'], f: ['C', 'D'] },
        6: { j: ['A', 'B'], p: ['C', 'D'] },
        7: { j: ['A', 'B'], p: ['C', 'D'] },
        8: { e: ['B', 'C'], i: ['A', 'D'] },
        9: { e: ['B', 'C'], i: ['A', 'D'] },
        10: { s: ['B', 'C'], n: ['A', 'D'] },
        11: { s: ['B', 'C'], n: ['A', 'D'] },
        12: { t: ['B', 'C'], f: ['A', 'D'] },
        13: { t: ['B', 'C'], f: ['A', 'D'] },
        14: { j: ['B', 'C'], p: ['A', 'D'] },
        15: { j: ['B', 'C'], p: ['A', 'D'] },
        16: { e: ['C', 'D'], i: ['A', 'B'] },
        17: { e: ['C', 'D'], i: ['A', 'B'] },
        18: { s: ['C', 'D'], n: ['A', 'B'] },
        19: { s: ['C', 'D'], n: ['A', 'B'] },
        20: { t: ['C', 'D'], f: ['A', 'B'] },
        21: { t: ['C', 'D'], f: ['A', 'B'] },
        22: { j: ['C', 'D'], p: ['A', 'B'] },
        23: { j: ['C', 'D'], p: ['A', 'B'] },
        24: { e: ['A', 'D'], i: ['B', 'C'] },
        25: { s: ['A', 'D'], n: ['B', 'C'] },
        26: { t: ['A', 'D'], f: ['B', 'C'] },
        27: { j: ['A', 'D'], p: ['B', 'C'] },
        28: { e: ['B', 'D'], i: ['A', 'C'] },
        29: { s: ['B', 'D'], n: ['A', 'C'] }
    };

    answers.forEach((answer, index) => {
        if (!answer) return;
        const key = index % 30;
        const map = scoringMap[key];
        if (!map) return;
        
        const option = answer.charAt(0);
        Object.keys(map).forEach(dim => {
            if (map[dim].includes(option)) {
                if (dim === 'e') eScore++;
                else if (dim === 'i') iScore++;
                else if (dim === 's') sScore++;
                else if (dim === 'n') nScore++;
                else if (dim === 't') tScore++;
                else if (dim === 'f') fScore++;
                else if (dim === 'j') jScore++;
                else if (dim === 'p') pScore++;
            }
        });
    });

    const mbti = 
        (eScore >= iScore ? 'E' : 'I') +
        (sScore >= nScore ? 'S' : 'N') +
        (tScore >= fScore ? 'T' : 'F') +
        (jScore >= pScore ? 'J' : 'P');

    return mbti;
}

function canSkipPayment(mbtiType) {
    const lastPaidResult = localStorage.getItem(STORAGE_KEYS.LAST_PAID_RESULT);
    return lastPaidResult === mbtiType;
}

function markAsPaid(mbtiType) {
    localStorage.setItem(STORAGE_KEYS.LAST_PAID_RESULT, mbtiType);
}

function resetTest() {
    localStorage.removeItem(STORAGE_KEYS.ANSWERS);
    localStorage.removeItem(STORAGE_KEYS.MBTI_TYPE);
    localStorage.removeItem(STORAGE_KEYS.INTEGRITY_SCORE);
    localStorage.removeItem(STORAGE_KEYS.ORDER_NO);
}

window.PING = {
    STORAGE_KEYS,
    generateUserId,
    getClientIP,
    createOrder,
    checkOrder,
    showToast,
    shuffleArray,
    checkAnswerConsistency,
    calculateMBTI,
    canSkipPayment,
    markAsPaid,
    resetTest
};