# 🔐 Netlify环境变量配置指南

## ⚠️ 重要安全提醒

**您的虎皮椒凭证信息非常敏感，请务必保密！**

- ✅ 已创建 `.env` 文件供本地测试
- ✅ 已创建 `.gitignore` 防止提交敏感信息
- ⚠️ **请勿将 `.env` 文件提交到GitHub！**

## Netlify环境变量配置步骤

### 1. 登录Netlify后台

访问：https://app.netlify.com/

### 2. 选择您的站点

点击您部署的站点名称

### 3. 进入环境变量设置

Site settings → Environment variables → Add a variable

### 4. 添加以下环境变量

**变量1：**
```
Key: HUPIJIAO_APPID
Value: 201906181673
```

**变量2：**
```
Key: HUPIJIAO_APP_SECRET
Value: 685ed8bb1d5468e8771aaee1109913c4
```

**变量3：**
```
Key: HUPIJIAO_NOTIFY_URL
Value: https://您的Netlify域名/.netlify/functions/notify
例如：https://ping-mbti-test.netlify.app/.netlify/functions/notify
```

**变量4：**
```
Key: HUPIJIAO_RETURN_URL
Value: https://您的Netlify域名/result.html
例如：https://ping-mbti-test.netlify.app/result.html
```

### 5. 保存并重新部署

点击 "Save" 后，Netlify会自动重新部署站点

## 虎皮椒后台配置

### 1. 登录虎皮椒商户后台

访问：https://www.xunhupay.com/

### 2. 配置支付回调地址

在"支付设置"中填写：

**微信支付回调：**
```
https://您的Netlify域名/.netlify/functions/notify
```

**支付宝回调：**
```
https://您的Netlify域名/.netlify/functions/notify
```

### 3. 配置支付成功跳转

```
https://您的Netlify域名/result.html
```

## 本地测试

### 1. 安装Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. 本地运行

```bash
cd /Users/figowang/Desktop/PING
netlify functions:serve
```

### 3. 访问测试

```
http://localhost:9999
```

## 安全检查清单

部署前请确认：

- ✅ `.env` 文件已添加到 `.gitignore`
- ✅ `.env` 文件不会被提交到GitHub
- ✅ Netlify环境变量已正确配置
- ✅ 虎皮椒后台回调地址已配置
- ✅ 支付凭证未在代码中硬编码

## 支付流程测试

1. 访问部署后的网站
2. 完成MBTI测试
3. 点击"¥9.9 立即解锁"
4. 扫码支付（使用虎皮椒沙箱账号测试）
5. 确认支付成功后自动解锁报告

## 遇到问题？

### 查看Netlify Functions日志

Netlify后台 → Functions → 点击函数名称 → 查看日志

### 常见错误

1. **签名错误**
   - 检查环境变量是否正确配置
   - 检查APPID和APPSECRET是否匹配

2. **回调失败**
   - 检查回调地址是否可访问
   - 检查是否使用HTTPS

3. **支付失败**
   - 检查虎皮椒商户状态
   - 检查支付限额设置

---

**祝您部署顺利！用户支付的钱会直接进入您的虎皮椒账户！**