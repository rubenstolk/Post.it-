$(document).ready(function() {
	var roomId = document.location.pathname.substring(1);
	var room = new postit.Room({
		roomId: roomId,
		socket: io.connect('/' + roomId)
	});
	var roomView = new postit.RoomView({model: room});
});