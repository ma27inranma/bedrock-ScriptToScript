# bedrock-ScriptToScript
supports script to script communication.

# to use
first pack:
```js
import {listen,send,queryAllPacks,setName} from './scriptToScript.js';
import {system} from '@minecraft/server';

setName('firstscript'); //name showed in query

listen('server', (message,port)=>{
  console.warn(message);

  if(message=='Hi!'){

    //Send Query
    queryAllPacks().then(res=>{
      console.log(`second script is listening on ${res.secondscript?.ports}.`);
    })

  }
})

system.runTimeout(()=>{
  send('another', 'Hello!')
},100); //send 5s later
```
in another pack:
```js
import {listen,send,setName} from './scriptToScript.js';

setName('secondscript');

listen('another', (message,port)=>{
  if(message=='Hello!'){
    send('server','Hi!');
  }
})
```
