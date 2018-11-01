
const Discord = require("discord.js");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require("fs");
const spawnSync = require("child_process").spawnSync;
var conf = get_config();
var client = new Discord.Client();

/* TODO: 
 *  - Add a way to run on background (without 3rd party software if possible)
 *  - Add a way to remove the MN info
 *  - Add a way to calculate the earnings of POW (!mining <hash> ?)... and maybe POS (!staking <coins> ?)
*/ 


class ExchangeData {
    constructor(name) {
        this.defaults(name);
    }
    defaults(name) {
        this.name = name;
        this.link = "";
        this.price = "Error";
        this.volume = "Error";
        this.buy = "Error";
        this.sell = "Error";
        this.change = "Error";
    }
    fillj(json, price, volume, buy, sell, change) {
        this.fill(json[price], json[volume], json[buy], json[sell], json[change]);
    }
    fill(price, volume, buy, sell, change) {
        if (price === undefined && volume === undefined && buy === undefined && sell === undefined && change === undefined)
            return;
        this.price  = isNaN(price)  ? undefined : parseFloat(price).toFixed(8);
        this.volume = isNaN(volume) ? undefined : parseFloat(volume).toFixed(8);
        this.buy    = isNaN(buy)    ? undefined : parseFloat(buy).toFixed(8);
        this.sell   = isNaN(sell)   ? undefined : parseFloat(sell).toFixed(8);
        this.change = isNaN(change) ? undefined : (change >= 0.0 ? "+" : "") + parseFloat(change).toFixed(2) + "%";
    }
}

