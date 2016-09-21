/**
 * Welcome to Pebble.js!
 *
 * This is where you write your app.
 */


var UI = require('ui');
var ajax = require('ajax');
var Vibe = require('ui/vibe');
// var Vector2 = require('vector2');

var STOP_ID = null ;
var LINE_ID = null ;
var STOP_INDEX = null ;
var LINE_INDEX = null ;
var ERROR = null ;
var DATA = null ;

var main = new UI.Card({
  scrollable: true,
  style: 'mono',
  title: '',
  icon: '',
  subtitle: '',
  body: '',
  subtitleColor: 'indigo', // Named colors
  bodyColor: '#9a0036' // Hex colors
});

main.show();

function api ( lat , lon ) {
	var n = 6 ;
	var m = 20 ;
	return 'https://stib-mivb-api.herokuapp.com/realtime/nclosest/' + n + '/' + lat + '/' + lon + '?max_requests=' + m ;
}

function title ( msg ) {
	console.log('title: ' + msg);
	main.title(msg);
}

function body ( msg ) {
	console.log('body: ' + msg);
	main.body(msg);
}

function subtitle ( msg ) {
	console.log('subtitle: ' + msg);
	main.subtitle(msg);
}

function _display ( ) {
	
	STOP_ID = DATA.stops[STOP_INDEX].id ;
	
	if ( DATA.stops[STOP_INDEX].realtime.error ) {
		title( DATA.stops[STOP_INDEX].name );
		subtitle( DATA.stops[STOP_INDEX].realtime.message );
		body(':(');
		return ;
	}
	
	if ( DATA.stops[STOP_INDEX].realtime.results.length === 0 ) {
		title(DATA.stops[STOP_INDEX].name);
		subtitle('nothing right now');
		body(':(');
		return ;
	}
	
	LINE_ID = DATA.stops[STOP_INDEX].realtime.results[LINE_INDEX].line ;
	
	var next = DATA.stops[STOP_INDEX].realtime.results[LINE_INDEX] ;
	var msg = next.line + ' ' + next.destination ;
	
	title( DATA.stops[STOP_INDEX].name );
	subtitle(msg) ;
	body(next.minutes) ;
	
	if ( next.minutes === 0 ) Vibe.vibrate('double');
}

function prev ( ) {
	if ( !DATA.stops[STOP_INDEX].realtime.error ) {
		--LINE_INDEX ;
		if ( LINE_INDEX < 0 ) {
			LINE_INDEX = DATA.stops[STOP_INDEX].realtime.results.length - 1 ;
		}
	}
	_display ( ) ;
}

function next ( ) {
	if ( !DATA.stops[STOP_INDEX].realtime.error ) {
		++LINE_INDEX ;
		if ( LINE_INDEX >= DATA.stops[STOP_INDEX].realtime.results.length ) {
			LINE_INDEX = 0 ;
		}
	}
	_display ( ) ;
}

function other ( ) {
	++STOP_INDEX ;
	LINE_INDEX = 0 ;
	if ( STOP_INDEX >= DATA.stops.length ) {
		STOP_INDEX = 0 ;
	}
	_display ( ) ;
}

function query ( position ) {
	
	var lat = position.coords.latitude;
	var lon = position.coords.longitude;
	var msg = '(' + lat + ' , ' + lon + ')' ;
	body(msg);
	
	ajax({ url: api(lat,lon), type: 'json' },
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
		setTimeout( load , 30000 ) ;
	  },
	  function(data, status, request) {
		title('ERROR');
		subtitle('API failed ' + status );
		body(data.message);
		bindload();
	  }
	);
}

function geofail(){
	title('ERROR');
	subtitle('could not load geolocation');
	body(':(');
	bindload();
}

function load(){
	
	unbind();
	
	title('Go');
	subtitle('loading...');
	body('');
	
	if(navigator && navigator.geolocation){
		var opts = {maximumAge:60000, timeout:5000, enableHighAccuracy:true};
		navigator.geolocation.getCurrentPosition(query, geofail, opts);
	}
	else{
		title('ERROR');
		subtitle('navigator is not enabled');
		body(':(');
		bindload();
	}
}

function bindload ( ) {
	main.on('click', 'select', function(e) { load() ; } ) ;
	main.on('click', 'down', function(e) { load() ; } ) ;
	main.on('click', 'up', function(e) { load() ; } ) ;
}

function bindnav ( ) {
	main.on('click', 'select', function(e) { other() ; } ) ;
	main.on('click', 'down', function(e) { next() ; } ) ;
	main.on('click', 'up', function(e) { prev() ; } ) ;
}

function unbind ( ) {
	main.on('click', 'select', function(e) { } ) ;
	main.on('click', 'down', function(e) { } ) ;
	main.on('click', 'up', function(e) { } ) ;
}

load();


/**
main.on('click', 'up', function(e) {
  var menu = new UI.Menu({
    sections: [{
      items: [{
        title: 'Pebble.js',
        icon: 'images/menu_icon.png',
        subtitle: 'Can do Menus'
      }, {
        title: 'Second Item',
        subtitle: 'Subtitle Text'
      }, {
        title: 'Third Item',
      }, {
        title: 'Fourth Item',
      }]
    }]
  });
  menu.on('select', function(e) {
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
  });
  menu.show();
});

main.on('click', 'select', function(e) {
  var wind = new UI.Window({
    backgroundColor: 'black'
  });
  var radial = new UI.Radial({
    size: new Vector2(140, 140),
    angle: 0,
    angle2: 300,
    radius: 20,
    backgroundColor: 'cyan',
    borderColor: 'celeste',
    borderWidth: 1,
  });
  var textfield = new UI.Text({
    size: new Vector2(140, 60),
    font: 'gothic-24-bold',
    text: 'Dynamic\nWindow',
    textAlign: 'center'
  });
  var windSize = wind.size();
  // Center the radial in the window
  var radialPos = radial.position()
      .addSelf(windSize)
      .subSelf(radial.size())
      .multiplyScalar(0.5);
  radial.position(radialPos);
  // Center the textfield in the window
  var textfieldPos = textfield.position()
      .addSelf(windSize)
      .subSelf(textfield.size())
      .multiplyScalar(0.5);
  textfield.position(textfieldPos);
  wind.add(radial);
  wind.add(textfield);
  wind.show();
});

main.on('click', 'down', function(e) {
  var card = new UI.Card();
  card.title('A Card');
  card.subtitle('Is a Window');
  card.body('The simplest window type in Pebble.js.');
  card.show();
});
*/