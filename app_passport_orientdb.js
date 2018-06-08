var express = require('express');
var session = require('express-session');
var OrientoStore = require('connect-oriento')(session);
var bodyParser = require('body-parser');
var bkfd2Password = require("pbkdf2-password");
var hasher = bkfd2Password();
//[passport] 1. passport require;
var passport = require('passport');
//[passport] 2. passport-local require & Strategy;
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;


var OrientDB = require('orientjs');
var server = OrientDB({
    host :'localhost',
    port : 2424,
    username :'root',
    password : 'chtn6361'
});
var db = server.use('o2');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: '1234DSFs@adf1234!@#$asd',
  resave: false,
  saveUninitialized: true,
  store:new OrientoStore({
      server :'host=localhost&port=2424&username=root&password=chtn6361&db=o2'
  })
}));


//[passport] 3. passport use init / session;
//[passport] 3-1 . session위에 반드시 use session이 있어야 함!
app.use(passport.initialize());
app.use(passport.session());
app.get('/count', function(req, res){
  if(req.session.count) {
    req.session.count++;
  } else {
    req.session.count = 1;
  }
  res.send('count : '+req.session.count);
});
app.get('/auth/logout', function(req, res){
  req.logout();
  req.session.save(()=>{
    res.redirect('/welcome');
  })
});
app.get('/welcome', function(req, res){
    console.log('welcome~',req.user);
  if((req.user && req.user.displayname)) {
    res.send(`
    <h1>Hello, ${req.user.displayname}</h1>
    <a href="/auth/logout">logout</a>
    `);
  } else {  
    res.send(`
      <h1>Welcome</h1>
      <ul>
        <li><a href="/auth/login">Login</a></li>
        <li><a href="/auth/register">Register</a></li>
      </ul>
    `);
  }
});
app.route('/auth/login')
.get((req,res)=>{
    console.log(req.user)
    var output = `
    <h1>Login</h1>
    <form action="/auth/login" method="post">
      <p>
        <input type="text" name="username" placeholder="username">
      </p>
      <p>
        <input type="password" name="password" placeholder="password">
      </p>
      <p>
        <input type="submit">
      </p>
    </form>
    <a href='/auth/facebook'>facebook</a>
    `;
    res.send(output);
});

passport.serializeUser((user,done)=>{
  console.log('serializeUser',user);
  done(null,user.authId);
});
passport.deserializeUser((id,done)=>{
  console.log('deserializeUser ~~~~',id);
  var sql="SELECT displayname FROM user WHERE authId=:authId";
  db.query(sql,{params:{authId:id}}).then((results)=>{
    if(results.length===0){
        done('There is no user.');
    }else{
        var result = results[0];
        done(null, result);
    }
  })
})
//[passport] 4. passport use LocalStrategy 설정 auth할 로직을 생성
passport.use(new LocalStrategy(
    function (username, password,done){
      console.log(password);
      var uname = username;
      var pwd = password;

      var sql ='SELECT * FROM user WHERE authId = :authId';
      db.query(sql,{params:{authId :'local:'+uname}}).then((results)=>{
        console.log('LocalStrategy results',results);
        if(results.length===0){
            return done(null,false);
        }
        var user = results[0];
        return hasher({password:pwd,salt:user.salt},(err,pass,salt,hash)=>{
            if(hash===user.password){
                console.log('LocalStrategy',user);
                done(null,user);
            }else{
                done(null,false);
            }
        });
      })
    }
));

