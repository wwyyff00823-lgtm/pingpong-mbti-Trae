const crypto = require('crypto');
const qs = require('querystring');

const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";

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

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'text/plain'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: 'ok' };
    }

    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return { statusCode: 200, headers, body: "fail" };
    }

    const rawBody = event.body || '';
    console.log('Raw body:', rawBody);
    
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    console.log('Content-Type:', contentType);
    
    let body = {};
    if (contentType.includes('application/json')) {
        try {
            body = JSON.parse(rawBody);
        } catch (e) {
            console.log('JSON parse error:', e);
            return { statusCode: 200, headers, body: "fail" };
        }
    } else {
        body = qs.parse(rawBody);
    }

    console.log('Parsed body:', JSON.stringify(body));

    const { trade_order_id, status, hash } = body;
    
    if (!trade_order_id) {
        console.log('Missing trade_order_id');
        return { statusCode: 200, headers, body: "fail" };
    }

    if (!status) {
        console.log('Missing status');
        return { statusCode: 200, headers, body: "fail" };
    }

    if (!hash) {
        console.log('Missing hash');
        return { statusCode: 200, headers, body: "fail" };
    }

    const paramsForHash = {};
    Object.keys(body).forEach(key => {
        if (key !== 'hash') {
            paramsForHash[key] = body[key];
        }
    });
    
    const calcHash = generateXhHash(paramsForHash, APPSECRET);

    console.log('Hash verification:');
    console.log('  Calculated:', calcHash);
    console.log('  Received:', hash);

    if (calcHash !== hash) {
        console.log('Hash verification FAILED');
        console.log('Trying with decoded values...');
        
        const decodedParams = {};
        Object.keys(body).forEach(key => {
            if (key !== 'hash') {
                try {
                    decodedParams[key] = decodeURIComponent(body[key]);
                } catch (e) {
                    decodedParams[key] = body[key];
                }
            }
        });
        const decodedHash = generateXhHash(decodedParams, APPSECRET);
        console.log('  Decoded hash:', decodedHash);
        
        if (decodedHash === hash) {
            console.log('Hash verified with decoded values');
        } else {
            console.log('Hash verification FAILED with both methods');
            return { statusCode: 200, headers, body: "fail" };
        }
    } else {
        console.log('Hash verification PASSED');
    }

    if (status !== 'OD') {
        console.log('Invalid status:', status);
        return { statusCode: 200, headers, body: "success" };
    }

    console.log('Payment SUCCESS for order:', trade_order_id);
    console.log('Transaction ID:', body.transaction_id);
    console.log('Total fee:', body.total_fee);

    return { statusCode: 200, headers, body: "success" };
};