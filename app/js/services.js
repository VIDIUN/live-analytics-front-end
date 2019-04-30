'use strict';

/* Services */

var analyticsServices = angular.module('analyticsServices', [ 'ngResource' ]);


analyticsServices.factory('SessionInfo',
		['$location',
		 	function SessionInfoFactory($location) {
		 		var sessionInfo = {};
		 		sessionInfo.vs = '';
		 		sessionInfo.pid = '';
		 		sessionInfo.uiconfid = '';
				sessionInfo.map_urls = [
					      'a.tile.openstreetmap.org/${z}/${x}/${y}.png',
					      'b.tile.openstreetmap.org/${z}/${x}/${y}.png',
					      'c.tile.openstreetmap.org/${z}/${x}/${y}.png'
					      ];
				sessionInfo.map_zoom_levels = 10;
		 		
		 		sessionInfo.setVs = function setVs(value) {
		 			sessionInfo.vs = value;
		 		};
		 		sessionInfo.setPid = function setPid(value) {
		 			sessionInfo.pid = value;
		 		};
		 		sessionInfo.setUiconfId = function setUiconfId(value) {
		 			sessionInfo.uiconfid = value;
		 		};
				sessionInfo.setServiceUrl = function setServiceUrl(value) {
		 			sessionInfo.service_url = value;
		 		};
				sessionInfo.setMapUrls = function setMapUrls(value) {
		 			sessionInfo.map_urls = value;
		 		};
				sessionInfo.setMapZoomLevels = function setZoomLevels(value) {
		 			sessionInfo.map_zoom_levels = value;
		 		};


		 		try {
	                var vmc = window.parent.vmc;
	                if (vmc && vmc.vars) {
	                    if (vmc.vars.vs)
	                        sessionInfo.vs = vmc.vars.vs;
	                    if (vmc.vars.partner_id)
	                    	sessionInfo.pid = vmc.vars.partner_id;
	                    if (vmc.vars.service_url) 
	                    	sessionInfo.service_url = vmc.vars.service_url;
	                    if (vmc.vars.liveanalytics) {
							sessionInfo.uiconfid = vmc.vars.liveanalytics.player_id;
							if (vmc.vars.liveanalytics.map_urls) {
								sessionInfo.map_urls = vmc.vars.liveanalytics.map_urls;
							}
							if (vmc.vars.liveanalytics.map_zoom_levels) {
								var n = parseInt(vmc.vars.liveanalytics.map_zoom_levels);
								if (n > 0) {
									sessionInfo.map_zoom_levels = n;
								}
							}
						}


	                }
	            } catch (e) {
	                console.log('Could not locate parent.vmc: ' + e);
	            }
	            
	       /*     if (!sessionInfo.vs) { //navigate to login
	                $location.path("/login");
	            } */
	            
		 		return sessionInfo;
		 	} 
	 	]);

		
		