function get_ticker(exchange) {

    var exdata = new ExchangeData(exchange);
    const rg_replace = (str, lowercase = false) => {
        return str.replace("{COIN}", lowercase ? conf.coin.toLowerCase() : conf.coin.toUpperCase());
    };
    const js_request = (url, lowercase = false) => {
        return JSON.parse(synced_request(rg_replace(url, lowercase)));
    };

    try {
        var tmp;
        switch (exchange.toLowerCase()) {
            case "cryptobridge": {
                exdata.fillj(js_request("https://api.crypto-bridge.org/api/v1/ticker/{COIN}_BTC"), "last", "volume", "bid", "ask", "percentChange");
                exdata.link = rg_replace("https://wallet.crypto-bridge.org/market/BRIDGE.{COIN}_BRIDGE.BTC");
                break;
            }
            case "crex24": {
                exdata.fillj(js_request("https://api.crex24.com/v2/public/tickers?instrument={COIN}-BTC")[0], "last", "volumeInBtc", "bid", "ask", "percentChange");
                exdata.link = rg_replace("https://crex24.com/exchange/{COIN}-BTC");
                break;
            }
            case "coinexchange": {
                exdata.fillj(js_request("https://www.coinexchange.io/api/v1/getmarketsummary?market_id=" + conf.special_ticker.CoinExchange)["result"], "LastPrice", "BTCVolume", "BidPrice", "AskPrice", "Change");
                exdata.link = rg_replace("https://www.coinexchange.io/market/{COIN}/BTC");
                break;
            }
            case "graviex": {
                exdata.fillj(js_request("https://graviex.net:443//api/v2/tickers/{COIN}btc.json", true)["ticker"], "last", "volbtc", "buy", "sell", "change");
                exdata.link = rg_replace("https://graviex.net/markets/{COIN}btc", true);
                break;
            }
            case "escodex": {
                exdata.fillj(js_request("http://labs.escodex.com/api/ticker").find(x => x.base === "BTC" && x.quote === conf.coin.toUpperCase()), "latest", "base_volume", "lowest_ask", "highest_bid", "percent_change");
                exdata.link = rg_replace("https://wallet.escodex.com/market/ESCODEX.{COIN}_ESCODEX.BTC");
                break;
            }
            case "cryptopia": {
                exdata.fillj(js_request("https://www.cryptopia.co.nz/api/GetMarket/{COIN}_BTC")["Data"], "LastPrice", "BaseVolume", "AskPrice", "BidPrice", "Change");
                exdata.link = rg_replace("https://www.cryptopia.co.nz/Exchange/?market={COIN}_BTC");
                break;
            }
            case "stex": {
                tmp = js_request("https://app.stex.com/api2/ticker").find(x => x.market_name === rg_replace("{COIN}_BTC"));
                exdata.fill(tmp["last"], (tmp["last"] + tmp["lastDayAgo"]) / 2 * tmp["volume"], tmp["ask"], tmp["bid"], tmp["last"] / tmp["lastDayAgo"]); // volume and change not 100% accurate
                exdata.link = rg_replace("https://app.stex.com/en/basic-trade/BTC?currency2={COIN}");
                break;
            }
            case "c-cex": {
                tmp = js_request("https://c-cex.com/t/{COIN}-btc.json", true)["ticker"];
                exdata.fill(tmp["lastprice"], js_request("https://c-cex.com/t/volume_btc.json")["ticker"][conf.coin.toLowerCase()]["vol"], tmp["buy"], tmp["sell"], undefined);
                exdata.link = rg_replace("https://c-cex.com/?p={COIN}-btc", true);
                break;
            }
            case "hitbtc": {
                exdata.fillj(js_request("https://api.hitbtc.com/api/2/public/ticker/{COIN}BTC"), "last", "volumeQuote", "ask", "bid", ""); // change not supported
                exdata.link = rg_replace("https://hitbtc.com/{COIN}-to-BTC");
                break;
            }
            case "yobit": {
                exdata.fillj(js_request("https://yobit.net/api/2/{COIN}_btc/ticker", true)["ticker"], "last", "vol", "buy", "sell", ""); // change not supported
                exdata.link = rg_replace("https://yobit.net/en/trade/{COIN}/BTC");
                break;
            }
            case "bittrex": {
                tmp = js_request("https://bittrex.com/api/v1.1/public/getmarketsummary?market=btc-{COIN}", true)["result"][0];
                exdata.fill(tmp["Last"], tmp["BaseVolume"], tmp["Bid"], tmp["Ask"], tmp["Last"] / tmp["PrevDay"]); // change not 100% accurate
                exdata.link = rg_replace("https://www.bittrex.com/Market/Index?MarketName=BTC-{COIN}");
                break;
            }
            case "southxchange": {
                exdata.fillj(js_request("https://www.southxchange.com/api/price/{COIN}/BTC"), "Last", "Volume24Hr", "Bid", "Ask", "Variation24Hr");
                exdata.link = rg_replace("https://www.southxchange.com/Market/Book/{COIN}/BTC");
                break;
            }
            case "exrates": {
                exdata.fillj(js_request("https://exrates.me/openapi/v1/public/ticker?currency_pair={COIN}_btc", true)[0], "last", "quoteVolume", "highestBid", "lowestAsk", "percentChange");
                exdata.link = "https://exrates.me/dashboard"; // no filter
                break;
            }
            case "binance": {
                exdata.fillj(js_request("https://api.binance.com/api/v1/ticker/24hr?symbol={COIN}BTC"), "lastPrice", "quoteVolume", "bidPrice", "askPrice", "priceChangePercent");
                exdata.link = rg_replace("https://www.binance.com/es/trade/{COIN}_BTC"); 
                break;
            }
            case "bitfinex": {
                tmp = js_request("https://api.bitfinex.com/v2/ticker/t{COIN}BTC"); // [bid, bidsize, ask, asksize, daychg, daychg%, last, vol, high, low]
                exdata.fill(tmp[6], (tmp[8] + tmp[9]) / 2 * tmp[7], tmp[0], tmp[2], tmp[5]); // volume not 100% accurate
                exdata.link = rg_replace("https://www.bitfinex.com/t/{COIN}:BTC");
                break;
            }
            case "moondex": {
                exdata.fillj(js_request("https://data.moondex.io/ticker/{COIN}_BTC"), "latest", "volume", "highestBid", "lowestAsk", "percentChange");
                exdata.link = rg_replace("https://beta.moondex.io/market/MOONDEX.{COIN}_MOONDEX.BTC");
                break;
            }
            case "coinex": {
                tmp = js_request("https://api.coinex.com/v1/market/ticker?market={COIN}BTC")["data"]["ticker"];
                exdata.fill(tmp["last"], (parseFloat(tmp["high"]) + parseFloat(tmp["low"])) / 2 * tmp["vol"], tmp["buy"], tmp["sell"], tmp["last"] / tmp["open"]); // volume not 100% accurate
                exdata.link = rg_replace("https://www.coinex.com/exchange?currency=btc&dest={COIN}#limit", true);
                break;
            }
            case "p2pb2b": {
                exdata.fillj(js_request("https://p2pb2b.io/api/v1/public/ticker?market={COIN}_BTC")["result"], "last", "deal", "bid", "ask", "change");
                exdata.link = rg_replace("https://p2pb2b.io/trade/{COIN}_BTC");
                break;
            }
            case "coinsbit": {
                exdata.fillj(js_request("https://coinsbit.io/api/v1/public/ticker?market={COIN}_BTC")["result"], "last", "deal", "bid", "ask", "change");
                exdata.link = rg_replace("https://coinsbit.io/trade/{COIN}_BTC");
                break;
            }
        }
    }
    catch (e) {
        //console.log("Error retrieving " + exchange + " data: " + e);
    }

    return exdata;
}
function get_config() {
    var str = fs.readFileSync("./config.json", "utf8"); // for some reason is adding a invalid character at the beginning that causes a throw
    var json = JSON.parse(str.slice(str.indexOf("{")));
    json.cmd = {
        stats: {
            stats: json.requests.blockcount !== "" || json.requests.mncount !== "" || json.requests.supply !== "",
            blockcount: json.requests.blockcount !== "",
            mncount: json.requests.mncount !== "",
            supply: json.requests.supply !== "",
            collateral: json.requests.blockcount !== "",
            mnreward: json.requests.blockcount !== "",
            powreward: json.requests.blockcount !== "",
            posreward: json.requests.blockcount !== "",
            locked: json.requests.blockcount !== "" && json.requests.mncount !== "" && json.requests.supply !== "",
            avgmnreward: json.requests.mncount !== "",
            nextstage: json.requests.blockcount !== ""
        },
        earnings: json.requests.blockcount !== "" && json.requests.mncount !== "",
        balance: json.requests.balance !== "",
        blockindex: json.requests.blockhash !== "" && json.requests.blockindex !== "",
        blockhash: json.requests.blockhash !== ""
    };
    return json;
}
function get_stage(blk) {
    for (let stage of conf.stages)
        if (blk <= stage.block)
            return stage;
    return conf.stages[conf.stages.length - 1];
}
function synced_request(url) {
    var req = new XMLHttpRequest();
    req.open("GET", url, false);
    req.send();
    return req.responseText;
}
function bash_cmd(cmd) {
    return (process.platform === "win32" ? spawnSync("cmd.exe", ["/S", "/C", cmd]) : spawnSync("sh", ["-c", cmd])).stdout.toString();
}
function restart_bot() {
    for (let i = 5; i > 0; i--) {
        console.log("Restarting bot in " + i + " seconds..."); // just to avoid constant reset in case of constant crash cause no internet
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
    client = new Discord.Client();
    client.on("message", response_msg);
    client.login(conf.token).then(() => console.log("Bot restart succeeded!"));
}

class BotCommand {

    constructor(msg) {
        this.msg = msg;
    }

    price() {

        var promises = [];
        for (let ticker of conf.ticker)
            promises.push(new Promise((resolve, reject) => resolve(get_ticker(ticker))));

        Promise.all(promises).then(values => {

            const hide_undef = (str, val) => {
                if (val === undefined)
                    return conf.hidenotsupported ? "\n" : str + "Not Supported" + "\n";
                return str + val + "\n";
            };

            var embed = new Discord.RichEmbed();
            embed.title = "**Price Ticker**";
            embed.color = conf.color.prices;
            embed.timestamp = new Date();

            for (let data of values) {
                embed.addField(
                    data.name,
                    hide_undef("**| Price** : ", data.price) +
                    hide_undef("**| Vol** : ", data.volume) +
                    hide_undef("**| Buy** : ", data.buy) +
                    hide_undef("**| Sell** : ", data.sell) +
                    hide_undef("**| Chg** : ", data.change) +
                    "[Link](" + data.link + ")",
                    true
                );
            }
            if (embed.fields.length % 3 === 2) // fix bad placing if a row have 2 tickers
                embed.addBlankField(true);

            this.msg.channel.send(embed);
        });

    }

    stats() {

        Promise.all([
            new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.blockcount))),
            new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.mncount))),
            new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.supply)))
        ]).then(([blockcount, mncount, supply]) => {

            var stage = get_stage(blockcount);
            var stg_index = conf.stages.indexOf(stage);

            var embed = new Discord.RichEmbed();
            embed.title = conf.coin + " Stats";
            embed.color = conf.color.coininfo;
            embed.timestamp = new Date();

            for (let stat of conf.statorder) {
                switch (stat) {
                    case "blockcount": { // requires: blockcount
                        if (conf.cmd.stats.blockcount)
                            embed.addField("Block Count", blockcount, true);
                        break;
                    }
                    case "mncount": { // requires: mncount
                        if (conf.cmd.stats.mncount)
                            embed.addField("MN Count", mncount, true);
                        break;
                    }
                    case "supply": { // requires: supply
                        if (conf.cmd.stats.supply)
                            embed.addField("Supply", parseFloat(supply).toFixed(4).replace(/(\d)(?=(?:\d{3})+(?:\.|$))|(\.\d{4}?)\d*$/g, (m, s1, s2) => s2 || s1 + ',') + " " + conf.coin, true);
                        break;
                    }
                    case "collateral": { // requires: blockcount
                        if (conf.cmd.stats.collateral)
                            embed.addField("Collateral", stage.coll + " " + conf.coin, true);
                        break;
                    }
                    case "mnreward": { // requires: blockcount
                        if (conf.cmd.stats.mnreward)
                            embed.addField("MN Reward", stage.mn + " " + conf.coin, true);
                        break;
                    }
                    case "powreward": { // requires: blockcount
                        if (stage.pow !== undefined && conf.cmd.stats.powreward)
                            embed.addField("POW Reward", stage.pow + " " + conf.coin, true);
                        break;
                    }
                    case "posreward": { // requires: blockcount
                        if (stage.pos !== undefined && conf.cmd.stats.posreward)
                            embed.addField("POS Reward", stage.pos + " " + conf.coin, true);
                        break;
                    }
                    case "locked": { // requires: blockcount, mncount, supply
                        if (conf.cmd.stats.locked)
                            embed.addField("Locked", (mncount * stage.coll).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " " + conf.coin + " (" + (mncount * stage.coll / supply * 100).toFixed(2) + "%)", true);
                        break;
                    }
                    case "avgmnreward": { // requires: mncount
                        if (conf.cmd.stats.avgmnreward)
                            embed.addField("Avg. MN Reward", parseInt(mncount / (86400 / conf.blocktime)) + "d " + parseInt(mncount / (3600 / conf.blocktime) % 24) + "h " + parseInt(mncount / (60 / conf.blocktime) % 60) + "m", true);
                        break;
                    }
                    case "nextstage": { // requires: blockcount
                        if (conf.cmd.stats.nextstage)
                            embed.addField("Next Stage", parseInt((conf.stages[stg_index].block - blockcount) / (86400 / conf.blocktime)) + "d " + parseInt((conf.stages[stg_index].block - blockcount) / (3600 / conf.blocktime) % 24) + "h " + parseInt((conf.stages[stg_index].block - blockcount) / (60 / conf.blocktime) % 60) + "m", true);
                        break;
                    }
                    case "": {
                        embed.addBlankField(true);
                        break;
                    }
                }
            }

            this.msg.channel.send(embed);

        });

    }
    earnings() {

        Promise.all([
            new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.blockcount))),
            new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.mncount)))
        ]).then(([blockcount, mncount]) => {
            var stage = get_stage(blockcount);
            var coinday = 86400 / conf.blocktime / mncount * stage.mn;
            this.msg.channel.send({
                embed: {
                    title: conf.coin + " Earnings",
                    color: conf.color.coininfo,
                    fields: [
                        {
                            name: "ROI",
                            value: (36500 / (stage.coll / coinday)).toFixed(2) + "% / " + (stage.coll / coinday).toFixed(2) + " days"
                        },
                        {
                            name: "Daily",
                            value: coinday.toFixed(4) + " " + conf.coin,
                            inline: true
                        },
                        {
                            name: "Weekly",
                            value: (coinday * 7).toFixed(4) + " " + conf.coin,
                            inline: true
                        },
                        {
                            name: "Monthly",
                            value: (coinday * 30).toFixed(4) + " " + conf.coin,
                            inline: true
                        },
                        {
                            name: "Yearly",
                            value: (coinday * 365).toFixed(4) + " " + conf.coin,
                            inline: true
                        }
                    ],
                    timestamp: new Date()
                }
            });

        });

    }

    balance(addr) {

        try {
            var json = JSON.parse(bash_cmd(conf.requests.balance + addr));
            if (json["sent"] !== undefined || json["received"] !== undefined || json["balance"] !== undefined) {
                msg.channel.send({
                    embed: {
                        title: "Balance",
                        color: conf.color.explorer,
                        fields: [
                            {
                                name: "Address",
                                value: addr
                            },
                            {
                                name: "Sent",
                                value: json["sent"] + " " + conf.coin,
                                inline: true
                            },
                            {
                                name: "Received",
                                value: json["received"] + " " + conf.coin,
                                inline: true
                            },
                            {
                                name: "Balance",
                                value: json["balance"] + " " + conf.coin,
                                inline: true
                            }
                        ],
                        timestamp: new Date()
                    }
                });
            }
        }
        catch (e) {
            //
        }
        this.msg.channel.send({
            embed: {
                title: "Balance",
                color: conf.color.explorer,
                description: "Invalid address: " + cmds[1],
                timestamp: new Date()
            }
        });

    }
    block_index(index) {
        this.block_hash(bash_cmd(conf.requests.blockindex + index));
    }
    block_hash(hash) {

        var str = "Invalid block index or hash";

        if (/^[A-Za-z0-9\n]+$/.test(hash)) {
            try {
                var json = JSON.parse(bash_cmd(conf.requests.blockhash + hash));
                str =
                    "**Index:** " + json["height"] + "\n" +
                    "**Hash:** " + json["hash"] + "\n" +
                    "**Confirmations:** " + json["confirmations"] + "\n" +
                    "**Size:** " + json["size"] + "\n" +
                    "**Date:** " + new Date(new Number(json["time"]) * 1000).toUTCString() + "\n" +
                    "**Prev Hash:** " + json["previousblockhash"] + "\n" +
                    "**Next Hash:** " + json["nextblockhash"] + "\n" +
                    "**Transactions:**\n";
                for (let i = 0; i < json["tx"].length; i++)
                    str += json["tx"][i] + "\n";
            }
            catch (e) {
                //
            }
        }
        this.msg.channel.send({
            embed: {
                title: "Block info",
                color: conf.color.explorer,
                description: str
            }
        });

    }

    help() {

        const blocked_cmd = (cmd, str) => {
            return !cmd ? "*blocked command*" : str;
        };
        this.msg.channel.send({
            embed: {
                title: "**Available commands**",
                color: conf.color.other,
                fields: [
                    {
                        name: "Exchanges:",
                        value:
                            " - **" + conf.prefix + "price" + "** : get the current price of " + conf.coin + " on every listed exchange\n"
                    },
                    {
                        name: "Explorer:",
                        value:
                            " - **" + conf.prefix + "stats** : "                + blocked_cmd(conf.cmd.stats.stats, "get the current stats of the " + conf.coin + " blockchain") + "\n" +
                            " - **" + conf.prefix + "earnings** : "             + blocked_cmd(conf.cmd.earnings,    "get the expected " + conf.coin + " earnings per masternode to get an idea of how close you are to getting a lambo") + "\n" +
                            " - **" + conf.prefix + "balance <address>** : "    + blocked_cmd(conf.cmd.balance,     "show the balance, sent and received of the given address") + "\n" +
                            " - **" + conf.prefix + "block-index <number>** : " + blocked_cmd(conf.cmd.blockindex,  "show the info of the block by its index") + "\n" +
                            " - **" + conf.prefix + "block-hash <hash>** : "    + blocked_cmd(conf.cmd.blockhash,   "show the info of the block by its hash") + "\n"
                    },
                    {
                        name: "Other:",
                        value:
                            " - **" + conf.prefix + "help** : the command that you just used\n" +
                            " - **" + conf.prefix + "about** : know more about me :smirk:"
                    },
                    {
                        name: "Admins only:",
                        value:
                            " - **" + conf.prefix + "conf-get** : retrieve the bot config via dm\n" +
                            " - **" + conf.prefix + "conf-set** : set a new config to the bot via dm\n"
                    }
                ]
            }
        });

    }
    about() {

        const donate = { // don't be evil with this, please
            "BCARD": "BQmTwK685ajop8CFY6bWVeM59rXgqZCTJb",
            "SNO": "SZ4pQpuqq11EG7dw6qjgqSs5tGq3iTw2uZ",
            "RESQ": "QXFszBEsRXWy2D2YFD39DUqpnBeMg64jqX"
        };
        this.msg.channel.send({
            embed: {
                title: "**About**",
                color: conf.color.other,
                description: "**Author:** <@464599914962485260>\n" +
                    "**Source Code:** [Link](" + conf.sourcecode + ")\n" + // source link on conf just in case I change the repo
                    "**Description:** A simple bot for " + conf.coin + " to check the current status of the currency in many ways, use **!help** to see these ways\n" +
                    (conf.coin in donate ? "**" + conf.coin + " Donations (to author):** " + donate[conf.coin] + "\n" : "") +
                    "**BTC Donations (to author):** 3HE1kwgHEWvxBa38NHuQbQQrhNZ9wxjhe7"
            }
        });

    }

    conf_get() {
        this.msg.channel.send("<@" + this.msg.author.id + "> check the dm I just sent to you :wink:");
        this.msg.author.send({ files: ["./config.json"] });
    }
    conf_set() {
        this.msg.channel.send("<@" + this.msg.author.id + "> check the dm I just sent to you :wink:");
        this.msg.author.send("Put the config.json file here and I'll update myself with the changes, don't send any message, just drag and drop the file, you have 90 seconds to put the file or you'll have to use **!conf-set** again").then(reply => {
            var msgcol = new Discord.MessageCollector(reply.channel, m => m.author.id === this.msg.author.id, { time: 90000 });
            msgcol.on("collect", (elem, col) => {
                msgcol.stop("received");
                if (elem.attachments.array()[0]["filename"] !== "config.json") {
                    this.msg.author.send("I requested a file called 'config.json', not whatever is this :expressionless: ");
                    return;
                }
                try {
                    var conf_res = synced_request(elem.attachments.array()[0]["url"]);
                    conf_res = conf_res.slice(conf_res.indexOf("{"));
                    JSON.parse(conf_res); // just check if throws
                    fs.writeFileSync("./config.json", conf_res);
                    conf = get_config();
                    this.msg.channel.send("Config updated by <@" + this.msg.author.id + ">, if something goes wrong, it will be his fault :stuck_out_tongue: ");
                }
                catch (e) {
                    this.msg.author.send("Something seems wrong on the json file you sent, check that everything is okay and use **!conf-set** again");
                }
            });
            msgcol.on("end", (col, reason) => {
                if (reason === "time")
                    this.msg.author.send("Timeout, any file posted from now ill be ignored unless **!conf-set** is used again");
            });
        });
    }

}

