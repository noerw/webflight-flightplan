(function(window, document, $) {
  var Flightplan = function(cockpit) {

    console.log('Loading flightplan plugin.');
    this.basePath = '/plugin/flightplan/'
    this.cockpit = cockpit;
    this.cockpit.socket.on('/flightplan/commands', function(commandList) {
      this.vue.availableCmds = commandList;
    }.bind(this));

    $('.main-container').append('<div class="hidden" id="flightplan"></div>');
    $('#controls').prepend('<input type="button" id="flightplan-toggle" value="Toggle Flightplan"/>');
    
    $('#flightplan-toggle').click(function(e) { 
      $('#flightplan').toggleClass('hidden');
      this.map.invalidateSize(false);
    }.bind(this));

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
          snapGrid: true,
          waypoints: {},
          selectedWP: { id: 0, cmds: [], height: undefined },
        },
        methods: {
          addCommand: function() {
            if (!this.newCommand) return;
            this.commandList.push([this.newCommand, this.newParam || 0]);
            this.newParam = '';
          },
          deleteCommand: function(e) {
            this.commandList.splice($(e.target).parent().parent().data('index'), 1);
          },
          runMission: function() {
            if (!this.vue.commandList.length)
              this.vue.buildMapCommands();

            if (this.vue.commandList.length)
              this.cockpit.socket.emit('/flightplan/run', this.vue.commandList);
          }.bind(this),
          abortMission: function() {
            this.cockpit.socket.emit('/flightplan/stop');
          }.bind(this),

          toggleMap: function(e) {
            if ($(e.target).val() === 'show map editor') {
              $(e.target).val('show command list');
            }else{
              $(e.target).val('show map editor');
              this.vue.buildMapCommands();
            }
            $('#flightplan-map-container, #flightplan-table').toggleClass('hidden');
            this.map.invalidateSize(false); // fixes display of grid on hidden maps
          }.bind(this),
          buildMapCommands: function(e) {
            // add commands from each point in order
            var p = this.waypoints[0].next, ll, goParam;
            this.commandList = [];
            while (p) {
              ll = p.getLatLng();
              goParam = '{"x":' + ll.lat + ',"y":' + ll.lng;
              if (p.height !== undefined) goParam += ',"z":' + p.height;
              this.commandList.push(['go', goParam +  '}']);

              for (var cmd of p.cmds)
                this.commandList.push([cmd[0], cmd[1]]);

              p = p.next;
            }
          },
          addCmdToWP: function() {
            if (!this.newCommand) return;
            this.waypoints[this.selectedWP.id].cmds.push([this.newCommand, this.newParam || 0]);
            this.newParam = '';
          },
          editHeight: function(e) {
            this.waypoints[this.selectedWP.id].height = e.target.value;
          },
          deleteCmdFromWP: function(e) {
            this.waypoints[this.selectedWP.id].cmds
              .splice($(e.target).parent().parent().data('index'), 1);
          },
          deleteWaypoint: function(e) {
            var p = this.vue.waypoints[this.vue.selectedWP.id];
            this.map.removeLayer(p.line).removeLayer(p).removeLayer(this.mapPopup);

            p.prev.next = p.next;
            if (p.next) {
              p.next.prev = p.prev;
              p.next.line.removeFrom(this.map);
              p.next.line = L.polyline([p.prev.getLatLng(), p.next.getLatLng()]).addTo(this.map);
            } else {
              this.lastPoint = p.prev;
            }

            // TODO: fix vue destroy thingy (bc manual compile of manual compile of popup dom?!)
            Vue.delete(this.vue.waypoints, this.vue.selectedWP.id);
            this.vue.selectedWP.id = 0;
            this.vue.selectedWP.cmds = [];
          }.bind(this)
        }
      });

      $.get(this.basePath + 'popup.html', {}, this.initMap.bind(this));

    }.bind(this));
  };

  Flightplan.prototype.initMap = function(popupContent) {
    L.Icon.Default.imagePath = this.basePath + 'images';
    this.map = L.map('flightplan-map', { center: [0, 0], minZoom: -2, zoom: 7, crs: L.CRS.Simple });

    this.mapGrid = L.simpleGraticule({
      interval: 1,
      zoomIntervals: [
        {start: -2, end: 0, interval: 100},
        {start: 1, end: 2, interval: 20},
        {start: 3, end: 5, interval: 5},
        {start: 5, end: 7, interval: 1},
        {start: 7, end: 20, interval: 0.5}
      ]
    }).addTo(this.map);

    this.mapPopup = L.popup({ 
      minWidth: 380, maxWidth: 600, offset: L.point(0,0)
    }).setContent(popupContent);

    // linked list, containing all the points
    this.vue.waypoints = { 0: L.marker([0,0]).bindPopup('HOME').addTo(this.map)};
    this.lastPoint = this.vue.waypoints[0];

    // add marker to map on click
    this.map.on('click', function(e) {
      // TODO: adapt to gridsize from simple graticule
      var ll = this.vue.snapGrid ? snapToGrid(this.mapGrid, e.latlng) : e.latlng;
      var point = L.circleMarker(ll, {radius: 7, fillOpacity: 1}).addTo(this.map);

      point.prev = this.lastPoint;
      point.next = null;
      point.line = L.polyline([this.lastPoint.getLatLng(), ll], {
        interactive: false
      }).addTo(this.map);
      point.height = undefined;
      point.cmds = [];

      point.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        this.mapPopup.setLatLng(e.target.getLatLng()).openOn(this.map);
        this.vue.selectedWP.id = e.target._leaflet_id;
        //TODO: improve handling of cmds array, no proxy needed?!
        this.vue.selectedWP.cmds = this.vue.waypoints[e.target._leaflet_id].cmds;
        this.vue.selectedWP.height = this.vue.waypoints[e.target._leaflet_id].height;
        
        // need to manually compile, as the popup node is dynamically added to the DOM
        // TODO: improve handling?
        this.vue.$compile($(this.mapPopup._contentNode).get(0));
      }, this);

      // linked list "add" logic
      this.vue.waypoints[point._leaflet_id] = point;
      this.lastPoint.next = point;
      this.lastPoint = point;
    }, this);
  };

  function snapToGrid(grid, latlng) {
    var g = grid.options.interval;
    return L.latLng(snap(g, latlng.lat), snap(g, latlng.lng));
  
    function snap(gridSize, val) {
      return gridSize * Math.round(val/gridSize);
    }
  }

  window.Cockpit.plugins.push(Flightplan);

}(window, document, jQuery));
