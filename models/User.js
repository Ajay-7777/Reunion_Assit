const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});
userSchema.methods.generateAuthToken = function() {
  const token = jwt.sign({ _id: this._id }, 'mysecretkey');
  

    console.log('Token generated:', token);
  
  return token;
};
const User = mongoose.model('User', userSchema);
module.exports = User;