# Replicate API 配置指南

## 📋 概述

任务10.1已完成！Replicate API客户端已成功创建，包含以下功能：
- ✅ API调用封装
- ✅ 异步生成和状态轮询
- ✅ Webhook回调处理
- ✅ 成本监控和记录

## 🔧 配置步骤

### 1. 获取Replicate API Token

1. 访问 [Replicate官网](https://replicate.com)
2. 登录你的账户
3. 进入 [API Tokens页面](https://replicate.com/account/api-tokens)
4. 创建新的API Token或复制现有Token

### 2. 选择模型和获取版本ID

1. 在Replicate上浏览并选择你要使用的模型
2. 记录模型的完整名称，例如：`stability-ai/stable-diffusion-xl-base-1.0`
3. 获取模型的最新版本ID：
   ```bash
   curl -H "Authorization: Token YOUR_API_TOKEN" \
        https://api.replicate.com/v1/models/stability-ai/stable-diffusion-xl-base-1.0
   ```
4. 从响应中复制 `latest_version.id` 字段的值

### 3. 配置API客户端

打开 `js/replicate-client.js` 文件，替换以下占位符：

```javascript
// 第8行：替换API Token
this.apiToken = 'r8_your_actual_api_token_here';

// 第10行：替换模型名称
this.defaultModel = 'stability-ai/stable-diffusion-xl-base-1.0';

// 第11行：配置Webhook URL（可选）
this.webhookUrl = 'https://your-domain.com/webhook/replicate';

// 第14-17行：调整成本限制
this.costTracking = {
    dailyLimit: 10.00,    // 每日成本限制（美元）
    monthlyLimit: 100.00, // 每月成本限制（美元）
    alertThreshold: 0.8   // 告警阈值（80%时告警）
};
```

```javascript
// 第156行：替换模型版本ID
getModelVersion() {
    return 'actual_model_version_id_here';
}
```

### 4. 常用模型配置示例

#### Stable Diffusion XL Base 1.0
```javascript
this.defaultModel = 'stability-ai/stable-diffusion-xl-base-1.0';
// 版本ID示例：'39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b'
```

#### FLUX.1 [dev]
```javascript
this.defaultModel = 'black-forest-labs/flux-dev';
// 版本ID示例：'5f2e8c4b8c4e4f2e8c4b8c4e4f2e8c4b8c4e4f2e'
```

#### Midjourney Style
```javascript
this.defaultModel = 'prompthero/openjourney';
// 版本ID示例：'9936c2001faa2194a261c01381f90e65261879985476014a0a37a334593a05eb'
```

### 5. 成本估算配置

根据你选择的模型调整成本估算：

```javascript
// 第244行：调整基础费率
estimateCost(prediction) {
    // 不同模型的定价示例：
    // SDXL: ~$0.0055 per generation
    // FLUX: ~$0.003 per generation
    // Midjourney: ~$0.002 per generation
    const baseRate = 0.0055; // 根据实际模型调整
    
    const complexityMultiplier = this.getComplexityMultiplier(prediction.input);
    return baseRate * complexityMultiplier;
}
```

### 6. Webhook配置（可选）

如果你想使用Webhook来接收异步通知：

1. 设置一个公网可访问的端点
2. 在 `js/replicate-client.js` 中配置Webhook URL
3. 实现Webhook处理逻辑：

```javascript
// 示例Webhook处理端点（Node.js/Express）
app.post('/webhook/replicate', (req, res) => {
    const webhookData = req.body;
    
    // 验证Webhook签名（推荐）
    // const signature = req.headers['replicate-signature'];
    
    // 处理Webhook数据
    console.log('收到Replicate Webhook:', webhookData);
    
    // 通知前端（通过WebSocket、SSE等）
    notifyFrontend(webhookData);
    
    res.status(200).send('OK');
});
```

## 🧪 测试配置

1. 打开 `test-replicate-client.html` 文件
2. 在浏览器中访问该页面
3. 输入测试提示词
4. 点击"生成图片"按钮
5. 观察控制台输出和页面反馈

## 📊 成本监控功能

API客户端包含完整的成本监控功能：

- **每日限制**：防止单日超支
- **每月限制**：控制月度预算
- **告警机制**：接近限制时发出警告
- **使用统计**：实时显示成本使用情况
- **历史记录**：跟踪所有生成请求

## 🔒 安全建议

1. **API Token安全**：
   - 不要在客户端代码中硬编码API Token
   - 考虑使用环境变量或服务器端代理
   - 定期轮换API Token

2. **成本控制**：
   - 设置合理的每日/每月限制
   - 监控异常使用模式
   - 实现用户级别的限制

3. **输入验证**：
   - 验证用户输入的提示词
   - 过滤不当内容
   - 限制生成参数范围

## 🚀 下一步

配置完成后，你可以：

1. 继续实现任务10.2（前端生成流程）
2. 集成到主应用的图片生成功能
3. 添加更多模型支持
4. 实现高级功能（批量生成、风格预设等）

## 📞 支持

如果遇到配置问题：

1. 检查API Token是否正确
2. 确认模型版本ID是否有效
3. 查看浏览器控制台的错误信息
4. 参考Replicate官方文档：https://replicate.com/docs

---

**注意**：请确保在生产环境中妥善保护你的API Token，避免泄露给未授权用户。