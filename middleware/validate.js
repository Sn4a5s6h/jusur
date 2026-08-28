// middleware/validate.js
const Joi = require('joi');

// مخططات التحقق
const schemas = {
    login: Joi.object({
        username: Joi.string().required().min(3).max(50),
        password: Joi.string().required().min(6)
    }),
    
    register: Joi.object({
        username: Joi.string().required().min(3).max(50),
        password: Joi.string().required().min(6),
        name: Joi.string().max(100),
        role: Joi.string().valid('admin', 'user', 'accountant').default('user')
    }),
    
    customer: Joi.object({
        name: Joi.string().required().max(100),
        phone: Joi.string().max(20).allow(null, ''),
        address: Joi.string().max(200).allow(null, ''),
        notes: Joi.string().max(500).allow(null, '')
    }),
    
    supplier: Joi.object({
        name: Joi.string().required().max(100),
        phone: Joi.string().max(20).allow(null, ''),
        address: Joi.string().max(200).allow(null, ''),
        notes: Joi.string().max(500).allow(null, '')
    }),
    
    product: Joi.object({
        name: Joi.string().required().max(100),
        unit: Joi.string().max(20).default('قطعة'),
        sale_price: Joi.number().min(0).default(0),
        cost_price: Joi.number().min(0).default(0),
        stock: Joi.number().min(0).default(0)
    }),
    
    invoice: Joi.object({
        customer: Joi.string().required(),
        customer_phone: Joi.string().allow(null, ''),
        items: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                qty: Joi.number().positive().required(),
                price: Joi.number().min(0).required(),
                unit: Joi.string().default('قطعة')
            })
        ).min(1).required(),
        type: Joi.string().valid('cash', 'credit').default('cash'),
        due_date: Joi.date().allow(null),
        discount: Joi.number().min(0).default(0),
        tax: Joi.number().min(0).default(0),
        paid: Joi.number().min(0).default(0),
        payment_method: Joi.string().valid('cash', 'bank', 'cheque').default('cash')
    }),
    
    purchase: Joi.object({
        supplier: Joi.string().required(),
        items: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                qty: Joi.number().positive().required(),
                price: Joi.number().min(0).required(),
                unit: Joi.string().default('قطعة')
            })
        ).min(1).required(),
        type: Joi.string().valid('cash', 'credit').default('cash'),
        due_date: Joi.date().allow(null),
        discount: Joi.number().min(0).default(0),
        tax: Joi.number().min(0).default(0)
    }),
    
    payment: Joi.object({
        invoiceId: Joi.number().integer().positive().required(),
        amount: Joi.number().positive().required(),
        method: Joi.string().valid('cash', 'bank', 'cheque').default('cash'),
        reference: Joi.string().allow(null, '')
    })
};

function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map(e => e.message)
            });
        }

        req.body = value;
        next();
    };
}

module.exports = { validate, schemas };
