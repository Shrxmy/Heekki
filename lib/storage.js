// Files in Neon Object Storage: the "assets" bucket declared in neon.ts. The S3 client reads AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3 and AWS_REGION from .env (pulled by `neon deploy` / `neon env pull`).
// Tests (DATABASE_URL=memory) keep files in memory instead.
const BUCKET = "assets";

function s3Store() {
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const client = new S3Client({
        forcePathStyle: true, // Neon only supports path-style addressing
        // The SDK waits forever by default; a stalled download must fail so the greeting posts without its background.
        requestHandler: { connectionTimeout: 5_000, requestTimeout: 15_000 },
    });
    return {
        put: (key, body, contentType) => client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })),
        get: async (key) => Buffer.from(await (await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))).Body.transformToByteArray()),
        remove: (key) => client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })),
    };
}

function memoryStore() {
    const files = new Map();
    return {
        put: async (key, body) => { files.set(key, Buffer.from(body)); },
        get: async (key) => { if (!files.has(key)) throw new Error(`No such file: ${key}`); return files.get(key); },
        remove: async (key) => { files.delete(key); },
    };
}

module.exports = process.env.DATABASE_URL === "memory" ? memoryStore() : s3Store();
