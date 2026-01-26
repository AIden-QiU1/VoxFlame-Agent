import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in backend/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'voice-contributions';

async function clearBucket() {
    console.log(`🚀 Starting cleanup for bucket: ${BUCKET}`);

    try {
        // 1. List valid folders (user_ids)
        const { data: rootItems, error: listError } = await supabase
            .storage
            .from(BUCKET)
            .list();

        if (listError) throw listError;
        if (!rootItems || rootItems.length === 0) {
            console.log('✅ Bucket is already empty.');
            return;
        }

        console.log(`Found ${rootItems.length} items/folders in root.`);

        for (const item of rootItems) {
            // If it's a folder (no id usually implies folder in some contexts, strictly we should assume it is a prefix)
            // We will list contents for each item treating it as a folder
            const prefix = item.name;

            console.log(`Scanning folder: ${prefix}...`);

            const { data: files, error: fileError } = await supabase
                .storage
                .from(BUCKET)
                .list(prefix, { limit: 100 });

            if (fileError) {
                console.warn(`Failed to list ${prefix}:`, fileError.message);
                continue;
            }

            if (files && files.length > 0) {
                const paths = files.map(f => `${prefix}/${f.name}`);
                console.log(`  - Deleting ${paths.length} files...`);
                const { error: delError } = await supabase
                    .storage
                    .from(BUCKET)
                    .remove(paths);

                if (delError) console.error(`  ❌ Delete failed:`, delError.message);
            }

            // Also try to remove the item itself if it was a file in root
            await supabase.storage.from(BUCKET).remove([prefix]);
        }

        console.log('✅ Cleanup finished (1-level depth scan). Run again if nested deeper.');

    } catch (error: any) {
        console.error('❌ Unexpected error:', error.message);
    }
}

clearBucket();
