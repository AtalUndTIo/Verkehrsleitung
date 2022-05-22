var http = require("http");
var https = require("https");
var url = require('url');
var fs = require('fs');
var socketIO = require('socket.io');
var crypto = require('crypto');
var formidable = require('formidable');
var fsx = require('fs-extra');
var THREE = require("three.js");

const randoms = (length = 32) => {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
};

function hash(string){
	for(var i = 0; i < 10; i++){
		string = crypto.createHash('sha256').update(string).digest('base64').replace('/', '').replace('\\', '');
	}
	return string;
}

var world_settings = {
};

var trees = [
    {"x": 1, "z": 0, "model": "tree"},
    {"x": 1, "z": 5, "model": "tree"},
    {"x": -1.5, "z": 7, "model": "tree"},
    {"x": 2.5, "z": 10, "model": "tree"},
    {"x": -10, "z": 9, "model": "tree"},
    {"x": 1.5, "z": -5, "model": "tree"},
    {"x": 1.5, "z": -10, "model": "tree"},
    {"x": -14, "z": -10, "model": "tree"},
    {"x": 14, "z": 10, "model": "haus"},
    {"x": 13, "z": 12, "model": "tree"},
    {"x": 0, "z": -10, "model": "haus"},
    {"x": -5, "z": -12, "model": "tree"}
];

var world = [];
for(var ix = -15; ix <= 15; ix++){
	for(var iy = -15; iy <= 15; iy++){
		if(ix+"_"+iy in world_settings){
			world.push({"x": ix, "z": iy, "texture": world_settings[ix+"_"+iy]});
		} else {
		    world.push({"x": ix, "z": iy, "texture": "floor"});
		}
	}
}

exports.requestListener = function (request, response) {
	setTimeout(function(){
	    var path = url.parse(request.url).pathname;
	    var ip = (request.headers['x-forwarded-for'] || '').split(',')[0] || request.connection.remoteAddress;
	    
	    if(path.endsWith("/")){
			path += "index.html";
		}
		
		try {
			var filePath = __dirname + '/html'+path;
			if(fs.existsSync(filePath)) {
			    var ftype = "";
			    if(path.endsWith(".js")){
				    ftype = "application/javascript";
				}
			    var stat = fs.statSync(filePath);
			    response.writeHead(200, {'Content-Length': stat.size, "Content-Type": ftype, "Access-Control-Allow-Origin": "Allow"});
			    var readStream = fs.createReadStream(filePath);
			    readStream.pipe(response);
			} else {
				response.writeHead(404, {});
			    response.end();
			}
		} catch(e){}
	}, 0);
}

var sockets = {};
var cars = {};
var ampeln = {
	"1": {"id": "1", "farbe": "schwarz", "drehung": 0, "x": -3.2, "z": 1, "f": false},
	"2": {"id": "2", "farbe": "schwarz", "drehung": 3, "x": 0, "z": 1.6, "f": false},
	"3": {"id": "3", "farbe": "schwarz", "drehung": 2, "x": 0, "z": 4.5, "f": false},
	"4": {"id": "4", "farbe": "schwarz", "drehung": 1, "x": -3.2, "z": 4.5, "f": false},
	
	"5": {"id": "5", "farbe": "schwarz", "drehung": 3, "x": -3.2, "z": 1, "f": true, "zu": "1"},
	"6": {"id": "6", "farbe": "schwarz", "drehung": 1, "x": -0.4, "z": 1.6, "f": true, "zu": "1"},
	"7": {"id": "7", "farbe": "schwarz", "drehung": 2, "x": -3.2, "z": 1.6, "f": true, "zu": "2"},
	"8": {"id": "8", "farbe": "schwarz", "drehung": 0, "x": -3.2, "z": 4.5, "f": true, "zu": "2"},
	"9": {"id": "9", "farbe": "schwarz", "drehung": 3, "x": -3, "z": 4.2, "f": true, "zu": "3"},
	"10": {"id": "10", "farbe": "schwarz", "drehung": 1, "x": 0, "z": 4.5, "f": true, "zu": "3"},
	"11": {"id": "11", "farbe": "schwarz", "drehung": 0, "x": -0.2, "z": 4.2, "f": true, "zu": "4"},
	"12": {"id": "12", "farbe": "schwarz", "drehung": 2, "x": 0, "z": 1.6, "f": true, "zu": "4"},
};

var gedrückt = {};
var auto_ampel_phase = 0;

setInterval(function(){
	var neue_ampeln = {};
	Object.values(ampeln).forEach(function(a){
		neue_ampeln[a.id] = "rot";
	});
	if(Object.keys(gedrückt).length == 0){
		auto_ampel_phase++;
		if(auto_ampel_phase > 4){
			auto_ampel_phase = 1;
		}
		neue_ampeln[auto_ampel_phase.toString()] = "grün";
    } else {
		Object.keys(gedrückt).forEach(function(k){
			delete gedrückt[k];
			if(k == "1"){
				neue_ampeln["5"] = "grün";
				neue_ampeln["6"] = "grün";
			} else if(k == "2"){
				neue_ampeln["7"] = "grün";
				neue_ampeln["8"] = "grün";
			} else if(k == "3"){
				neue_ampeln["9"] = "grün";
				neue_ampeln["10"] = "grün";
			} else if(k == "4"){
				neue_ampeln["11"] = "grün";
				neue_ampeln["12"] = "grün";
			}
		});
	}
	
	Object.values(ampeln).forEach(function(a){
		if(neue_ampeln[a.id] != a.farbe){
			if(a.f == true){
				a.farbe = "rot";
			} else {
				a.farbe = "gelb";
			}
			setTimeout(function(){
				a.farbe = neue_ampeln[a.id];
			}, 600);
		}
	});
}, 5000);

