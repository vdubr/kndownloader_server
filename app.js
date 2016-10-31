var express = require('express');
var app = express();
var MapitoKnDown = require('kndownloader')
var fs = require('fs');
var path = require('path');
var request = require('request');
// var https = require('https');
var http = require('http');
var rimraf = require('rimraf');

var statsFilePath = './stats.json';
var appPort = 3000

var DEFAULTTYPES = ['boundary', 'parcel', 'zoning'];

var options = {
                cert: fs.readFileSync('./https/2_dubrovsky.eu.crt'),
                key: fs.readFileSync('./https/server.key')
};


app.use(/\/proxy|\/stats|\/getdata|\/kn/,function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  return next();
});

app.get('/getdata', function (req, res) {
  var path = req.query.path;
  if(path) {
    sendResponse(path, res);
  }
});

app.get('/proxy', function (req, res) {
  const queryIndex = req.originalUrl.indexOf('?');
  const url = req.originalUrl.substring(queryIndex + 1);

  request
    .get(url)
    .on('error', function(err) {
      console.log(err)
    })
    .pipe(res)
})

app.get('/kn', function (req, res) {
      clearOlderDirectories('tmp/', 100000);
      var knID = req.query.id
      var format = req.query.format || 'shp'
      var srs = req.query.srs ? ('EPSG:' + req.query.srs) : 'EPSG:3857'
      var types = req.query.types ? req.query.types.split(',') : DEFAULTTYPES;
      if(knID && format && srs){
        var knDown = MapitoKnDown({
          id:knID,
          format:format,
          projection:srs,
          types: types
        }).stream()

        var d =  new Date()
        var dirName =  d.getTime().toString() + '_' + knID
        var fullDirPath = './tmp/'+dirName+'/'

        if(!fs.existsSync('./tmp/')){
          fs.mkdirSync('./tmp/')
        }

        if(!fs.existsSync(fullDirPath)){
          fs.mkdirSync(fullDirPath)
        }

        var suffix = types.length >1 ? 'zip' : getSuffix(format);
        var savePath = fullDirPath + 'data.' + suffix;
        var ws = fs.createWriteStream(savePath);
        ws.on('finish', function() {
          //return path to data
          res.send(savePath);
        }.bind(this))

        ws.on('error', function() {
          console.log('errrrrr');
        }.bind(this))

        knDown.pipe(ws);
      }
});

var sendResponse = function(savePath, res, dirName) {
      var splitPath = savePath.split('/');
      var dirName = splitPath[splitPath.length-2];
      var origFileName = splitPath[splitPath.length-1];
      var origFileNameExtension = origFileName.split('.')[1];
      var fileName = dirName.split('_')[1];
      var readStream = fs.createReadStream(savePath);
      readStream.on('open', function () {
        res.setHeader('Content-Disposition', 'attachment; filename=\"'+fileName+'.'+origFileNameExtension+'"');
        readStream.pipe(res);
      });


      var had_error = false;
      readStream.on('error', function(err){
        had_error = true;
        console.log('erron on read transform file');
      });

      readStream.on('close', function(){
        console.log('close session');
        if (!had_error) {
          addStatsItem(dirName);
          //remove file on close session
          fs.unlinkSync(savePath);
        };
      });
}

function addStatsItem(knDirName) {
  var statsFile = fs.readFileSync(statsFilePath);
  var stats = JSON.parse(statsFile);

  stats.items.push(knDirName)
  stats.count = stats.count + 1;

  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 4))
}

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

app.get('/stats', function (req, res) {
  var statsFile = fs.readFileSync(statsFilePath);
  var stats = JSON.parse(statsFile);

  var byDays = {}
  var sum = 0
  stats.items.forEach(function(dirName){
    sum++
    var knId = dirName.split('_')[1]
    var time = dirName.split('_')[0]
    var date = new Date()
    date.setTime(time)

    var dayId = date.getUTCFullYear() + '_' + (date.getUTCMonth() + 1) + '_' + date.getUTCDate()
    if(!byDays[dayId]){
      byDays[dayId] = {kn:[]}
    }
    byDays[dayId]['kn'].push(knId)
  })
  byDays['sum'] = sum
  res.json(byDays)
});

// var server = https.createServer(options, app);
var server = http.createServer(app);

server.listen(appPort, function () {
  // var host = server.address().address;
  console.log('Example app listening at http://');
});



/**
 * @private
 */
var clearOlderDirectories = function(dataPath, maxAge) {
  var directories = fs.readdirSync(dataPath);
  directories.forEach(function(dir){
    removeDirIfIsOlder(dir, maxAge, dataPath)
  });
};


 /**
  * @param {string} directory
  * @private
  */
var removeDirIfIsOlder = function(directory, maxAge, dataPath) {
  console.log('DDD',directory);
  var spl = directory.split('_');
  if (spl.length === 2) {
    var dirTime = spl[0];
    var curTime = new Date();
    var timeDifference = curTime - dirTime;
    if (timeDifference > maxAge) {
      rimraf(dataPath + directory, function(err) {
        console.log('done delete');
      });
    }
  }else {
    rimraf(dataPath + directory, function(err) {
      console.log('done delete');
    });
  }
};



/**
 * Same as in NPM kndownloader
 * @param {formats} format
 * @return {string}
 * @private
 */
getSuffix = function(format) {
  var suffix;
  switch (format) {
    case 'shp':
      suffix = 'zip';
      break;
    default:
      suffix = format;
      break;
  }
  return suffix;
};
