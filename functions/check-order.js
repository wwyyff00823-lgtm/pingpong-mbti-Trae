# 更新check-order.js
cat > /Users/figowang/Desktop/PING/functions/check-order.js << 'EOF'
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

    return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: false, msg: "未支付" }) };
};
EOF

echo "=== check-order.js 已更新 ==="