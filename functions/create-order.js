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
        return { statusCode: 405, headers, body: JSON.stringify({ code: -1, msg: "仅支持POST请求" }) };
    }

    const APPID = "201906181673";
    const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";
    const API_URL = "https://api.xunhupay.com/payment/create";

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "请求体格式错误" }) };
    }

    const { order_no, price, goods_name } = body;
    if (!order_no || !price || !goods_name) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "订单参数缺失" }) };
    }

    const time = Math.floor(Date.now() / 1000);
    const nonce_str = crypto.randomBytes(8).toString('hex');
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const domain = event.headers.host;

    const params = {
        version: "1.1",
        appid: APPID,
        trade_order_id: order_no,
        total_fee: price,
        title: goods_name,
        time: time,
        nonce_str: nonce_str,
        notify_url: `${protocol}://${domain}/.netlify/functions/notify`,
        return_url: `${protocol}://${domain}/result.html`,
        type: "wechat"
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

    console.log('API地址:', API_URL);
    console.log('发送数据:', postData);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData
        });
        const raw = await response.text();
        console.log('响应状态:', response.status);
        console.log('响应数据:', raw);
        
        let ret;
        try {
            ret = JSON.parse(raw);
        } catch (e) {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -99, msg: `非JSON响应: ${raw.substring(0, 50)}` }) };
        }

        if (ret.code === 1 && ret.data) {
            return { statusCode: 200, headers, body: JSON.stringify({ 
                code: 0, 
                pay_url: ret.data.pay_url || ret.data.url || '', 
                order_no: order_no 
            }) };
        } else {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: ret.msg || '支付创建失败' }) };
        }
    } catch (err) {
        console.error('请求异常:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ code: -3, msg: `请求异常：${err.message}` }) };
    }
};