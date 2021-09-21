const S3 = require('@aws-sdk/client-s3');
const Archiver = require('archiver');
const fs = require('fs');
const path = require('path');

let s3Client = new S3.S3Client({region: process.env.REGION});

// Archive a prefix (folder) and its objects
async function createArchive(rootPrefix, archivePath) {
    return new Promise(async (resolve, reject) => {
        const output = fs.createWriteStream(archivePath);
        const archive = Archiver('zip', {
            zlib: { level: 9 }
        });

        let caughtErr = null;

        // Catch archiver errors
        archive.on('error', err => {
            // Don't do anything at this point
            if (caughtErr) return;

            archive.abort();
            caughtErr = err;
        });

        // Catch archiver warnings
        archive.on('warning', err => {
            // Don't do anything at this point
            if (caughtErr) return;

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

        try {
            // Find all keys within the prefix (folder)
            const keysResponse = await s3Client.send(new S3.ListObjectsV2Command({
                Bucket: process.env.BUCKET,
                Prefix: rootPrefix
            }));
            if (!keysResponse.Contents) return reject(404);
            let keys = keysResponse.Contents.map(obj => obj.Key);

            // Collect streams for files, ignore prefixes
            keys = keys.filter(key => !key.endsWith('/'));
            const streamPromises = keys.map(key => {
                return s3Client.send(new S3.GetObjectCommand({
                    Bucket: process.env.BUCKET,
                    Key: key
                }));
            });
            const s3KeyResponses = await Promise.all(streamPromises);

            // Add S3 streams to archiver
            s3KeyResponses.forEach((s, i) => {
                const relativePath = keys[i].substring(rootPrefix.length);
                archive.append(s.Body, { name: relativePath });
            });
            if (!caughtErr) await archive.finalize();
        } catch (err) {
            caughtErr = err;
            archive.abort();
        }        
    });
}

module.exports = { createArchive };
