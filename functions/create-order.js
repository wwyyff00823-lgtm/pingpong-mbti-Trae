/**
 * 虎皮椒V3支付集成 - Netlify Function
 * 虎皮椒V3 API文档：https://www.xunhupay.com/doc/v3/
 */

const https = require('https');

const HUPIJIAO_CONFIG = {
    appid: process.env.HUPIJIAO_APPID || '',
    appsecret: process.env.HUPIJIAO_APP_SECRET || '',
    notify_url: process.env.HUPIJIAO_NOTIFY_URL || '',
    return_url: process.env.HUPIJIAO_RETURN_URL || '',
    api_host: 'api.xunhupay.com'
};

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

    try {
        const body = JSON.parse(event.body || '{}');
        const { amount = 9.9, mbti_type, level, user_id } = body;

        if (!amount || amount <= 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: '金额无效' })
            };
        }

        const orderNo = `PING${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
        const timestamp = Date.now().toString();
        const trade_order_id = orderNo;
        const total_fee = Math.round(amount * 100).toString();
        const title = '乒乓球MBTI测试报告解锁';
        const description = `解锁${mbti_type || 'ESTP'}人格完整报告`;
        const type = 'wechat';
        const nonce_str = Math.random().toString(36).substr(2, 15);

        const signParams = {
            appid: HUPIJIAO_CONFIG.appid,
            trade_order_id,
            total_fee,
            title,
            type,
            notify_url: HUPIJIAO_CONFIG.notify_url,
            return_url: HUPIJIAO_CONFIG.return_url,
            timestamp,
            nonce_str
        };

        const sign = generateSignV3(signParams);

        const postData = JSON.stringify({
            appid: HUPIJIAO_CONFIG.appid,
            trade_order_id,
            total_fee,
            title,
            type,
            notify_url: HUPIJIAO_CONFIG.notify_url,
            return_url: HUPIJIAO_CONFIG.return_url,
            description,
            timestamp,
            nonce_str,
            sign
        });

        console.log('发送给虎皮椒的数据:', postData);

        const options = {
            hostname: HUPIJIAO_CONFIG.api_host,
            port: 443,
            path: '/v3/payment/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log('虎皮椒V3 API响应状态:', res.statusCode);
                    console.log('虎皮椒V3 API响应原始数据:', data);
                    
                    try {
                        const jsonResult = JSON.parse(data);
                        resolve(jsonResult);
                    } catch (e) {
                        console.error('JSON解析错误:', e.message);
                        reject(new Error('Invalid JSON response: ' + data.substring(0, 100)));
                    }
                });
            });

            req.on('error', (e) => {
                console.error('请求错误:', e);
                reject(e);
            });

            req.write(postData);
            req.end();
        });

        console.log('虎皮椒返回结果:', JSON.stringify(result));

        if (result.code === 0 || result.status === 'success') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    order_no: orderNo,
                    pay_url: result.data?.pay_url || result.pay_url || result.url || '',
                    qr_code_url: result.data?.qrcode || result.qrcode || '',
                    hash: result.data?.hash || result.hash || ''
                })
            };
        } else {
            console.error('虎皮椒API错误:', result);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: result.msg || result.message || result.errmsg || '支付创建失败'
                })
            };
        }
    } catch (error) {
        console.error('创建订单错误:', error);
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
    
    console.log('签名串:', signStr);
    
    return crypto.createHash('md5').update(signStr).digest('hex');
}