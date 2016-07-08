# webflight-flightplan

This is a [ardrone-webflight](https://github.com/eschnou/ardrone-webflight) plugin which allows planning of autonomous flights on a map in the browser.

## How it works
The plugin provides a *Flightplan* Overlay to webflight, which features a map and a command-table.
Basically it is a GUI to the [ardrone-autonomy](https://github.com/eschnou/ardrone-autonomy) `mission`-API.

![screenshot](https://raw.githubusercontent.com/noerw/webflight-flightplan/master/screenshot.png)

Adding Waypoints to the map by clicking will add the corresponding command to the commandlist.
Further commands at each waypoint may be added by clicking on it.
The command-table may be used as an overview of the mission, commands may be deleted and appended here, too.

You don't need to specify a `takeoff` or `land` command, these will be inserted automatically if missing.

For a list and specification of the commands, have a look at the ardrone-autonomy [docs](https://github.com/eschnou/ardrone-autonomy#mission)!

## Note about ardrone-autonomy
The ardrone-autonomy driver relies on the drones sensors and bottom-camera for state estimation, to monitor the traveled distance & yaw rotation and hold positions.

This means that the drone can not fly over floors / groundstructures without a texture / high contrast areas.
-> Indoor flights did not work well as of now!
See [this issue](https://github.com/eschnou/ardrone-autonomy/issues/8) for details.
([Tags](OBW-Roundel.png) in a non-uniform placement might improve the performance)

## Installing and enabling the plugin
Assuming you have installed `ardrone-webflight` in `./ardrone-webflight`, and have `node`, `npm` and `git` installed:

- clone this repository:        `git clone git@github.com:noerw/webflight-flightplan.git`
- install dependencies:         `cd webflight-flightplan && npm install`
- link the plugin to webflight: `ln -s ./ ../ardrone-webflight/plugins/flightplan`

To enable the installed plugin, just add it to the plugins array in webflight's `config.js`.
It might look something like this:

```js
plugins: [
  , "video-stream"
  , "hud"
  , "battery"
  , "pilot"
  , "gamepad"
  , "flightplan"
],

```

## License
Published under the [GPL-3.0](./LICENSE) license.
