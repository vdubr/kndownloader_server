var express = require('express');
var app = express();
var MapitoKnDown = require('kndownloader')
var fs = require('fs');
var path = require('path');

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/kn', function (req, res) {

      var knID = req.query.id
      var format = req.query.format || 'shp'
      var srs = req.query.srs ? ('EPSG:' + req.query.srs) : 'EPSG:3857'

      if(knID && format && srs){
        // var knDown = MapitoKnDown({id:602191,format:'shp',projection:'EPSG:3857'}).stream()
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
              fs.unlinkSync(fullDirPath + 'data.zip')
              fs.rmdir(fullDirPath)
            };
          });
       })

      var ws = fs.createWriteStream(fullDirPath+'data.zip');

      knDown.pipe(ws);
      }
});

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

app.get('/stats', function (req, res) {
  var dirs = getDirectories('tmp')

  var byDays = {}
  console.log(dirs)
  var sum = 0
  dirs.forEach(function(dirName){
    sum++
    var knId = dirName.split('_')[1]
    var time = dirName.split('_')[0]
    var date = new Date()
    date.setTime(time)
    console.log(date)

    var dayId = date.getUTCFullYear() + '_' + date.getUTCMonth() + '_' + date.getUTCDate()
    if(!byDays[dayId]){
      byDays[dayId] = {kn:[]}
    }
    byDays[dayId]['kn'].push(knId)
  })
byDays['sum'] = sum
res.json(byDays)
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
