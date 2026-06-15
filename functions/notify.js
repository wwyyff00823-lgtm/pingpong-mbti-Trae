const crypto = require('crypto');
const qs = require('querystring');

exports.handler = async function(event, context) {
    const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";
    
    let body = {};
    if (event.httpMethod === 'POST') {
        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        if (contentType.includes('application/json')) {
            try {
                body = JSON.parse(event.body || '{}');
            } catch (e) {
                body = qs.parse(event.body || '');
            }
        } else {
            body = qs.parse(event.body || '');
        }
    } else {
        body = event.queryStringParameters || {};
    }

    console.log('收到回调:', body);

    const { trade_order_id, trade_status, sign } = body;
    if (!trade_order_id || !sign || trade_status !== "SUCCESS") {
        return { statusCode: 200, body: "fail" };
    }

    const params = { ...body };
    delete params.sign;
    
    const keys = Object.keys(params).sort();
    let signStr = '';
    keys.forEach(key => {
        if (params[key] !== '' && params[key] !== undefined) {
            signStr += `${key}=${params[key]}&`;
        }
    });
    signStr = signStr.slice(0, -1);
    signStr += '&key=' + APPSECRET;
    const calcSign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    if (calcSign !== sign) {
        console.log('签名验证失败:', calcSign, sign);
        return { statusCode: 200, body: "fail" };
    }

    return { statusCode: 200, body: "success" };
};