var UI = require('ui');
var Vector2 = require('vector2');


var ajax = require('ajax');
var Vibe = require('ui/vibe');

var GEOID = null ;
var GEOERROR = 'GEOLOCATION NOT STARTED' ;
var LAT = null ;
var LON = null ;
var BUSY = false ;
var TIMESTAMP = 0 ;
var TKO = 60000 ;
var STOP_ID = null ;
var LINE_ID = null ;
var STOP_INDEX = null ;
var LINE_INDEX = null ;
var ERROR = null ;
var DATA = null ;
var MAX_REQUESTS = 10 ;
var NCLOSEST = 10 ;
var NAVIGATOR_GEOLOCATION_OPTS = {
	maximumAge:0,
	timeout:5000,
	enableHighAccuracy:true
};

var TIMEOUT = null;

var BOK = '#55AA55' ;
var BLO = '#FFFF55' ;
var BKO = '#FF0055' ;
var FOK = '#FFFFFF' ;
var FLO = '#000000' ;
var FKO = '#FFFFFF' ;

var WIDGETS = [];

var main = new UI.Window({
	scrollable: true,
 	backgroundColor: '#FFFFFF',
	status: {
		separator : 'none',
		color: FKO,
		backgroundColor: BKO
	}
});

var size = main.size();
var w = size.x ;
var h = size.y ;

var fstop = new UI.Text({
 position: new Vector2(25, 0),
 size: new Vector2(w - 50, 20),
 font: 'gothic-24-bold',
 backgroundColor: 'none',
 color: '#000000' ,
 textAlign: 'center',
 textOverflow: 'ellipsis'
});

var LEFT = 15;

var fmessage = new UI.Text({
 position: new Vector2(LEFT, 30),
 size: new Vector2(w - 34, h - 30),
 font: 'gothic-24-bold',
 color: BKO ,
 textAlign: 'center',
 textOverflow: 'wrap'
});

main.show();

function api ( lat , lon ) {
	var n = NCLOSEST ;
	var m = MAX_REQUESTS ;
	return 'https://stib-mivb-api.herokuapp.com/realtime/nclosest/' + n + '/' + lat + '/' + lon + '?max_requests=' + m ;
}

function ad ( f ) {
	WIDGETS.push(f);
	main.add(f);
}

function rm ( f ) {
	f.text('');
	main.remove(f);
}

function clear ( ) {
	var len = WIDGETS.length ;
	for ( var i = 0 ; i < len ; ++i ) {
		rm(WIDGETS[i]);
	}
	WIDGETS = [] ;
}

function _display ( ) {
	
	clear();
	
	STOP_ID = DATA.stops[STOP_INDEX].id ;
	
	fstop.text( DATA.stops[STOP_INDEX].name );
	ad(fstop);
	
	if ( DATA.stops[STOP_INDEX].realtime.error ) {
		fmessage.text( DATA.stops[STOP_INDEX].realtime.message );
		ad(fmessage);
		return ;
	}
	
	var n = DATA.stops[STOP_INDEX].realtime.results.length;
	
	if ( n === 0 ) {
		fmessage.text( 'nothing right now' );
		ad(fmessage);
		return ;
	}
	
	for ( var i = 0 ; i < n ; ++i ) {
	
		var next = DATA.stops[STOP_INDEX].realtime.results[i] ;

		var offset = i*35 ;

		var fnumber = new UI.Text({
		 position: new Vector2(LEFT, 30+offset),
		 size: new Vector2(32, 32),
		 font: 'gothic-24-bold',
		 textAlign: 'center',
		 textOverflow: 'fill',
		 text: next.line,
		 color: next.fgcolor,
		 backgroundColor: next.bgcolor
		});

		var fline = new UI.Text({
		 position: new Vector2(LEFT+37, 30+offset),
		 size: new Vector2(w-91, 20),
		 font: 'gothic-24-bold',
		 color: '#000000' ,
		 textAlign: 'left',
		 textOverflow: 'ellipsis' ,
		 text: next.destination
		});

		var fminutes = new UI.Text({
		 position: new Vector2(LEFT+w-54,30+offset),
		 size: new Vector2(22, 20),
		 font: 'gothic-24-bold',
		 text: next.minutes,
		 color: '#555555' ,
		 backgroundColor: 'none',
		 textAlign: 'center',
		 textOverflow: 'fill'
		});	

		ad(fnumber);
		ad(fline);
		ad(fminutes);

		if ( i === 0 && next.minutes === 0 ) Vibe.vibrate('double');
		
	}
	
}