function update_cars(){
	Object.values(cars).forEach(function(c){
		var rotation = c.r / (Math.PI /180) % 360;
		if(rotation < 0){
			rotation += 360;
		}
		var speedx = 0;
		var speedy = 0;
		if(rotation > 270 && rotation <= 360){
			speedy = (rotation-270)/90;
			speedx = 1-speedy;
		} else if(rotation > 180 && rotation <= 270){
			speedx = (rotation-180)/90;
			speedy = -(1-speedx);
		} else if(rotation > 90 && rotation <= 180){
			var y_speed = (rotation-90)/90;
			speedy = -y_speed;
			speedx = -(1-y_speed);
		} else if(rotation >= 0 && rotation <= 90){
			var x_speed = rotation/90;
			speedx = -x_speed;
			speedy = (1-x_speed);
		}
		
		
		if(c.t == "car"){
		 	c.z += -(c.speed/500*speedy);
	     	c.x += c.speed/500*speedx;
		    c.r += (c.lenkung*c.speed)/140000;
		} else {
			c.z += -(c.speed/1000*speedy);
		    c.x += c.speed/1000*speedx;
			c.r += c.joyx/30;
		}
	});
};
setInterval(update_cars, 50);

setInterval(function(){
	Object.values(sockets).forEach(function(s){
		s.emit("update_cars", Object.values(cars));
		s.emit("ampeln", Object.values(ampeln));
	});
}, 10);

exports.socketListener = function(socket){
	var socketid = randoms(16);
	sockets[socketid] = socket;
	var car_id = false;
	var name = false;
	var typ = false;
	
	socket.on("key_press", function(key){
		if(car_id != false){
			switch (key) {
			    case 37:
			        cars[car_id].lenkung = -100;
			        cars[car_id].joyx = 1.7;
			    break;
			
			    case 38:
			        cars[car_id].speed = -100;
			    break;
			
			    case 39:
			        cars[car_id].lenkung = 100;
			        cars[car_id].joyx = -1.7;
			    break;
			
			    case 40:
			       cars[car_id].speed = 100;
			    break;
			    
			    case 65:
			        cars[car_id].lenkung = -100;
			        cars[car_id].joyx = 1.7;
			    break;
			
			    case 87:
			        cars[car_id].speed = -100;
			    break;
			
			    case 68:
			        cars[car_id].lenkung = 100;
			        cars[car_id].joyx = -1.7;
			    break;
			
			    case 83:
			       cars[car_id].speed = 100;
			    break;
			}
	    }
	});
	socket.on("key_released", function(key){
		if(car_id != false){
			switch (key) {
			    case 37:
			        cars[car_id].lenkung = 0;
			        cars[car_id].joyx = 0;
			    break;
			
			    case 38:
			        cars[car_id].speed = 0;
			    break;
			
			    case 39:
			        cars[car_id].lenkung = 0;
			        cars[car_id].joyx = 0;
			    break;
			
			    case 40:
			       cars[car_id].speed = 0;
			    break;
			    case 65:
			        cars[car_id].lenkung = 0;
			        cars[car_id].joyx = 0;
			    break;
			
			    case 87:
			        cars[car_id].speed = 0;
			    break;
			
			    case 68:
			        cars[car_id].lenkung = 0;
			        cars[car_id].joyx = 0;
			    break;
			
			    case 83:
			       cars[car_id].speed = 0;
			    break;
			}
	    }
	});
	socket.on("mouse_pad", function(data){
		if(car_id != false){
			var new_speed = data.y;
			var new_lenkung = data.x;
			if(new_speed > 100){
				new_speed = 100;
			}
			if(new_speed < -100){
				new_speed = -100;
			}
			if(new_lenkung > 130){
				new_lenkung = 130;
			}
			if(new_lenkung < -130){
				new_lenkung = -130;
			}
			cars[car_id].speed = new_speed;
			if(cars[car_id].t == "car"){
			    cars[car_id].lenkung = new_lenkung;
			} else {
				cars[car_id].joyx = -(new_lenkung/70);
			}
	    }
	});
	socket.on("loaded", function(data){
		name = data.name;
		
		car_id = randoms(8);
		typ = data.typ;
		cars[car_id] = {"id": car_id, "x": -2.5, "z": 0, "r": 0, "speed": 0, "lenkung": 0, "t": typ, "joyx": 0, "name": name};
		
		socket.emit("add_plates", world);
		socket.emit("set_trees", trees);
		
		setTimeout(function(){
			socket.emit("set_camera", car_id);
		}, 100);
	});
	socket.on("collision", function(data){
		if(car_id != false){
			cars[car_id].x += data.x;
			cars[car_id].z += data.z;
		}
	});
	socket.on("press", function(data){
		if(car_id != false){
			gedrückt[data] = true;
		}
	});
	socket.on("message_popup", function(data){
		Object.values(sockets).forEach(function(s){
			s.emit("message_popup", data);
		});
	});
	socket.on('disconnect', () => {
		delete sockets[socketid];
		if(car_id != false){
			delete cars[car_id];
			car_id = false;
		}
	});
	socket.on('leave', () => {
		delete sockets[socketid];
		if(car_id != false){
			delete cars[car_id];
			car_id = false;
		}
	});
};
