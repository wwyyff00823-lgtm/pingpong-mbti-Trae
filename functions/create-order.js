# 强制重新写入create-order.js
cat > /Users/figowang/Desktop/PING/functions/create-order.js << 'EOF'
const crypto = require('crypto');
const qs = require('querystring');

const API_URL = "https://api.xunhupay.com/payment/do.html";
const API_URL_BACKUP = "https://api.dpweixin.com/payment/do.html";

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
        notify_url: `${protocol}://${domain}/.netlify/functions/notify`,
        return_url: `${protocol}://${domain}/result.html`,
        nonce_str: nonce_str
    };

    const hash = generateXhHash(params, APPSECRET);
    params.hash = hash;

    const postData = qs.stringify(params);

    console.log('=== 虎皮椒请求 ===');
    console.log('API地址:', API_URL);
    console.log('发送数据:', postData);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Node.js)'
            },
            body: postData,
            timeout: 30000
        });
        
        const raw = await response.text();
        console.log('响应状态:', response.status);
        console.log('响应数据:', raw);
        
        if (!raw || raw.startsWith('<')) {
            console.log('尝试备用API地址:', API_URL_BACKUP);
            const backupResponse = await fetch(API_URL_BACKUP, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Node.js)'
                },
                body: postData,
                timeout: 30000
            });
            const backupRaw = await backupResponse.text();
            console.log('备用地址响应:', backupRaw);
            
            if (!backupRaw || backupRaw.startsWith('<')) {
                return { statusCode: 200, headers, body: JSON.stringify({ code: -99, msg: "API调用失败，请稍后重试" }) };
            }
            raw = backupRaw;
        }
        
        let ret;
        try {
            ret = JSON.parse(raw);
        } catch (e) {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -99, msg: `JSON解析失败: ${e.message}` }) };
        }

        if (ret.errcode && ret.errcode !== 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: ret.errmsg || '支付创建失败' }) };
        }

        if (ret.url_qrcode || ret.url) {
            return { statusCode: 200, headers, body: JSON.stringify({ 
                code: 0, 
                pay_url: ret.url || ret.url_qrcode, 
                order_no: order_no 
            }) };
        } else {
            return { statusCode: 200, headers, body: JSON.stringify({ code: -2, msg: '未获取到支付链接' }) };
        }
    } catch (err) {
        console.error('请求异常:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ code: -3, msg: `请求异常：${err.message}` }) };
    }
};

function generateXhHash(params, hashkey) {
    const sortedKeys = Object.keys(params).sort();
    let arg = '';
    sortedKeys.forEach(key => {
        const val = params[key];
        if (key !== 'hash' && val !== null && val !== undefined && val !== '') {
            if (arg) arg += '&';
            arg += `${key}=${val}`;
        }
    });
    arg += hashkey;
    return crypto.createHash('md5').update(arg).digest('hex').toLowerCase();
}
EOF

echo ""
echo "=== 文件已重新写入 ==="
cat /Users/figowang/Desktop/PING/functions/create-order.js | grep "API_URL"