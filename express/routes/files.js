var express = require('express');
var router = express.Router();

/* GET uploaded files */
router.get('/', function(req, res) {
    res.sendStatus(501);
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
