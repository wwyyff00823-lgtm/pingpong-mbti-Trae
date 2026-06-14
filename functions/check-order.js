const { ORDERS } = require('./create-order');

exports.handler = async (event, context) => {
    try {
        const { orderNo } = event.queryStringParameters;

        if (!orderNo) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: '缺少订单号' })
            };
        }

        const order = ORDERS[orderNo];

        if (!order) {
            return {
                statusCode: 404,
                body: JSON.stringify({ success: false, message: '订单不存在' })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                orderNo: order.orderNo,
                status: order.status,
                amount: order.amount,
                level: order.level,
                mbtiType: order.mbtiType,
                createdAt: order.createdAt
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: '服务器错误' })
        };
    }
};