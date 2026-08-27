const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
*/

function hashPassword(password) {

    if (
        typeof password !== "string" ||
        password.length < 6
    ) {
        throw new Error(
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
        );
    }

    const salt =
        crypto.randomBytes(16).toString("hex");

    const hash =
        crypto
            .pbkdf2Sync(
                password,
                salt,
                120000,
                64,
                "sha512"
            )
            .toString("hex");

    return `${salt}:${hash}`;
}


function verifyPassword(
    password,
    storedPassword
) {

    if (
        !password ||
        !storedPassword
    ) {
        return false;
    }

    const parts =
        String(storedPassword).split(":");

    if (parts.length !== 2) {
        return false;
    }

    const salt = parts[0];
    const originalHash = parts[1];

    const hash =
        crypto
            .pbkdf2Sync(
                password,
                salt,
                120000,
                64,
                "sha512"
            )
            .toString("hex");

    try {

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(originalHash, "hex")
        );

    }
    catch {

        return false;

    }

}


/*
|--------------------------------------------------------------------------
| SESSION TOKEN
|--------------------------------------------------------------------------
*/

function createToken() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    hashPassword,

    verifyPassword,

    createToken

};
