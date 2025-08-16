# Design Document

## Overview

Nano Banana网站采用现代化的前端技术栈，结合Supabase后端服务，实现一个高性能、用户友好的AI图片生成平台。设计遵循"简单直接"原则，避免过度工程化，专注于核心功能实现。

## Architecture

### 系统架构图

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   前端 Web App   │────│   Supabase 后端   │────│  Replicate API  │
│  HTML/CSS/JS    │    │ 数据库+认证+API   │    │   AI图片生成     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Stripe 支付    │    │   Redis 缓存     │    │   CDN 图片存储   │
│   订阅+积分     │    │   会话+结果      │    │   生成图片托管   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 技术栈选择

**前端：**
- HTML5 + CSS3 + 原生JavaScript
- CSS Flexbox + Grid 布局
- 响应式设计（移动优先）
- 渐进式Web应用特性

**后端：**
- Supabase（PostgreSQL + 认证 + 实时API）
- Node.js + Express（API网关）
- Redis（会话缓存）
- Stripe（支付处理）

**第三方服务：**
- Replicate API（AI图片生成）
- Google OAuth（用户认证）
- CDN（图片存储和分发）

## Components and Interfaces

### 前端组件架构

#### 1. 页面布局组件

**Header组件**
```javascript
// 头部导航组件
class HeaderComponent {
  constructor() {
    this.isLoggedIn = false;
    this.userCredits = 0;
  }
  
  render() {
    // 渲染透明毛玻璃效果导航栏
    // Logo + 导航菜单 + 用户状态
  }
  
  updateUserStatus(credits, isLoggedIn) {
    // 更新用户积分显示和登录状态
  }
}
```

**Hero Section组件**
```javascript
// 主要价值展示区域
class HeroSection {
  constructor() {
    this.backgroundImages = []; // 轮播背景图片
  }
  
  render() {
    // 主标题 + 副标题 + 信任标签
    // 背景图片轮播效果
  }
}
```

#### 2. 核心功能组件

**ImageGenerator组件**
```javascript
// 主要图片生成功能
class ImageGenerator {
  constructor() {
    this.mode = 'text-to-image'; // 或 'image-to-image'
    this.isGenerating = false;
    this.currentImage = null;
  }
  
  // 切换生成模式
  switchMode(mode) {
    this.mode = mode;
    this.updateUI();
  }
  
  // 处理图片生成请求
  async generateImage(prompt, options = {}) {
    this.isGenerating = true;
    this.showProgress();
    
    try {
      const result = await API.generateImage({
        prompt,
        mode: this.mode,
        aspectRatio: options.aspectRatio || '1:1',
        style: options.style || 'realistic'
      });
      
      this.displayResult(result);
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.isGenerating = false;
      this.hideProgress();
    }
  }
}
```

**PricingComponent组件**
```javascript
// 定价方案展示
class PricingComponent {
  constructor() {
    this.plans = [
      { name: 'Starter', price: 9.99, images: 200, recommended: false },
      { name: 'Pro', price: 19.99, images: 500, recommended: true },
      { name: 'Studio', price: 39.99, images: 1500, recommended: false }
    ];
  }
  
  render() {
    // 渲染订阅方案卡片
    // 突出显示推荐方案
  }
  
  handlePlanSelection(planName) {
    // 引导到Stripe支付页面
  }
}
```

#### 3. 用户管理组件

**AuthManager组件**
```javascript
// 用户认证管理
class AuthManager {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.user = null;
    this.anonymousId = this.generateAnonymousId();
  }
  
  // Google OAuth登录
  async signInWithGoogle() {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google'
    });
    return { data, error };
  }
  
  // 匿名用户识别
  generateAnonymousId() {
    // 基于浏览器指纹生成唯一ID
    return btoa(navigator.userAgent + screen.width + screen.height);
  }
}
```

### API接口设计

#### 1. 图片生成API

```javascript
// POST /api/generate
{
  "prompt": "A beautiful sunset over mountains",
  "mode": "text-to-image", // 或 "image-to-image"
  "aspectRatio": "16:9",
  "style": "realistic",
  "sourceImage": "base64_string" // 仅图生图模式需要
}

// Response
{
  "success": true,
  "imageUrl": "https://cdn.example.com/generated/image.jpg",
  "generationId": "uuid",
  "creditsUsed": 1,
  "remainingCredits": 49
}
```

#### 2. 用户状态API

```javascript
// GET /api/user/status
{
  "isAuthenticated": true,
  "credits": 50,
  "subscription": {
    "plan": "pro",
    "imagesRemaining": 450,
    "renewalDate": "2024-02-15"
  },
  "freeGenerationsUsed": 5,
  "freeGenerationsRemaining": 0
}
```

#### 3. 支付API

```javascript
// POST /api/payment/create-subscription
{
  "planType": "pro",
  "paymentMethodId": "pm_xxx"
}

// POST /api/payment/purchase-credits
{
  "package": "medium", // small, medium, large
  "paymentMethodId": "pm_xxx"
}
```

## Data Models

### 数据库表结构

