let express = require('express');
let S3 = require('@aws-sdk/client-s3');
let router = express.Router();
let s3Client = new S3.S3Client({region: process.env.REGION});

/* GET uploaded files */
router.get('/', function(req, res) {
    res.send('region: ' + process.env.REGION);
});

/* POST a new file */
router.post('/', function(req, res) {
    res.sendStatus(501);
});

/* DELETE a file */
router.delete('/', function(req, res) {
    res.sendStatus(501);
});

module.exports = router;
