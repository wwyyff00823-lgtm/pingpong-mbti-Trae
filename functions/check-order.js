/**
 * 查询订单状态 - Netlify Function (虎皮椒V3)
 */

const https = require('https');

const HUPIJIAO_CONFIG = {
    appid: process.env.HUPIJIAO_APPID || '',
    appsecret: process.env.HUPIJIAO_APP_SECRET || '',
    api_host: 'api.xunhupay.com'
};

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const orderNo = event.queryStringParameters?.order_no;

        if (!orderNo) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: '订单号不能为空' })
            };
        }

        const timestamp = Date.now().toString();
        const nonce_str = Math.random().toString(36).substr(2, 15);

        const signParams = {
            appid: HUPIJIAO_CONFIG.appid,
            trade_order_id: orderNo,
            timestamp,
            nonce_str
        };

        const sign = generateSignV3(signParams);

        const postData = JSON.stringify({
            appid: HUPIJIAO_CONFIG.appid,
            trade_order_id: orderNo,
            timestamp,
            nonce_str,
            sign
        });

        const options = {
            hostname: HUPIJIAO_CONFIG.api_host,
            port: 443,
            path: '/v3/payment/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log('虎皮椒V3查询订单响应:', data);
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.error('JSON解析错误:', e.message);
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });

        if (result.code === 0 || result.status === 'success') {
            const status = result.data?.status || result.status;
            let orderStatus = 'pending';
            
            if (status === 'success' || status === 'paid' || status === 'OD') {
                orderStatus = 'paid';
            } else if (status === 'pending' || status === 'WP') {
                orderStatus = 'pending';
            } else if (status === 'failed' || status === 'CD') {
                orderStatus = 'failed';
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    order_no: orderNo,
                    status: orderStatus,
                    message: '订单状态查询成功',
                    hupijiao_status: status
                })
            };
        } else {
            console.error('虎皮椒查询失败:', result);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: result.msg || result.message || '查询失败'
                })
            };
        }

    } catch (error) {
        console.error('查询订单错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: '服务器错误: ' + error.message
            })
        };
    }
};

function generateSignV3(params) {
    const crypto = require('crypto');
    
    const sortedKeys = Object.keys(params).sort();
    let signStr = sortedKeys.map(key => {
        const value = params[key];
        if (value === undefined || value === null || value === '') {
            return '';
        }
        return `${key}=${value}`;
    }).filter(item => item !== '').join('&');
    
    signStr += '&appsecret=' + HUPIJIAO_CONFIG.appsecret;
    
    return crypto.createHash('md5').update(signStr).digest('hex');
}