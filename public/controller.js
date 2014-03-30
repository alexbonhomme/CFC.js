angular.module('CarbonFootprintCalculator', ['ui.bootstrap.buttons', 'leaflet-directive'])

.controller('mainController', function($scope, $http) {

	$scope.formData = {};

	/**
	 * Set up the map
	 */
	$scope.map = {
        center: {
	        lat: 50.6372,
	        lng: 3.0633,
	        zoom: 14
	    },
	    layers: {
            baselayers: {
                openstreetmap: {
                    name: 'OpenStreetMap',
                    url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    type: 'xyz',
                    layerParams: {
                      attribution: 'Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }
                }
            },
            overlays: {
                opencyclemap: {
                    name: 'OpenCycleMap',
                    url: 'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png',
                    type: 'xyz',
                    visible: false,
                    layerParams: {
                      attribution: 'Map data &copy; <a href="http://www.opencyclemap.org">OpenCycleMap</a> contributors'
                    }
                },
                clustersmap: {
                	name: 'Clusters',
                	type: 'markercluster',
                	visible: false,
                	layerOptions: {
                		singleMarkerMode: true,
						maxClusterRadius: 40
                	}
                }
            }
        },
        paths: {},
        markers: {}
    };

	/**
	 * Update user list.
	 *
	 * Note: Definitely not the best solution, but it works
	 */
	$scope.updateUsersList = function() {
		
		var updateList = function(users) {
			$scope.users = []
			users.forEach(function(user) {

				$http.get('/api/' + user.user + '/' + $scope.dates.min.yyyymmdd() + '/' + $scope.dates.max.yyyymmdd())
					.success(function(data) {

						// rides founds
						if(data.length > 0) {
							$scope.users.push(user);
						}
					})
					.error(function(data) {
						console.log('Error: ' + data);
					});
			});
		};

		$http.get('/api/users')
			.success( updateList )
			.error(function(data) {
				console.log('Error: ' + data);
			});	
	}

	/**
	 * Get all rides and associate informations
	 */
	$scope.getCarbonFootprint = function() {
		var userId = $scope.userId,
			min  = $scope.dates.min,
			max  = $scope.dates.max;

		$http.get('/api/' + userId + '/' + min.yyyymmdd() + '/' + max.yyyymmdd())
			.success(function(data) {
				$scope.rides = data;

				// no rides
				if(data.length <= 0) {
					$(".alert").show();
				} else {
					$(".alert").hide();
				}

				/* 
				 * - Compute the global footprint
				 * - Compute the global footprint per km
				 * - Aggregate successive rides using the same transportation
				 */
				var totalEmission = 0.;
				var totalDistance = 0.;
				$scope.aggRides = [];
				data.forEach(function (ride, index) {
					totalEmission += ride.emission;
					totalDistance += ride.distance;

					// aggregation
					var prev = $scope.aggRides.length - 1;
					if(prev >= 0 && $scope.aggRides[prev].type === ride.type) {

						$scope.aggRides[prev].distance += ride.distance;
						$scope.aggRides[prev].emission += ride.emission;
						$scope.aggRides[prev].numberOfRides += 1;
						
					} else {
						// define path color
						var colorClass;
						switch(ride.type) {
						case 'train':
							colorClass = 'bg-table-train'; break;
						case 'car':
							colorClass = 'bg-table-car'; break;
						case 'walking':
							colorClass = 'bg-table-walking'; break;
						default:
							colorClass = '';
						}

						$scope.aggRides.push({
							type: ride.type,
							distance: ride.distance,
							emission: ride.emission,
							numberOfRides: 1,
							colorClass: colorClass
						});
					}
				});

				$scope.carbonFootprint = totalEmission.toFixed(1) + ' kg eq. CO₂';
				$scope.carbonFootprintPerKm = (totalEmission/totalDistance).toFixed(2) + ' kg eq. CO₂ per km';

				// Rides layer + clusters layer
				$scope.addContent();

			})
			.error(function(data) {
				console.log('Error: ' + data);
			});
	};

	/**
	 * Look over the rides list and draw rides
	 */
	$scope.addContent = function() {
		$scope.map.paths = {};
		$scope.map.markers = {};

		var markerId = 0;
		$scope.rides.forEach(function(ride, idx) {
			/*
			 * Build a array of all position and make markers 
			 * to give some information about the current position (speed, etc.)
			 */
			var latLonArray = [];
			ride.coordinates.forEach(function(coord, index) {
				var latlng = L.latLng(coord.latitude, coord.longitude);

				latLonArray.push( latlng );

				// Add markers to clusters map
				$scope.map.markers[markerId] = {
					layer: 'clustersmap',
					lat: latlng.lat, 
					lng: latlng.lng
				};
				markerId++;
			});

			// define path color
			var color;
			switch(ride.type) {
			case 'train':
				color = 'blue'; break;
			case 'car':
				color = 'red'; break;
			case 'walking':
				color = 'green'; break;
			default:
				color = 'gray';
			}

			/*
			 * Draw line between each point
			 */
			 var message = 'Total distance: '+ ride.distance.toFixed(3) +' km<br>\
						    Average speed: '+ ride.averageSpeed.toFixed(1) +' km/h<br>\
						    Average acceleration: '+ ride.averageAcc.toFixed(3) +' m/s&sup2;<br>\
						    Max speed: '+ ride.maxSpeed.toFixed(1) +' km/h<br>\
						    Carbon Footprint: '+ ride.emission.toFixed(1) +' Kg eq. CO₂';
			$scope.map.paths[idx] = {
				color: color,
				weight: 5,
				opacity: 0.6,
				latlngs: latLonArray,
				message: message
			};
			
		});
	};
})

.directive('cfcDateslider', function() {
    return {
        restrict: 'A',
        require : 'ngModel',
        link : function ($scope, element, attrs, ngModelCtrl) {
            $(function(){
                element.dateRangeSlider({
			    	arrows: false,
			    	wheelMode: "zoom",
			    	step: {
						days: 1
					},
					bounds:{
					    min: new Date(2013, 10, 02),
					    max: new Date()
					  },
					defaultValues: {
						min: new Date(2013, 11, 28),
						max: new Date()
					},
					range: {
			    		min: {
			    			days: 1
			    		},
			    	}
			    });

			    element.on('valuesChanged', function(e, data) {
			    	// Update slider view
			    	$scope.$apply(function() {
			    		ngModelCtrl.$setViewValue(data.values);
			    	});

			    	// update users list
			    	$scope.updateUsersList();

			    	// No user selected
			    	if ($scope.userId == undefined) {
			    		return;
			    	};

			    	// Update data
			    	$scope.getCarbonFootprint($scope.userId);
			    });
            });
        }
    };
});