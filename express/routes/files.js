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
    async function (req, res, next) {
        let keyOrPrefix = req.query.key;

        // Preemptively create temp archive path
        const archivePath = path.join(process.env.TEMP_PATH, uniqid('', '.zip'));

        try {
            if (!keyOrPrefix.endsWith('/')) {
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
            } else {
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
            }
        } catch (err) {
            // Delete temp archive path as needed
            if (fs.existsSync(archivePath))
                fs.unlinkSync(archivePath);

            // Forward S3 errors
            if (err['$metadata'] && err['$metadata']['httpStatusCode'] == 404)
                err = 404;

            if (err == 404) {
                res.status(404);
                res.send('File not found');
                return;
            }
            next(err);
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
