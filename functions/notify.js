# 更新notify.js
cat > /Users/figowang/Desktop/PING/functions/notify.js << 'EOF'
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

    const { trade_order_id, status, hash } = body;
    
    const params = { ...body };
    delete params.hash;
    const calcHash = generateXhHash(params, APPSECRET);

    if (calcHash !== hash) {
        console.log('签名验证失败:', calcHash, hash);
        return { statusCode: 200, body: "fail" };
    }

    if (status === 'OD') {
        console.log(`订单 ${trade_order_id} 支付成功`);
        return { statusCode: 200, body: "success" };
    }

    return { statusCode: 200, body: "success" };
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

echo "=== notify.js 已更新 ==="