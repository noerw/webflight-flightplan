var autonomy = require('ardrone-autonomy'),
  arDroneConstants = require('ar-drone/lib/constants'),
  socket, client, mission = null;

var legitCmds = [
  'takeoff', 'land', 'hover', 'wait',
  'forward', 'backward', 'left', 'right', 'up', 'down', 'cw', 'ccw',
  'go', 'altitude', 'yaw',
];

function Flightplan(name, deps) {
  client = deps.client;

  deps.io.on('connection', function(sock) {
    socket = sock;
    socket.emit('/flightplan/commands', legitCmds);

    socket.on('/flightplan/stop', stopMission);
    socket.on('/flightplan/run', runMission);
  });
};

function runMission(missionData) {
  var valid = validateMissionData(missionData);

  if (mission)
    return logClient('mission already running!', 'error');

  mission = initMission();

  if (!valid.hasTakeoff)
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

  if (!valid.hasLanding)
    mission.land();

  logClient('mission started!', 'success');
  mission.run(function (err, result) {
    if (err) {
      mission.client().stop();
      mission.client().land();
      logClient('<b>error during mission! aborting</b><br>' + err.message, 'error');
    } else {
      logClient('mission completed!', 'success');
    }
    mission = null;
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

function validateMissionData(missionData) {
  var result = { hasTakeoff: true, hasLanding: true };

  if (missionData[0][0] !== 'takeoff')
    result.hasTakeoff = false;
  if (missionData[missionData.length -1][0] !== 'land')
    result.hasLanding = false;

  return result;
}

function initMission(logFile) {
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
  
  if (logFile) mission.log(logFile);

  mission.zero();
  return mission;

  function navdata_option_mask(c) {
    return 1 << c;
  }
}

function logClient(message, type) {
  console.log('Flightplan: ' + message);
  socket.emit('/' + (type || 'message'), '<b>Flightplan:</b> ' + message);
}

module.exports = Flightplan;
