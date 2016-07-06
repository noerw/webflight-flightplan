(function(window, document, $) {
  var Flightplan = function(cockpit) {

    console.log('Loading flightplan plugin.');
    this.basePath = '/plugin/flightplan/'
    this.cockpit = cockpit;

    this.cockpit.socket.on('/flightplan/commands', function(commandList) {
      console.log('recieved flightplan command list.');
      this.vue.availableCmds = commandList;
    }.bind(this));

    $('.main-container').append('<div class="hidden" id="flightplan"></div>');
    $('#controls').prepend('<input type="button" id="flightplan-toggle" value="Toggle Flightplan"/>');
    $('#flightplan-toggle').click( function(e) { $('#flightplan').toggleClass('hidden'); });

    $.get(this.basePath + 'flightplan.html', {}, function(template, status) {
      if (status !== 'success')
        return $('#flightplan').append('<h1>unable to load flightplan template :^( ' + status + '</h1>');

      $('#flightplan').append(template);

      this.vue = new Vue({
        el: '#flightplan',
        data: {
          availableCmds: [],
          commandList: [],
          newCommand: 'hover',
          newParam: '',
          snapGrid: true
        },
        methods: {
          addCommand: function() {
            if (!this.newCommand) return;
            this.commandList.push([this.newCommand, this.newParam || 0]);
          },
          deleteCommand: function(e) {
            this.commandList.splice($(e.target).parent().parent().data('index'), 1);
          },
          runMission: function() {
            if (this.vue.commandList.length)
              this.cockpit.socket.emit('/flightplan/run', this.vue.commandList);
          }.bind(this),
          abortMission: function() {
            this.cockpit.socket.emit('/flightplan/stop');
          }.bind(this),
          toggleMap: function(e) {
            $('#flightplan-map-container, #flightplan-table').toggleClass('hidden');
            this.map.invalidateSize(false); // fixes display of grid on hidden maps
            if ($(e.target).val() === 'show map editor') $(e.target).val('show command list');
            else $(e.target).val('show map editor');
          }.bind(this),
          buildMapCommands: function(e) {
            this.vue.commandList = [];
            for (var i = 0; i < this.mapPoints.length; i++) {
              var p = this.mapPoints[i];
              if (!p.marker || i === 0) continue;
              var ll = p.marker.getLatLng();
              var param = '{"x":' + ll.lat + ',"y":' + ll.lng;
              if (p.data && p.data.height !== undefined)
                param += ',"z":' + p.data.height;
              this.vue.commandList.push(['go', param +  '}']);
            }
            this.vue.toggleMap({target: '#flightplan-toggle-map'});
          }.bind(this)
        }
      });

      this.initMap();
    }.bind(this));
  };

  Flightplan.prototype.initMap = function() {
    L.Icon.Default.imagePath = this.basePath + 'images';
    this.map = L.map('flightplan-map', {
      center: [0, 0],
      minZoom: -2,
      zoom: 7,
      crs: L.CRS.Simple
    });

    this.mapPopup = L.popup()
      .setContent('asdf');

    L.simpleGraticule({
      interval: 1,
      zoomIntervals: [
        {start: -2, end: 0, interval: 100},
        {start: 1, end: 2, interval: 20},
        {start: 3, end: 5, interval: 5},
        {start: 5, end: 7, interval: 1},
        {start: 7, end: 20, interval: 0.5}
      ]
    }).addTo(this.map);

    // linked list, containing all the points
    this.mapPoints = [{ marker: L.marker([0,0]).bindPopup('HOME').addTo(this.map) }];
    this.lastPoint = this.mapPoints[0];

    // add marker to map on click
    this.map.on('click', function(e) {
      // TODO: adapt to gridsize from simple graticule
      var ll = this.vue.snapGrid ? [Math.round(e.latlng.lat), Math.round(e.latlng.lng)] : e.latlng;

      var point = {
        marker: L.marker(ll)
          .bindPopup(generatePopup(this.mapPoints.length))
          .addTo(this.map),
        line: L.polyline([this.lastPoint.marker.getLatLng(), ll], {
            interactive: false
          }).addTo(this.map),
        data: {},
        prev: this.lastPoint,
        next: null
      };

      // linked list "add" logic
      this.mapPoints.push(point);
      this.lastPoint.next = point;
      this.lastPoint = point;
    }, this);

    // load properties into popup
    this.map.on('popupopen', function(e) {
      var i = $(e.popup._content).data('index');
      if (i === null) return;
      $(e.popup._container)
        .find('input.height-input')
        .val(this.mapPoints[i].data.height);
    }, this);

    // save edited properties from popup
    this.map.on('popupclose', function(e) {
      var i = $(e.popup._content).data('index');
      if (i === null) return;
      this.mapPoints[i].data.height = $(e.popup._container).find('input.height-input').val();
    }, this);

    // delete marker on buttonclick
    $('#flightplan-map').on('click', 'input.remove-marker', function(e) {
      var i = $(e.target).parent().data('index');
      var p = this.mapPoints[i];
      p.line.removeFrom(this.map);
      p.marker.removeFrom(this.map);

      // linked list "delete" logic
      p.prev.next = p.next;
      if (p.next) {
        p.next.prev = p.prev;
        p.next.line.removeFrom(this.map);
        p.next.line = L.polyline([p.prev.marker.getLatLng(), p.next.marker.getLatLng()]).addTo(this.map);
      } else {
        this.lastPoint = p.prev;
      }
      this.mapPoints[i] = {};
    }.bind(this));

    function generatePopup(index) {
      return '<div data-index="' + index
        + '"><input class="height-input" type="number" placeholder="height (m)"/>'
        + '<input class="remove-marker" type="button" value="delete waypoint"/></div>';
    }
  };

  window.Cockpit.plugins.push(Flightplan);

}(window, document, jQuery));
