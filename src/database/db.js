const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is not configured"
    );
}

const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
});

async function query(text, params = []) {

    return pool.query(
        text,
        params
    );

}

async function transaction(callback) {

    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");

        const result =
            await callback(client);

        await client.query("COMMIT");

        return result;

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();

    }

}

module.exports = {
    pool,
    query,
    transaction
};
