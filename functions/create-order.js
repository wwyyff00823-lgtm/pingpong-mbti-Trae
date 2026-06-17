const crypto = require('crypto');
const qs = require('querystring');

// 虎皮椒API地址
const API_URL = "https://api.xunhupay.com/payment/do.html";

// 环境变量
const APPID = process.env.XUNHUPAY_APPID;
const APPSECRET = process.env.XUNHUPAY_APPSECRET;
const NOTIFY_URL = process.env.XUNHUPAY_NOTIFY_URL;
const RETURN_URL = process.env.XUNHUPAY_RETURN_URL;

// 服务端硬编码配置（防止客户端伪造）
const PRICE_YUAN = 9.9;  // 价格：9.9元
const PRICE_CENTS = Math.round(PRICE_YUAN * 100);  // 虎皮椒要求单位为"分"，即990
const GOODS_NAME = '乒乓球MBTI测试完整报告';

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
    'https://ping-mbti.netlify.app',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
];

exports.handler = async function(event, context) {
    const origin = event.headers.origin || event.headers.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    
    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ code: -1, msg: "POST only" }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Invalid JSON" }) };
    }

    // 只接受 mbtiType、userLevel 和 userId，用于生成订单号和记录
    const { mbtiType, userLevel, userId } = body;
    
    // 验证userId存在
    if (!userId) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing userId" }) };
    }
    
    // 服务端生成订单号（格式：PING + 时间戳 + 随机串 + MBTI + LEVEL + 用户标识前8位）
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
    const mbtiPart = (mbtiType || 'XXXX').substring(0, 4);
    const levelPart = (userLevel || 'M').substring(0, 1).toUpperCase();
    const userIdPart = userId.substring(0, 8).toUpperCase();
    const order_no = `PING${timestamp}${randomStr}${mbtiPart}${levelPart}${userIdPart}`;

    const time = Math.floor(Date.now() / 1000);
    const nonce_str = crypto.randomBytes(16).toString('hex');

    const params = {
        version: "1.1",
        appid: APPID,
        trade_order_id: order_no,
        total_fee: PRICE_CENTS.toString(),  // 服务端硬编码金额（单位：分）
        title: GOODS_NAME,  // 服务端硬编码商品名
        time: time,
        notify_url: NOTIFY_URL,
        return_url: RETURN_URL,
        nonce_str: nonce_str
    };

    const hash = generateXhHash(params, APPSECRET);
    params.hash = hash;

    const postData = qs.stringify(params);

    console.log('Creating order:', order_no, 'Amount:', PRICE_CENTS, 'cents');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
            timeout: 10000
        });
        
        const raw = await response.text();
        console.log('Payment API response status:', response.status);
        
        let ret;
        try {
            ret = JSON.parse(raw);
        } catch (e) {
            console.error('JSON parse error:', e.message);
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: 'Invalid response format' }) };
        }

        if (ret.errcode && ret.errcode !== 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: ret.errmsg || 'Payment API error' }) };
        }

        const openOrderId = ret.open_order_id || ret.order_id || '';
        const qrCodeUrl = ret.url_qrcode || ret.url || ret.pay_url;

        if (qrCodeUrl) {
            return { statusCode: 200, headers, body: JSON.stringify({ 
                code: 0, 
                url_qrcode: qrCodeUrl,
                url: ret.url,
                pay_url: qrCodeUrl,
                order_no: order_no,
                open_order_id: openOrderId,
                price: PRICE_YUAN,  // 返回给前端显示（仅显示用途）
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            }) };
        } else {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: 'No payment URL returned' }) };
        }
    } catch (err) {
        console.error('Payment request error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ code: -3, msg: err.message }) };
    }
};