var DB_FILE = 'db/stats.db';

var sqlite3 = require('sqlite3');
var bodyParser = require('body-parser');
var exec = require('child_process').execFileSync;
var moment = require('moment');
var express = require("express");

var app = express();
var db = new sqlite3.Database(DB_FILE);

var isValidChart = function(s) {
    return /^(net_in|net_out|block_in|block_out|mem)$/.test(s);
};

var isValidZoom = function(s) {
    return /^(hour|day|week|month)$/.test(s);
};

var getMinDate = function(zoom) {
    var now = moment();
    now.subtract(1, zoom + 's');
    return now.format('YYYY-MM-DD HH:mm:ss');
};

var processPreResult = function(result, containers, preResult) {
    var timestamps = [];
    var ts;
    for (ts in preResult) {
        timestamps.push(ts);
    }
    timestamps.sort();
    for (var k=0; k<timestamps.length; k++) {
        ts = timestamps[k];
        result.push([ts]);
        for (var i=0; i<containers.length; i++) {
            result[k+1].push(preResult[ts][containers[i].id] ? preResult[ts][containers[i].id] : 0);
        }
    }
};

var processNextContainer = function(result, preResult, containers, j, minDate, chart, res) {
    var id = containers[j].id;
    var name = containers[j].name;
    result[0].push(name ? name : id);
    db.all("SELECT ts, "+chart+" FROM stats WHERE id = ? AND ts >= ? ORDER BY ts ASC", id, minDate, function(err, rows) {
        var prev = 0;
        for (var i=0; i<rows.length; i++) {
            if (!preResult.hasOwnProperty(rows[i].ts)) {
                preResult[rows[i].ts] = {};
            }
            preResult[rows[i].ts][id] = (!rows[i][chart] ? prev : rows[i][chart]);
            if (rows[i][chart]) prev = rows[i][chart];
        }
        if (j == containers.length-1) {
            processPreResult(result, containers, preResult);
            res.json(result);
        } else {
            processNextContainer(result, preResult, containers, j+1, minDate, chart, res);
        }
    });
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("html"));

app.get("/rs/containers/get", function(req, res) {
    db.all("SELECT * FROM containers ORDER BY name ASC", function(err, rows) {
        res.json(rows);
    });
});

app.get("/rs/container/:id/stats/latest", function(req, res) {
    db.all("SELECT * FROM stats WHERE id = ? ORDER BY ts DESC LIMIT 5", req.params.id, function(err, rows) {
        res.json(rows);
    });
});

app.get("/rs/container/:id/:chart/:zoom", function(req, res) {
    var chart = req.params.chart;
    var zoom = req.params.zoom;
    if (!isValidChart(chart) || !isValidZoom(zoom)) {
        return res.json([]);
    }
    var minDate = getMinDate(zoom);
    db.all("SELECT ts, "+chart+" FROM stats WHERE id = ? AND ts >= ? ORDER BY ts ASC", req.params.id, minDate, function(err, rows) {
        var json = [['Time', 'Bytes']];
        var prev = 0;
        for (var i=0; i<rows.length; i++) {
            json.push([rows[i].ts, (!rows[i][chart] ? prev : rows[i][chart])]);
            if (rows[i][chart]) prev = rows[i][chart];
        }
        res.json(json);
    });
});

app.get("/rs/all/:chart/:zoom", function(req, res) {
    var chart = req.params.chart;
    var zoom = req.params.zoom;
    if (!isValidChart(chart) || !isValidZoom(zoom)) {
        return res.json([]);
    }
    var minDate = getMinDate(zoom);
    db.all("SELECT * FROM containers ORDER BY name ASC", function(err, containers) {
        var result = [['Time']];
        if (containers.length === 0) {
            res.json(result);
            return;
        }
        var preResult = {};
        processNextContainer(result, preResult, containers, 0, minDate, chart, res);
    });
});

app.listen(8080, function() {

});