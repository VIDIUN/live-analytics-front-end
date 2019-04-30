'use strict';


/**
 * controller for map on entry page
 */
analyticsControllers.controller('OLMapController', ['$scope', '$attrs',  '$location', 'EntrySvc', 'SessionInfo',
    function($scope, $attrs, $location, EntrySvc, SessionInfo) {
		var self = this;
		this.mapElement = null;
		this.slider = null;
		this.sliderTicks = null;
		this.map = null;
		this.citiesLayer = null;
		this.countriesLayer = null;
		this.dvrEnabledForEntry = false;
		this.color1 = '8ecc00';
		this.color2 = 'ff8a00';
		this.color3 = '4e4e4e';
		this.lastRequestedTime = null;

		this.init = function init (element) {
			self.mapElement = element;
			
			// create map
			self.map = new OpenLayers.Map('map', {theme: null});
	
			// create OSM layer
			var osm = new OpenLayers.Layer.OSM('OpenStreetMap', [], {numZoomLevels:SessionInfo.map_zoom_levels});
			// add target so we won't try to open in frame
			osm.attribution = "&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors";
			if (SessionInfo.map_urls) {
				osm.url = self.processMapUrls(SessionInfo.map_urls);
			}
			self.map.addLayer(osm);
			self.map.zoomToMaxExtent();
			self.map.events.register('zoomend', this, function (event) {
				if (!self.citiesLayer) return; // if no layers no need to toggle.
				
		        var zLevel = self.map.getZoom();     
		        if( zLevel < 4)
		        {
		        	// show countries
		        	self.citiesLayer.setVisibility(false);
		            self.countriesLayer.setVisibility(true);
		        }
		        else {
		        	// show cities
		        	self.citiesLayer.setVisibility(true);
		            self.countriesLayer.setVisibility(false);
		        }
		    });
			
			// create slider
			var d = new Date();
			var t = Math.floor(d.getTime() / 1000);
			self.slider = angular.element('#mapslider');
			self.slider.slider({
				max: t, 
				min: t - 129600, // 36 hrs
				value: t, 
				step: 10,
				change: self.sliderChangeHandler,
				slide: function (event, ui) {
					d = new Date(ui.value*1000);
					angular.element('#maptip .tooltip-inner').text(self.formatTime(d));
					angular.element('#maptip').css('left', $(ui.handle).css('left'));
					angular.element('#maptip').removeClass('hidden');
			    }
			});

			angular.element('#mapslider .ui-slider-handle').mouseleave(function() {
				angular.element('#maptip').addClass('hidden');
				angular.element('#maptip .tooltip-inner').text("");
				angular.element('#maptip').css('left', $(this).css('left'));
			});
		
			// create ticks
			self.sliderTicks = angular.element('#sliderticks');
			self.createSliderTicks(t-12960, t);
			
		};


		$scope.$on('gotoTime', function (event, time) {
			// show required time data on map
			self.slider.slider("option", "value", time);
		});

		/**
		 * make sure the urls start with either protocol or '//'
		 * @param urls Array
		 * @return urls array with protocol
		 */
		this.processMapUrls = function processMapUrls(urls) {
			var result = [];
			for (var i = 0; i<urls.length; i++) {
				if (urls[i].indexOf('http') == 0 && urls[i].indexOf('//') == 0) {
					result.push(urls[i] + "/${z}/${x}/${y}.png");
				}
				else {
					result.push('//' + urls[i] + "/${z}/${x}/${y}.png");
				}
			}
			return result;
		}

		/**
		 * event handler for the slider drag
		 */
		this.sliderChangeHandler = function sliderChangeHandler(event, ui) {
			angular.element('#maptip').addClass('hidden');
			angular.element('#maptip .tooltip-inner').text("");
			self.getMapData(ui.value);
		};
		
		
		/**
		 * @param min, max - timestamp (seconds)
		 */
		this.createSliderTicks = function createSliderTicks(min, max) {
			// remove existing ticks
			self.sliderTicks.html('');
			// create new ticks
			var step, left, label, range = max-min, cnt = 6;
			for (var i = 0; i<cnt; i++) {
				step = i / cnt;
				label = min + range * step;
				var d = new Date(Math.floor(label*1000));
				label = self.formatTime(d);
				left = step * 100;
				self.createSliderTick(left + '%', label);
			}

		};
		
		
		this.createSliderTick = function createSliderTick(left, txt) {
			var element = document.createElement('div');
			element.style.left = left;
			element.classList.add('slidertick');
			var title = document.createElement('div');
			title.classList.add('title');
			title.innerHTML = txt;
			element.appendChild(title);
			self.sliderTicks[0].appendChild(element);
		};
		
		this.formatTime = function formatTime(d) {
			return d.toString().match(/(\d+:\d+:\d+)/)[1];
		};
		
		
		/**
		 * create a style map for the dots
		 * @param min the smallest data point value
		 * @param max the largest data point value
		 */
		this.createStyleMap = function createStyleMap(min, max) {
			var sRadius = 4;
			var lRadius = 10;
			var blue = this.color1;
			var orange = this.color2;
			// style
			var style = new OpenLayers.Style({
				pointRadius: "${radius}",
				fillColor: "${fillColor}",
				fillOpacity: 0.8,
				strokeColor: '#' + this.color3,
				strokeWidth: 1,
				strokeOpacity: 0.8,
				title : "${tooltip}"
			},
			{
				context: {
					radius: function(feature) {
						// data point size normalization
						if (max == min) return lRadius;
						return lRadius - ((max - feature.attributes.data) * (lRadius - sRadius) / (max - min));
					},
					tooltip: function(feature) {
						var str = feature.attributes.text+ ": " + feature.attributes.audience;
						if (self.dvrEnabledForEntry) {
							str += "\nDVR: " + feature.attributes.dvr;
						}
						return str;
					},
					fillColor:function(feature) {
						// data point color normalization
						var ro = parseInt(orange.substring(0,2), 16);
						var rb = parseInt(blue.substring(0,2), 16);
						var r = ro + (feature.attributes.audience / (feature.attributes.dvr + feature.attributes.audience)) * (rb - ro);
						r = Math.round(r);
						r = r.toString(16);
						if (r.length === 1) r = "0" + r;

						var go = parseInt(orange.substring(2,4), 16);
						var gb = parseInt(blue.substring(2,4), 16);
						var g = go + (feature.attributes.audience / (feature.attributes.dvr + feature.attributes.audience)) * (gb - go);
						g = Math.round(g);
						g = g.toString(16);
						if (g.length === 1) g = "0" + g;

						var bo = parseInt(orange.substring(4, 6), 16);
						var bb = parseInt(blue.substring(4, 6), 16);
						var b = bo + (feature.attributes.audience / (feature.attributes.dvr + feature.attributes.audience)) * (bb - bo);
						b = Math.round(b);
						b = b.toString(16);
						if (b.length === 1) b = "0" + b;

						return "#" + r + g + b;
					}
				}
			}
			);
			
			// create a styleMap with a custom default symbolizer
			var styleMap = new OpenLayers.StyleMap({
				"default": style,
				"select": {
					fillColor: '#' + this.color1,
					strokeColor: '#' + this.color3
				}
			});
			
			return styleMap;
		};
		
		
		/**
		 * get data to display on map
		 * @param time unix timestamp (seconds). if null, current time is used.
		 */
		this.getMapData = function getMapData(time) {
			self.lastRequestedTime = time;
			EntrySvc.getMap($scope.entryId, time).then(function(data) {
				if (!data.objects || !data.objects[0] || data.objects[0].timestamp.toString() === self.lastRequestedTime.toString()) {
					self.displayData(data.objects);
				}
			});
			
		};
		
		
		/**
		 * recreate data layers on map
		 * @param value array of VidiunGeoTimeLiveStats
		 */
		this.displayData = function displayData(value) {
			// remove existing layers
			if (self.citiesLayer) {
				self.map.removeLayer(self.citiesLayer);
				self.citiesLayer = null;
			}
			if (self.countriesLayer) {
				self.map.removeLayer(self.countriesLayer);
				self.countriesLayer = null;
			}
			if (value) { 
				// process data to create new layers
				var countriesData = {};
				var features = [];
				var point;
				var min = 0;
				var max = 0;
				for ( var i = 0; i < value.length; i++) {
					var val = parseInt(value[i].audience, 10) + parseInt(value[i].dvrAudience, 10); // convert string to int
					if (val == 0) continue; // leave out points where audience is zero - we got them because they have plays)
					// accumulate data for country-level layer
					if (!countriesData[value[i].country.name]) { 
						// init - keep whole value for lat/long
						countriesData[value[i].country.name] = value[i];
						countriesData[value[i].country.name]['audience'] = parseInt(value[i].audience, 10);
						countriesData[value[i].country.name]['dvrAudience'] = parseInt(value[i].dvrAudience, 10);
					}
					else {
						// sum audience
						countriesData[value[i].country.name]['audience'] += parseInt(value[i].audience, 10);
						countriesData[value[i].country.name]['dvrAudience'] += parseInt(value[i].dvrAudience, 10);
					}
					point = new OpenLayers.Geometry.Point(value[i].city.longitude, value[i].city.latitude).transform('EPSG:4326', 'EPSG:3857');
					features.push(new OpenLayers.Feature.Vector(
							point, 
							{
								"audience" : value[i].audience,
								"dvr" : value[i].dvrAudience,
								"data" : val,
								"text" : value[i].city.name
							}
							));
					// update cities min-max
					if (min == 0 || val < min) {
						min = val;
					}
					if (val > max) {
						max = val;
					}
				}
				
				// create cities layer
				var layer = self.citiesLayer = new OpenLayers.Layer.Vector('Cities', {
					"projection": "EPSG:3857",
					"visibility" : self.map.zoom > 3,
					"styleMap" : self.createStyleMap(min, max)
				});
				layer.addFeatures(features);
				self.map.addLayer(layer);
				
				// create countries layer
				min = max = 0;
				features = new Array();
				for (var key in countriesData) {
					var val = countriesData[key].audience + countriesData[key].dvrAudience;
					point = new OpenLayers.Geometry.Point(countriesData[key].country.longitude, countriesData[key].country.latitude).transform('EPSG:4326', 'EPSG:3857');
					features.push(new OpenLayers.Feature.Vector(
							point, 
							{
								"audience" : countriesData[key].audience,
								"dvr" : countriesData[key].dvrAudience,
								"data" : val,
								"text" : countriesData[key].country.name
							}
							));
					// update countries min-max
					if (min == 0 || val < min) {
						min = val;
					}
					if (val > max) {
						max = val;
					}
				}
				
				// create countries layer
				layer = self.countriesLayer = new OpenLayers.Layer.Vector('Countries', {
					"projection": "EPSG:3857",
					"visibility" : self.map.zoom < 4,
					"styleMap" : self.createStyleMap(min, max)
				});
				layer.addFeatures(features);
				self.map.addLayer(layer);
				
				layer.refresh();
			}
		};
		
		
		this.adjustSlider = function adjustSlider(oldmax, newmax, val) {
			var n = newmax - oldmax;
			var min = self.slider.slider("option", "min");
			self.slider.slider("option", "max", newmax);
			self.slider.slider("option", "min", min + n);
			if (val) {
				self.slider.slider("option", "value", val);
			}
			self.createSliderTicks(min+n, newmax);
		};
		
		
		/**
		 * event handler for main screen update interval
		 * @param event
		 * @param timestamp (seconds)
		 */
		this.updateScreenHandler = function updateScreenHandler(event, time) {
			time -= 60; // we only have data about 60 seconds back, so we adjust what we got  
			var val = self.slider.slider("option", "value"); // current slider value 
			var max = self.slider.slider("option", "max"); // max slider value
			if (val == max) {
				// we are at the right edge, auto update
				//self.getMapData(time); // adjusting the slider will also trigger the update
				// update scrollbar and handle (keep handle on right edge)
				self.adjustSlider(max, time, time);
			}
			else {
				// update range 
				self.adjustSlider(max, time);
			}
			self.dvrEnabledForEntry = $scope.entry.dvrStatus == 1 // VidiunDVRStatus.ENABLED
		};
		
		this.timeBoundsSetHandler = function timeBoundsSetHandler(event, start, end) {
			start = parseInt(start, 10);
			end = parseInt(end, 10);
			var val = self.slider.slider("option", "value"); // current slider value 
			var max = self.slider.slider("option", "max"); // max slider value
			if (val == max) {
				// we are at the right edge, stay there
				self.slider.slider("option", "max", end);
				self.slider.slider("option", "min", start);
				self.slider.slider("option", "value", end);
			}
			else {
				var updateVal = false;
				if (val < start) {
					val = start;
					updateVal = true; 
				}
				if (val > end) {
					val = end;
					updateVal = true;
				}
				self.slider.slider("option", "max", end);
				self.slider.slider("option", "min", start);
				if (updateVal) {
					self.slider.slider("option", "value", val);
				}
			}
			self.createSliderTicks(start, end);
		};
		
		$scope.$on('setupScreen', self.updateScreenHandler);
		$scope.$on('updateScreen', self.updateScreenHandler);
		$scope.$on('TimeBoundsSet', self.timeBoundsSetHandler);
		
}]);

