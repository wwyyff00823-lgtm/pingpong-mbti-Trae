const crypto = require('crypto');

const ALLOWED_ORIGINS = [
    'https://harmonious-cactus-ff7aac.netlify.app',
    'http://localhost:8888',
    'http://localhost:9999'
];

exports.handler = async function(event, context) {
    const origin = event.headers.origin || event.headers.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    
    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    let existingUserId = '';
    
    if (event.httpMethod === 'POST') {
        let body;
        try {
            body = JSON.parse(event.body || '{}');
            existingUserId = body.userId || '';
        } catch (e) {
            // ignore
        }
    }

    let userId;
    
    if (existingUserId && existingUserId.length >= 32) {
        userId = existingUserId;
    } else {
        userId = crypto.randomBytes(16).toString('hex');
    }

    return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ 
            code: 0, 
            userId: userId,
            msg: "Success" 
        }) 
    };
};