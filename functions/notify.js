const crypto = require('crypto');

const APPID = "201906181673";
const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";

const paidOrders = new Set();

function generateXhHash(params, hashkey) {
    const sortedKeys = Object.keys(params).sort();
    let arg = '';
    sortedKeys.forEach(key => {
        const val = params[key];
        if (key === 'hash' || val === null || val === undefined || val === '' || val === 'undefined') {
            return;
        }
        if (arg) arg += '&';
        arg += key + '=' + val;
    });
    arg += hashkey;
    return crypto.createHash('md5').update(arg).digest('hex').toLowerCase();
}

function isOrderPaid(orderNo) {
    return paidOrders.has(orderNo);
}

function markOrderPaid(orderNo) {
    paidOrders.add(orderNo);
    setTimeout(() => {
        paidOrders.delete(orderNo);
    }, 24 * 60 * 60 * 1000);
}

exports.isOrderPaid = isOrderPaid;

function verifyHash(params, hashkey, expectedHash) {
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
    const calculatedHash = crypto.createHash('md5').update(arg).digest('hex').toLowerCase();
    return calculatedHash === expectedHash.toLowerCase();
}

exports.handler = async function(event, context) {
    console.log('=== Notify Request Received ===');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers));
    
    let body = {};
    
    if (event.httpMethod === 'POST') {
        if (event.body) {
            if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
                try {
                    body = JSON.parse(event.body);
                    console.log('Parsed JSON body:', JSON.stringify(body, null, 2));
                } catch (e) {
                    console.log('Failed to parse JSON:', e.message);
                }
            } else if (event.headers['content-type'] && event.headers['content-type'].includes('form')) {
                const formData = new URLSearchParams(event.body);
                formData.forEach((value, key) => {
                    body[key] = value;
                });
                console.log('Parsed form body:', JSON.stringify(body, null, 2));
            } else {
                try {
                    body = JSON.parse(event.body);
                } catch (e) {
                    const formData = new URLSearchParams(event.body);
                    formData.forEach((value, key) => {
                        body[key] = value;
                    });
                }
                console.log('Parsed body:', JSON.stringify(body, null, 2));
            }
        }
    }
    
    const { trade_order_id, total_fee, status, hash, transaction_id, open_order_id, order_title, nonce_str, time, appid } = body;
    
    console.log('=== Notify Parameters ===');
    console.log('trade_order_id:', trade_order_id);
    console.log('total_fee:', total_fee);
    console.log('status:', status);
    console.log('hash:', hash);
    console.log('transaction_id:', transaction_id);
    console.log('open_order_id:', open_order_id);
    console.log('order_title:', order_title);
    console.log('nonce_str:', nonce_str);
    console.log('time:', time);
    console.log('appid:', appid);
    
    if (!trade_order_id || !status || !hash) {
        console.log('Missing required parameters');
        return { statusCode: 200, body: 'fail' };
    }
    
    const paramsForSign = { ...body };
    delete paramsForSign.hash;
    
    console.log('=== Signature Verification ===');
    console.log('Parameters for sign:', JSON.stringify(paramsForSign));
    
    const calculatedHash = generateXhHash(paramsForSign, APPSECRET);
    console.log('Calculated hash:', calculatedHash);
    console.log('Received hash:', hash);
    
    const isVerified = calculatedHash === hash.toLowerCase();
    console.log('Signature verified:', isVerified);
    
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
        console.log('Calculated hash (decoded):', calculatedHashDecoded);
        
        if (calculatedHashDecoded === hash.toLowerCase()) {
            console.log('Signature verified with decoded params');
            isVerified = true;
        }
    }
    
    if (!isVerified) {
        console.log('Signature verification failed');
        console.log('Invalid hash - returning fail to trigger retry');
        return { statusCode: 200, body: 'fail' };
    }
    
    if (status === 'OD') {
        console.log('Payment successful for order:', trade_order_id);
        console.log('Transaction ID:', transaction_id);
        console.log('Amount:', total_fee);
        
        markOrderPaid(trade_order_id);
        
        const successData = {
            trade_order_id,
            total_fee,
            status: 'paid',
            transaction_id,
            open_order_id,
            updated_at: new Date().toISOString()
        };
        
        console.log('Order marked as paid:', JSON.stringify(successData));
    } else {
        console.log('Order status:', status);
    }
    
    return { statusCode: 200, body: 'success' };
};