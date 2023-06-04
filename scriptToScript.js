import * as MC from '@minecraft/server';

/**@type {Record<String,String|false>}*/
let ports={}; //openingPort
/**@type {Record<String,Function>}*/
const messageListeners={};

/*
    TODO: ScriptToScript.
    Use Scoreboard to Send Data to Other Listening Scripts.
    Use Scoreboard to Set Listening Scripts.
     OR
    Use Custom Entity with Inventory to Communicate.
     OR
    Use /scriptevent Command to Fetch Messages.
*/

MC.system.runInterval(()=>{
    Object.entries(ports).forEach(messageInfo=>{
        if(messageInfo[1].endsWith('▐')){ //ALT+222: endfetch
            if(messageListeners[messageInfo[0]]==null) return;

            messageListeners[messageInfo[0]](messageInfo[1].substring(0,messageInfo[1].length-1), messageInfo[0]); //emit

            ports[messageInfo[0]]='';
        }
    })
},20);

MC.system.events.scriptEventReceive.subscribe(data=>{
    if(data.id=='rrb:fetch'){
        const targetPort=data.message.substring(0,data.message.indexOf(' '));
        let message=data.message.substring(data.message.indexOf(' ')+1) .replace(/%%/g, '%').replace(/%@/g, '@');

        if(ports[targetPort]==null) return;

        ports[targetPort]+=message;
    }
}, {namespaces:['rrb']});

MC.world.events.beforeChat.subscribe(data=>{
    if(data.message.startsWith('#eval')){
        if(!data.sender.hasTag('permission:eval')) return;
        data.message=data.message.substring(6);
        console.warn(eval(data.message));
    }
})


const splitByChunk=(text,size)=>{
    const chunkCount=Math.ceil(text.length/size);
    const chunkList=new Array(chunkCount);

    let currentPos=0;
    for(let i=0;i<chunkCount;i++){
        chunkList[i]=(text.substring(currentPos,currentPos+size));
        currentPos+=size;
    }

    return chunkList;
}



/**
 * @param {String|Number} port
 * @deprecated use listen(). this function just opens port and does nothing when a message comes in.
 * @returns {boolean}
*/
const openPort=port=>{
    if(typeof port == 'number') port=port.toString();

    if(ports[port]!=null) return false;
    ports[port]=''; //init
    return true;
}

/**
 * @param {String|Number} port
 * @param {(message:String,port:String)=>void} callback
 * @returns {boolean}
*/
const listen=(port,callback)=>{
    if(typeof port == 'number') port=port.toString();

    if(ports[port]!=null) return false;
    ports[port]=''; //init
    messageListeners[port]=callback; //subscribe event;
    return true;
}

/**
 * @param {String|Number} port target port. only working with string with no whitespace or number.
 * @param {String} message message to be sent to the target
 * @param {'command'} method
 * 
 * @returns {undefined}
*/
const send=(port,message,method='command')=>{
    if(typeof port == 'number') port=port.toString();
    if(port.includes(' ')) throw new Error('port field is only working with string with no whitespace or number. but given has.');
    if(typeof message!= 'string') throw new Error('message field must be a string. given: '+typeof message);

    //message to chunks
    const chunks=splitByChunk(message.replace(/\%/g, '%%').replace(/@/g, '%@'),100);

    if(method=='command'){
        const overworld=MC.world.getDimension('overworld');
        for(let messageChunk of chunks){
            overworld.runCommand(`scriptevent rrb:fetch ${port} ${messageChunk}`);
        }
        overworld.runCommand(`scriptevent rrb:fetch ${port} ▐`);
    }
}

export {
    listen,
    openPort,
    send
}