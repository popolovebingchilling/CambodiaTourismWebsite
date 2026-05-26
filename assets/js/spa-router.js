(function() {
    // 1. Initialize variables
    const globalStylesheets = [
        'style.css', 
        'theme.css', 
        'bootstrap.css', 
        'all.min.css', 
        'bootstrap-icons.min.css', 
        'swiper-bundle.min.css', 
        'aos.css'
    ];

    let trackedListeners = [];
    let isTracking = false;

    // 2. Intercept addEventListener to clear page-specific listeners
    const originalWindowAddEventListener = window.addEventListener;
    const originalDocumentAddEventListener = document.addEventListener;

    window.addEventListener = function(type, listener, options) {
        if (isTracking) {
            trackedListeners.push({ target: window, type, listener, options });
            
            // Execute 'load' listeners immediately if document is already loaded
            if (type === 'load' && document.readyState === 'complete') {
                setTimeout(listener, 0);
            }
        }
        return originalWindowAddEventListener.call(window, type, listener, options);
    };

    document.addEventListener = function(type, listener, options) {
        if (isTracking) {
            trackedListeners.push({ target: document, type, listener, options });
            
            // Execute 'DOMContentLoaded' listeners immediately if document is already loaded
            if (type === 'DOMContentLoaded' && document.readyState !== 'loading') {
                setTimeout(listener, 0);
            }
        }
        return originalDocumentAddEventListener.call(document, type, listener, options);
    };

    function clearPageSpecificListeners() {
        trackedListeners.forEach(({ target, type, listener, options }) => {
            target.removeEventListener(type, listener, options);
        });
        trackedListeners = [];
    }

    // 3. Loading bar UI
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: var(--secondary-color, #ffc107);
        z-index: 99999;
        width: 0%;
        transition: width 0.3s ease, opacity 0.3s ease;
        opacity: 0;
        pointer-events: none;
    `;
    
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(progressBar);
    });

    function startLoading() {
        if (!document.body.contains(progressBar)) document.body.appendChild(progressBar);
        progressBar.style.opacity = '1';
        progressBar.style.width = '0%';
        setTimeout(() => {
            if (progressBar.style.opacity === '1') {
                progressBar.style.width = '70%';
            }
        }, 50);
    }

    function stopLoading() {
        progressBar.style.width = '100%';
        setTimeout(() => {
            progressBar.style.opacity = '0';
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 300);
        }, 200);
    }

    // 4. Update Header State
    function updateHeader(url) {
        let path = url.split('/').pop().split('?')[0].split('#')[0] || 'index.html';
        if (path === '') path = 'index.html';

        // Update active nav links
        const navLinks = document.querySelectorAll('header a.nav-link, header a.dropdown-item');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === path) {
                link.classList.add('active');
                const parentDropdown = link.closest('.dropdown');
                if (parentDropdown) {
                    const toggle = parentDropdown.querySelector('.dropdown-toggle');
                    if (toggle) toggle.classList.add('active');
                }
            } else {
                link.classList.remove('active');
            }
        });
        
        // Remove active from all dropdown toggles that don't have an active child
        document.querySelectorAll('header .dropdown').forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const hasActiveChild = dropdown.querySelector('.dropdown-item.active');
            if (toggle && !hasActiveChild) {
                toggle.classList.remove('active');
            }
        });

        // Close collapse menu if open
        const navbarCollapse = document.getElementById('navbarNav');
        if (navbarCollapse && navbarCollapse.classList.contains('show')) {
            if (window.bootstrap && bootstrap.Collapse) {
                const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse) || new bootstrap.Collapse(navbarCollapse);
                bsCollapse.hide();
            } else {
                navbarCollapse.classList.remove('show');
            }
        }

        // Authentication state UI (Register button vs Avatar)
        const isHomepage = (path === 'index.html' || path === '');
        const registerBtn = document.getElementById('header-register-btn');
        const profileAvatar = document.getElementById('header-profile-avatar');
        const hasRegistered = localStorage.getItem('userFullName') || localStorage.getItem('userEmail');

        if (isHomepage && !hasRegistered) {
            if (registerBtn) registerBtn.setAttribute('style', 'display: inline-block !important;');
        } else {
            if (registerBtn) registerBtn.setAttribute('style', 'display: none !important;');
        }

        if (hasRegistered) {
            if (profileAvatar) profileAvatar.setAttribute('style', 'display: flex !important;');
        } else {
            if (profileAvatar) profileAvatar.setAttribute('style', 'display: none !important;');
        }
    }

    // 5. Navigate
    async function navigateTo(url, pushState = true) {
        startLoading();

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // --- History ---
            if (pushState) {
                history.pushState(null, '', url);
            }
            document.title = doc.title;

            // --- Header UI ---
            updateHeader(url);

            // --- Stylesheets ---
            const currentHead = document.head;
            
            // Remove previous page-specific stylesheets
            Array.from(currentHead.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    const isGlobal = globalStylesheets.some(globalName => href.includes(globalName));
                    if (!isGlobal) {
                        link.remove();
                    }
                }
            });

            // Add new page-specific stylesheets
            Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    const isGlobal = globalStylesheets.some(globalName => href.includes(globalName));
                    if (!isGlobal) {
                        // Check if not already in head
                        if (!currentHead.querySelector(`link[href="${href}"]`)) {
                            const newLink = document.createElement('link');
                            newLink.rel = 'stylesheet';
                            newLink.href = href;
                            currentHead.appendChild(newLink);
                        }
                    }
                }
            });

            // --- Body ---
            const currentHeader = document.querySelector('header');
            
            // Remove everything except header, progress bar, and scripts
            Array.from(document.body.children).forEach(el => {
                if (el !== currentHeader && el !== progressBar && el.tagName !== 'SCRIPT') {
                    el.remove();
                }
            });

            // Clear previous event listeners before running new scripts
            clearPageSpecificListeners();

            // Append new children
            Array.from(doc.body.children).forEach(el => {
                if (el.tagName !== 'HEADER' && el.tagName !== 'SCRIPT') {
                    document.body.appendChild(el);
                }
            });

            window.scrollTo(0, 0);
            stopLoading();

            // --- Execute Scripts ---
            isTracking = true; // Start tracking new listeners
            
            // Execute the inline scripts sequentially
            const scriptsToRun = Array.from(doc.body.querySelectorAll('script')).filter(s => !s.hasAttribute('src'));
            
            scriptsToRun.forEach(oldScript => {
                const code = oldScript.textContent;
                if (code.trim()) {
                    let processedCode = code;
                    // Replace const and let with var to prevent redeclaration errors on subsequent visits
                    processedCode = processedCode.replace(/\\bconst\\s+/g, 'var ');
                    processedCode = processedCode.replace(/\\blet\\s+/g, 'var ');
                    
                    try {
                        (0, eval)(processedCode);
                    } catch (e) {
                        console.error('Error executing script from ' + url + ':', e);
                    }
                }
            });

            isTracking = false;

            // Re-initialize AOS if available
            if (window.AOS) {
                AOS.refreshHard();
                AOS.init({ duration: 1000, once: true });
            }

        } catch (error) {
            console.error('Error fetching page:', error);
            stopLoading();
            // Fallback to normal navigation if fetch fails
            window.location.href = url;
        }
    }

    // 6. Bind Events
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href && link.origin === window.location.origin) {
            const path = link.getAttribute('href');
            // Allow default behavior for external links, anchor links, JS links, and non-html files
            if (path && !path.startsWith('#') && !path.startsWith('javascript:') && path.endsWith('.html')) {
                // Ignore target="_blank"
                if (link.getAttribute('target') === '_blank') return;
                
                e.preventDefault();
                navigateTo(link.href, true);
            }
        }
    });

    window.addEventListener('popstate', () => {
        navigateTo(window.location.href, false);
    });
    
})();
