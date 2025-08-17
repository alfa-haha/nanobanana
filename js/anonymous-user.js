// Anonymous User Identification and Rate Limiting System
// Implements browser fingerprinting, free quota tracking, and IP rate limiting

class AnonymousUserManager {
    constructor() {
        this.anonymousId = null;
        this.freeGenerationsUsed = 0;
        this.freeGenerationsLimit = 5;
        this.lastResetTime = null;
        this.ipRateLimit = 5; // per hour
        this.ipRateLimitWindow = 60 * 60 * 1000; // 1 hour in milliseconds
        
        this.init();
    }
    
    init() {
        this.anonymousId = this.generateBrowserFingerprint();
        this.loadStoredData();
        this.cleanupOldData();
        
        console.log('Anonymous User Manager initialized:', {
            anonymousId: this.anonymousId.substring(0, 8) + '...',
            freeGenerationsUsed: this.freeGenerationsUsed,
            freeGenerationsRemaining: this.getFreeGenerationsRemaining()
        });
    }
    
    /**
     * Generate a unique browser fingerprint based on multiple device characteristics
     * This creates a stable identifier for anonymous users across sessions
     */
    generateBrowserFingerprint() {
        const components = [];
        
        // Basic browser information
        components.push(navigator.userAgent);
        components.push(navigator.language);
        components.push(navigator.languages ? navigator.languages.join(',') : '');
        components.push(navigator.platform);
        components.push(navigator.cookieEnabled);
        components.push(navigator.doNotTrack || 'unknown');
        
        // Screen information
        components.push(screen.width);
        components.push(screen.height);
        components.push(screen.colorDepth);
        components.push(screen.pixelDepth);
        components.push(window.devicePixelRatio || 1);
        
        // Timezone information
        components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
        components.push(new Date().getTimezoneOffset());
        
        // Hardware information
        components.push(navigator.hardwareConcurrency || 'unknown');
        components.push(navigator.maxTouchPoints || 0);
        
        // Canvas fingerprinting (lightweight version)
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Nano Banana fingerprint test 🍌', 2, 2);
            components.push(canvas.toDataURL());
        } catch (e) {
            components.push('canvas-error');
        }
        
