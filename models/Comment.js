const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  comment: String,
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdTime: { type: Date, default: Date.now },
  });
  
  const Comment = mongoose.model('Comment', commentSchema);

module.exports=Comment;