const crypto = require('crypto');

// 环境变量
const APPID = process.env.HUPIJIAO_APPID;
const APPSECRET = process.env.HUPIJIAO_APP_SECRET;
// 查询API应该用专门的查询接口
const QUERY_URL = "https://api.dpweixin.com/payment/query.html";

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
    'https://superlative-lokum-e2f9b1.netlify.app',
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
    
    console.log('=== 检查订单 ===');
    console.log('order_no:', order_no);
    console.log('open_order_id:', open_order_id);
    console.log('onlyUserRecord:', onlyUserRecord);
    console.log('userId:', userId);
    
    if (!order_no && !onlyUserRecord) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing order_no" }) };
    }

    // 1. onlyUserRecord模式：查询用户记录
    if (onlyUserRecord) {
        if (!userId) {
            return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing userId" }) };
        }
        
        // checkAllRecords模式：查询用户所有已支付记录
        if (checkAllRecords) {
            try {
                const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
                const allKeys = await store.list({ prefix: `paid_${userId}_` });
                
                for (const key of allKeys.blobs) {
                    const data = await store.get(key.key);
                    if (data) {
                        const payment = JSON.parse(data);
                        if (payment.paid === true) {
                            console.log('找到用户已支付记录:', key.key);
                            return { 
                                statusCode: 200, 
                                headers, 
                                body: JSON.stringify({ 
                                    code: 0, 
                                    paid: true, 
                                    status: 'paid',
                                    mbtiType: payment.mbti_type || '',
                                    userLevel: payment.user_level || '',
                                    msg: "Payment found" 
                                }) 
                            };
                        }
                    }
                }
                
                console.log('未找到用户已支付记录');
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
            } catch (e) {
                console.log('Blobs错误:', e.message);
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: false, 
                        status: 'unknown',
                        msg: "Blobs error" 
                    }) 
                };
            }
        }
        
        // 普通onlyUserRecord模式：查询指定mbtiType+userLevel的记录
        if (!mbtiType || !userLevel) {
            return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing mbtiType/userLevel" }) };
        }
        
        try {
            const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
            const userPaymentKey = `paid_${userId}_${mbtiType}_${userLevel}`;
            const userPaymentData = await store.get(userPaymentKey);
            if (userPaymentData) {
                const userPayment = JSON.parse(userPaymentData);
                if (userPayment.paid === true) {
                    console.log('用户记录找到:', userPaymentKey);
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            code: 0, 
                            paid: true, 
                            status: 'paid',
                            msg: "Payment confirmed by user record" 
                        }) 
                    };
                }
            }
            console.log('用户记录未找到:', userPaymentKey);
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
        } catch (e) {
            console.log('Blobs用户记录错误:', e.message);
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: 0, 
                    paid: false, 
                    status: 'unknown',
                    msg: "Blobs error" 
                }) 
            };
        }
    }

    // 2. 如果没有order_no，直接返回未支付
    if (!order_no) {
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                code: 0, 
                paid: false, 
                status: 'unknown',
                msg: "No order_no" 
            }) 
        };
    }

    // 3. 优先查询虎皮椒API（最可靠！）
    console.log('优先查询虎皮椒API...');
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

        console.log('POST data:', postData);

        const response = await fetch(QUERY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
            timeout: 15000
        });

        const text = await response.text();
        console.log('API响应:', text.substring(0, 800));

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.log('JSON解析失败');
            // 如果JSON解析失败，尝试从HTML中提取信息
            if (text.includes('SUCCESS') || text.includes('success')) {
                console.log('HTML响应中包含success');
                // 保存到Blobs
                try {
                    const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
                    await store.set(order_no, JSON.stringify({
                        order_no: order_no,
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    }));
                    if (userId && mbtiType && userLevel) {
                        const userPaymentKey = `paid_${userId}_${mbtiType}_${userLevel}`;
                        await store.set(userPaymentKey, JSON.stringify({
                            paid: true,
                            order_no: order_no,
                            user_id: userId,
                            mbti_type: mbtiType,
                            user_level: userLevel,
                            paid_at: new Date().toISOString()
                        }));
                    }
                } catch (e) {}
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: true, 
                        status: 'paid',
                        msg: "Payment confirmed by API HTML" 
                    }) 
                };
            }
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: -2, 
                    paid: false, 
                    msg: 'Invalid API response: ' + text.substring(0, 100)
                }) 
            };
        }

        if (!result.errcode || result.errcode === 0 || result.errcode === '0') {
            const status = result.data?.status || result.status || result.trade_status;
            console.log('订单状态:', status);
            
            // 虎皮椒支付成功状态：OD, PAID, TRADE_SUCCESS, 1, paid, success
            const successStatuses = ['OD', 'PAID', 'TRADE_SUCCESS', '1', 'paid', 'success', 'SUCCESS'];
            const isSuccess = successStatuses.includes(String(status).toUpperCase());
            
            if (isSuccess) {
                // 保存到Blobs
                try {
                    const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
                    await store.set(order_no, JSON.stringify({
                        order_no: order_no,
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    }));
                    console.log('Payment saved to Blobs from API');
                    
                    // 同时保存用户记录
                    if (userId && mbtiType && userLevel) {
                        const userPaymentKey = `paid_${userId}_${mbtiType}_${userLevel}`;
                        await store.set(userPaymentKey, JSON.stringify({
                            paid: true,
                            order_no: order_no,
                            user_id: userId,
                            mbti_type: mbtiType,
                            user_level: userLevel,
                            paid_at: new Date().toISOString()
                        }));
                        console.log('User payment record saved:', userPaymentKey);
                    }
                } catch (e) {
                    console.log('Blobs save error:', e.message);
                }
                
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: true, 
                        status: 'paid',
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
                        msg: "Order " + (status || 'pending') 
                    }) 
                };
            }
        } else {
            console.log('API错误:', result.errmsg);
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: result.errcode, 
                    paid: false, 
                    msg: result.errmsg || 'Query error' 
                }) 
            };
        }
    } catch (error) {
        console.error('查询API错误:', error.message);
        
        // API查询失败，回退到本地Blobs
        console.log('API查询失败，回退到本地Blobs...');
        try {
            const store = await import('@netlify/blobs').then(m => m.getStore('payments'));
            const orderData = await store.get(order_no);
            if (orderData) {
                const payment = JSON.parse(orderData);
                console.log('本地Blobs找到:', payment.status);
                if (payment.status === 'paid') {
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            code: 0, 
                            paid: true, 
                            status: 'paid',
                            msg: "Payment confirmed by Blobs" 
                        }) 
                    };
                }
            }
            console.log('本地Blobs未找到');
        } catch (e) {
            console.log('Blobs错误:', e.message);
        }
        
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                code: -3, 
                paid: false, 
                msg: error.message 
            }) 
        };
    }
};