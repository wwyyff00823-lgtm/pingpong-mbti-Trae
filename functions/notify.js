const crypto = require('crypto');

// 环境变量
const APPID = process.env.HUPIJIAO_APPID;
const APPSECRET = process.env.HUPIJIAO_APP_SECRET;

function generateXhHash(params, hashkey) {
    const cleanParams = { ...params };
    delete cleanParams.hash;
    
    const sortedKeys = Object.keys(cleanParams).filter(key => {
        const val = cleanParams[key];
        return val !== null && val !== undefined && val !== '' && val !== 'undefined';
    }).sort();
    
    const arg = sortedKeys.map(key => `${key}=${String(cleanParams[key])}`).join('&');
    const finalStr = arg + hashkey;
    
    return crypto.createHash('md5').update(finalStr).digest('hex').toLowerCase();
}

exports.handler = async function(event, context) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    console.log('=== Payment Notify Received ===');
    console.log('Time:', new Date().toISOString());
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers));
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return { statusCode: 405, headers, body: JSON.stringify({ errcode: -1, errmsg: 'POST only' }) };
    }
    
    let body = {};
    
    try {
        if (event.body) {
            if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
                body = JSON.parse(event.body);
                console.log('Parsed JSON body:', JSON.stringify(body));
            } else {
                const formData = new URLSearchParams(event.body);
                formData.forEach((value, key) => {
                    body[key] = value;
                });
                console.log('Parsed form body:', JSON.stringify(body));
            }
        }
    } catch (e) {
        console.error('Body parse error:', e.message);
        return { statusCode: 200, headers, body: JSON.stringify({ errcode: -1, errmsg: 'invalid request' }) };
    }
    
    const { trade_order_id, total_fee, status, hash, transaction_id, open_order_id, appid } = body;
    
    console.log('Order ID:', trade_order_id);
    console.log('Status:', status);
    console.log('Amount:', total_fee);
    console.log('AppID:', appid);
    
    if (!trade_order_id || !status || !hash) {
        console.error('Missing required parameters');
        return { statusCode: 200, headers, body: JSON.stringify({ errcode: -1, errmsg: 'fail' }) };
    }
    
    // 验证支付金额是否正确（必须是9.9元）
    const expectedAmount = 9.9;
    const actualAmount = parseFloat(total_fee);
    if (isNaN(actualAmount) || actualAmount !== expectedAmount) {
        console.error('Invalid payment amount:', total_fee, 'Expected:', expectedAmount);
        return { statusCode: 200, headers, body: JSON.stringify({ errcode: -1, errmsg: 'invalid amount' }) };
    }
    
    if (!APPID || !APPSECRET) {
        console.error('Missing APPID or APPSECRET environment variables');
        return { statusCode: 500, headers, body: JSON.stringify({ errcode: -1, errmsg: 'server error' }) };
    }
    
    const paramsForSign = { ...body };
    delete paramsForSign.hash;
    
    const calculatedHash = generateXhHash(paramsForSign, APPSECRET);
    console.log('Calculated hash:', calculatedHash);
    console.log('Received hash:', hash.toLowerCase());
    
    if (calculatedHash !== hash.toLowerCase()) {
        console.error('Signature verification failed');
        return { statusCode: 200, headers, body: JSON.stringify({ errcode: -1, errmsg: 'signature fail' }) };
    }
    
    console.log('Signature verified successfully');
    
    const successStatuses = ['OD', 'PAID', 'TRADE_SUCCESS', 'paid', 'success', '1'];
    const isSuccess = successStatuses.includes(String(status).toUpperCase()) || successStatuses.includes(String(status));
    
    if (isSuccess) {
        console.log('Payment SUCCESS for order:', trade_order_id);
        
        try {
            const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
            
            const paymentData = {
                order_no: trade_order_id,
                status: 'paid',
                amount: total_fee,
                transaction_id: transaction_id || '',
                open_order_id: open_order_id || '',
                paid_at: new Date().toISOString()
            };
            
            await store.set(trade_order_id, JSON.stringify(paymentData));
            console.log('Payment data saved to Netlify Blobs');
            
            const parts = trade_order_id.split('_');
            if (parts.length >= 6) {
                const mbtiPart = parts[3] || 'XXXX';
                const levelPart = parts[4] || 'MID';
                const userIdPart = parts[5] || '';
                
                const levelMap = { 'LOW': 'low', 'MID': 'mid', 'HIGH': 'high' };
                const levelFull = levelMap[levelPart] || 'mid';
                const userPaymentKey = `paid_${userIdPart}_${mbtiPart}_${levelFull}`;
                
                await store.set(userPaymentKey, JSON.stringify({
                    paid: true,
                    order_no: trade_order_id,
                    user_id: userIdPart,
                    mbti_type: mbtiPart,
                    user_level: levelFull,
                    paid_at: new Date().toISOString()
                }));
                console.log('User payment record saved:', userPaymentKey);
            } else {
                console.warn('Order ID format unexpected:', trade_order_id);
            }
            
        } catch (blobError) {
            console.error('Netlify Blobs error:', blobError.message);
        }
        
        return { statusCode: 200, headers, body: JSON.stringify({ errcode: 0, errmsg: 'success' }) };
    } else {
        console.log('Payment status not success:', status);
        return { statusCode: 200, headers, body: JSON.stringify({ errcode: 0, errmsg: 'success' }) };
    }
};