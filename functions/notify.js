const { ORDERS } = require('./create-order');

exports.handler = async (event, context) => {
    try {
        const body = JSON.parse(event.body);
        const { orderNo, status } = body;

        if (!orderNo || !status) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: '缺少必要参数' })
            };
        }

        const order = ORDERS[orderNo];

        if (!order) {
            return {
                statusCode: 404,
                body: JSON.stringify({ success: false, message: '订单不存在' })
            };
        }

        order.status = status;
        order.updatedAt = new Date().toISOString();

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                message: `订单状态已更新为${status}`,
                orderNo: order.orderNo,
                status: order.status
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: '服务器错误' })
        };
    }
};