#### 1. 用户表 (users)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 订阅信息
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'studio')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due')),
  subscription_period_start TIMESTAMP WITH TIME ZONE,
  subscription_period_end TIMESTAMP WITH TIME ZONE,
  images_used_this_period INTEGER DEFAULT 0,
  
  -- 积分信息
  credit_balance INTEGER DEFAULT 0,
  total_credits_purchased INTEGER DEFAULT 0,
  total_credits_used INTEGER DEFAULT 0,
  
  -- 免费额度
  free_generations_used INTEGER DEFAULT 0,
  free_generations_last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stripe信息
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT
);
```

#### 2. 生成记录表 (generations)
```sql
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  anonymous_id TEXT, -- 匿名用户标识
  
  -- 生成参数
  prompt TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('text-to-image', 'image-to-image')),
  aspect_ratio TEXT DEFAULT '1:1',
  style TEXT DEFAULT 'realistic',
  source_image_url TEXT, -- 图生图的原始图片
  
  -- 生成结果
  generated_image_url TEXT,
  replicate_prediction_id TEXT,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- 成本和性能
  cost_usd DECIMAL(10,4),
  generation_time_seconds INTEGER,
  model_used TEXT DEFAULT 'qwen',
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 索引
  INDEX idx_user_generations (user_id, created_at DESC),
  INDEX idx_anonymous_generations (anonymous_id, created_at DESC),
  INDEX idx_generation_status (generation_status)
);
```

#### 3. 支付记录表 (payments)
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  -- Stripe信息
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  
  -- 支付详情
  amount_usd DECIMAL(10,2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'credits')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'succeeded', 'failed', 'canceled')),
  
  -- 购买内容
  subscription_plan TEXT, -- starter, pro, studio
  credits_purchased INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 数据关系图

```
users (1) ──── (N) generations
  │
  └── (1) ──── (N) payments
```

## Error Handling

### 前端错误处理策略

#### 1. 用户友好的错误消息
```javascript
const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接出现问题，请检查您的网络连接',
  GENERATION_FAILED: '图片生成失败，请重试或联系客服',
  INSUFFICIENT_CREDITS: '积分不足，请购买积分或升级订阅',
  INVALID_IMAGE_FORMAT: '不支持的图片格式，请上传JPG、PNG或WebP格式',
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
  PAYMENT_FAILED: '支付失败，请检查支付信息或尝试其他支付方式'
};

class ErrorHandler {
  static show(errorType, details = '') {
    const message = ERROR_MESSAGES[errorType] || '发生未知错误';
    // 显示用户友好的错误提示
    this.showToast(message, 'error');
    
    // 记录详细错误信息用于调试
    console.error(`Error: ${errorType}`, details);
  }
}
```

#### 2. 网络请求错误处理
```javascript
class APIClient {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError') {
        ErrorHandler.show('NETWORK_ERROR', error.message);
      } else {
        ErrorHandler.show('GENERATION_FAILED', error.message);
      }
      throw error;
    }
  }
}
```

### 后端错误处理

#### 1. 统一错误响应格式
```javascript
// 标准错误响应格式
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "用户积分不足",
    "details": "当前积分: 0, 需要积分: 1"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 2. 错误处理中间件
```javascript
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // 根据错误类型返回适当的HTTP状态码
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'InsufficientCreditsError') {
    statusCode = 402;
    errorCode = 'INSUFFICIENT_CREDITS';
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message,
      details: err.details || null
    },
    timestamp: new Date().toISOString()
  });
};
```

## Testing Strategy

### 前端测试

#### 1. 单元测试
```javascript
// 使用Jest进行组件测试
describe('ImageGenerator', () => {
  test('should switch between text-to-image and image-to-image modes', () => {
    const generator = new ImageGenerator();
    generator.switchMode('image-to-image');
    expect(generator.mode).toBe('image-to-image');
  });
  
  test('should validate aspect ratio options', () => {
    const validRatios = ['1:1', '4:3', '3:4', '16:9', '9:16'];
    validRatios.forEach(ratio => {
      expect(ImageGenerator.isValidAspectRatio(ratio)).toBe(true);
    });
  });
});
```

#### 2. 集成测试
```javascript
// 测试API集成
describe('API Integration', () => {
  test('should generate image with valid prompt', async () => {
    const mockResponse = {
      success: true,
      imageUrl: 'https://example.com/image.jpg',
      creditsUsed: 1
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
    
    const result = await API.generateImage({
      prompt: 'test prompt',
      aspectRatio: '1:1'
    });
    
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeDefined();
  });
});
```

#### 3. 端到端测试
```javascript
// 使用Playwright进行E2E测试
test('complete image generation flow', async ({ page }) => {
  await page.goto('/');
  
  // 输入提示词
  await page.fill('[data-testid="prompt-input"]', 'A beautiful sunset');
  
  // 选择比例
  await page.click('[data-testid="aspect-ratio-16:9"]');
  
  // 点击生成
  await page.click('[data-testid="generate-button"]');
  
  // 等待生成完成
  await page.waitForSelector('[data-testid="generated-image"]');
  
  // 验证图片显示
  const image = page.locator('[data-testid="generated-image"]');
  await expect(image).toBeVisible();
});
```

### 后端测试

#### 1. API测试
```javascript
describe('Generation API', () => {
  test('POST /api/generate should create new generation', async () => {
    const response = await request(app)
      .post('/api/generate')
      .send({
        prompt: 'test prompt',
        mode: 'text-to-image',
        aspectRatio: '1:1'
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.generationId).toBeDefined();
  });
});
```

#### 2. 数据库测试
```javascript
describe('Database Operations', () => {
  test('should create user with correct defaults', async () => {
    const user = await createUser({
      email: 'test@example.com',
      googleId: 'google123'
    });
    
    expect(user.subscriptionTier).toBe('free');
    expect(user.creditBalance).toBe(0);
    expect(user.freeGenerationsUsed).toBe(0);
  });
});
```

### 性能测试

#### 1. 负载测试
```javascript
// 使用Artillery进行负载测试
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50

scenarios:
  - name: "Generate Image"
    requests:
      - post:
          url: "/api/generate"
          json:
            prompt: "test image"
            mode: "text-to-image"
```

#### 2. 前端性能测试
```javascript
// 使用Lighthouse CI进行性能测试
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }]
      }
    }
  }
};
```