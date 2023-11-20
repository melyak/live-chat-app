const express = require('express');
const http = require('http');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  }
});

mongoose.connect('mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  autoIndex: false, // Don't build indexes
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
}).then(() => {
  console.log("DB Connection Successfull.")
}).catch((err) => {
  console.log("Erorr mongoDB connection: ", err);
});

const Message = mongoose.model('Message', {
  roomId: String,
  sender: String,
  text: String,
});

io.on('connection', (socket) => {
  console.log('User connected');

  // Listen for joinRoom event
  socket.on('joinRoom', ({ username, roomId }, callback) => {
    // Perform validation
    if (!username || !roomId) {
      return callback({ success: false, message: 'Username and RoomID cannot be empty.' });
    }

    // Check if username is already taken in the room
    Message.findOne({ roomId, sender: username })
    .exec()
    .then((user) => {
      if (user) {
        return callback({ success: false, message: 'Username is already taken in this room.' });
      }
      // Join the room
      socket.join(roomId);
      callback({ success: true });

      // Notify everyone in the room that a new user has joined
      io.to(roomId).emit('roomJoined', { roomId, username });
    })
    .catch((error) => {
      // Handle any errors that occurred during the query
      console.error('Error finding user:', error);
      socket.emit('errorMessage', { error: 'Failed to finding user.'});
    });
  });

  // Listen for sendMessage event
  socket.on('sendMessage', ({ username, roomId, message }) => {
    const newMessage = new Message({ roomId, sender: username, text: message });

    newMessage.save().then(() => {
      io.to(roomId).emit('message', { sender: username, text: message });
    }).catch((error) => {
      console.log("Error newMessage: ", error)
      socket.emit('errorMessage', { error: 'Failed to save message to the database.'});
    })
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});