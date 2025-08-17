/**
 * Stripe后端API处理器
 * 处理订阅创建、支付处理和webhook事件
 */

// 环境变量配置
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 导入依赖
const stripe = require('stripe')(STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// 初始化Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

class StripeHandler {
    constructor() {
        this.stripe = stripe;
        this.supabase = supabase;
        
        // 订阅计划映射
        this.planMapping = {
            'price_starter_hkd_monthly': {
                type: 'starter',
                name: 'Starter Plan',
                credits: 100,
                price: 39
            },
            'price_pro_hkd_monthly': {
                type: 'pro',
                name: 'Pro Plan',
                credits: 500,
                price: 99
            },
            'price_studio_hkd_monthly': {
                type: 'studio',
                name: 'Studio Plan',
                credits: 2000,
                price: 299
            }
        };
        
        // 积分包映射
        this.creditMapping = {
            'price_credits_50_hkd': {
                type: 'small',
                name: '50 Credits Pack',
                credits: 50,
                price: 19
            },
            'price_credits_200_hkd': {
                type: 'medium',
                name: '200 Credits Pack',
                credits: 200,
                price: 69
            },
            'price_credits_500_hkd': {
                type: 'large',
                name: '500 Credits Pack',
                credits: 500,
                price: 149
            }
        };
    }
    
    /**
     * 创建订阅支付会话
     */
    async createSubscriptionCheckout(req, res) {
        try {
            const { planType, priceId, userId, successUrl, cancelUrl } = req.body;
            
            // 验证用户
            const user = await this.getUser(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User not found' }
                });
            }
            
            // 获取或创建Stripe客户
            let customerId = user.stripe_customer_id;
            if (!customerId) {
                const customer = await this.stripe.customers.create({
                    email: user.email,
                    name: user.display_name,
                    metadata: {
                        supabase_user_id: userId
                    }
                });
                customerId = customer.id;
                
                // 更新用户记录
                await this.supabase
                    .from('profiles')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', userId);
            }
            
            // 创建Checkout会话
            const session = await this.stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{
                    price: priceId,
                    quantity: 1
                }],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    user_id: userId,
                    plan_type: planType,
                    type: 'subscription'
                },
                subscription_data: {
                    metadata: {
                        user_id: userId,
                        plan_type: planType
                    }
                }
            });
            
            res.json({
                success: true,
                sessionId: session.id
            });
            
        } catch (error) {
            console.error('Create subscription checkout error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 创建积分购买支付会话
     */
    async createCreditsCheckout(req, res) {
        try {
            const { packageType, priceId, userId, successUrl, cancelUrl } = req.body;
            
            // 验证用户
            const user = await this.getUser(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User not found' }
                });
            }
            
            // 获取或创建Stripe客户
            let customerId = user.stripe_customer_id;
            if (!customerId) {
                const customer = await this.stripe.customers.create({
                    email: user.email,
                    name: user.display_name,
                    metadata: {
                        supabase_user_id: userId
                    }
                });
                customerId = customer.id;
                
                // 更新用户记录
                await this.supabase
                    .from('profiles')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', userId);
            }
            
            // 创建Checkout会话
            const session = await this.stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                mode: 'payment',
                line_items: [{
                    price: priceId,
                    quantity: 1
                }],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    user_id: userId,
                    package_type: packageType,
                    type: 'credits'
                }
            });
            
            res.json({
                success: true,
                sessionId: session.id
            });
            
        } catch (error) {
            console.error('Create credits checkout error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 获取订阅状态
     */
    async getSubscriptionStatus(req, res) {
        try {
            const { userId } = req.params;
            
            const user = await this.getUser(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User not found' }
                });
            }
            
            let subscriptionData = null;
            
            if (user.stripe_subscription_id) {
                try {
                    const subscription = await this.stripe.subscriptions.retrieve(
                        user.stripe_subscription_id
                    );
                    
                    subscriptionData = {
                        id: subscription.id,
                        status: subscription.status,
                        currentPeriodStart: new Date(subscription.current_period_start * 1000),
                        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                        cancelAtPeriodEnd: subscription.cancel_at_period_end,
                        planType: user.subscription_status
                    };
                } catch (error) {
                    console.error('Failed to retrieve subscription:', error);
                }
            }
            
            res.json({
                success: true,
                subscription: subscriptionData,
                credits: user.credits || 0,
                subscriptionStatus: user.subscription_status || 'free'
            });
            
        } catch (error) {
            console.error('Get subscription status error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 取消订阅
     */
    async cancelSubscription(req, res) {
        try {
            const { subscriptionId } = req.body;
            
            // 取消订阅（在当前周期结束时）
            const subscription = await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true
            });
            
            res.json({
                success: true,
                subscription: {
                    id: subscription.id,
                    status: subscription.status,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000)
                }
            });
            
        } catch (error) {
            console.error('Cancel subscription error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 更新订阅计划
     */
    async updateSubscription(req, res) {
        try {
            const { subscriptionId, newPriceId } = req.body;
            
            // 获取当前订阅
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            
            // 更新订阅项目
            await this.stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: subscription.items.data[0].id,
                    price: newPriceId
                }],
                proration_behavior: 'create_prorations'
            });
            
            res.json({
                success: true,
                message: 'Subscription updated successfully'
            });
            
        } catch (error) {
            console.error('Update subscription error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 创建账单门户会话
     */
    async createBillingPortal(req, res) {
        try {
            const { userId, returnUrl } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'User ID is required' }
                });
            }
            
            // 获取用户的Stripe客户ID
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single();
            
            if (profileError || !profile?.stripe_customer_id) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'Customer not found' }
                });
            }
            
            // 创建账单门户会话
            const portalSession = await this.stripe.billingPortal.sessions.create({
                customer: profile.stripe_customer_id,
                return_url: returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}`,
            });
            
            res.json({
                success: true,
                url: portalSession.url
            });
            
        } catch (error) {
            console.error('Create billing portal error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 处理支付成功
     */
    async handlePaymentSuccess(req, res) {
        try {
            const { sessionId } = req.body;
            
            // 获取checkout会话
            const session = await this.stripe.checkout.sessions.retrieve(sessionId);
            
            const userId = session.metadata.user_id;
            const type = session.metadata.type;
            
            let result = { success: true, type };
            
            if (type === 'subscription') {
                // 处理订阅支付成功
                const planType = session.metadata.plan_type;
                const planInfo = this.planMapping[session.line_items?.data[0]?.price?.id];
                
                if (planInfo) {
                    result.planName = planInfo.name;
                    result.credits = planInfo.credits;
                }
                
            } else if (type === 'credits') {
                // 处理积分购买成功
                const packageType = session.metadata.package_type;
                const packageInfo = this.creditMapping[session.line_items?.data[0]?.price?.id];
                
                if (packageInfo) {
                    result.credits = packageInfo.credits;
                    
                    // 添加积分到用户账户
                    await this.addCreditsToUser(userId, packageInfo.credits, 'purchase');
                }
            }
            
            res.json(result);
            
        } catch (error) {
            console.error('Handle payment success error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 处理Stripe Webhook
     */
    async handleWebhook(req, res) {
        const sig = req.headers['stripe-signature'];
        let event;
        
        try {
            event = this.stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        
        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutCompleted(event.data.object);
                    break;
                    
                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;
                    
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
                    
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                    
                case 'invoice.payment_succeeded':
                    await this.handleInvoicePaymentSucceeded(event.data.object);
                    break;
                    
                case 'invoice.payment_failed':
                    await this.handleInvoicePaymentFailed(event.data.object);
                    break;
                    
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
            
            res.json({ received: true });
            
        } catch (error) {
            console.error('Webhook handler error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * 处理checkout完成事件
     */
    async handleCheckoutCompleted(session) {
        const userId = session.metadata.user_id;
        const type = session.metadata.type;
        
        if (type === 'credits') {
            // 处理积分购买
            const packageType = session.metadata.package_type;
            const packageInfo = this.creditMapping[session.line_items?.data[0]?.price?.id];
            
            if (packageInfo) {
                await this.addCreditsToUser(userId, packageInfo.credits, 'purchase');
                
                // 记录支付
                await this.recordPayment({
                    userId,
                    stripePaymentIntentId: session.payment_intent,
                    amount: packageInfo.price,
                    paymentType: 'credits',
                    status: 'succeeded',
                    creditsPurchased: packageInfo.credits
                });
            }
        }
    }
    
    /**
     * 处理订阅创建事件
     */
    async handleSubscriptionCreated(subscription) {
        const userId = subscription.metadata.user_id;
        const planType = subscription.metadata.plan_type;
        
        // 更新用户订阅状态
        await this.supabase
            .from('profiles')
            .update({
                subscription_status: planType,
                subscription_id: subscription.id,
                subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString()
            })
            .eq('id', userId);
        
        // 添加订阅积分
        const planInfo = Object.values(this.planMapping).find(p => p.type === planType);
        if (planInfo) {
            await this.addCreditsToUser(userId, planInfo.credits, 'subscription');
        }
    }
    
    /**
     * 处理订阅更新事件
     */
    async handleSubscriptionUpdated(subscription) {
        const userId = subscription.metadata.user_id;
        
        // 更新订阅状态
        await this.supabase
            .from('profiles')
            .update({
                subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString()
            })
            .eq('stripe_subscription_id', subscription.id);
    }
    
    /**
     * 处理订阅删除事件
     */
    async handleSubscriptionDeleted(subscription) {
        // 将用户订阅状态改为free
        await this.supabase
            .from('profiles')
            .update({
                subscription_status: 'free',
                subscription_id: null,
                subscription_expires_at: null
            })
            .eq('stripe_subscription_id', subscription.id);
    }
    
    /**
     * 处理发票支付成功事件
     */
    async handleInvoicePaymentSucceeded(invoice) {
        if (invoice.subscription) {
            const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
            const userId = subscription.metadata.user_id;
            const planType = subscription.metadata.plan_type;
            
            // 记录支付
            await this.recordPayment({
                userId,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_paid / 100, // 转换为元
                paymentType: 'subscription',
                status: 'succeeded',
                subscriptionPlan: planType
            });
            
            // 添加月度积分
            const planInfo = Object.values(this.planMapping).find(p => p.type === planType);
            if (planInfo) {
                await this.addCreditsToUser(userId, planInfo.credits, 'subscription');
            }
        }
    }
    
    /**
     * 处理发票支付失败事件
     */
    async handleInvoicePaymentFailed(invoice) {
        if (invoice.subscription) {
            const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
            const userId = subscription.metadata.user_id;
            
            // 记录失败的支付
            await this.recordPayment({
                userId,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_due / 100,
                paymentType: 'subscription',
                status: 'failed'
            });
            
            // 可以发送邮件通知用户支付失败
            console.log(`Payment failed for user ${userId}, invoice ${invoice.id}`);
        }
    }
    
    /**
     * 获取用户信息
     */
    async getUser(userId) {
        const { data, error } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Get user error:', error);
            return null;
        }
        
        return data;
    }
    
    /**
     * 添加积分到用户账户
     */
    async addCreditsToUser(userId, credits, transactionType) {
        try {
            // 使用数据库函数添加积分
            const { error } = await this.supabase.rpc('add_credits', {
                p_user_id: userId,
                p_credits: credits,
                p_transaction_type: transactionType,
                p_description: `Added ${credits} credits via ${transactionType}`
            });
            
            if (error) {
                throw error;
            }
            
            console.log(`Added ${credits} credits to user ${userId}`);
        } catch (error) {
            console.error('Add credits error:', error);
            throw error;
        }
    }
    
    /**
     * 记录支付信息
     */
    async recordPayment(paymentData) {
        try {
            const { error } = await this.supabase
                .from('payments')
                .insert({
                    user_id: paymentData.userId,
                    stripe_payment_intent_id: paymentData.stripePaymentIntentId,
                    stripe_invoice_id: paymentData.stripeInvoiceId,
                    amount_cents: Math.round(paymentData.amount * 100),
                    payment_type: paymentData.paymentType,
                    status: paymentData.status,
                    credits_purchased: paymentData.creditsPurchased,
                    subscription_plan: paymentData.subscriptionPlan
                });
            
            if (error) {
                throw error;
            }
            
        } catch (error) {
            console.error('Record payment error:', error);
            throw error;
        }
    }
}

module.exports = StripeHandler;