passport.use(new FacebookStrategy({
  clientID :'426207831185511',
  clientSecret : '8317c2b5c82035d79665623d9a96b55e',
  callbackURL :'/auth/facebook/callback'
},
(accessToken,refreshToken,profile,done)=>{
  console.log(profile);
  var authId ='facebook:'+profile.id;
  var dispName = profile.displayName;
  // var email = profile.emails[0].value;
  var sql ='SELECT * FROM user WHERE authId =:authId';
  db.query(sql,{params:{authId : authId}}).then((results)=>{
    if(results.length===0){
      var sql ='INSERT INTO user (authId,displayname,email) VALUES(:authId,:dispName,:email)';
      var newuser = {
        'authId' : authId,
        'dispName' : dispName,
        'email' : 'close852@naver.com'
      }
      console.log('newuser : ',newuser);
      db.query(sql,{params:newuser}).then((results2)=>{
        console.log(results2)
        done(null,newuser);
      },(err)=>{
        console.log(err);
        done('Error');
      })
    }else{
      done(null,results[0]);
    }
  })

  // User.fildOrCreate(a,(err,user)=>{
  //   if(err){return done(err);}
  //   done(null,user);
  // })
}));
//[passport] 5. passport post, auth 해서 success와 fail의 redirection을 설정함.;
app.post(
  '/auth/login',
  passport.authenticate(
    'local',
    {
    //   successRedirect : '/welcome',
      failureRedirect : '/auth/login',
      failureFlash :  false//'Invalid username or password.'
    }
  )
  ,(req,res)=>{
      console.log('auth/login post!');
        req.session.save(()=>{
            res.redirect('/welcome');
    })
  }
);

app.get(
  '/auth/facebook',
  passport.authenticate(
    'facebook'
  )
);
app.get(
  '/auth/facebook/callback',
  passport.authenticate(
    'facebook',{
      // successRedirect :'/welcome',
      failureRedirect :'/auth/login',
      failureFlash :false
    }
  ),(req,res)=>{
    return req.session.save(()=>{
      res.redirect('/welcome');
    })
  }
);
// ,(req,res)=>{
//     var uname = req.body.username;
//     var pwd = req.body.password;
//     for(var i=0; i<users.length; i++){
//       var user = users[i];
//       if(uname === user.username) {
//         return hasher({password:pwd, salt:user.salt}, function(err, pass, salt, hash){
//           if(hash === user.password){
//             req.session.displayName = user.displayName;
//             req.session.save(function(){
//               res.redirect('/welcome');
//             })
//           } else {
//             res.send('Who are you? <a href="/auth/login">login</a>');
//           }
//         });
//       }
//     }
//     res.send('Who are you? 2<a href="/auth/login">login</a>');
// });
var users = [
  {
    authId :'local:cjw',
    username:'cjw',
    //111111
    password:'mTi+/qIi9s5ZFRPDxJLY8yAhlLnWTgYZNXfXlQ32e1u/hZePhlq41NkRfffEV+T92TGTlfxEitFZ98QhzofzFHLneWMWiEekxHD1qMrTH1CWY01NbngaAfgfveJPRivhLxLD1iJajwGmYAXhr69VrN2CWkVD+aS1wKbZd94bcaE=',
    salt:'O0iC9xqMBUVl3BdO50+JWkpvVcA5g2VNaYTR5Hc45g+/iXy4PzcCI7GJN5h5r3aLxIhgMN8HSh0DhyqwAp8lLw==',
    displayName:'최지우'
  }
];
app.post('/auth/register', function(req, res){
  hasher({password:req.body.password}, function(err, pass, salt, hash){
    var sql='INSERT INTO user(authId, username, password, salt, displayname) VALUES(:authId, :username, :password, :salt, :disp)';    
    db.query(sql,{
        params:{
            authId : 'local:'+req.body.username,
            username:req.body.username,
            password:hash,
            salt:salt,
            disp:req.body.displayName
        }
    }).then((results)=>{
        req.login(user,(err)=>{
            req.session.save(()=>{
                return res.redirect('/welcome');
            })
        })
    },(err)=>{
        console.log(err);
        res.status(500);
    })
  });
});
app.get('/auth/register', function(req, res){
  var output = `
  <h1>Register</h1>
  <form action="/auth/register" method="post">
    <p>
      <input type="text" name="username" placeholder="username">
    </p>
    <p>
      <input type="password" name="password" placeholder="password">
    </p>
    <p>
      <input type="text" name="displayName" placeholder="displayName">
    </p>
    <p>
      <input type="submit">
    </p>
  </form>
  `;
  res.send(output);
});
app.get('/',(req,res)=>{
  res.redirect('/welcome');
})
app.listen(3000, function(){
  console.log('Connected 3000 port!!!');
});