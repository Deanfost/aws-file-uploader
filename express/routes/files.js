let express = require('express');
let S3 = require('@aws-sdk/client-s3');
let router = express.Router();
let s3Client = new S3.S3Client({region: process.env.REGION});

/* GET objects list at prefix */
router.get('/', acceptQueryParams(['prefix']), async function(req, res, next) {
    let prefix = req.query.prefix ? req.query.prefix : '.';

    // Configure S3 command
    const bucketParams = {
        Bucket: process.env.BUCKET,
        Prefix: prefix
    };

    try {
        // Request object list from S3
        const s3Response = await s3Client.send(new S3.ListObjectsV2Command(bucketParams));
        res.send(s3Response.Contents);
    } catch (err) {
        next(err);
    }
});

/* GET uploaded objects at prefix */
router.get('/objects', acceptQueryParams([]), async function(req, res, next) {
    res.sendStatus(501);
});

/* POST a new file */
router.post('/', async function(req, res) {
    res.sendStatus(501);
});

/* DELETE a file */
router.delete('/', async function(req, res) {
    res.sendStatus(501);
});


/* Middleware */

// Only allow these query params to be present
function acceptQueryParams(params) {
    return (req, res, next) => {
        // Throw 400 if invalid query params
        let queries = req.query;
        for (q in queries) {
            if (!params.includes(q)) {
                res.status(400);
                return res.send('Malformed request, check query params');
            }
        }
        next();
    };
};

module.exports = router;
