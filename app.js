var _ = require('underscore'),
	express = require('express'),
	port = 8000,
	app = express.createServer(),
	io = require('socket.io').listen(app),
	postit = require('./post.it.js');

app.get('/*.*', function(req, res) {
	res.sendfile('./' + req.url);
});

app.configure( function () {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
});

var rooms = {};

io.set('log level', 1);

app.get('/*', function (req, res) {
	var roomId = req.params[0] || 'default';
	rooms[roomId] = rooms[roomId] || new postit.Room({
		roomId: roomId,
		socket: io.of('/' + roomId)
	});
	res.render('room', {});
});

app.listen(port, function() {
	console.log('Server started on port ' + port);
});

