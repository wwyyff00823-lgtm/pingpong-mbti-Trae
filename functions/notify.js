const crypto = require('crypto');

// 环境变量
const APPID = process.env.XUNHUPAY_APPID;
const APPSECRET = process.env.XUNHUPAY_APPSECRET;

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

const ALLOWED_ORIGINS = [
    'https://api.xunhupay.com',
    'https://ping-mbti.netlify.app',
    'http://localhost:8000'
];

exports.handler = async function(event, context) {
    const origin = event.headers.origin || event.headers.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
    
    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    console.log('=== Payment Notify Received ===');
    console.log('Time:', new Date().toISOString());
    
    let body = {};
    
    // 解析请求体（支持JSON和form-data）
    if (event.httpMethod === 'POST' && event.body) {
        if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
            try {
                body = JSON.parse(event.body);
            } catch (e) {
                console.log('JSON parse failed');
            }
        } else {
            // form-data 格式
            const formData = new URLSearchParams(event.body);
            formData.forEach((value, key) => {
                body[key] = value;
            });
        }
    }
    
    const { trade_order_id, total_fee, status, hash, transaction_id, open_order_id } = body;
    
    console.log('Order:', trade_order_id);
    console.log('Status:', status);
    console.log('Amount:', total_fee);
    
    // 验证必要参数
    if (!trade_order_id || !status || !hash) {
        console.log('Missing required parameters');
        return { statusCode: 200, body: JSON.stringify({ errcode: -1, errmsg: 'fail' }) };
    }
    
    // 验证签名
    const paramsForSign = { ...body };
    delete paramsForSign.hash;
    
    const calculatedHash = generateXhHash(paramsForSign, APPSECRET);
    let isVerified = calculatedHash === hash.toLowerCase();
    
    // 尝试解码后再次验证
    if (!isVerified) {
        const paramsDecoded = { ...paramsForSign };
        Object.keys(paramsDecoded).forEach(key => {
            if (typeof paramsDecoded[key] === 'string') {
                try {
                    paramsDecoded[key] = decodeURIComponent(paramsDecoded[key]);
                } catch (e) {}
            }
        });
        const calculatedHashDecoded = generateXhHash(paramsDecoded, APPSECRET);
        if (calculatedHashDecoded === hash.toLowerCase()) {
            isVerified = true;
        }
    }
    
    if (!isVerified) {
        console.log('Signature verification failed');
        return { statusCode: 200, body: JSON.stringify({ errcode: -1, errmsg: 'signature fail' }) };
    }
    
    // 检查支付状态
    const successStatuses = ['OD', 'PAID', 'TRADE_SUCCESS', 'paid', 'success'];
    const isSuccess = successStatuses.includes(status.toUpperCase()) || successStatuses.includes(status);
    
    if (isSuccess) {
        console.log('Payment SUCCESS for order:', trade_order_id);
        
        // 使用 Netlify Blobs 持久化支付状态
        try {
            const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
            
            // 存储订单支付信息
            const paymentData = {
                order_no: trade_order_id,
                status: 'paid',
                amount: total_fee,
                transaction_id: transaction_id || '',
                open_order_id: open_order_id || '',
                paid_at: new Date().toISOString()
            };
            
            await store.set(trade_order_id, JSON.stringify(paymentData));
            console.log('Payment saved to Netlify Blobs');
            
            // 从订单号解析 userId、MBTI 和 Level（格式：PING + timestamp + random + MBTI + LEVEL + userId前8位）
            if (trade_order_id.length >= 26) {
                const mbtiPart = trade_order_id.substring(trade_order_id.length - 13, trade_order_id.length - 9);
                const levelPart = trade_order_id.substring(trade_order_id.length - 9, trade_order_id.length - 8);
                const userIdPart = trade_order_id.substring(trade_order_id.length - 8);
                const userPaymentKey = `paid_${userIdPart}_${mbtiPart}_${levelPart}`;
                
                // 存储用户支付记录（绑定userId）
                await store.set(userPaymentKey, JSON.stringify({
                    paid: true,
                    order_no: trade_order_id,
                    user_id: userIdPart,
                    mbti_type: mbtiPart,
                    user_level: levelPart,
                    paid_at: new Date().toISOString()
                }));
                console.log('User payment record saved:', userPaymentKey);
            }
            
        } catch (blobError) {
            console.log('Netlify Blobs error:', blobError.message);
            // 即使存储失败，也返回success让虎皮椒不重试，但记录日志供人工处理
        }
        
        // 返回虎皮椒要求的正确格式
        return { statusCode: 200, body: JSON.stringify({ errcode: 0, errmsg: 'success' }) };
    } else {
        console.log('Payment status:', status, '(not success)');
        return { statusCode: 200, body: JSON.stringify({ errcode: 0, errmsg: 'success' }) };
    }
};