(function () {
	var root = this;
	if (typeof exports !== 'undefined') {
		root._ = require('underscore')._;
		root.Backbone = require('backbone');
		root.postit = exports;
	}
	else {
		root.postit = root.postit || {};
	}

	/* MODELS */
	postit.Note = root.Backbone.Model.extend({
		defaults: function() {
			return {
				text: 'New note...',
			};
		},
		initialize: function() {
			this.set({ id: this.guid() });
		},
		guid: function () {
			var res = [], hv;
			var rgx = new RegExp('[2345]');
			for (var i = 0; i < 8; i++) {
				hv = (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
				if (rgx.exec(i.toString()) != null) {
					if (i == 3) {
						hv = '6' + hv.substr(1, 3);
					}
					res.push('-');
				}
				res.push(hv.toUpperCase());
			}
			return res.join('');
		}
	});

	postit.NotesCollection = root.Backbone.Collection.extend({
		model: postit.Room
	});

	postit.Room = Backbone.Model.extend({
		defaults: function() {
			return {
				roomId: 'default',
				socket: null,
				light: false,
				notes: new postit.NotesCollection,
			};
		},
		initialize: function() {
			var model = this;
			var socket = this.socket();
			console.log(socket.manager);
			socket.on('connection', function(client) {
				client.emit('lights' + (model.get('lights') ? 'On' : 'Off'));
				var clientsConnected = function() {
					return _(client.manager.connected).keys().length;
				};
			    client.emit('clientsConnected', clientsConnected());
			    client.broadcast.emit('clientsConnected', clientsConnected());
				client.on('disconnect', function() {
				    client.broadcast.emit('clientsConnected', clientsConnected());
				});
				client.on('lightsOn', function() {
					model.set({lights: true});
					client.broadcast.emit('lightsOn');
				});
				client.on('lightsOff', function() {
					model.set({lights: false});
					client.broadcast.emit('lightsOff');
				});
			});
			socket.on('lightsOn', function() {
				model.set({lights: true});
			});
			socket.on('lightsOff', function() {
				model.set({lights: false});
			});
			socket.on('clientsConnected', function(data) {
				model.set({clientsConnected: data});
			});
		},
		initializeEvents: function(socket) {
			/*socket.on('lightsOn', function() {
				model.set({lights: true});
				socket.broadcast.emit('lightsOn');
			});
			socket.on('lightsOff', function() {
				model.set({lights: false});
				socket.broadcast.emit('lightsOff');
			});
			socket.on('clientsConnected', function(data) {
				model.set({clientsConnected: data});
			});*/
		},
		toggleLights: function() {
			this.set({lights: !this.get('lights')});
			this.socket().emit('lights' + (this.get('lights') ? 'On' : 'Off'));
		},
		socket: function() {
			return this.get('socket');
		},
		newNote: function(x, y, text) {
			var note = new postit.Note({ x: x, y: y, text: text });
			this.get('notes').add(note);
			this.socket().emit('newNote', note.toJSON());
		}
	});

	/* VIEWS */
	postit.NoteView = root.Backbone.View.extend({
		tagName: 'div',
		className: 'note',
		initialize: function() {
		},
		render: function() {
			$(this.el).css({ left: this.model.get('x'), top: this.model.get('y') });
			return this;
		},
		remove: function() {
			$(this.el).remove();
		},
		clear: function() {
			this.model.destroy();
		}
	});

	postit.RoomView = Backbone.View.extend({
		el: '#room',
		initialize: function() {
			var model = this.model;
			$(this.el).click(function(e) {
				var w = $('.background').width() / 680;
				var h = $('.background').height() / 545;
				if(e.pageX > 540 * w && e.pageX < 610 * w && e.pageY > 110 * h && e.pageY < 165 * h) {
					model.toggleLights();
				}
			});
			$(this.el).dblclick(function(e) {
				model.newNote(e.pageX, e.pageY);
			});
			model.bind('change:lights', function() {
				$('.light').toggleClass('on', model.get('lights'));
			});
			model.bind('change:clientsConnected', function(data) {
				$('.clientsConnected').html(model.get('clientsConnected'));
			});
			model.get('notes').bind('add', function(note) {
				var view = new postit.NoteView({model: note});
				$(this.el).append(view.render().el);
			}, this);
			model.bind('destroy', this.remove, this);
		},
	});

})(this);