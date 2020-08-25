(function () {
    'use strict';

    var zoom = 'hour';
    var selectedContainerId = null;

    var unitRound = function(i) {
        return parseFloat(Math.round(i * 100) / 100).toFixed(2);
    };

    var getReadableUnit = function(i) {
        if (i < 1024) return unitRound(i) + ' B';
        if (i < 1024*1024) return unitRound(i/1024) + ' KB';
        if (i < 1024*1024*1024) return unitRound(i/1024/1024) + ' MB';
        if (i < 1024*1024*1024*1024) return unitRound(i/1024/1024/1024) + ' GB';
        if (i < 1024*1024*1024*1024*1024) return unitRound(i/1024/1024/1024/1024) + ' TB';
        if (i < 1024*1024*1024*1024*1024*1024) return unitRound(i/1024/1024/1024/1024/1024) + ' PB';
    };

    var addStatRow = function(list, row) {
        var tr = $(document.createElement('tr'));
        var td0 = $(document.createElement('td'));
        var td1 = $(document.createElement('td'));
        var td2 = $(document.createElement('td'));
        var td3 = $(document.createElement('td'));
        var td4 = $(document.createElement('td'));
        var td5 = $(document.createElement('td'));
        var td6 = $(document.createElement('td'));
        
        td0.text(row.ts);
        td1.text(row.cpu + '%');
        td2.text(getReadableUnit(row.mem));
        td3.text(getReadableUnit(row.net_in));
        td4.text(getReadableUnit(row.net_out));
        td5.text(getReadableUnit(row.block_in));
        td6.text(getReadableUnit(row.block_out));
        
        tr.append(td0, td1, td2, td3, td4, td5, td6);
        list.append(tr);
    };

    var renderLatestStats = function(containerId) {
        $.get('./rs/container/'+containerId+'/stats/latest', function(data) {
            var list = $('#container-stats-latest > tbody');
            list.empty();
            for (var i=0; i<data.length; i++) {
                var row = data[i];
                addStatRow(list, row);
            }
        });
    };

    var renderChart = function(elementId, containerId, chart) {
        console.log('Rendering chart '+chart+' for container ' + containerId);
        var url;
        if (containerId) {
            url = './rs/container/'+containerId+'/'+chart+'/'+zoom;
        } else {
            url = './rs/all/'+chart+'/'+zoom;
        }
        $.get(url, function(stats) {
            $('#'+elementId).show();
            $('#'+elementId+'-warn').hide();
            if (stats.length <= 1) {
                $('#'+elementId).hide();
                $('#'+elementId+'-warn').show();
                return;
            }
            var data = google.visualization.arrayToDataTable(stats);
            var options = {
                legend: { position: 'right' }
            };
            var chart = new google.visualization.LineChart(document.getElementById(elementId));
            chart.draw(data, options);
        });
    };

    var renderContainerStats = function(id) {
        console.log('Rendering stats for container ' + id);
        renderLatestStats(id);
        renderChart('cpu-chart', id, 'cpu');
        renderChart('mem-chart', id, 'mem');
        renderChart('net-in-chart', id, 'net_in');
        renderChart('net-out-chart', id, 'net_out');
        renderChart('block-in-chart', id, 'block_in');
        renderChart('block-out-chart', id, 'block_out');
    };

    var selectContainer = function(id, name) {
        $('#selected-container').text('Selected container: ' + (name ? name : id) + ' (click to change)');
        $('#container-list-collapse').collapse('hide');
        $('#container-stats').show();
        renderContainerStats(id);
        selectedContainerId = id;
    };

    var renderAllContainerStats = function() {
        console.log('Rendering all container stats');
        renderChart('cpu-chart', null, 'cpu');
        renderChart('mem-chart', null, 'mem');
        renderChart('net-in-chart', null, 'net_in');
        renderChart('net-out-chart', null, 'net_out');
        renderChart('block-in-chart', null, 'block_in');
        renderChart('block-out-chart', null, 'block_out');
    };

    var reRenderCharts = function() {
        if (selectedContainerId) {
            renderContainerStats(selectedContainerId);
        } else {
            renderAllContainerStats();
        }
    };

    var addItemToContainerList = function(list, container) {
        var tr = $(document.createElement('tr'));
        var td1 = $(document.createElement('td'));
        var link = $(document.createElement('a'));
        
        link.attr('href', '#');
        link.click(function() {
            selectContainer(container.id, container.name);
            return false;
        });
        link.text(container.name);
        td1.append(link);
        
        tr.append(td1);
        list.append(tr);
    };

    var loadContainerList = function(cb) {
        $.get('./rs/containers/get', function(data) {
            var list = $('#container-list > tbody');
            for (var i=0; i<data.length; i++) {
                var container = data[i];
                addItemToContainerList(list, container);
            }
        });
    };

    var onZoomButtonClick = function(level) {
        zoom = level;
        $('#zoom-buttons > button').removeClass('btn-primary');
        $('#zoom-'+level).addClass('btn-primary');
        reRenderCharts();
    };

    var initZoomButton = function() {
        $('#zoom-hour').click(function() { onZoomButtonClick('hour'); });
        $('#zoom-day').click(function() { onZoomButtonClick('day'); });
        $('#zoom-week').click(function() { onZoomButtonClick('week'); });
        $('#zoom-month').click(function() { onZoomButtonClick('month'); });
    };

    var init = function() {
        initZoomButton();
        loadContainerList();
        google.charts.load('44', {
            packages: ['corechart'],
            callback: renderAllContainerStats
        });
    };

    $(document).ready(init);
}());
