/**
 * API路由配置
 * 整合所有Stripe和积分相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入处理器
const StripeHandler = require('./stripe-handler');
const CreditsAPI = require('./credits-api');
const ReplicateHandler = require('./replicate-handler');

// 创建处理器实例
const stripeHandler = new StripeHandler();
const creditsAPI = new CreditsAPI();
const replicateHandler = new ReplicateHandler();

// 中间件：验证JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: { message: 'Access token required' }
        });
    }
    
    // 在实际应用中，这里应该验证JWT token
    // 现在我们模拟一个用户对象
    req.user = {
        id: 'mock-user-id',
        role: 'user'
    };
    
    next();
};

// Stripe支付相关路由
router.post('/stripe/create-subscription-checkout', authenticateToken, (req, res) => {
    stripeHandler.createSubscriptionCheckout(req, res);
});

router.post('/stripe/create-credits-checkout', authenticateToken, (req, res) => {
    stripeHandler.createCreditsCheckout(req, res);
});

router.get('/stripe/subscription-status/:userId', authenticateToken, (req, res) => {
    stripeHandler.getSubscriptionStatus(req, res);
});

router.post('/stripe/cancel-subscription', authenticateToken, (req, res) => {
    stripeHandler.cancelSubscription(req, res);
});

router.post('/stripe/update-subscription', authenticateToken, (req, res) => {
    stripeHandler.updateSubscription(req, res);
});

router.post('/stripe/create-billing-portal', authenticateToken, (req, res) => {
    stripeHandler.createBillingPortal(req, res);
});

router.post('/stripe/payment-success', authenticateToken, (req, res) => {
    stripeHandler.handlePaymentSuccess(req, res);
});

// Stripe Webhook (不需要认证)
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    stripeHandler.handleWebhook(req, res);
});

// 积分管理相关路由
router.get('/user/credits/:userId', authenticateToken, (req, res) => {
    creditsAPI.getUserCredits(req, res);
});

router.post('/user/use-credits', authenticateToken, (req, res) => {
    creditsAPI.useCredits(req, res);
});

router.post('/user/add-credits', authenticateToken, (req, res) => {
    creditsAPI.addCredits(req, res);
});

router.get('/user/credit-transactions/:userId', authenticateToken, (req, res) => {
    creditsAPI.getCreditTransactions(req, res);
});

router.get('/user/credit-stats/:userId', authenticateToken, (req, res) => {
    creditsAPI.getCreditStats(req, res);
});

router.get('/user/check-credits-balance/:userId', authenticateToken, (req, res) => {
    creditsAPI.checkCreditsBalance(req, res);
});

// 用户管理相关路由
router.get('/user/generations/:userId', authenticateToken, (req, res) => {
    creditsAPI.getUserGenerations(req, res);
});

router.get('/user/stats/:userId', authenticateToken, (req, res) => {
    creditsAPI.getUserStats(req, res);
});

router.get('/user/profile/:userId', authenticateToken, (req, res) => {
    creditsAPI.getUserProfile(req, res);
});

router.put('/user/profile/:userId', authenticateToken, (req, res) => {
    creditsAPI.updateUserProfile(req, res);
});

// 健康检查端点
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is healthy',
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
router.use((error, req, res, next) => {
    console.error('API Error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        error: {
            message: error.message || 'Internal server error',
            code: error.code || 'INTERNAL_ERROR'
        }
    });
});

// Replicate AI 图片生成相关路由
router.post('/replicate/generate', async (req, res) => {
    try {
        const { prompt, width, height, negative_prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: { message: '提示词不能为空' }
            });
        }
        
        const result = await replicateHandler.generateImage({
            prompt,
            width: width || 1024,
            height: height || 1024,
            negative_prompt: negative_prompt || ''
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Replicate API错误:', error);
        res.status(500).json({
            success: false,
            error: { message: '服务器内部错误' }
        });
    }
});

router.get('/replicate/health', async (req, res) => {
    try {
        const health = await replicateHandler.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: { message: '健康检查失败' }
        });
    }
});

module.exports = router;