/**
 * 查询订单状态 - Netlify Function
 * 调用虎皮椒API查询真实订单状态
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

        const timestamp = Math.floor(Date.now() / 1000).toString();
        
        const signParams = {
            appid: HUPIJIAO_CONFIG.appid,
            timestamp,
            trade_order_id: orderNo
        };

        const sign = generateSign(signParams);

        const postData = JSON.stringify({
            version: '1.1',
            appid: HUPIJIAO_CONFIG.appid,
            trade_order_id: orderNo,
            timestamp,
            sign
        });

        const options = {
            hostname: HUPIJIAO_CONFIG.api_host,
            port: 443,
            path: '/payment/query',
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
                    console.log('虎皮椒查询订单响应:', data);
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.error('JSON解析错误:', e.message, '原始数据:', data);
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

        if (result.errcode === 0) {
            let status = 'pending';
            if (result.status === 'OD') {
                status = 'paid';
            } else if (result.status === 'WP') {
                status = 'pending';
            } else if (result.status === 'CD') {
                status = 'failed';
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    order_no: orderNo,
                    status: status,
                    message: '订单状态查询成功',
                    hupijiao_status: result.status
                })
            };
        } else {
            console.error('虎皮椒查询失败:', result);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: result.errmsg || '查询失败'
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

function generateSign(params) {
    const crypto = require('crypto');
    
    const sortedKeys = Object.keys(params).sort();
    let signStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    signStr += '&appsecret=' + HUPIJIAO_CONFIG.appsecret;
    
    return crypto.createHash('md5').update(signStr).digest('hex');
}