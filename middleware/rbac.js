// middleware/rbac.js
const roles = {
    admin: ['*'],
    accountant: [
        'create_invoice', 'view_invoices', 'view_customers', 
        'view_products', 'record_payment', 'view_reports',
        'create_product', 'view_suppliers'
    ],
    user: ['view_invoices', 'view_customers']
};

function hasPermission(role, permission) {
    if (roles[role] && roles[role].includes('*')) return true;
    return roles[role] && roles[role].includes(permission);
}

function authorize(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: "يجب تسجيل الدخول"
            });
        }

        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({
                success: false,
                error: "ليس لديك صلاحية للقيام بهذه العملية"
            });
        }

        next();
    };
}

function authorizeRole(roles_allowed) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: "يجب تسجيل الدخول"
            });
        }

        if (!roles_allowed.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: "ليس لديك صلاحية للوصول إلى هذه الخدمة"
            });
        }

        next();
    };
}

module.exports = { authorize, authorizeRole, hasPermission };
