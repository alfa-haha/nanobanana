/**
 * Replicate API客户端
 * 处理图片生成API调用、状态轮询和成本监控
 */
class ReplicateClient {
    constructor() {
        this.apiToken = 'YOUR_REPLICATE_API_TOKEN'; // 占位符：需要替换为真实的API Token
        this.baseUrl = 'https://api.replicate.com/v1';
        this.defaultModel = 'stability-ai/stable-diffusion-xl-base-1.0'; // 占位符：替换为你选择的模型
        this.webhookUrl = 'YOUR_WEBHOOK_URL'; // 占位符：可选的webhook回调URL
        
        // 成本监控配置
        this.costTracking = {
            dailyLimit: 10.00, // 占位符：每日成本限制（美元）
            monthlyLimit: 100.00, // 占位符：每月成本限制（美元）
            alertThreshold: 0.8 // 占位符：告警阈值（80%时告警）
        };
        
        // 初始化成本跟踪
        this.initializeCostTracking();
    }

    /**
     * 初始化成本跟踪
     */
    initializeCostTracking() {
        const today = new Date().toDateString();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM格式
        
        // 获取或初始化今日成本
        if (!localStorage.getItem(`dailyCost_${today}`)) {
            localStorage.setItem(`dailyCost_${today}`, '0');
        }
        
        // 获取或初始化本月成本
        if (!localStorage.getItem(`monthlyCost_${currentMonth}`)) {
            localStorage.setItem(`monthlyCost_${currentMonth}`, '0');
        }
    }

