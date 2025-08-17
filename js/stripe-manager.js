/**
 * Stripe支付管理器
 * 处理订阅支付、积分购买和支付状态管理
 */
class StripeManager {
    constructor() {
        this.stripe = null;
        this.isInitialized = false;
        this.currentUser = null;
        
        // 订阅计划配置
        this.subscriptionPlans = {
            starter: {
                name: 'Starter Plan',
                price: 39,
                currency: 'HKD',
                credits: 100,
                priceId: 'price_starter_hkd_monthly' // 需要在Stripe中创建
            },
            pro: {
                name: 'Pro Plan',
                price: 99,
                currency: 'HKD',
                credits: 500,
                priceId: 'price_pro_hkd_monthly',
                recommended: true
            },
            studio: {
                name: 'Studio Plan',
                price: 299,
                currency: 'HKD',
                credits: 2000,
                priceId: 'price_studio_hkd_monthly'
            }
        };
        
        // 积分包配置
        this.creditPackages = {
            small: {
                name: '50 Credits Pack',
                price: 19,
                currency: 'HKD',
                credits: 50,
                priceId: 'price_credits_50_hkd'
            },
            medium: {
                name: '200 Credits Pack',
                price: 69,
                currency: 'HKD',
                credits: 200,
                priceId: 'price_credits_200_hkd'
            },
            large: {
                name: '500 Credits Pack',
                price: 149,
                currency: 'HKD',
                credits: 500,
                priceId: 'price_credits_500_hkd'
            }
        };
    }
    
    /**
     * 初始化Stripe
     */
    async initialize(publishableKey) {
        try {
            if (!publishableKey) {
                throw new Error('Stripe publishable key is required');
            }
            
            this.stripe = Stripe(publishableKey);
            this.isInitialized = true;
            
            console.log('Stripe initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Stripe:', error);
            throw error;
        }
    }
    
    /**
     * 创建订阅支付会话
     */
    async createSubscriptionCheckout(planType, userId) {
        if (!this.isInitialized) {
            throw new Error('Stripe not initialized');
        }
        
        const plan = this.subscriptionPlans[planType];
        if (!plan) {
            throw new Error(`Invalid plan type: ${planType}`);
        }
        
        try {
            // 调用后端API创建checkout会话
            const response = await fetch('/api/stripe/create-subscription-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    planType,
                    priceId: plan.priceId,
                    userId,
                    successUrl: `${window.location.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${window.location.origin}/pricing?canceled=true`
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create checkout session');
            }
            
            const { sessionId } = await response.json();
            
            // 重定向到Stripe Checkout
            const { error } = await this.stripe.redirectToCheckout({
                sessionId: sessionId
            });
            
            if (error) {
                throw error;
            }
            
        } catch (error) {
            console.error('Subscription checkout error:', error);
            this.showError('支付页面创建失败，请重试');
            throw error;
        }
    }
    
    /**
     * 创建积分购买支付会话
     */
    async createCreditsCheckout(packageType, userId) {
        if (!this.isInitialized) {
            throw new Error('Stripe not initialized');
        }
        
        const package = this.creditPackages[packageType];
        if (!package) {
            throw new Error(`Invalid package type: ${packageType}`);
        }
        
        try {
            const response = await fetch('/api/stripe/create-credits-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    packageType,
                    priceId: package.priceId,
                    userId,
                    successUrl: `${window.location.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${window.location.origin}/pricing?canceled=true`
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create checkout session');
            }
            
            const { sessionId } = await response.json();
            
            // 重定向到Stripe Checkout
            const { error } = await this.stripe.redirectToCheckout({
                sessionId: sessionId
            });
            
            if (error) {
                throw error;
            }
            
        } catch (error) {
            console.error('Credits checkout error:', error);
            this.showError('支付页面创建失败，请重试');
            throw error;
        }
    }
    
    /**
     * 获取用户订阅状态
     */
    async getSubscriptionStatus(userId) {
        try {
            const response = await fetch(`/api/stripe/subscription-status/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch subscription status');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get subscription status:', error);
            return null;
        }
    }
    
    /**
     * 取消订阅
     */
    async cancelSubscription(subscriptionId) {
        try {
            const response = await fetch('/api/stripe/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({ subscriptionId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to cancel subscription');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to cancel subscription:', error);
            throw error;
        }
    }
    
    /**
     * 更新订阅计划
     */
    async updateSubscription(subscriptionId, newPlanType) {
        const newPlan = this.subscriptionPlans[newPlanType];
        if (!newPlan) {
            throw new Error(`Invalid plan type: ${newPlanType}`);
        }
        
        try {
            const response = await fetch('/api/stripe/update-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    subscriptionId,
                    newPriceId: newPlan.priceId
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update subscription');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to update subscription:', error);
            throw error;
        }
    }
    
    /**
     * 处理支付成功回调
     */
    async handlePaymentSuccess(sessionId) {
        try {
            const response = await fetch('/api/stripe/payment-success', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({ sessionId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to process payment success');
            }
            
            const result = await response.json();
            
            // 更新用户界面
            if (result.type === 'subscription') {
                this.showSuccess(`订阅 ${result.planName} 成功！`);
            } else if (result.type === 'credits') {
                this.showSuccess(`成功购买 ${result.credits} 积分！`);
            }
            
            // 刷新用户状态
            if (window.authManager) {
                await window.authManager.refreshUserStatus();
            }
            
            return result;
        } catch (error) {
            console.error('Failed to handle payment success:', error);
            this.showError('支付处理失败，请联系客服');
            throw error;
        }
    }
    
    /**
     * 获取认证token
     */
    async getAuthToken() {
        if (window.authManager && window.authManager.user) {
            const session = await window.authManager.supabase.auth.getSession();
            return session.data.session?.access_token;
        }
        return null;
    }
    
    /**
     * 显示成功消息
     */
    showSuccess(message) {
        // 创建成功提示
        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="icon-check"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    /**
     * 显示错误消息
     */
    showError(message) {
        // 创建错误提示
        const toast = document.createElement('div');
        toast.className = 'toast toast-error';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="icon-error"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 5秒后自动移除
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    /**
     * 格式化价格显示
     */
    formatPrice(amount, currency = 'HKD') {
        return new Intl.NumberFormat('zh-HK', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }
    
    /**
     * 获取计划信息
     */
    getPlanInfo(planType) {
        return this.subscriptionPlans[planType] || null;
    }
    
    /**
     * 获取积分包信息
     */
    getPackageInfo(packageType) {
        return this.creditPackages[packageType] || null;
    }
}

// 创建全局实例
window.stripeManager = new StripeManager();