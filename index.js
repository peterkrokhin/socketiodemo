const app = require('http').createServer(createServerHandler);
const io = require('socket.io')(app);
const fs = require('fs');
const DataLoader = require('./dataloader');

const config = {
    server: 'TMN-W-00016',
    user: 'sql_client',
    password: 'qwerty',
    database: 'MdlTransport',
    options: {
        enableArithAbort: true,
    },
};

const dataLoader = new DataLoader(config);

app.listen(80);

function createServerHandler(req, res) {
    fs.readFile(`${__dirname}/index.html`,
        (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200);
            res.end(data);
            return undefined;
        });
}

io.on('connection', (socket) => {
    let getDataInterval;
    socket.on('subscribe', (data) => {
        let isValid = false;
        let numberArrayFilter = [];
        if (data.filter) {
            numberArrayFilter = data.filter
                .split(',')
                .map((item) => +item.trim());

            isValid = numberArrayFilter.every((item) => Number.isSafeInteger(item) && item > 0);
        }

        if (!isValid) {
            return;
        }

        const filterSet = new Set(numberArrayFilter);

        dataLoader.addSubscriber({
            socketid: socket.id,
            filter: filterSet,
        });

        dataLoader.startLoader(2000);

        clearInterval(getDataInterval);
        let prevData = '';

        getDataInterval = setInterval(() => {
            const lastData = dataLoader.getDataBySocketId(socket.id);
            if (dataLoader.cacheReady && lastData !== prevData) {
                socket.emit('getData', lastData);
                prevData = lastData;
            }
        }, 2000);
    });

    socket.on('unsubscribe', () => {
        clearInterval(getDataInterval);
        dataLoader.removeSubscriber(socket.id);
    });

    socket.on('disconnect', () => {
        clearInterval(getDataInterval);
        dataLoader.removeSubscriber(socket.id);
    });
});
