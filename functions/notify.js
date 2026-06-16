const crypto = require('crypto');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');

const APPSECRET = "685ed8bb1d5468e8771aaee1109913c4";

function getOrdersFilePath() {
    return path.join(__dirname, '../orders.json');
}

function loadOrders() {
    try {
        const data = fs.readFileSync(getOrdersFilePath(), 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

function saveOrders(orders) {
    fs.writeFileSync(getOrdersFilePath(), JSON.stringify(orders, null, 2));
}

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
        console.log('Invalid method:', event.httpMethod);
        return { statusCode: 200, body: "fail" };
    }

    let body = {};
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    console.log('Content-Type:', contentType);
    
    if (contentType.includes('application/json')) {
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            console.log('JSON parse error:', e);
            return { statusCode: 200, body: "fail" };
        }
    } else {
        body = qs.parse(event.body || '');
    }

    console.log('Notify body:', body);

    const { trade_order_id, status, hash, total_fee } = body;
    
    if (!trade_order_id) {
        console.log('Missing trade_order_id');
        return { statusCode: 200, body: "fail" };
    }

    const params = { ...body };
    delete params.hash;
    const calcHash = generateXhHash(params, APPSECRET);

    console.log('Calculated hash:', calcHash);
    console.log('Received hash:', hash);

    if (calcHash !== hash) {
        console.log('Sign error:', calcHash, hash);
        return { statusCode: 200, body: "fail" };
    }

    if (status === 'OD') {
        console.log('Payment successful for order:', trade_order_id);
        const orders = loadOrders();
        orders[trade_order_id] = {
            paid: true,
            paidAt: Date.now(),
            status: status,
            total_fee: total_fee,
            transaction_id: body.transaction_id,
            open_order_id: body.open_order_id
        };
        saveOrders(orders);
        return { statusCode: 200, body: "success" };
    } else if (status === 'CD') {
        console.log('Order refunded:', trade_order_id);
        const orders = loadOrders();
        if (orders[trade_order_id]) {
            orders[trade_order_id].status = 'refunded';
            orders[trade_order_id].refundedAt = Date.now();
            saveOrders(orders);
        }
        return { statusCode: 200, body: "success" };
    }

    console.log('Unknown status:', status);
    return { statusCode: 200, body: "success" };
};