/**
 * Replicate API处理器 - 服务器端
 * 处理图片生成请求并代理到Replicate API
 */

// 导入fetch（Node.js 18+内置，或使用node-fetch）
const fetch = globalThis.fetch || require('node-fetch');

class ReplicateHandler {
    constructor() {
        // 从环境变量读取配置
        this.apiToken = process.env.REPLICATE_API_TOKEN;
        this.baseUrl = 'https://api.replicate.com/v1';
        this.defaultModel = 'qwen/qwen-image';
        
        if (!this.apiToken) {
            console.error('REPLICATE_API_TOKEN环境变量未设置');
        }
    }

    /**
     * 生成图片
     * @param {Object} params - 生成参数
     * @returns {Promise} API响应
     */
    async generateImage(params) {
        try {
            const { prompt, width = 1024, height = 1024, negative_prompt = '' } = params;
            
            console.log('开始调用Replicate API:', { prompt, width, height });
            
            // 获取模型版本
            const modelVersion = await this.getModelVersion();
            
            // 创建预测请求
            const prediction = await this.createPrediction({
                prompt,
                width,
                height,
                negative_prompt
            }, modelVersion);
            
            // 轮询直到完成
            const result = await this.pollPrediction(prediction.id);
            
            return {
                success: true,
                data: {
                    imageUrl: Array.isArray(result.output) ? result.output[0] : result.output,
                    prompt: prompt,
                    predictionId: result.id,
                    status: result.status,
                    completedAt: result.completed_at,
                    cost: 0.025 // 估算成本
                }
            };
            
        } catch (error) {
            console.error('Replicate API调用失败:', error);
            return {
                success: false,
                error: {
                    message: error.message || '图片生成失败',
                    code: error.status || 500
                }
            };
        }
    }

    /**
     * 获取模型版本
     */
    async getModelVersion() {
        try {
            const response = await fetch(`${this.baseUrl}/models/${this.defaultModel}`, {
                headers: {
                    'Authorization': `Token ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`获取模型信息失败: ${response.status}`);
            }
            
            const model = await response.json();
            return model.latest_version.id;
            
        } catch (error) {
            console.error('获取模型版本失败:', error);
            // 使用默认版本ID作为备用
            return '8101a2391b041aa46c01826321e4b46815624d4a810e16dd6989e2d805e0aea2';
        }
    }

    /**
     * 创建预测请求
     */
    async createPrediction(input, version) {
        const response = await fetch(`${this.baseUrl}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                version: version,
                input: input
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`创建预测失败: ${error.detail || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * 轮询预测状态
     */
    async pollPrediction(predictionId, maxAttempts = 90) {
        console.log(`开始轮询预测 ${predictionId}，最大尝试次数: ${maxAttempts}`);
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`${this.baseUrl}/predictions/${predictionId}`, {
                    headers: {
                        'Authorization': `Token ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error(`API请求失败 (${i + 1}/${maxAttempts}): ${response.status} ${response.statusText}`);
                    throw new Error(`获取预测状态失败: ${response.status} ${response.statusText}`);
                }

                const prediction = await response.json();
                
                console.log(`预测状态 (${i + 1}/${maxAttempts}):`, {
                    status: prediction.status,
                    progress: prediction.progress,
                    error: prediction.error
                });

                if (prediction.status === 'succeeded') {
                    console.log(`预测成功完成，输出:`, prediction.output);
                    return prediction;
                } else if (prediction.status === 'failed') {
                    console.error(`预测失败:`, prediction.error);
                    throw new Error(`生成失败: ${prediction.error || '未知错误'}`);
                } else if (prediction.status === 'canceled') {
                    console.warn(`预测被取消`);
                    throw new Error('生成被取消');
                }

                // 根据状态调整等待时间
                const waitTime = prediction.status === 'starting' ? 1000 : 2000;
                console.log(`等待 ${waitTime}ms 后继续轮询...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
            } catch (error) {
                if (error.message.includes('生成失败') || error.message.includes('生成被取消')) {
                    throw error; // 重新抛出明确的错误
                }
                
                console.error(`轮询出错 (${i + 1}/${maxAttempts}):`, error.message);
                
                // 如果是网络错误，等待更长时间后重试
                if (i < maxAttempts - 1) {
                    const retryWait = 3000 + (i * 1000); // 递增等待时间
                    console.log(`网络错误，等待 ${retryWait}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, retryWait));
                } else {
                    throw error; // 最后一次尝试失败，抛出错误
                }
            }
        }

        console.error(`轮询超时: 已尝试 ${maxAttempts} 次，总计 ${maxAttempts * 2} 秒`);
        throw new Error(`生成超时: 已等待约${Math.round(maxAttempts * 2 / 60)}分钟，请稍后重试`);
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            if (!this.apiToken) {
                throw new Error('API Token未配置');
            }

            // 简单的API连接测试
            const response = await fetch(`${this.baseUrl}/models/${this.defaultModel}`, {
                headers: {
                    'Authorization': `Token ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: response.ok,
                status: response.ok ? 'healthy' : 'unhealthy',
                model: this.defaultModel,
                statusCode: response.status
            };

        } catch (error) {
            return {
                success: false,
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = ReplicateHandler;