function response_msg(msg) {

    if (msg.channel.id !== conf.channel || !msg.content.startsWith(conf.prefix) || msg.author.bot)
        return;

    var args = msg.content.slice(conf.prefix.length).split(" ");
    var cmd = new BotCommand(msg);

    const error_noparam = (n, descr) => {
        if (args.length >= n)
            return false;
        msg.channel.send({
            embed: {
                title: "Missing Parameter",
                color: conf.color.error,
                description: descr
            }
        });
        return true;
    };
    const error_noworthy = () => {
        if (conf.devs.indexOf(msg.author.id) > -1)
            return false;
        msg.channel.send({
            embed: {
                title: "Admin command",
                color: conf.color.error,
                description: "<@" + msg.author.id + "> you're not worthy to use this command"
            }
        });
        return true;
    };

    switch (args[0]) {
        
        // Exchanges: 

        case "price": {
            cmd.price();
            break;
        }

        // Coin Info:

        case "stats": {
            if (conf.cmd.stats.stats)
                cmd.stats();
            break;
        }
        case "earnings": { 
            if (conf.cmd.earnings)
                cmd.earnings();
            break;
        }

        // Explorer:

        case "balance": {
            if (conf.cmd.balance && !error_noparam(2, "You need to provide an address"))
                cmd.balance(args[1]);
            break;
        }
        case "block-index": {
            if (conf.cmd.blockindex && !error_noparam(2, "You need to provide a block number"))
                cmd.block_index(args[1]);
            break;
        }
        case "block-hash": {
            if (conf.cmd.blockhash && !error_noparam(2, "You need to provide a block hash"))
                cmd.block_hash(args[1]);
            break;
        }

        // Other:

        case "help": {
            cmd.help();
            break;
        }
        case "about": { 
            cmd.about();
            break;
        }
        case "meaning-of-life": { // easter egg
            msg.channel.send({
                embed: {
                    title: "Answer to life, the universe and everything",
                    color: conf.color.other,
                    description: "42"
                }
            });
            break;
        }
        case "price-go-to-the-moon": { // easter egg
            msg.channel.send({
                embed: {
                    title: "**Price Ticker**",
                    color: conf.color.prices,
                    description: "**All Exchanges: ** One jillion satoshis"
                }
            });
            break;
        }

        // Admin only:

        case "conf-get": {
            if (!error_noworthy())
                cmd.conf_get();
            break;
        }
        case "conf-set": {
            if (!error_noworthy())
                cmd.conf_set();
            break;
        }
        
    }

}

