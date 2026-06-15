/**
 * 查询订单状态 - Netlify Function
 * 前端轮询查询订单支付状态
 */

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理OPTIONS请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 获取订单号
        const orderNo = event.queryStringParameters?.order_no;

        if (!orderNo) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: '订单号不能为空' })
            };
        }

        // 在实际生产环境中，这里应该查询数据库获取真实订单状态
        // 目前使用本地存储模拟
        
        // 从请求头或cookie中获取用户标识
        const userId = event.headers['x-user-id'] || 'anonymous';
        
        // 模拟订单状态查询
        // 在真实环境中，应该查询数据库或Redis缓存
        // 这里我们通过LocalStorage在前端模拟，因为是静态网站
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                order_no: orderNo,
                status: 'pending', // pending-待支付, paid-已支付, failed-失败
                message: '订单状态查询成功'
            })
        };

    } catch (error) {
        console.error('查询订单错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: '服务器错误'
            })
        };
    }
};
