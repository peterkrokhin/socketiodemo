const sql = require('mssql');

class DataLoader {
    constructor(config) {
        this.config = config;
        this.started = false;
        this.subscribers = [];
        this.querySet = new Set();
        this.cacheReady = false;
    }

    addSubscriber(subscriber) {
        const result = this.subscribers.find((item) => subscriber.socketid === item.socketid);
        if (result) {
            result.filter = subscriber.filter;
        } else {
            this.subscribers.push(subscriber);
        }
        this.makeQuerySet();
    }

    removeSubscriber(socketid) {
        const index = this.subscribers.findIndex((item) => item.socketid === socketid);
        if (index !== -1) {
            this.subscribers.splice(index, 1);
        }
        if (this.subscribers.length === 0) {
            this.stopLoader();
        }
        this.makeQuerySet();
    }

    makeQuerySet() {
        this.querySet.clear();
        this.subscribers.forEach((item) => {
            item.filter.forEach((element) => {
                this.querySet.add(element);
            });
        });
    }

    makeQueryPredicate() {
        let filter = '';
        this.querySet.forEach((item) => {
            filter += ` id=${item} OR`;
        });
        filter = filter.slice(0, -3);
        if (filter === '') {
            filter = '0';
        }
        return filter;
    }

    getDataBySocketId(socketid) {
        const subscriber = this.subscribers.find((item) => item.socketid === socketid);
        let dataForSubscriber;

        if (subscriber) {
            dataForSubscriber = this.lastData?.filter((item) => subscriber.filter.has(item.id));
        }

        return JSON.stringify(dataForSubscriber);
    }

    startLoader(interval) {
        if (this.started === false) {
            this.loadInterval = setInterval(this.loadData.bind(this), interval);
            this.started = true;
        }
    }

    stopLoader() {
        clearInterval(this.loadInterval);
        this.started = false;
        this.cacheReady = false;
    }

    async loadData() {
        const now = new Date();
        console.log(`${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}: запрос к БД, where${this.makeQueryPredicate()}`);
        try {
            const pool = await sql.connect(this.config);

            const queryResult = await pool.request()
                .query(`SELECT id, name, value FROM Tags WHERE${this.makeQueryPredicate()}`);

            this.lastData = queryResult.recordset;
            this.cacheReady = true;
        } catch (err) {
            console.log(err);
        } finally {
            sql.close();
        }
    }
}

module.exports = DataLoader;
