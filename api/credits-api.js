/**
 * 积分相关API端点
 * 处理积分查询、使用、交易历史等功能
 */

const { createClient } = require('@supabase/supabase-js');

// 环境变量配置
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 初始化Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

class CreditsAPI {
    constructor() {
        this.supabase = supabase;
    }
    
    /**
     * 获取用户积分余额
     */
    async getUserCredits(req, res) {
        try {
            const { userId } = req.params;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            const { data: user, error } = await this.supabase
                .from('profiles')
                .select('credits, subscription_status, subscription_expires_at')
                .eq('id', userId)
                .single();
            
            if (error) {
                throw error;
            }
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User not found' }
                });
            }
            
            res.json({
                success: true,
                credits: user.credits || 0,
                subscriptionStatus: user.subscription_status || 'free',
                subscriptionExpiresAt: user.subscription_expires_at
            });
            
        } catch (error) {
            console.error('Get user credits error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 使用积分
     */
    async useCredits(req, res) {
        try {
            const { userId, amount, description, generationId } = req.body;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            // 验证参数
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Invalid amount' }
                });
            }
            
            // 使用数据库函数扣除积分
            const { data, error } = await this.supabase.rpc('deduct_credits', {
                p_user_id: userId,
                p_generation_id: generationId,
                p_credits: amount
            });
            
            if (error) {
                throw error;
            }
            
            if (!data) {
                return res.status(402).json({
                    success: false,
                    error: { 
                        message: 'Insufficient credits',
                        code: 'INSUFFICIENT_CREDITS'
                    }
                });
            }
            
            // 获取更新后的积分余额
            const { data: user } = await this.supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();
            
            res.json({
                success: true,
                remainingCredits: user?.credits || 0,
                amountUsed: amount,
                description: description || 'Credit usage'
            });
            
        } catch (error) {
            console.error('Use credits error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 添加积分
     */
    async addCredits(req, res) {
        try {
            const { userId, amount, transactionType, description, paymentId } = req.body;
            
            // 验证管理员权限或系统调用
            if (!this.validateAdminAccess(req)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Admin access required' }
                });
            }
            
            // 验证参数
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Invalid amount' }
                });
            }
            
            // 使用数据库函数添加积分
            const { error } = await this.supabase.rpc('add_credits', {
                p_user_id: userId,
                p_credits: amount,
                p_transaction_type: transactionType || 'manual',
                p_description: description || 'Credits added',
                p_payment_id: paymentId
            });
            
            if (error) {
                throw error;
            }
            
            // 获取更新后的积分余额
            const { data: user } = await this.supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();
            
            res.json({
                success: true,
                newBalance: user?.credits || 0,
                amountAdded: amount,
                transactionType
            });
            
        } catch (error) {
            console.error('Add credits error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 获取积分交易历史
     */
    async getCreditTransactions(req, res) {
        try {
            const { userId } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            const { data: transactions, error } = await this.supabase
                .from('credit_transactions')
                .select(`
                    id,
                    amount,
                    transaction_type,
                    description,
                    created_at,
                    generation_id
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            if (error) {
                throw error;
            }
            
            // 获取总交易数量
            const { count, error: countError } = await this.supabase
                .from('credit_transactions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            
            if (countError) {
                console.error('Count error:', countError);
            }
            
            res.json({
                success: true,
                transactions: transactions || [],
                total: count || 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
        } catch (error) {
            console.error('Get credit transactions error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 获取积分使用统计
     */
    async getCreditStats(req, res) {
        try {
            const { userId } = req.params;
            const { period = '30d' } = req.query;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            // 计算时间范围
            const periodDays = this.parsePeriod(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - periodDays);
            
            // 获取统计数据
            const { data: stats, error } = await this.supabase
                .from('credit_transactions')
                .select('amount, transaction_type, created_at')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString());
            
            if (error) {
                throw error;
            }
            
            // 计算统计信息
            const totalUsed = stats
                .filter(t => t.amount < 0)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            const totalAdded = stats
                .filter(t => t.amount > 0)
                .reduce((sum, t) => sum + t.amount, 0);
            
            const generationCount = stats
                .filter(t => t.transaction_type === 'generation').length;
            
            // 按类型分组
            const byType = stats.reduce((acc, t) => {
                const type = t.transaction_type;
                if (!acc[type]) {
                    acc[type] = { count: 0, amount: 0 };
                }
                acc[type].count++;
                acc[type].amount += t.amount;
                return acc;
            }, {});
            
            res.json({
                success: true,
                period,
                stats: {
                    totalUsed,
                    totalAdded,
                    generationCount,
                    byType
                }
            });
            
        } catch (error) {
            console.error('Get credit stats error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 检查积分余额是否足够
     */
    async checkCreditsBalance(req, res) {
        try {
            const { userId } = req.params;
            const { amount } = req.query;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            const { data: user, error } = await this.supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();
            
            if (error) {
                throw error;
            }
            
            const currentCredits = user?.credits || 0;
            const requiredAmount = parseInt(amount) || 1;
            const hasEnough = currentCredits >= requiredAmount;
            
            res.json({
                success: true,
                currentCredits,
                requiredAmount,
                hasEnough,
                shortfall: hasEnough ? 0 : requiredAmount - currentCredits
            });
            
        } catch (error) {
            console.error('Check credits balance error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 获取用户生成历史
     */
    async getUserGenerations(req, res) {
        try {
            const { userId } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            const { data: generations, error } = await this.supabase
                .from('generations')
                .select(`
                    id,
                    prompt,
                    image_url,
                    generation_type,
                    aspect_ratio,
                    style,
                    status,
                    created_at,
                    completed_at
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            if (error) {
                throw error;
            }
            
            res.json({
                success: true,
                generations: generations || []
            });
            
        } catch (error) {
            console.error('Get user generations error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 获取用户统计信息
     */
    async getUserStats(req, res) {
        try {
            const { userId } = req.params;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            // 获取用户基本信息
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (profileError) {
                throw profileError;
            }
            
            // 获取生成统计
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // 总生成数
            const { count: totalGenerations } = await this.supabase
                .from('generations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            
            // 本月生成数
            const { count: monthlyGenerations } = await this.supabase
                .from('generations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', startOfMonth.toISOString());
            
            // 本周生成数
            const { count: weeklyGenerations } = await this.supabase
                .from('generations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', startOfWeek.toISOString());
            
            // 今日生成数
            const { count: dailyGenerations } = await this.supabase
                .from('generations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', startOfDay.toISOString());
            
            // 按类型统计
            const { data: typeStats } = await this.supabase
                .from('generations')
                .select('generation_type')
                .eq('user_id', userId);
            
            const textToImageCount = typeStats?.filter(g => g.generation_type === 'text_to_image').length || 0;
            const imageToImageCount = typeStats?.filter(g => g.generation_type === 'image_to_image').length || 0;
            
            // 成功率统计
            const { data: statusStats } = await this.supabase
                .from('generations')
                .select('status')
                .eq('user_id', userId);
            
            const completedCount = statusStats?.filter(g => g.status === 'completed').length || 0;
            const totalCount = statusStats?.length || 0;
            const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            
            // 平均生成时间
            const { data: timeStats } = await this.supabase
                .from('generations')
                .select('created_at, completed_at')
                .eq('user_id', userId)
                .eq('status', 'completed')
                .not('completed_at', 'is', null);
            
            let avgGenerationTime = 0;
            if (timeStats && timeStats.length > 0) {
                const totalTime = timeStats.reduce((sum, gen) => {
                    const start = new Date(gen.created_at);
                    const end = new Date(gen.completed_at);
                    return sum + (end - start);
                }, 0);
                avgGenerationTime = Math.round(totalTime / timeStats.length / 1000); // 转换为秒
            }
            
            res.json({
                success: true,
                stats: {
                    total_generations: totalGenerations || 0,
                    monthly_generations: monthlyGenerations || 0,
                    weekly_generations: weeklyGenerations || 0,
                    daily_generations: dailyGenerations || 0,
                    text_to_image_count: textToImageCount,
                    image_to_image_count: imageToImageCount,
                    success_rate: successRate,
                    avg_generation_time: avgGenerationTime
                }
            });
            
        } catch (error) {
            console.error('Get user stats error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 获取用户资料
     */
    async getUserProfile(req, res) {
        try {
            const { userId } = req.params;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) {
                throw error;
            }
            
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User profile not found' }
                });
            }
            
            res.json({
                success: true,
                profile
            });
            
        } catch (error) {
            console.error('Get user profile error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 更新用户资料
     */
    async updateUserProfile(req, res) {
        try {
            const { userId } = req.params;
            const updates = req.body;
            
            // 验证用户权限
            if (!this.validateUserAccess(req, userId)) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Access denied' }
                });
            }
            
            // 过滤允许更新的字段
            const allowedFields = ['display_name', 'avatar_url', 'preferences'];
            const filteredUpdates = {};
            
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredUpdates[key] = updates[key];
                }
            });
            
            if (Object.keys(filteredUpdates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'No valid fields to update' }
                });
            }
            
            filteredUpdates.updated_at = new Date().toISOString();
            
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .update(filteredUpdates)
                .eq('id', userId)
                .select()
                .single();
            
            if (error) {
                throw error;
            }
            
            res.json({
                success: true,
                profile
            });
            
        } catch (error) {
            console.error('Update user profile error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message }
            });
        }
    }
    
    /**
     * 验证用户访问权限
     */
    validateUserAccess(req, userId) {
        // 检查JWT token中的用户ID是否匹配
        const tokenUserId = req.user?.id || req.user?.sub;
        return tokenUserId === userId;
    }
    
    /**
     * 验证管理员访问权限
     */
    validateAdminAccess(req) {
        // 检查是否为service role或管理员
        const role = req.user?.role;
        return role === 'service_role' || role === 'admin';
    }
    
    /**
     * 解析时间周期
     */
    parsePeriod(period) {
        const periodMap = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1y': 365
        };
        return periodMap[period] || 30;
    }
}

module.exports = CreditsAPI;