analyticsServices.factory('VApi',
		['$http', '$q', '$location', 'SessionInfo',
		 	function VApiFactory ($http, $q, $location, SessionInfo) {
		 		var VApi = {};

				VApi.redirectToLoginOnInvalidVS = true;

				VApi.setRedirectOnInvalidVS = function setRedirectOnInvalidVS(value) {
					VApi.redirectToLoginOnInvalidVS = value;
				}
		 		
		 		VApi.IE = (!!window.ActiveXObject && +(/msie\s(\d+)/i.exec(navigator.userAgent)[1])) || NaN;


				VApi.getApiUrl = function getApiUrl() {
					return SessionInfo.service_url + "/api_v3/index.php";
				}


				/**
		 		 * @param request 	request params
		 		 * @returns	promise object
		 		 */
		 		VApi.doRequest = function doRequest (request) {
		 			// Creating a deferred object
		            var deferred = $q.defer();
			 		// add required params
		            request.vs = SessionInfo.vs;
		            var method = "post";
			 		var sParams;
			 		var params;
			 		if (VApi.IE < 10) {
	                    request['callback'] = 'JSON_CALLBACK';
	                    request['format'] = '9';
	                    params = request;
	                    method = 'jsonp';
	                }
			 		else {
			 			params = {'format' : '1'};
			 			sParams = this.serializeParams(request);
			 		}
			 		
			 		$http({
			 			data: sParams,
			 			url: SessionInfo.service_url + "/api_v3/index.php",
				 		method: method,
			 			params: params,
			 			headers: {'Content-Type': 'application/x-www-form-urlencoded'}
			 		}).success(function (data, status) {
						if (VApi.redirectToLoginOnInvalidVS) {
							if (data.objectType === "VidiunAPIException") {
								if (data.code == "INVALID_VS") {
									console.log(data);
									$location.path("/login");
								}
								else {
									deferred.reject(data.message);
								}
							}
							else {
								deferred.resolve(data);
							}
						}
						else {
							deferred.resolve(data);
						}
			 		}).error(function(data, status) {
			 			console.log(data);
			 			$location.path("/login");
			 			//deferred.reject(data.message);
			 		});
			 		
			 		// Returning the promise object
		            return deferred.promise;
		 		};
		 		
		 		
		 		/**
		 		 * format params as &key1=val1&key2=val2
		 		 * @param params
		 		 * @returns {String}
		 		 */
		 		VApi.serializeParams = function serializeParams(params) {
		 			var s = '';
		 			for (var key in params) {
		 				s += '&' + key + '=' + params[key];
		 			}
		 			return s;
		 		};


				VApi.getExportHandlerUrl = function getExportHandlerUrl() {
					var url = $location.absUrl();
					url = url.substring(0, url.indexOf('#/'));
					url += "#/export/[id]/[vs]";
					return url;
				}
		 		
		 		return VApi;
		 	}
		]);

