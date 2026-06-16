const crypto = require('crypto');
const qs = require('querystring');

const API_URL = "https://api.xunhupay.com/payment/do.html";
const API_URL_BACKUP = "https://api.dpweixin.com/payment/do.html";

const APPID = "201906181673";
const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";

function generateXhHash(params, hashkey) {
    const sortedKeys = Object.keys(params).sort();
    let arg = '';
    sortedKeys.forEach(key => {
        const val = params[key];
        if (key !== 'hash' && val !== null && val !== undefined && val !== '') {
            if (arg) arg += '&';
            arg += key + '=' + val;
        }
    });
    arg += hashkey;
    return crypto.createHash('md5').update(arg).digest('hex').toLowerCase();
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

    const { order_no, price, goods_name } = body;
    
    if (!order_no || !price || !goods_name) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing params: order_no, price, goods_name are required" }) };
    }

    const time = Math.floor(Date.now() / 1000);
    const nonce_str = crypto.randomBytes(16).toString('hex');
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const domain = event.headers.host;

    const params = {
        version: "1.1",
        appid: APPID,
        trade_order_id: order_no,
        total_fee: price,
        title: goods_name,
        time: time,
        notify_url: protocol + "://" + domain + "/.netlify/functions/notify",
        return_url: protocol + "://" + domain + "/result.html",
        nonce_str: nonce_str
    };

    const hash = generateXhHash(params, APPSECRET);
    params.hash = hash;

    const postData = qs.stringify(params);

    console.log('API URL:', API_URL);
    console.log('Post Data:', postData);

    try {
        let response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
            timeout: 10000
        });
        
        let raw = await response.text();
        console.log('Response:', raw);
        
        if (!raw || raw.startsWith('<')) {
            console.log('Try backup URL:', API_URL_BACKUP);
            response = await fetch(API_URL_BACKUP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: postData,
                timeout: 10000
            });
            raw = await response.text();
            console.log('Backup Response:', raw);
        }
        
        let ret;
        try {
            ret = JSON.parse(raw);
        } catch (e) {
            console.error('JSON parse error:', e);
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: 'Invalid response format' }) };
        }

        console.log('Full response object:', JSON.stringify(ret, null, 2));
        console.log('Response keys:', Object.keys(ret));

        if (ret.errcode && ret.errcode !== 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: ret.errmsg || 'Payment API error' }) };
        }

        const openOrderId = ret.open_order_id || ret.order_id || ret.id || ret.openid || '';
        console.log('Open Order ID found:', openOrderId);

        if (ret.url_qrcode || ret.url) {
            return { statusCode: 200, headers, body: JSON.stringify({ 
                code: 0, 
                url_qrcode: ret.url_qrcode,
                url: ret.url,
                pay_url: ret.url_qrcode || ret.url, 
                order_no: order_no,
                open_order_id: openOrderId
            }) };
        } else {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: 'No payment URL returned' }) };
        }
    } catch (err) {
        console.error('Error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ code: -3, msg: err.message }) };
    }
};