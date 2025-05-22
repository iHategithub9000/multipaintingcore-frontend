


let ws;
let messageBuffer = [];
let messageCallback = null;
let world = [];
let renderContext = {width: 0, height: 0, cx: 0, cy: 0, ctx: null, zoom: 16}
let gotImages = false;
let shouldStart = false;
let mouseInfo = {clicking: false, sx: 0, sy: 0, mouseControlSwap: false, draggingInfo: {current: false, sx: 0, sy: 0, maxDelta: 6}}
let gameInfo = {holding: 0, messages: [], players: [], username: ''}

const IMAGES = [];

async function getImages(){
    for(let i = 0; i <= 18; i++){
        const image = await fetch(`./assets/${i}.png`);
        IMAGES.push(await window.createImageBitmap(await image.blob()));
    }
    const image = await fetch(`./assets/missing.png`);
    IMAGES.push(await window.createImageBitmap(await image.blob()));
    gotImages = true;
    if(shouldStart){
        main();
    }
}

function connect(serverURL){
    const ws = new WebSocket(serverURL);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", onError);
    ws.addEventListener('message', onMessage);
    return ws;
}

function onMessage(message){
    message = parseMessage(message);
    if(messageCallback){
        messageCallback(message);
        messageCallback = null;
    }else{
        messageBuffer.push(message);
    }
}

async function receiveMessage(){
    if(messageBuffer.length > 0){
        return messageBuffer.splice(0, 1);
    }
    return await new Promise((res) => {
        messageCallback = res;
    });
}

function parseMessage(message){
    return JSON.parse(message.data);
}

function sendMessage(message){
    console.log(message);
    ws.send(JSON.stringify(message));
}

function onError(){

}

function onClose(){

}

function kickDialog(message){
    const dialog = document.getElementById('kick');
    const reason = document.getElementById('reason');
    dialog.style.transform='scale(1) translate(-50%, -50%)'
    if(message){reason.textContent = message;}
    dialog.show();
}

async function connection_handler(serverAddress, username){
    ws = connect(serverAddress);
    let size = [];
    let paused = false;

    while(true){
        message = await receiveMessage();
        console.log(message);
        switch (message.operation) {
            case "motd":
                document.getElementById('motd').innerText = message.motd;
                sendMessage({operation: 'join', nick: username, fingerprint: await getFingerprint()});
                break;
            case "world":
                size = message.data.splice(-1, 1).size;
                world = message.data;
                render();
                sendMessage({operation: "fetch-players"});
                break;
            case "cell":
                world[message.y][message.x] = message.value;
                render();
                break;
            case "cells":
                for(const cell of message.value){
                    world[cell.y][cell.x] = cell.value;
                }
                render();
            case "plr":
                gameInfo.players = message.data;
                let pl = document.getElementById('playerlist');
                for(const player of gameInfo.players){
                    let pe = document.createElement('div');
                    pe.innerText = player
                    if(player == gameInfo.username){
                        pe.id = 'selfplayer';
                    }
                    pl.appendChild(pe);
                }
                break;
            case "kickm":
                kickDialog(message.m);
                console.error(message);
                break;
            case "chat-m":
                let el = document.createElement("div");
                el.class = "chat-message";
                let rid = null;
                let present = false;
                if(document.getElementById('chatBox') != document.activeElement){
                    rid = setTimeout(() => {
                        let msg = gameInfo.messages.find(x => x.el == el);
                        msg.present = false;
                        msg.rid = null;
                        msg.el = null;
                        el.remove();
                    }, 10000);
                    present = true;
                }
                el.textContent = message.data;
                document.getElementById("messagebundle").appendChild(el);
                gameInfo.messages.push({content: message.data, rid: rid, el: el, present: present});
                if(gameInfo.messages.length > 10){
                    let rmsgs = gameInfo.messages.splice(0, gameInfo.messages.length - 10);
                    for(const msg of rmsgs){
                        if(msg.present){
                            clearTimeout(msg.rid);
                        }
                        if(msg.el){
                            msg.el.remove();
                        }
                    }
                }
                break;
            default:
                console.warn("Received unknown packet!");
                break;
        }
    }
}

function resizeHandler(){
    const canvas = document.getElementById('gridCanvas');
    const height = document.body.offsetHeight;
    const width = document.body.offsetWidth;
    canvas.style.height = height.toString() + 'px';
    canvas.style.width = width.toString() + 'px';
    canvas.height = height
    canvas.width = width;

    renderContext.width = width;
    renderContext.height = height;
}

