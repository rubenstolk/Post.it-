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

	GUID = function () { var res = [], hv, rgx = new RegExp('[2345]'); for (var i = 0; i < 8; i++) { hv = (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1); if (rgx.exec(i.toString()) != null) { if (i == 3) { hv = '6' + hv.substr(1, 3); } res.push('-'); } res.push(hv.toUpperCase()); } return res.join(''); }

	/* MODELS */
	postit.Note = root.Backbone.Model.extend({
		defaults: function() {
			return {
				text: 'New note...',
				rotation: -30 + parseInt(60 * Math.random())
			};
		},
		initialize: function() {
			if(!this.has('id')) {
				this.set({ id: GUID() });
			}
			this.bind('change', function() {
				if(this.room) {
					this.room.setNote(this.toJSON(), true);
				}
			}, this)
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
			this.get('socket').on('connection', function(client) {
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
			model.initializeEvents(this.get('socket'));
		},
		initializeEvents: function(socket) {
			var model = this;
			socket.on('lightsOn', function() {
				model.set({ lights: true });
				if(socket.manager) {
					socket.broadcast.emit('lightsOn');
				}
			});
			socket.on('lightsOff', function() {
				model.set({ lights: false });
				if(socket.manager) {
					socket.broadcast.emit('lightsOff');
				}
			});
			socket.on('clientsConnected', function(data) {
				model.set({ clientsConnected: data });
			});
			socket.on('note', function(data) {
				var note = model.setNote(data);
				if(socket.manager) {
					socket.broadcast.emit('note', note.toJSON());
				}
			});
		},
		toggleLights: function() {
			this.set({ lights: !this.get('lights') });
			this.get('socket').emit('lights' + (this.get('lights') ? 'On' : 'Off'));
		},
		setNote: function(data, broadcast) {
			var model = this;
			var note = model.get('notes').get(data.id);
			if(!note) {
				note = new postit.Note(data);
				note.room = model;
				model.get('notes').add(note);
			}
			note.set(data, { silent: broadcast });
			if(broadcast) {
				this.get('socket').emit('note', note.toJSON());
			}
			return note;
		}
	});

	/* VIEWS */
	postit.NoteView = root.Backbone.View.extend({
		tagName: 'div',
		className: 'note',
		initialize: function() {
			this.model.bind('change', function() {
				this.update();
			}, this);
		},
		render: function(edit) {
			var model = this.model;
			var el = $(this.el);
			var text = $('<div class="text" />').appendTo(el);
			this.update();
			el.draggable({
				stop: function(e) {
					console.log(el.position());
					model.set(el.position());
				}
			}).dblclick(function(e) {
				e.stopPropagation();
				text.attr({ contentEditable: 'true' });
				text.get(0).focus();
				document.execCommand('selectAll', false, null);
			});
			text.blur(function() {
				model.set({ text: text.html() });
			});
			if(edit) {
				setTimeout(function() {
					text.trigger('dblclick');
				}, 1)
			}
			return this;
		},
		update: function() {
			$(this.el).css({
				position: 'absolute',
				'-webkit-transform': 'rotate(' + this.model.get('rotation') + 'deg)',
				left: this.model.get('left') + 'px',
				top: this.model.get('top') + 'px'
			})
			.find('.text').html(this.model.get('text'));
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
			var edit = false;
			$(this.el).dblclick(function(e) {
				edit = true;
				model.setNote({ left: e.pageX, top: e.pageY }, true);
			});
			model.bind('change:lights', function() {
				$('.light').toggleClass('on', model.get('lights'));
			});
			model.bind('change:clientsConnected', function(data) {
				$('.clientsConnected').html(model.get('clientsConnected'));
			});
			model.get('notes').bind('add', function(note) {
				var view = new postit.NoteView({ model: note });
				$(this.el).append(view.render(edit).el);
				edit = false;
			}, this);
			model.bind('destroy', this.remove, this);
		},
	});

})(this);