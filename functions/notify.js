/**
 * 虎皮椒支付回调处理 - Netlify Function
 * 处理微信/支付宝支付完成后的回调通知
 */

exports.handler = async function(event, context) {
    // 虎皮椒配置
    const HUPIJIAO_CONFIG = {
        appid: process.env.HUPIJIAO_APPID || 'YOUR_APP_ID',
        appsecret: process.env.HUPIJIAO_APP_SECRET || 'YOUR_APP_SECRET'
    };

    try {
        // 解析回调数据
        const body = JSON.parse(event.body || '{}');
        
        console.log('收到虎皮椒回调:', body);

        // 验证签名
        const { 
            status, 
            trade_order_id, 
            total_fee, 
            paid_time,
            transaction_id,
            sign 
        } = body;

        // 构造签名验证参数
        const crypto = require('crypto');
        const signParams = {
            appid: HUPIJIAO_CONFIG.appid,
            appsecret: HUPIJIAO_CONFIG.appsecret,
            status,
            trade_order_id,
            total_fee
        };

        // 生成签名
        const sortedKeys = Object.keys(signParams).sort();
        const signStr = sortedKeys.map(key => `${key}=${signParams[key]}`).join('&');
        const calculatedSign = crypto.createHash('md5').update(signStr).digest('hex');

        // 验证签名
        if (calculatedSign !== sign) {
            console.error('签名验证失败');
            return {
                statusCode: 400,
                body: JSON.stringify({ errcode: 1, errmsg: '签名验证失败' })
            };
        }

        // 处理支付成功
        if (status === 'OD') {
            // 支付成功
            console.log(`订单 ${trade_order_id} 支付成功`);
            
            // 在这里可以更新您的数据库
            // 例如：更新订单状态、记录支付信息等
            
            // 返回成功响应
            return {
                statusCode: 200,
                body: JSON.stringify({ errcode: 0, errmsg: 'success' })
            };
        } else if (status === 'WP') {
            // 未支付
            console.log(`订单 ${trade_order_id} 未支付`);
            return {
                statusCode: 200,
                body: JSON.stringify({ errcode: 0, errmsg: 'success' })
            };
        } else {
            // 其他状态
            console.log(`订单 ${trade_order_id} 状态: ${status}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ errcode: 0, errmsg: 'success' })
            };
        }
    } catch (error) {
        console.error('处理回调错误:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ errcode: 1, errmsg: '服务器错误' })
        };
    }
};
