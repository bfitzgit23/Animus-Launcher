const { app, ipcRenderer, shell } = require('electron');
const process = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const request = require('request');

let $ = require('jquery');  

var configFile = "";
var default_config = '{"fps": 60,"ram": 2048,"zoom": 1}';
 
ipcRenderer.send('get-user-data-path');
ipcRenderer.on('user-data-path', (event, userDataPath) => {
	configFile = path.join(userDataPath, "launcher-settings.json");
    console.log('User data path:', userDataPath);
	if (fs.existsSync(configFile)) {
		console.log("Reading existing config: "+configFile);
	    config = JSON.parse(fs.readFileSync(configFile));
	} else {
		console.log("Setting default config");
		config = JSON.parse(default_config);
		console.log("Writing default config to file: "+configFile);
		fs.writeFileSync(configFile, JSON.stringify(config));
	}
	init_post_config();
});

ipcRenderer.on('selected-directory', function (event, dir) {
	console.log(dir);
	$("#gamepath").val(dir);
	if (!fs.existsSync(path.join(dir, 'qt-mt305.dll'))) {
		alert("This is not a valid SWG directory.");
	} else {
		config.gamepath = dir;
		if (configFile != "") {
			save_config();
		} else {
			alert("Unable to read config file, please restart launcher.");
		}		
	}
});

function init_post_config() {
	// Load config into settings panel.
	if (config.gamepath) {
		$("#gamepath").val(config.gamepath);
	}
	if (config.fps) {
		$("#fps").val(config.fps);
	}
	if (config.zoom) {
		$("#zoom").val(config.zoom);
	}
	if (!config.gamepath || config.gamepath == "") {
		show_row(".gamesettings");
	} else {
		check_for_updates();
	}
}

var total_patches = 0;
var on_patch = 0;
var percentage = 0;

function show_row(slug) {
	$(".gamesettings").hide();
	$(".patching").hide();
	$(".patching-success").hide();
	$(slug).show();
}

function update_progress() {
	percentage = (on_patch / total_patches) * 100;
	$('.progress-patching-main').css('width', percentage+'%'); 	

	if (on_patch == total_patches) {
		$(".btn-play").removeAttr("disabled");
		show_row(".patching-success");
	}
}

function check_for_updates() {
	on_patch = 0;
	percentage = 0;	
	$('.progress-patching-main').css('width', '0%');
	show_row(".patching");
	$.getJSON("http://launcher.swg-animus.com/tres/patch-manifest.json?"+Math.floor(Date.now() / 1000), function(data) {
		total_patches = arrayLength(data);
		$.each(data, function(index, patch) {
			var file_name = path.join(config.gamepath, patch.filename);
			if (fs.existsSync(file_name)) {
				console.log("Tre file found: "+file_name+"");
				getChecksum(path.join(config.gamepath, patch.filename))
				.then(checksum => {
					if (patch.md5 != checksum) {
						console.log(`Mismatched checksum expected ${patch.md5} got ${checksum}`);
						download_save_file("http://launcher.swg-animus.com/tres/"+patch.filename, file_name);
					} else {
						console.log(`checksum matches ${patch.md5} = ${checksum}`);
						on_patch++;
						update_progress();						
					}
				})
				.catch(err => console.log(err));
			} else {
				console.log(file_name+" doesn't exist, redownloading.");
				download_save_file("http://launcher.swg-animus.com/tres/"+patch.filename, file_name);
			}
		});
	});
}

function download_save_file(url, location) {
	console.log("Downloading "+url+" to "+location);
	var requestSettings = {
	    method: 'GET',
	    url: url,
	    encoding: null
	};
	request(requestSettings, (error, response, body) => {
	    if (error) console.log(error)
	    console.log("URL: "+url+" returned "+response.statusCode);
	    fs.writeFileSync(location, body);
		on_patch++;
		update_progress();
	});
}

function save_config() {
	if ($("#gamepath").val() == "") {
		alert("You must select an SWG directory.");
	} else if ($("#fps").val() == "") {
		alert("You must enter an FPS value.");
	} else if ($("#zoom").val() == "") {
		alert("You must enter a Camera Zoom Level value.");
	} else if ($("#fps").val() < 30 || $("#fps").val() > 240) {
		alert("FPS out of range.");
	} else if ($("#zoom").val() < 1 || $("#zoom").val() > 10) {
		alert("Camera Zoom Level out of range.");
	} else {
		if (!fs.existsSync(path.join($("#gamepath").val(), 'qt-mt305.dll'))) {
			alert("This is not a valid SWG directory.");
		} else {
			save_config_conf = {};
			save_config_conf.gamepath = $("#gamepath").val();
			save_config_conf.fps = $("#fps").val();
			save_config_conf.zoom = $("#zoom").val();
			console.log("Saving settings "+JSON.stringify(save_config_conf));
			config = save_config_conf;
			fs.writeFileSync(configFile, JSON.stringify(save_config_conf));
			check_for_updates();
		}
	}
}

function play() {
    // Write config and launch game.
    fs.writeFileSync(path.join(config.gamepath, "swgemu_login.cfg"), `[ClientGame]\r\nloginServerAddress0=login.swg-animus.com\r\nloginServerPort0=44453\r\nfreeChaseCameraMaximumZoom=${config.zoom}`);
    var args = ["--",
        "-s", "ClientGame", "loginServerAddress0=login.swg-animus.com", "loginServerPort0=44453",
        "-s", "Station", "gameFeatures=34929",
        "-s", "SwgClient", "allowMultipleInstances=true"];
    var env = Object.create(require('process').env);
    env.SWGCLIENT_MEMORY_SIZE_MB = config.ram;
    const child = process.spawn("SWGEmu.exe", args, { cwd: config.gamepath, env: env, detached: true, stdio: 'ignore' });
    child.unref();
}

function getChecksum(path) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const input = fs.createReadStream(path);
      input.on('error', reject);
      input.on('data', (chunk) => {
          hash.update(chunk);
      });
      input.on('close', () => {
          resolve(hash.digest('hex'));
      });
    });
}

function arrayLength(arr) {
   let count = 0;
   for (const element of arr) {
     count++;
   }
   return count; 
}

// UI Bindings
$(".btn-play").click(function(e){
	e.preventDefault();
	play();
});

$(".game-settings-link").click(function(e){
	e.preventDefault();
	show_row(".gamesettings");
});

$(".gamepath-browser").click(function(){
	ipcRenderer.send('open-directory-dialog', 'selected-directory');
});

$(".btn-save-settings").click(function(e) {
	e.preventDefault();
	save_config();
});

$(".discord-link").click(function(e){
	e.preventDefault();
	shell.openExternal("https://discord.gg/Jhm3mDbh");
});

$(".website-link").click(function(e){
	e.preventDefault();
	shell.openExternal("https://www.swg-animus.com/");
});

$(".website-register-link").click(function(e){
	e.preventDefault();
	shell.openExternal("https://register.swg-animus.com/");
});