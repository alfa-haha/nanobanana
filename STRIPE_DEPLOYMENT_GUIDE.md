# Stripe支付系统部署指南

## 📋 概述

本指南详细说明如何部署Nano Banana AI的Stripe支付和积分管理系统。

## 🛠️ 系统架构

```
前端 (HTML/CSS/JS)
    ↓
Express.js API服务器
    ↓
Stripe支付处理 + Supabase数据库
```

## 📦 安装依赖

```bash
# 安装Node.js依赖
npm install

# 或使用yarn
yarn install
```

## ⚙️ 环境配置

确保`.env`文件包含以下配置：

```env
# Stripe配置
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 服务器配置
PORT=3000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## 🚀 启动服务器

### 开发环境
```bash
npm run dev
```

### 生产环境
```bash
npm start
```

## 🧪 测试功能

### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

### 2. 积分购买测试
访问: `http://localhost:3000/test/credits`

### 3. Stripe支付测试
访问: `http://localhost:3000/test/stripe`

## 📊 API端点

### Stripe支付相关

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/stripe/create-subscription-checkout` | POST | 创建订阅支付会话 |
| `/api/stripe/create-credits-checkout` | POST | 创建积分购买会话 |
| `/api/stripe/subscription-status/:userId` | GET | 获取订阅状态 |
| `/api/stripe/cancel-subscription` | POST | 取消订阅 |
| `/api/stripe/update-subscription` | POST | 更新订阅计划 |
| `/api/stripe/payment-success` | POST | 处理支付成功 |
| `/api/stripe/webhook` | POST | Stripe Webhook处理 |

### 积分管理相关

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/user/credits/:userId` | GET | 获取用户积分余额 |
| `/api/user/use-credits` | POST | 使用积分 |
| `/api/user/add-credits` | POST | 添加积分 |
| `/api/user/credit-transactions/:userId` | GET | 获取交易历史 |
| `/api/user/credit-stats/:userId` | GET | 获取积分统计 |
| `/api/user/check-credits-balance/:userId` | GET | 检查积分余额 |

## 🔐 安全配置

### 1. JWT认证
- 所有API端点都需要有效的JWT token
- Token通过`Authorization: Bearer <token>`头部传递

### 2. Stripe Webhook验证
- 使用`STRIPE_WEBHOOK_SECRET`验证webhook签名
- 确保只处理来自Stripe的合法请求

### 3. 用户权限验证
- 用户只能访问自己的数据
- 管理员操作需要特殊权限

## 📱 前端集成

### 1. 初始化Stripe
```javascript
await window.stripeManager.initialize('pk_test_...');
```

### 2. 创建订阅支付
```javascript
await window.stripeManager.createSubscriptionCheckout('pro', userId);
```

### 3. 购买积分
```javascript
await window.stripeManager.createCreditsCheckout('medium', userId);
```

### 4. 管理积分
```javascript
await window.creditsManager.initialize(userId);
const balance = window.creditsManager.getCreditsBalance();
```

## 🌐 生产环境部署

### 1. 环境变量更新
```env
# 使用生产环境的Stripe密钥
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 生产环境URL
FRONTEND_URL=https://your-domain.com
NODE_ENV=production
```

### 2. Stripe配置更新
- 在Stripe Dashboard中切换到Live模式
- 重新创建产品和价格
- 配置生产环境webhook URL: `https://your-domain.com/api/stripe/webhook`

### 3. 部署选项

#### Vercel部署
```bash
npm install -g vercel
vercel --prod
```

#### Heroku部署
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

#### Docker部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 监控和日志

### 1. 错误监控
- 所有错误都会记录到控制台
- 建议集成Sentry或类似服务

### 2. 支付监控
- 监控Stripe Dashboard中的支付状态
- 设置失败支付的告警

### 3. 性能监控
- 监控API响应时间
- 跟踪积分使用模式

## 🐛 故障排除

### 常见问题

1. **Stripe初始化失败**
   - 检查公钥是否正确
   - 确认网络连接正常

2. **Webhook验证失败**
   - 验证webhook secret是否正确
   - 检查请求体是否为原始格式

3. **积分扣除失败**
   - 检查用户积分余额
   - 验证数据库连接

4. **支付会话创建失败**
   - 确认Stripe密钥有效
   - 检查产品价格ID是否正确

### 调试技巧

1. **启用详细日志**
```javascript
console.log('Debug info:', { userId, amount, balance });
```

2. **测试API端点**
```bash
curl -X POST http://localhost:3000/api/health \
  -H "Content-Type: application/json"
```

3. **检查Stripe事件**
- 在Stripe Dashboard中查看事件日志
- 验证webhook是否正确接收

## 📞 支持

如果遇到问题，请检查：
1. 环境变量配置
2. Stripe Dashboard设置
3. Supabase数据库连接
4. 服务器日志输出

---

**注意**: 在生产环境中，请确保所有敏感信息都通过环境变量配置，不要将密钥硬编码在代码中。