/**
 * Angular controllers for graphs/plots used by plot.html
 *
 * Created by tthomas@igalia.com on 11/4/17.
 */
app = angular.module('browserperfdash.plot.static', ['ngResource','ngAnimate', 'ngSanitize', 'ui.bootstrap',
    'chart.js' ]);

app.factory('browserForResultExistFactory', function ($resource) {
    return $resource('/dash/browser_results_exist');
});

app.factory('botForResultsExistFactory', function($resource) {
    return $resource('/dash/bot_results_exist');
});

app.factory('testForResultsExistFactory', function($resource) {
    return $resource('/dash/test_results_exist');
});

app.factory('testPathFactory', function ($resource) {
    return $resource('/dash/testpath/:browser/:root_test');
});

app.factory('testVersionOfTestFactory', function ($resource) {
    return $resource('/dash/test_version/:browser/:root_test/:subtest');
});

app.factory('testResultsForVersionFactory', function ($resource) {
    return $resource('/dash/results_for_version/:browser/:root_test/:subtest/:bot');
});

app.controller('PlotController', function ($scope, browserForResultExistFactory, testForResultsExistFactory,
                                           botForResultsExistFactory, testPathFactory, testVersionOfTestFactory,
                                           testResultsForVersionFactory) {
    $scope.browsers = browserForResultExistFactory.query({}, function (data) {
        $scope.selectedBrowser = data[0];
        $scope.tests = testForResultsExistFactory.query({}, function (data) {
            $scope.selectedTest = data[0];
            $scope.subtests = testPathFactory.query({
                browser: $scope.selectedBrowser.browser_id,
                root_test: $scope.selectedTest.root_test_id
            }, function (data) {
                $scope.selectedSubtest = data[0];
                $scope.testversion = testVersionOfTestFactory.query({
                    browser: $scope.selectedBrowser.browser_id,
                    root_test: $scope.selectedTest.root_test_id,
                    subtest: $scope.selectedSubtest.test_path,
                });
            });
        });
        $scope.bots = botForResultsExistFactory.query();
    });

    $scope.updateSubtests = function () {
        if ( $scope.selectedBrowser != undefined ) {
            $scope.subtests = testPathFactory.query({
                browser: $scope.selectedBrowser.browser_id,
                root_test: $scope.selectedTest.root_test_id
            });
        }
    };
    $scope.updateVersions = function () {
        if ( $scope.selectedSubtest != undefined ) {
            $scope.testversion = testVersionOfTestFactory.query({
                browser: $scope.selectedBrowser.browser_id,
                root_test: $scope.selectedTest.root_test_id,
                subtest: $scope.selectedSubtest.test_path,
            });
        }
    };

    $scope.updateOthers = function () {
        if ( $scope.selectedBrowser && $scope.selectedTest ) {
            $scope.updateSubtests();
        }
    };

    $scope.drawGraph = function () {
        $scope.labels = [];
        $scope.data = [];
        $scope.series = [];
        var extrainformations = {};
        var databucket = {};
        var results = testResultsForVersionFactory.query({
            browser: $scope.selectedBrowser.browser_id,
            root_test: $scope.selectedTest.root_test_id,
            subtest: $scope.selectedSubtest.test_path,
            bot: !$scope.selectedBot ? null : $scope.selectedBot.bot,
        }, function (data) {
            angular.forEach(data, function (value, key) {
                result = [];
                $scope.labels.push(value['timestamp']);
                result['yvalue'] = value['mean_value'];
                result['timestamp'] = value['timestamp'];
                result['browser_version'] = value['browser_version'];
                result['stddev'] = value['stddev'];
                result['delta'] = value['delta'];
                result['unit'] = value['unit'];
                result['test_version'] = value['test_version'];
                if(!extrainformations[value['bot']]) {
                    extrainformations[value['bot']] = {};
                    extrainformations[value['bot']][value['timestamp']] = result;
                } else {
                    extrainformations[value['bot']][value['timestamp']] = result;
                }
                if (!databucket[value['bot']]) {
                    databucket[value['bot']] = [];
                    databucket[value['bot']].push({x:value['timestamp'], y:value['mean_value']});
                } else {
                    databucket[value['bot']].push({x:value['timestamp'], y:value['mean_value']});
                }
            });
            for (var key in databucket) {
                $scope.data.push(databucket[key])
                $scope.series.push(key);
            }
            if ( $scope.selectedSubtest.aggregation != 'None' ) {
                $scope.datasetOverride = [
                    {
                        borderDash: [5,10]
                    }
                ]
            }
        });

        $scope.options = {
            responsive: true,
            legend: {
                display: true,
            },
            scales: {
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: $scope.testversion[0]['metrics']['metric'] +
                        ' (' +  ($scope.testversion[0]['metrics']['metric'] == 'up' ? 'up' : 'down') + ' is better)'
                    }
                }],
                xAxes: [{
                    type: 'linear',
                    position: 'bottom',
                    ticks: {
                        callback: function (value, index, values) {
                            return moment.unix(parseInt(value)).format('YYYY-MM-DD')
                        }
                    }
                }]
            },
            tooltips: {
                enabled: true,
                mode: 'single',
                callbacks: {
                    title: function (tooltipItem, data) {
                        return $scope.selectedBrowser.browser_id + "@" + data.datasets[tooltipItem[0].datasetIndex].label;
                    },
                    label: function(tooltipItem, data) {
                        currentbot = data.datasets[tooltipItem.datasetIndex].label;
                        var label = extrainformations[currentbot][tooltipItem.xLabel]['timestamp'];
                        var datasetLabel = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                        return [
                            "Time: " + moment.unix(parseInt(label)).format('YYYY-MM-DD, HH:mm:ss'),
                            "Test Version: " + extrainformations[currentbot][tooltipItem.xLabel]['test_version'].slice(-7),
                            "Browser Version: " + extrainformations[currentbot][tooltipItem.xLabel]['browser_version'],
                            "Std. Dev: " + parseFloat(extrainformations[currentbot][tooltipItem.xLabel]['stddev']).toFixed(3),
                            "Value: " + parseFloat(datasetLabel.y).toFixed(3) + ' ' +  extrainformations[currentbot][tooltipItem.xLabel]['unit'],
                            "Delta: " + parseFloat(extrainformations[currentbot][tooltipItem.xLabel]['delta']).toFixed(3) + " %",
                            "Aggregation: " + $scope.selectedSubtest.aggregation,
                        ];
                    }
                }
            },
            pan: {
                enabled: true,
                mode: 'xy'
            },
            zoom: {
                enabled: true,
                mode: 'xy',
            }
        };
    };
});

