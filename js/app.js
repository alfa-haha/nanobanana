// Main Application JavaScript
// This file contains the core functionality for the Nano Banana website

class NanoBananaApp {
    constructor() {
        this.currentMode = 'text-to-image';
        this.selectedRatio = null; // 默认为空，表示用户还没选择
        this.selectedStyle = null; // 默认为空，表示用户还没选择
        this.isGenerating = false;
        this.user = null;
        this.userCredits = 0;
        this.isLoggedIn = false;
        this.anonymousUserManager = null;
        this.authManager = null;
        
        this.init();
    }
    
    init() {
        // Initialize anonymous user manager first
        this.initAnonymousUserManager();
        
        // Initialize authentication manager
        this.initAuthManager();
        
        this.setupEventListeners();
        this.initializeComponents();
        
        // Debug: Check if elements exist
        this.debugElementsExistence();
        
        console.log('Nano Banana App initialized');
    }
    
    debugElementsExistence() {
        console.log('=== Debug: Element Existence Check ===');
        console.log('Tab buttons:', document.querySelectorAll('.tab-button').length);
        console.log('Option pills:', document.querySelectorAll('.option-pill').length);
        console.log('Pill texts:', document.querySelectorAll('.pill-text').length);
        console.log('Mode contents:', document.querySelectorAll('.mode-content').length);
        console.log('Text to Image mode:', document.getElementById('textToImageMode'));
        console.log('Image to Image mode:', document.getElementById('imageToImageMode'));
        console.log('=====================================');
    }
    
    initAnonymousUserManager() {
        // Load the AnonymousUserManager if available
        if (typeof AnonymousUserManager !== 'undefined') {
            this.anonymousUserManager = new AnonymousUserManager();
        } else {
            console.warn('AnonymousUserManager not loaded, using fallback');
            // Fallback for when the module isn't loaded
            this.anonymousUserManager = {
                getStatus: () => ({ freeGenerationsRemaining: 5, canGenerate: true }),
                useGeneration: () => ({ success: true, freeGenerationsRemaining: 4 }),
                getStatusMessage: () => '5 free generations remaining'
            };
        }
    }
    