    /**
     * 获取API请求头
     */
    getHeaders() {
        return {
            'Authorization': `Token ${this.apiToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * 创建图片生成预测
     * @param {Object} input - 生成参数
     * @param {string} input.prompt - 文本提示词
     * @param {string} input.negative_prompt - 负面提示词
     * @param {number} input.width - 图片宽度
     * @param {number} input.height - 图片高度
     * @param {number} input.num_inference_steps - 推理步数
     * @param {number} input.guidance_scale - 引导比例
     * @param {string} input.scheduler - 调度器
     * @returns {Promise<Object>} 预测结果
     */
    async createPrediction(input) {
        try {
            // 检查成本限制
            if (!this.checkCostLimits()) {
                throw new Error('已达到成本限制，无法创建新的生成任务');
            }

            const payload = {
                version: this.getModelVersion(),
                input: {
                    prompt: input.prompt,
                    negative_prompt: input.negative_prompt || '',
                    width: input.width || 1024,
                    height: input.height || 1024,
                    num_inference_steps: input.num_inference_steps || 50,
                    guidance_scale: input.guidance_scale || 7.5,
                    scheduler: input.scheduler || 'K_EULER',
                    ...input
                }
            };

            // 如果配置了webhook，添加到payload
            if (this.webhookUrl && this.webhookUrl !== 'YOUR_WEBHOOK_URL') {
                payload.webhook = this.webhookUrl;
                payload.webhook_events_filter = ['start', 'output', 'logs', 'completed'];
            }

            const response = await fetch(`${this.baseUrl}/predictions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API请求失败: ${response.status} - ${errorData.detail || response.statusText}`);
            }

            const prediction = await response.json();
            
            // 记录预测ID用于成本跟踪
            this.trackPrediction(prediction.id);
            
            return prediction;
        } catch (error) {
            console.error('创建预测失败:', error);
            throw error;
        }
    }

    /**
     * 获取预测状态
     * @param {string} predictionId - 预测ID
     * @returns {Promise<Object>} 预测状态
     */
    async getPrediction(predictionId) {
        try {
            const response = await fetch(`${this.baseUrl}/predictions/${predictionId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`获取预测状态失败: ${response.status} - ${errorData.detail || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取预测状态失败:', error);
            throw error;
        }
    }

    /**
     * 轮询预测状态直到完成
     * @param {string} predictionId - 预测ID
     * @param {Function} onProgress - 进度回调函数
     * @param {number} maxAttempts - 最大轮询次数
     * @returns {Promise<Object>} 最终预测结果
     */
    async pollPrediction(predictionId, onProgress = null, maxAttempts = 60) {
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const prediction = await this.getPrediction(predictionId);
                
                // 调用进度回调
                if (onProgress && typeof onProgress === 'function') {
                    onProgress(prediction);
                }
                
                // 检查是否完成
                if (prediction.status === 'succeeded') {
                    // 更新成本跟踪
                    this.updateCostTracking(prediction);
                    return prediction;
                } else if (prediction.status === 'failed') {
                    throw new Error(`图片生成失败: ${prediction.error || '未知错误'}`);
                } else if (prediction.status === 'canceled') {
                    throw new Error('图片生成被取消');
                }
                
                // 等待后继续轮询
                await this.sleep(2000); // 2秒间隔
                attempts++;
                
            } catch (error) {
                console.error('轮询预测状态失败:', error);
                throw error;
            }
        }
        
        throw new Error('轮询超时，图片生成可能仍在进行中');
    }

    /**
     * 取消预测
     * @param {string} predictionId - 预测ID
     * @returns {Promise<Object>} 取消结果
     */
    async cancelPrediction(predictionId) {
        try {
            const response = await fetch(`${this.baseUrl}/predictions/${predictionId}/cancel`, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`取消预测失败: ${response.status} - ${errorData.detail || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('取消预测失败:', error);
            throw error;
        }
    }

    /**
     * 获取模型版本
     * @returns {string} 模型版本ID
     */
    getModelVersion() {
        // 占位符：需要替换为实际的模型版本ID
        // 可以通过 https://api.replicate.com/v1/models/{owner}/{name} 获取最新版本
        return 'MODEL_VERSION_ID_PLACEHOLDER';
    }

    /**
     * 检查成本限制
     * @returns {boolean} 是否可以继续生成
     */
    checkCostLimits() {
        const today = new Date().toDateString();
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        const dailyCost = parseFloat(localStorage.getItem(`dailyCost_${today}`) || '0');
        const monthlyCost = parseFloat(localStorage.getItem(`monthlyCost_${currentMonth}`) || '0');
        
        if (dailyCost >= this.costTracking.dailyLimit) {
            console.warn('已达到每日成本限制');
            return false;
        }
        
        if (monthlyCost >= this.costTracking.monthlyLimit) {
            console.warn('已达到每月成本限制');
            return false;
        }
        
        // 检查告警阈值
        if (dailyCost >= this.costTracking.dailyLimit * this.costTracking.alertThreshold) {
            console.warn(`每日成本接近限制: $${dailyCost.toFixed(2)}/$${this.costTracking.dailyLimit}`);
        }
        
        if (monthlyCost >= this.costTracking.monthlyLimit * this.costTracking.alertThreshold) {
            console.warn(`每月成本接近限制: $${monthlyCost.toFixed(2)}/$${this.costTracking.monthlyLimit}`);
        }
        
        return true;
    }

    /**
     * 跟踪预测请求
     * @param {string} predictionId - 预测ID
     */
    trackPrediction(predictionId) {
        const predictions = JSON.parse(localStorage.getItem('trackedPredictions') || '[]');
        predictions.push({
            id: predictionId,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        localStorage.setItem('trackedPredictions', JSON.stringify(predictions));
    }

    /**
     * 更新成本跟踪
     * @param {Object} prediction - 完成的预测对象
     */
    updateCostTracking(prediction) {
        // 估算成本（占位符：需要根据实际模型定价调整）
        const estimatedCost = this.estimateCost(prediction);
        
        const today = new Date().toDateString();
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // 更新每日成本
        const currentDailyCost = parseFloat(localStorage.getItem(`dailyCost_${today}`) || '0');
        localStorage.setItem(`dailyCost_${today}`, (currentDailyCost + estimatedCost).toString());
        
        // 更新每月成本
        const currentMonthlyCost = parseFloat(localStorage.getItem(`monthlyCost_${currentMonth}`) || '0');
        localStorage.setItem(`monthlyCost_${currentMonth}`, (currentMonthlyCost + estimatedCost).toString());
        
        // 更新预测跟踪状态
        const predictions = JSON.parse(localStorage.getItem('trackedPredictions') || '[]');
        const predictionIndex = predictions.findIndex(p => p.id === prediction.id);
        if (predictionIndex !== -1) {
            predictions[predictionIndex].status = 'completed';
            predictions[predictionIndex].cost = estimatedCost;
            localStorage.setItem('trackedPredictions', JSON.stringify(predictions));
        }
        
        console.log(`成本更新: +$${estimatedCost.toFixed(4)} (预测ID: ${prediction.id})`);
    }

    /**
     * 估算预测成本
     * @param {Object} prediction - 预测对象
     * @returns {number} 估算成本（美元）
     */
    estimateCost(prediction) {
        // 占位符：需要根据实际模型定价调整
        // 这里使用一个基础估算，实际成本可能因模型而异
        const baseRate = 0.0055; // 每次生成的基础费率（美元）
        const complexityMultiplier = this.getComplexityMultiplier(prediction.input);
        
        return baseRate * complexityMultiplier;
    }

    /**
     * 获取复杂度乘数
     * @param {Object} input - 输入参数
     * @returns {number} 复杂度乘数
     */
    getComplexityMultiplier(input) {
        let multiplier = 1.0;
        
        // 根据图片尺寸调整
        const pixels = (input.width || 1024) * (input.height || 1024);
        if (pixels > 1024 * 1024) {
            multiplier *= 1.5;
        }
        
        // 根据推理步数调整
        const steps = input.num_inference_steps || 50;
        if (steps > 50) {
            multiplier *= 1.2;
        }
        
        return multiplier;
    }

    /**
     * 获取成本统计
     * @returns {Object} 成本统计信息
     */
    getCostStats() {
        const today = new Date().toDateString();
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        const dailyCost = parseFloat(localStorage.getItem(`dailyCost_${today}`) || '0');
        const monthlyCost = parseFloat(localStorage.getItem(`monthlyCost_${currentMonth}`) || '0');
        
        return {
            daily: {
                spent: dailyCost,
                limit: this.costTracking.dailyLimit,
                remaining: Math.max(0, this.costTracking.dailyLimit - dailyCost),
                percentage: (dailyCost / this.costTracking.dailyLimit) * 100
            },
            monthly: {
                spent: monthlyCost,
                limit: this.costTracking.monthlyLimit,
                remaining: Math.max(0, this.costTracking.monthlyLimit - monthlyCost),
                percentage: (monthlyCost / this.costTracking.monthlyLimit) * 100
            }
        };
    }

    /**
     * 工具函数：延时
     * @param {number} ms - 延时毫秒数
     * @returns {Promise} Promise对象
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 处理Webhook回调
     * @param {Object} webhookData - Webhook数据
     */
    handleWebhook(webhookData) {
        console.log('收到Webhook回调:', webhookData);
        
        // 触发自定义事件，让前端组件可以监听
        const event = new CustomEvent('replicateWebhook', {
            detail: webhookData
        });
        document.dispatchEvent(event);
        
        // 如果预测完成，更新成本跟踪
        if (webhookData.status === 'succeeded') {
            this.updateCostTracking(webhookData);
        }
    }
}

// 导出单例实例
window.replicateClient = new ReplicateClient();