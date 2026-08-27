const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CHANGE_THIS_JWT_SECRET_IN_ENV";

const JWT_EXPIRES_IN =
    process.env.JWT_EXPIRES_IN ||
    "12h";


/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
*/

async function hashPassword(password) {

    if (
        typeof password !== "string" ||
        password.length < 8
    ) {
        throw new Error(
            "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
        );
    }

    return bcrypt.hash(password, 12);
}


async function verifyPassword(
    password,
    passwordHash
) {

    if (
        typeof password !== "string" ||
        typeof passwordHash !== "string"
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
| JWT
|--------------------------------------------------------------------------
*/

function createToken(user) {

    if (!user || !user.id) {
        throw new Error(
            "بيانات المستخدم غير صحيحة"
        );
    }

    return jwt.sign(
        {
            sub: Number(user.id),

            username:
                user.username || null,

            role:
                user.role || "user",

            company_id:
                user.company_id
                    ? Number(user.company_id)
                    : null,

            financial_year_id:
                user.financial_year_id
                    ? Number(user.financial_year_id)
                    : null
        },

        JWT_SECRET,

        {
            expiresIn:
                JWT_EXPIRES_IN
        }
    );
}


function verifyToken(token) {

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
| AUTHORIZATION HEADER
|--------------------------------------------------------------------------
*/

function getTokenFromRequest(req) {

    const header =
        req.headers.authorization;

    if (
        !header ||
        !header.startsWith("Bearer ")
    ) {
        return null;
    }

    return header
        .slice(7)
        .trim();
}


/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
|--------------------------------------------------------------------------
*/

function authenticate(req, res, next) {

    try {

        const token =
            getTokenFromRequest(req);

        if (!token) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "يجب تسجيل الدخول أولاً"

                });

        }

        const user =
            verifyToken(token);

        req.user =
            user;

        next();

    }
    catch (error) {

        return res
            .status(401)
            .json({

                success: false,

                error:
                    "جلسة الدخول غير صالحة أو منتهية"

            });

    }
}


/*
|--------------------------------------------------------------------------
| ROLE MIDDLEWARE
|--------------------------------------------------------------------------
*/

function requireRole(...roles) {

    return (req, res, next) => {

        if (
            !req.user
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "يجب تسجيل الدخول أولاً"

                });

        }

        if (
            !roles.includes(
                req.user.role
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

    };
}


/*
|--------------------------------------------------------------------------
| CONFIGURATION CHECK
|--------------------------------------------------------------------------
*/

function isJwtConfigured() {

    return Boolean(
        process.env.JWT_SECRET
    );

}


module.exports = {

    hashPassword,

    verifyPassword,

    createToken,

    verifyToken,

    getTokenFromRequest,

    authenticate,

    requireRole,

    isJwtConfigured

};
