var express = require('express');
var app = express();
var MapitoKnDown = require('kndownloader')
var fs = require('fs');
var path = require('path');
var request = require('request');
// var https = require('https');
var http = require('http');

var statsFilePath = './stats.json';
var appPort = 3000

var options = {
                cert: fs.readFileSync('./https/2_dubrovsky.eu.crt'),
                key: fs.readFileSync('./https/server.key')
};


app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
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

      var knID = req.query.id
      var format = req.query.format || 'shp'
      var srs = req.query.srs ? ('EPSG:' + req.query.srs) : 'EPSG:3857'

      if(knID && format && srs){
        var knDown = MapitoKnDown({
          id:knID,
          format:format,
          projection:srs}
        ).stream()
        var d =  new Date()
        var dirName =  d.getTime().toString() + '_' + knID
        var fullDirPath = './tmp/'+dirName+'/'

        if(!fs.existsSync('./tmp/')){
          fs.mkdirSync('./tmp/')
        }

        if(!fs.existsSync(fullDirPath)){
          fs.mkdirSync(fullDirPath)
        }

       knDown.on('compressed',function(){
          var readStream = fs.createReadStream(fullDirPath+'data.zip');
          readStream.on('open', function () {
            readStream.pipe(res);
          });


          var had_error = false;
          readStream.on('error', function(err){
            had_error = true;
          });

          readStream.on('close', function(){
            if (!had_error) {
              addStatsItem(dirName);
              fs.unlinkSync(fullDirPath + 'data.zip');
              fs.rmdir(fullDirPath);
            };
          });
       })

      var ws = fs.createWriteStream(fullDirPath+'data.zip');

      knDown.pipe(ws);
      }
});

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
