// Authentication Manager for Nano Banana
// Handles Google OAuth login via Supabase and user session management

class AuthManager {
    constructor() {
        // Supabase configuration
        this.supabaseUrl = 'https://gpsxrvqgnxqafftxdilc.supabase.co';
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc3hydnFnbnhxYWZmdHhkaWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTAzNjUsImV4cCI6MjA3MDkyNjM2NX0.4551Se2_DABQwQ-V-phbXZ-0w0NNi-kNT8G6SQpw49Y';
        
        // Initialize Supabase client
        this.supabase = null;
        this.user = null;
        this.session = null;
        this.userProfile = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Load Supabase client
            await this.loadSupabaseClient();
            
            // Check for existing session
            await this.checkSession();
            
            // Listen for auth state changes
            this.setupAuthListener();
            
            console.log('AuthManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AuthManager:', error);
        }
    }
    
    async loadSupabaseClient() {
        // Load Supabase client from CDN if not already loaded
        if (typeof window.supabase === 'undefined') {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js';
                script.onload = () => {
                    this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load Supabase client'));
                document.head.appendChild(script);
            });
        } else {
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
        }
    }
    
    async checkSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Error checking session:', error);
                return;
            }
            
            if (session) {
                this.session = session;
                this.user = session.user;
                await this.loadUserProfile();
                this.onAuthStateChange('SIGNED_IN', session);
            } else {
                this.onAuthStateChange('SIGNED_OUT', null);
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }
    
    setupAuthListener() {
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            
            this.session = session;
            this.user = session?.user || null;
            
            if (event === 'SIGNED_IN') {
                this.loadUserProfile();
            } else if (event === 'SIGNED_OUT') {
                this.userProfile = null;
            }
            
            this.onAuthStateChange(event, session);
        });
    }
    
    async loadUserProfile() {
        if (!this.user) return;
        
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();
            
            if (error) {
                console.error('Error loading user profile:', error);
                return;
            }
            
            this.userProfile = profile;
            console.log('User profile loaded:', profile);
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }
    
    async signInWithGoogle() {
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });
            
            if (error) {
                console.error('Google sign-in error:', error);
                throw error;
            }
            
            console.log('Google sign-in initiated');
            return { success: true, data };
        } catch (error) {
            console.error('Failed to sign in with Google:', error);
            return { success: false, error: error.message };
        }
    }
    
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('Sign out error:', error);
                throw error;
            }
            
            this.user = null;
            this.session = null;
            this.userProfile = null;
            
            console.log('User signed out successfully');
            return { success: true };
        } catch (error) {
            console.error('Failed to sign out:', error);
            return { success: false, error: error.message };
        }
    }
    
    onAuthStateChange(event, session) {
        // Notify the main app about auth state changes
        if (typeof window.app !== 'undefined' && window.app.onAuthStateChange) {
            window.app.onAuthStateChange(event, session, this.userProfile);
        }
        
        // Update UI elements
        this.updateAuthUI(event, session);
    }
    
    updateAuthUI(event, session) {
        const loginBtn = document.getElementById('loginBtn');
        const userCredits = document.getElementById('userCredits');
        
        if (event === 'SIGNED_IN' && session) {
            // Update login button to show user info
            if (loginBtn) {
                const userName = this.user?.user_metadata?.full_name || 
                               this.user?.user_metadata?.name || 
                               this.user?.email?.split('@')[0] || 
                               'User';
                
                loginBtn.innerHTML = `
                    <div class="user-dropdown">
                        <img src="${this.user?.user_metadata?.avatar_url || '/assets/default-avatar.svg'}" 
                             alt="User avatar" class="user-avatar">
                        <span class="user-name">${userName}</span>
                        <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                    </div>
                `;
                loginBtn.classList.add('logged-in');
                
                // Add dropdown functionality
                this.setupUserDropdown(loginBtn);
            }
            
            // Show user credits
            if (userCredits && this.userProfile) {
                userCredits.style.display = 'flex';
                const creditsCount = userCredits.querySelector('.credits-count');
                if (creditsCount) {
                    creditsCount.textContent = this.userProfile.credits || 0;
                }
            }
        } else if (event === 'SIGNED_OUT') {
            // Reset login button
            if (loginBtn) {
                loginBtn.innerHTML = 'Sign In';
                loginBtn.classList.remove('logged-in');
                loginBtn.onclick = () => this.signInWithGoogle();
            }
            
            // Hide user credits
            if (userCredits) {
                userCredits.style.display = 'none';
            }
        }
    }
    
    setupUserDropdown(loginBtn) {
        // Remove existing dropdown
        const existingDropdown = document.querySelector('.user-dropdown-menu');
        if (existingDropdown) {
            existingDropdown.remove();
        }
        
        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown-menu';
        dropdown.innerHTML = `
            <div class="dropdown-item" data-action="profile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Profile
            </div>
            <div class="dropdown-item" data-action="history">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="9" cy="9" r="2"></circle>
                    <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                </svg>
                My Images
            </div>
            <div class="dropdown-item" data-action="billing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Billing
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" data-action="logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16,17 21,12 16,7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign Out
            </div>
        `;
        
        // Position dropdown
        dropdown.style.position = 'absolute';
        dropdown.style.top = '100%';
        dropdown.style.right = '0';
        dropdown.style.zIndex = '1000';
        dropdown.style.display = 'none';
        
        // Add to DOM
        loginBtn.style.position = 'relative';
        loginBtn.appendChild(dropdown);
        
        // Toggle dropdown on click
        loginBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        
        // Handle dropdown actions
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.closest('.dropdown-item')?.dataset.action;
            
            if (action) {
                dropdown.style.display = 'none';
                this.handleDropdownAction(action);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });
    }
    
    handleDropdownAction(action) {
        switch (action) {
            case 'profile':
                this.showProfile();
                break;
            case 'history':
                this.showImageHistory();
                break;
            case 'billing':
                this.showBilling();
                break;
            case 'logout':
                this.signOut();
                break;
        }
    }
    
    showProfile() {
        if (window.userManager) {
            window.userManager.showProfile();
        } else {
            console.log('UserManager not available');
            alert('Profile page coming soon!');
        }
    }
    
    showImageHistory() {
        if (window.userManager) {
            window.userManager.showGenerationHistory();
        } else {
            console.log('UserManager not available');
            alert('Image history coming soon!');
        }
    }
    
    showBilling() {
        if (window.userManager) {
            window.userManager.showSubscriptionManagement();
        } else {
            console.log('UserManager not available');
            alert('Billing page coming soon!');
        }
    }
    
    // Utility methods
    isAuthenticated() {
        return !!this.user && !!this.session;
    }
    
    getUser() {
        return this.user;
    }
    
    getUserProfile() {
        return this.userProfile;
    }
    
    getCredits() {
        return this.userProfile?.credits || 0;
    }
    
    async refreshUserProfile() {
        if (this.isAuthenticated()) {
            await this.loadUserProfile();
        }
    }
    
    // Method to update credits after generation
    async updateCreditsAfterGeneration(creditsUsed = 1) {
        if (!this.userProfile) return;
        
        // Optimistically update local state
        this.userProfile.credits = Math.max(0, this.userProfile.credits - creditsUsed);
        
        // Update UI
        const creditsCount = document.querySelector('.credits-count');
        if (creditsCount) {
            creditsCount.textContent = this.userProfile.credits;
        }
        
        // Refresh from server to ensure accuracy
        setTimeout(() => {
            this.refreshUserProfile();
        }, 1000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}