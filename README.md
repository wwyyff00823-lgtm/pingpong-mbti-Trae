# 乒乓球MBTI测试 - 虎皮椒支付集成指南

## ⚠️ 重要安全提醒

**支付凭证信息非常敏感，请务必保密！**

- ✅ 所有敏感信息已存储在环境变量中
- ✅ `.gitignore` 已配置，防止提交敏感文件
- ⚠️ **请勿将 `.env` 文件提交到GitHub或公开仓库！**
- ⚠️ **请勿在代码中硬编码APPID和APPSECRET！**

## 项目概述

这是一个基于静态网站的乒乓球MBTI风格测试应用，集成了虎皮椒支付功能。用户可以通过微信或支付宝支付9.9元解锁完整的人格分析报告。

## 目录结构

```
PING/
├── index.html           # 首页（水平选择）
├── quiz.html           # 答题页
├── result.html         # 结果页（支付和解锁）
├── netlify.toml        # Netlify部署配置
└── functions/         # Netlify Functions（后端接口）
    ├── create-order.js  # 创建支付订单
    ├── check-order.js   # 查询订单状态
    └── notify.js        # 支付回调处理
```

## 虎皮椒支付配置

### 1. 注册虎皮椒账号

1. 访问 [虎皮椒官网](https://www.xunhupay.com/)
2. 注册并登录账号
3. 申请商户接入（微信支付/支付宝）
4. 获取 APPID 和 APPSECRET

### 2. 配置Netlify环境变量

在Netlify后台设置以下环境变量：

- `HUPIJIAO_APPID` - 虎皮椒应用ID
- `HUPIJIAO_APP_SECRET` - 虎皮椒应用密钥
- `HUPIJIAO_NOTIFY_URL` - 支付回调地址（格式：`https://你的域名/.netlify/functions/notify`）
- `HUPIJIAO_RETURN_URL` - 支付完成返回地址（格式：`https://你的域名/result.html`）

### 3. 配置虎皮椒后台

在虎皮椒商户后台配置：

- **支付回调地址**：`https://你的域名/.netlify/functions/notify`
- **支付成功跳转**：`https://你的域名/result.html`

## Netlify部署步骤

### 方法1：GitHub部署（推荐）

1. 将PING文件夹内容推送到GitHub仓库
2. 登录 [Netlify](https://www.netlify.com/)
3. 点击 "New site from Git"
4. 连接你的GitHub仓库
5. 设置构建命令（留空，静态站点无需构建）
6. 设置发布目录：`/`
7. 点击 "Deploy site"

### 方法2：直接上传

1. 将所有文件打包
2. 登录 [Netlify](https://www.netlify.com/)
3. 拖拽文件到部署区域

### 3. 配置域名（可选）

1. 在Netlify后台添加自定义域名
2. 配置SSL证书（Netlify自动配置）
3. 更新虎皮椒后台的回调地址为你的真实域名

## 支付流程

### 1. 用户点击支付

```
用户点击"¥9.9 立即解锁" 
    ↓
前端调用 /.netlify/functions/create-order
    ↓
后端调用虎皮椒API创建订单
    ↓
返回支付二维码URL
    ↓
前端显示二维码
```

### 2. 用户扫码支付

```
用户使用微信/支付宝扫码支付
    ↓
虎皮椒处理支付
    ↓
虎皮椒回调 notify 接口
    ↓
后端记录支付成功
```

### 3. 前端轮询确认

```
前端每3秒轮询 /.netlify/functions/check-order
    ↓
查询订单支付状态
    ↓
如果已支付 → 解锁完整报告
```

## 重要配置项

### 修改支付金额

在 `functions/create-order.js` 第54行：

```javascript
const title = '乒乓球MBTI测试报告解锁';
const total_fee = (9.9 * 100).toString(); // 金额，单位：分
```

### 修改产品描述

在 `functions/create-order.js` 第55行：

```javascript
const description = `解锁${mbti_type || 'ESTP'}人格完整报告`;
```

### 支付成功后的处理

在 `functions/notify.js` 第56-60行添加数据库操作：

```javascript
if (status === 'OD') {
    // 支付成功
    console.log(`订单 ${trade_order_id} 支付成功`);
    
    // TODO: 更新数据库中的订单状态
    // TODO: 记录支付信息
    
    return {
        statusCode: 200,
        body: JSON.stringify({ errcode: 0, errmsg: 'success' })
    };
}
```

## 调试技巧

### 1. 查看Netlify日志

在Netlify后台的 "Functions" 标签页查看函数执行日志

### 2. 本地测试

```bash
# 安装Netlify CLI
npm install -g netlify-cli

# 本地启动函数
netlify functions:serve

# 访问 http://localhost:9999/.netlify/functions/create-order
```

### 3. 支付测试

使用虎皮椒的沙箱环境进行测试（需要申请沙箱账号）

## 注意事项

### 1. HTTPS必须

- 微信支付要求回调地址必须是HTTPS
- 确保Netlify已配置SSL证书（自动配置）

### 2. 回调地址配置

- 虎皮椒后台的回调地址必须与代码中配置一致
- 使用自定义域名时，确保域名已备案（支付宝要求）

### 3. 订单状态同步

- 前端轮询最多30次（90秒）
- 建议在回调中同时更新数据库和缓存

### 4. 重复支付防护

- 在数据库中检查订单是否已支付
- 虎皮椒会自动防止重复下单

## 虎皮椒API文档

- 官方文档：https://www.xunhupay.com/doc/
- 支付接口：https://www.xunhupay.com/doc/payment/api.html
- 回调通知：https://www.xunhupay.com/doc/payment/notify.html

## 常见问题

### Q: 支付成功但前端没有自动解锁？

A: 检查：
1. 回调接口是否正确返回 `{ errcode: 0, errmsg: 'success' }`
2. 数据库是否正确更新了订单状态
3. 前端轮询接口是否正常工作

### Q: 回调地址无法访问？

A: 检查：
1. 域名是否配置SSL证书
2. 函数是否正确部署
3. 回调地址是否与虎皮椒后台配置一致

### Q: 微信支付提示签名错误？

A: 检查：
1. APPID和APPSECRET是否正确
2. 签名算法是否按照虎皮椒要求实现
3. 签名参数是否按字母顺序排列

## 联系支持

- 虎皮椒客服：https://www.xunhupay.com/contact.html
- Netlify支持：https://www.netlify.com/support/

---

**祝您部署顺利！如有其他问题，请随时联系。**