function render_handler(){
    document.getElementsByClassName('game')[0].style.display = 'initial';
    mouseInfo.mouseControlSwap = document.getElementById('mouseControlSwap').checked;

    document.defaultView.onresize = () => {
        resizeHandler();
        render();
    }
    resizeHandler();

    const canvas = document.getElementById('gridCanvas');
    const ctx = canvas.getContext("2d");

    renderContext.ctx = ctx;
    renderContext.cx = 0;
    renderContext.cy = 0;
    renderContext.zoom = 16;


    document.getElementById('chatBox').onkeydown = (event) => {
        if(event.key != "Enter"){
            return;
        }
        let chatBox=document.getElementById('chatBox');
        if(chatBox.value != ''){
            sendMessage({operation: 'chat', content: chatBox.value});
        }
        chatBox.value='';
    }
    document.getElementById('chatBox').onfocus = () => {
        for(const msg of gameInfo.messages){
            if(msg.present){
                clearTimeout(msg.rid);
                msg.rid = null;
            }
            if(msg.el){
                msg.el.remove();
            }
        }
        for(const msg of gameInfo.messages){
            let el = document.createElement("div");
            el.class = "chat-message";
            el.textContent = msg.content;
            document.getElementById("messagebundle").appendChild(el);
            msg.el = el;
        }
    }
    document.getElementById('chatBox').onblur = () => {
        for(const msg of gameInfo.messages){
            if(msg.present){
                clearTimeout(msg.rid);
                msg.rid = null;
            }
            if(msg.el){
                msg.el.remove();
            }
        }
    }
    document.onkeydown = (event) => {
        if(event.key == 'Tab'){
            document.getElementById('playerlist').style.display = 'initial';
            event.preventDefault();
        }
    }
    document.onkeyup = (event) => {
        if(event.key == 'Tab'){
            document.getElementById('playerlist').style.display = 'none';
        }
    }
    document.onmousedown = (event) => {
        mouseInfo.draggingInfo.current = false;
        mouseInfo.draggingInfo.sx = event.clientX;
        mouseInfo.draggingInfo.sy = event.clientY;
    }
    document.onmousemove = document.onmouseup = (event) => {
        if(!mouseInfo.draggingInfo.current){
            let dx = mouseInfo.draggingInfo.sx - event.clientX;
            let dy = mouseInfo.draggingInfo.sy - event.clientY;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if(dist > mouseInfo.draggingInfo.maxDelta){
                mouseInfo.draggingInfo.current = true;
            }
        }
    }
    document.getElementById('gridCanvas').onmousemove = (event) => {
        let reRender = false;
        if(mouseInfo.clicking&&window.holdingCTRL){
            let ncx = renderContext.cx + mouseInfo.sx - event.clientX;
            if((ncx >= 0) && (((ncx + renderContext.width) / renderContext.zoom - 1) <= world[0].length)){
                renderContext.cx = ncx;
                reRender = true;
            }

            let ncy = renderContext.cy + mouseInfo.sy - event.clientY;
            if(ncy >= 0 && (((ncy + renderContext.height) / renderContext.zoom - 1) <= world.length)){
                renderContext.cy = ncy;
                reRender = true;
            }
        } else if (mouseInfo.clicking) {
            let x = event.offsetX + renderContext.cx;
        let y = event.offsetY + renderContext.cy;
        x = Math.floor(x / renderContext.zoom) - 1;
        y = Math.floor(y / renderContext.zoom) - 1;
        if((x < 0) || (y < 0) || (x > world[0].length) || (y > world.length)){
            return;
        }
        if(event.button == 1){
            if(world[y][x] != 0){
                gameInfo.holding = world[y][x];
            }
            return;
        }
        let placingCell = 0;
        if((event.button == 0) == mouseInfo.mouseControlSwap){
            placingCell = gameInfo.holding;
        }
        if(world[y][x] == placingCell){
            return;
        }
        world[y][x] = placingCell;
        render();
        (async (cell) => sendMessage({operation: "cell", x: x, y: y, value: cell}))(placingCell);
        }
        mouseInfo.sx = event.clientX;
        mouseInfo.sy = event.clientY;
        mouseInfo.clicking = event.buttons == 1;
        
        if(reRender){render();}
    }
    document.oncontextmenu = (event) => event.preventDefault();
    document.getElementById('gridCanvas').onclick = document.getElementById('gridCanvas').onauxclick = (event) => {
        if(mouseInfo.draggingInfo.current){
            return;
        }
        if(event.button > 2){
            return;
        }
        let x = event.offsetX + renderContext.cx;
        let y = event.offsetY + renderContext.cy;
        x = Math.floor(x / renderContext.zoom) - 1;
        y = Math.floor(y / renderContext.zoom) - 1;
        if((x < 0) || (y < 0) || (x > world[0].length) || (y > world.length)){
            return;
        }
        if(event.button == 1){
            if(world[y][x] != 0){
                gameInfo.holding = world[y][x];
            }
            return;
        }
        let placingCell = 0;
        if((event.button == 0) == mouseInfo.mouseControlSwap){
            placingCell = gameInfo.holding;
        }
        if(world[y][x] == placingCell){
            return;
        }
        world[y][x] = placingCell;
        render();
        (async (cell) => sendMessage({operation: "cell", x: x, y: y, value: cell}))(placingCell);
    }
    document.body.addEventListener('wheel', (event) => { // TODO: fix weird zooming
        let nz = renderContext.zoom;
        if(event.deltaY < 0){
            nz += 1;
        }else{
            nz -= 1;
        }
        if(nz <= 0){
            return;
        }
        let nx = renderContext.cx;
        let ny = renderContext.cy;
        if(!(((renderContext.cx + renderContext.width) / nz - 1) <= world[0].length)){
            nx = (world[0].length + 1) * nz - renderContext.width;
            if(nx < 0){return;}
        }
        if(!(((renderContext.cy + renderContext.height) / nz - 1) <= world.length)){
            ny = (world.length + 1) * nz - renderContext.height;
            if(ny < 0){return;}
        }
        renderContext.cx = nx;
        renderContext.cy = ny;
        renderContext.zoom = nz;
        render();
    })
}

