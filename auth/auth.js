/*
|--------------------------------------------------------------------------
| JUSOOR ACCOUNTING
| Authentication Engine
|--------------------------------------------------------------------------
*/

"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CHANGE_THIS_SECRET_IN_ENV";

const JWT_EXPIRES_IN =
    process.env.JWT_EXPIRES_IN ||
    "7d";

const SALT_ROUNDS =
    Number(process.env.BCRYPT_SALT_ROUNDS) || 12;


/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

function cleanString(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        String(value).trim();

    return text || null;
}


/*
|--------------------------------------------------------------------------
| HASH PASSWORD
|--------------------------------------------------------------------------
*/

async function hashPassword(password) {

    password =
        cleanString(password);

    if (!password) {

        throw new Error(
            "كلمة المرور مطلوبة"
        );

    }

    if (password.length < 6) {

        throw new Error(
            "كلمة المرور يجب ألا تقل عن 6 أحرف"
        );

    }

    return bcrypt.hash(
        password,
        SALT_ROUNDS
    );
}


/*
|--------------------------------------------------------------------------
| VERIFY PASSWORD
|--------------------------------------------------------------------------
*/

async function verifyPassword(
    password,
    passwordHash
) {

    password =
        cleanString(password);

    passwordHash =
        cleanString(passwordHash);

    if (
        !password ||
        !passwordHash
    ) {

        return false;

    }

    return bcrypt.compare(
        password,
        passwordHash
    );

}


/*
|--------------------------------------------------------------------------
| CREATE JWT TOKEN
|--------------------------------------------------------------------------
*/

function createToken(user) {

    if (!user) {

        throw new Error(
            "بيانات المستخدم مطلوبة لإنشاء الجلسة"
        );

    }


    const userId =
        Number(
            user.id
        );


    if (
        !Number.isInteger(userId)
    ) {

        throw new Error(
            "معرف المستخدم غير صحيح"
        );

    }


    const payload = {

        sub:
            userId,

        username:
            cleanString(
                user.username
            ),

        name:
            cleanString(
                user.name
            ),

        role:
            cleanString(
                user.role
            ) || "user",

        company_id:
            user.company_id
                ? Number(
                    user.company_id
                )
                : null,

        fiscal_year_id:
            user.fiscal_year_id
                ? Number(
                    user.fiscal_year_id
                )
                : null

    };


    return jwt.sign(
        payload,
        JWT_SECRET,
        {
            expiresIn:
                JWT_EXPIRES_IN
        }
    );

}


/*
|--------------------------------------------------------------------------
| VERIFY JWT TOKEN
|--------------------------------------------------------------------------
*/

function verifyToken(token) {

    token =
        cleanString(token);

    if (!token) {

        throw new Error(
            "رمز الدخول مطلوب"
        );

    }

    return jwt.verify(
        token,
        JWT_SECRET
    );

}


/*
|--------------------------------------------------------------------------
| EXTRACT TOKEN
|--------------------------------------------------------------------------
*/

function extractToken(
    authorization
) {

    if (!authorization) {

        return null;

    }


    const value =
        String(
            authorization
        ).trim();


    if (!value) {

        return null;

    }


    /*
    |--------------------------------------------------------------------------
    | Bearer TOKEN
    |--------------------------------------------------------------------------
    */

    if (
        /^Bearer\s+/i.test(
            value
        )
    ) {

        return value
            .replace(
                /^Bearer\s+/i,
                ""
            )
            .trim();

    }


    /*
    |--------------------------------------------------------------------------
    | Allow raw token
    |--------------------------------------------------------------------------
    */

    return value;

}


/*
|--------------------------------------------------------------------------
| AUTHENTICATE REQUEST
|--------------------------------------------------------------------------
*/

function authenticateRequest(
    req
) {

    const authorization =
        req.headers.authorization;


    const token =
        extractToken(
            authorization
        );


    if (!token) {

        const error =
            new Error(
                "يجب تسجيل الدخول أولاً"
            );

        error.status = 401;

        throw error;

    }


    try {

        const decoded =
            verifyToken(
                token
            );


        req.user =
            decoded;


        return decoded;

    }
    catch (error) {

        const authError =
            new Error(
                "جلسة الدخول غير صالحة أو منتهية"
            );


        authError.status =
            401;


        throw authError;

    }

}


