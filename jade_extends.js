var express = require('express');
var app = express();
app.set('view engine', 'jade');
app.set('/views','jade');
app.get('/view',(req,res)=>{
    res.render('view');
})

app.get('/add',(req,res)=>{
    res.render('add');
})
app.listen(3000,()=>{
    console.log('Connect 3000 port!')
})