function other ( ) {
	++STOP_INDEX ;
	LINE_INDEX = 0 ;
	if ( STOP_INDEX >= DATA.stops.length ) {
		STOP_INDEX = 0 ;
	}
	_display ( ) ;
}

function handle_error ( title , message ) {
	if ( Date.now() - TIMESTAMP < TKO ) {
		bindnav();
		main.status('color', FOK);
		main.status('backgroundColor', BOK);
		TIMEOUT = setTimeout( load , 30000 ) ;
		return ;
	}
	main.status('color', FKO);
	main.status('backgroundColor', BKO);
	clear();
	fstop.text( title );
	fmessage.text( message );
	ad(fmessage);
	ad(fstop);
	bindload();
}

function load ( ) {
	
	if ( BUSY ) return ;
	
	BUSY = true ;
	
	if ( TIMEOUT !== null ) {
		clearTimeout(TIMEOUT);
		TIMEOUT = null ;
	}
	
	main.status('color', FLO ) ;
	main.status('backgroundColor', BLO ) ;
	
	if ( GEOERROR !== null ) {
		return handle_error('ERROR', GEOERROR);
	}
	
	ajax({ url: api(LAT,LON), type: 'json' },
	  function(data, status, request) {
		ERROR = null ;
		
		DATA = data ;
		STOP_INDEX = 0 ;
		LINE_INDEX = 0 ;
		if ( STOP_ID !== null ) {
			var m = DATA.stops.length ;
			for ( var i = 0 ; i < m ; ++i ) {
				if ( DATA.stops[i].id === STOP_ID ) {
					STOP_INDEX = i ;
					if ( LINE_ID !== null ) {
						
						var realtime = DATA.stops[i].realtime;
						
						if ( realtime.error ) break ;
						var results = realtime.results ;
						
						var n = results.length ;
						for ( var j = 0 ; j < n ; ++j ) {
							if ( results[j].line === LINE_ID ) {
								LINE_INDEX = j ;
								break ;
							}
						}
					}
					break;
				}
			}
		}
		_display();
	    bindnav();
		main.status('color', FOK);
		main.status('backgroundColor', BOK);
		TIMESTAMP = Date.now();
		TIMEOUT = setTimeout( load , 30000 ) ;
	  },
	  function(data, status, request) {
		handle_error('API failed ' + status , data.message ) ;
	  }
	);
}

function geosuccess ( position ) {
	LAT = position.coords.latitude;
	LON = position.coords.longitude;
	GEOERROR = null ;
}

function geofail(){
	GEOERROR = 'could not load geolocation :(';
}

function geostart(){
	
	if(navigator && navigator.geolocation){
		
		if ( GEOID !== null ) {
			navigator.geolocation.clearWatch( GEOID ) ;
			GEOID = null ;
		}
		var opts = NAVIGATOR_GEOLOCATION_OPTS;
		GEOID = navigator.geolocation.watchPosition(geosuccess, geofail, opts);
		GEOERROR = 'GEOLOCATION LOADING...' ;
	}
	else{
		GEOERROR = 'navigator not enabled :(' ;
	}
}

function geostop(){
	if ( navigator && navigator.geolocation && GEOID !== null ) {
		navigator.geolocation.clearWatch( GEOID ) ;
		GEOID = null ;
	}
	GEOERROR = 'GEOLOCATION STOPPED' ;
}

function bindload ( ) {
	
	unbind();

	main.on('click', 'select', function(e) { load() ; } ) ;
	main.on('longClick', 'select', function(e) { load() ; } ) ;
	main.on('longClick', 'down', function(e) { load() ; } ) ;
	main.on('longClick', 'up', function(e) { load() ; } ) ;
	
	BUSY = false ;
	
}

function bindnav ( ) {
	
	unbind();
	
	main.on('click', 'select', function(e) { other() ; } ) ;
	main.on('longClick', 'select', function(e) { load() ; } ) ;
	main.on('longClick', 'down', function(e) { load() ; } ) ;
	main.on('longClick', 'up', function(e) { load() ; } ) ;

	main.on('hide', function(){
		if ( TIMEOUT !== null ) {
			clearTimeout(TIMEOUT);
			TIMEOUT = null ;
		}
	});

	main.on('show', function(){
		load();
	});
	
	BUSY = false ;
}

function unbind ( ) {
	
	try{
		main.off('click');
	}
	catch(e){
	}
	try{
		main.off('longClick');
	}
	catch(e){
	}
	try{
		main.off('hide');
	}
	catch(e){
	}
	try{
		main.off('show');
	}
	catch(e){
	}
	
}

geostart();
load();