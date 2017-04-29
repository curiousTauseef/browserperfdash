/**
 * Angular controllers for graphs/plots used by plot.html
 *
 * Created by tthomas@igalia.com on 11/4/17.
 */
app = angular.module('browserperfdash.plot.static', ['ngResource','ngAnimate', 'ngSanitize', 'ui.bootstrap', 'angular-flot' ]);

app.factory('browserForResultExistFactory', function ($resource) {
    return $resource('/dash/browser_results_exist');
});

app.factory('botForResultsExistFactory', function($resource) {
    return $resource('/dash/bot_results_exist/:browser');
});

app.factory('testsForBrowserAndBotFactory', function ($resource) {
    return $resource('/dash/tests_for_browser_bot/:browser/:bot');
});

app.factory('subTestPathFactory', function ($resource) {
    return $resource('/dash/testpath/:browser/:root_test');
});

app.factory('testMetricsOfTestAndSubtestFactory', function ($resource) {
    return $resource('/dash/test_metrics/:root_test/:subtest');
});

app.factory('testResultsForTestAndSubtestFactory', function ($resource) {
    return $resource('/dash/results_for_subtest/:browser/:root_test/:bot/:subtest/');
});

app.controller('PlotController', function ($scope, browserForResultExistFactory, botForResultsExistFactory, subTestPathFactory,
                                           testMetricsOfTestAndSubtestFactory, testResultsForTestAndSubtestFactory,
                                           testsForBrowserAndBotFactory, $filter){
    $scope.loaded = false;
    $scope.loading = false;
    $scope.disableSubtest = false;
    $scope.disableTest = false;
    $scope.disableBrowser = false;
    $scope.disableBot = false;
    $scope.buttonHide = false;

    $scope.onBrowserChange = function () {
        //Update tests
        $scope.tests = testsForBrowserAndBotFactory.query({
            browser: !$scope.selectedBrowser ? 'all' : $scope.selectedBrowser.browser_id,
            bot: !$scope.selectedBot ? null : $scope.selectedBot.bot,
        }, function () {
            $scope.selectedTest = $scope.tests[0];
            $scope.onTestsChange();
            $scope.bots = botForResultsExistFactory.query({
                browser: !$scope.selectedBrowser ? 'all' : $scope.selectedBrowser.browser_id
            });
        });
    };

    $scope.onBotsChange = function () {
        $scope.tests = testsForBrowserAndBotFactory.query({
            browser: !$scope.selectedBrowser ? 'all' : $scope.selectedBrowser.browser_id,
            bot: !$scope.selectedBot ? null : $scope.selectedBot.bot,
        }, function (data) {
            if(data.length === 0) {
                $scope.selectedTest = [];
                $scope.selectedSubtest = [];
                $scope.disableTest = true;
                $scope.disableSubtest = true;
            } else {
                $scope.disableTest = false;
                $scope.disableSubtest = false;
                $scope.selectedTest = $scope.tests[0];
                $scope.onTestsChange();
            }
        });
    };

    $scope.onTestsChange = function () {
        if(!$scope.selectedTest) {
            return;
        }
        $scope.subtests = subTestPathFactory.query({
            browser: !$scope.selectedBrowser ? 'all' : $scope.selectedBrowser.browser_id,
            root_test: $scope.selectedTest.root_test.id
        }, function (data) {
            $scope.selectedSubtest = $scope.subtests[0];
        });
    };


    $scope.browsers = browserForResultExistFactory.query({}, function (data) {
        if(data.length === 0) {
            $scope.selectedTest = [];
            $scope.selectedSubtest = [];
            $scope.selectedBrowser = [];
            $scope.selectedBot = [];
            $scope.disableBot = true;
            $scope.disableBrowser = true;
            $scope.disableTest = true;
            $scope.disableSubtest = true;
            $scope.buttonHide = true;
            return;
        }
        $scope.onBrowserChange();
    });
    var graphCounter = 0;
    var extraToolTipInfo = new Array(new Array());
    $scope.drawnTestsDetails = new Array(new Array());

    $scope.drawGraph = function () {
        // Need to update tooltips, etc
        $scope.currentBrowser = !$scope.selectedBrowser ? 'all' : $scope.selectedBrowser.browser_id;
        $scope.currentSubtestPath = $scope.selectedSubtest.test_path;

        $scope.testMetrics = testMetricsOfTestAndSubtestFactory.query({
            root_test: $scope.selectedTest.root_test.id,
            subtest: encodeURIComponent($scope.selectedSubtest.test_path),
        });
        $scope.loading = true;

        var results = testResultsForTestAndSubtestFactory.query({
            browser: !$scope.selectedBrowser ? 'all' : $scope.selectedBrowser.browser_id,
            root_test: $scope.selectedTest.root_test.id,
            bot: !$scope.selectedBot ? 'all' : $scope.selectedBot.bot,
            subtest: encodeURIComponent($scope.selectedSubtest.test_path),
        }, function (data) {
            extraToolTipInfo[graphCounter] = {};
            botReportData = {};
            angular.forEach(data, function (value) {
                dictkey = value['browser'] + "@" + value['bot'];
                extraToolTipInfo[graphCounter][dictkey] = !extraToolTipInfo[graphCounter][dictkey] ? {} :
                    extraToolTipInfo[graphCounter][dictkey];
                botReportData[dictkey] = !botReportData[dictkey] ? [] : botReportData[dictkey];

                // Data to draw plots
                jqueryTimestamp = value['timestamp']*1000;
                botReportData[dictkey].push([jqueryTimestamp, value['mean_value']]);

                // Data to populate tooltips
                tooltipData = {};
                tooltipData['yvalue'] = value['mean_value'];
                tooltipData['browser'] =  value['browser'];
                tooltipData['browser_version'] = value['browser_version'];
                tooltipData['stddev'] = value['stddev'];
                tooltipData['delta'] = value['delta'];
                tooltipData['test_version'] = value['test_version'];

                extraToolTipInfo[graphCounter][dictkey][jqueryTimestamp] = tooltipData;
            });

            $scope.drawnTestsDetails[graphCounter] = {};
            testDetails = {};
            testDetails['root_test'] = $scope.selectedTest.root_test.id;
            testDetails['sub_test'] = $scope.currentSubtestPath;
            testDetails['browser'] = $scope.currentBrowser;
            $scope.drawnTestsDetails[graphCounter] = testDetails;

            if(graphCounter > 0) {
                var subcontainer = $('<div>').addClass("sub-container").append(
                    $('<div>').addClass("overview")
                );
                var maincontainer = $('<div>').addClass("main-container").append(
                    $('<div>').addClass("placeholder").attr('id', graphCounter)
                );

                var newRow = $('<div>').addClass('row').append(
                    $('<div>').addClass('col-md-9').append(
                        maincontainer, subcontainer
                    ),
                    $('<div>').addClass('col-md-3').attr('ng-show', 'loaded').append(
                        "<div class='panel panel-default'>" +
                        "<div class='panel-heading'><h3 class='panel-title' id="+ graphCounter + ">" +
                        "Test: "+ $scope.selectedTest.root_test.id + "</h3></div>" +
                        "<div class='panel-body' id="+ graphCounter + ">" +
                        "Subtest: "+ $scope.currentSubtestPath + "<br>" +
                        "Browser: "+ $scope.currentBrowser + "<br>" +
                        "<span class='choices' id=choice-"+ graphCounter + "></span></div></div>"
                    )
                ).css('padding-top', '10px');
                var infoRow =  $('<div>').addClass('row').append(
                    "<span><b>" + $scope.drawnTestsDetails[graphCounter]['browser'] + "</b>@" +
                    $scope.drawnTestsDetails[graphCounter]['root_test'] + "/" +
                    $scope.drawnTestsDetails[graphCounter]['sub_test'] + "</span>" +
                    "<button type='button' class='close' aria-label='Close'><span aria-hidden='true' " +
                    "class='close_button'>&times;</span></button>"
                ).css('text-align', 'center').attr('ng-show', 'loaded');

                var dummyrow = $('<div>').addClass('dummy').append(infoRow, newRow);

                var topRow = $('div#plot_area>.dummy:first');
                if (!topRow.length) {
                    //Looks like the first plot was deleted. Need to manually create a div here to add
                    //things to
                    $('div.loader_parent').after(dummyrow);
                } else {
                    topRow.before(dummyrow);
                }
            }

            var placeholder = $("div.placeholder:first");
            var overview_placeholder = $("div.overview:first");
            // insert checkboxes
            plotdatumcomplete = [];
            // Select the right container and add in the checkboxes
            var choiceContainer = $("span.choices#choice-"+ graphCounter);

            angular.forEach(botReportData, function (value, key) {
                choiceDiv = $('<div>').addClass('checkbox').append("" +
                    "<label>" +
                    "<input name='"+ key + "' id = 'id"+ key +"' type='checkbox' " +
                    "checked='checked' value=''>"+ key + "</label>"
                );
                choiceContainer.append(choiceDiv);
                plotdatumcomplete.push({ 'data': botReportData[key], 'label': key });
            });

            choiceContainer.find("input").click(plotAccordingToChoices);
            function plotAccordingToChoices() {
                updatedPlotData = [];
                choiceContainer.find("input:checked").each(function () {
                    var key = $(this).attr("name");
                    if (key) {
                        updatedPlotData.push(
                            {'data': $filter('filter')(plotdatumcomplete, {'label': key})[0]['data'], 'label': key }
                        );
                    }
                });
                createPlot(updatedPlotData);
            }

            function createPlot(plotdatum) {
                var mid = 0, end = 0;
                if (plotdatum.length > 0 ) {
                    // Will need it for selection on overview chart
                    mid = plotdatum[0]['data'][parseInt(plotdatum[0]['data'].length/2)][0];
                    end = plotdatum[0]['data'][plotdatum[0]['data'].length-1][0];
                }
                var plot = $.plot(placeholder, plotdatum, {
                    xaxis: {
                        mode: "time",
                        tickLength: 5,
                        timeformat: "%H:%M:%S",
                    },
                    crosshair: {
                        mode: "x,y"
                    },
                    yaxis: {
                        axisLabel : $scope.testMetrics[0]['metric_unit']['name'] + ' (' +
                        ($scope.testMetrics[0]['metric_unit']['is_better'] == 'up' ? 'up' : 'down') + ' is better)',
                        position: 'left',
                    },
                    grid: {
                        hoverable: true,
                    },
                    legend: {
                        show: true,
                        position: "nw"
                    },
                });
                var overview = $.plot(overview_placeholder, plotdatum, {
                    series: {
                        lines: {
                            show: true,
                            lineWidth: 1
                        },
                        shadowSize: 0,
                    },
                    legend: {
                        show: false,
                    },
                    xaxis: {
                        ticks: 10,
                        mode: "time",
                        timeformat: "%Y-%m-%d",
                        zoomRange: [0.1, 10],
                        panRange: [-10, 10]
                    },
                    yaxis: {
                        ticks: [],
                        min: 0,
                        autoscaleMargin: 0.1,
                    },
                    grid: {
                        color: "#666",
                        backgroundColor: { colors: ["#ddd", "#fff"]}
                    },
                    rangeselection:{
                        color: "#mar",
                        start: mid,
                        end: end,
                        enabled: true,
                        callback: function(o){
                            var xaxis = plot.getAxes().xaxis;
                            xaxis.options.min = o.start;
                            xaxis.options.max = o.end;
                            plot.setupGrid();
                            plot.draw();
                        }
                    }
                });
                $("<div id='tooltip'></div>").css({
                    position: "absolute",
                    display: "none",
                    border: "1px solid #fdd",
                    padding: "2px",
                    "background-color": "#fee",
                    opacity: 0.95
                }).appendTo("body");

                placeholder.bind("plothover", function (event, pos, item) {
                    if(item) {
                        var x = item.datapoint[0], y = item.datapoint[1];
                        var date = new Date(x);
                        var currentPlot = +placeholder.attr('id');
                        hoveredSeriesBot = item.series.label;
                        $("#tooltip").html( "<b>" + hoveredSeriesBot + "</b> on <i>" + $scope.currentSubtestPath + "</i><br>"
                            + "<b>Time</b>: " +  date.toISOString().split('T')[0] + ", " + date.toISOString().split('T')[1].substring(0,8)+ "<br>"
                            + "<b>Test Version</b>: " + extraToolTipInfo[currentPlot][hoveredSeriesBot][x]['test_version'].slice(-7) + "<br>"
                            + "<b>Browser Version</b>: " + extraToolTipInfo[currentPlot][hoveredSeriesBot][x]['browser_version'] + "<br>"
                            + "<b>Std. Dev</b>: " + parseFloat(extraToolTipInfo[currentPlot][hoveredSeriesBot][x]['stddev']).toFixed(3) + "<br>"
                            + "<b>Value</b>: " +  parseFloat(y).toFixed(3) + " " + $scope.testMetrics[0]['metric_unit']['unit'] + "<br>"
                            + "<b>Delta</b> :" +  parseFloat(extraToolTipInfo[currentPlot][hoveredSeriesBot][x]['delta']).toFixed(3) + "<br>"
                            + "<b>Aggregation </b> :" + $scope.selectedSubtest.aggregation + "<br>")
                            .css({top: item.pageY+5, left: item.pageX+5})
                            .fadeIn(200);
                    } else {
                        $("#tooltip").hide();
                    }
                });
                placeholder.bind("plotclick", function (event, pos, item) {
                    if (item) {
                        plot.highlight(item.series, item.datapoint);
                    }
                });

                placeholder.bind("plotselected", function (event, ranges) {
                    // do the zooming
                    $.each(plot.getXAxes(), function(_, axis) {
                        var opts = axis.options;
                        opts.min = ranges.xaxis.from;
                        opts.max = ranges.xaxis.to;
                    });
                    plot.setupGrid();
                    plot.draw();
                    plot.clearSelection();
                    // don't fire event on the overview to prevent eternal loop
                    overview.setSelection(ranges, true);
                });
                overview_placeholder.bind("plotselected", function (event, ranges) {
                    plot.setSelection(ranges);
                });
                $scope.loading = false;
                $scope.loaded = true;
            }
            createPlot(plotdatumcomplete);
            graphCounter++;
        });
    };
    // Some JQuery stuff - to handle close button clicks
    $(document).on('click','.close_button',function(){
        $(this).parent().parent().parent().remove();
    });


});

