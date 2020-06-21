var DB_FILE = 'db/stats.db';
var DOCKER = '/usr/bin/docker';

var TEST = process.env.TEST || false
var INTERVAL = process.env.STATS_INTERVAL || 60;
var CLEANUP_DAYS = process.env.CLEANUP_DAYS || 32;

var sqlite3 = require('sqlite3').verbose();
var spawn = require('child_process').spawnSync;
var moment = require('moment');
var fs = require('fs');
var db = new sqlite3.Database(DB_FILE);

var getBytes = function(s) {
    var bytes = 0;
    var value = s.match(/\d+/g)[0];
    var unit = s.match(/[a-zA-Z]+/g)[0];
    if (unit == 'B') {
        return value;
    } else if (unit == 'KB' || unit == 'KiB') {
        return value*1024;
    } else if (unit == 'MB' || unit == 'MiB') {
        return value*1024*1024;
    } else if (unit == 'GB' || unit == 'GiB') {
        return value*1024*1024*1024;
    } else if (unit == 'TB' || unit == 'TiB') {
        return value*1024*1024*1024*1024;
    }
    return bytes;
};

var getDatetime = function (number, units) {
    var datetime = moment();
    if (number) {
        return datetime.subtract(number, units);
    } 
    // round to whole minutes
    return datetime.format('YYYY-MM-DD HH:mm:00');
};


var getContainers = function() {
    var containers = {};
    var out;
    if (TEST) {
        out = fs.readFileSync('test/docker_stats.txt', {encoding: 'utf-8'});
    } else {
        out = spawn(DOCKER, ['stats', '--no-stream', '--format', 'table {{.ID}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}']).stdout.toString();
    }
    var lines = out.split('\n');
    for (var i=0; i<lines.length; i++) {
        if (i > 0) {
            var line = lines[i];
            var columns = line.split(/\s{3,}/g);
            if (columns.length >= 6) {
                var containerId = columns[0];
                if (containerId) {
                    // split by '.', used by docker swarm mode
                    var name = columns[1].split('.')[0];
                    var cpu = columns[2];
                    var mem = columns[3];
                    var net = columns[4];
                    var block = columns[5];

                    containers[containerId] = {
                        'name': name,
                        'cpu': cpu.replace('%', ''),
                        'mem': getBytes(mem.split(' / ')[0]),
                        'net': {
                            'in': getBytes(net.split(' / ')[0]),
                            'out': getBytes(net.split(' / ')[1])
                        },
                        'block': {
                            'in': getBytes(block.split(' / ')[0]),
                            'out': getBytes(block.split(' / ')[1])
                        }
                    };
                }
            }
        }
    }
    return containers;
};

var getCreateContainerId = function(name, cid, cb) {
    if (!name) name = cid;
    db.get("SELECT id FROM containers WHERE name = ? LIMIT 1", name, function(err, row) {
        if (row) {
            cb(row.id);
        } else {
            db.run("INSERT INTO containers (name) VALUES (?)", name, function() {
                cb(this.lastID);
            });
        }
    });
};

var writeContainerStats = function(cid, container, now) {
    getCreateContainerId(container.name, cid, function (id) {
        // get the last stats
        db.get('SELECT net_in, net_out, block_in, block_out FROM stats WHERE id = ? ORDER BY ts DESC LIMIT 1', id, function (err, row) {
            if (err) {
                console.error(err);
            }     

            if (row) {
                // make values relative
                if (container.net.in > 0)       container.net.in    -= row.net_in;
                if (container.net.out > 0)      container.net.out   -= row.net_out;
                if (container.block.in > 0)     container.block.in  -= row.block_in;
                if (container.block.out > 0)    container.block.out -= row.block_out;
            }

            var stm = db.prepare("INSERT INTO stats (id, ts, cpu, mem, net_in, net_out, block_in, block_out) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            stm.run(id, now, container.cpu, container.mem, container.net.in, container.net.out, container.block.in, container.block.out);
            stm.finalize();
        });
    });
};

var writeStats = function(containers) {
    var now = getDatetime();
    for (var id in containers) {
        var container = containers[id];
        writeContainerStats(id, container, now);
    }
};

var main = function() {
    var containers = getContainers();
    writeStats(containers);
    cleanupContainers(containers);
    setTimeout(main, INTERVAL*1000);
};

var cleanupContainers = function (activeContainers) {

    // get list of active containers
    var list = [];
    for (var key in activeContainers) {
        var container = activeContainers[key].name;
        list.push(`'${container}'`);
    }
    
    // skip if no active list, probably its initializing
    if (!list.length) {
        return;
    }

    // ids
    var ids = list.join(',');

    // vars
    var cleanupDays = moment().subtract(CLEANUP_DAYS, 'days').format();
    var CleanupWeekly = moment().sub

    // cleanup queries
    var cleanupQueries = [
        `DELETE FROM containers WHERE name NOT IN (${ids})`,
        'DELETE FROM stats WHERE ID NOT in (SELECT id FROM containers)',
        `DELETE FROM stats WHERE ts < '${getDatetime(CLEANUP_DAYS, 'days')}'`,
        `DELETE FROM stats WHERE ts < '${getDatetime(1, 'day')}' and strftime('%M', ts) != '00'`,   // keep hourly records after one day
        `DELETE FROM stats WHERE ts < '${getDatetime(1, 'week')}' and strftime('%H', ts) != '00'`,  // keep daily records after one week
        `DELETE FROM stats WHERE ts < '${getDatetime(1, 'year')}' and strftime('%d', ts) != '00'`,  // keep daily records after one month
    ];

    for (var query of cleanupQueries) {
        db.all(query, function (err, rows) {
            if (err) {
                console.error(err);
            }
        });
    }
};
db.run("PRAGMA journal_mode=WAL");

// create tables
db.run("CREATE TABLE IF NOT EXISTS containers ( " +
    "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, " +
    "name TEXT NOT NULL)",
    function (err, result) {
        db.run("CREATE INDEX IF NOT EXISTS containers_name ON containers(name)");
    }
);

db.run("CREATE TABLE IF NOT EXISTS stats ( " +
    "id INTEGER NOT NULL, " +
    "ts DATETIME NOT NULL, " +
    "cpu REAL NOT NULL, " +
    "mem REAL NOT NULL, " +
    "net_in REAL NOT NULL, " +
    "net_out REAL NOT NULL, " +
    "block_in REAL NOT NULL, " +
    "block_out REAL NOT NULL)",
    function (err, result) {
        db.run("CREATE INDEX IF NOT EXISTS stats_ts ON stats(ts)");
        db.run("CREATE INDEX IF NOT EXISTS stats_id ON stats(id, ts)");
    }
);


setTimeout(main, INTERVAL * 1000);
