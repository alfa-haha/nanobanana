# Nano Banana AI 图片生成网站产品需求文档

## 1. 产品概述

### 1.1 产品定位
Nano Banana 是一个基于先进AI模型的在线图片生成服务，让用户通过自然语言描述快速生成高质量AI图片，支持文生图和图生图两种模式。

### 1.2 核心价值主张
- **简单易用**：自然语言输入，无需复杂提示词技巧
- **免费试用**：无需注册即可体验，降低使用门槛  
- **高质量输出**：基于先进AI模型，生成精美图片
- **灵活付费**：支持订阅和按需付费两种模式

### 1.3 目标用户
- **主要用户**：美国地区的创意工作者、内容创作者、小企业主
- **次要用户**：学生、个人爱好者、营销人员

### 1.4 技术架构
- **前端**：现代化响应式Web应用
- **后端**：Node.js/Python + Supabase数据库
- **AI模型**：Replicate平台的Qwen Image API（后期升级至Nano Banana）
- **支付**：香港Stripe账户，支持全球收款

---

## 2. 功能需求

### 2.1 前端功能模块

#### 2.1.1 头部导航区 (Header)
**设计特点：**
- 透明背景 + 毛玻璃效果
- Logo：现代字体"Nano" + "Banana"分色设计
- 导航菜单：Gallery / Pricing / Blog / About / Login
- 右上角：用户积分/使用次数显示

#### 2.1.2 Hero描述区 (新增)
**核心价值展示：**
- **主标题**：「Generate Stunning AI Images with Natural Language」
- **副标题**：「Powered by Revolutionary Nano Banana AI Model」
- **信任标签**：
  - 💳 「No Credit Card Required」
  - 🚀 「Start Without Registration」 
  - 💬 「Plain English to Amazing Art」
- **背景**：精选AI生成作品轮播展示

#### 2.1.3 主生成区域
**左侧：用户输入区 (40%宽度)**
- **模式切换**：「Text to Image」/「Image to Image」两个Tab
- **文生图模式**：
  - Prompt多行输入框（占位符：「Describe your vision in natural language...」）
  - 图片比例选择：Square / Portrait / Landscape
  - 预设风格按钮：Realistic / Artistic / Fantasy
- **图生图模式**：
  - 拖拽上传区域（支持预览）
  - Prompt输入框（占位符：「Describe how to transform this image...」）
- **生成按钮**：「Generate Now ✨」（生成中显示「Generating...」）

**右侧：图片生成区 (60%宽度)**
- **默认状态**：空状态插画 + 精选作品展示
- **生成中**：简洁进度条 + 「Creating your masterpiece... ✨」
- **完成状态**：图片展示 + 操作按钮（Download / Regenerate / Share）

#### 2.1.4 Pricing介绍模块 (新增)
**订阅方案展示：**
- **Starter Plan**：$9.99/月
  - 200张图片生成
  - 标准生成速度
  - 基础客服支持
- **Pro Plan**：$19.99/月 (推荐标识)
  - 500张图片生成
  - 优先生成队列
  - 邮件客服支持
  - 高分辨率下载
- **Studio Plan**：$39.99/月
  - 1500张图片生成
  - 最高优先级
  - API访问权限
  - 专属客服支持

**按需付费选项：**
- **小包**：$4.99 (50积分)
- **中包**：$9.99 (120积分，20%优惠)
- **大包**：$19.99 (300积分，40%优惠)

**设计要求：**
- 卡片式布局，Pro方案突出显示
- 包含「Start Free Trial」和「Choose Plan」按钮
- 展示每种方案的核心优势对比

#### 2.1.5 Why Choose Nano Banana
**三栏特色展示：**
- **🧠 Advanced AI Model**：「Latest breakthrough in image generation, Superior quality and creativity」
- **⚡ Lightning Fast**：「Generate images in seconds, No waiting, instant results」  
- **🎨 Natural Language**：「No complex prompts needed, Describe in plain English」

