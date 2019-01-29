const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const express = require('express');
const fileUpload = require('express-fileupload');
const neo4j = require('neo4j-driver').v1;
const app = express();
var router = express.Router();

neo4jdriver = neo4j.driver(
  "bolt://localhost:7687", neo4j.auth.basic("neo4j", "toor"),
  { encrypted: false }
);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  preserveExtension: true,
  createParentPath: true
}));

router.post('/import-map', function (req, res, next) {
  let file = req.files.selectedFile;

  let fileName = `${__dirname}\\public\\${file.name}`;

  file.mv(fileName, function (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'origin, content-type, accept');
    // if (err) {
    //   return res.status(500).send(err);
    // }

    const session = neo4jdriver.session();

    let escapedFileName = fileName.replace(/[\\]/g, "\\\\");
    console.log(escapedFileName);

    let query = `CALL spatial.importOSM('${escapedFileName}')`;

    let query2 = `MATCH (a)-[r:CHANGESET]->(b) DELETE r`;
    let query3 = `MATCH (a)-[rel:TAGS]->(b)
                  WHERE EXISTS(b.restriction)
                  DELETE b,rel`;
    let query4 = `MATCH (d)<-[:NODE]-(c)<-[rel:NEXT]-(a)-[:NODE]->(b)
                  CREATE (b)-[:PATH {length: rel.length}]->(d)`;
    let query5 = `MATCH (a)-[next_rel:NEXT]->(b)-[node_rel:NODE]->(c)
                  DELETE next_rel, node_rel`;
    let query6 = `MATCH (p)-[fn_rel:FIRST_NODE]-(fn)-[:NODE]->(b)
                  CREATE (p)-[:FIRST_PATH]->(b)`;
    let query7 = `MATCH (p)-[first_node_rel:FIRST_NODE]-(fn)-[node_rel:NODE]->(b)
                  DELETE first_node_rel, node_rel`;
    let query8 = `MATCH (odd_node)-[node_rel:NODE]->()
                  DELETE node_rel, odd_node`;
    let query9 = `MATCH (n)
                  WHERE EXISTS(n.timestamp)
                  SET n.timestamp = NULL`;
    let query10 = `MATCH (n)
                  WHERE EXISTS(n.version)
                  SET n.version = NULL`;
    let query11 = `MATCH (n)
                  WHERE EXISTS(n.changeset)
                  SET n.changeset = NULL`;

    session
      .run(query, {
        fileName: fileName
      });
    session.run(query2);
    session.run(query3);
    session.run(query4);
    session.run(query5);
    session.run(query6);
    session.run(query7);
    session.run(query8);
    session.run(query9);
    session.run(query10);
    session.run(query11);
    session.close();

    res.json({ fileName: fileName });
  });
});

app.use('/', router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
