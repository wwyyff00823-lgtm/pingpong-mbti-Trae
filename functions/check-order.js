const crypto = require('crypto');

const APPID = "201906181673";
const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";
const QUERY_URL = "https://api.xunhupay.com/payment/query.html";

function generateXhHash(params, hashkey) {
    const cleanParams = { ...params };
    delete cleanParams.hash;
    
    const sortedKeys = Object.keys(cleanParams).filter(key => {
        const val = cleanParams[key];
        return val !== null && val !== undefined && val !== '' && val !== 'undefined';
    }).sort();
    
    console.log('=== Hash Generation ===');
    console.log('Original params:', JSON.stringify(params));
    console.log('Clean params (without hash):', JSON.stringify(cleanParams));
    console.log('Keys to sign:', sortedKeys);
    
    const arg = sortedKeys.map(key => `${key}=${String(cleanParams[key])}`).join('&');
    const finalStr = arg + hashkey;
    
    console.log('String before MD5:', finalStr);
    
    const hash = crypto.createHash('md5').update(finalStr).digest('hex').toLowerCase();
    console.log('Generated hash:', hash);
    
    return hash;
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
        const formData = new URLSearchParams(event.body || '');
        body = {};
        formData.forEach((value, key) => { body[key] = value; });
    }

    const { order_no, open_order_id } = body;
    
    if (!order_no) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing order_no" }) };
    }

    console.log('=== Payment Check Request ===');
    console.log('Order No:', order_no);
    console.log('Open Order ID:', open_order_id);
    
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
            console.log('Using open_order_id:', open_order_id);
        } else {
            params.out_trade_order = order_no;
            console.log('Using out_trade_order:', order_no);
        }

        console.log('Params before hash generation:', JSON.stringify(params));
        
        const generatedHash = generateXhHash(params, APPSECRET);
        
        const finalParams = { ...params };
        finalParams.hash = generatedHash;

        const postData = Object.keys(finalParams).sort().map(key => {
            return `${key}=${encodeURIComponent(finalParams[key])}`;
        }).join('&');

        console.log('=== Sending Request ===');
        console.log('URL:', QUERY_URL);
        console.log('Post Data:', postData);

        const response = await fetch(QUERY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
            timeout: 15000
        });

        console.log('Response status:', response.status);
        const text = await response.text();
        console.log('Raw response:', text);

        try {
            const result = JSON.parse(text);
            console.log('Parsed result:', JSON.stringify(result, null, 2));

            if (!result.errcode || result.errcode === 0 || result.errcode === '0') {
                const status = result.status || result.trade_status;
                if (status === 'OD' || status === 'PAID' || status === 'TRADE_SUCCESS') {
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ code: 0, paid: true, status: status, msg: "Payment confirmed" }) 
                    };
                } else {
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ code: 0, paid: false, status: status, msg: "Order pending" }) 
                    };
                }
            } else {
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ code: result.errcode, paid: false, msg: result.errmsg || 'Error' }) 
                };
            }
        } catch (e) {
            console.log('JSON parse error:', e.message);
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ code: -2, paid: false, msg: 'Invalid response format' }) 
            };
        }
    } catch (error) {
        console.error('Error:', error.message);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ code: -3, paid: false, msg: error.message }) 
        };
    }
};