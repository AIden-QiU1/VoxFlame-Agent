import OSS from 'ali-oss';
import dotenv from 'dotenv';
dotenv.config();

export class OssService {
    private client: OSS | null = null;
    private isConfigured: boolean = false;

    constructor() {
        const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
        const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
        const bucket = process.env.OSS_BUCKET;
        const region = process.env.OSS_REGION || 'oss-cn-hangzhou'; // Default region if not specified

        if (accessKeyId && accessKeySecret && bucket) {
            this.client = new OSS({
                region,
                accessKeyId,
                accessKeySecret,
                bucket,
                secure: true
            });
            this.isConfigured = true;
            console.log(`[OSS] Service initialized (Bucket: ${bucket}, Region: ${region})`);
        } else {
            console.warn('[OSS] Credentials missing. Service Disabled. Please set OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, and OSS_BUCKET in .env');
        }
    }

    private getConfiguredClient(): OSS {
        if (!this.isConfigured || !this.client) {
            throw new Error('OSS not configured');
        }

        return this.client;
    }

    /**
     * Generate a signed URL for uploading a file (PUT method)
     * @param filename Key (path) in the bucket
     * @param contentType MIME type of the file
     * @param expiresSeconds Expiration time in seconds (default 300)
     */
    async generateUploadUrl(filename: string, contentType: string, expiresSeconds: number = 300): Promise<string | null> {
        const client = this.getConfiguredClient();

        try {
            // signatureUrl returns a string synchronously if using v1 signatures, 
            // but the type definition or newer versions might be async or return Promise in some contexts.
            // Safe to await.
            const url = client.signatureUrl(filename, {
                method: 'PUT',
                expires: expiresSeconds,
                'Content-Type': contentType
            });
            return url;
        } catch (error) {
            console.error('[OSS] Failed to generate signature URL:', error);
            throw error;
        }
    }

    /**
     * Append text line to a file in OSS using AppendObject
     * This is efficient and suitable for logs/transcripts.
     */
    async appendTextLog(name: string, line: string): Promise<void> {
        if (!this.isConfigured || !this.client) return;

        const client = this.client;
        const content = line + '\n';
        const buf = Buffer.from(content);

        // Simple retry logic for concurrency
        for (let i = 0; i < 3; i++) {
            try {
                // 1. Get current position
                let position = '0';
                try {
                    const head = await client.head(name);
                    const headers = (head as {
                        res?: {
                            headers?: Record<string, string | number | string[] | undefined>;
                        };
                    }).res?.headers ?? {};
                    const type = headers['x-oss-object-type'];
                    if (type === 'Normal') {
                        console.warn(`[OSS] ${name} is Normal type, cannot append. Skipping.`);
                        return;
                    }
                    const nextPosition = headers['x-oss-next-append-position'];
                    position = typeof nextPosition === 'string' ? nextPosition : String(nextPosition ?? '0');
                } catch (e: unknown) {
                    if (!isOssNotFoundError(e)) throw e;
                    // File not found, position 0
                }

                // 2. Append
                await client.append(name, buf, { position });
                // Success
                return;
            } catch (e: unknown) {
                if (isOssPositionConflictError(e)) {
                    // Concurrent append happened, retry
                    console.log(`[OSS] Append position mismatch for ${name}, retrying...`);
                    continue;
                }
                console.error(`[OSS] Failed to append to ${name}:`, e);
                break;
            }
        }
    }

    /**
     * Read a text object from OSS.
     * Returns null when the object does not exist or OSS is not configured.
     */
    async getTextObject(name: string): Promise<string | null> {
        if (!this.isConfigured || !this.client) {
            return null;
        }

        const client = this.client;
        try {
            const result = await client.get(name);
            const content = result.content;

            if (typeof content === 'string') {
                return content;
            }

            if (Buffer.isBuffer(content)) {
                return content.toString('utf8');
            }

            if (content instanceof Uint8Array) {
                return Buffer.from(content).toString('utf8');
            }

            return null;
        } catch (error: unknown) {
            if (isOssNotFoundError(error)) {
                return null;
            }

            console.error(`[OSS] Failed to read ${name}:`, error);
            throw error;
        }
    }

    /**
     * Delete an object from OSS. Missing objects are treated as already deleted.
     */
    async deleteObject(name: string): Promise<void> {
        if (!this.isConfigured || !this.client) {
            return;
        }

        try {
            await this.client.delete(name);
        } catch (error: unknown) {
            if (isOssNotFoundError(error)) {
                return;
            }

            console.error(`[OSS] Failed to delete ${name}:`, error);
            throw error;
        }
    }

    /**
     * Replace an append log while preserving append-object compatibility.
     */
    async replaceTextLog(name: string, lines: string[]): Promise<void> {
        if (!this.isConfigured || !this.client) {
            return;
        }

        await this.deleteObject(name);

        for (const line of lines) {
            const normalized = line.trim();
            if (normalized) {
                await this.appendTextLog(name, normalized);
            }
        }
    }
}

export const ossService = new OssService();

function readOssErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
}

function readOssErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
}

function isOssNotFoundError(error: unknown): boolean {
    return readOssErrorStatus(error) === 404 || readOssErrorCode(error) === 'NoSuchKey';
}

function isOssPositionConflictError(error: unknown): boolean {
    return readOssErrorCode(error) === 'PositionNotEqualToLength' || readOssErrorStatus(error) === 409;
}
