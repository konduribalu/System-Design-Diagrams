const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const path = require('path');
const WIDTH = 1200;
const HEIGHT = 800;
const FRAME_DELAY = 600;
const SERVERS = 3;
const TOTAL_REQUESTS = 12;
const COLORS = {
    idle: '#90EE90',
    processing: '#FFD700',
    queued: '#FF6B6B',
    background: '#F5F5F5',
    text: '#333333',
    serverBg: '#FFFFFF',
    border: '#CCCCCC',
    arrow: '#4169E1'
};
const encoder = new GIFEncoder(WIDTH, HEIGHT);
const stream = fs.createWriteStream(path.join(__dirname, 'round-robin-loadbalancing.gif'));
encoder.createReadStream().pipe(stream);
encoder.start();
encoder.setRepeat(0);
encoder.setDelay(FRAME_DELAY);
encoder.setQuality(10);
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');
class ServerState {
    constructor(id) {
        this.id = id;
        this.queue = [];
        this.currentRequest = null;
        this.processingTime = 0;
        this.isDelayed = false;
    }
    enqueue(requestId) {
        this.queue.push(requestId);
    }
    process() {
        if (this.currentRequest === null && this.queue.length > 0) {
            this.currentRequest = this.queue.shift();
            this.processingTime = this.isDelayed ? 120 : 60;
        }
        if (this.currentRequest !== null) {
            this.processingTime--;
            if (this.processingTime <= 0) {
                this.currentRequest = null;
            }
        }
    }
    getStatus() {
        if (this.currentRequest !== null) {
            return { status: 'processing', request: this.currentRequest };
        } else if (this.queue.length > 0) {
            return { status: 'queued', count: this.queue.length };
        } else {
            return { status: 'idle' };
        }
    }
    getColor() {
        if (this.currentRequest !== null) {
            return COLORS.processing;
        } else if (this.queue.length > 0) {
            return COLORS.queued;
        } else {
            return COLORS.idle;
        }
    }
}
const servers = Array.from({ length: SERVERS }, (_, i) => new ServerState(i + 1));
servers[0].isDelayed = true;
function drawBackground() {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
}
function drawHeader() {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Round Robin Load Balancing', WIDTH / 2, 50);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Request Distribution Across 3 Servers', WIDTH / 2, 85);
}
function drawServer(x, y, server) {
    const boxWidth = 200;
    const boxHeight = 150;
    ctx.fillStyle = server.getColor();
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Server ${server.id}`, x + boxWidth / 2, y + 35);
    const status = server.getStatus();
    ctx.font = '14px Arial';
    ctx.fillStyle = COLORS.text;
    if (status.status === 'processing') {
        ctx.fillText(`Processing #${status.request}`, x + boxWidth / 2, y + 70);
        if (server.isDelayed) {
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('(DELAYED)', x + boxWidth / 2, y + 90);
        }
    } else if (status.status === 'queued') {
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`Queued: ${status.count}`, x + boxWidth / 2, y + 70);
        ctx.font = '12px Arial';
        let queueText = 'Waiting: ';
        server.queue.slice(0, 3).forEach(id => queueText += `#${id} `);
        ctx.fillText(queueText, x + boxWidth / 2, y + 90);
    } else {
        ctx.fillStyle = '#008000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('IDLE', x + boxWidth / 2, y + 70);
    }
    ctx.font = '11px Arial';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Current / Queue', x + boxWidth / 2, y + 125);
}
function drawRequestQueue(requests, frame) {
    const queueX = 50;
    const queueY = 250;
    const itemSize = 35;
    const itemSpacing = 45;
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Incoming Requests:', queueX, queueY - 20);
    requests.forEach((requestId, index) => {
        if (index < 6) {
            const x = queueX + index * itemSpacing;
            const y = queueY;
            ctx.fillStyle = '#E8E8E8';
            ctx.fillRect(x, y, itemSize, itemSize);
            ctx.strokeStyle = COLORS.border;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, itemSize, itemSize);
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${requestId}`, x + itemSize / 2, y + itemSize / 2 + 5);
        }
    });
    if (requests.length > 6) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`... and ${requests.length - 6} more`, queueX + 6 * itemSpacing, queueY + itemSize / 2 + 5);
    }
}
function drawFrame(frameNum) {
    drawBackground();
    drawHeader();
    const serverY = 200;
    const serverXPositions = [100, 450, 800];
    serverXPositions.forEach((x, i) => {
        drawServer(x, serverY, servers[i]);
    });
    const processedCount = frameNum;
    const remainingRequests = Array.from(
        { length: Math.max(0, TOTAL_REQUESTS - processedCount) },
        (_, i) => processedCount + i + 1
    );
    drawRequestQueue(remainingRequests, frameNum);
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    const processedRequests = servers.reduce((sum, s) => {
        return sum + (s.queue.length === 0 && s.currentRequest === null ? 0 : 0);
    }, 0);
    const totalProcessing = servers.reduce((sum, s) => {
        return sum + (s.currentRequest !== null ? 1 : 0) + s.queue.length;
    }, 0);
    ctx.fillText(`Frame: ${frameNum} | Processing: ${totalProcessing} | Servers Used: ${servers.filter(s => s.currentRequest !== null || s.queue.length > 0).length}/3`, 50, HEIGHT - 50);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Server 1 has a delay, causing queuing while Servers 2 & 3 remain idle', 50, HEIGHT - 20);
}
console.log('🎬 Generating Round Robin Load Balancing GIF...');
console.log(`📊 Configuration: ${SERVERS} servers, ${TOTAL_REQUESTS} requests`);
console.log(`⏱️  Frame delay: ${FRAME_DELAY}ms`);
let requestCounter = 1;
let frameCount = 0;
for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const serverIndex = i % SERVERS;
    servers[serverIndex].enqueue(i + 1);
    for (let f = 0; f < 2; f++) {
        servers.forEach(s => s.process());
        drawFrame(frameCount);
        encoder.addFrame(ctx);
        frameCount++;
    }
}
let hasWork = true;
let maxIterations = 300;
while (hasWork && maxIterations > 0) {
    hasWork = servers.some(s => s.currentRequest !== null || s.queue.length > 0);
    if (hasWork) {
        servers.forEach(s => s.process());
        drawFrame(frameCount);
        encoder.addFrame(ctx);
        frameCount++;
    }
    maxIterations--;
}
drawFrame(frameCount);
encoder.addFrame(ctx);
encoder.finish();
stream.on('finish', () => {
    console.log('✅ GIF generated successfully!');
    console.log(`📁 File: round-robin-loadbalancing.gif`);
    console.log(`📈 Total frames: ${frameCount}`);
    console.log(`⏱️  Duration: ~${(frameCount * FRAME_DELAY) / 1000}s`);
});
stream.on('error', (err) => {
    console.error('❌ Error generating GIF:', err);
    process.exit(1);
});