#### 2.1.6 FAQ Section
**常见问题（折叠式）：**
- 「Is Nano Banana really free to use?」
- 「Do I need to sign up to try it?」
- 「What makes Nano Banana different?」
- 「What image formats are supported?」
- 「Can I use generated images commercially?」

#### 2.1.7 特色功能区
- **最近生成画廊**：横向滚动缩略图
- **热门提示词**：标签云，一键填入

#### 2.1.8 底部信息区
- 实时统计：「Images Generated Today」「Happy Creators」
- 技术说明：「Powered by Nano Banana AI」+ API状态指示

### 2.2 响应式设计
- **桌面端 (>1200px)**：完整左右分栏
- **平板端 (768px-1200px)**：上下布局
- **移动端 (<768px)**：垂直单列，粘性生成按钮

---

## 3. 后端架构方案

### 3.1 技术栈
- **数据库**：Supabase (PostgreSQL + 实时功能 + 内置认证)
- **API框架**：Node.js + Python + FastAPI
- **AI模型**：Replicate平台 Qwen Image API
- **支付系统**：香港Stripe账户
- **缓存**：Redis (会话管理 + 结果缓存)

### 3.2 API架构设计

#### 3.2.1 模型API抽象层
```
架构设计：
├── ImageGenerationService (抽象接口)
├── QwenImageProvider (当前实现)  
├── NanoBananaProvider (预留实现)
└── APIRouter (智能路由选择器)
```

**核心优势：**
- 支持多模型无缝切换
- 可根据用户等级路由不同模型
- 主API故障时自动降级

#### 3.2.2 Replicate API接入
**接入要点：**
- API Token认证
- 异步调用处理（轮询状态）
- Webhook回调优化用户体验
- 实时成本监控

### 3.3 数据库设计 (Supabase)

#### 3.3.1 核心数据表
```sql
-- 用户表
users {
  id: uuid (主键)
  google_id: text (Google OAuth ID)
  email: text
  created_at: timestamp
  subscription_tier: enum (free, starter, pro, studio)
  free_credits_used: integer (免费额度使用量)
  last_free_reset: timestamp (免费额度重置时间)
}

-- 生成记录表  
generations {
  id: uuid (主键)
  user_id: uuid (外键，可为null支持匿名用户)
  user_fingerprint: text (匿名用户识别)
  prompt: text
  image_url: text
  model_used: text (qwen/nano_banana)
  cost: decimal (成本记录)
  generation_time: integer (生成耗时)
  created_at: timestamp
}

-- 订阅表
subscriptions {
  id: uuid (主键)
  user_id: uuid (外键)
  stripe_subscription_id: text
  plan_type: enum (starter, pro, studio)
  status: enum (active, canceled, past_due)
  current_period_start: timestamp
  current_period_end: timestamp
  images_used_this_period: integer
}

-- 积分表 (按需付费)
credits {
  id: uuid (主键)
  user_id: uuid (外键)
  balance: integer (剩余积分)
  purchased_total: integer (累计购买)
  used_total: integer (累计使用)
  last_purchase_at: timestamp
}
```

#### 3.3.2 Supabase特性应用
- **Row Level Security (RLS)**：用户只能访问自己的数据
- **Real-time**：实时更新生成状态和使用统计
- **Authentication**：集成Google OAuth，简化登录流程

### 3.4 用户认证系统

#### 3.4.1 多层级认证架构
```
认证层级：
├── 匿名用户 (IP+浏览器指纹识别)
│   └── 5次免费生成 + 每日1次恢复
├── Google OAuth注册用户  
│   └── 额外10次奖励生成
└── 付费用户 (订阅/积分)
    └── 按套餐享受服务
```

#### 3.4.2 防滥用机制
- **多重识别**：IP地址 + 浏览器指纹 + 设备指纹
- **限流策略**：单IP每小时最多5次生成
- **异常检测**：识别批量注册和恶意使用

### 3.5 计费系统设计

#### 3.5.1 成本结构
- **Replicate成本**：$0.025/图
- **目标毛利率**：订阅50%，积分200%+
- **运营成本**：服务器、CDN、客服等

