const crypto = require('crypto');
const qs = require('querystring');

// 虎皮椒API地址（新版）
const API_URL = "https://api.dpweixin.com/payment/do.html";

// 环境变量
const APPID = process.env.HUPIJIAO_APPID;
const APPSECRET = process.env.HUPIJIAO_APP_SECRET;
const NOTIFY_URL = process.env.HUPIJIAO_NOTIFY_URL;
const RETURN_URL = process.env.HUPIJIAO_RETURN_URL;

// 服务端硬编码配置（防止客户端伪造）
const PRICE_YUAN = 9.9;  // 价格：9.9元
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
    'https://harmonious-cactus-ff7aac.netlify.app',
    'http://localhost:8888',
    'http://localhost:9999'
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

    // 只接受 mbtiType、userLevel、userId 和 payType，用于生成订单号和记录
    const { mbtiType, userLevel, userId, payType } = body;
    
    // 验证userId存在
    if (!userId) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing userId" }) };
    }
    
    // 支付渠道：wechat=微信，alipay=支付宝
    const paymentType = payType === 'alipay' ? 'alipay' : 'wechat';
    
    // 服务端生成订单号（格式：PING + 时间戳 + _ + 随机串 + _ + MBTI + _ + LEVEL + _ + 完整userId）
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
    const mbtiPart = (mbtiType || 'XXXX').substring(0, 4).toUpperCase();
    const levelPart = (userLevel || 'mid').substring(0, 4).toUpperCase();
    const order_no = `PING_${timestamp}_${randomStr}_${mbtiPart}_${levelPart}_${userId}`;

    const time = Math.floor(Date.now() / 1000);
    const nonce_str = crypto.randomBytes(16).toString('hex');

    // 虎皮椒支付参数
    const params = {
        version: "1.1",
        appid: APPID,
        trade_order_id: order_no,
        total_fee: PRICE_YUAN.toString(),
        title: GOODS_NAME,
        time: time,
        notify_url: NOTIFY_URL,
        return_url: `${RETURN_URL}?order=${order_no}`,
        nonce_str: nonce_str,
        type: paymentType,
        // 明确指定为native扫码支付
        scene: 'native'
    };

    const hash = generateXhHash(params, APPSECRET);
    params.hash = hash;

    const postData = qs.stringify(params);

    console.log('Creating order:', order_no, 'Amount:', PRICE_YUAN, 'yuan');

    // 用 AbortController 实现真超时（Node 18+ 全局 fetch 不支持 timeout 字段）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
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

        // 虎皮椒API返回格式：
        // url_qrcode: PC端使用的二维码地址
        // url: 手机端H5支付URL
        const pcQrCodeUrl = ret.url_qrcode || ret.url || '';
        const mobileUrl = ret.url || ret.url_qrcode || '';

        // 调试日志 - 查看虎皮椒返回的完整数据
        console.log('=== 虎皮椒API返回 ===');
        console.log('完整响应:', JSON.stringify(ret, null, 2));
        console.log('openOrderId:', openOrderId);
        console.log('pcQrCodeUrl:', pcQrCodeUrl);
        console.log('mobileUrl:', mobileUrl);
        console.log('====================');

        if (pcQrCodeUrl || mobileUrl) {
            // 创建订单时预存到Blobs（待验证状态）
            try {
                const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
                await store.set(order_no, JSON.stringify({
                    order_no: order_no,
                    status: 'pending',
                    userId: userId,
                    mbtiType: mbtiPart,
                    userLevel: levelPart,
                    created_at: new Date().toISOString()
                }));
                console.log('Order pre-stored to Blobs:', order_no);
            } catch (e) {
                console.log('Failed to pre-store order:', e.message);
            }
            
            return { statusCode: 200, headers, body: JSON.stringify({ 
                code: 0, 
                url_qrcode: pcQrCodeUrl,
                url: mobileUrl,
                pay_url: pcQrCodeUrl || mobileUrl,
                order_no: order_no,
                open_order_id: openOrderId,
                price: PRICE_YUAN,
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            }) };
        } else {
            console.error('虎皮椒未返回支付URL！');
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: 'No payment URL returned' }) };
        }
    } catch (err) {
        console.error('Payment request error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ code: -3, msg: err.message }) };
    }
};