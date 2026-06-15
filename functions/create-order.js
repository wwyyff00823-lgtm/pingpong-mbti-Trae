/**
 * 虎皮椒支付集成 - Netlify Function
 * 虎皮椒API文档：https://www.xunhupay.com/doc/
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
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const trade_order_id = orderNo;
        const total_fee = (amount * 100).toString();
        const title = '乒乓球MBTI测试报告解锁';
        const description = `解锁${mbti_type || 'ESTP'}人格完整报告`;
        const type = 'wechat';
        const nonce_str = Math.random().toString(36).substr(2, 15);

        const signParams = {
            appid: HUPIJIAO_CONFIG.appid,
            timestamp,
            trade_order_id,
            total_fee,
            title,
            type,
            nonce_str
        };

        const sign = generateSign(signParams);

        const postData = JSON.stringify({
            version: '1.1',
            appid: HUPIJIAO_CONFIG.appid,
            trade_order_id,
            total_fee,
            title,
            type,
            timestamp,
            notify_url: HUPIJIAO_CONFIG.notify_url,
            return_url: HUPIJIAO_CONFIG.return_url,
            description,
            nonce_str,
            sign
        });

        const options = {
            hostname: HUPIJIAO_CONFIG.api_host,
            port: 443,
            path: '/payment/index.html',
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
                    console.log('虎皮椒API响应状态:', res.statusCode);
                    console.log('虎皮椒API响应原始数据:', data.substring(0, 800));
                    
                    try {
                        let jsonResult;
                        if (data.trim().startsWith('<')) {
                            console.log('响应是XML格式，尝试转换');
                            jsonResult = xmlToJson(data);
                        } else {
                            jsonResult = JSON.parse(data);
                        }
                        resolve(jsonResult);
                    } catch (e) {
                        console.error('解析错误:', e.message);
                        console.error('原始响应:', data);
                        reject(new Error('解析响应失败: ' + data.substring(0, 100)));
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

        if (result.errcode === 0 && result.payurl) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    order_no: orderNo,
                    pay_url: result.payurl,
                    qr_code_url: result.qrcode || null,
                    hash: result.hash || null
                })
            };
        } else {
            console.error('虎皮椒API错误:', result);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: result.errmsg || '支付创建失败'
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

function generateSign(params) {
    const crypto = require('crypto');
    
    const sortedKeys = Object.keys(params).sort();
    let signStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    signStr += '&appsecret=' + HUPIJIAO_CONFIG.appsecret;
    
    return crypto.createHash('md5').update(signStr).digest('hex');
}

function xmlToJson(xml) {
    const result = {};
    const regex = /<(\w+)[^>]*>([^<]*)</g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
        const key = match[1].toLowerCase();
        let value = match[2].trim();
        
        if (!isNaN(value)) {
            value = parseFloat(value);
        }
        
        if (result[key]) {
            if (!Array.isArray(result[key])) {
                result[key] = [result[key]];
            }
            result[key].push(value);
        } else {
            result[key] = value;
        }
    }
    
    return result;
}