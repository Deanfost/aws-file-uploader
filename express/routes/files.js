const express = require('express');
const S3 = require('@aws-sdk/client-s3');
const validators = require('express-validator');
const archiver = require('archiver');
const fs = require('fs');
const uniqid = require('uniqid');
const path = require('path');

let router = express.Router();
let s3Client = new S3.S3Client({region: process.env.REGION});
let query = validators.query;

/* GET objects list at prefix */
router.get('/', 
    query('prefix').optional().notEmpty(), 
    async function(req, res, next) {
    let prefix = req.query.prefix;

    try {
        // Request object list from S3
        const s3Response = await s3Client.send(new S3.ListObjectsV2Command({
            Bucket: process.env.BUCKET,
            Prefix: prefix
        }));
        res.send(s3Response.Contents);
    } catch (err) {
        next(err);
    }
});

/* GET uploaded objects at prefix */
router.get('/objects', 
    query('key').exists().notEmpty(), 
    async function(req, res, next) {
    let key = req.query.key;

    // Preemptively create temp archive path
    const archivePath = path.join(process.env.TEMP_PATH, uniqid('', '.zip'));

    try {
        if (!key.endsWith('/')) {
            // Get file stream from S3
            const data = await s3Client.send(new S3.GetObjectCommand({
                Bucket: process.env.BUCKET,
                Key: key
            }));
            if (!data.Body) res.sendStatus(404);
            else {
                // Set attachment header, stream to client
                res.attachment(key);
                data.Body.pipe(res);
            }
        } else {
            // Create and send a temp archive of objects
            await createArchive(key, archivePath);
            res.download(path.resolve(archivePath), err => {
                fs.unlinkSync(archivePath);
                if (err) next(err);
            });
        }
    } catch (err) {
        if (fs.existsSync(archivePath))
            fs.unlinkSync(archivePath);
        next(err);
    }
});

/* POST a new file */
router.post('/', async function(req, res) {
    res.sendStatus(501);
});

/* DELETE a file */
router.delete('/', async function(req, res) {
    res.sendStatus(501);
});

// Recursively archive a prefix and its objects
async function createArchive(key, archivePath) {
    return new Promise(async (resolve, reject) => {
        let openS3Streams = [];

        // Recursive archiving function
        const archiveKey = async (key, relativeKey, stream=null) => {
            if (!key.endsWith('/')) {
                // Append file stream to archiver
                archive.append(stream, { name: relativeKey });
                return;
            }
    
            try {
                // Find all keys within the prefix (folder)
                const keysResponse = await s3Client.send(new S3.ListObjectsV2Command({
                    Bucket: process.env.Bucket,
                    Prefix: prefix
                }));
                if (!keysResponse.Contents) res.sendStatus(404);
                let keys = keysResponse.Contents.map(obj => obj.Key);
    
                // Collect streams for each key
                const streamPromises = keys.map(key => {
                    return s3Client.send(new S3.GetObjectCommand({
                        Bucket: process.env.BUCKET,
                        Key: key
                    }));
                });
                // TODO: this needs to be changed to close streams 
                // (right now the streams that DID make it won't be closed since they aren't added to any list to be closed)
                const s3Streams = await Promise.all(streamPromises);
                s3Streams.forEach(s => openS3Streams.append(s));
    
                // Append file stream or keep drilling
                const archivePromises = s3Streams.map((stream, i) => {
                    return archiveKey(key[i], path.basename(key[i]), stream)
                });

                // TODO: see above
                await Promise.all(streamPromises);


            } catch (err) {
                openS3Streams.forEach(s => s.destroy());
                throw err;
            }
        }

        const output = fs.createWriteStream(archivePath);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        // Catch archiver errors
        archive.on('error', e => {
            openS3Streams.forEach(s => s.destroy());
            reject(e);
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

module.exports = router;
