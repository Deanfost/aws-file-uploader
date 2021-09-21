const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

let fileRouter = require('./routes/files');

let app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', fileRouter);

// Error handler
app.use(function(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    // Log someting
    console.error(err.stack);
    res.status(500);
    res.send('Something broke!');
});

module.exports = app;
