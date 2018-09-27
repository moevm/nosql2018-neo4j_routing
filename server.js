const express = require('express');
const app = express();
const port = 8080;

const mongoClient = require("mongodb").MongoClient;
const dbUrl = "mongodb://localhost:27017/";

app.set("view engine", "ejs");

app.get('/api', (request, response) => {
    mongoClient.connect(dbUrl, (err, client) => {
      
        const db = client.db("local");
        const result = {status: 1};
        
        if(err){
            result.status = 0;
        }

        response.send(result);
    });
});

app.get('/', (request, response) => {
    response.render("main", {
        title: "ShopStats",
        text: "Welcome!"
    });
});

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`);
})