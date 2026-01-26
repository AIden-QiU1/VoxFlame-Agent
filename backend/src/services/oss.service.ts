import OSS from 'ali-oss';
import dotenv from 'dotenv';
dotenv.config();

export class OssService {
    private client: OSS;
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
            // Create a dummy client to avoid startup crash, but methods will throw or fail
            this.client = new OSS({
                accessKeyId: 'dummy',
                accessKeySecret: 'dummy',
                bucket: 'dummy',
                region: 'oss-cn-hangzhou'
            });
        }
    }

    /**
     * Generate a signed URL for uploading a file (PUT method)
     * @param filename Key (path) in the bucket
     * @param contentType MIME type of the file
     * @param expiresSeconds Expiration time in seconds (default 300)
     */
    async generateUploadUrl(filename: string, contentType: string, expiresSeconds: number = 300): Promise<string | null> {
        if (!this.isConfigured) {
            throw new Error('OSS not configured');
        }

        try {
            // signatureUrl returns a string synchronously if using v1 signatures, 
            // but the type definition or newer versions might be async or return Promise in some contexts.
            // Safe to await.
            const url = this.client.signatureUrl(filename, {
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
        if (!this.isConfigured) return;

        const content = line + '\n';
        const buf = Buffer.from(content);

        // Simple retry logic for concurrency
        for (let i = 0; i < 3; i++) {
            try {
                // 1. Get current position
                let position = '0';
                try {
                    const head = await this.client.head(name);
                    const headers = head.res.headers as any;
                    const type = headers['x-oss-object-type'];
                    if (type === 'Normal') {
                        console.warn(`[OSS] ${name} is Normal type, cannot append. Skipping.`);
                        return;
                    }
                    position = headers['x-oss-next-append-position'];
                } catch (e: any) {
                    if (e.status !== 404) throw e;
                    // File not found, position 0
                }

                // 2. Append
                await this.client.append(name, buf, { position });
                // Success
                return;
            } catch (e: any) {
                if (e.code === 'PositionNotEqualToLength' || e.status === 409) {
                    // Concurrent append happened, retry
                    console.log(`[OSS] Append position mismatch for ${name}, retrying...`);
                    continue;
                }
                console.error(`[OSS] Failed to append to ${name}:`, e);
                break;
            }
        }
    }
}

export const ossService = new OssService();
