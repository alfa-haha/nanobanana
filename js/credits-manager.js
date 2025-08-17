/**
 * 积分管理器
 * 处理积分购买、使用、余额查询和交易历史
 */
class CreditsManager {
    constructor() {
        this.currentCredits = 0;
        this.transactionHistory = [];
        this.isLoading = false;
        
        // 积分包配置
        this.creditPackages = {
            small: {
                credits: 50,
                price: 19,
                currency: 'HKD',
                value: '最适合偶尔使用',
                popular: false
            },
            medium: {
                credits: 200,
                price: 69,
                currency: 'HKD',
                value: '最受欢迎的选择',
                popular: true
            },
            large: {
                credits: 500,
                price: 149,
                currency: 'HKD',
                value: '最超值的选择',
                popular: false
            }
        };
    }
    
    /**
     * 初始化积分管理器
     */
    async initialize(userId) {
        this.userId = userId;
        await this.loadUserCredits();
        this.setupEventListeners();
    }
    
    /**
     * 加载用户积分余额
     */
    async loadUserCredits() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`/api/user/credits/${this.userId}`, {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentCredits = data.credits || 0;
                this.updateCreditsDisplay();
            }
        } catch (error) {
            console.error('Failed to load user credits:', error);
        }
    }
    
    /**
     * 购买积分包
     */
    async purchaseCredits(packageType) {
        const package = this.creditPackages[packageType];
        if (!package) {
            throw new Error(`Invalid package type: ${packageType}`);
        }
        
        if (!this.userId) {
            throw new Error('User must be logged in to purchase credits');
        }
        
        try {
            this.isLoading = true;
            this.updateLoadingState(true);
            
            // 使用Stripe管理器创建支付会话
            await window.stripeManager.createCreditsCheckout(packageType, this.userId);
            
        } catch (error) {
            console.error('Credits purchase failed:', error);
            throw error;
        } finally {
            this.isLoading = false;
            this.updateLoadingState(false);
        }
    }
    
    /**
     * 使用积分
     */
    async useCredits(amount, description = '图片生成') {
        if (!this.userId) {
            throw new Error('User must be logged in to use credits');
        }
        
        if (this.currentCredits < amount) {
            throw new Error('Insufficient credits');
        }
        
        try {
            const response = await fetch('/api/user/use-credits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    userId: this.userId,
                    amount,
                    description
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to use credits');
            }
            
            const result = await response.json();
            this.currentCredits = result.remainingCredits;
            this.updateCreditsDisplay();
            
            return result;
        } catch (error) {
            console.error('Failed to use credits:', error);
            throw error;
        }
    }
    
    /**
     * 获取交易历史
     */
    async getTransactionHistory(limit = 20) {
        if (!this.userId) return [];
        
        try {
            const response = await fetch(`/api/user/credit-transactions/${this.userId}?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.transactionHistory = data.transactions || [];
                return this.transactionHistory;
            }
        } catch (error) {
            console.error('Failed to get transaction history:', error);
        }
        
        return [];
    }
    
    /**
     * 检查是否有足够积分
     */
    hasEnoughCredits(amount) {
        return this.currentCredits >= amount;
    }
    
    /**
     * 获取积分余额
     */
    getCreditsBalance() {
        return this.currentCredits;
    }
    
    /**
     * 更新积分显示
     */
    updateCreditsDisplay() {
        // 更新头部积分显示
        const creditsElements = document.querySelectorAll('.user-credits, .credits-balance');
        creditsElements.forEach(element => {
            element.textContent = this.currentCredits.toLocaleString();
        });
        
        // 更新积分不足警告
        this.updateInsufficientCreditsWarning();
        
        // 触发积分更新事件
        document.dispatchEvent(new CustomEvent('creditsUpdated', {
            detail: { credits: this.currentCredits }
        }));
    }
    
    /**
     * 更新积分不足警告
     */
    updateInsufficientCreditsWarning() {
        const warningElements = document.querySelectorAll('.insufficient-credits-warning');
        const showWarning = this.currentCredits < 5; // 少于5积分时显示警告
        
        warningElements.forEach(element => {
            element.style.display = showWarning ? 'block' : 'none';
        });
    }
    
    /**
     * 更新加载状态
     */
    updateLoadingState(isLoading) {
        const purchaseButtons = document.querySelectorAll('.credit-btn, .purchase-credits-btn');
        purchaseButtons.forEach(button => {
            button.disabled = isLoading;
            if (isLoading) {
                button.dataset.originalText = button.textContent;
                button.textContent = '处理中...';
            } else {
                button.textContent = button.dataset.originalText || button.textContent;
            }
        });
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听积分购买按钮
        document.addEventListener('click', async (e) => {
            if (e.target.matches('.credit-btn, .purchase-credits-btn')) {
                e.preventDefault();
                
                const packageType = e.target.dataset.package || 
                                 this.mapCreditsToPackageType(e.target.dataset.credits);
                
                if (packageType) {
                    try {
                        await this.purchaseCredits(packageType);
                    } catch (error) {
                        this.showError(error.message);
                    }
                }
            }
        });
        
        // 监听积分余额刷新
        document.addEventListener('click', (e) => {
            if (e.target.matches('.refresh-credits-btn')) {
                e.preventDefault();
                this.loadUserCredits();
            }
        });
    }
    
    /**
     * 映射积分数量到包类型
     */
    mapCreditsToPackageType(credits) {
        const mapping = {
            '50': 'small',
            '200': 'medium',
            '500': 'large'
        };
        return mapping[credits] || null;
    }
    
    /**
     * 创建积分购买界面
     */
    createPurchaseInterface() {
        const container = document.createElement('div');
        container.className = 'credits-purchase-interface';
        
        container.innerHTML = `
            <div class="credits-header">
                <h3>购买积分</h3>
                <p>选择最适合您需求的积分包</p>
            </div>
            
            <div class="credits-packages-grid">
                ${Object.entries(this.creditPackages).map(([type, pkg]) => `
                    <div class="credit-package-card ${pkg.popular ? 'popular' : ''}">
                        ${pkg.popular ? '<div class="popular-badge">最受欢迎</div>' : ''}
                        <div class="package-credits">${pkg.credits}</div>
                        <div class="package-credits-label">积分</div>
                        <div class="package-price">HK$${pkg.price}</div>
                        <div class="package-value">${pkg.value}</div>
                        <button class="purchase-btn" data-package="${type}">
                            购买积分包
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <div class="credits-info">
                <h4>关于积分</h4>
                <ul>
                    <li>每次图片生成消耗1积分</li>
                    <li>积分永不过期</li>
                    <li>可用于所有图片生成功能</li>
                    <li>支持商业使用</li>
                </ul>
            </div>
        `;
        
        return container;
    }
    
    /**
     * 显示积分购买模态框
     */
    showPurchaseModal() {
        const modal = document.createElement('div');
        modal.className = 'credits-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <button class="modal-close" onclick="this.closest('.credits-modal').remove()">×</button>
                    ${this.createPurchaseInterface().outerHTML}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定购买按钮事件
        modal.querySelectorAll('.purchase-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const packageType = e.target.dataset.package;
                try {
                    await this.purchaseCredits(packageType);
                    modal.remove();
                } catch (error) {
                    this.showError(error.message);
                }
            });
        });
    }
    
    /**
     * 显示交易历史
     */
    async showTransactionHistory() {
        const transactions = await this.getTransactionHistory();
        
        const modal = document.createElement('div');
        modal.className = 'transaction-history-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>积分交易历史</h3>
                        <button class="modal-close" onclick="this.closest('.transaction-history-modal').remove()">×</button>
                    </div>
                    <div class="transactions-list">
                        ${transactions.length > 0 ? transactions.map(tx => `
                            <div class="transaction-item">
                                <div class="transaction-info">
                                    <div class="transaction-type">${this.getTransactionTypeLabel(tx.transaction_type)}</div>
                                    <div class="transaction-description">${tx.description}</div>
                                    <div class="transaction-date">${new Date(tx.created_at).toLocaleDateString('zh-HK')}</div>
                                </div>
                                <div class="transaction-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
                                    ${tx.amount > 0 ? '+' : ''}${tx.amount}
                                </div>
                            </div>
                        `).join('') : '<div class="no-transactions">暂无交易记录</div>'}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 获取交易类型标签
     */
    getTransactionTypeLabel(type) {
        const labels = {
            'purchase': '购买积分',
            'generation': '图片生成',
            'subscription': '订阅赠送',
            'bonus': '奖励积分',
            'refund': '退款'
        };
        return labels[type] || type;
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
     * 显示错误消息
     */
    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="error-icon">⚠️</span>
                <span>${message}</span>
                <button class="close-btn" onclick="this.closest('.error-toast').remove()">×</button>
            </div>
        `;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fee2e2;
            color: #991b1b;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #fecaca;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    /**
     * 显示成功消息
     */
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="success-icon">✅</span>
                <span>${message}</span>
                <button class="close-btn" onclick="this.closest('.success-toast').remove()">×</button>
            </div>
        `;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d1fae5;
            color: #065f46;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #a7f3d0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }
}

// 创建全局实例
window.creditsManager = new CreditsManager();