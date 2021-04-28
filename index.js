/*
 *
 * This uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
 * https://github.com/juniorxsound/THREE.Multiplayer
 * And a WEBRTC chat app made by Mikołaj Wargowski:
 * https://github.com/Miczeq22/simple-chat-app
 *
 * Aidan Nelson, April 2020
 *
 *
 */

// express will run our server
const express = require('express');
const http = require("http").Server(express);
const app = express();

// decide on which port we will use
const io = require('socket.io')(http,{
  cors: {
      origin: '*',
    }
});
http.listen(process.env.PORT || 5000, () => {
  console.log("Listening at",process.env.PORT || 5000);
});


// Network Traversal
// Could also use network traversal service here (Twilio, for example):
let iceServers = [
  { url: "stun:stun.l.google.com:19302" },
  { url: "stun:stun1.l.google.com:19302" },
  { url: "stun:stun2.l.google.com:19302" },
  { url: "stun:stun3.l.google.com:19302" },
  { url: "stun:stun4.l.google.com:19302" },
];
let messages = [];
// an object where we will store innformation about active clients
let clients = {};

function main() {
  setupSocketServer();

  setInterval(function() {
    // update all clients of positions
    io.sockets.emit("userPositions", clients);
  }, 10);
}

main();

function setupSocketServer() {
  // Set up each socket connection
  io.on("connection", (client) => {
    console.log('CONNECCTED')
    console.log(
      "User " +
        client.id +
        " connected, there are " +
        io.engine.clientsCount +
        " clients connected"
    );

    //Add a new client indexed by their socket id
    clients[client.id] = {
      position: [0, 0.5, 0],
      rotation: [0, 0, 0, 1], // stored as XYZW values of Quaternion
    };

    // Make sure to send the client their ID and a list of ICE servers for WebRTC network traversal
    client.emit(
      "introduction",
      client.id,
      io.engine.clientsCount,
      Object.keys(clients),
      iceServers
    );

    // also give the client all existing clients positions:
    client.emit("userPositions", clients);

    //Update everyone that the number of users has changed
    io.sockets.emit(
      "newUserConnected",
      io.engine.clientsCount,
      client.id,
      Object.keys(clients)
    );

    // whenever the client moves, update their movements in the clients object
    client.on("move", (data) => {
      if (clients[client.id]) {
        clients[client.id].position = data[0];
        clients[client.id].rotation = data[1];
      }
    });
    
    client.on("bowl-update", (data) => {
      console.log(data);
      io.sockets.emit("bowl-update-socket", data)
    });
    client.on("bowl-remove", (data) => {
      console.log(data);
      io.sockets.emit("bowl-remove-socket", data)
    });
    client.on("pose_puzzle", (data) => {
      console.log(data);
      io.sockets.emit("pose-puzzle", data)
    });
    client.on("state", (data) => {
      console.log(data);
      io.sockets.emit("gameStateUpdate", data)
    });
    client.on('send_message',(data) => {
      messages.push(data);
      console.log('PING',data)
      io.sockets.emit('new_message',data);
    });
    client.on('diary-puzzle',(data) => {
      io.sockets.emit('diary-update',data);
    });
    client.on('pose-puzzle',(data) => {
      io.sockets.emit('pose-update',data);
    })
    //Handle the disconnection
    client.on("disconnect", () => {
      //Delete this client from the object
      delete clients[client.id];
      io.sockets.emit(
        "userDisconnected",
        io.engine.clientsCount,
        client.id,
        Object.keys(clients)
      );
      console.log(
        "User " +
          client.id +
          " diconnected, there are " +
          io.engine.clientsCount +
          " clients connected"
      );
    });

    // from simple chat app:
    // WEBRTC Communications
    client.on("call-user", (data) => {
      console.log(
        "Server forwarding call from " + client.id + " to " + data.to
      );
      client.to(data.to).emit("call-made", {
        offer: data.offer,
        socket: client.id,
      });
    });

    client.on("make-answer", (data) => {
      client.to(data.to).emit("answer-made", {
        socket: client.id,
        answer: data.answer,
      });
    });

    // ICE Setup
    client.on("addIceCandidate", (data) => {
      client.to(data.to).emit("iceCandidateFound", {
        socket: client.id,
        candidate: data.candidate,
      });
    });
  });
}
