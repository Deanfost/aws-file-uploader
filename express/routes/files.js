const express = require('express');
const S3 = require('@aws-sdk/client-s3');
const { query, validationResult } = require('express-validator');
const { createArchive } = require('../util');

const fs = require('fs');
const uniqid = require('uniqid');
const path = require('path');

let router = express.Router();
let s3Client = new S3.S3Client({ region: process.env.REGION });

/* GET objects list at prefix */
router.get('/',
    query('prefix').optional().notEmpty(),
    async function (req, res, next) {
        // Check request formatting
        const formatErrors = validationResult(req);
        if (!formatErrors.isEmpty()) {
            return res.status(400).json({ errors: formatErrors.array() });
        }
        let prefix = req.query.prefix;

        try {
            // Request object list from S3
            const s3Response = await s3Client.send(new S3.ListObjectsV2Command({
                Bucket: process.env.BUCKET,
                Prefix: prefix
            }));
            if (!s3Response.Contents) return res.sendStatus(404);
            
            // Only show same-depth keys
            const filtered = s3Response.Contents.filter(v => {
                const prefixLen = prefix ? prefix.length : 0;
                const withoutPrefix = v.Key.substring(prefixLen);
                const delimI = withoutPrefix.indexOf('/', 1);
                if (delimI != -1 && delimI < withoutPrefix.length - 1) return false;
                return true;
            });
            res.json(filtered);
        } catch (err) {
            next(err);
        }
    });

/* GET uploaded objects at prefix */
router.get('/objects',
    query('key').exists().bail().notEmpty(),
    async function (req, res, next) {
        // Check request formatting
        const formatErrors = validationResult(req);
        if (!formatErrors.isEmpty()) {
            return res.status(400).json({ errors: formatErrors.array() });
        }
        let keyOrPrefix = req.query.key;

        // Create archive path
        const archivePath = path.join(process.env.TEMP_PATH, uniqid('', '.zip'));

        if (!keyOrPrefix.endsWith('/')) {
            // GET single object
            try {
                // Get file stream from S3
                const response = await s3Client.send(new S3.GetObjectCommand({
                    Bucket: process.env.BUCKET,
                    Key: keyOrPrefix
                }));
                if (!response.Body) res.sendStatus(404);
                else {
                    // Set attachment header, stream to client
                    res.attachment(keyOrPrefix);
                    response.Body.pipe(res);
                }
            } catch (err) {
                if (err.message == 'NoSuchKey') return res.sendStatus(404);
                next(err);
            }
        } else {
            // GET several objects
            try {
                // Create temp archive of prefix objects
                await createArchive(keyOrPrefix, archivePath);
                const absPath = path.resolve(archivePath);
                const s = fs.createReadStream(absPath);

                // Send attachment header, stream to client
                res.attachment(path.basename(archivePath));
                s.pipe(res);

                // Pipe callbacks
                s.on('close', () => {
                    fs.unlinkSync(absPath);
                });
            } catch (err) {
                // Delete temp archive path as needed
                if (fs.existsSync(archivePath))
                    fs.unlinkSync(archivePath);
                
                // Handle createArchive() 404
                if (err.message == 404) {
                    return res.sendStatus(404);
                }
                next(err);
            }
        }
    });

/* POST a new file */
router.post('/', async function (req, res) {
    res.sendStatus(501);
});

/* DELETE a file */
router.delete('/', async function (req, res) {
    res.sendStatus(501);
});

module.exports = router;
