// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// حد الطلبات لتسجيل الدخول
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 5,
    message: {
        success: false,
        error: "محاولات تسجيل دخول كثيرة، حاول مرة أخرى بعد 15 دقيقة"
    },
    standardHeaders: true,
    legacyHeaders: false
});

// حد الطلبات العام للـ API
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // دقيقة واحدة
    max: 100,
    message: {
        success: false,
        error: "عدد الطلبات كبير جداً، حاول مرة أخرى بعد دقيقة"
    },
    standardHeaders: true,
    legacyHeaders: false
});

// حد الطلبات للمسارات الحساسة
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 1000, // دقيقة واحدة
    max: 10,
    message: {
        success: false,
        error: "عدد الطلبات كبير جداً لهذه الخدمة"
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { authLimiter, apiLimiter, sensitiveLimiter };