analyticsServices.factory('DashboardSvc',
		['VApi', '$resource', '$q',  
		 	function DashboardSvcFactory(VApi, $resource, $q) {
		 		var DashboardSvc = {};

				DashboardSvc.HOURS_AGO_IN_SEC = -129600;
		 		
		 		/**
		 		 * always use 10 items in page
		 		 */ 
		 		DashboardSvc.pageSize = '10';
		 		
		 		/**
		 		 * get info for dashboard aggregates line - for all entries (live + dead, as dead) 
		 		 * @returns promise
		 		 */
		 		DashboardSvc.getDeadAggregates = function getDeadAggregates() {
		 			var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveReportInputFilter',
			            'filter:fromTime': DashboardSvc.HOURS_AGO_IN_SEC,
			            'filter:toTime': '-2',
			            //'filter:live': '0',
			            'pager:objectType': 'VidiunFilterPager',
			            'pager:pageIndex': '1',
			            'pager:pageSize': DashboardSvc.pageSize,
			            'reportType': 'PARTNER_TOTAL',
			            'service': 'livereports',
			            'action': 'getreport'
			        };
					
					return VApi.doRequest(postData);
		 		};
		 		
		 		/**
		 		 * get info for dashboard aggregates line - for currently live Vidiun-live entries 
		 		 * @returns promise
		 		 */
		 		DashboardSvc.getLiveAggregates = function getLiveAggregates() {
		 			/* MR:
		 			 * audience - 10 secs (now)
		 			 * minutes viewed - 36 hours
		 			 * buffertime - 1 minute
		 			 * bitrate - 1 minute
		 			 * */
		 			var postData = {
		 					'ignoreNull': '1',
		 					'service': 'multirequest',
		 					// 1 - audience - now
		 					'1:filter:objectType': 'VidiunLiveReportInputFilter',
		 					'1:filter:fromTime': '-60',
		 					'1:filter:toTime': '-60',
		 					'1:filter:live': '1',
		 					'1:pager:objectType': 'VidiunFilterPager',
		 					'1:pager:pageIndex': '1',
		 					'1:pager:pageSize': DashboardSvc.pageSize,
		 					'1:reportType': 'PARTNER_TOTAL',
		 					'1:service': 'livereports',
		 					'1:action': 'getreport',
	 						// 2 - minutes viewed - 36 hours
	 						'2:filter:objectType': 'VidiunLiveReportInputFilter',
	 						'2:filter:fromTime': DashboardSvc.HOURS_AGO_IN_SEC,
	 						'2:filter:toTime': '-2',
	 						'2:filter:live': '1',
	 						'2:pager:objectType': 'VidiunFilterPager',
	 						'2:pager:pageIndex': '1',
	 						'2:pager:pageSize': DashboardSvc.pageSize,
	 						'2:reportType': 'PARTNER_TOTAL',
	 						'2:service': 'livereports',
	 						'2:action': 'getreport',
 							// 3 - buffertime, bitrate - 1 minute
 							'3:filter:objectType': 'VidiunLiveReportInputFilter',
 							'3:filter:fromTime': '-60',
 							'3:filter:toTime': '-2',
 							'3:filter:live': '1',
 							'3:pager:objectType': 'VidiunFilterPager',
 							'3:pager:pageIndex': '1',
 							'3:pager:pageSize': DashboardSvc.pageSize,
 							'3:reportType': 'PARTNER_TOTAL',
 							'3:service': 'livereports',
 							'3:action': 'getreport'
		 			};
		 			
		 			return VApi.doRequest(postData);
		 		};
		 		
		 		
		 		/**
		 		 * @private
		 		 * for all live entries - get stats
		 		 */
		 		DashboardSvc._getAllEntriesStats = function _getAllEntriesStats(pageNumber) {
					var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveReportInputFilter',
			            'filter:orderBy': '%2Bname',
			            'filter:fromTime': DashboardSvc.HOURS_AGO_IN_SEC,
			            'filter:toTime': '-2',
			            'pager:objectType': 'VidiunFilterPager',
			            'pager:pageIndex': pageNumber,
			            'pager:pageSize': DashboardSvc.pageSize,
			            'reportType': 'ENTRY_TOTAL',
			            'service': 'livereports',
			            'action': 'getreport'
			        };
					
					return VApi.doRequest(postData);
		 		};
		 		
		 		/**
		 		 * @private
		 		 * for all live entries - get entry objects (by ids)
		 		 */
		 		DashboardSvc._getAllEntriesEntries = function _getAllEntriesEntries(entryIds) {
		 			var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveStreamEntryFilter',
						'filter:idIn': entryIds,
			            'filter:orderBy': '-createdAt',
			            'service': 'livestream',
			            'action': 'list'
			        };
					return VApi.doRequest(postData);
		 		};
		 		
		 		/**
				 * get the list of entries to show
				 * @param pageNumber
				 */
		 		DashboardSvc.getAllEntries = function getAllEntries(pageNumber) {
		 			// get page from reports API, then use entry ids to get entry names from API
		 			
		 			// Creating a deferred object
		            var deferred = $q.defer();
		            
		            DashboardSvc._getAllEntriesStats(pageNumber).then(function (entryStats) {
						// entryStats is VidiunLiveStatsListResponse
						var ids = '';
						if (entryStats.totalCount > 0) {
							entryStats.objects.forEach(function(entry) {
								ids += entry.entryId + ","; 
							}); 
							DashboardSvc._getAllEntriesEntries(ids).then(function(entries) {
								// entries is LiveStreamListResponse
								entryStats.objects.forEach(function (entryStat) {
									// add entry name to stats object
									entries.objects.every(function (entry) {
										if (entryStat.entryId == entry.id) {
											entryStat.name = entry.name;
											entryStat.thumbnailUrl = entry.thumbnailUrl;
											entryStat.firstBroadcast = entry.firstBroadcast; // API returns secs
											entryStat.lastBroadcast = entry.lastBroadcast; // API returns secs
											entryStat.dvrStatus = entry.dvrStatus;
											return false;
										}
										return true;
									});
								});
								deferred.resolve(entryStats);
							});
						}
						else {
							// no entries returned stats, resolve.
							deferred.resolve(entryStats);
						}
					});
			 		
			 		// Returning the promise object
		            return deferred.promise;
				};
				
				
				/**
				 * @private
				 * @param pageNumber
				 */
				DashboardSvc._getLiveEntriesEntries = function _getLiveEntriesEntries(pageNumber) {
					var postData = {
				            'filter:orderBy': '%2Bname',
				            'filter:objectType': 'VidiunLiveStreamEntryFilter',
				            'filter:isLive': '1',
				            'ignoreNull': '1',
				            'pager:objectType': 'VidiunFilterPager',
				            'pager:pageIndex': pageNumber,
				            'pager:pageSize': DashboardSvc.pageSize,
				            'service': 'livestream',
				            'action': 'list'
				        };
					
					return VApi.doRequest(postData);
				};
				
				/**
				 * @private
				 * @param entryIds
				 */
				DashboardSvc._getLiveEntriesStats = function _getLiveEntriesStats(entryIds) {
					var postData = {
						'ignoreNull': '1',
						'service': 'multirequest',
						// 1 - minutes viewed - 36 hours - will have most results (entries)
			            '1:filter:objectType': 'VidiunLiveReportInputFilter',
			            '1:filter:orderBy': '-eventTime',
			            '1:filter:entryIds': entryIds,
			            '1:filter:live': 1,
			            '1:filter:fromTime': DashboardSvc.HOURS_AGO_IN_SEC,
			            '1:filter:toTime': '-2',
			            '1:reportType': 'ENTRY_TOTAL',
			            '1:service': 'livereports',
			            '1:action': 'getreport',
						// 2 - audience - now
						'2:filter:objectType': 'VidiunLiveReportInputFilter',
			            '2:filter:orderBy': '-eventTime',
			            '2:filter:entryIds': entryIds,
			            '2:filter:live': 1,
			            '2:filter:fromTime': '-60',
			            '2:filter:toTime': '-60',
			            '2:reportType': 'ENTRY_TOTAL',
			            '2:service': 'livereports',
			            '2:action': 'getreport',
			            // 3 - buffertime, bitrate - 1 minute
			            '3:filter:objectType': 'VidiunLiveReportInputFilter',
			            '3:filter:orderBy': '-eventTime',
			            '3:filter:entryIds': entryIds,
			            '3:filter:live': 1,
			            '3:filter:fromTime': '-60',
			            '3:filter:toTime': '-2',
			            '3:reportType': 'ENTRY_TOTAL',
			            '3:service': 'livereports',
			            '3:action': 'getreport'
			        };
					
					return VApi.doRequest(postData);
				};
				
				/**
				 * of the given list, get the entries that are currently live
				 */
				DashboardSvc.getLiveEntries = function getLiveEntries(pageNumber) {
					// liveEntry.list by isLive to know which ones are currently live, then use entry ids in reports API
					
					// Creating a deferred object
		            var deferred = $q.defer();
		            
		            DashboardSvc._getLiveEntriesEntries(pageNumber).then(function (entries) {
						// entries is LiveStreamListResponse 
						var ids = '';
						if (entries.totalCount > 0) {
							entries.objects.forEach(function(entry) {
								ids += entry.id + ","; 
							}); 
							ids = ids.substr(0, ids.length - 1);
							DashboardSvc._getLiveEntriesStats(ids).then(function(entryStatsMR) {
								// entryStatsMR is MR with VidiunLiveStatsListResponse
								var hours = entryStatsMR[0].objects;
								var now = entryStatsMR[1].objects; 
								var minute = entryStatsMR[2].objects;
								// -------------------------------------------------------------------------------
								// entry info (name, thumbnailUrl, firstBroadcast*1000)
								entries.objects.forEach(function (entry) {
									// add params with default value
									entry.audience = "0";
									entry.dvrAudience = "0";
									entry.bufferTime = "0";
									entry.avgBitrate = "0";
									entry.peakAudience = "0";
									entry.peakDvrAudience = "0";
									entry.secondsViewed = "0";
									entry.entryId = entry.id; // for consistency with dead entries variables
									// seconds viewed, peak audience - hours
									if (hours) {
										hours.every(function (entryStat) {
											if (entry.id == entryStat.entryId) {
												entry.secondsViewed = entryStat.secondsViewed;
												entry.peakAudience = entryStat.peakAudience;
												entry.peakDvrAudience = entryStat.peakDvrAudience;
												return false;
											}
											return true;
										});
									}
									// audience - now (1 minute ago)
									if (now) {
										now.every(function (entryStat) {
											if (entry.id == entryStat.entryId) {
												entry.audience = parseInt(entryStat.audience) + parseInt(entryStat.dvrAudience);
												return false;
											}
											return true;
										});
									}
									// buffertime, bitrate - 1 minute
									if (minute) {
										minute.every(function (entryStat) {
											if (entry.id == entryStat.entryId) {
												entry.bufferTime = entryStat.bufferTime;
												entry.avgBitrate = entryStat.avgBitrate;
												return false;
											}
											return true;
										});
									}
								});
								
								deferred.resolve(entries);
							});
						}
						else {
							// no currently live entries, resolve with empty data
							deferred.resolve({
		                        "objectType" : "LiveStreamListResponse",
		                        "objects" : null,
		                        "totalCount" : '0'
		                    });
						}
					});
			 		
			 		// Returning the promise object
		            return deferred.promise;
				};
		 		
				
				/**
		 		 * trigger dashboard export to csv
		 		 */
		 		DashboardSvc.export2csv = function export2csv(liveOnly) {
		 			var d = new Date();
		 			
		 			var postData = {
						'ignoreNull': '1',
			            'service': 'livereports',
			            'action': 'exporttocsv',
			            'params:objectType': 'VidiunLiveReportExportParams',
			            'params:timeZoneOffset': d.getTimezoneOffset(),
						'params:applicationUrlTemplate': VApi.getExportHandlerUrl(),
			            'reportType': liveOnly ? '2' : '1' // VidiunLiveReportExportType.PARTNER_TOTAL_LIVE/PARTNER_TOTAL_ALL
			        };
					return VApi.doRequest(postData);
		 		};
		 		
		 		return DashboardSvc;
		 	} 
	 	]);


