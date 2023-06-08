import * as MC from '@minecraft/server';

/**@typedef {{method:'command'}} sendOption*/
/**@typedef {{ports:String[],packName:String}} queryResponse*/
/**@type {Record<String,String|false>}*/
let ports={}; //openingPort
/**@type {Record<String,Function>}*/
const messageListeners={};

let packName='Unknown';

/**
 * last queryAllPacks() result.
 * @type {Record<String,queryResponse>}
*/
const lastQueryResult={};

/*
    TODO: ScriptToScript.
    Use Scoreboard to Send Data to Other Listening Scripts.
    Use Scoreboard to Set Listening Scripts.
     OR
    Use Custom Entity with Inventory to Communicate.
*/

const tick=()=>{
    Object.entries(ports).forEach(messageInfo=>{
        if(messageInfo[1].endsWith('▐')){ //ALT+222: endfetch
            if(messageListeners[messageInfo[0]]==null) return;

            try{
                messageListeners[messageInfo[0]](messageInfo[1].substring(0,messageInfo[1].length-1), messageInfo[0]); //emit
            }catch{};

            ports[messageInfo[0]]='';
        }
    })
}

MC.system.runInterval(tick,20);

MC.system.events.scriptEventReceive.subscribe(data=>{
    if(data.id=='rrb:fetch'){
        const targetPort=data.message.substring(0,data.message.indexOf(' '));
        let message=data.message.substring(data.message.indexOf(' ')+1) .replace(/%%/g, '%').replace(/%@/g, '@');

        if(ports[targetPort]==null) return;

        ports[targetPort]+=message;
        tick(); //TODO: optimize
    }else if(data.id=='rrb:fetch-query-ports'){
        /**@type {queryResponse}*/
        const about={
            packName:packName,
            ports:Object.keys(ports)
        }

        send(data.message,JSON.stringify(about));
    }
}, {namespaces:['rrb']});

MC.world.beforeEvents.chatSend.subscribe(data=>{
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
 * @param {sendOption} option
 * 
 * @returns {undefined}
*/
const send=async (port,message,option={method:'command'})=>{
    if(typeof port == 'number') port=port.toString();
    if(port.includes(' ')) throw new Error('port field is only working with string with no whitespace or number. but given has.');
    if(typeof message!= 'string') throw new Error('message field must be a string. given: '+typeof message);

    //message to chunks
    const chunks=splitByChunk(message.replace(/\%/g, '%%').replace(/@/g, '%@'),100);

    if(option.method==null||option?.method=='command'){
        const overworld=MC.world.getDimension('overworld');
     	await new Promise(res=>MC.system.run(res));
        for(let messageChunk of chunks){
            overworld.runCommand(`scriptevent rrb:fetch ${port} ${messageChunk}`);
        }
        overworld.runCommand(`scriptevent rrb:fetch ${port} ▐`);
    }else{
        throw new Error('unknown send method: '+option?.method);
    }
}

/**
 * set the name visible in other pakcs when get query request.
 * @param {String} name
*/
const setName=name=>{
    packName=name;
    return true;
}

/**
 * @returns {Array<String>} array of port(string)
*/
const getOpenedPorts=()=>Object.keys(ports);

/**
 * @param {String|Number} port
 * close given port.
*/
const closePort=port=>{
    if(typeof port == 'number') port=port.toString();

    return delete ports[port];
}

/**
 * send port query for all ports to each packs.
*/
const queryAllPacks=async ()=>{
    const overworld=MC.world.getDimension('overworld');
    /**@type {Record<String,queryResponse>}*/
    let result={};

    overworld.runCommandAsync('scriptevent rrb:fetch-query-ports INTERNAL-QUERY'); //send query and return responses to internal-query.

    await new Promise(res=>{
        let exited=false;
        listen('INTERNAL-QUERY',message=>{
            /**@type {queryResponse}*/
            const data=JSON.parse(message);
            result[data.packName]=data;
            
            MC.system.runTimeout(()=>{
                if(exited==true) return;

                exited=true;
                closePort('INTERNAL-QUERY');
                res();
            },20);
        });
        MC.system.runTimeout(()=>{
            if(exited==true) return;

            exited=true;
            closePort('INTERNAL-QUERY');
            res(); //timeout
        },200)
    });

    return result;
}

export {
    listen,
    openPort,
    send,
    getOpenedPorts,
    closePort,
    queryAllPacks,
    lastQueryResult,
    setName
}
