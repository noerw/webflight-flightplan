var autonomy = require('ardrone-autonomy'),
  arDroneConstants = require('ar-drone/lib/constants'),
  sockets = [],
  client = null,
  mission = null;

var legitCmds = [
  'takeoff', 'land', 'hover', 'wait',
  'forward', 'backward', 'left', 'right', 'up', 'down', 'cw', 'ccw',
  'go', 'altitude', 'yaw',
];

function Flightplan(name, deps) {
  client = deps.client;

  deps.io.on('connection', function(socket) {
    sockets.push(socket);
    socket.emit('/flightplan/commands', legitCmds);

    socket.on('/flightplan/stop', stopMission);
    socket.on('/flightplan/run', runMission);
  });
};

function runMission(missionData) {
  if (mission)
    return logClient('mission already running!', 'error');

  mission = initMission();

  // insert takeoff if mission does not begin with one
  if (missionData[0][0] !== 'takeoff')
    mission.takeoff();

  // add each command to mission plan (& filter allowed cmds)
  for (var cmd of missionData) {
    var param = undefined;
    try { param = JSON.parse(cmd[1]); } catch(e) {
      return logClient('invalid command parameter: ' + cmd[1], 'error');
    }

    if (legitCmds.indexOf(cmd[0]) === -1 || typeof mission[cmd[0]] !== 'function')
      return logClient('invalid mission command: ' + cmd[0] + '.<br> Legit commands are: ' +  legitCmds.toString(), 'error');

    mission[cmd[0]](param);
  }

  // insert landing if mission does not begin with one
  if (missionData[missionData.length - 1][0] !== 'land')
    mission.land();

  logClient('mission started!', 'success');
  mission.run(function (err, result) {
    if (err)
      logClient('<b>error during mission! aborting</b><br>' + err.message, 'error');
    else
      logClient('mission completed!', 'success');
    
    stopMission();
  });
};

function stopMission() {
  if (!mission) return;
  mission.control().disable();
  mission.client().stop();
  mission.client().land();
  mission = null;
  logClient('mission stopped!')
}

function initMission(logPath) {
  var controller = new autonomy.Controller(client);
  mission = new autonomy.Mission(client, controller);

  var navdata_options = (
      navdata_option_mask(arDroneConstants.options.DEMO)
    | navdata_option_mask(arDroneConstants.options.VISION_DETECT)
    | navdata_option_mask(arDroneConstants.options.MAGNETO)
    | navdata_option_mask(arDroneConstants.options.WIFI)
  );

  mission.client().config('general:navdata_demo', true);
  mission.client().config('general:navdata_options', navdata_options);
  mission.client().config('video:video_channel', 1);
  mission.client().config('detect:detect_type', 12);
  
  if (logPath) mission.log(logPath);

  mission.zero();
  return mission;

  function navdata_option_mask(c) {
    return 1 << c;
  }
}

function logClient(message, type) {
  console.log('Flightplan: ' + message);
  for (var s of sockets)
    s.emit('/' + (type || 'message'), '<b>Flightplan:</b> ' + message);

}

module.exports = Flightplan;
