const express = require('express');
const S3 = require('@aws-sdk/client-s3');
const validators = require('express-validator');
const { createArchive } = require('../util');

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
            const absPath = path.resolve(archivePath);
            const s = fs.createReadStream(absPath);
            s.pipe(res);
            s.on('close', () => {
                fs.unlinkSync(absPath);
            });
            s.on('error', err => {
                fs.unlinkSync(absPath);
                next(err);
            });
        }
    } catch (err) {
        if (fs.existsSync(archivePath))
            fs.unlinkSync(archivePath);
        if (err == 404) {
            return res.sendStatus(err);
        }
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

module.exports = router;
