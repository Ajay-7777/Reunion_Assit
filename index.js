require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const Comment = require('./models/Comment');
const Post = require('./models/Post');
const User = require('./models/User');

const app = express();
const port = process.env.PORT || 3002;
app.use(cookieParser());
// app.use(express.json);
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true,family:4 })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('Error connecting to MongoDB', err)); 


app.use(bodyParser.json());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  const saltRounds=10;
  
  bcrypt.hash(password, saltRounds, async (err, hash) => {
    if (err) {
      console.error(err);
      return;
    }
    const user = new User({
      email: email,
      password: hash // use the hashed password here
    });
    await user.save();  
    res.send(user);
  });
});


// Middleware function to authenticate user
const authenticateUser = async (req, res, next) => {
  try {
    
    const token=req.cookies.jwt;
    const decoded = jwt.verify(token, "mysecretkey");
    const user = await User.findOne({ _id: decoded._id });
    if (!user) {
      throw new Error();
    }
    req.user = user;
    req.token = token;
    next();
  } catch (e) {
   
    res.status(401).send( 'Please authenticate' );
  }
};


app.post('/api/authenticate', async (req, res) => {

  const { email, password } = req.body; 
  if (!email || !password) return res.status(400).send('Email and password are required');
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('Invalid email or password');

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) return res.status(400).send('Invalid email or password');
  const token =await user.generateAuthToken();
  await res.cookie("jwt",token,{
        expires:new Date(Date.now()+6000000),
        httpOnly:true,
        // secure:true for https
      });
  res.send(token);
}); 
 
app.post('/api/follow/:id',authenticateUser, async (req, res) => {

  const user = await User.findById(req.user._id);

  if(!user)  return res.status(401).send('Access denied. No token provided.');
  const userToFollow = await User.findById(req.params.id);
  if (!userToFollow) return res.status(404).send('User not found'); 

  if (user.following.includes(userToFollow._id)) {
    return res.status(400).send('You are already following this user');
  }
 
  user.following.push(userToFollow._id);     
  userToFollow.followers.push(user._id); 
 
  await user.save();
  await userToFollow.save();
 
  res.send('You are now following ' + userToFollow.name);
});


app.post('/api/unfollow/:id',authenticateUser, async (req, res) => {
  const user = await User.findById(req.user._id);
  // console.log(user)
  if (!user) return res.status(401).send('Access denied. No token provided.');
  
  const userToUnfollow = await User.findById(req.params.id);
  if (!userToUnfollow) return res.status(404).send('User not found');

  if (!user.following.includes(userToUnfollow._id)) {
    return res.status(400).send('You are not following this user');
  }

  const userIndex = user.following.indexOf(userToUnfollow._id);
  if (userIndex > -1) {
    user.following.splice(userIndex, 1);
  }

  const userToUnfollowIndex = userToUnfollow.followers.indexOf(user._id);
  if (userToUnfollowIndex > -1) {
    userToUnfollow.followers.splice(userToUnfollowIndex, 1);
  }

  await user.save();
  await userToUnfollow.save();

  return res.status(200).send('You have unfollowed ' + userToUnfollow.name);
});


app.get('/api/user',authenticateUser, async (req, res) => {
  const user= req.user;
   
    res.send({
      name: user.name,
      followers: user.followers.length,
      following: user.following.length,
    });
});



app.post('/api/posts/',authenticateUser, async (req, res) => {
  if(!req.user){
      return res.status(400).json({ error: 'User ID is required' });
  }
 
const user = await User.findById(req.user._id);
if (!user) {
  return res.status(400).json({ error: 'User not found' });
}
if (!req.body.title) {
  return res.status(400).json({ error: 'Title is required' });
}

const { title, description } = req.body;
const post = new Post({
title,
description,
author: user._id,
});
await post.save();
res.send({
postId: post._id,
title: post.title,
description: post.description,
createdTime: post.createdTime,
});
});

app.delete('/api/posts/:id',authenticateUser,  async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id});
    if (!post) return res.status(404).send('The post with the given ID was not found or you are not authorized to delete it.');
    res.send('The post has been deleted.');
  } catch (error) {
  
    res.status(500).send('An error occurred while deleting the post.');
  }
});

app.post('/api/like/:id',authenticateUser, async (req, res) => {
  const user = await User.findById(req.user._id);
  const post = await Post.findById(req.params.id);

  if (!post) return res.status(404).send('The post with the given ID was not found.');
  const liked = post.likes.includes(user._id);
  if (liked) return res.status(400).send('You have already liked this post.');
  const newLikes = [...post.likes, user._id];
  await Post.updateOne({ _id: post._id }, { likes: newLikes });
 
  res.send('You have liked the post.');
});

    
app.post('/api/unlike/:id',authenticateUser, async (req, res) => {
  const user = await User.findById(req.user._id);
  const post = await Post.findById(req.params.id);
  
  if (!post) return res.status(404).send('The post with the given ID was not found.');
  
  const userIndex = post.likes.indexOf(user._id);
  
  if (userIndex === -1) {
    return res.status(400).send('You have not liked this post yet.');
  }
  
  post.likes.splice(userIndex, 1);
  
  await post.save();
  
  res.send('You have unliked the post.');
});



app.post('/api/comment/:id',authenticateUser, async (req, res) => {
const post = await Post.findById(req.params.id);
if (!post) return res.status(404).send('The post with the given ID was not found.');

const comment = new Comment({
comment: req.body.comment,
post: post._id,
});
const newComments = [...post.comments, req.body.comment];
await Post.updateOne({ _id: post._id },{ comments: newComments });
await comment.save();
res.send({
commentId: comment._id,
});
});

app.get('/api/posts/:id',authenticateUser, async (req, res) => {
const post = await Post.findById(req.params.id)
.populate('author', 'name')
.populate({
path: 'comments',
populate: {
path: 'user',
select: 'name',
},
});
if (!post) return res.status(404).send('The post with the given ID was not found.');

const numLikes = post.likes.length;
const numComments = post.comments.length;
const result = {
id: post._id,
title: post.title    ,
createdTime: post.createdTime,
comments: post.comments,
likes: post.likes.length
}
res.send(result)}
);

app.get('/api/all_posts',authenticateUser, async (req, res) => {
const user = await User.findById(req.user._id);
const posts = await Post.find({ author: user._id }).sort({ createdTime: -1 }).populate('comments.author', 'name');
const result = posts.map(post => ({
id: post._id,
title: post.title,
desc: post.description,
created_at: post.createdTime,
comments: post.comments,
likes: post.likes.length
}));
res.send(result);
});








const server=app.listen(port, () => console.log(`Listening on port ${port}...`));
 module.exports=server;