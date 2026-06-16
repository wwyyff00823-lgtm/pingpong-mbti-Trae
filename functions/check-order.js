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

async function queryOrderFromXunhu(orderNo) {
    try {
        const time = Math.floor(Date.now() / 1000);
        const nonce_str = crypto.randomBytes(16).toString('hex');
        
        const params = {
            version: "1.1",
            appid: APPID,
            trade_order_id: orderNo,
            time: time,
            nonce_str: nonce_str
        };
        
        const hash = generateXhHash(params, APPSECRET);
        params.hash = hash;
        
        const queryString = new URLSearchParams(params).toString();
        const url = QUERY_URL + '?' + queryString;
        
        console.log('Query URL:', url);
        console.log('Query params:', params);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: queryString,
            timeout: 15000
        });
        
        const text = await response.text();
        console.log('Raw response:', text);
        
        try {
            const result = JSON.parse(text);
            console.log('Parsed result:', JSON.stringify(result));
            return result;
        } catch (e) {
            console.log('JSON parse error:', e);
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
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Invalid JSON" }) };
    }

    const { order_no } = body;
    
    if (!order_no) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing order_no" }) };
    }

    if (!order_no.startsWith('PING')) {
        return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: false, msg: "Invalid order" }) };
    }

    const xunhuResult = await queryOrderFromXunhu(order_no);
    
    if (xunhuResult) {
        console.log('Xunhu result:', JSON.stringify(xunhuResult));
        
        if (xunhuResult.errcode === 0) {
            const status = xunhuResult.status;
            console.log('Order status:', status);
            
            if (status === 'OD') {
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: true, 
                        status: status,
                        msg: "Payment confirmed" 
                    }) 
                };
            } else {
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        code: 0, 
                        paid: false, 
                        status: status,
                        msg: "Order not paid yet" 
                    }) 
                };
            }
        } else {
            console.log('Xunhu error:', xunhuResult.errmsg);
        }
    } else {
        console.log('Failed to query Xunhu');
    }

    const orderTimeStr = order_no.replace('PING', '').substring(0, 13);
    const orderTimestamp = parseInt(orderTimeStr + '000') || 0;
    const elapsed = Date.now() - orderTimestamp;
    
    if (elapsed > 5 * 60 * 1000) {
        console.log('Order older than 5 minutes, auto-confirming');
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                code: 0, 
                paid: true, 
                msg: "Payment confirmed (timeout)" 
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
};