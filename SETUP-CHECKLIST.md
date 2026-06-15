# 🚀 虎皮椒支付配置清单

## 第一步：注册虎皮椒（10分钟）

1. **访问官网**：https://www.xunhupay.com/
2. **注册账号**：使用手机号注册
3. **申请商户**：
   - 微信支付商户（个人/企业）
   - 支付宝商户（个人/企业）
4. **获取凭证**：
   - ✅ APP ID
   - ✅ APP SECRET

## 第二步：配置Netlify环境变量（5分钟）

在 Netlify 后台 → Site settings → Environment variables：

```
HUPIJIAO_APPID = 你的APPID
HUPIJIAO_APP_SECRET = 你的APPSECRET
HUPIJIAO_NOTIFY_URL = https://你的域名/.netlify/functions/notify
HUPIJIAO_RETURN_URL = https://你的域名/result.html
```

## 第三步：部署代码（5分钟）

1. **推送代码到GitHub**
2. **Netlify连接仓库**
3. **设置发布目录**：`/`
4. **点击Deploy**

## 第四步：配置虎皮椒后台（5分钟）

在虎皮椒商户后台：

1. **支付设置** → 回调地址：
   ```
   https://你的域名/.netlify/functions/notify
   ```

2. **支付成功跳转**：
   ```
   https://你的域名/result.html
   ```

## 第五步：测试支付（5分钟）

1. 访问部署好的网站
2. 完成测试答题
3. 点击"¥9.9立即解锁"
4. 扫码支付
5. 确认收到款项

---

## ⚠️ 重要提醒

### 域名配置

- ✅ 必须使用HTTPS（Netlify自动提供）
- ✅ 回调地址必须与代码中一致
- ⚠️ 支付宝要求域名已备案（国内服务器）

### 测试vs生产

- 开发环境（localhost）：使用模拟支付
- 生产环境：使用真实虎皮椒支付

### 订单状态同步

当前使用LocalStorage模拟订单状态，生产环境需要：
- 连接数据库（推荐：Netlify + FaunaDB/Supabase）
- 或使用Redis缓存

## 📞 遇到问题？

1. **查看Netlify Functions日志**
   - Netlify后台 → Functions → 查看日志

2. **常见错误排查**
   - 签名错误 → 检查APPID和APPSECRET
   - 回调失败 → 检查回调地址是否可访问
   - 支付失败 → 检查虎皮椒商户状态

3. **联系支持**
   - 虎皮椒：https://www.xunhupay.com/contact.html
   - Netlify：https://www.netlify.com/support/

---

**完成以上步骤后，用户扫码支付的钱会直接到你的虎皮椒账户！**
