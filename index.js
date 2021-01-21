const { HostedModel } = require('@runwayml/hosted-models');
const express = require('express');
const http = require("http").Server(express);
const app = express();
var topic = null;
const messages = {};
const onlineUsers = []
/*const server = app.listen(3001, function() {
    console.log('server running on port 3001');
});*/
const model = new HostedModel({
    url: "https://friends-7a6294b5.hosted-models.runwayml.cloud/v1/",
    token: "irM6gNAUSLuqhuPTwgRd8Q==",
});

const io = require('socket.io')(http,{
    cors: {
        origin: '*',
      }
});
http.listen(process.env.PORT || 5000, () => {
    console.log("Listening at",process.env.PORT || 5000);
});

io.on('connection', function(socket) {
    console.log('connected')
    let username;
    if(topic && topic.length) {
        io.to(socket.id).emit('MESSAGE',{
            isTopic:true,
            topic:topic
        });
    }
    socket.on('SEND_MESSAGE', function(data) {
        if(data.intro) {
            username = data.user;
            onlineUsers.push(data);
            let obj = {
                intro:true,
                users:[data]
            }
            if(data.fromChat) {
                obj.fromChat = true;
            }
            io.emit('MESSAGE', obj)
        } else {
            if(data.isTopic) {
                topic = data.topic;
            } else {
                if(data.fetchUsers) {
                    let obj = {
                        intro:true,
                        users:onlineUsers
                    }
                    if(data.fromChat) {
                        obj.fromChat = true
                    }
                    io.to(socket.id).emit('MESSAGE',obj);
                } else {
                    if(data.fetchMessages) {
                        io.to(socket.id).emit('MESSAGE', {
                            initalLoad:true,
                            messages:messages['0'],
                            fromChat:true
                        })
                    } else {
                        let seed = Math.floor(Math.random()*300);
                        let context = '';
                        let contextStart = 0;
                        if(messages['0'] && messages['0'].length) {
                            let length = messages['0'].length;
                            if(length-2 >= 0) {
                                context = context + messages['0'][length-2]['user'] + ': ' + messages['0'][length-2]['message'] + '\n';
                                contextStart = 2;
                            } else {
                                contextStart = 1;
                            }
                            context = context + messages['0'][length-1]['user'] + ': ' + messages['0'][length-1]['message'] + '\n';
                        }
                        for(let i=0;i<onlineUsers.length;i++) {
                            let reg = new RegExp(onlineUsers[i].name.toLowerCase(), "g");
                            data.message = data.message.toLowerCase().replace(reg,onlineUsers[i].user.toLowerCase());
                            context = context.toLowerCase().replace(reg,onlineUsers[i].user.toLowerCase());
                        }
                        let prompt = context + data.character.toLowerCase() + ': ' + data.message + '\n' + data.character.toLowerCase() + ':';
                        const inputs = {
                            "prompt": prompt,
                            "max_characters": 300,
                            "top_p": 0.9,
                            "seed": seed
                        }
                        model.query(inputs).then(async function(outputs) {
                            const { generated_text, encountered_end } = outputs;
                            let splittext = generated_text.split("\n");
                            let formedstring = '';
                            let changed = 0;
                            for(let i=contextStart;i<splittext.length; i++) {
                                let str = splittext[i].split(':');
                                if(changed == 0 && str.length >=2 && str[0] ==  data.character.toLowerCase()) {
                                    changed = 1;
                                } else {
                                    if(changed == 1 && str.length >=2 && str[0] !=  data.character.toLowerCase()) {
                                        changed = 2;
                                    }
                                }

                                if(changed == 1 && str.length >=2) {
                                    formedstring = formedstring + str[1] + ' ';
                                } else {
                                    if(changed == 1 && str.length == 1) {
                                        formedstring = formedstring + str[0] + ' ';
                                    }
                                }
                            }
                            formedstring = formedstring.trim();
                            for(let i=0;i<onlineUsers.length;i++) {
                                let reg = new RegExp(onlineUsers[i].user.toLowerCase(), "g");
                                formedstring = formedstring.toLowerCase().replace(reg,onlineUsers[i].name.toLowerCase())
                            }
                            let chararrar = ['chandler','joey','monica','phoebe','rachel','ross'];
                            for(let i=0;i<chararrar.length;i++) {
                                let reg = new RegExp(chararrar[i].toLowerCase(), "g");
                                formedstring = formedstring.toLowerCase().replace(reg,'a friend')
                            }
                            let newdata = {
                                newMessage:true,
                                user:data.user, 
                                message: formedstring,
                                character:data.character
                            }
                            if(!messages['0']) {
                                messages['0'] = [];
                            }
                            messages['0'].push(newdata);
                            io.emit('MESSAGE', newdata)
                        })
                        .catch((err) =>{
                            console.log('ERR',err)
                        })
                        /*io.emit('MESSAGE', data);
                        if(!messages['0']) {
                            messages['0'] = [];
                        }
                        messages['0'].push(data);*/
                    }
                }
            }
        }
    });
    socket.on('disconnect', function() {
        let removeIndex = undefined
       for(let i=0;i<onlineUsers.length;i++) {
            if(!removeIndex == undefined && onlineUsers[i].user == username) {
                removeIndex = i;
            }
        }
        onlineUsers.splice(removeIndex,1);
        io.emit('MESSAGE', {
            reset:true,
            users:onlineUsers
        })
    });
});