const crypto = require('crypto');

const ORDERS = {};

function generateOrderNo() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `PING${timestamp}${random.toUpperCase()}`;
}

exports.handler = async (event, context) => {
    try {
        const body = JSON.parse(event.body);
        const { amount = 9.9, userId, ip, level, mbtiType } = body;

        if (!userId || !level || !mbtiType) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: '缺少必要参数' })
            };
        }

        const orderNo = generateOrderNo();
        const order = {
            orderNo,
            amount,
            userId,
            ip,
            level,
            mbtiType,
            status: 'pending',
            createdAt: new Date().toISOString(),
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderNo)}`
        };

        ORDERS[orderNo] = order;

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                orderNo,
                amount,
                qrCodeUrl: order.qrCodeUrl,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: '服务器错误' })
        };
    }
};

module.exports = { ORDERS };