function getImage(cid){
    if((cid < 0) || (cid > 18)){
        cid = 19;
    }
    return IMAGES[cid];
}

async function render(){
    const cx = renderContext.cx;
    const cy = renderContext.cy;
    const ctx = renderContext.ctx;
    const zoom = renderContext.zoom;
    const height = renderContext.height;
    const width = renderContext.width;
    const grid = world;
    
    const fx = Math.floor(cx / zoom);
    const fy = Math.floor(cy / zoom);

    const jx = zoom - cx % zoom;
    const jy = zoom - cy % zoom;
    
    ctx.clearRect(0, 0, width, height);
    for(let y = fy - 1; (((y - fy) * zoom) < height) && (y < grid.length); y++){
        if(y < 0){continue;}
        for(let x = fx - 1; (((x - fx) * zoom) < width) && (x < grid[y].length); x++){
            if(x < 0){continue;}
            const image = getImage(grid[y][x]);
            ctx.drawImage(image, (x - fx) * zoom + jx, (y - fy) * zoom + jy, zoom, zoom);
        }
    }
}

function parseBoolean(str){
    if(str == "true"){
        return true
    }
    return false
}

async function getFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const canvasData = canvas.toDataURL();

    const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        timezoneOffset: new Date().getTimezoneOffset(),
        canvasDataHash: await hash(canvasData),
    };

    return hash(JSON.stringify(fingerprint));
}

async function hash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}


function main(){
    localStorage.setItem("mouseswap", document.getElementById('mouseControlSwap').checked.toString());
    localStorage.setItem("username", document.getElementById('username').value);
    localStorage.setItem("serverAddress", document.getElementById('serverAddress').value);
    if(!gotImages){
        alert("Waiting for images...");
        shouldStart = true;
        return;
    }
    const SERVER_URL = document.getElementById('serverAddress').value;
    const USERNAME = document.getElementById('username').value;
    document.getElementsByClassName('login')[0].style.display = 'none';
    gameInfo.username = USERNAME;
    render_handler();
    connection_handler(SERVER_URL, USERNAME);
}
document.addEventListener('keydown',()=>{
    window.holdingCTRL = true
})
document.addEventListener('keyup',()=>{
    window.holdingCTRL = false
})
setInterval(()=>{
    if(!window.holdingCTRL){
        mouseInfo.draggingInfo.current = false;
    }
})
document.addEventListener('DOMContentLoaded',()=>{
    if (localStorage.getItem("mouseswap")) {
    document.getElementById("mouseControlSwap").checked = parseBoolean(localStorage.getItem("mouseswap"))
}
if (localStorage.getItem("username")) {
    document.getElementById("username").value = localStorage.getItem("username")
}
document.getElementById('serverAddress').value = "wss://localhost:8000"
if (localStorage.getItem("serverAddress")) {
    document.getElementById("serverAddress").value = localStorage.getItem("serverAddress")
}
document.getElementById('connectButton').onclick = () => main()
document.getElementById('select').onclick = () => {
    try{
        gameInfo.holding=parseInt(document.getElementById("colorBox").value)
    }catch{}
    
    document.getElementById("colorBox").value=""
}
getImages();



})