    initAuthManager() {
        // Initialize authentication manager
        if (typeof AuthManager !== 'undefined') {
            this.authManager = new AuthManager();
            // Make app available globally for auth callbacks
            window.app = this;
        } else {
            console.warn('AuthManager not loaded');
        }
    }
    
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Mode switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                console.log('Tab button clicked:', e.currentTarget.dataset.mode);
                this.switchMode(e.currentTarget.dataset.mode);
            });
        });

        // Pill option selection
        document.querySelectorAll('.pill-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Pill option clicked:', option.dataset);

                const currentTarget = e.currentTarget;
                if (currentTarget.dataset.ratio) {
                    this.selectRatio(currentTarget.dataset.ratio);
                } else if (currentTarget.dataset.style) {
                    this.selectStyle(currentTarget.dataset.style);
                }

                // Close dropdown after selection
                const pill = currentTarget.closest('.option-pill');
                if (pill) {
                    pill.classList.remove('active');
                }
            });
        });

        // Pill click to toggle dropdown - only listen on pill-text
        document.querySelectorAll('.pill-text').forEach(pillText => {
            pillText.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Pill text clicked:', pillText);

                const pill = pillText.closest('.option-pill');
                if (!pill) {
                    console.error('Could not find parent pill for:', pillText);
                    return;
                }

                // Close other dropdowns
                document.querySelectorAll('.option-pill').forEach(otherPill => {
                    if (otherPill !== pill) {
                        otherPill.classList.remove('active');
                    }
                });

                // Toggle current dropdown
                const wasActive = pill.classList.contains('active');
                pill.classList.toggle('active');
                console.log('Pill toggled:', pill.id, 'Active:', !wasActive);
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.option-pill')) {
                document.querySelectorAll('.option-pill').forEach(pill => {
                    pill.classList.remove('active');
                });
            }
        });
        
        // Generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.handleGenerate();
            });
        }
        
        // Login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.handleLogin();
            });
        }
        
        // Clear/Reset buttons
        const clearPromptBtn = document.getElementById('clearPromptBtn');
        if (clearPromptBtn) {
            clearPromptBtn.addEventListener('click', () => {
                this.resetTextToImageMode();
            });
        }
        
        const clearTransformBtn = document.getElementById('clearTransformBtn');
        if (clearTransformBtn) {
            clearTransformBtn.addEventListener('click', () => {
                this.resetImageToImageMode();
            });
        }
        
        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const imageUpload = document.getElementById('imageUpload');
        
        if (uploadArea && imageUpload) {
            uploadArea.addEventListener('click', () => {
                imageUpload.click();
            });
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleImageUpload(files[0]);
                }
            });
            
            imageUpload.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleImageUpload(e.target.files[0]);
                }
            });
        }
        
        console.log('Event listeners setup complete');
    }
    
    initializeComponents() {
        // Initialize components that don't require external dependencies
        console.log('Initializing components...');
        
        // Set initial pill text values
        this.updatePillTexts();
        
        // Check user authentication status
        this.checkAuthStatus();
        
        console.log('Components initialized successfully');
        
        // Initialize use case gallery
        this.initUseCaseGallery();
    }
    
    updatePillTexts() {
        // Update ratio pill texts - 显示选中值或默认文本
        const ratioTexts = document.querySelectorAll('#ratioText, #ratioTextI2I');
        ratioTexts.forEach(textElement => {
            if (textElement) {
                textElement.textContent = this.selectedRatio || 'Ratio';
            }
        });
        
        // Update style pill texts - 显示选中值或默认文本
        const styleTexts = document.querySelectorAll('#styleText, #styleTextI2I');
        styleTexts.forEach(textElement => {
            if (textElement) {
                if (this.selectedStyle) {
                    const displayText = this.selectedStyle.charAt(0).toUpperCase() + this.selectedStyle.slice(1);
                    textElement.textContent = displayText;
                } else {
                    textElement.textContent = 'Style';
                }
            }
        });
    }
    
    switchMode(mode) {
        console.log('Switching to mode:', mode);
        this.currentMode = mode;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-mode="${mode}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            console.log('Tab button activated:', activeTab);
        } else {
            console.error('Tab button not found for mode:', mode);
        }
        
        // Update mode content
        document.querySelectorAll('.mode-content').forEach(content => {
            content.classList.remove('active');
        });
        
        if (mode === 'text-to-image') {
            const textMode = document.getElementById('textToImageMode');
            if (textMode) {
                textMode.classList.add('active');
                console.log('Text to image mode activated');
            } else {
                console.error('textToImageMode element not found');
            }
        } else {
            const imageMode = document.getElementById('imageToImageMode');
            if (imageMode) {
                imageMode.classList.add('active');
                console.log('Image to image mode activated');
            } else {
                console.error('imageToImageMode element not found');
            }
        }
    }
    
    selectRatio(ratio) {
        console.log('Selecting ratio:', ratio);
        this.selectedRatio = ratio;
        
        // Update pill style - 清除所有active状态，然后设置选中的
        document.querySelectorAll('.pill-option[data-ratio]').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelectorAll(`[data-ratio="${ratio}"]`).forEach(element => {
            element.classList.add('active');
        });
        
        // Update pill text to show selected value
        const ratioTexts = document.querySelectorAll('#ratioText, #ratioTextI2I');
        ratioTexts.forEach(textElement => {
            if (textElement) {
                textElement.textContent = ratio; // 显示用户选择的具体值
            }
        });
    }
    
    selectStyle(style) {
        console.log('Selecting style:', style);
        this.selectedStyle = style;
        
        // Update pill style - 清除所有active状态，然后设置选中的
        document.querySelectorAll('.pill-option[data-style]').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelectorAll(`[data-style="${style}"]`).forEach(element => {
            element.classList.add('active');
        });
        
        // Update pill text to show selected value
        const styleTexts = document.querySelectorAll('#styleText, #styleTextI2I');
        styleTexts.forEach(textElement => {
            if (textElement) {
                // Capitalize first letter for better display
                const displayText = style.charAt(0).toUpperCase() + style.slice(1);
                textElement.textContent = displayText; // 显示用户选择的具体值
            }
        });
    }
    
    async handleGenerate() {
        console.log('Generate button clicked');
        
        if (this.isGenerating) {
            console.log('Generation already in progress');
            return;
        }
        
        const prompt = document.getElementById('promptInput')?.value.trim() || 
                      document.getElementById('transformPrompt')?.value.trim();
        
        if (!prompt) {
            alert('请输入提示词');
            return;
        }
        
        this.isGenerating = true;
        const generateBtn = document.getElementById('generateBtn');
        
        try {
            // 更新按钮状态
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = '生成中...';
            }
            
            // 构建请求参数
            const requestData = {
                prompt: prompt,
                width: this.getRatioWidth(),
                height: this.getRatioHeight(),
                negative_prompt: ''
            };
            
            console.log('Sending generation request:', requestData);
            
            // 调用后端API
            const response = await fetch('/api/replicate/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('Generation successful:', result.data);
                this.displayGeneratedImage(result.data);
            } else {
                throw new Error(result.error?.message || '生成失败');
            }
            
        } catch (error) {
            console.error('Generation error:', error);
            alert(`生成失败: ${error.message}`);
        } finally {
            this.isGenerating = false;
            
            // 恢复按钮状态
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate';
            }
        }
    }
    
    getRatioWidth() {
        if (!this.selectedRatio) return 1024;
        
        switch (this.selectedRatio) {
            case 'landscape':
            case '4:3':
                return 1024;
            case 'portrait':
            case '3:4':
                return 768;
            case 'square':
            case '1:1':
            default:
                return 1024;
        }
    }
    
    getRatioHeight() {
        if (!this.selectedRatio) return 1024;
        
        switch (this.selectedRatio) {
            case 'landscape':
            case '4:3':
                return 768;
            case 'portrait':
            case '3:4':
                return 1024;
            case 'square':
            case '1:1':
            default:
                return 1024;
        }
    }
    
    displayGeneratedImage(imageData) {
        console.log('Displaying generated image:', imageData);
        
        // Create or update image display area
        let imageContainer = document.getElementById('generatedImageContainer');
        if (!imageContainer) {
            imageContainer = document.createElement('div');
            imageContainer.id = 'generatedImageContainer';
            imageContainer.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background: #fafafa;
                text-align: center;
            `;
            
            // Insert after the generate button
            const generateBtn = document.getElementById('generateBtn');
            if (generateBtn) {
                generateBtn.parentNode.insertBefore(imageContainer, generateBtn.nextSibling);
            }
        }
        
        imageContainer.innerHTML = `
            <h4>生成结果</h4>
            <img src="${imageData.imageUrl}" 
                 alt="Generated Image" 
                 style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" 
                 onload="console.log('Image loaded successfully')" 
                 onerror="console.error('Image failed to load')">
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                <p>提示词: ${imageData.prompt}</p>
                <p>状态: ${imageData.status}</p>
                <p>完成时间: ${imageData.completedAt ? new Date(imageData.completedAt).toLocaleString() : '未知'}</p>
            </div>
        `;
    }
    
    handleLogin() {
        console.log('Login button clicked');
        alert('Login functionality would be called here');
    }
    
    handleImageUpload(file) {
        console.log('Image uploaded:', file.name);
        alert('Image upload functionality would be called here');
    }
    
    checkAuthStatus() {
        console.log('Checking auth status...');
        // Placeholder for auth status check
    }
    
    resetTextToImageMode() {
        console.log('Resetting Text to Image mode...');
        
        // 重置 prompt 输入框
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.value = '';
        }
        
        // 重置 ratio 和 style 到初始状态
        this.resetRatioAndStyle();
    }
    
    resetImageToImageMode() {
        console.log('Resetting Image to Image mode...');
        
        // 重置 transform prompt 输入框
        const transformPrompt = document.getElementById('transformPrompt');
        if (transformPrompt) {
            transformPrompt.value = '';
        }
        
        // 重置 ratio 和 style 到初始状态
        this.resetRatioAndStyle();
        
        // 重置上传的图片（如果有的话）
        this.resetImageUpload();
    }
    
    resetRatioAndStyle() {
        console.log('Resetting ratio and style to initial state...');
        
        // 重置内部状态
        this.selectedRatio = null;
        this.selectedStyle = null;
        
        // 重置所有 pill 选项的 active 状态
        document.querySelectorAll('.pill-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // 重置 pill 文本显示
        this.updatePillTexts();
    }
    
    resetImageUpload() {
        console.log('Resetting image upload...');
        
        // 重置文件输入
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.value = '';
        }
        
        // 重置上传区域显示（如果有预览图片的话）
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            // 移除可能的预览图片，恢复到默认状态
            const existingPreview = uploadArea.querySelector('.upload-preview');
            if (existingPreview) {
                existingPreview.remove();
            }
            
            // 确保显示默认的上传提示
            const placeholder = uploadArea.querySelector('.upload-placeholder');
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        }
    }
    
    initUseCaseGallery() {
        console.log('Initializing use case showcase...');
        
        const showcaseContainer = document.getElementById('showcaseContainer');
        
        if (!showcaseContainer) {
            console.log('Showcase container not found');
            return;
        }
        
        const showcases = showcaseContainer.querySelectorAll('.use-case-showcase');
        
        if (showcases.length === 0) {
            console.log('No showcase cases found');
            return;
        }
        
        // All showcases are displayed by default (no need for active/inactive states)
        // Just log the initialization
        console.log(`Showcase initialized with ${showcases.length} cases displayed vertically`);
        
        // Log each case for debugging
        showcases.forEach((showcase, index) => {
            const caseType = showcase.dataset.case;
            console.log(`Case ${index + 1}: ${caseType}`);
        });
    }
}

// Social sharing functionality
function initSocialSharing() {
    document.querySelectorAll('[data-share]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const platform = this.getAttribute('data-share');
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            const description = encodeURIComponent('Create amazing AI-generated images that match your content\'s emotional tone - Nano Banana');
            
            let shareUrl = '';
            
            switch(platform) {
                case 'facebook':
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                    break;
                case 'twitter':
                    shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
                    break;
                case 'reddit':
                    shareUrl = `https://reddit.com/submit?url=${url}&title=${title}`;
                    break;
                case 'tiktok':
                    // TikTok doesn't have a direct share URL, so we copy to clipboard
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        showNotification('Link copied to clipboard! Share it on TikTok', 'success');
                    }).catch(() => {
                        showNotification('Unable to copy link. Please copy manually: ' + window.location.href, 'info');
                    });
                    return;
            }
            
            if (shareUrl) {
                // Open share window
                const shareWindow = window.open(
                    shareUrl,
                    'share',
                    'width=600,height=400,scrollbars=yes,resizable=yes'
                );
                
                // Add visual feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            }
        });
    });
}

// Initialize social sharing when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initSocialSharing();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NanoBananaApp;
}