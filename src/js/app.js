// modules

var UI = require('ui');
var Vector2 = require('vector2');

var ajax = require('ajax');
var Vibe = require('ui/vibe');
var Settings = require('settings');

// colors

var BOK = '#55AA55' ;
var FOK = '#FFFFFF' ;
var BLO = '#FFFF55' ;
var FLO = '#000000' ;
var BKO = '#FF0055' ;
var FKO = '#FFFFFF' ;
var BNG = '#FFAA00' ;
var FNG = '#FFFFFF' ;
var BG = '#FFFFFF' ;

// locking

var _LOCK = false ;

function lock ( ) {
	if ( _LOCK ) {
		console.log( 'could not acquire lock' ) ;
		return false ;
	}
	console.log( 'acquired lock' ) ;
	_LOCK = true ;
	return true ;
}

function release ( ) {
	console.log( 'released lock' ) ;
	_LOCK = false ;
}

// globals

var GEOID = null ;
var GEOERROR = 'GEOLOCATION NOT STARTED' ;
var LAT = null ;
var LON = null ;
var DATA = null ;
var TIMESTAMP = 0 ;
var TKO = 60000 ;
var STOP_ID = null ;
var STOP_INDEX = 0 ;
var ERROR = null ;
var MAX_REQUESTS = 10 ;
var NCLOSEST = 10 ;
var POLLRATE = 30000 ;
var NAVIGATOR_GEOLOCATION_OPTS = {
	maximumAge:0,
	timeout:5000,
	enableHighAccuracy:true
};

var TIMEOUT = null;

// (un)freeze

var DEFAULT_STATE = {
	LAT : LAT ,
	LON : LON ,
	DATA : DATA ,
	STOP_ID : STOP_ID
} ;

function freeze ( ) {
	console.log('freeze');
	var state = {
		LAT : LAT ,
		LON : LON ,
		DATA : DATA ,
		STOP_ID : STOP_ID
	} ;
	Settings.data('state', state);
}

function unfreeze ( ) {
	console.log('unfreeze');
	var state = Settings.data('state') || DEFAULT_STATE ;
	LAT = state.LAT ;
	LON = state.LON ;
	DATA = state.DATA ;
	STOP_ID = state.STOP_ID ;
}

// display

var WIDGETS = [];

var MAIN = new UI.Window({
	scrollable: true,
 	backgroundColor: BG,
	status: {
		separator : 'none',
		color: FKO,
		backgroundColor: BKO
	}
});

var SIZE = MAIN.size() ;
var W = SIZE.x ;
var H = SIZE.y ;
var LEFT = 15;

var FSTOP = new UI.Text({
 position: new Vector2(25, 0),
 size: new Vector2(W - 50, 20),
 font: 'gothic-24-bold',
 backgroundColor: 'none',
 color: '#000000' ,
 textAlign: 'center',
 textOverflow: 'ellipsis'
});

var FMESSAGE = new UI.Text({
 position: new Vector2(LEFT, 30),
 size: new Vector2(W - 34, H - 30),
 font: 'gothic-24-bold',
 color: BKO ,
 textAlign: 'center',
 textOverflow: 'wrap'
});

MAIN.show();

// requests handling

function api ( lat , lon ) {
	var n = NCLOSEST ;
	var m = MAX_REQUESTS ;
	return 'https://stib-mivb-api.herokuapp.com/realtime/nclosest/' + n + '/' + lat + '/' + lon + '?max_requests=' + m ;
}

function ad ( f ) {
	WIDGETS.push(f);
	MAIN.add(f);
}

function rm ( f ) {
	f.text('');
	MAIN.remove(f);
}

function clear ( ) {
	var len = WIDGETS.length ;
	for ( var i = 0 ; i < len ; ++i ) rm(WIDGETS[i]);
	WIDGETS = [] ;
}

