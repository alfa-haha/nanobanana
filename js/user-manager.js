/**
 * 用户管理器
 * 处理用户资料、生成历史、使用统计和订阅管理
 */
class UserManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.generationHistory = [];
        this.usageStats = null;
        this.isLoading = false;
        
        // 绑定方法上下文
        this.showProfile = this.showProfile.bind(this);
        this.showGenerationHistory = this.showGenerationHistory.bind(this);
        this.showUsageStats = this.showUsageStats.bind(this);
        this.showSubscriptionManagement = this.showSubscriptionManagement.bind(this);
    }
    
    /**
     * 初始化用户管理器
     */
    async initialize(user, userProfile) {
        this.user = user;
        this.userProfile = userProfile;
        
        if (user && userProfile) {
            await this.loadUserData();
            this.updateUserDisplay();
        }
    }
    
    /**
     * 加载用户数据
     */
    async loadUserData() {
        if (!this.user) return;
        
        try {
            // 并行加载用户数据
            const [historyData, statsData] = await Promise.all([
                this.loadGenerationHistory(),
                this.loadUsageStats()
            ]);
            
            this.generationHistory = historyData;
            this.usageStats = statsData;
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }
    
    /**
     * 加载生成历史
     */
    async loadGenerationHistory(limit = 20) {
        if (!this.user) return [];
        
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`/api/user/generations/${this.user.id}?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.generations || [];
            }
        } catch (error) {
            console.error('Failed to load generation history:', error);
        }
        
        return [];
    }
    
    /**
     * 加载使用统计
     */
    async loadUsageStats() {
        if (!this.user) return null;
        
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`/api/user/stats/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.stats;
            }
        } catch (error) {
            console.error('Failed to load usage stats:', error);
        }
        
        return null;
    }
    
    /**
     * 更新用户显示
     */
    updateUserDisplay() {
        this.updateCreditsDisplay();
        this.updateSubscriptionDisplay();
        this.updateUsageLimits();
    }
    
    /**
     * 更新积分显示
     */
    updateCreditsDisplay() {
        if (!this.userProfile) return;
        
        const creditsElements = document.querySelectorAll('.user-credits .credits-count, .credits-balance');
        creditsElements.forEach(element => {
            element.textContent = this.userProfile.credits?.toLocaleString() || '0';
        });
        
        // 更新积分不足警告
        this.updateLowCreditsWarning();
    }
    
    /**
     * 更新订阅显示
     */
    updateSubscriptionDisplay() {
        if (!this.userProfile) return;
        
        const subscriptionElements = document.querySelectorAll('.subscription-status');
        const subscriptionStatus = this.userProfile.subscription_status || 'free';
        
        subscriptionElements.forEach(element => {
            element.textContent = this.getSubscriptionLabel(subscriptionStatus);
            element.className = `subscription-status ${subscriptionStatus}`;
        });
    }
    
    /**
     * 更新使用限制提醒
     */
    updateUsageLimits() {
        if (!this.usageStats || !this.userProfile) return;
        
        const subscriptionStatus = this.userProfile.subscription_status || 'free';
        const monthlyLimit = this.getMonthlyLimit(subscriptionStatus);
        const usedThisMonth = this.usageStats.monthly_generations || 0;
        const remainingGenerations = Math.max(0, monthlyLimit - usedThisMonth);
        
        // 更新使用统计显示
        const usageElements = document.querySelectorAll('.usage-stats');
        usageElements.forEach(element => {
            element.innerHTML = `
                <div class="usage-item">
                    <span class="usage-label">本月已用:</span>
                    <span class="usage-value">${usedThisMonth}</span>
                </div>
                <div class="usage-item">
                    <span class="usage-label">剩余:</span>
                    <span class="usage-value">${remainingGenerations}</span>
                </div>
            `;
        });
        
        // 显示限制警告
        this.updateLimitWarnings(remainingGenerations, monthlyLimit);
    }
    
    /**
     * 更新积分不足警告
     */
    updateLowCreditsWarning() {
        const credits = this.userProfile?.credits || 0;
        const warningElements = document.querySelectorAll('.low-credits-warning');
        const showWarning = credits < 5;
        
        warningElements.forEach(element => {
            element.style.display = showWarning ? 'block' : 'none';
            if (showWarning) {
                element.innerHTML = `
                    <div class="warning-content">
                        <span class="warning-icon">⚠️</span>
                        <span class="warning-text">积分不足！剩余 ${credits} 积分</span>
                        <button class="buy-credits-btn" onclick="window.creditsManager.showPurchaseModal()">
                            购买积分
                        </button>
                    </div>
                `;
            }
        });
    }
    
    /**
     * 更新限制警告
     */
    updateLimitWarnings(remaining, total) {
        const warningElements = document.querySelectorAll('.limit-warning');
        const warningThreshold = Math.ceil(total * 0.1); // 10% 剩余时警告
        const showWarning = remaining <= warningThreshold && remaining > 0;
        const showUpgrade = remaining === 0;
        
        warningElements.forEach(element => {
            if (showUpgrade) {
                element.style.display = 'block';
                element.className = 'limit-warning upgrade';
                element.innerHTML = `
                    <div class="warning-content">
                        <span class="warning-icon">🚫</span>
                        <span class="warning-text">本月生成次数已用完</span>
                        <button class="upgrade-btn" onclick="window.userManager.showSubscriptionManagement()">
                            升级订阅
                        </button>
                    </div>
                `;
            } else if (showWarning) {
                element.style.display = 'block';
                element.className = 'limit-warning warning';
                element.innerHTML = `
                    <div class="warning-content">
                        <span class="warning-icon">⚠️</span>
                        <span class="warning-text">本月剩余 ${remaining} 次生成</span>
                        <button class="upgrade-btn" onclick="window.userManager.showSubscriptionManagement()">
                            升级订阅
                        </button>
                    </div>
                `;
            } else {
                element.style.display = 'none';
            }
        });
    }
    
    /**
     * 显示用户资料
     */
    showProfile() {
        if (!this.user || !this.userProfile) {
            this.showError('用户信息未加载');
            return;
        }
        
        const modal = this.createModal('user-profile-modal', '用户资料');
        const content = modal.querySelector('.modal-body');
        
        content.innerHTML = `
            <div class="profile-content">
                <div class="profile-header">
                    <div class="profile-avatar">
                        <img src="${this.user.user_metadata?.avatar_url || '/assets/default-avatar.svg'}" 
                             alt="用户头像" class="avatar-image">
                    </div>
                    <div class="profile-info">
                        <h3 class="profile-name">${this.userProfile.display_name || '用户'}</h3>
                        <p class="profile-email">${this.user.email}</p>
                        <div class="profile-stats">
                            <div class="stat-item">
                                <span class="stat-label">积分余额</span>
                                <span class="stat-value">${this.userProfile.credits || 0}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">订阅状态</span>
                                <span class="stat-value subscription-status ${this.userProfile.subscription_status}">
                                    ${this.getSubscriptionLabel(this.userProfile.subscription_status)}
                                </span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总生成数</span>
                                <span class="stat-value">${this.userProfile.total_generations || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="profile-actions">
                    <button class="profile-btn" onclick="window.userManager.showGenerationHistory()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                        </svg>
                        查看生成历史
                    </button>
                    
                    <button class="profile-btn" onclick="window.userManager.showUsageStats()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M3 3v18h18"></path>
                            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                        </svg>
                        使用统计
                    </button>
                    
                    <button class="profile-btn" onclick="window.userManager.showSubscriptionManagement()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                            <line x1="1" y1="10" x2="23" y2="10"></line>
                        </svg>
                        订阅管理
                    </button>
                    
                    <button class="profile-btn" onclick="window.creditsManager.showPurchaseModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        购买积分
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 显示生成历史
     */
    async showGenerationHistory() {
        if (!this.user) {
            this.showError('请先登录');
            return;
        }
        
        const modal = this.createModal('generation-history-modal', '生成历史');
        const content = modal.querySelector('.modal-body');
        
        // 显示加载状态
        content.innerHTML = '<div class="loading-spinner">加载中...</div>';
        
        try {
            // 重新加载最新历史
            const history = await this.loadGenerationHistory(50);
            
            if (history.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="empty-icon">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                        </svg>
                        <h3>暂无生成记录</h3>
                        <p>开始创建您的第一张AI图片吧！</p>
                        <button class="start-generating-btn" onclick="document.querySelector('.generation-history-modal').remove(); document.getElementById('generator').scrollIntoView()">
                            开始生成
                        </button>
                    </div>
                `;
                return;
            }
            
            content.innerHTML = `
                <div class="history-header">
                    <div class="history-stats">
                        <span class="total-count">共 ${history.length} 张图片</span>
                        <button class="refresh-btn" onclick="window.userManager.showGenerationHistory()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M1 4v6h6"></path>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                            </svg>
                            刷新
                        </button>
                    </div>
                </div>
                
                <div class="history-gallery">
                    ${history.map(generation => this.createGenerationCard(generation)).join('')}
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load generation history:', error);
            content.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">⚠️</span>
                    <h3>加载失败</h3>
                    <p>无法加载生成历史，请稍后重试</p>
                    <button class="retry-btn" onclick="window.userManager.showGenerationHistory()">重试</button>
                </div>
            `;
        }
        
        document.body.appendChild(modal);
    }
    
    /**
     * 创建生成记录卡片
     */
    createGenerationCard(generation) {
        const createdAt = new Date(generation.created_at).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusClass = generation.status === 'completed' ? 'completed' : 
                           generation.status === 'failed' ? 'failed' : 'processing';
        
        return `
            <div class="generation-card ${statusClass}">
                <div class="card-image">
                    ${generation.status === 'completed' && generation.image_url ? 
                        `<img src="${generation.image_url}" alt="Generated image" loading="lazy" onclick="window.userManager.showImageModal('${generation.image_url}', '${generation.prompt}')">` :
                        `<div class="placeholder-image">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="9" cy="9" r="2"></circle>
                                <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                            </svg>
                        </div>`
                    }
                    <div class="card-status ${statusClass}">
                        ${generation.status === 'completed' ? '✓' : 
                          generation.status === 'failed' ? '✗' : '⏳'}
                    </div>
                </div>
                
                <div class="card-content">
                    <div class="card-prompt" title="${generation.prompt}">
                        ${generation.prompt.length > 60 ? generation.prompt.substring(0, 60) + '...' : generation.prompt}
                    </div>
                    
                    <div class="card-meta">
                        <span class="card-date">${createdAt}</span>
                        <span class="card-type">${generation.generation_type === 'text_to_image' ? '文生图' : '图生图'}</span>
                        ${generation.aspect_ratio ? `<span class="card-ratio">${generation.aspect_ratio}</span>` : ''}
                    </div>
                    
                    ${generation.status === 'completed' && generation.image_url ? `
                        <div class="card-actions">
                            <button class="action-btn download" onclick="window.userManager.downloadImage('${generation.image_url}', '${generation.id}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7,10 12,15 17,10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>
                            
                            <button class="action-btn regenerate" onclick="window.userManager.regenerateImage('${generation.prompt}', '${generation.aspect_ratio}', '${generation.style}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M1 4v6h6"></path>
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                </svg>
                            </button>
                            
                            <button class="action-btn share" onclick="window.userManager.shareImage('${generation.image_url}', '${generation.prompt}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="18" cy="5" r="3"></circle>
                                    <circle cx="6" cy="12" r="3"></circle>
                                    <circle cx="18" cy="19" r="3"></circle>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                </svg>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * 显示使用统计
     */
    async showUsageStats() {
        if (!this.user) {
            this.showError('请先登录');
            return;
        }
        
        const modal = this.createModal('usage-stats-modal', '使用统计');
        const content = modal.querySelector('.modal-body');
        
        // 显示加载状态
        content.innerHTML = '<div class="loading-spinner">加载中...</div>';
        
        try {
            // 重新加载最新统计
            const stats = await this.loadUsageStats();
            
            if (!stats) {
                content.innerHTML = `
                    <div class="error-state">
                        <span class="error-icon">⚠️</span>
                        <h3>加载失败</h3>
                        <p>无法加载使用统计，请稍后重试</p>
                    </div>
                `;
                return;
            }
            
            const subscriptionStatus = this.userProfile.subscription_status || 'free';
            const monthlyLimit = this.getMonthlyLimit(subscriptionStatus);
            const usedThisMonth = stats.monthly_generations || 0;
            const remainingGenerations = Math.max(0, monthlyLimit - usedThisMonth);
            const usagePercentage = monthlyLimit > 0 ? (usedThisMonth / monthlyLimit) * 100 : 0;
            
            content.innerHTML = `
                <div class="stats-content">
                    <div class="stats-overview">
                        <div class="stat-card primary">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="9" cy="9" r="2"></circle>
                                    <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                                </svg>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${stats.total_generations || 0}</div>
                                <div class="stat-label">总生成数</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${this.userProfile.credits || 0}</div>
                                <div class="stat-label">剩余积分</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                                </svg>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${usedThisMonth}</div>
                                <div class="stat-label">本月已用</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="usage-progress">
                        <div class="progress-header">
                            <h3>本月使用情况</h3>
                            <span class="progress-text">${usedThisMonth} / ${monthlyLimit === Infinity ? '无限' : monthlyLimit}</span>
                        </div>
                        
                        ${monthlyLimit !== Infinity ? `
                            <div class="progress-bar-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${Math.min(usagePercentage, 100)}%"></div>
                                </div>
                                <div class="progress-labels">
                                    <span>0</span>
                                    <span>${monthlyLimit}</span>
                                </div>
                            </div>
                            
                            <div class="remaining-info">
                                <span class="remaining-count">剩余 ${remainingGenerations} 次生成</span>
                                ${remainingGenerations < 10 ? `
                                    <button class="upgrade-suggestion" onclick="window.userManager.showSubscriptionManagement()">
                                        升级获得更多
                                    </button>
                                ` : ''}
                            </div>
                        ` : `
                            <div class="unlimited-badge">
                                <span class="unlimited-icon">∞</span>
                                <span>无限生成</span>
                            </div>
                        `}
                    </div>
                    
                    <div class="stats-breakdown">
                        <h3>详细统计</h3>
                        <div class="breakdown-grid">
                            <div class="breakdown-item">
                                <span class="breakdown-label">今日生成</span>
                                <span class="breakdown-value">${stats.daily_generations || 0}</span>
                            </div>
                            <div class="breakdown-item">
                                <span class="breakdown-label">本周生成</span>
                                <span class="breakdown-value">${stats.weekly_generations || 0}</span>
                            </div>
                            <div class="breakdown-item">
                                <span class="breakdown-label">文生图</span>
                                <span class="breakdown-value">${stats.text_to_image_count || 0}</span>
                            </div>
                            <div class="breakdown-item">
                                <span class="breakdown-label">图生图</span>
                                <span class="breakdown-value">${stats.image_to_image_count || 0}</span>
                            </div>
                            <div class="breakdown-item">
                                <span class="breakdown-label">平均生成时间</span>
                                <span class="breakdown-value">${stats.avg_generation_time || 0}s</span>
                            </div>
                            <div class="breakdown-item">
                                <span class="breakdown-label">成功率</span>
                                <span class="breakdown-value">${stats.success_rate || 0}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load usage stats:', error);
            content.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">⚠️</span>
                    <h3>加载失败</h3>
                    <p>无法加载使用统计，请稍后重试</p>
                    <button class="retry-btn" onclick="window.userManager.showUsageStats()">重试</button>
                </div>
            `;
        }
        
        document.body.appendChild(modal);
    }
    
    /**
     * 显示订阅管理
     */
    showSubscriptionManagement() {
        if (!this.user || !this.userProfile) {
            this.showError('请先登录');
            return;
        }
        
        const modal = this.createModal('subscription-management-modal', '订阅管理');
        const content = modal.querySelector('.modal-body');
        
        const currentPlan = this.userProfile.subscription_status || 'free';
        const subscriptionExpires = this.userProfile.subscription_expires_at;
        
        content.innerHTML = `
            <div class="subscription-content">
                <div class="current-plan">
                    <h3>当前订阅</h3>
                    <div class="plan-card current">
                        <div class="plan-header">
                            <div class="plan-name">${this.getSubscriptionLabel(currentPlan)}</div>
                            <div class="plan-status ${currentPlan}">${this.getSubscriptionStatusText(currentPlan)}</div>
                        </div>
                        
                        <div class="plan-details">
                            <div class="plan-feature">
                                <span class="feature-label">月度生成限制:</span>
                                <span class="feature-value">${this.getMonthlyLimitText(currentPlan)}</span>
                            </div>
                            
                            ${subscriptionExpires ? `
                                <div class="plan-feature">
                                    <span class="feature-label">到期时间:</span>
                                    <span class="feature-value">${new Date(subscriptionExpires).toLocaleDateString('zh-CN')}</span>
                                </div>
                            ` : ''}
                            
                            <div class="plan-feature">
                                <span class="feature-label">当前积分:</span>
                                <span class="feature-value">${this.userProfile.credits || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${currentPlan === 'free' ? `
                    <div class="upgrade-section">
                        <h3>升级订阅</h3>
                        <p>选择适合您需求的订阅计划，享受更多生成次数和优先支持</p>
                        
                        <div class="plans-grid">
                            ${this.createSubscriptionPlanCard('starter', '入门版', 19.99, 200, false)}
                            ${this.createSubscriptionPlanCard('pro', '专业版', 39.99, 500, true)}
                            ${this.createSubscriptionPlanCard('studio', '工作室版', 79.99, 1500, false)}
                        </div>
                    </div>
                ` : `
                    <div class="manage-section">
                        <h3>管理订阅</h3>
                        
                        <div class="management-actions">
                            ${currentPlan !== 'studio' ? `
                                <button class="manage-btn upgrade" onclick="window.userManager.showUpgradeOptions()">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    升级订阅
                                </button>
                            ` : ''}
                            
                            <button class="manage-btn billing" onclick="window.userManager.openBillingPortal()">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                    <line x1="1" y1="10" x2="23" y2="10"></line>
                                </svg>
                                管理账单
                            </button>
                            
                            <button class="manage-btn cancel" onclick="window.userManager.cancelSubscription()">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                                取消订阅
                            </button>
                        </div>
                    </div>
                `}
                
                <div class="credits-section">
                    <h3>积分管理</h3>
                    <p>积分可用于超出订阅限制时的额外生成，永不过期</p>
                    
                    <div class="credits-actions">
                        <button class="credits-btn" onclick="window.creditsManager.showPurchaseModal()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            购买积分
                        </button>
                        
                        <button class="credits-btn" onclick="window.creditsManager.showTransactionHistory()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 3v18h18"></path>
                                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                            </svg>
                            交易记录
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 创建订阅计划卡片
     */
    createSubscriptionPlanCard(planType, planName, price, limit, recommended) {
        return `
            <div class="plan-card ${recommended ? 'recommended' : ''}">
                ${recommended ? '<div class="recommended-badge">推荐</div>' : ''}
                
                <div class="plan-header">
                    <div class="plan-name">${planName}</div>
                    <div class="plan-price">HK$${price}<span class="price-period">/月</span></div>
                </div>
                
                <div class="plan-features">
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="feature-icon">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        <span>每月 ${limit} 次生成</span>
                    </div>
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="feature-icon">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        <span>高质量图片输出</span>
                    </div>
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="feature-icon">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        <span>商业使用授权</span>
                    </div>
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="feature-icon">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        <span>优先客服支持</span>
                    </div>
                </div>
                
                <button class="plan-btn" data-plan="${planType}" onclick="window.userManager.subscribeToPlan('${planType}')">
                    选择 ${planName}
                </button>
            </div>
        `;
    }
    
    /**
     * 订阅计划
     */
    async subscribeToPlan(planType) {
        if (!this.user) {
            this.showError('请先登录');
            return;
        }
        
        try {
            // 使用Stripe管理器创建订阅
            await window.stripeManager.createSubscriptionCheckout(planType, this.user.id);
        } catch (error) {
            console.error('Subscribe to plan failed:', error);
            this.showError('订阅失败，请重试');
        }
    }
    
    /**
     * 显示升级选项
     */
    showUpgradeOptions() {
        const currentPlan = this.userProfile.subscription_status || 'free';
        const availableUpgrades = this.getAvailableUpgrades(currentPlan);
        
        if (availableUpgrades.length === 0) {
            this.showError('您已经是最高级别的订阅');
            return;
        }
        
        const modal = this.createModal('upgrade-options-modal', '升级订阅');
        const content = modal.querySelector('.modal-body');
        
        content.innerHTML = `
            <div class="upgrade-content">
                <h3>选择升级计划</h3>
                <p>升级后立即生效，按比例计费</p>
                
                <div class="upgrade-plans">
                    ${availableUpgrades.map(plan => this.createSubscriptionPlanCard(
                        plan.type, 
                        plan.name, 
                        plan.price, 
                        plan.limit, 
                        plan.recommended
                    )).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 获取可用升级选项
     */
    getAvailableUpgrades(currentPlan) {
        const plans = [
            { type: 'starter', name: '入门版', price: 19.99, limit: 200, recommended: false },
            { type: 'pro', name: '专业版', price: 39.99, limit: 500, recommended: true },
            { type: 'studio', name: '工作室版', price: 79.99, limit: 1500, recommended: false }
        ];
        
        const currentIndex = plans.findIndex(p => p.type === currentPlan);
        return currentIndex >= 0 ? plans.slice(currentIndex + 1) : plans;
    }
    
    /**
     * 打开账单门户
     */
    async openBillingPortal() {
        if (!this.user) {
            this.showError('请先登录');
            return;
        }
        
        try {
            const response = await fetch('/api/stripe/create-billing-portal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    userId: this.user.id,
                    returnUrl: window.location.origin
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create billing portal');
            }
            
            const data = await response.json();
            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error?.message || 'Failed to create billing portal');
            }
        } catch (error) {
            console.error('Open billing portal failed:', error);
            this.showError('无法打开账单管理页面，请重试');
        }
    }
    
    /**
     * 取消订阅
     */
    async cancelSubscription() {
        if (!this.user) {
            this.showError('请先登录');
            return;
        }
        
        const confirmed = confirm('确定要取消订阅吗？取消后将在当前计费周期结束时生效。');
        if (!confirmed) return;
        
        try {
            const response = await fetch('/api/stripe/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    userId: this.user.id
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to cancel subscription');
            }
            
            const data = await response.json();
            if (data.success) {
                this.showSuccess('订阅已取消，将在当前计费周期结束时生效');
                // 刷新用户资料
                await this.loadUserData();
                this.updateUserDisplay();
            } else {
                throw new Error(data.error?.message || 'Failed to cancel subscription');
            }
        } catch (error) {
            console.error('Cancel subscription failed:', error);
            this.showError('取消订阅失败，请重试');
        }
    }
    
    /**
     * 显示图片模态框
     */
    showImageModal(imageUrl, prompt) {
        const modal = this.createModal('image-modal', '查看图片');
        const content = modal.querySelector('.modal-body');
        
        content.innerHTML = `
            <div class="image-modal-content">
                <div class="image-container">
                    <img src="${imageUrl}" alt="Generated image" class="modal-image">
                </div>
                <div class="image-info">
                    <div class="image-prompt">
                        <h4>提示词</h4>
                        <p>${prompt}</p>
                    </div>
                    <div class="image-actions">
                        <button class="action-btn download" onclick="window.userManager.downloadImage('${imageUrl}', 'generated-image')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7,10 12,15 17,10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            下载
                        </button>
                        <button class="action-btn share" onclick="window.userManager.shareImage('${imageUrl}', '${prompt}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                            分享
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 下载图片
     */
    async downloadImage(imageUrl, filename) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'generated-image.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess('图片下载成功');
        } catch (error) {
            console.error('Download failed:', error);
            this.showError('下载失败，请重试');
        }
    }
    
    /**
     * 重新生成图片
     */
    regenerateImage(prompt, aspectRatio, style) {
        // 关闭当前模态框
        document.querySelectorAll('.modal').forEach(modal => modal.remove());
        
        // 滚动到生成器区域
        document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
        
        // 填充参数
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.value = prompt;
        }
        
        // 设置比例
        if (aspectRatio) {
            const ratioBtn = document.querySelector(`[data-ratio="${aspectRatio}"]`);
            if (ratioBtn) {
                document.querySelectorAll('.ratio-btn').forEach(btn => btn.classList.remove('active'));
                ratioBtn.classList.add('active');
            }
        }
        
        // 设置风格
        if (style) {
            const styleBtn = document.querySelector(`[data-style="${style}"]`);
            if (styleBtn) {
                document.querySelectorAll('.style-btn').forEach(btn => btn.classList.remove('active'));
                styleBtn.classList.add('active');
            }
        }
        
        this.showSuccess('参数已填充，点击生成按钮重新生成');
    }
    
    /**
     * 分享图片
     */
    async shareImage(imageUrl, prompt) {
        if (navigator.share) {
            // 使用原生分享API
            try {
                await navigator.share({
                    title: 'AI生成的图片',
                    text: `使用Nano Banana生成的图片：${prompt}`,
                    url: imageUrl
                });
                this.showSuccess('分享成功');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                    this.fallbackShare(imageUrl);
                }
            }
        } else {
            // 降级到复制链接
            this.fallbackShare(imageUrl);
        }
    }
    
    /**
     * 降级分享方法
     */
    async fallbackShare(imageUrl) {
        if (navigator.clipboard) {
            // 复制链接到剪贴板
            try {
                await navigator.clipboard.writeText(imageUrl);
                this.showSuccess('图片链接已复制到剪贴板');
            } catch (error) {
                console.error('Failed to copy to clipboard:', error);
                this.showError('分享失败，请手动复制链接');
            }
        }
    }
            return;
        }
        
        try {
            // 使用 Stripe 管理器创建订阅
            await window.stripeManager.createSubscriptionCheckout(planType, this.user.id);
        } catch (error) {
            console.error('Failed to create subscription:', error);
            this.showError('创建订阅失败，请重试');
        }
    }
    
    /**
     * 打开账单门户
     */
    async openBillingPortal() {
        if (!this.user) {
            this.showError('请先登录');
            return;
        }
        
        try {
            const token = await this.getAuthToken();
            const response = await fetch('/api/stripe/create-portal-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: this.user.id,
                    returnUrl: window.location.origin
                })
            });
            
            if (response.ok) {
                const { url } = await response.json();
                window.location.href = url;
            } else {
                throw new Error('Failed to create portal session');
            }
        } catch (error) {
            console.error('Failed to open billing portal:', error);
            this.showError('无法打开账单管理页面，请重试');
        }
    }
    
    /**
     * 取消订阅
     */
    async cancelSubscription() {
        if (!confirm('确定要取消订阅吗？取消后将在当前计费周期结束时生效。')) {
            return;
        }
        
        try {
            const token = await this.getAuthToken();
            const response = await fetch('/api/stripe/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: this.user.id
                })
            });
            
            if (response.ok) {
                this.showSuccess('订阅已取消，将在当前计费周期结束时生效');
                // 刷新用户数据
                await this.loadUserData();
                this.updateUserDisplay();
            } else {
                throw new Error('Failed to cancel subscription');
            }
        } catch (error) {
            console.error('Failed to cancel subscription:', error);
            this.showError('取消订阅失败，请重试');
        }
    }
    
    /**
     * 显示图片模态框
     */
    showImageModal(imageUrl, prompt) {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.image-modal').remove()">
                <div class="image-modal-content" onclick="event.stopPropagation()">
                    <button class="modal-close" onclick="this.closest('.image-modal').remove()">×</button>
                    <img src="${imageUrl}" alt="Generated image" class="modal-image">
                    <div class="image-info">
                        <p class="image-prompt">${prompt}</p>
                        <div class="image-actions">
                            <button class="action-btn" onclick="window.userManager.downloadImage('${imageUrl}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7,10 12,15 17,10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                下载
                            </button>
                            <button class="action-btn" onclick="window.userManager.shareImage('${imageUrl}', '${prompt}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="18" cy="5" r="3"></circle>
                                    <circle cx="6" cy="12" r="3"></circle>
                                    <circle cx="18" cy="19" r="3"></circle>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                </svg>
                                分享
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 下载图片
     */
    async downloadImage(imageUrl, generationId = null) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nano-banana-${generationId || Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess('图片下载成功');
        } catch (error) {
            console.error('Failed to download image:', error);
            this.showError('下载失败，请重试');
        }
    }
    
    /**
     * 重新生成图片
     */
    regenerateImage(prompt, aspectRatio, style) {
        // 关闭当前模态框
        document.querySelectorAll('.modal').forEach(modal => modal.remove());
        
        // 滚动到生成器区域
        document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
        
        // 填充参数
        setTimeout(() => {
            const promptInput = document.getElementById('promptInput');
            if (promptInput) {
                promptInput.value = prompt;
            }
            
            // 设置比例
            if (aspectRatio) {
                const ratioBtn = document.querySelector(`[data-ratio="${aspectRatio}"]`);
                if (ratioBtn) {
                    document.querySelectorAll('.ratio-btn').forEach(btn => btn.classList.remove('active'));
                    ratioBtn.classList.add('active');
                }
            }
            
            // 设置风格
            if (style) {
                const styleBtn = document.querySelector(`[data-style="${style}"]`);
                if (styleBtn) {
                    document.querySelectorAll('.style-btn').forEach(btn => btn.classList.remove('active'));
                    styleBtn.classList.add('active');
                }
            }
        }, 500);
    }
    
    /**
     * 分享图片
     */
    async shareImage(imageUrl, prompt) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Nano Banana AI 生成的图片',
                    text: `看看我用 AI 生成的图片：${prompt}`,
                    url: imageUrl
                });
            } catch (error) {
                console.error('Failed to share:', error);
            }
        } else {
            // 复制链接到剪贴板
            try {
                await navigator.clipboard.writeText(imageUrl);
                this.showSuccess('图片链接已复制到剪贴板');
            } catch (error) {
                console.error('Failed to copy to clipboard:', error);
                this.showError('分享失败，请手动复制链接');
            }
        }
    }
    
    /**
     * 创建模态框
     */
    createModal(className, title) {
        const modal = document.createElement('div');
        modal.className = `modal ${className}`;
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <!-- Content will be inserted here -->
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }
    
    /**
     * 获取订阅标签
     */
    getSubscriptionLabel(status) {
        const labels = {
            'free': '免费版',
            'starter': '入门版',
            'pro': '专业版',
            'studio': '工作室版'
        };
        return labels[status] || '未知';
    }
    
    /**
     * 获取订阅状态文本
     */
    getSubscriptionStatusText(status) {
        const texts = {
            'free': '免费使用',
            'starter': '已激活',
            'pro': '已激活',
            'studio': '已激活'
        };
        return texts[status] || '未知';
    }
    
    /**
     * 获取月度限制
     */
    getMonthlyLimit(subscriptionStatus) {
        const limits = {
            'free': 0, // 免费用户只能用积分
            'starter': 200,
            'pro': 500,
            'studio': 1500
        };
        return limits[subscriptionStatus] || 0;
    }
    
    /**
     * 获取月度限制文本
     */
    getMonthlyLimitText(subscriptionStatus) {
        const limit = this.getMonthlyLimit(subscriptionStatus);
        return limit === 0 ? '仅积分' : limit === Infinity ? '无限' : `${limit} 次`;
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
window.userManager = new UserManager();