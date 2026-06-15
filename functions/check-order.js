const crypto = require('crypto');
const qs = require('querystring');

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
        return { statusCode: 405, headers, body: JSON.stringify({ code: -1, msg: "仅支持POST" }) };
    }

    const APPID = "201906181673";
    const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";
    const QUERY_URL = "https://api.xunhupay.com/payment/query";

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "请求体格式错误" }) };
    }

    const { order_no } = body;
    if (!order_no) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "订单号不能为空" }) };
    }

    const time = Math.floor(Date.now() / 1000);
    const nonce_str = crypto.randomBytes(8).toString('hex');

    const params = {
        version: "1.1",
        appid: APPID,
        trade_order_id: order_no,
        time: time,
        nonce_str: nonce_str
    };

    const keys = Object.keys(params).sort();
    let signStr = '';
    keys.forEach(key => {
        if (params[key] !== '' && params[key] !== undefined) {
            signStr += `${key}=${params[key]}&`;
        }
    });
    signStr = signStr.slice(0, -1);
    signStr += '&key=' + APPSECRET;
    const sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    params.sign = sign;

    const postData = qs.stringify(params);

    try {
        const resp = await fetch(QUERY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData
        });
        const raw = await resp.text();
        console.log('查询结果:', raw);
        
        const ret = JSON.parse(raw);

        if (ret.code === 1 && ret.data && ret.data.trade_status === "SUCCESS") {
            return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: true }) };
        } else {
            return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: false, msg: ret.msg || "未支付" }) };
        }
    } catch (err) {
        console.error('查询异常:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ code: -2, msg: `查询异常：${err.message}` }) };
    }
};