function _display ( ) {
	
	console.log('display');
	
	clear();
	
	STOP_ID = DATA.stops[STOP_INDEX].id ;
	
	FSTOP.text( DATA.stops[STOP_INDEX].name );
	ad(FSTOP);
	
	if ( DATA.stops[STOP_INDEX].realtime.error ) {
		FMESSAGE.text( DATA.stops[STOP_INDEX].realtime.message );
		ad(FMESSAGE);
		return ;
	}
	
	var n = DATA.stops[STOP_INDEX].realtime.results.length;
	
	if ( n === 0 ) {
		FMESSAGE.text( 'nothing right now' );
		ad(FMESSAGE);
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
		 size: new Vector2(W-91, 20),
		 font: 'gothic-24-bold',
		 color: '#000000' ,
		 textAlign: 'left',
		 textOverflow: 'ellipsis' ,
		 text: next.destination
		});

		var fminutes = new UI.Text({
		 position: new Vector2(LEFT+W-54,30+offset),
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
	if ( STOP_INDEX >= DATA.stops.length ) STOP_INDEX = 0 ;
	_display ( ) ;
}

function handle_error ( title , message ) {
	console.log( 'handle_error:', title, message ) ;
	if ( Date.now() - TIMESTAMP < TKO ) {
		bindnav();
		MAIN.status('color', FOK);
		MAIN.status('backgroundColor', BOK);
		TIMEOUT = setTimeout( load , POLLRATE ) ;
		return ;
	}
	MAIN.status('color', FKO);
	MAIN.status('backgroundColor', BKO);
	clear();
	FSTOP.text( title );
	FMESSAGE.text( message );
	ad(FSTOP);
	ad(FMESSAGE);
	bindload();
}


function loadfail (data, status, request) {
	handle_error('API failed ' + status , data.message ) ;
}

function _update_stop_index(){
	STOP_INDEX = 0 ;
	if ( STOP_ID !== null ) {
		var m = DATA.stops.length ;
		for ( var i = 0 ; i < m ; ++i ) {
			if ( DATA.stops[i].id === STOP_ID ) {
				STOP_INDEX = i ;
				break;
			}
		}
	}
}

function loadsuccess (fg, bg) {
	return function (data, status, request) {
		ERROR = null ;
		DATA = data ;
		_update_stop_index() ;
		_display();
		bindnav();
		MAIN.status('color', fg);
		MAIN.status('backgroundColor', bg);
		TIMESTAMP = Date.now();
		TIMEOUT = setTimeout( load , POLLRATE ) ;
	} ;
}

function load ( ) {
	
	console.log( 'try load' ) ;
	
	if ( ! lock() ) return ;
	
	console.log( 'load' ) ;
	
	if ( TIMEOUT !== null ) {
		clearTimeout(TIMEOUT);
		TIMEOUT = null ;
	}
	
	MAIN.status('color', FLO ) ;
	MAIN.status('backgroundColor', BLO ) ;
	
	var fg = FOK ;
	var bg = BOK ;
	
	if ( LAT === null || LON === null  ) {
		return handle_error('GEOERROR', GEOERROR);
	}
	
	else if ( GEOERROR !== null ) {
		fg = FNG ;
		bg = BNG ;
	}
	
	ajax({ url: api(LAT,LON), type: 'json' }, loadsuccess( fg, bg ), loadfail ) ;
}

// geolocation

function geosuccess ( position ) {
	LAT = position.coords.latitude;
	LON = position.coords.longitude;
	console.log( 'geosuccess', LAT, LON ) ;
	var failed_before = GEOERROR !== null ;
	GEOERROR = null ;
	if ( TIMEOUT === null || failed_before ) load();
}

function geofail(){
	console.log( 'geofail' ) ;
	GEOERROR = 'could not load geolocation :(';
}

function geostart(){
	console.log( 'geostart' );
	
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
	console.log( 'geostop' );
	if ( navigator && navigator.geolocation && GEOID !== null ) {
		navigator.geolocation.clearWatch( GEOID ) ;
		GEOID = null ;
	}
	GEOERROR = 'GEOLOCATION STOPPED' ;
}

function bindload ( ) {
	
	unbind();
	console.log('bindload'); 

	MAIN.on('click', 'select', function(e) { console.log('click'); load() ; } ) ;
	MAIN.on('longClick', 'select', function(e) { console.log('longClick'); load() ; } ) ;
	
	release();
	
}

function bindnav ( ) {
	
	unbind();
	console.log('bindnav'); 
	
	MAIN.on('click', 'select', function(e) { console.log('click'); other() ; } ) ;
	MAIN.on('longClick', 'select', function(e) { console.log('longClick'); load() ; } ) ;

	MAIN.on('hide', function(e){
		console.log('hide'); 
		if ( TIMEOUT !== null ) {
			clearTimeout(TIMEOUT);
			TIMEOUT = null ;
		}
		freeze();
	});

	MAIN.on('show', function(e){
		console.log('show'); 
		load();
	});
	
	release();
}

function unbind ( ) {
	console.log('unbind'); 	
	try { MAIN.off('click') ; }     catch ( e ) { }
	try { MAIN.off('longClick') ; } catch ( e ) { }
	try { MAIN.off('hide') ; }      catch ( e ) { }
	try { MAIN.off('show') ; }      catch ( e ) { }	
}

// main

unfreeze();
if ( DATA !== null ) {
	_update_stop_index();
	_display();
}
if ( LAT !== null && LON !== null ) load();
geostart();