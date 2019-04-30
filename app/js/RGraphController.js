'use strict';


/**
 * controller for (rickshaw) graph on entry page
 */
analyticsControllers.controller('RGraphController', ['$scope', '$attrs', 'EntrySvc', 
    function($scope, $attrs, EntrySvc) {
		var self = this;
		var graphElement = null; 	// HTML element showing the graph
		var graph = null;			// graph JS object
		var series = null;			// data container
		var dvrEnabledForEntry = false;
		
		this.init = function init (element) {
			graphElement = element;
			var d = new Date();
			var t = d.getTime()/1000;
			series = [{
					color : '#8ecc00',
					data : [ {x:t, y:0} ],
					name : "Audience"
				},
				{
					color : '#ff8a00',
					data : [ {x:t,y:0} ],
					name : "DVR"
				}];

			graph = createGraph(series, element);
		};
		

		var graphClickHandler = function graphClickHandler(time) {
			if (!$scope.entry.isLive) {
				// click - only for recorded entries that are not currently live
				$scope.$emit('gotoTime', time);
			}
		};
		
		/**
		 * create graph and its parts
		 * @param series
		 * @param element
		 * @return rickshaw graph
		 */
		var createGraph = function createGraph(series, element) {
			var graph = new Rickshaw.Graph({
				element : element[0].children[0],
				width : element.width(),
				height : element.height() - 20,
				renderer : 'line',
				interpolation: 'linear',
				series : series
			});
			graph.render();

			var preview = new Rickshaw.Graph.RangeSlider({
				graph : graph,
				element : element[0].children[1]
			});

			var xAxis = new Rickshaw.Graph.Axis.Time({
				graph : graph,
				ticksTreatment : 'glow',
				timeFixture : new VTime_Local()
			});
			xAxis.render();

			var yAxis = new Rickshaw.Graph.Axis.Y({
				graph : graph,
				tickFormat : Rickshaw.Fixtures.Number.formatKMBT,
				ticksTreatment : 'glow'
			});
			yAxis.render();
			
			var hoverDetail = new VHoverDetail( {
			    graph: graph,
			    formatter: function(series, x, y, formattedXValue, formattedYValue, point) {
			    	return formattedXValue + '<br>' + series.name + ': ' + y ;
			    },
				onClick : graphClickHandler
			} );
			
			return graph;
		};
		
		
		/**
		 * @param str	info string
		 * @return Object {audience: [{x, y}, ..], dvr: [{x, y}, ..]}
		 */
		var parseData = function parseData(str) {
			var os = str.split(';');
			var audienceObjects = new Array();
			var dvrObjects = new Array();
			os.forEach(function (sLine) {
				if (sLine) {
					var vals = sLine.split(',');
					audienceObjects.push({'x':parseInt(vals[0], 10), 'timestamp':parseInt(vals[0], 10), 'y':parseInt(vals[1], 10)});
					dvrObjects.push({'x':parseInt(vals[0], 10), 'timestamp':parseInt(vals[0], 10), 'y':parseInt(vals[2], 10)});
				}
			});
			return {"audience" : audienceObjects, "dvr" : dvrObjects };
		};


		var balanceBoth = function balanceBoth(data, fromDate, toDate, fillAll) {
			var audience = balanceData (data.audience, fromDate, toDate, fillAll);
			var dvr = balanceData(data.dvr, fromDate, toDate, fillAll);
			return {"audience":audience, "dvr":dvr};
		}


		/**
		 * add 0 points where no data received
		 * for live - all the way
		 * for dead - after first point, before last point
		 * @param data 		objects array with "holes"
		 * @param fromDate	timestamp, seconds
		 * @param toDate	timestamp, seconds
		 * @param fillAll	boolean, should data outside existing range be filled
		 * @return array without "holes"
		 */
		var balanceData = function balanceData(data, fromDate, toDate, fillAll) {
			var firstPoint = Math.floor(fromDate/10)*10;	// init like this for when no data
			var lastPoint = firstPoint;
			var curx, nextx, i = 1;
			if (data.length) {
				firstPoint = data[0].x;
				lastPoint = data[data.length-1].x;
			}

			// add points between lastPoint and firstPoint
			curx = firstPoint + 10;
			while (curx < lastPoint) {
				nextx = data[i].x;
				if (curx < nextx) {
					// need to add point here
					data.splice(i, 0, {'x':curx, 'timestamp':curx, 'y':0});
				}
				curx += 10;
				i++;
			}
			
			if (fillAll) {
				// add points between firstPoint and fromDate 
				curx = firstPoint - 10;
				while (curx >= fromDate) {
					data.unshift({'x':curx, 'timestamp':curx, 'y':0});
					curx -= 10;
				}

				// add points after lastPoint
				curx = lastPoint + 10;
				while (curx <= toDate) {
					data.push({'x':curx, 'timestamp':curx, 'y':0});
					curx += 10;
				}
			}
			return data;
		};
		
		/**
		 * get graph data for the last 36 hrs 
		 * @param end of 36 hrs term (timestamp sec)
		 */
		var getGraph36Hrs = function getGraph36Hrs(toDate) {
			toDate = toDate - 60;
			var fromDate = toDate - 12960; // 60 sec per minute * 60 minutes per hour * 36 hrs
			EntrySvc.getGraph($scope.entryId, -129660, -60).then(function(data) {
				if (data[0] && graph != null) {
					// parse string into objects
					var objects = parseData(data[0].data);
					// add 0 points where no data received
					objects = balanceBoth(objects, fromDate, toDate, $scope.entry.isLive);
					if (!$scope.entry.isLive) {
						var firstBroadcast = parseInt($scope.entry.firstBroadcast, 10);
						// trim data edges:
						if (!isNaN(firstBroadcast)) {	// non-vidiun don't have firstBroadcast
							for (var i = 0; i < objects.audience.length; i++) {
								if (objects.audience[i].timestamp >= firstBroadcast) {
									break;
								}
							}
						}
						for (var j = objects.audience.length - 1; j>=0; j--) {
							if (objects.audience[j].value != 0) {
								j++;
								break;
							}
						}
						objects.audience = objects.audience.slice(i, j);
						objects.dvr = objects.dvr.slice(i, j);
						if (objects.audience.length) {
							$scope.$emit('TimeBoundsSet', objects.audience[0].timestamp, objects.audience[objects.audience.length - 1].timestamp);
						}
					}
					resetGraphContent(objects);
				};
			});
		};
		
		
		/**
		 * get graph data for the last 30 secs 
		 * @param endTime (timestamp sec) get graph data for 30 secs up to this time
		 */
		var getGraph30Secs = function getGraph30Secs(endTime) {
			var toDate = -60;	//endTime;
			var fromDate = -122;
			EntrySvc.getGraph($scope.entryId, fromDate, toDate).then(function(data) {
				var objects = parseData(data[0].data);
				objects = balanceBoth(objects, endTime-122, endTime-60, $scope.entry.isLive);
				if (graph != null) {
					updateGraphContent(objects);
				}
			});
		};
		
		
		/**
		 * remove all previous data and set new 
		 * @param value {audience:array, dvr:array}
		 */
		var resetGraphContent = function resetGraphContent(value) {
			// empty audience
			var ar = series[0].data;
			while (ar.length > 0) {
				ar.pop();
			}

			// fill new
			for ( var i = 0; i < value.audience.length; i++) {
				series[0].data.push(value.audience[i]);
			}
			if (dvrEnabledForEntry) {
				// empty dvr
				ar = series[1].data;
				while (ar.length > 0) {
					ar.pop();
				}
				// fill new
				for (var i = 0; i < value.dvr.length; i++) {
					series[1].data.push(value.dvr[i]);
				}
			}
			graph.update();
		};


		/**
		 * update both graph kines with new content
		 * @param value {audience:array, dvr:array} points to add to the graph
		 */
		var updateGraphContent = function updateGraphContent(value) {
			updateSingleGraphContent(series[0].data, value.audience);
			if (dvrEnabledForEntry) {
				updateSingleGraphContent(series[1].data, value.dvr);
			}
			graph.update();
		}


		/**
		 * add new data and purge oldest so we keep only 36 hrs
		 * @param graphData:array points already in the graph
		 * @param value:array points to add to the graph
		 */
		var updateSingleGraphContent = function updateSingleGraphContent(graphData, value) {
			var lastGraphDataX = graphData[graphData.length-1].x;
			// first see if any existing values need to be updated
			for (var i = 0; i<value.length; i++) {
				var valX = value[i].x;
				if (valX <= lastGraphDataX) {
					// this x value is already in the graph
					for (var j = graphData.length-1; j>=0; j--) {
						if (graphData[j].x == valX) {
							if ( value[i].y != 0) {
								graphData[j].y = value[i].y;
							}
							break;
						}
						else if (graphData[j].x < valX) {
							// j will only become smaller
							break;
						}
					}
				}
				else {
					// valX is out of graphData bounds, will be so for any larger i
					break;
				}
			}
			
			// then shift/push for new ones
			while(i < value.length) {
				if (graphData.length >= 12960)
					graphData.shift();
				graphData.push(value[i]);
				i++;
			}
		};
		
		
		/**
		 * event handler for main screen setup event
		 * @param event
		 * @param time (timestamp sec)
		 */
		var setupScreenHandler = function setupScreenHandler(event, time) {
			dvrEnabledForEntry = $scope.entry.dvrStatus == 1 // VidiunDVRStatus.ENABLED
			if (!dvrEnabledForEntry) {
				series.pop();
			}
			getGraph36Hrs(time);
		};
		
		
		/**
		 * event handler for main screen update interval
		 * @param event
		 * @param time (timestamp sec)
		 */
		var updateScreenHandler = function updateScreenHandler(event, time) {
			getGraph30Secs(time);
		};
	
		$scope.$on('setupScreen', setupScreenHandler);
		$scope.$on('updateScreen', updateScreenHandler);
}]);