(function ($) {

var map; // map
var controlCurve; // Controls Curve
var zone; // zone.

var safemode = false; // safe mode for openair display

var arcmode = false; // Arc mode for inserting point into a map 
var startArc; // Point starting the arc.
var stopArc; // Point stoping the arc.
var middleArc; // Point where the arc pass throught.
var arcIndex = 0; // Vertice index where an arc is requested.


var EarthRadiusMeters = 6378137.0; // meters

/** Helper fonctions for Arc calculation !**/
/* Based the on the Latitude/longitude spherical geodesy formulae & scripts
at http://www.movable-type.co.uk/scripts/latlong.html
(c) Chris Veness 2002-2010
*/
google.maps.LatLng.prototype.DestinationPoint = function (brng, dist) {
	var R = EarthRadiusMeters; // earth's mean radius in meters
	var brng = brng.toRad();
	var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();
	var lat2 = Math.asin( Math.sin(lat1)*Math.cos(dist/R) +
	Math.cos(lat1)*Math.sin(dist/R)*Math.cos(brng) );
	var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(dist/R)*Math.cos(lat1),
	Math.cos(dist/R)-Math.sin(lat1)*Math.sin(lat2));
	return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
}


// === A function which returns the bearing between two LatLng in radians ===
// === If v1 is null, it returns the bearing between the first and last vertex ===
// === If v1 is present but v2 is null, returns the bearing from v1 to the next vertex ===
// === If either vertex is out of range, returns void ===
google.maps.LatLng.prototype.Bearing = function(otherLatLng) {
	var from = this;
	var to = otherLatLng;
	if (from.equals(to)) {
		return 0;
	}
	var lat1 = from.latRadians();
	var lon1 = from.lngRadians();
	var lat2 = to.latRadians();
	var lon2 = to.lngRadians();	
	var angle = - Math.atan2( Math.sin( lon1 - lon2 ) * Math.cos( lat2 ), Math.cos( lat1 ) * Math.sin( lat2 ) - Math.sin( lat1 ) * Math.cos( lat2 ) * Math.cos( lon1 - lon2 ) );
	if ( angle < 0.0 ) angle += Math.PI * 2.0;
	if ( angle > Math.PI ) angle -= Math.PI * 2.0;
	return parseFloat(angle.toDeg());
}


/**
* Extend the Number object to convert degrees to radians
*
* @return {Number} Bearing in radians
* @ignore
*/
Number.prototype.toRad = function () {
	return this * Math.PI / 180;
};


/**
* Extend the Number object to convert radians to degrees
*
* @return {Number} Bearing in degrees
* @ignore
*/
Number.prototype.toDeg = function () {
	return this * 180 / Math.PI;
};


/**
* Normalize a heading in degrees to between 0 and +360
*
* @return {Number} Return
* @ignore
*/
Number.prototype.toBrng = function () {
	return (this.toDeg() + 360) % 360;
}; 

/** End helper function !**/

Drupal.behaviors.airspace = {

	attach: function (context, settings) {
		google.maps.event.addDomListener(window, 'load', Drupal.behaviors.airspace.initialize2D);
	},

	initialize2D : function (){
		var mapOptions = {
    			center: new google.maps.LatLng(42.555,1.533),
    			zoom: 8,
    			mapTypeId: google.maps.MapTypeId.ROADMAP
  		};

  		map = new google.maps.Map(document.getElementById('map2d'), mapOptions);

	  	jQuery.ajax({
          		type: 'GET',
          	      url: '/services-getspace/getspace/'+Drupal.settings.airspace.vid+'/airspaces/geoJson',
          	      dataType: 'json',
          	      success: function(reponse){
				var geom = JSON.parse(reponse[0]);
				var center = JSON.parse(reponse[1]);
				zone = new GeoJSON(geom, {"editable": true, "suppressUndo": true});
				zone.setMap(map);
	
				map.setCenter(new google.maps.LatLng(center.coordinates[1], center.coordinates[0]));
				google.maps.event.addListener(zone, 'rightclick', Drupal.behaviors.airspace.deleteNode);
				Drupal.behaviors.airspace.refreshList(zone.getPath());

				google.maps.event.addListener(zone.getPath(), 'set_at', function(index) {
            				if (arcmode == true){
						var path = zone.getPath();
						var getArray = Drupal.behaviors.airspace.getBeforeAndAfterFromIndex(index);
						startArc = path.getAt(getArray[0]);
						stopArc = path.getAt(getArray[1]);
						middleArc = path.getAt(index);
						arcIndex = index;
						var three = Array( Array(startArc.jb, startArc.kb), Array(path.getAt(index).jb,path.getAt(index).kb), Array(stopArc.jb, stopArc.kb));

						Drupal.behaviors.airspace.checkCircle(three, false);
					}
					else if (arcmode == false){
						Drupal.behaviors.airspace.refreshList(zone.getPath());
					}
				});

        			google.maps.event.addListener(zone.getPath(), 'insert_at', function(index) {
					if (arcmode == true){
						var path = zone.getPath();
						var getArray = Drupal.behaviors.airspace.getBeforeAndAfterFromIndex(index);
						startArc = path.getAt(getArray[0]);
						stopArc = path.getAt(getArray[1]);
						middleArc = path.getAt(index);
						arcIndex = index;
						var three = Array( Array(startArc.jb, startArc.kb), Array(path.getAt(index).jb,path.getAt(index).kb), Array(stopArc.jb, stopArc.kb));
						Drupal.behaviors.airspace.checkCircle(three, false);
					}
					else if (arcmode == false){
						Drupal.behaviors.airspace.refreshList(zone.getPath());
					}
				});
			},
          	});	

		// Create a div to hold the control.
		var controlDiv = document.createElement('div');

		// Set CSS styles for the DIV containing the control
		// Setting padding to 5 px will offset the control
		// from the edge of the map.
		controlDiv.style.padding = '5px';

		// Set CSS for the control border.
		var controlUI = document.createElement('div');
		controlUI.style.backgroundColor = 'white';
		controlUI.style.cursor = 'pointer';
		controlUI.style.textAlign = 'center';
		controlDiv.appendChild(controlUI);

		// Set CSS for the control interior.
		controlCurve = document.createElement('div');
		controlCurve.style.backgroundImage = "url(/sites/all/modules/airspace/icon/curve.jpg)";		
		controlCurve.style.width = '32px';
		controlCurve.style.height = '32px';
		controlCurve.style.borderStyle = 'solid';
		controlCurve.style.borderWidth = '2px';
		controlUI.appendChild(controlCurve);
	
		google.maps.event.addDomListener(controlCurve, 'click', function() {
			Drupal.behaviors.airspace.changeArcMode();
  		});


		map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

		$("#block-system-main .content").append("<div id='controls'><input id='safemode' type='submit' value='Sureté'></div>");
		$("#safemode").bind('click', function(){
			safemode = !safemode;
			Drupal.behaviors.airspace.changeMode();
		});
	},

	changeArcMode : function(){
		if (arcmode == 'encours' || arcmode == true){ 
			arcmode = false; 
			controlCurve.style.borderColor = '#000000';	
		}
		else if (arcmode == false){
			arcmode = true;
			controlCurve.style.borderColor = '#FF0000';
		}	
	},

	changeMode : function(){
		if (safemode == true){
			$("#safemode").attr('value', 'Arcs');
			$(".complex").css( "display", "none" );
			$(".simplification").css( "display", "block" );
		}
		else{			
			$("#safemode").attr('value', 'Sureté');
			$(".complex").css( "display", "block" );
			$(".simplification").css( "display", "none" );
		}
	},

	refreshList : function(path){
		$('#pointlist').empty();
		$('#pointlist').html("<h4><b>Kml to Openair :</b></h4>");
		var points = Array();
		for (var i=0; i< path.length; i++ ){
			points.push( Array(path.getAt(i).jb, path.getAt(i).kb));
			var lat = Drupal.behaviors.airspace.convertDDToDMS(path.getAt(i).jb, false);
			var lng = Drupal.behaviors.airspace.convertDDToDMS(path.getAt(i).kb, true);
				$('#pointlist').append("<p id='builtcoords-"+i+"' class='dp'>DP "+lat+" "+lng+"</p>");
		}

		Drupal.behaviors.airspace.checkCircle(points, true);	
	},
	
	deleteNode : function(mev){
  		if (mev.vertex != null) {
			if (zone.getPath().length > 3){
    				zone.getPath().removeAt(mev.vertex);
				Drupal.behaviors.airspace.refreshList(zone.getPath());
			}
  		}
	},

	convertDDToDMS : function(D, lng){
    		var ln = {
        		dir : D<0?lng?'W':'S':lng?'E':'N',
        		deg : 0|(D<0?D=-D:D),
        		min : 0|D%1*60,
        		sec : Math.round((0|D*60%1*6000)/100)
    		};
	
		return (ln.deg+":"+ln.min+":"+ln.sec+" "+ln.dir);
	},

	checkCircle : function(points, update){
		var mode = "advanced";
		if (update == false){
			mode = "basic"; 
		}
		jQuery.ajax({
                    	type: 'POST',
                    	url: '/services-getspace/getspace/circles/'+mode,
			data: {'points' : points},
                    		dataType: 'json',
                    		success: function(reponse){
							
					if (update == true){
						var path = zone.getPath();
						for( var i=0; i < reponse.length; i++ ){
							var begin = Drupal.behaviors.airspace.convertDDToDMS(path.getAt(reponse[i][0][0]-3).jb,false)+" "+Drupal.behaviors.airspace.convertDDToDMS(path.getAt(reponse[i][0][0]-3).kb,true);
							var end = Drupal.behaviors.airspace.convertDDToDMS(path.getAt(reponse[i][0][reponse[i][0].length-1]-1).jb,false)+" "+Drupal.behaviors.airspace.convertDDToDMS(path.getAt(reponse[i][0][reponse[i][0].length-1]-1).kb,true);
							var db = "DB "+begin+" , "+end;
							var geom = JSON.parse(reponse[i][1]);
							var lat = Drupal.behaviors.airspace.convertDDToDMS(geom.coordinates[1], false);
							var lng = Drupal.behaviors.airspace.convertDDToDMS(geom.coordinates[0], true);

							var sens = '';
							var center = "V "+sens+"X="+lat+" "+lng;
							for (var j=0; j < reponse[i][0].length; j++){ 
								$("#builtcoords-"+(reponse[i][0][j]-2)).addClass("simplification");
							}

							$("#pointlist p.dp:nth-child(" + (reponse[i][0][0]) + ")").after("<span class='complex'>"+center+"<br/>"+db+"</span>"); 
						}// end for
					}//end update
					else{
						var geom = JSON.parse(reponse[0]);
						var radius = geom.coordinates[2];
						var centerPoint = new google.maps.LatLng( geom.coordinates[1] , geom.coordinates[0]);
						var path = zone.getPath();
						path.removeAt(arcIndex);
						var insert = Drupal.behaviors.airspace.drawArc(centerPoint, centerPoint.Bearing(startArc), centerPoint.Bearing(middleArc) , centerPoint.Bearing(stopArc), radius);				
						arcmode = 'encours';
						for (var i=(insert.length-1); i > 0; i--){
							path.insertAt(arcIndex, insert[i]);

						} 														 
						Drupal.behaviors.airspace.changeArcMode();
						Drupal.behaviors.airspace.refreshList(path);
					}
				},// end success
                	});
	},

	drawArc : function(center, initialBearing, middleBearing, finalBearing, radius) {
		if ((initialBearing - finalBearing) <= 0){
			var sens = -360-(initialBearing - finalBearing);
		}
		else{
			var sens = 360 - (initialBearing - finalBearing);
		}
		if ( ((initialBearing > middleBearing) && ( middleBearing > finalBearing)) || ((initialBearing < middleBearing) && (middleBearing < finalBearing))){
			sens = finalBearing - initialBearing
		}
		var d2r = Math.PI / 180; // degrees to radians
		var r2d = 180 / Math.PI; // radians to degrees
		var points = Math.round((((Math.PI*radius*2)*Math.abs(sens))/360)/4000);

		// find the raidus in lat/lon
		var rlat = (radius / EarthRadiusMeters) * r2d;
		var rlng = rlat / Math.cos(center.lat() * d2r);
		var extp = new Array();
		var deltaBearing = (sens)/points;
		for (var i=0; (i < points+1); i++)
		{
			extp.push(center.DestinationPoint(initialBearing + i*deltaBearing, radius));
			//bounds.extend(extp[extp.length-1]);
		}
		return extp;
	}, 

	getBeforeAndAfterFromIndex : function(index){
		var path = zone.getPath();
		var total = path.length;
		var before = index - 1; 
		var after = index + 1;
		if (before < 0){
			before = total;
		}
		if (after >= total){
			after = 0;
		}

		console.log(total, before, after);
		return(Array(before,after));
	}
}	

})(jQuery);

