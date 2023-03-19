const mongoose = require('mongoose');
const jwt=require('jsonwebtoken')

const postSchema = new mongoose.Schema({
  title: String,
  description: String,
  createdTime: { type: Date, default: Date.now },
  author: { type : mongoose.Schema.Types.ObjectId, ref: 'User' },
  comments: Array,
  likes:[{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}); 
const Post = mongoose.model('Post', postSchema);

module.exports = Post;