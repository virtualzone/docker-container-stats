var DB_FILE = 'db/netstats.db';
var DOCKER = '/usr/bin/docker';
var INTERVAL = 60;
var TEST = false;

var sqlite3 = require('sqlite3').verbose();
var exec = require('child_process').execFileSync;
var spawn = require('child_process').spawnSync;
var moment = require('moment');
var fs = require('fs');
var db = new sqlite3.Database(DB_FILE);

var getContainers = function() {
    var containers = {};
    var out;
    if (TEST) {
        out = fs.readFileSync('test/docker_ps.txt', {encoding: 'utf-8'});
    } else {
        out = spawn(DOCKER, ['ps', '-a']).stdout.toString();
    }
    var lines = out.split('\n');
    for (var i=0; i<lines.length; i++) {
        var line = lines[i];
        var columns = line.split(/\s{3,}/g);
        if (i > 0 && columns.length >= 2) {
            containers[columns[0]] = {
                'name': columns[columns.length-1]
            };
        }
    }
    return containers;
};

var getBytes = function(s) {
    var tokens = s.split(' ');
    var bytes = 0;
    var unit = tokens[1].trim();
    var value = tokens[0].trim();
    if (unit == 'kB') {
        return value*1024;
    } else if (unit == 'MB') {
        return value*1024*1024;
    } else if (unit == 'GB') {
        return value*1024*1024*1024;
    } else if (unit == 'TB') {
        return value*1024*1024*1024*1024;
    }
    return bytes;
};

var addNetworkStats = function(containers) {
    var out;
    if (TEST) {
        out = fs.readFileSync('test/docker_stats.txt', {encoding: 'utf-8'});
    } else {
        out = spawn(DOCKER, ['stats', '-a', '--no-stream']).stdout.toString();
    }
    var lines = out.split('\n');
    for (var i=0; i<lines.length; i++) {
        if (i > 0) {
            var line = lines[i];
            var columns = line.split(/\s{3,}/g);
            if (columns.length >= 6) {
                var containerId = columns[0];
                if (containerId) {
                    var cpu = columns[1];
                    var mem = columns[2];
                    var net = columns[4];
                    var block = columns[5];
                    
                    containers[containerId].cpu = cpu.replace('%', '');
                    containers[containerId].mem = getBytes(mem.split(' / ')[0]);
                    containers[containerId].net = {
                        'in': getBytes(net.split(' / ')[0]),
                        'out': getBytes(net.split(' / ')[1])
                    };
                    containers[containerId].block = {
                        'in': getBytes(block.split(' / ')[0]),
                        'out': getBytes(block.split(' / ')[1])
                    };
                }
            }
        }
    }
};

var writeContainerStats = function(id, container, now) {
    var stm;
    stm = db.prepare("INSERT OR IGNORE INTO containers (id, name) VALUES (?, ?)");
    stm.run(id, container.name);
    stm = db.prepare("INSERT INTO stats (id, ts, cpu, mem, net_in, net_out, block_in, block_out) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    stm.run(id, now, container.cpu, container.mem, container.net.in, container.net.out, container.block.in, container.block.out);
    stm.finalize();
};

var writeStats = function(containers) {
    var now = moment().format('YYYY-MM-DD HH:mm:ss');
    for (var id in containers) {
        var container = containers[id];
        writeContainerStats(id, container, now);
    }
};

var main = function() {
    var containers = getContainers();
    addNetworkStats(containers);
    writeStats(containers);
};

db.run("CREATE TABLE IF NOT EXISTS containers ( " +
    "id TEXT NOT NULL PRIMARY KEY, " +
    "name TEXT NOT NULL)");

db.run("CREATE TABLE IF NOT EXISTS stats ( " +
    "id TEXT NOT NULL, " +
    "ts DATETIME NOT NULL, " +
    "cpu REAL NOT NULL, " +
    "mem REAL NOT NULL, " +
    "net_in REAL NOT NULL, " +
    "net_out REAL NOT NULL, " +
    "block_in REAL NOT NULL, " +
    "block_out REAL NOT NULL)");

setInterval(main, INTERVAL*1000);
