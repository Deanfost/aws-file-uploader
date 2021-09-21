const S3 = require('@aws-sdk/client-s3');
const Archiver = require('archiver');
const fs = require('fs');
const path = require('path');

let s3Client = new S3.S3Client({region: process.env.REGION});

// Recursively archive a prefix (folder) and its objects
async function createArchive(key, archivePath) {
    return new Promise(async (resolve, reject) => {
        const output = fs.createWriteStream(archivePath);
        const archive = Archiver('zip', {
            zlib: { level: 9 }
        });

        // Recursive function that appends S3 file streams to archive
        const archiveKey = async (rootKey, relativePath, stream=null) => {
            if (stream) {
                // Append file stream to archiver
                archive.append(stream, { name: relativePath });
                console.log("Appended: " + relativePath);
                return;
            }
    
            try {
                // Find all keys within the prefix (folder)
                const keysResponse = await s3Client.send(new S3.ListObjectsV2Command({
                    Bucket: process.env.BUCKET,
                    Prefix: rootKey
                }));
                if (!keysResponse.Contents) return reject(404);
                let keys = keysResponse.Contents.map(obj => obj.Key);
    
                // Categorize keys and collect stream if a file
                const streamPromises = keys.map(key => {
                    if (key.endsWith('/')) return 'folder';
                    const stream = s3Client.send(new S3.GetObjectCommand({
                        Bucket: process.env.BUCKET,
                        Key: key
                    }));
                    return stream;
                });
                const s3KeyObjects = await Promise.all(streamPromises);
    
                // Append file stream or keep drilling
                const archivePromises = s3KeyObjects.map((obj, i) => {
                    const basename = path.basename(keys[i]);
                    const newRelative = path.join(relativePath, basename);
                    if (obj != 'folder') {
                        return archiveKey(basename, newRelative, obj);
                    } else {
                        return archiveKey(basename, newRelative);
                    }
                });
                const results = await Promise.allSettled(archivePromises);
                console.log(results);
            } catch (err) {
                throw err;
            }
        }

        let caughtErr = null;

        // Catch archiver errors
        archive.on('error', err => {
            archive.abort();
            caughtErr = err;
        });

        // Catch archiver warnings
        archive.on('warning', err => {
            if (err == 'ENOENT') {
                console.warn(err);
            } else {
                archive.abort();
                caughtErr = err;
            }
        });

        // All archive data has been written to file
        output.on('close', () => {
            if (caughtErr) return reject(caughtErr);
            resolve();
        });
    
        // Direct archiver to temp path
        archive.pipe(output);

        // Archive all relevant objects
        await archiveKey(key, '');
        archive.finalize();
    });

    // Create archive
    // APPEND THE S3 STREAMS TO THE ARCHIVER
    // Don't forget to append those objects under a dir in the archive somehow 
    // WHAT TO DO IF ONE OF THE STREAMS FAILS? HOW TO CATCH THAT? (caught by Archiver error probably)
    // DON'T FORGET TO CLOSE ALL STREAMS IF ONE FAILS (can happen after archiver finalized, or while still collecting streams)
    // may have to collect all streams into a list just for this purpose
}

module.exports = { createArchive };