/*
|--------------------------------------------------------------------------
| REQUIRE ROLE
|--------------------------------------------------------------------------
*/

function requireRole(
    ...allowedRoles
) {

    return function (
        req,
        res,
        next
    ) {

        try {

            if (!req.user) {

                return res
                    .status(401)
                    .json({

                        success: false,

                        error:
                            "يجب تسجيل الدخول أولاً"

                    });

            }


            const role =
                cleanString(
                    req.user.role
                ) ||
                "user";


            if (
                allowedRoles.length > 0 &&
                !allowedRoles.includes(
                    role
                )
            ) {

                return res
                    .status(403)
                    .json({

                        success: false,

                        error:
                            "ليس لديك صلاحية لتنفيذ هذه العملية"

                    });

            }


            next();

        }
        catch (error) {

            next(error);

        }

    };

}


/*
|--------------------------------------------------------------------------
| ADMIN CHECK
|--------------------------------------------------------------------------
*/

function isAdmin(
    user
) {

    if (!user) {

        return false;

    }


    return [

        "admin",

        "administrator",

        "owner",

        "superadmin"

    ].includes(
        String(
            user.role || ""
        ).toLowerCase()
    );

}


/*
|--------------------------------------------------------------------------
| PASSWORD STRENGTH
|--------------------------------------------------------------------------
*/

function validatePasswordStrength(
    password
) {

    password =
        cleanString(password);


    const errors = [];


    if (!password) {

        errors.push(
            "كلمة المرور مطلوبة"
        );

        return errors;

    }


    if (
        password.length < 6
    ) {

        errors.push(
            "كلمة المرور يجب ألا تقل عن 6 أحرف"
        );

    }


    if (
        password.length > 128
    ) {

        errors.push(
            "كلمة المرور طويلة جداً"
        );

    }


    return errors;

}


/*
|--------------------------------------------------------------------------
| USERNAME VALIDATION
|--------------------------------------------------------------------------
*/

function validateUsername(
    username
) {

    username =
        cleanString(username);


    const errors = [];


    if (!username) {

        errors.push(
            "اسم المستخدم مطلوب"
        );

        return errors;

    }


    if (
        username.length < 3
    ) {

        errors.push(
            "اسم المستخدم يجب ألا يقل عن 3 أحرف"
        );

    }


    if (
        username.length > 50
    ) {

        errors.push(
            "اسم المستخدم طويل جداً"
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Prevent spaces
    |--------------------------------------------------------------------------
    */

    if (
        /\s/.test(username)
    ) {

        errors.push(
            "اسم المستخدم لا يجب أن يحتوي على مسافات"
        );

    }


    return errors;

}


/*
|--------------------------------------------------------------------------
| SANITIZE USER
|--------------------------------------------------------------------------
|
| مهم:
| لا نعيد password_hash إلى المتصفح.
|--------------------------------------------------------------------------
*/

function sanitizeUser(
    user
) {

    if (!user) {

        return null;

    }


    return {

        id:
            Number(
                user.id
            ),

        username:
            cleanString(
                user.username
            ),

        name:
            cleanString(
                user.name
            ),

        role:
            cleanString(
                user.role
            ) || "user",

        company_id:
            user.company_id
                ? Number(
                    user.company_id
                )
                : null,

        fiscal_year_id:
            user.fiscal_year_id
                ? Number(
                    user.fiscal_year_id
                )
                : null,

        active:
            user.active === undefined
                ? true
                : Boolean(
                    user.active
                )

    };

}


/*
|--------------------------------------------------------------------------
| CREATE SESSION
|--------------------------------------------------------------------------
*/

function createSession(
    user
) {

    const token =
        createToken(
            user
        );


    return {

        token,

        token_type:
            "Bearer",

        expires_in:
            JWT_EXPIRES_IN,

        user:
            sanitizeUser(
                user
            )

    };

}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    hashPassword,

    verifyPassword,

    createToken,

    verifyToken,

    extractToken,

    authenticateRequest,

    requireRole,

    isAdmin,

    validatePasswordStrength,

    validateUsername,

    sanitizeUser,

    createSession

};
