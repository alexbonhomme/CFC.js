var cfc = angular.module('CarbonFootprintCalculator', []);

function mainController($scope, $http) {
	$scope.formData = {};

	/**
	 * Get users list
	 */
	$http.get('/api/users')
		.success(function(data) {
			$scope.users = data;
		})
		.error(function(data) {
			console.log('Error: ' + data);
		});

	/**
	 * Set up the map
	 */
	var map = new L.Map('map');

	// create the tile layer with correct attribution
	var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	var osmAttrib='Map data © OpenStreetMap contributors';
	var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 20, attribution: osmAttrib});   

	// start the map in Lille center
	map.setView(new L.LatLng(50.6372, 3.0633), 12);
	map.addLayer(osm);

	/**
	 * Get all rides and associate informations
	 */
	$scope.getCarbonFootprint = function(user, date) {
		$http.get('/api/' + user + '/' + date)
			.success(function(data) {
				console.log(data);
				$scope.rides = data;

				// compute footprint
				var totalEmission = 0.;
				data.forEach(function (ride) {
					totalEmission += ride.emission;
				});

				$scope.carbonFootprint = totalEmission.toFixed(1) + ' Kg eq. CO₂';

				clearMap(map);
				addContent(data);
			})
			.error(function(data) {
				console.log('Error: ' + data);
			});
	};

	/**
	 * Clear all rides off the map
	 */
	function clearMap(m) {
	    for(i in m._layers) {
	        if(m._layers[i]._path != undefined) {
	            try {
	                m.removeLayer(m._layers[i]);
	            }
	            catch(e) {
	                console.log("problem with " + e + m._layers[i]);
	            }
	        }
	    }
	}

	/**
	* Look over the rides list and
	*/
	function addContent(rides) {
		rides.forEach(function(ride) {
			// Build an array of coordinates to polyline()
			var latLonArray = [];

			/*
			* Build a array of all position and make markers 
			* to give some information about the current position (speed, etc.)
			*/
			ride.coordinates.forEach(function(coord, index) {
				var curCoord = [coord.latitude, coord.longitude];

				// Array construction
				latLonArray.push(curCoord);
			});

			// define path color
			var color;
			switch(ride.type) {
			case 'car':
			  color = 'red'; break;
			case 'walking':
			  color = 'green'; break;
			default:
			  color = 'blue';
			}

			/*
			* Draw line between each point
			*/
			L.polyline(latLonArray, {color: color}).addTo(map)
			  .bindPopup('Total distance: '+ ride.distance.toFixed(3) +' km<br>\
			    Average speed: '+ ride.averageSpeed.toFixed(1) +' km/h<br>\
			    Average acceleration: '+ ride.averageAcc.toFixed(3) +' m/s&sup2;<br>\
			    Max speed: '+ ride.maxSpeed.toFixed(1) +' km/h<br>\
			    Carbon Footprint: '+ ride.emission.toFixed(1) +' Kg eq. CO₂');
		});
	}
}