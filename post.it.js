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
			if(!this.has('id')) {
				this.set({ id: this.guid() });
			}
			var model = this;
			this.bind('change', function() {
				if(model.room) {
					model.room.changeNote(model.toJSON());
				}
		},
		guid: function () {
			var res = [], hv, rgx = new RegExp('[2345]');
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
			socket.on('connection', function(client) {
				client.emit('lights' + (model.get('lights') ? 'On' : 'Off'));
				var clientsConnected = function() {
					return _(client.manager.connected).keys().length;
				};
				model.get('notes').each(function(note) {
					client.emit('note', note.toJSON());
				});
			    client.emit('clientsConnected', clientsConnected());
			    client.broadcast.emit('clientsConnected', clientsConnected());
				client.on('disconnect', function() {
				    client.broadcast.emit('clientsConnected', clientsConnected());
				});
				model.initializeEvents(client);
			});
			model.initializeEvents(socket);
		},
		initializeEvents: function(socket) {
			var manager = socket.manager;
			var model = this;
			socket.on('lightsOn', function() {
				model.set({ lights: true });
				if(manager) {
					socket.broadcast.emit('lightsOn');
				}
			});
			socket.on('lightsOff', function() {
				model.set({ lights: false });
				if(manager) {
					socket.broadcast.emit('lightsOff');
				}
			});
			socket.on('clientsConnected', function(data) {
				model.set({ clientsConnected: data });
			});
			socket.on('note', function(data) {
				var note = model.note(data);
				if(manager) {
					socket.broadcast.emit('note', note.toJSON());
				}
			});
		},
		toggleLights: function() {
			this.set({ lights: !this.get('lights') });
			this.socket().emit('lights' + (this.get('lights') ? 'On' : 'Off'));
		},
		socket: function() {
			return this.get('socket');
		},
		addNote: function(data) {
			this.socket().emit('note', this.note(data, true).toJSON());
		},
		changeNote: function(data) {
			this.socket().emit('note', this.note(data, true).toJSON());
		},
		note: function(data, silent) {
			var model = this;
			var note = model.get('notes').get(data.id);
			if(!note) {
				note = new postit.Note(data);
				note.room = model;
				model.get('notes').add(note);
			}
			note.set(data, { silent: silent });
			return note;
		}
	});

	/* VIEWS */
	postit.NoteView = root.Backbone.View.extend({
		tagName: 'div',
		className: 'note',
		initialize: function() {
			this.model.bind('change', function() {
				this.setPosition();
			}, this);
		},
		render: function() {
			var model = this.model;
			this.setPosition();
			$(this.el).draggable({
				stop: function(e) {
					model.set({ x: e.pageX, y: e.pageY });
				}
			});
			return this;
		},
		setPosition: function() {
			$(this.el).css({ position: 'absolute', left: this.model.get('x'), top: this.model.get('y') });
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
				model.addNote({ x: e.pageX, y: e.pageY });
			});
			model.bind('change:lights', function() {
				$('.light').toggleClass('on', model.get('lights'));
			});
			model.bind('change:clientsConnected', function(data) {
				$('.clientsConnected').html(model.get('clientsConnected'));
			});
			model.get('notes').bind('add', function(note) {
				var view = new postit.NoteView({ model: note });
				$(this.el).append(view.render().el);
			}, this);
			model.bind('destroy', this.remove, this);
		},
	});

})(this);