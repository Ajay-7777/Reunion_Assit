const app = require('../index');
const request = require('supertest');
const chai = require('chai');
const chaiHttp = require('chai-http');
const User = require('../models/User');
const Post = require('../models/Post');
const { Cookie } = require('express-session');
const expect = chai.expect;
chai.use(chaiHttp);

describe('POST /api/authenticate', () => {
  
  it('should return a token for a valid user', (done) => {
    chai
      .request(app)
      .post('/api/authenticate')
      .send({
  email:"abcd1234@gmail.com",
   password:"passowrd1"
})
      .end((err, response) => {
        expect(err).to.be.null;
        expect(response).to.have.status(200);
        expect(response).to.have.property('text');
        done();
      });
  });
   
  it('should return an error for an invalid email', (done) => {
    chai
      .request(app)
      .post('/api/authenticate')
      .send({ email: 'invalid_email@example.com', password: 'valid_password' })
      .end((err, response) => {
        expect(err).to.be.null;
        expect(response).to.have.status(400);
        expect(response.text).to.equal('Invalid email or password');
        done();
      });
  });

  it('should return an error for an invalid password', (done) => {
    chai
      .request(app)
      .post('/api/authenticate')
      .send({ email: 'abcd1234@gmail.com', password: 'invalid_password' })
      .end((err, response) => {
        expect(err).to.be.null;
        expect(response).to.have.status(400);
        expect(response.text).to.equal('Invalid email or password');
        done();
      });
  });

  it('should return an error for missing email or password', (done) => {
    chai
      .request(app)
      .post('/api/authenticate')
      .send({})
      .end((err, response) => {
        expect(err).to.be.null;
        expect(response).to.have.status(400);
        expect(response.text).to.equal('Email and password are required');
        done();
      });
  });
});

describe('GET /api/user', () => {
  // We need to authenticate first in order to get a token to use in subsequent requests
  let authToken;

  before(async () => {
    const response = await chai
      .request(app)
      .post('/api/authenticate')
      .send({
        email:"abcd1234@gmail.com",
       password:"passowrd1"
    });

    authToken = response.text;
   
  });

  it('should return user profile data for a valid user', (done) => {
    chai
      .request(app)
      .get('/api/user')
      .set('Cookie', `jwt=${authToken}`)
      .end((err, response) => {
        expect(err).to.be.null;
      
        expect(response).to.have.status(200);
        expect(response.body).to.have.property('name');
        expect(response.body).to.have.property('followers');
        expect(response.body).to.have.property('following');
        done();
      });
  });

  it('should return an error for an invalid token', (done) => {
    chai
      .request(app)
      .get('/api/user')
      .set('Cookie',  `jwt=${authToken+1} `)
      .end((err, response) => {
        expect(err).to.be.null;
        expect(response).to.have.status(401);
        expect(response.text).to.equal('Please authenticate');
        done();
      });
  });
  
 
});






describe('POST /api/follow/:id', function() {
  let user1, user2;

  before(async function() {
    // Create two users for testing
    user1 = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password10'
    });

    user2 = await User.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password80'
    });
  });
  after(async()=>{
    await User.deleteMany({ name: { $in: ['Bob', 'Alice','User 1','User 2'] } });
  })
  it('should follow a user', async function() {
    const res = await chai.request(app)
      .post(`/api/follow/${user2._id}`)
      .set('Cookie',  `jwt=${user1.generateAuthToken()} `)
      .send({ users: { _id: user1._id } });

    expect(res).to.have.status(200);
    expect(res.text).to.equal('You are now following Bob');

    // Verify that user1 is now following user2
    const updatedUser1 = await User.findById(user1._id);
    const updatedUser2 = await User.findById(user2._id);

    expect(updatedUser1.following).to.include(user2._id);
    expect(updatedUser2.followers).to.include(user1._id);
  });

  it('should return an error if the user is already following the target user', async function() {
    // Make user1 follow user2 first
    await User.findByIdAndUpdate(user1._id, { $addToSet: { following: user2._id } });
    await User.findByIdAndUpdate(user2._id, { $addToSet: { followers: user1._id } });

    // Attempt to follow user2 again
    const res = await chai.request(app)
      .post(`/api/follow/${user2._id}`)
      .set('Cookie',  `jwt=${user1.generateAuthToken()} `)
      .send({ users: { _id: user1._id } });

    expect(res).to.have.status(400);
    expect(res.text).to.equal('You are already following this user');
  });

  it('should return an error if the target user is not found', async function() {
    // Attempt to follow a non-existent user
    const res = await chai.request(app)
      .post('/api/follow/6414563814b230d94de1e61d')
      .set('Cookie',  `jwt=${user1.generateAuthToken()} `)
      .send({ users: { _id: user1._id } });

    expect(res).to.have.status(404);
    expect(res.text).to.equal('User not found');
  });
});


describe('POST /api/unfollow/:id', function() {
  let user1;
  let user2;
  let token;

  before(async () => {
    // Create two users for testing
    user1 = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password1'
    });
    user2 = await User.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password8',
      followers: [user1._id],
      following: [user1._id]
    });

    // Get an access token for user1
    const loginRes = await chai
      .request(app)
      .post('/api/authenticate')
      .send({ email: 'alice@example.com', password: 'password1' });
    token = loginRes.text;
  });
  after(async()=>{
    await User.deleteMany({ name: { $in: ['Bob', 'Alice'] } });

  })


  it('should return an error if the user to unfollow is not found', async function() {
    const res = await chai.request(app)
      .post(`/api/unfollow/6414563814b230d94de1e61d`)
      .set('Cookie',  `jwt=${token}`)
      .send({ users: { _id: user1._id } });
    expect(res).to.have.status(404);
    expect(res.text).to.equal('User not found');
  });

  it('should return an error if the user is not following the user to unfollow', async function() {
    const res = await chai.request(app)
      .post(`/api/unfollow/${user2._id}`)
      .set('Cookie',  `jwt=${token}`)
      .send({ users: { _id: user1._id } });
    expect(res).to.have.status(400);
    expect(res.text).to.equal('You are not following this user');
  });

});
describe('POST /api/posts', async () => {
  let user, token;

  before(async () => {
    user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password1'
    });
    const loginRes = await chai
      .request(app)
      .post('/api/authenticate')
      .send({ email: 'alice@example.com', password: 'password1' });
    token = loginRes.text;
  });


  it('should create a new post', async () => {
    const res = await request(app)
      .post('/api/posts/')
      .send({
        title: 'Test Post',
        description: 'This is a test post.'
      })
      .set('Cookie', `jwt=${token}`)
      .expect(200);
    expect(res.body).to.have.property('postId');
    expect(res.body).to.have.property('title', 'Test Post');
    expect(res.body).to.have.property('description', 'This is a test post.');
    expect(res.body).to.have.property('createdTime');
  });


 

  it('should return an error if title is missing', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({
        description: 'This is a test post.'
      })
      .set('Cookie', `jwt=${token}`)
      .expect(400);
    expect(res.body).to.have.property('error', 'Title is required');
  });
});
