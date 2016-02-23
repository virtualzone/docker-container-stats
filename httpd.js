var DB_FILE = 'db/netstats.db';

var sqlite3 = require('sqlite3');
var bodyParser = require('body-parser');
var exec = require('child_process').execFileSync;
var moment = require('moment');
var express = require("express");

var app = express();
var db = new sqlite3.Database(DB_FILE);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("html"));

app.get("/rs/containers/get", function(req, res) {
    db.all("SELECT * FROM containers ORDER BY name, id ASC", function(err, rows) {
        res.json(rows);
    });
});

app.get("/rs/container/:id/stats/latest", function(req, res) {
    db.all("SELECT * FROM stats WHERE id = ? ORDER BY ts DESC LIMIT 5", req.params.id, function(err, rows) {
        res.json(rows);
    });
});

app.get("/rs/container/:id/:chart", function(req, res) {
    var chart = req.params.chart;
    if (!/^(net_in|net_out|block_in|block_out|mem)$/.test(chart)) {
        return res.json([]);
    };
    db.all("SELECT ts, "+chart+" FROM stats WHERE id = ? ORDER BY ts ASC", req.params.id, function(err, rows) {
        var json = [['Time', 'Bytes']];
        var prev = 0;
        for (var i=0; i<rows.length; i++) {
            json.push([rows[i].ts, (!rows[i][chart] ? prev : rows[i][chart])]);
            if (rows[i][chart]) prev = rows[i][chart];
        }
        res.json(json);
    });
});

app.listen(8080, function() {

});