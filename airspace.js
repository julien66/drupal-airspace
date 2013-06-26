(function ($) {

var map;
var ge;
var spaces = Array(); 
var sites = Array;
var currentBound;

Drupal.behaviors.airspace = {
	attach: function (context, settings) {
		google.load('earth', '1', 
			{
				'callback': function(){ 
					google.earth.createInstance('map3d', Drupal.behaviors.airspace.initCB, Drupal.behaviors.airspace.failureCB);
				}
			}
		);
	},

	mapInit : function(){
		var myOptions = {
  			zoom: 8,
			center: new google.maps.LatLng(-34.397, 150.644),
  			mapTypeId: google.maps.MapTypeId.TERRAIN
		};

		// Create the Google Map, set options
		map = new google.maps.Map(document.getElementById("map3d"), myOptions);
	},

	initCB : function(instance){
		ge = instance;
	      	ge.getWindow().setVisibility(true);
		ge.getNavigationControl().setVisibility(ge.VISIBILITY_SHOW);

		$("li.airspace input:checkbox").attr('checked', false);

		google.earth.addEventListener(ge.getView(), 'viewchangeend', function() {
			var hitTestTL = ge.getView().hitTest(0, ge.UNITS_FRACTION, 0, ge.UNITS_FRACTION, ge.HIT_TEST_GLOBE);
  			var hitTestTR = ge.getView().hitTest(1, ge.UNITS_FRACTION, 0, ge.UNITS_FRACTION, ge.HIT_TEST_GLOBE);
  			var hitTestBR = ge.getView().hitTest(1, ge.UNITS_FRACTION, 1, ge.UNITS_FRACTION, ge.HIT_TEST_GLOBE);
  			var hitTestBL = ge.getView().hitTest(0, ge.UNITS_FRACTION, 1, ge.UNITS_FRACTION, ge.HIT_TEST_GLOBE);
  
  			// ensure that all hit tests succeeded (i.e. the viewport is 2d-mappable)
  			if (hitTestTL && hitTestTR && hitTestBL && hitTestBR) {
				currentBound = "ST_GeomFromText('Polygon(("+
					hitTestTL.getLongitude() +" "+ hitTestTL.getLatitude()+", "+
					hitTestTR.getLongitude() +" "+ hitTestTR.getLatitude()+", "+
					hitTestBR.getLongitude() +" "+ hitTestBR.getLatitude()+", "+
					hitTestBL.getLongitude() +" "+ hitTestBL.getLatitude()+", "+
					hitTestTL.getLongitude() +" "+ hitTestTL.getLatitude()
				+"))',4326)";
			}
		});

		$("input#crospace").click(function(){
			if (currentBound == "" || currentBound == null){
				alert("Vous devez zommer un peu plus sur la carte pour faire apparaître les espaces aériens.");				
			}
			else{
				jQuery.ajax({
                    			type: 'POST',
                    			url: '/services-getspace/getspace/crosses',
					data: {'geom' : currentBound},
                    			dataType: 'json',
                    			success: function(reponse){
						//console.log(reponse);
						Drupal.behaviors.airspace.showSpaces(reponse);
					},
                		});
			}
		});

		$("input#crosite").click(function(){
			if (currentBound == "" || currentBound == null){
				alert("Vous devez zommer un peu plus sur la carte pour faire apparaître les sites.");				
			}
			else{
				jQuery.ajax({
                    			type: 'POST',
                    			url: '/services-getsite/getsite/crosses',
					data: {'geom' : currentBound},
                    			dataType: 'json',
                    			success: function(reponse){
						//console.log(reponse);
						Drupal.behaviors.airspace.showSites(reponse);
					},
                		});
			}
		});

		$('input#windowspace').click(function(){
			$("#map3d").offset({left: '200'});
			$('#selectZone').show();
			$('#selectSite').hide();
		});

		$('input#windowdeco').click(function(){
			$("#map3d").offset({left: '200'});
			$('#selectZone').hide();
			$('#selectSite').show();
		});

		$("ul.zone span").click(function(){
			$('#'+$(this).attr('id')+ ' li').toggle();
		});

		/*$("#alldeco").click(function(){
			$("li.site").toggle();
		});*/

		$('input:checkbox.space').live('change', function(){
			var id = $(this).attr('value');
			var request = id+'/airspaces/kml';
			if($(this).is(':checked')){
        			if (spaces[id]){
					Drupal.behaviors.airspace.showKmlTrackFromId(id);
				}
				else{
				 jQuery.ajax({
                    			type: 'GET',
                    			url: '/services-getspace/getspace/'+request,
                    			dataType: 'json',
                    			success: function(reponse){
						console.log(reponse);
						Drupal.behaviors.airspace.addKml(reponse[0], reponse[1]);
						//Drupal.behaviors.airspace.addKmlTrackFromString(reponse.dkml, parseInt(reponse.vid), reponse.name, (reponse.class +": " +reponse.floor+" / "+reponse.ceiling),  reponse.class.replace(/ /g,""), reponse.floor, reponse.ceiling ); // A reprendre ici besoin de plus !
					},
                		});
				}
    			} else {
				if (spaces[id]){
					Drupal.behaviors.airspace.hideKmlTrackFromId(id);
				}
    			}
		});

		$('input:checkbox.deco').live('change', function(){
			var id = $(this).attr('value');
			var nom = $(this).attr('name');
			var request = id+'/ffvl_deco/kml';
			if($(this).is(':checked')){
        			if (sites[id]){
					Drupal.behaviors.airspace.showKmlMarkerFromId(id);
				}
				else{
				 jQuery.ajax({
                    			type: 'GET',
                    			url: '/services-getsite/getsite/'+request,
                    			dataType: 'json',
                    			success: function(reponse){
						console.log("reponse :"+reponse[0]);
						Drupal.behaviors.airspace.addKmlMarkerFromString(reponse[0], id, nom); // A reprendre ici besoin de plus !
					},
                		});
				}
    			} else {
				if (sites[id]){
					Drupal.behaviors.airspace.hideKmlMarkerFromId(id);
				}
    			}
		});

		$(".requested").each(function(index, value){
			var id = $(this).attr('id');
			$('li#'+id+' input').trigger('click');
			$('li#'+id+' input').trigger('change');
			console.log(id);
		});
	},

	failureCB : function(){
	},

	showSpaces : function(reponse){
		$('li.airspace').hide();
		$("li.airspace input:checked").each(function(index){
				$(this).attr('checked', false);
				Drupal.behaviors.airspace.hideKmlTrackFromId($(this).attr('id'));	
		});

		for (var i=0; i<reponse.length; i++){
			if (  $('#selectZone li#'+reponse[i][1]+" input:checkbox").is(':checked')){
			}
			else {	
				$('#selectZone li#'+reponse[i][1]+" input:checkbox").attr('checked', 'checked');
				$('#selectZone li#'+reponse[i][1]).show();
				Drupal.behaviors.airspace.addKml(reponse[i][0], reponse[i][1]);
				//Drupal.behaviors.airspace.addKmlTrackFromString(reponse[i].dkml, parseInt(reponse[i].vid), reponse[i].name, (reponse[i].class +": " +reponse[i].floor+" / "+reponse[i].ceiling),  reponse[i].class.replace(/ /g,""), reponse[i].floor, reponse[i].ceiling );		
			}		
		}
	}, 

	showSites : function(reponse){
		$('li.site').hide();
		$("li.site input:checked").each(function(index){
				$(this).attr('checked', false);
				Drupal.behaviors.airspace.hideKmlMarkerFromId($(this).attr('id'));	
		});		

		for (var i=0; i<reponse.length; i++){
			if (  $('#selectSite li#'+reponse[i].id+" input:checkbox").is(':checked')){
			}
			else {	
				console.log('#selectSite li#'+reponse[i].id);
				$('#selectSite li#'+reponse[i].id+" input:checkbox").attr('checked', 'checked');
				$('#selectSite li#'+reponse[i].id).show();
				Drupal.behaviors.airspace.addKmlMarkerFromString(reponse[i].kml, reponse[i].id, reponse[i].nom);		
			}		
		}
	},


	showKmlTrackFromId : function(id){
		 ge.getFeatures().appendChild(spaces[id]);
	},

	showKmlMarkerFromId : function(id){
		 ge.getFeatures().appendChild(sites[id]);
	},

	hideKmlTrackFromId : function(id){
		 ge.getFeatures().removeChild(spaces[id]);
	},

	hideKmlMarkerFromId : function(id){
		 ge.getFeatures().removeChild(sites[id]);
	},

	addKml : function(finalkml, vid){
		var kmlObject = ge.parseKml(finalkml);
		spaces[vid] = kmlObject;
		ge.getFeatures().appendChild(kmlObject);
	},

	/*addKmlTrackFromString : function(kmlstring, id, title, description,clas, plancher, plafond){
		var stringAlti = "";
		if (!title){title = "Test"; }
		if (!description){description = "";}
		if (!clas){clas = "D";}

		var finalkml = 
			'<?xml version="1.0" encoding="UTF-8"?>' +
  			'<kml xmlns="http://www.opengis.net/kml/2.2"' +
			 ' xmlns:gx="http://www.google.com/kml/ext/2.2">' +
			'<Document>' +
			'    <Style id="A">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="B">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="C">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="CTR">' +
      			'	<LineStyle>' +
        		'		<color>641400FF</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1e1400FF</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="D">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="P">' +
      			'	<LineStyle>' +
        		'		<color>641400FF</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1e1400FF</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="R">' +
      			'	<LineStyle>' +
        		'		<color>641400FF</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1e1400FF</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'    <Style id="GP">' +
      			'	<LineStyle>' +
        		'		<color>643CFF14</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>143CFF14</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'<Style id="E">' +
      			'	<LineStyle>' +
        		'		<color>64F0B414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF0B414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'<Style id="Q">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'<Style id="W">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>1eF01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'<Style id="ZRT">' +
      			'	<LineStyle>' +
        		'		<color>64F01414</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>14F01414</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
			'<Style id="VL">' +
      			'	<LineStyle>' +
        		'		<color>643CFF14</color>' +
        		'		<width>2</width>' +
      			'	</LineStyle>' +
      			'	<PolyStyle>' +
        		'		<color>143CFF14</color>' +
      			'	</PolyStyle>' +
    			'</Style>' +
  			'  <Placemark>' +
  			'    <name>'+ title +'</name>' +
			'    <description>' + description + '</description>' +
			'    <styleUrl>#'+clas+'</styleUrl>' +
			kmlstring +
  			'  </Placemark>' +
			' </Document>' +
  			'</kml>' ;

		//console.log(finalkml);
	
		var kmlObject = ge.parseKml(finalkml);
		spaces[id] = kmlObject;
		ge.getFeatures().appendChild(kmlObject);
	},*/


	addKmlMarkerFromString : function(kmlstring, id, title){
		var finalkml =
			'<?xml version="1.0" encoding="UTF-8"?> ' +
			'<kml xmlns="http://earth.google.com/kml/2.0"> <Document>' +
			'<Placemark>' + 
 			'<name>'+title+'</name>' + 
			'<description>Le décollage de '+title+'.</description>' +
			kmlstring +
 			'</Placemark>' +
			'</Document> </kml>';

		var kmlObject = ge.parseKml(finalkml);
		sites[id] = kmlObject;
		ge.getFeatures().appendChild(kmlObject);
	}
}	

})(jQuery);

