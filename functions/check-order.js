const crypto = require('crypto');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');

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

    let body = JSON.parse(event.body || '{}');
    const { order_no } = body;
    
    if (!order_no) {
        return { statusCode: 400, headers, body: JSON.stringify({ code: -1, msg: "Missing order_no" }) };
    }

    const orders = loadOrders();
    const order = orders[order_no];
    
    if (order && order.paid) {
        return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: true, msg: "Paid" }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ code: 0, paid: false, msg: "Not paid" }) };
};