#### 3.5.2 订阅计费逻辑
```
月度重置机制：
- 每月1日重置可用图片额度
- 未使用额度不累积
- 支持中途升级/降级套餐
- 取消后保留至周期结束
```

#### 3.5.3 积分计费逻辑  
```
积分消费机制：
- 1积分 = 1张图片生成
- 积分永不过期
- 支持积分赠送和转移
- 批量购买享受折扣
```

### 3.6 支付集成 (香港Stripe)

#### 3.6.1 支持的支付方式
- **信用卡**：Visa、MasterCard、American Express
- **数字钱包**：Apple Pay、Google Pay
- **本地支付**：支持美国ACH等本地支付方式

#### 3.6.2 订阅管理
- **自动续费**：支持月度/年度订阅
- **免费试用**：新用户14天免费试用Pro套餐
- **升级/降级**：按比例计费调整
- **发票管理**：自动生成电子发票

---

## 4. 业务逻辑

### 4.1 免费试用策略
- **匿名用户**：5次免费生成，每24小时恢复1次
- **注册用户**：额外获得10次奖励生成
- **试用结束**：引导订阅或购买积分

### 4.2 用户生命周期
```
用户旅程：
访问网站 → 免费试用(5次) → 注册(+10次) → 试用结束 → 付费转化
```

### 4.3 运营指标
- **转化率**：免费用户→注册用户→付费用户
- **留存率**：日活、周活、月活用户  
- **ARPU**：单用户平均收入
- **CAC/LTV**：获客成本vs客户终身价值

---

## 5. 非功能需求

### 5.1 性能要求
- **页面加载**：首屏渲染 < 2秒
- **图片生成**：平均响应时间 < 30秒
- **并发支持**：支持1000+并发用户

### 5.2 安全要求
- **数据加密**：HTTPS + 数据库加密存储
- **用户隐私**：符合GDPR和CCPA要求
- **防护措施**：DDoS防护，SQL注入防护

### 5.3 SEO要求
- **页面标题**：「Free AI Image Generator | Nano Banana - Text to Image & Image to Image」
- **Meta描述**：包含核心关键词，吸引点击
- **结构化数据**：WebApplication、FAQ Schema markup
- **Core Web Vitals**：优化LCP、FID、CLS指标

---

## 6. 开发计划

### 6.1 MVP阶段 (4-6周)
- **Week 1-2**：前端界面开发 + Supabase配置
- **Week 3-4**：Replicate API集成 + 用户认证
- **Week 5-6**：支付集成 + 测试部署

### 6.2 V1.0阶段 (2-3周)
- 用户画廊功能
- 管理后台开发  
- 数据分析集成
- 性能优化

### 6.3 V2.0阶段 (待定)
- Nano Banana API集成
- 多模型选择功能
- API开放平台

---

## 7. 风险评估

### 7.1 技术风险
- **API依赖**：Replicate服务稳定性风险
- **成本控制**：用户滥用导致成本失控
- **缓解措施**：多API备份，严格限流机制

### 7.2 商业风险  
- **竞争加剧**：同类产品快速涌现
- **获客成本**：Google广告成本持续上涨
- **缓解措施**：差异化定位，口碑营销

### 7.3 合规风险
- **版权问题**：生成内容的版权归属
- **内容审核**：防止生成不当内容
- **缓解措施**：内容过滤，用户协议明确

---

## 8. 成功指标

### 8.1 产品指标
- **用户增长**：月活用户10,000+ (6个月内)
- **转化率**：免费→付费转化率 > 5%
- **留存率**：月留存率 > 40%

### 8.2 商业指标  
- **收入目标**：月收入$10,000+ (12个月内)
- **单位经济**：LTV/CAC > 3:1
- **毛利率**：整体毛利率 > 60%

### 8.3 技术指标
- **系统稳定性**：99.9%可用性
- **响应时间**：API响应时间 < 1秒
- **错误率**：系统错误率 < 0.1%