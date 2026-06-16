const crypto = require('crypto');

const APPID = "201906181673";
const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";
const QUERY_URL = "https://api.xunhupay.com/payment/query.html";

function generateXhHash(params, hashkey) {
    const sortedKeys = Object.keys(params).sort();
    let arg = '';
    sortedKeys.forEach(key => {
        const val = params[key];
        if (key === 'hash' || val === null || val === undefined || val === '') {
            return;
        }
        if (arg) arg += '&';
        arg += key + '=' + val;
    });
    arg += hashkey;
    return crypto.createHash('md5').update(arg).digest('hex').toLowerCase();
}

async function queryOrderFromXunhu(orderNo, openOrderId = '') {
    try {
        const time = Math.floor(Date.now() / 1000);
        const nonce_str = crypto.randomBytes(16).toString('hex');
        
        const params = {
            version: "1.1",
            appid: APPID,
            time: time,
            nonce_str: nonce_str
        };

        if (openOrderId) {
            params.open_order_id = openOrderId;
        } else {
            params.out_trade_order = orderNo;
        }

        const hash = generateXhHash(params, APPSECRET);
        params.hash = hash;
        
        const queryString = Object.keys(params).sort().map(key => {
            return `${key}=${encodeURIComponent(params[key])}`;
        }).join('&');
        
        console.log('=== Query Order ===');
        console.log('Order No:', orderNo);
        console.log('Open Order ID:', openOrderId);
        console.log('Query params:', params);
        console.log('Query string:', queryString);
        
        const response = await fetch(QUERY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: queryString,
            timeout: 15000
        });
        
        console.log('Response status:', response.status);
        
        const text = await response.text();
        console.log('Raw response text:', text);
        
        try {
            const result = JSON.parse(text);
            console.log('Parsed JSON:', JSON.stringify(result, null, 2));
            console.log('Result keys:', Object.keys(result));
            return result;
        } catch (e) {
            console.log('JSON parse error:', e.message);
            console.log('Raw response for debug:', text);
            return null;
        }
    } catch (error) {
        console.error('Query order error:', error.message);
        return null;
    }
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
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
        console.log('Failed to parse JSON body, trying form data');
        try {
            const formData = new URLSearchParams(event.body || '');
            body = {};
            formData.forEach((value, key) => {
                body[key] = value;
            });
        } catch (e2) {
            return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Invalid request body" }) };
        }
    }

    const { order_no, open_order_id } = body;
    
    if (!order_no) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing order_no" }) };
    }

    if (!order_no.startsWith('PING')) {
        return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: false, msg: "Invalid order prefix" }) };
    }

    console.log('=== Payment Check Request ===');
    console.log('Order No:', order_no);
    console.log('Open Order ID:', open_order_id);
    console.log('Full body:', JSON.stringify(body));
    
    const xunhuResult = await queryOrderFromXunhu(order_no, open_order_id);
    
    if (xunhuResult) {
        console.log('=== Xunhu Response Analysis ===');
        
        const errcode = xunhuResult.errcode;
        const status = xunhuResult.status || xunhuResult.trade_status || xunhuResult.order_status;
        const tradeStatus = xunhuResult.trade_status;
        
        console.log('errcode:', errcode, '(type:', typeof errcode, ')');
        console.log('status:', status, '(type:', typeof status, ')');
        console.log('trade_status:', tradeStatus);
        console.log('All fields:', Object.keys(xunhuResult).join(', '));
        console.log('Full response:', JSON.stringify(xunhuResult, null, 2));
        
        const isSuccessCode = errcode === 0 || errcode === '0' || errcode === undefined;
        
        if (isSuccessCode) {
            const validPaidStatuses = ['OD', 'PAID', 'TRADE_SUCCESS', 'trade_success', 'SUCCESS'];
            const isPaid = validPaidStatuses.includes(status) || validPaidStatuses.includes(tradeStatus);
            
            if (isPaid) {
                console.log('Payment confirmed - status:', status, '/ trade_status:', tradeStatus);
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: true, 
                        status: status || tradeStatus,
                        msg: "Payment confirmed" 
                    }) 
                };
            } else if (status === '0' || status === '1' || status === 'PENDING' || status === 'pending') {
                console.log('Payment pending - status:', status);
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: false, 
                        status: status,
                        msg: "Order pending" 
                    }) 
                };
            } else {
                console.log('Unknown status:', status);
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: false, 
                        status: status,
                        msg: `Unknown status: ${status}` 
                    }) 
                };
            }
        } else {
            const errmsg = xunhuResult.errmsg || xunhuResult.message || 'Unknown error';
            console.log('Xunhu API error:', errmsg, 'errcode:', errcode);
            
            if (errmsg.includes('order not found') || errmsg.includes('订单不存在')) {
                console.log('Order not found in Xunhu, checking order age');
                const orderTimeStr = order_no.replace('PING', '').substring(0, 13);
                const orderTimestamp = parseInt(orderTimeStr + '000') || 0;
                const elapsed = Date.now() - orderTimestamp;
                
                if (elapsed > 30 * 60 * 1000) {
                    console.log('Order older than 30 minutes, marking as expired');
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            code: 0, 
                            paid: false, 
                            msg: "Order expired" 
                        }) 
                    };
                }
            }
            
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: errcode, 
                    paid: false, 
                    msg: errmsg 
                }) 
            };
        }
    } else {
        console.log('Failed to query Xunhu API - result is null');
        
        const orderTimeStr = order_no.replace('PING', '').substring(0, 13);
        const orderTimestamp = parseInt(orderTimeStr + '000') || 0;
        const elapsed = Date.now() - orderTimestamp;
        
        console.log('Order created:', new Date(orderTimestamp));
        console.log('Elapsed:', elapsed, 'ms');
        
        if (elapsed > 30 * 60 * 1000) {
            console.log('Order older than 30 minutes, marking as expired');
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    code: 0, 
                    paid: false, 
                    msg: "Order expired" 
                }) 
            };
        }
        
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                code: 0, 
                paid: false, 
                pending: true,
                msg: "Order pending" 
            }) 
        };
    }
};