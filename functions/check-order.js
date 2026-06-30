const crypto = require('crypto');

// 环境变量
const APPID = process.env.HUPIJIAO_APPID;
const APPSECRET = process.env.HUPIJIAO_APP_SECRET;
const QUERY_URL = "https://api.dpweixin.com/payment/do.html";

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
        const formData = new URLSearchParams(event.body || '');
        body = {};
        formData.forEach((value, key) => { body[key] = value; });
    }

    const { order_no, open_order_id, mbtiType, userLevel, userId, onlyUserRecord } = body;
    
    if (!order_no && !onlyUserRecord) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing order_no" }) };
    }
    // onlyUserRecord 模式必须提供 userId + mbtiType + userLevel
    if (onlyUserRecord && (!userId || !mbtiType || !userLevel)) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing userId/mbtiType/userLevel" }) };
    }

    console.log('Checking order:', order_no || '(onlyUserRecord)');
    
    // 首先从 Netlify Blobs 查询本地支付状态
    try {
        const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
        
        // 1) 如果给了具体订单号，先查订单记录
        if (order_no) {
            const orderData = await store.get(order_no);
            if (orderData) {
                const payment = JSON.parse(orderData);
                if (payment.status === 'paid') {
                    console.log('Order found in Blobs as paid');
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            code: 0, 
                            paid: true, 
                            status: 'paid',
                            order_no: order_no,
                            msg: "Payment confirmed" 
                        }) 
                    };
                }
            }
        }
        
        // 2) 如果提供了 userId、mbtiType 和 userLevel，查询用户支付记录
        // key 使用完整 level 字符串（low/mid/high），与 notify.js 一致
        if (userId && mbtiType && userLevel) {
            // level 安全白名单：避免恶意传入任意 key 探测 Blobs
            const safeLevels = ['low', 'mid', 'high'];
            if (!safeLevels.includes(userLevel)) {
                console.warn('Invalid userLevel:', userLevel);
            } else {
                const userPaymentKey = `paid_${userId}_${mbtiType}_${userLevel}`;
                const userPaymentData = await store.get(userPaymentKey);
                if (userPaymentData) {
                    const userPayment = JSON.parse(userPaymentData);
                    if (userPayment.paid === true) {
                        console.log('User payment found in Blobs:', userPaymentKey);
                        return { 
                            statusCode: 200, 
                            headers, 
                            body: JSON.stringify({ 
                                code: 0, 
                                paid: true, 
                                status: 'paid',
                                order_no: userPayment.order_no || order_no || '',
                                msg: "Payment confirmed by user record" 
                            }) 
                        };
                    }
                }
            }
        }
        
        // 3) onlyUserRecord 模式：到这里说明 Blobs 中没有该用户记录，未支付
        if (onlyUserRecord) {
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: 0, 
                    paid: false, 
                    status: 'unpaid',
                    msg: "No user payment record" 
                }) 
            };
        }
        
    } catch (blobError) {
        console.log('Blobs read error:', blobError.message);
        // 继续尝试从虎皮椒API查询
    }
    
    // 本地未找到且需要查具体订单时，查询虎皮椒API
    if (!order_no) {
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                code: 0, 
                paid: false, 
                status: 'unknown',
                msg: "No order_no provided and no local record" 
            }) 
        };
    }
    
    // 本地未找到，查询虎皮椒API
    try {
        const time = Math.floor(Date.now() / 1000).toString();
        const nonce_str = crypto.randomBytes(16).toString('hex');
        
        const params = {
            appid: APPID,
            time: time,
            nonce_str: nonce_str
        };

        if (open_order_id && open_order_id !== '') {
            params.open_order_id = open_order_id;
        } else {
            params.out_trade_order = order_no;
        }

        const generatedHash = generateXhHash(params, APPSECRET);
        params.hash = generatedHash;

        const postData = Object.keys(params).sort().map(key => {
            return `${key}=${encodeURIComponent(params[key])}`;
        }).join('&');

        console.log('Querying payment API...');

        // 用 AbortController 实现真超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(QUERY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const text = await response.text();

        try {
            const result = JSON.parse(text);

            if (!result.errcode || result.errcode === 0 || result.errcode === '0') {
                const status = result.data?.status || result.status;
                if (status === 'OD' || status === 'PAID' || status === 'TRADE_SUCCESS') {
                    // 支付成功，保存到 Blobs
                    try {
                        const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
                        const paymentData = {
                            order_no: order_no,
                            status: 'paid',
                            amount: result.data?.total_fee || 9.9,
                            paid_at: new Date().toISOString()
                        };
                        await store.set(order_no, JSON.stringify(paymentData));
                        console.log('Payment saved to Blobs from API query');
                    } catch (e) {
                        console.log('Failed to save to Blobs:', e.message);
                    }
                    
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            code: 0, 
                            paid: true, 
                            status: 'paid',
                            order_no: order_no,
                            msg: "Payment confirmed by API" 
                        }) 
                    };
                } else {
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            code: 0, 
                            paid: false, 
                            status: status || 'pending',
                            order_no: order_no,
                            msg: "Order pending" 
                        }) 
                    };
                }
            } else {
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: result.errcode, 
                        paid: false, 
                        order_no: order_no,
                        msg: result.errmsg || 'Query error' 
                    }) 
                };
            }
        } catch (e) {
            console.log('JSON parse error:', e.message);
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: -2, 
                    paid: false, 
                    order_no: order_no,
                    msg: 'Invalid API response' 
                }) 
            };
        }
    } catch (error) {
        console.error('Query error:', error.message);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                code: -3, 
                paid: false, 
                order_no: order_no,
                msg: error.message 
            }) 
        };
    }
};