function debug_bot() {

    const exch_check = (val) => {
        return "[" + (val === undefined ? "-" : val === "Error" ? "X" : String.fromCharCode(8730)) + "]";
    };
    const req_check = (req, fn, param = "") => {
        console.log(" - " + req + ": " + (conf.requests[req] === "" ? "Disabled" : fn(bash_cmd(conf.requests[req] + param))));
    };
    const req_check_json = (req, fn, param = "") => {
        if (conf.requests[req] === "") {
            console.log(" - " + req + ": Disabled");
        }
        else {
            try {
                var json = JSON.parse(bash_cmd(conf.requests[req] + param));
                console.log(" - " + req + ":");
                fn(json);
            }
            catch (e) {
                console.log(" - " + req + ": Bad data format, expected JSON");
            }
        }
    };

    if (process.argv.length < 3 || process.argv[2].toLowerCase() !== "debug")
        return;

    console.log("\nChecking bot...");
    console.log("  balance value: "   + (process.argv.length >= 3 ? process.argv[3] : "(none)"));
    console.log("  blockhash value: " + (process.argv.length >= 4 ? process.argv[4] : "(none)"));

    console.log("\nTickers: [price][volume][ask][bid][change] (" + String.fromCharCode(8730) + " == OK / X == ERR / - == Not supported) :");
    for (let exch of conf.ticker) {
        var exd = get_ticker(exch);
        console.log(" - " + exch + ": " + exch_check(exd.price) + exch_check(exd.volume) + exch_check(exd.ask) + exch_check(exd.bid) + exch_check(exd.change));
    }

    console.log("\nRequests:");
    
    req_check("blockcount", x => /^[0-9\n]+$/.test(x) ? "OK" : "Bad data format, expected only numbers");
    req_check("mncount", x => /^[0-9\n]+$/.test(x) ? "OK" : "Bad data format, expected only numbers");
    req_check("supply", x => /^[0-9.\n]+$/.test(x) ? "OK" : "Bad data format, expected only numbers and/or a dot");
    req_check_json("balance", x => {
        console.log("     > sent: " + (x["sent"] === undefined ? "Missing attribute" : /^[0-9.\n]+$/.test(x["sent"]) ? "OK" : "Bad data format, expected only numbers and/or a dot"));
        console.log("     > received: " + (x["received"] === undefined ? "Missing attribute" : /^[0-9.\n]+$/.test(x["received"]) ? "OK" : "Bad data format, expected only numbers and/or a dot"));
        console.log("     > balance: " + (x["balance"] === undefined ? "Missing attribute" : /^[0-9.\n]+$/.test(x["balance"]) ? "OK" : "Bad data format, expected only numbers and/or a dot"));
    }, process.argv[3]);
    req_check("blockindex", x => /^[A-Za-z0-9\n]+$/.test(x) ? "OK" : "Bad data format, expected only letters and numbers", "1");
    req_check_json("blockhash", x => {
            console.log("     > height: "            + (x["height"]            === undefined ? "Missing attribute" : /^[0-9\n]+$/.test(x["height"])                   ? "OK" : "Bad data format, expected only numbers"));
            console.log("     > hash: "              + (x["hash"]              === undefined ? "Missing attribute" : /^[A-Za-z0-9\n]+$/.test(x["hash"])               ? "OK" : "Bad data format, expected only numbers and letters"));
            console.log("     > confirmations: "     + (x["confirmations"]     === undefined ? "Missing attribute" : /^[0-9\n]+$/.test(x["confirmations"])            ? "OK" : "Bad data format, expected only numbers"));
            console.log("     > size: "              + (x["size"]              === undefined ? "Missing attribute" : /^[0-9\n]+$/.test(x["size"])                     ? "OK" : "Bad data format, expected only numbers"));
            console.log("     > previousblockhash: " + (x["previousblockhash"] === undefined ? "Missing attribute" : /^[A-Za-z0-9\n]+$/.test(x["previousblockhash"])  ? "OK" : "Bad data format, expected only numbers and letters"));
            console.log("     > nextblockhash: "     + (x["nextblockhash"]     === undefined ? "Missing attribute" : /^[A-Za-z0-9\n]+$/.test(x["nextblockhash"])      ? "OK" : "Bad data format, expected only numbers and letters"));
            console.log("     > tx: "                + (x["tx"]                === undefined ? "Missing attribute" : typeof x["tx"][Symbol.iterator] === "function"   ? "OK" : "Bad data format, expected a list"));
    }, process.argv[4]);
    console.log("\nIMPORTANT NOTE: If you're using explorer urls, and the explorer doesn't allow too much consecutives API calls, then you should whitelist the bot IP, otherwise you may expect sometimes a error on some commands, even in this debug mode.\n");
    process.exit();
}

process.on("uncaughtException", err => {
    console.log("Global exception caught: " + err);
    restart_bot();
});
process.on("unhandledRejection", err => {
    console.log("Global rejection handled: " + err);
    restart_bot();
});

debug_bot();
client.on("message", response_msg);
client.login(conf.token).then(() => console.log("Bot ready!"));

