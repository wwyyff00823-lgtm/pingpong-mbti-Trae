const STORAGE_KEYS = {
    USER_ID: 'ping_user_id',
    USER_LEVEL: 'userLevel',
    ANSWERS: 'answers',
    INTEGRITY_SCORE: 'integrityScore',
    MBTI_TYPE: 'mbtiType',
    LAST_PAID_RESULT: 'lastPaidResult',
    ORDER_NO: 'currentOrderNo'
};

const DIMENSION_WEIGHTS = {
    EI: { questions: 9, weight: 1.125 },
    SN: { questions: 8, weight: 1.0 },
    TF: { questions: 8, weight: 1.0 },
    JP: { questions: 8, weight: 1.0 }
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
    
    const orderNo = 'PING' + Date.now() + Math.random().toString(36).substr(2, 8).toUpperCase();
    
    return {
        success: true,
        orderNo,
        amount,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderNo)}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
}

async function checkOrder(orderNo) {
    const random = Math.random();
    if (random > 0.7) {
        return {
            success: true,
            orderNo,
            status: 'paid',
            amount: 9.9,
            level: localStorage.getItem('userLevel') || 'mid',
            mbtiType: localStorage.getItem('mbtiType') || 'ESTP'
        };
    }
    return {
        success: true,
        orderNo,
        status: 'pending',
        amount: 9.9
    };
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

function checkAnswerConsistency(answers, questions) {
    let contradictionCount = 0;
    
    const q5 = questions ? questions.find(q => q.id === 'q5') : null;
    const q29 = questions ? questions.find(q => q.id === 'q29') : null;
    
    if (q5 && q29 && answers['q5'] && answers['q29']) {
        const q5Selected = q5.options.find(opt => opt.id === answers['q5']);
        const q29Selected = q29.options.find(opt => opt.id === answers['q29']);
        
        if (q5Selected && q29Selected) {
            const q5IsE = q5Selected.tendency === 'aggressive';
            const q29IsE = q29Selected.tendency === 'aggressive';
            
            if ((q5IsE && !q29IsE) || (!q5IsE && q29IsE)) {
                contradictionCount++;
            }
        }
    }
    
    const q11 = questions ? questions.find(q => q.id === 'q11') : null;
    const q30 = questions ? questions.find(q => q.id === 'q30') : null;
    
    if (q11 && q30 && answers['q11'] && answers['q30']) {
        const q11Selected = q11.options.find(opt => opt.id === answers['q11']);
        const q30Selected = q30.options.find(opt => opt.id === answers['q30']);
        
        if (q11Selected && q30Selected) {
            const q11IsJ = q11Selected.tendency === 'planned';
            const q30IsJ = q30Selected.tendency === 'planned';
            
            if ((q11IsJ && !q30IsJ) || (!q11IsJ && q30IsJ)) {
                contradictionCount++;
            }
        }
    }
    
    return contradictionCount < 2;
}

function calculateMBTI(dimensionScores) {
    if (!dimensionScores) {
        const savedScores = localStorage.getItem('dimensionScores');
        if (savedScores) {
            dimensionScores = JSON.parse(savedScores);
        } else {
            dimensionScores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
        }
    }
    
    const EI = dimensionScores.E - dimensionScores.I;
    const SN = dimensionScores.S - dimensionScores.N;
    const TF = dimensionScores.T - dimensionScores.F;
    const JP = dimensionScores.J - dimensionScores.P;
    
    function getLetter(positive, negative, diff) {
        if (diff > 0) return positive;
        if (diff < 0) return negative;
        return Math.random() >= 0.5 ? positive : negative;
    }
    
    return (
        getLetter('E', 'I', EI) +
        getLetter('S', 'N', SN) +
        getLetter('T', 'F', TF) +
        getLetter('J', 'P', JP)
    );
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
    localStorage.removeItem(STORAGE_KEYS.DIMENSION_SCORES);
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