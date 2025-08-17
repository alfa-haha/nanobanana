/**
 * Express.js服务器
 * 处理Stripe支付和积分管理API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// 对于Stripe webhook，需要原始body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// 其他路由使用JSON解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static('.'));

// API路由
const apiRoutes = require('./api/routes');
app.use('/api', apiRoutes);

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 支付成功页面
app.get('/payment/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment-success.html'));
});

// 积分购买测试页面
app.get('/test/credits', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-credits-purchase.html'));
});

// Stripe支付测试页面
app.get('/test/stripe', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-stripe-payment.html'));
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: { message: 'Endpoint not found' }
    });
});

// 全局错误处理
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        error: {
            message: error.message || 'Internal server error',
            code: error.code || 'INTERNAL_ERROR'
        }
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Credits test: http://localhost:${PORT}/test/credits`);
    console.log(`💳 Stripe test: http://localhost:${PORT}/test/stripe`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;