analyticsServices.factory('EntrySvc',
		['VApi', '$resource', '$q', 
		 	function EntrySvcFactory(VApi, $resource, $q) {
		 		var EntrySvc = {};

				EntrySvc.HOURS_AGO_IN_SEC = -129600;
		 		
		 		/**
		 		 * get the entry, add isLive info
		 		 * @param entryId
		 		 */
		 		EntrySvc.getEntry = function getEntry(entryId) {
		 			var dfd = $q.defer();
		 			var postData = {
		 					'service': 'multirequest',
		 					'1:service': 'liveStream',
				            '1:entryId' : entryId,
				            '1:action': 'get',
				            '2:service': 'liveStream',
				            '2:action': 'islive',
				            '2:id': entryId,
				            '2:protocol': 'hds',
							'3:service': 'liveStream',
				            '3:action': 'islive',
				            '3:id': entryId,
				            '3:protocol': 'hls',
							'4:service': 'liveStream',
				            '4:action': 'islive',
				            '4:id': entryId,
				            '4:protocol': 'hdnetworkmanifest'
				        };
					
		 			VApi.doRequest(postData).then(function (mr) {
						// the last 3 results are all current optional protocols.
						if (mr[0].objectType != "VidiunAPIException") {
							if (mr[0].sourceType == 31) {
								// Vidiun_Client_Enum_SourceType.AKAMAI_UNIVERSAL_LIVE
								var livehdnetwork = true;
								if (!mr[3] || mr[3].objectType == "VidiunAPIException") {
									livehdnetwork = false;
								}
								mr[0].isLive = livehdnetwork;
							}
							else if (mr[0].sourceType == 32) {
								// Vidiun_Client_Enum_SourceType.LIVE_STREAM
								var livehds = true;
								if (!mr[1] || mr[1].objectType == "VidiunAPIException") {
									livehds = false;
								}
								var livehls = true;
								if (!mr[2] || mr[2].objectType == "VidiunAPIException") {
									livehls = false;
								}
								mr[0].isLive = livehds || livehls;
							}
							else {
								mr[0].isLive = false;
							}
						}

		 				dfd.resolve(mr[0]);
		 			});
		 			
					return dfd.promise;
		 		};
		 		
		 		
		 		/**
		 		 * get aggregated stats data for this entry as a dead-now entry
		 		 * @param entryId
		 		 * @returns VidiunEntryLiveStats 
		 		 */
		 		EntrySvc.getDeadAggregates = function getDeadAggregates(entryId) {
		 			var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveReportInputFilter',
						'filter:fromTime': EntrySvc.HOURS_AGO_IN_SEC,
			            'filter:toTime': '-2',
			            'filter:entryIds': entryId,
			            'filter:live': '0',
			            'reportType': 'ENTRY_TOTAL',
			            'service': 'livereports',
			            'action': 'getreport'
			        };
		 			
					return VApi.doRequest(postData);
		 		};
		 		
		 		
		 		/**
		 		 * get aggregated stats data for this entry as a live-now entry
		 		 * @param entryId
		 		 * @returns VidiunEntryLiveStats 
		 		 */
		 		EntrySvc.getLiveAggregates = function getLiveAggregates(entryId) {
		 			/* MR:
		 			 * audience - 10 secs (now)
		 			 * minutes viewed - 36 hours
		 			 * buffertime - 1 minute
		 			 * bitrate - 1 minute
		 			 * */
		 			var postData = {
		 					'ignoreNull': '1',
		 					'service': 'multirequest',
		 					// 1 - audience - now
		 					'1:filter:objectType': 'VidiunLiveReportInputFilter',
		 					'1:filter:fromTime': '-60',
		 					'1:filter:toTime': '-60',
		 					'1:filter:live': '1',
		 					'1:filter:entryIds': entryId,
		 					'1:reportType': 'ENTRY_TOTAL',
		 					'1:service': 'livereports',
		 					'1:action': 'getreport',
	 						// 2 - minutes viewed - 36 hours
	 						'2:filter:objectType': 'VidiunLiveReportInputFilter',
	 						'2:filter:fromTime': EntrySvc.HOURS_AGO_IN_SEC,
	 						'2:filter:toTime': '-2',
	 						'2:filter:live': '1',
	 						'2:filter:entryIds': entryId,
	 						'2:reportType': 'ENTRY_TOTAL',
	 						'2:service': 'livereports',
	 						'2:action': 'getreport',
 							// 3 - buffertime, bitrate - 1 minute
 							'3:filter:objectType': 'VidiunLiveReportInputFilter',
 							'3:filter:fromTime': '-60',
 							'3:filter:toTime': '-2',
 							'3:filter:live': '1',
 							'3:filter:entryIds': entryId,
 							'3:reportType': 'ENTRY_TOTAL',
 							'3:service': 'livereports',
 							'3:action': 'getreport'
		 			};
		 			
		 			return VApi.doRequest(postData);
		 		};
		 		
		 		
		 		/**
		 		 * 
		 		 * @param entryId
		 		 * @returns
		 		 */
		 		EntrySvc.getReferrers = function getReferrers(entryId) {
		 			var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveReportInputFilter',
						'filter:fromTime': EntrySvc.HOURS_AGO_IN_SEC,
			            'filter:toTime': '-2',
			            'filter:entryIds': entryId,
			            'pager:objectType': 'VidiunFilterPager',
			            'pager:pageIndex': '1',
			            'pager:pageSize': '10',
			            'reportType': 'ENTRY_SYNDICATION_TOTAL',
			            'service': 'livereports',
			            'action': 'getreport'
			        };
					
					return VApi.doRequest(postData);
		 		};
		 		
		 		
		 		
		 		/**
		 		 * get graph data for base 36 hours
		 		 * @param entryId
		 		 * @param fromDate (timestamp sec)
		 		 * @param toDate (timestamp sec)
		 		 * @returns
		 		 */
		 		EntrySvc.getGraph = function getGraph(entryId, fromDate, toDate) {
		 			var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveReportInputFilter',
						'filter:fromTime': fromDate,
			            'filter:toTime': toDate,
			            'filter:entryIds': entryId,
			            'reportType': 'ENTRY_TIME_LINE',
			            'service': 'livereports',
			            'action': 'getevents'
			        };
					
					return VApi.doRequest(postData);
		 		};
		 		
		 		
		 		
		 		/**
		 		 * get map data for required time
		 		 * @param entryId
		 		 * @param time	(timestamp sec)
		 		 * @returns
		 		 */
		 		EntrySvc.getMap = function getMap(entryId, time) {
		 			var postData = {
						'ignoreNull': '1',
						'filter:objectType': 'VidiunLiveReportInputFilter',
						'filter:fromTime': time,
			            'filter:toTime': time,
			            'filter:entryIds': entryId,
						'filter:orderBy' : '-audience', //VidiunLiveReportOrderBy.AUDIENCE_DESC
						'pager:objectType': 'VidiunFilterPager',
						'pager:pageIndex': '1',
						'pager:pageSize': '1000',
			            'reportType': 'ENTRY_GEO_TIME_LINE',
			            'service': 'livereports',
			            'action': 'getreport'
			        };
					
					return VApi.doRequest(postData);
		 		};
		 		
		 		
		 		/**
		 		 * trigger entry export to csv
		 		 * @param reportType as enumerated in VidiunLiveReportExportType
		 		 * @param entryId 
		 		 */
		 		EntrySvc.export2csv = function export2csv(reportType, entryId) {
		 			var d = new Date();
		 			var postData = {
						'ignoreNull': '1',
			            'service': 'livereports',
			            'action': 'exporttocsv',
			            'params:objectType': 'VidiunLiveReportExportParams',
			            'params:timeZoneOffset': d.getTimezoneOffset(),
			            'params:entryIds': entryId,
						'params:applicationUrlTemplate': VApi.getExportHandlerUrl(),
						'reportType': reportType

			        };
					return VApi.doRequest(postData);
		 		};




				/**
				 *
				 * @param entryId
				 */
		 		EntrySvc.listEventCuepoints = function listEventCuepoints(entryId) {
					var postData = {
						'ignoreNull': '1',
						'service': 'cuepoint_cuepoint',
						'action': 'list',
						'filter:objectType': 'VidiunEventCuePointFilter',
						'filter:entryIdEqual': entryId,
						'filter:orderBy': '%2BstartTime'
					};
					return VApi.doRequest(postData);
				}

				return EntrySvc;
		 	} 
	 	]);

analyticsServices.factory('ReportSvc',
	['VApi', 'SessionInfo',
		function ReportSvcFactory(VApi, SessionInfo) {
			var ReportSvc = {};


			/**
			 *
			 * @param vs
			 * @returns
			 */
			ReportSvc.getSession = function getSession(vs) {
				SessionInfo.setVs(vs);
				var postData = {
					'ignoreNull': '1',
					'service': 'session',
					'action': 'get'
				};

				return VApi.doRequest(postData);
			};


			return ReportSvc;
		}
	]);