        // WebGL fingerprinting (basic)
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const renderer = gl.getParameter(gl.RENDERER);
                const vendor = gl.getParameter(gl.VENDOR);
                components.push(renderer);
                components.push(vendor);
            }
        } catch (e) {
            components.push('webgl-error');
        }
        
        // Audio context fingerprinting (basic)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            components.push(audioContext.sampleRate);
            components.push(analyser.frequencyBinCount);
            
            audioContext.close();
        } catch (e) {
            components.push('audio-error');
        }
        
        // Create hash from all components
        const fingerprint = this.hashString(components.join('|'));
        
        // Add timestamp-based component for additional uniqueness
        const stored = localStorage.getItem('nano_banana_fp_seed');
        let seed;
        if (stored) {
            seed = stored;
        } else {
            seed = Date.now().toString() + Math.random().toString();
            localStorage.setItem('nano_banana_fp_seed', seed);
        }
        
        return this.hashString(fingerprint + seed);
    }
    
    /**
     * Simple hash function for creating fingerprint
     */
    hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(36);
    }
    
    /**
     * Load stored data for this anonymous user
     */
    loadStoredData() {
        const storageKey = `nano_banana_anonymous_${this.anonymousId}`;
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.freeGenerationsUsed = data.freeGenerationsUsed || 0;
                this.lastResetTime = data.lastResetTime ? new Date(data.lastResetTime) : new Date();
                
                // Check if 24 hours have passed since last reset
                this.checkAndResetFreeGenerations();
            } catch (e) {
                console.warn('Failed to load stored anonymous user data:', e);
                this.resetUserData();
            }
        } else {
            this.resetUserData();
        }
    }
    
    /**
     * Save current data to localStorage
     */
    saveData() {
        const storageKey = `nano_banana_anonymous_${this.anonymousId}`;
        const data = {
            freeGenerationsUsed: this.freeGenerationsUsed,
            lastResetTime: this.lastResetTime.toISOString(),
            anonymousId: this.anonymousId
        };
        
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save anonymous user data:', e);
        }
    }
    
    /**
     * Reset user data to initial state
     */
    resetUserData() {
        this.freeGenerationsUsed = 0;
        this.lastResetTime = new Date();
        this.saveData();
    }
    
    /**
     * Check if 24 hours have passed and reset free generations if needed
     */
    checkAndResetFreeGenerations() {
        const now = new Date();
        const timeSinceReset = now - this.lastResetTime;
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (timeSinceReset >= twentyFourHours) {
            // Reset one free generation every 24 hours
            const hoursPassedSinceReset = Math.floor(timeSinceReset / (24 * 60 * 60 * 1000));
            const generationsToRestore = Math.min(hoursPassedSinceReset, this.freeGenerationsUsed);
            
            if (generationsToRestore > 0) {
                this.freeGenerationsUsed = Math.max(0, this.freeGenerationsUsed - generationsToRestore);
                this.lastResetTime = new Date(this.lastResetTime.getTime() + (hoursPassedSinceReset * 24 * 60 * 60 * 1000));
                this.saveData();
                
                console.log(`Free generations restored: ${generationsToRestore}, remaining: ${this.getFreeGenerationsRemaining()}`);
            }
        }
    }
    
    /**
     * Get remaining free generations for this anonymous user
     */
    getFreeGenerationsRemaining() {
        this.checkAndResetFreeGenerations();
        return Math.max(0, this.freeGenerationsLimit - this.freeGenerationsUsed);
    }
    
    /**
     * Check if user can generate an image (has free generations remaining)
     */
    canGenerate() {
        const remaining = this.getFreeGenerationsRemaining();
        const ipAllowed = this.checkIPRateLimit();
        
        return {
            allowed: remaining > 0 && ipAllowed.allowed,
            freeGenerationsRemaining: remaining,
            reason: remaining <= 0 ? 'no_free_generations' : (!ipAllowed.allowed ? ipAllowed.reason : null),
            nextResetTime: this.getNextResetTime(),
            ipRateLimitReset: ipAllowed.resetTime
        };
    }
    
    /**
     * Use one free generation
     */
    useGeneration() {
        const canUse = this.canGenerate();
        if (!canUse.allowed) {
            throw new Error(`Cannot generate image: ${canUse.reason}`);
        }
        
        this.freeGenerationsUsed++;
        this.recordIPUsage();
        this.saveData();
        
        console.log(`Generation used. Remaining: ${this.getFreeGenerationsRemaining()}`);
        
        return {
            success: true,
            freeGenerationsRemaining: this.getFreeGenerationsRemaining(),
            nextResetTime: this.getNextResetTime()
        };
    }
    
    /**
     * Get the next time free generations will be restored
     */
    getNextResetTime() {
        if (this.freeGenerationsUsed === 0) {
            return null; // No reset needed
        }
        
        const nextReset = new Date(this.lastResetTime.getTime() + (24 * 60 * 60 * 1000));
        return nextReset;
    }
    
    /**
     * Check IP-based rate limiting (5 requests per hour)
     */
    checkIPRateLimit() {
        // Get IP-based usage data
        const ipUsageKey = 'nano_banana_ip_usage';
        const now = Date.now();
        
        let ipUsage = [];
        try {
            const stored = localStorage.getItem(ipUsageKey);
            if (stored) {
                ipUsage = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load IP usage data:', e);
        }
        
        // Clean up old entries (older than 1 hour)
        ipUsage = ipUsage.filter(timestamp => (now - timestamp) < this.ipRateLimitWindow);
        
        // Check if under rate limit
        if (ipUsage.length >= this.ipRateLimit) {
            const oldestRequest = Math.min(...ipUsage);
            const resetTime = new Date(oldestRequest + this.ipRateLimitWindow);
            
            return {
                allowed: false,
                reason: 'ip_rate_limit_exceeded',
                resetTime: resetTime,
                requestsInWindow: ipUsage.length
            };
        }
        
        return {
            allowed: true,
            requestsInWindow: ipUsage.length,
            requestsRemaining: this.ipRateLimit - ipUsage.length
        };
    }
    
    /**
     * Record IP usage for rate limiting
     */
    recordIPUsage() {
        const ipUsageKey = 'nano_banana_ip_usage';
        const now = Date.now();
        
        let ipUsage = [];
        try {
            const stored = localStorage.getItem(ipUsageKey);
            if (stored) {
                ipUsage = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load IP usage data:', e);
        }
        
        // Add current timestamp
        ipUsage.push(now);
        
        // Clean up old entries
        ipUsage = ipUsage.filter(timestamp => (now - timestamp) < this.ipRateLimitWindow);
        
        // Save updated usage
        try {
            localStorage.setItem(ipUsageKey, JSON.stringify(ipUsage));
        } catch (e) {
            console.warn('Failed to save IP usage data:', e);
        }
    }
    
    /**
     * Clean up old data from localStorage to prevent bloat
     */
    cleanupOldData() {
        const keys = Object.keys(localStorage);
        const nanoBananaKeys = keys.filter(key => key.startsWith('nano_banana_anonymous_'));
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        nanoBananaKeys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const lastActivity = new Date(data.lastResetTime).getTime();
                
                // Remove data older than 1 week
                if (lastActivity < oneWeekAgo) {
                    localStorage.removeItem(key);
                    console.log('Cleaned up old anonymous user data:', key);
                }
            } catch (e) {
                // Remove corrupted data
                localStorage.removeItem(key);
                console.log('Removed corrupted anonymous user data:', key);
            }
        });
    }
    
    /**
     * Get user status information
     */
    getStatus() {
        const canGen = this.canGenerate();
        const ipStatus = this.checkIPRateLimit();
        
        return {
            anonymousId: this.anonymousId,
            freeGenerationsUsed: this.freeGenerationsUsed,
            freeGenerationsRemaining: this.getFreeGenerationsRemaining(),
            freeGenerationsLimit: this.freeGenerationsLimit,
            canGenerate: canGen.allowed,
            nextResetTime: this.getNextResetTime(),
            ipRateLimit: {
                requestsInWindow: ipStatus.requestsInWindow,
                requestsRemaining: ipStatus.requestsRemaining || 0,
                resetTime: ipStatus.resetTime || null
            },
            lastResetTime: this.lastResetTime
        };
    }
    
    /**
     * Force reset for testing purposes
     */
    forceReset() {
        this.resetUserData();
        localStorage.removeItem('nano_banana_ip_usage');
        console.log('Anonymous user data force reset');
    }
    
    /**
     * Get human-readable status message
     */
    getStatusMessage() {
        const status = this.getStatus();
        
        if (!status.canGenerate) {
            if (status.freeGenerationsRemaining <= 0) {
                const nextReset = status.nextResetTime;
                if (nextReset) {
                    const hoursUntilReset = Math.ceil((nextReset - new Date()) / (60 * 60 * 1000));
                    return `You've used all 5 free generations. Next free generation in ${hoursUntilReset} hours. Sign up for 10 bonus generations!`;
                } else {
                    return 'You\'ve used all free generations. Sign up to get 10 bonus generations!';
                }
            } else if (status.ipRateLimit.resetTime) {
                const minutesUntilReset = Math.ceil((status.ipRateLimit.resetTime - new Date()) / (60 * 1000));
                return `Rate limit exceeded. Please wait ${minutesUntilReset} minutes before generating again.`;
            }
        }
        
        return `${status.freeGenerationsRemaining} free generations remaining`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnonymousUserManager;
}