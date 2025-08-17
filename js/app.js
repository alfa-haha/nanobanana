// Main Application JavaScript
// This file contains the core functionality for the Nano Banana website

class NanoBananaApp {
    constructor() {
        this.currentMode = 'text-to-image';
        this.selectedRatio = '1:1';
        this.selectedStyle = 'realistic';
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
        console.log('Nano Banana App initialized');
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
        // Header navigation interactions
        this.setupHeaderNavigation();
        
        // Mode switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });
        
        // Aspect ratio selection
        document.querySelectorAll('.ratio-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                this.selectRatio(e.target.dataset.ratio);
            });
        });
        
        // Style selection
        document.querySelectorAll('.style-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                this.selectStyle(e.target.dataset.style);
            });
        });
        
        // Generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.handleGenerate();
            });
        }
        
        // Login button - will be handled by AuthManager
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.handleLogin();
            });
        }
        
        // Hero CTA button
        const heroCTABtn = document.getElementById('heroCTABtn');
        if (heroCTABtn) {
            heroCTABtn.addEventListener('click', () => {
                this.scrollToSection('generator');
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
    }
    
    initializeComponents() {
        // Initialize hero background slideshow
        this.initHeroSlideshow();
        
        // Initialize pricing cards
        this.initPricingCards();
        
        // Initialize FAQ
        this.initFAQ();
        
        // Initialize gallery
        this.initGallery();
        
        // Initialize popular prompts
        this.initPopularPrompts();
        
        // Check user authentication status
        this.checkAuthStatus();
        
        console.log('All components initialized successfully');
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        // Update mode content
        document.querySelectorAll('.mode-content').forEach(content => {
            content.classList.remove('active');
        });
        
        if (mode === 'text-to-image') {
            document.getElementById('textToImageMode').classList.add('active');
        } else {
            document.getElementById('imageToImageMode').classList.add('active');
        }
    }
    
    selectRatio(ratio) {
        this.selectedRatio = ratio;
        
        document.querySelectorAll('.ratio-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-ratio="${ratio}"]`).classList.add('active');
    }
    
    selectStyle(style) {
        this.selectedStyle = style;
        
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-style="${style}"]`).classList.add('active');
    }
    
    async handleGenerate() {
        if (this.isGenerating) return;
        
        const prompt = this.currentMode === 'text-to-image' 
            ? document.getElementById('promptInput').value.trim()
            : document.getElementById('transformPrompt').value.trim();
            
        if (!prompt) {
            this.showError('Please enter a description for your image');
            return;
        }
        
        // Check if user can generate (anonymous user limits or authenticated user credits)
        if (!this.isLoggedIn) {
            const canGenerate = this.anonymousUserManager.canGenerate();
            if (!canGenerate.allowed) {
                const message = this.anonymousUserManager.getStatusMessage();
                this.showAuthPrompt(message);
                return;
            }
        } else {
            // Check authenticated user credits
            const credits = this.authManager?.getCredits() || 0;
            if (credits < 1) {
                this.showError('Insufficient credits. Please purchase more credits or upgrade your plan.');
                return;
            }
        }
        
        this.isGenerating = true;
        this.showGeneratingState();
        
        try {
            // Use generation for anonymous users or deduct credits for authenticated users
            if (!this.isLoggedIn) {
                const result = this.anonymousUserManager.useGeneration();
                if (!result.success) {
                    throw new Error('Generation failed: quota exceeded');
                }
                
                // Update UI with remaining generations
                this.updateAnonymousUserStatus();
            } else {
                // Deduct credits for authenticated users
                await this.authManager.updateCreditsAfterGeneration(1);
            }
            
            // Prepare generation parameters
            const generationParams = this.prepareGenerationParams(prompt);
            
            // Call actual Replicate API
            const startTime = Date.now();
            const result = await this.generateWithReplicateAPI(generationParams);
            const generationTime = Math.round((Date.now() - startTime) / 1000);
            
            // Create metadata object
            const metadata = {
                prompt: prompt,
                mode: this.currentMode,
                aspectRatio: this.selectedRatio,
                style: this.selectedStyle,
                model: result.model || 'FLUX.1-dev',
                generationTime: generationTime,
                timestamp: new Date().toISOString(),
                predictionId: result.predictionId
            };
            
            // Show result with metadata
            this.showResultState(result.imageUrl, metadata);
            
        } catch (error) {
            console.error('Generation failed:', error);
            this.showError(error.message || 'Image generation failed. Please try again.');
            this.showDefaultState();
        } finally {
            this.isGenerating = false;
        }
    }
    
    prepareGenerationParams(prompt) {
        const params = {
            prompt: prompt,
            mode: this.currentMode
        };
        
        // Add aspect ratio dimensions
        const dimensions = this.getAspectRatioDimensions(this.selectedRatio);
        params.width = dimensions.width;
        params.height = dimensions.height;
        
        // Add style-specific parameters
        if (this.selectedStyle === 'realistic') {
            params.guidance_scale = 7.5;
            params.num_inference_steps = 50;
        } else if (this.selectedStyle === 'artistic') {
            params.guidance_scale = 10.0;
            params.num_inference_steps = 60;
            params.negative_prompt = 'blurry, low quality, distorted';
        } else if (this.selectedStyle === 'fantasy') {
            params.guidance_scale = 12.0;
            params.num_inference_steps = 70;
            params.negative_prompt = 'realistic, photographic, mundane';
        }
        
        // Add image-to-image specific parameters
        if (this.currentMode === 'image-to-image') {
            const uploadedImage = this.getUploadedImageData();
            if (uploadedImage) {
                params.image = uploadedImage;
                params.strength = 0.8; // How much to transform the original image
            }
        }
        
        return params;
    }
    
    getAspectRatioDimensions(ratio) {
        const dimensionMap = {
            '1:1': { width: 1024, height: 1024 },
            '4:3': { width: 1024, height: 768 },
            '3:4': { width: 768, height: 1024 },
            '16:9': { width: 1024, height: 576 },
            '9:16': { width: 576, height: 1024 }
        };
        
        return dimensionMap[ratio] || dimensionMap['1:1'];
    }
    
    getUploadedImageData() {
        // Get the uploaded image data from the upload area
        const uploadArea = document.getElementById('uploadArea');
        const imageElement = uploadArea.querySelector('img');
        
        if (imageElement && imageElement.src) {
            return imageElement.src;
        }
        
        return null;
    }
    
    async generateWithReplicateAPI(params) {
        // Check if ReplicateClient is available
        if (typeof window.replicateClient === 'undefined') {
            console.warn('ReplicateClient not available, falling back to simulation');
            return await this.simulateGeneration();
        }
        
        try {
            // Create prediction using ReplicateClient
            const prediction = await window.replicateClient.createPrediction(params);
            
            // Poll for completion with progress updates
            const result = await window.replicateClient.pollPrediction(
                prediction.id,
                (predictionStatus) => this.updateGenerationProgress(predictionStatus)
            );
            
            // Return the result
            return {
                imageUrl: result.output?.[0] || result.output,
                predictionId: result.id,
                model: result.model || 'FLUX.1-dev'
            };
            
        } catch (error) {
            console.error('Replicate API error:', error);
            
            // Fall back to simulation if API fails
            console.log('Falling back to simulation due to API error');
            const simulatedResult = await this.simulateGeneration();
            
            // Return simulated result
            const sampleImages = [
                'assets/sample-1.jpg',
                'assets/sample-2.jpg', 
                'assets/sample-3.jpg'
            ];
            const randomImage = sampleImages[Math.floor(Math.random() * sampleImages.length)];
            
            return {
                imageUrl: randomImage,
                predictionId: 'simulated-' + Date.now(),
                model: 'FLUX.1-dev (simulated)'
            };
        }
    }
    
    updateGenerationProgress(prediction) {
        const progressFill = document.getElementById('progressFill');
        const statusElement = document.querySelector('.generation-status') || this.createStatusElement();
        
        // Update status message
        if (prediction.status === 'starting') {
            statusElement.textContent = 'Initializing AI model...';
            this.updateProgressBar(10);
        } else if (prediction.status === 'processing') {
            statusElement.textContent = 'Generating your image...';
            this.updateProgressBar(50);
        } else if (prediction.status === 'succeeded') {
            statusElement.textContent = 'Complete!';
            this.updateProgressBar(100);
        } else if (prediction.status === 'failed') {
            statusElement.textContent = 'Generation failed';
            this.updateProgressBar(0);
        }
        
        // If there are logs, show more detailed progress
        if (prediction.logs) {
            const logs = prediction.logs.split('\n');
            const lastLog = logs[logs.length - 1];
            if (lastLog && lastLog.trim()) {
                statusElement.textContent = lastLog.trim();
            }
        }
    }
    
    createStatusElement() {
        let statusElement = document.querySelector('.generation-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = 'generation-status';
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.appendChild(statusElement);
            }
        }
        return statusElement;
    }
    
    updateProgressBar(percentage) {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
            
            // Update progress bar accessibility attributes
            const progressBar = progressFill.parentElement;
            if (progressBar) {
                progressBar.setAttribute('aria-valuenow', Math.round(percentage));
            }
        }
    }
    
    async simulateGeneration() {
        // Simulate API call with progress and status updates
        return new Promise((resolve) => {
            let progress = 0;
            const statusMessages = [
                'Initializing AI model...',
                'Processing your prompt...',
                'Generating image layers...',
                'Applying artistic style...',
                'Refining details...',
                'Finalizing your creation...'
            ];
            let currentStatusIndex = 0;
            
            // Add status element if it doesn't exist
            const statusElement = this.createStatusElement();
            
            const interval = setInterval(() => {
                progress += Math.random() * 15 + 5; // More consistent progress
                
                if (progress >= 100) {
                    progress = 100;
                    statusElement.textContent = 'Complete!';
                    clearInterval(interval);
                    setTimeout(() => resolve(), 500); // Small delay for completion
                } else {
                    // Update status message based on progress
                    const statusIndex = Math.floor((progress / 100) * statusMessages.length);
                    if (statusIndex !== currentStatusIndex && statusIndex < statusMessages.length) {
                        currentStatusIndex = statusIndex;
                        statusElement.textContent = statusMessages[statusIndex];
                    }
                }
                
                this.updateProgressBar(progress);
            }, 600);
        });
    }
    
    showDefaultState() {
        document.querySelectorAll('.display-state').forEach(state => {
            state.classList.remove('active');
        });
        document.getElementById('defaultState').classList.add('active');
    }
    
    showGeneratingState() {
        document.querySelectorAll('.display-state').forEach(state => {
            state.classList.remove('active');
        });
        document.getElementById('generatingState').classList.add('active');
        
        // Reset progress
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }
    }
    
    showResultState(imageUrl, metadata = {}) {
        document.querySelectorAll('.display-state').forEach(state => {
            state.classList.remove('active');
        });
        document.getElementById('resultState').classList.add('active');
        
        const resultImage = document.getElementById('resultImage');
        if (resultImage) {
            resultImage.src = imageUrl;
            resultImage.alt = `Generated image: ${metadata.prompt || 'AI generated image'}`;
        }
        
        // Setup action buttons
        this.setupResultActions(imageUrl, metadata);
        
        // Add metadata display if provided
        this.displayResultMetadata(metadata);
    }
    
    setupResultActions(imageUrl, metadata) {
        // Download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadImage(imageUrl, metadata);
        }
        
        // Regenerate button
        const regenerateBtn = document.getElementById('regenerateBtn');
        if (regenerateBtn) {
            regenerateBtn.onclick = () => this.regenerateImage();
        }
        
        // Share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.onclick = () => this.shareImage(imageUrl, metadata);
        }
    }
    
    async downloadImage(imageUrl, metadata = {}) {
        try {
            this.showSuccess('Preparing download...');
            
            // Generate filename with metadata
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `nano-banana-${timestamp}-${this.selectedRatio.replace(':', 'x')}.jpg`;
            
            // Create a temporary link element
            const link = document.createElement('a');
            link.download = filename;
            
            // For cross-origin images or data URLs, we need to fetch and create blob
            if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
                try {
                    const response = await fetch(imageUrl, {
                        mode: 'cors',
                        headers: {
                            'Accept': 'image/*'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    link.href = blobUrl;
                    
                    // Clean up blob URL after download
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                } catch (fetchError) {
                    console.warn('CORS fetch failed, trying direct link:', fetchError);
                    link.href = imageUrl;
                }
            } else {
                link.href = imageUrl;
            }
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showSuccess('Image downloaded successfully!');
            console.log('Image download initiated:', filename);
            
            // Track download event
            this.trackEvent('image_downloaded', {
                filename: filename,
                aspectRatio: this.selectedRatio,
                style: this.selectedStyle,
                mode: this.currentMode
            });
            
        } catch (error) {
            console.error('Download failed:', error);
            this.showError('Download failed. Please try right-clicking the image and selecting "Save image as..."');
        }
    }
    
    regenerateImage() {
        // Get the current prompt and settings
        const prompt = this.currentMode === 'text-to-image' 
            ? document.getElementById('promptInput').value.trim()
            : document.getElementById('transformPrompt').value.trim();
            
        if (prompt) {
            console.log('Regenerating image with same settings');
            this.handleGenerate();
        } else {
            alert('Please enter a prompt to regenerate the image');
        }
    }
    
    async shareImage(imageUrl, metadata = {}) {
        const shareTitle = 'Check out my AI-generated image!';
        const shareText = `Created with Nano Banana AI: "${metadata.prompt || 'Amazing AI art'}"`;
        const shareUrl = window.location.href;
        
        const shareData = {
            title: shareTitle,
            text: shareText,
            url: shareUrl
        };
        
        try {
            // Try native Web Share API first (mobile devices)
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                this.showSuccess('Shared successfully!');
                console.log('Image shared via Web Share API');
                
                // Track share event
                this.trackEvent('image_shared', {
                    method: 'native',
                    prompt: metadata.prompt,
                    aspectRatio: this.selectedRatio
                });
                
                return;
            }
            
            // Fallback: try to copy link to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                this.showSuccess('Link copied to clipboard! Share it with your friends.');
                
                // Track share event
                this.trackEvent('image_shared', {
                    method: 'clipboard',
                    prompt: metadata.prompt,
                    aspectRatio: this.selectedRatio
                });
                
                return;
            }
            
            // Final fallback: show share options modal
            this.showShareOptions(imageUrl, metadata);
            
        } catch (error) {
            console.error('Share failed:', error);
            
            // Show share options as fallback
            this.showShareOptions(imageUrl, metadata);
        }
    }
    
    showShareOptions(imageUrl, metadata) {
        const shareText = encodeURIComponent(`Check out my AI-generated image created with Nano Banana! "${metadata.prompt || 'Amazing AI art'}"`);
        const shareUrl = encodeURIComponent(window.location.href);
        
        const shareOptions = [
            { 
                name: 'Twitter', 
                url: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>`
            },
            { 
                name: 'Facebook', 
                url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`
            },
            { 
                name: 'LinkedIn', 
                url: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`
            },
            { 
                name: 'Reddit', 
                url: `https://reddit.com/submit?url=${shareUrl}&title=${shareText}`,
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`
            }
        ];
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h3>Share your creation</h3>
                    <button class="share-modal-close" onclick="this.closest('.share-modal').remove()" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="share-modal-body">
                    <p class="share-description">Share this AI-generated image with your friends and followers!</p>
                    <div class="share-options">
                        ${shareOptions.map(option => `
                            <a href="${option.url}" target="_blank" rel="noopener" class="share-option" 
                               onclick="window.app.trackEvent('image_shared', {method: '${option.name.toLowerCase()}', prompt: '${metadata.prompt || ''}'})">
                                <div class="share-option-icon">${option.icon}</div>
                                <span class="share-option-name">${option.name}</span>
                            </a>
                        `).join('')}
                    </div>
                    <div class="share-url-section">
                        <label for="shareUrl">Or copy the link:</label>
                        <div class="share-url-input">
                            <input type="text" id="shareUrl" value="${decodeURIComponent(shareUrl)}" readonly>
                            <button onclick="this.previousElementSibling.select(); document.execCommand('copy'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 2000)">Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Track share modal opened
        this.trackEvent('share_modal_opened', {
            prompt: metadata.prompt,
            aspectRatio: this.selectedRatio
        });
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    ${type === 'success' ? 
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20,6 9,17 4,12"></polyline></svg>' :
                        type === 'error' ?
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' :
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                    }
                </div>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.closest('.notification').remove()" aria-label="Close notification">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // Add entrance animation
        requestAnimationFrame(() => {
            notification.classList.add('notification-show');
        });
    }
    
    showAuthPrompt(message) {
        const modal = document.createElement('div');
        modal.className = 'auth-prompt-modal';
        modal.innerHTML = `
            <div class="auth-prompt-overlay" onclick="this.parentElement.remove()"></div>
            <div class="auth-prompt-content">
                <div class="auth-prompt-header">
                    <h3>Sign in to continue</h3>
                    <button class="auth-prompt-close" onclick="this.closest('.auth-prompt-modal').remove()" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="auth-prompt-body">
                    <p>${message}</p>
                    <p>Sign in with Google to get 10 bonus generations and unlimited access!</p>
                    <div class="auth-prompt-actions">
                        <button class="btn-primary" onclick="window.app.handleLogin(); this.closest('.auth-prompt-modal').remove();">
                            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px; margin-right: 8px;">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Sign in with Google
                        </button>
                        <button class="btn-secondary" onclick="this.closest('.auth-prompt-modal').remove();">Maybe later</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    trackEvent(eventName, properties = {}) {
        // Simple event tracking - can be enhanced with analytics services
        console.log('Event tracked:', eventName, properties);
        
        // Store events in localStorage for basic analytics
        const events = JSON.parse(localStorage.getItem('nanobanana_events') || '[]');
        events.push({
            event: eventName,
            properties: properties,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
        });
        
        // Keep only last 100 events
        if (events.length > 100) {
            events.splice(0, events.length - 100);
        }
        
        localStorage.setItem('nanobanana_events', JSON.stringify(events));
    }
    
    getSessionId() {
        let sessionId = sessionStorage.getItem('nanobanana_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('nanobanana_session_id', sessionId);
        }
        return sessionId;
    }
    
    displayResultMetadata(metadata) {
        // Remove existing metadata
        const existingMetadata = document.querySelector('.result-metadata');
        if (existingMetadata) {
            existingMetadata.remove();
        }
        
        if (!metadata || Object.keys(metadata).length === 0) return;
        
        const resultState = document.getElementById('resultState');
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'result-metadata';
        
        const items = [];
        if (metadata.aspectRatio) items.push(`<span class="metadata-item">Ratio: ${metadata.aspectRatio}</span>`);
        if (metadata.style) items.push(`<span class="metadata-item">Style: ${metadata.style}</span>`);
        if (metadata.model) items.push(`<span class="metadata-item">Model: ${metadata.model}</span>`);
        if (metadata.generationTime) items.push(`<span class="metadata-item">Time: ${metadata.generationTime}s</span>`);
        
        if (items.length > 0) {
            metadataDiv.innerHTML = items.join('');
            resultState.appendChild(metadataDiv);
        }
    }
    
    handleImageUpload(file) {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showError('Please upload a JPG, PNG, or WebP image');
            return;
        }
        
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('File size must be less than 10MB');
            return;
        }
        
        // Show loading state
        const uploadArea = document.getElementById('uploadArea');
        const originalContent = uploadArea.innerHTML;
        uploadArea.dataset.originalContent = originalContent;
        
        uploadArea.innerHTML = `
            <div class="upload-loading">
                <div class="upload-spinner"></div>
                <p>Processing image...</p>
            </div>
        `;
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            // Create image element to get dimensions
            const img = new Image();
            img.onload = () => {
                const dimensions = `${img.width} × ${img.height}`;
                const fileSize = (file.size / 1024 / 1024).toFixed(1);
                
                uploadArea.innerHTML = `
                    <div class="upload-preview">
                        <img src="${e.target.result}" alt="Uploaded image" class="preview-image" data-original="${e.target.result}">
                        <div class="upload-info">
                            <p class="upload-success">✓ Image uploaded successfully</p>
                            <div class="upload-details">
                                <span class="upload-detail">${dimensions}px</span>
                                <span class="upload-detail">${fileSize}MB</span>
                                <span class="upload-detail">${file.type.split('/')[1].toUpperCase()}</span>
                            </div>
                        </div>
                        <button type="button" class="change-image-btn" onclick="window.app.resetImageUpload()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                            Change Image
                        </button>
                    </div>
                `;
                
                this.showSuccess('Image uploaded successfully!');
            };
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            this.showError('Failed to read the image file');
            uploadArea.innerHTML = originalContent;
        };
        
        reader.readAsDataURL(file);
    }
    
    resetImageUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const originalContent = uploadArea.dataset.originalContent;
        
        if (originalContent) {
            uploadArea.innerHTML = originalContent;
        } else {
            // Fallback to default upload area content
            uploadArea.innerHTML = `
                <div class="upload-placeholder">
                    <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7,10 12,15 17,10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <p>Drag & drop an image here or click to browse</p>
                    <p class="upload-hint">Supports JPG, PNG, WebP (max 10MB)</p>
                </div>
            `;
        }
        
        // Reset file input
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            imageUpload.value = '';
        }
    }
    
    handleLogin() {
        if (this.isLoggedIn) {
            // If already logged in, this click is handled by the dropdown
            return;
        }
        
        // Use AuthManager for Google OAuth login
        if (this.authManager) {
            this.authManager.signInWithGoogle();
        } else {
            console.error('AuthManager not initialized');
            alert('Authentication system not available. Please refresh the page.');
        }
    }
    
    checkAuthStatus() {
        // Auth status is now handled by AuthManager
        console.log('Auth status will be handled by AuthManager');
        
        // Update anonymous user status in UI for non-authenticated users
        if (!this.isLoggedIn) {
            this.updateAnonymousUserStatus();
        }
    }
    
    onAuthStateChange(event, session, userProfile) {
        // Handle authentication state changes from AuthManager
        console.log('App received auth state change:', event, session, userProfile);
        
        if (event === 'SIGNED_IN' && session && userProfile) {
            this.user = session.user;
            this.userCredits = userProfile.credits || 0;
            this.isLoggedIn = true;
            
            // Initialize user manager with user data
            if (window.userManager) {
                window.userManager.initialize(this.user, userProfile);
            }
            
            // Initialize credits manager
            if (window.creditsManager) {
                window.creditsManager.initialize(this.user.id);
            }
        } else if (event === 'SIGNED_OUT') {
            this.user = null;
            this.userCredits = 0;
            this.isLoggedIn = false;
        }
        
        if (event === 'SIGNED_IN' && session) {
            this.isLoggedIn = true;
            this.user = session.user;
            this.userProfile = userProfile;
            this.userCredits = userProfile?.credits || 0;
            
            // Update UI to show authenticated state
            this.updateUserStatus(this.userCredits, true);
            this.updateGenerateButtonState();
            
            // Show welcome message
            this.showSuccess(`Welcome back, ${this.user.user_metadata?.name || 'User'}! You have ${this.userCredits} credits.`);
            
        } else if (event === 'SIGNED_OUT') {
            this.isLoggedIn = false;
            this.user = null;
            this.userProfile = null;
            this.userCredits = 0;
            
            // Update UI to show anonymous state
            this.updateAnonymousUserStatus();
            
            // Show signed out message
            this.showSuccess('Signed out successfully. You can still use 5 free generations!');
        }
    }
    
    updateUserStatus(credits, isAuthenticated) {
        const userCredits = document.getElementById('userCredits');
        const creditsCount = userCredits?.querySelector('.credits-count');
        
        if (isAuthenticated && userCredits && creditsCount) {
            userCredits.style.display = 'flex';
            creditsCount.textContent = credits;
        } else if (userCredits) {
            userCredits.style.display = 'none';
        }
        
        // Update generate button text
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            const btnText = generateBtn.querySelector('.btn-text');
            const btnCost = generateBtn.querySelector('.btn-cost');
            
            if (isAuthenticated) {
                if (btnText) btnText.textContent = 'Generate Image';
                if (btnCost) btnCost.textContent = '(1 credit)';
            } else {
                const status = this.anonymousUserManager?.getStatus();
                if (btnText) btnText.textContent = 'Generate Image';
                if (btnCost) btnCost.textContent = `(${status?.freeGenerationsRemaining || 0} free left)`;
            }
        }
    }
    
    updateAnonymousUserStatus() {
        if (!this.isLoggedIn && this.anonymousUserManager) {
            const status = this.anonymousUserManager.getStatus();
            this.updateUserStatus(status.freeGenerationsRemaining, false);
            
            // Update generate button state
            this.updateGenerateButtonState();
            
            console.log('Anonymous user status updated:', status);
        }
    }
    
    updateGenerateButtonState() {
        const generateBtn = document.getElementById('generateBtn');
        if (!generateBtn) return;
        
        if (!this.isLoggedIn && this.anonymousUserManager) {
            const canGenerate = this.anonymousUserManager.canGenerate();
            const statusMessage = this.anonymousUserManager.getStatusMessage();
            
            if (!canGenerate.allowed) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Limit Reached';
                generateBtn.title = statusMessage;
            } else {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Image';
                generateBtn.title = statusMessage;
            }
        }
    }
    
    initHeroSlideshow() {
        const slideshowContainer = document.getElementById('heroSlideshow');
        if (!slideshowContainer) return;
        
        // Define background images/gradients for the slideshow
        // These represent different AI art styles and themes
        const backgrounds = [
            {
                type: 'gradient',
                value: 'radial-gradient(circle at 30% 20%, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                name: 'Digital Dreams'
            },
            {
                type: 'gradient', 
                value: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
                name: 'Soft Pastels'
            },
            {
                type: 'gradient',
                value: 'radial-gradient(circle at 70% 80%, #4facfe 0%, #00f2fe 40%, #43e97b 100%)',
                name: 'Ocean Vibes'
            },
            {
                type: 'gradient',
                value: 'conic-gradient(from 45deg, #43e97b 0%, #38f9d7 25%, #4facfe 50%, #667eea 75%, #43e97b 100%)',
                name: 'Neon Spectrum'
            },
            {
                type: 'gradient',
                value: 'linear-gradient(135deg, #fa709a 0%, #fee140 50%, #fa709a 100%)',
                name: 'Sunset Glow'
            },
            {
                type: 'gradient',
                value: 'radial-gradient(ellipse at 50% 0%, #a8edea 0%, #fed6e3 50%, #d299c2 100%)',
                name: 'Aurora Borealis'
            },
            {
                type: 'gradient',
                value: 'linear-gradient(45deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
                name: 'Cosmic Flow'
            }
        ];
        
        // Create slide elements
        backgrounds.forEach((bg, index) => {
            const slide = document.createElement('div');
            slide.className = 'slideshow-slide';
            
            if (bg.type === 'gradient') {
                slide.style.background = bg.value;
            } else if (bg.type === 'image') {
                slide.style.backgroundImage = `url(${bg.value})`;
            }
            
            // Make first slide active
            if (index === 0) {
                slide.classList.add('active');
            }
            
            slideshowContainer.appendChild(slide);
        });
        
        // Start slideshow rotation
        this.startSlideshowRotation(backgrounds.length);
        
        // Add subtle parallax effect
        this.initHeroParallax();
        
        console.log('Hero slideshow initialized with', backgrounds.length, 'backgrounds');
    }
    
    startSlideshowRotation(totalSlides) {
        let currentSlide = 0;
        
        const rotateSlides = () => {
            const slides = document.querySelectorAll('.slideshow-slide');
            
            // Remove active class from current slide
            slides[currentSlide].classList.remove('active');
            
            // Move to next slide
            currentSlide = (currentSlide + 1) % totalSlides;
            
            // Add active class to new slide
            slides[currentSlide].classList.add('active');
        };
        
        // Rotate every 5 seconds
        setInterval(rotateSlides, 5000);
    }
    
    initHeroParallax() {
        const heroSection = document.querySelector('.hero-section');
        const heroBackground = document.querySelector('.hero-background');
        
        if (!heroSection || !heroBackground) return;
        
        const handleScroll = () => {
            const scrolled = window.pageYOffset;
            const heroHeight = heroSection.offsetHeight;
            const scrollPercent = scrolled / heroHeight;
            
            // Only apply parallax when hero is visible
            if (scrollPercent <= 1) {
                const translateY = scrolled * 0.5;
                heroBackground.style.transform = `translateY(${translateY}px)`;
            }
        };
        
        // Throttle scroll events for better performance
        let ticking = false;
        const throttledScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', throttledScroll);
    }
    
    initPricingCards() {
        // Define pricing plans data
        const pricingPlans = {
            monthly: [
                {
                    name: 'Starter',
                    price: 9.99,
                    images: 200,
                    features: [
                        '200 AI images per month',
                        'Text to Image generation',
                        'Image to Image transformation',
                        '5 aspect ratios',
                        'Basic styles (Realistic, Artistic, Fantasy)',
                        'Standard resolution (1024x1024)',
                        'Commercial usage rights',
                        'Email support'
                    ],
                    recommended: false,
                    buttonText: 'Choose Starter',
                    buttonClass: 'btn-secondary'
                },
                {
                    name: 'Pro',
                    price: 19.99,
                    images: 500,
                    features: [
                        '500 AI images per month',
                        'Text to Image generation',
                        'Image to Image transformation',
                        'All aspect ratios',
                        'All styles + Premium styles',
                        'High resolution (2048x2048)',
                        'Priority generation queue',
                        'Commercial usage rights',
                        'Priority email support',
                        'API access (coming soon)'
                    ],
                    recommended: true,
                    buttonText: 'Choose Pro',
                    buttonClass: 'btn-primary'
                },
                {
                    name: 'Studio',
                    price: 39.99,
                    images: 1500,
                    features: [
                        '1,500 AI images per month',
                        'Text to Image generation',
                        'Image to Image transformation',
                        'All aspect ratios',
                        'All styles + Exclusive styles',
                        'Ultra-high resolution (4096x4096)',
                        'Fastest generation queue',
                        'Batch processing',
                        'Commercial usage rights',
                        'Phone + email support',
                        'Full API access',
                        'Custom model training (beta)'
                    ],
                    recommended: false,
                    buttonText: 'Choose Studio',
                    buttonClass: 'btn-secondary'
                }
            ],
            yearly: [
                {
                    name: 'Starter',
                    price: 7.99,
                    originalPrice: 9.99,
                    images: 200,
                    features: [
                        '200 AI images per month',
                        'Text to Image generation',
                        'Image to Image transformation',
                        '5 aspect ratios',
                        'Basic styles (Realistic, Artistic, Fantasy)',
                        'Standard resolution (1024x1024)',
                        'Commercial usage rights',
                        'Email support'
                    ],
                    recommended: false,
                    buttonText: 'Choose Starter',
                    buttonClass: 'btn-secondary'
                },
                {
                    name: 'Pro',
                    price: 15.99,
                    originalPrice: 19.99,
                    images: 500,
                    features: [
                        '500 AI images per month',
                        'Text to Image generation',
                        'Image to Image transformation',
                        'All aspect ratios',
                        'All styles + Premium styles',
                        'High resolution (2048x2048)',
                        'Priority generation queue',
                        'Commercial usage rights',
                        'Priority email support',
                        'API access (coming soon)'
                    ],
                    recommended: true,
                    buttonText: 'Choose Pro',
                    buttonClass: 'btn-primary'
                },
                {
                    name: 'Studio',
                    price: 31.99,
                    originalPrice: 39.99,
                    images: 1500,
                    features: [
                        '1,500 AI images per month',
                        'Text to Image generation',
                        'Image to Image transformation',
                        'All aspect ratios',
                        'All styles + Exclusive styles',
                        'Ultra-high resolution (4096x4096)',
                        'Fastest generation queue',
                        'Batch processing',
                        'Commercial usage rights',
                        'Phone + email support',
                        'Full API access',
                        'Custom model training (beta)'
                    ],
                    recommended: false,
                    buttonText: 'Choose Studio',
                    buttonClass: 'btn-secondary'
                }
            ]
        };

        // Define credit packages
        const creditPackages = [
            {
                credits: 50,
                price: 4.99,
                value: '$0.10 per image',
                popular: false
            },
            {
                credits: 120,
                price: 9.99,
                value: '$0.08 per image',
                popular: true
            },
            {
                credits: 300,
                price: 19.99,
                value: '$0.07 per image',
                popular: false
            }
        ];

        // Initialize billing toggle
        this.initBillingToggle();

        // Render pricing cards
        this.renderPricingCards(pricingPlans.monthly);

        // Render credit packages
        this.renderCreditPackages(creditPackages);

        // Store pricing data for toggle functionality
        this.pricingPlans = pricingPlans;

        // Setup free trial button
        this.setupFreeTrialButton();

        console.log('Pricing cards initialized with', pricingPlans.monthly.length, 'plans and', creditPackages.length, 'credit packages');
    }

    initBillingToggle() {
        const toggleButtons = document.querySelectorAll('.toggle-btn');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const billingType = e.target.dataset.billing;
                
                // Update active toggle button
                toggleButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update pricing cards
                if (this.pricingPlans) {
                    this.renderPricingCards(this.pricingPlans[billingType]);
                }
            });
        });
    }

    renderPricingCards(plans) {
        const pricingGrid = document.getElementById('pricingGrid');
        if (!pricingGrid) return;

        pricingGrid.innerHTML = plans.map(plan => {
            const featuresHtml = plan.features.map(feature => {
                const isHighlight = feature.includes('Commercial') || feature.includes('Priority') || feature.includes('API');
                return `<li${isHighlight ? ' class="feature-highlight"' : ''}>${feature}</li>`;
            }).join('');

            const priceNote = plan.originalPrice 
                ? `<div class="price-note">Save $${((plan.originalPrice - plan.price) * 12).toFixed(0)}/year</div>`
                : '<div class="price-note"></div>';

            return `
                <div class="pricing-card${plan.recommended ? ' recommended' : ''}">
                    <div class="plan-name">${plan.name}</div>
                    <div class="plan-price">
                        <span class="price-currency">$</span>
                        <span class="price-amount">${plan.price}</span>
                        <span class="price-period">/month</span>
                    </div>
                    ${priceNote}
                    <ul class="plan-features">
                        ${featuresHtml}
                    </ul>
                    <div class="plan-cta">
                        <button class="plan-btn ${plan.buttonClass}" data-plan="${plan.name.toLowerCase()}" data-price="${plan.price}">
                            ${plan.buttonText}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to plan buttons
        this.setupPlanButtons();
    }

    renderCreditPackages(packages) {
        const creditsContainer = document.getElementById('creditsPackages');
        if (!creditsContainer) return;

        creditsContainer.innerHTML = packages.map(pkg => `
            <div class="credit-package${pkg.popular ? ' popular' : ''}">
                <div class="credit-amount">${pkg.credits}</div>
                <div class="credit-price">$${pkg.price}</div>
                <div class="credit-value">${pkg.value}</div>
                <button class="credit-btn" data-credits="${pkg.credits}" data-price="${pkg.price}">
                    Buy Credits
                </button>
            </div>
        `).join('');

        // Add event listeners to credit buttons
        this.setupCreditButtons();
    }

    setupPlanButtons() {
        const planButtons = document.querySelectorAll('.plan-btn');
        
        planButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const planName = button.dataset.plan;
                const planType = this.mapPlanNameToType(planName);
                
                // 检查用户登录状态
                if (!window.authManager || !window.authManager.user) {
                    // 提示用户登录
                    this.showLoginPrompt('请先登录以购买订阅计划');
                    return;
                }
                
                try {
                    button.disabled = true;
                    const originalText = button.textContent;
                    button.textContent = '处理中...';
                    
                    await window.stripeManager.createSubscriptionCheckout(
                        planType,
                        window.authManager.user.id
                    );
                } catch (error) {
                    console.error('Subscription checkout failed:', error);
                    this.showError('创建支付页面失败，请重试');
                } finally {
                    button.disabled = false;
                    button.textContent = button.dataset.originalText || '选择计划';
                }
            });
            button.addEventListener('click', (e) => {
                const plan = e.target.dataset.plan;
                const price = e.target.dataset.price;
                
                console.log(`Plan selected: ${plan} - $${price}/month`);
                
                // For now, show alert - in real implementation this would redirect to Stripe
                if (plan === 'starter' && price === '9.99') {
                    this.handleFreeTrial();
                } else {
                    this.handlePlanSelection(plan, price, e);
                }
            });
        });
    }

    setupCreditButtons() {
        const creditButtons = document.querySelectorAll('.credit-btn');
        
        creditButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const credits = e.target.dataset.credits;
                const price = e.target.dataset.price;
                
                console.log(`Credits selected: ${credits} credits for $${price}`);
                this.handleCreditPurchase(credits, price, e);
            });
        });
    }

    handleFreeTrial() {
        // Simulate starting free trial
        alert('🎉 Welcome to your free trial! You now have 5 free image generations. No credit card required!');
        
        // Update user status to show free trial
        this.simulateAnonymousUser(5);
        
        // Scroll to generator
        this.scrollToSection('generator');
        
        console.log('Free trial started');
    }

    handlePlanSelection(plan, price, event) {
        // Show loading state
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
        
        // Simulate loading delay
        setTimeout(() => {
            // In a real implementation, this would redirect to Stripe Checkout
            const message = `Redirecting to secure checkout for ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan ($${price}/month)...`;
            alert(message);
            
            // Reset button
            button.textContent = originalText;
            button.disabled = false;
            
            // TODO: Implement Stripe integration in later task
            console.log('Plan selection:', { plan, price });
        }, 1000);
    }

    handleCreditPurchase(credits, price, event) {
        // Show loading state
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
        
        // Simulate loading delay
        setTimeout(() => {
            // In a real implementation, this would redirect to Stripe Checkout
            const message = `Redirecting to secure checkout for ${credits} credits ($${price})...`;
            alert(message);
            
            // Reset button
            button.textContent = originalText;
            button.disabled = false;
            
            // TODO: Implement Stripe integration in later task
            console.log('Credit purchase:', { credits, price });
        }, 1000);
    }

    setupFreeTrialButton() {
        const freeTrialBtn = document.getElementById('freeTrialBtn');
        if (freeTrialBtn) {
            freeTrialBtn.addEventListener('click', () => {
                this.handleFreeTrial();
            });
        }
    }
    
    initFAQ() {
        // Placeholder for FAQ initialization
        console.log('FAQ initialized');
    }
    
    // Header Navigation Component Methods
    setupHeaderNavigation() {
        // Smooth scrolling for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                this.scrollToSection(targetId);
            });
        });
        
        // Header scroll effect
        this.setupHeaderScrollEffect();
        
        // Mobile menu toggle (for future mobile menu implementation)
        this.setupMobileMenu();
    }
    
    scrollToSection(sectionId) {
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            const headerHeight = document.querySelector('.header').offsetHeight;
            const targetPosition = targetSection.offsetTop - headerHeight - 20;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            // Update active navigation link
            this.updateActiveNavLink(sectionId);
        }
    }
    
    updateActiveNavLink(activeSection) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${activeSection}`) {
                link.classList.add('active');
            }
        });
    }
    
    setupHeaderScrollEffect() {
        let lastScrollY = window.scrollY;
        const header = document.querySelector('.header');
        
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            // Add/remove scrolled class for styling
            if (currentScrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            
            // Hide/show header on scroll (optional enhancement)
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                header.classList.add('header-hidden');
            } else {
                header.classList.remove('header-hidden');
            }
            
            lastScrollY = currentScrollY;
            
            // Update active section based on scroll position
            this.updateActiveNavOnScroll();
        });
    }
    
    updateActiveNavOnScroll() {
        const sections = ['features', 'pricing', 'gallery', 'faq'];
        const headerHeight = document.querySelector('.header').offsetHeight;
        const scrollPosition = window.scrollY + headerHeight + 100;
        
        let activeSection = '';
        
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                const sectionTop = section.offsetTop;
                const sectionBottom = sectionTop + section.offsetHeight;
                
                if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                    activeSection = sectionId;
                }
            }
        });
        
        if (activeSection) {
            this.updateActiveNavLink(activeSection);
        }
    }
    
    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }
        
        console.log('Mobile menu setup ready');
    }
    
    toggleMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const navMenu = document.querySelector('.nav-menu');
        
        if (mobileMenuBtn) {
            mobileMenuBtn.classList.toggle('active');
        }
        
        // For now, just log the action
        // In a future enhancement, this would show/hide a mobile menu overlay
        console.log('Mobile menu toggled');
        
        // TODO: Implement actual mobile menu overlay in future enhancement
    }
    
    // User Status Management Methods
    updateUserStatus(credits, isLoggedIn, userInfo = null) {
        this.userCredits = credits;
        this.isLoggedIn = isLoggedIn;
        this.user = userInfo;
        
        const userCreditsElement = document.getElementById('userCredits');
        const loginBtn = document.getElementById('loginBtn');
        
        if (isLoggedIn) {
            // Show user credits and update login button
            if (userCreditsElement) {
                userCreditsElement.style.display = 'block';
                userCreditsElement.querySelector('.credits-count').textContent = credits;
            }
            
            if (loginBtn) {
                loginBtn.textContent = userInfo?.displayName || 'Account';
                loginBtn.classList.add('logged-in');
                
                // Add dropdown functionality for logged-in users
                this.setupUserDropdown(loginBtn);
            }
        } else {
            // For anonymous users, show free generations remaining
            if (userCreditsElement) {
                userCreditsElement.style.display = 'block';
                const creditsCount = userCreditsElement.querySelector('.credits-count');
                if (creditsCount) {
                    creditsCount.textContent = credits;
                }
                
                // Update credits label for anonymous users
                const creditsLabel = userCreditsElement.querySelector('.credits-label');
                if (creditsLabel) {
                    creditsLabel.textContent = credits === 1 ? 'free generation' : 'free generations';
                }
            }
            
            if (loginBtn) {
                loginBtn.textContent = 'Sign In';
                loginBtn.classList.remove('logged-in');
            }
        }
        
        console.log(`User status updated: ${isLoggedIn ? 'Logged in' : 'Anonymous'}, Credits: ${credits}`);
    }
    
    setupUserDropdown(loginBtn) {
        // Remove existing dropdown if any
        const existingDropdown = document.querySelector('.user-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }
        
        // Create user dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.innerHTML = `
            <div class="dropdown-content">
                <div class="user-info">
                    <span class="user-name">${this.user?.displayName || 'User'}</span>
                    <span class="user-email">${this.user?.email || ''}</span>
                </div>
                <hr>
                <a href="#" class="dropdown-item" data-action="profile">Profile</a>
                <a href="#" class="dropdown-item" data-action="history">Generation History</a>
                <a href="#" class="dropdown-item" data-action="billing">Billing</a>
                <hr>
                <a href="#" class="dropdown-item" data-action="logout">Sign Out</a>
            </div>
        `;
        
        // Position dropdown
        loginBtn.parentElement.style.position = 'relative';
        loginBtn.parentElement.appendChild(dropdown);
        
        // Toggle dropdown on click
        loginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        // Handle dropdown actions
        dropdown.addEventListener('click', (e) => {
            e.preventDefault();
            const action = e.target.dataset.action;
            if (action) {
                this.handleUserAction(action);
                dropdown.classList.remove('show');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
    }
    
    handleUserAction(action) {
        switch (action) {
            case 'profile':
                console.log('Navigate to profile');
                // Implement profile navigation
                break;
            case 'history':
                console.log('Navigate to generation history');
                // Implement history navigation
                break;
            case 'billing':
                console.log('Navigate to billing');
                // Implement billing navigation
                break;
            case 'logout':
                this.handleLogout();
                break;
            default:
                console.log('Unknown action:', action);
        }
    }
    
    handleLogout() {
        // Clear user data
        this.user = null;
        this.userCredits = 0;
        this.isLoggedIn = false;
        
        // Update UI
        this.updateUserStatus(0, false);
        
        // Remove dropdown
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown) {
            dropdown.remove();
        }
        
        console.log('User logged out');
        
        // Reset app state
        this.isLoggedIn = false;
        this.user = null;
        this.userCredits = 0;
        
        // Update anonymous user status
        this.updateAnonymousUserStatus();
    }
    
    // Authentication state change handler
    onAuthStateChange(event, session, userProfile) {
        console.log('App received auth state change:', event, session, userProfile);
        
        if (event === 'SIGNED_IN' && session) {
            this.isLoggedIn = true;
            this.user = session.user;
            this.userCredits = userProfile?.credits || 0;
            
            // Update generate button state
            this.updateGenerateButtonState();
            
            console.log('User signed in:', this.user.email, 'Credits:', this.userCredits);
        } else if (event === 'SIGNED_OUT') {
            this.isLoggedIn = false;
            this.user = null;
            this.userCredits = 0;
            
            // Update anonymous user status and generate button
            this.updateAnonymousUserStatus();
            this.updateGenerateButtonState();
            
            console.log('User signed out');
        }
    }
    
    // Show authentication prompt modal
    showAuthPrompt(message) {
        // Remove existing modal if any
        const existingModal = document.querySelector('.auth-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-content">
                <button class="auth-modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
                
                <div class="auth-modal-header">
                    <h2 class="auth-modal-title">Sign in to continue</h2>
                    <p class="auth-modal-subtitle">${message}</p>
                </div>
                
                <div class="auth-benefits">
                    <h4>Sign up with Google and get:</h4>
                    <ul>
                        <li>10 bonus image generations</li>
                        <li>Save your generation history</li>
                        <li>Access to premium features</li>
                        <li>Priority generation queue</li>
                        <li>Commercial usage rights</li>
                    </ul>
                </div>
                
                <button class="google-signin-btn" id="modalGoogleSignin">
                    <svg class="google-icon" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>
                
                <p style="text-align: center; margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
                    By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(modal);
        
        // Handle Google sign-in button
        const googleSigninBtn = modal.querySelector('#modalGoogleSignin');
        googleSigninBtn.addEventListener('click', () => {
            if (this.authManager) {
                this.authManager.signInWithGoogle();
                modal.remove();
            }
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // Method to simulate user login (for testing)
    simulateLogin(userInfo = null) {
        const defaultUser = {
            displayName: 'John Doe',
            email: 'john@example.com',
            credits: 25
        };
        
        const user = userInfo || defaultUser;
        this.updateUserStatus(user.credits, true, user);
    }
    
    // Method to simulate anonymous user with free credits
    simulateAnonymousUser(freeCredits = 5) {
        this.updateUserStatus(freeCredits, false);
    }
    
    // Method to get anonymous user fingerprint for debugging
    getAnonymousFingerprint() {
        if (this.anonymousUserManager) {
            return this.anonymousUserManager.anonymousId;
        }
        return null;
    }
    
    // Method to force reset anonymous user data (for testing)
    resetAnonymousUser() {
        if (this.anonymousUserManager && this.anonymousUserManager.forceReset) {
            this.anonymousUserManager.forceReset();
            this.updateAnonymousUserStatus();
            console.log('Anonymous user data reset');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.nanoBananaApp = new NanoBananaApp();
    
    // Add test functions to window for manual testing
    window.testLogin = () => window.nanoBananaApp.simulateLogin();
    window.testLogout = () => window.nanoBananaApp.handleLogout();
    window.testAnonymous = () => window.nanoBananaApp.simulateAnonymousUser(3);
    
    // Anonymous user testing functions
    window.testAnonymousStatus = () => {
        const status = window.nanoBananaApp.anonymousUserManager.getStatus();
        console.log('Anonymous User Status:', status);
        console.log('Status Message:', window.nanoBananaApp.anonymousUserManager.getStatusMessage());
        return status;
    };
    window.testAnonymousReset = () => window.nanoBananaApp.resetAnonymousUser();
    window.testAnonymousFingerprint = () => {
        const fp = window.nanoBananaApp.getAnonymousFingerprint();
        console.log('Anonymous Fingerprint:', fp);
        return fp;
    };
    
    // Test functions for display states
    window.testDefaultState = () => window.nanoBananaApp.showDefaultState();
    window.testGeneratingState = () => window.nanoBananaApp.showGeneratingState();
    window.testResultState = () => {
        const metadata = {
            prompt: 'A beautiful sunset over mountains',
            aspectRatio: '16:9',
            style: 'realistic',
            model: 'FLUX.1-dev',
            generationTime: 12
        };
        window.nanoBananaApp.showResultState('assets/sample-1.jpg', metadata);
    };
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NanoBananaApp;
}  
  
    initFAQ() {
        const faqData = [
            {
                question: "How does AI image generation work?",
                answer: `<p>Our AI uses advanced machine learning models trained on millions of images to understand the relationship between text descriptions and visual elements. When you provide a prompt, the AI interprets your words and generates a unique image that matches your description.</p>
                        <p>The process typically takes 10-30 seconds and uses state-of-the-art diffusion models like FLUX.1-dev to create high-quality, original artwork.</p>`
            },
            {
                question: "What can I do with my generated images?",
                answer: `<p>All images generated with Nano Banana come with full commercial usage rights. You can:</p>
                        <ul>
                            <li>Use them in your business projects and marketing materials</li>
                            <li>Sell products featuring your generated images</li>
                            <li>Use them in presentations, websites, and social media</li>
                            <li>Print them for personal or commercial use</li>
                            <li>Modify and edit them as needed</li>
                        </ul>
                        <p>The only restriction is that you cannot resell the raw AI generation service itself.</p>`
            },
            {
                question: "How many free images do I get?",
                answer: `<p>New users get 5 free image generations without needing to sign up or provide a credit card. After using your free generations, you'll need to create an account to continue.</p>
                        <p>When you sign up with Google, you'll receive an additional 10 bonus generations, giving you 15 total free images to explore our service.</p>
                        <p>Free generations reset every 24 hours, so you can continue experimenting with our AI models.</p>`
            },
            {
                question: "What image formats and sizes are supported?",
                answer: `<p>We support multiple aspect ratios and resolutions:</p>
                        <ul>
                            <li><strong>Aspect Ratios:</strong> 1:1 (square), 4:3 (landscape), 3:4 (portrait), 16:9 (widescreen), 9:16 (vertical)</li>
                            <li><strong>Standard Resolution:</strong> 1024x1024 pixels (Starter plan)</li>
                            <li><strong>High Resolution:</strong> 2048x2048 pixels (Pro plan)</li>
                            <li><strong>Ultra-High Resolution:</strong> 4096x4096 pixels (Studio plan)</li>
                        </ul>
                        <p>All images are delivered in high-quality JPEG format, optimized for both web use and printing.</p>`
            },
            {
                question: "Can I upload my own images for transformation?",
                answer: `<p>Yes! Our Image-to-Image feature allows you to upload your own photos and transform them using AI. You can:</p>
                        <ul>
                            <li>Change the artistic style of your photos</li>
                            <li>Add or remove elements from existing images</li>
                            <li>Transform photos into different art styles (watercolor, oil painting, etc.)</li>
                            <li>Enhance or modify existing artwork</li>
                        </ul>
                        <p>Supported formats: JPG, PNG, and WebP files up to 10MB in size.</p>`
            },
            {
                question: "How do credits and subscriptions work?",
                answer: `<p>We offer both subscription plans and pay-as-you-go credits:</p>
                        <p><strong>Subscription Plans:</strong></p>
                        <ul>
                            <li>Starter: 200 images/month for $9.99</li>
                            <li>Pro: 500 images/month for $19.99 (most popular)</li>
                            <li>Studio: 1,500 images/month for $39.99</li>
                        </ul>
                        <p><strong>Credit Packages:</strong></p>
                        <ul>
                            <li>50 credits for $4.99</li>
                            <li>120 credits for $9.99</li>
                            <li>300 credits for $19.99</li>
                        </ul>
                        <p>Credits never expire and can be used anytime. Each image generation costs 1 credit.</p>`
            },
            {
                question: "Is my data secure and private?",
                answer: `<p>Absolutely. We take your privacy and security seriously:</p>
                        <ul>
                            <li>All data is encrypted in transit and at rest</li>
                            <li>We never store your prompts or share your images without permission</li>
                            <li>Payment processing is handled securely through Stripe</li>
                            <li>We comply with GDPR and CCPA privacy regulations</li>
                            <li>You can delete your account and all associated data at any time</li>
                        </ul>
                        <p>Your creative work belongs to you, and we're committed to keeping it safe.</p>`
            }
        ];

        const faqList = document.getElementById('faqList');
        if (!faqList) return;

        faqList.innerHTML = faqData.map((faq, index) => `
            <div class="faq-item" data-faq-index="${index}">
                <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${index}">
                    ${faq.question}
                </button>
                <div class="faq-answer" id="faq-answer-${index}" role="region" aria-labelledby="faq-question-${index}">
                    <div class="faq-answer-content">
                        ${faq.answer}
                    </div>
                </div>
            </div>
        `).join('');

        // Add click event listeners for FAQ items
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', (e) => {
                const faqItem = e.target.closest('.faq-item');
                const isActive = faqItem.classList.contains('active');
                
                // Close all other FAQ items
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.classList.remove('active');
                    const btn = item.querySelector('.faq-question');
                    btn.setAttribute('aria-expanded', 'false');
                });
                
                // Toggle current item
                if (!isActive) {
                    faqItem.classList.add('active');
                    e.target.setAttribute('aria-expanded', 'true');
                }
            });
        });

        console.log('FAQ initialized with', faqData.length, 'items');
    }
    
    initGallery() {
        // Sample gallery data - in a real app, this would come from an API
        const galleryData = [
            {
                image: 'assets/sample-1.jpg',
                prompt: 'A majestic mountain landscape at sunset with vibrant orange and purple clouds',
                style: 'Realistic',
                aspectRatio: '16:9'
            },
            {
                image: 'assets/sample-2.jpg',
                prompt: 'Portrait of a wise old wizard with a long white beard and mystical blue eyes',
                style: 'Fantasy',
                aspectRatio: '3:4'
            },
            {
                image: 'assets/sample-3.jpg',
                prompt: 'Abstract geometric patterns in neon colors with a cyberpunk aesthetic',
                style: 'Artistic',
                aspectRatio: '1:1'
            },
            {
                image: 'assets/sample-1.jpg',
                prompt: 'A peaceful Japanese garden with cherry blossoms and a traditional bridge',
                style: 'Realistic',
                aspectRatio: '4:3'
            },
            {
                image: 'assets/sample-2.jpg',
                prompt: 'Steampunk airship flying through cloudy skies with brass and copper details',
                style: 'Fantasy',
                aspectRatio: '16:9'
            },
            {
                image: 'assets/sample-3.jpg',
                prompt: 'Minimalist watercolor painting of a single red rose on white background',
                style: 'Artistic',
                aspectRatio: '3:4'
            },
            {
                image: 'assets/sample-1.jpg',
                prompt: 'Futuristic city skyline at night with neon lights and flying cars',
                style: 'Fantasy',
                aspectRatio: '16:9'
            },
            {
                image: 'assets/sample-2.jpg',
                prompt: 'Vintage coffee shop interior with warm lighting and wooden furniture',
                style: 'Realistic',
                aspectRatio: '4:3'
            }
        ];

        const galleryScroll = document.getElementById('galleryScroll');
        if (!galleryScroll) return;

        galleryScroll.innerHTML = galleryData.map((item, index) => `
            <div class="gallery-item-scroll" data-gallery-index="${index}">
                <img src="${item.image}" alt="${item.prompt}" class="gallery-item-image" loading="lazy">
                <div class="gallery-item-info">
                    <div class="gallery-item-prompt">${item.prompt}</div>
                    <div class="gallery-item-meta">
                        <span class="gallery-item-style">${item.style}</span>
                        <span class="gallery-item-ratio">${item.aspectRatio}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click event listeners for gallery items
        document.querySelectorAll('.gallery-item-scroll').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.galleryIndex);
                const galleryItem = galleryData[index];
                this.handleGalleryItemClick(galleryItem);
            });
        });

        console.log('Gallery initialized with', galleryData.length, 'items');
    }
    
    handleGalleryItemClick(galleryItem) {
        // Fill the prompt input with the clicked gallery item's prompt
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.value = galleryItem.prompt;
        }
        
        // Set the style if it matches our available styles
        const styleMapping = {
            'Realistic': 'realistic',
            'Artistic': 'artistic', 
            'Fantasy': 'fantasy'
        };
        
        if (styleMapping[galleryItem.style]) {
            this.selectStyle(styleMapping[galleryItem.style]);
        }
        
        // Set aspect ratio if available
        if (galleryItem.aspectRatio) {
            this.selectRatio(galleryItem.aspectRatio);
        }
        
        // Scroll to generator section
        this.scrollToSection('generator');
        
        // Show a subtle notification
        this.showNotification(`Prompt copied: "${galleryItem.prompt.substring(0, 50)}${galleryItem.prompt.length > 50 ? '...' : ''}"`);
    }
    
    initPopularPrompts() {
        const popularPrompts = [
            { text: 'Sunset landscape', popular: true },
            { text: 'Portrait photography', popular: true },
            { text: 'Abstract art', popular: false },
            { text: 'Cyberpunk city', popular: true },
            { text: 'Fantasy creature', popular: false },
            { text: 'Minimalist design', popular: false },
            { text: 'Vintage poster', popular: true },
            { text: 'Watercolor painting', popular: false },
            { text: 'Space exploration', popular: true },
            { text: 'Gothic architecture', popular: false },
            { text: 'Tropical paradise', popular: false },
            { text: 'Steampunk machine', popular: false },
            { text: 'Oil painting style', popular: true },
            { text: 'Neon lights', popular: false },
            { text: 'Mountain vista', popular: false },
            { text: 'Character design', popular: true }
        ];

        const promptTags = document.getElementById('promptTags');
        if (!promptTags) return;

        promptTags.innerHTML = popularPrompts.map((prompt, index) => `
            <button class="prompt-tag ${prompt.popular ? 'popular' : ''}" data-prompt="${prompt.text}">
                ${prompt.text}
            </button>
        `).join('');

        // Add click event listeners for prompt tags
        document.querySelectorAll('.prompt-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const promptText = e.target.dataset.prompt;
                this.handlePromptTagClick(promptText);
            });
        });

        console.log('Popular prompts initialized with', popularPrompts.length, 'tags');
    }
    
    handlePromptTagClick(promptText) {
        // Fill the prompt input with the clicked tag
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            // If there's already text, append the prompt, otherwise replace
            const currentText = promptInput.value.trim();
            if (currentText) {
                promptInput.value = `${currentText}, ${promptText}`;
            } else {
                promptInput.value = promptText;
            }
            
            // Focus the input and move cursor to end
            promptInput.focus();
            promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
        }
        
        // Scroll to generator section
        this.scrollToSection('generator');
        
        // Show notification
        this.showNotification(`Added "${promptText}" to your prompt`);
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: white;
            border: 2px solid var(--primary-color);
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            max-width: 350px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
    
    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const headerHeight = 80; // Account for fixed header
            const targetPosition = section.offsetTop - headerHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }    
/**
     * 映射计划名称到Stripe类型
     */
    mapPlanNameToType(planName) {
        const mapping = {
            'starter': 'starter',
            'pro': 'pro', 
            'studio': 'studio'
        };
        return mapping[planName.toLowerCase()] || 'starter';
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
        return mapping[credits] || 'small';
    }
    
    /**
     * 显示登录提示
     */
    showLoginPrompt(message) {
        // 创建登录提示模态框
        const modal = document.createElement('div');
        modal.className = 'login-prompt-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>需要登录</h3>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="this.closest('.login-prompt-modal').remove(); window.authManager && window.authManager.signInWithGoogle()">
                            使用Google登录
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.login-prompt-modal').remove()">
                            取消
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 10000);
    }
    
    /**
     * 显示错误消息
     */
    showError(message) {
        // 创建错误提示
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="error-icon">⚠️</span>
                <span>${message}</span>
                <button class="close-btn" onclick="this.closest('.error-toast').remove()">×</button>
            </div>
        `;
        
        // 添加样式
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
        
        // 5秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }