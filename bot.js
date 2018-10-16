
const Discord = require("discord.js");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require("fs");
const spawnSync = require("child_process").spawnSync;
var conf = get_config();
var client = new Discord.Client();

/* TODO: 
 *  - fix bad placing on !price with a row of 2 tickers
 *  - moaaar exchanges
*/ 

class ExchangeData {
    constructor(name) {
        this.name = name;
        this.link = "";
        this.price = "Error";
        this.volume = "Error";
        this.ask = "Error";
        this.bid = "Error";
        this.change = "Error";
    }
    fillj(json, price, volume, ask, bid, change) {
        this.fill(json[price], json[volume], json[ask], json[bid], json[change]);
    }
    fill(price, volume, ask, bid, change) {
        this.price  = isNaN(price)  ? "Not Supported" : parseFloat(price).toFixed(8);
        this.volume = isNaN(volume) ? "Not Supported" : parseFloat(volume).toFixed(8);
        this.ask    = isNaN(ask)    ? "Not Supported" : parseFloat(ask).toFixed(8);
        this.bid    = isNaN(bid)    ? "Not Supported" : parseFloat(bid).toFixed(8);
        this.change = isNaN(change) ? "Not Supported" : (change >= 0.0 ? "+" : "") + parseFloat(change).toFixed(2) + "%";
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
        switch (exchange) {
            case "CryptoBridge": {
                exdata.fillj(js_request("https://api.crypto-bridge.org/api/v1/ticker/{COIN}_BTC"), "last", "volume", "bid", "ask", "percentChange");
                exdata.link = rg_replace("https://wallet.crypto-bridge.org/market/BRIDGE.{COIN}_BRIDGE.BTC");
                break;
            }
            case "Crex24": {
                exdata.fillj(js_request("https://api.crex24.com/v2/public/tickers?instrument={COIN}-BTC")[0], "last", "volumeInBtc", "bid", "ask", "percentChange");
                exdata.link = rg_replace("https://crex24.com/exchange/{COIN}-BTC");
                break;
            }
            case "CoinExchange": {
                exdata.fillj(js_request("https://www.coinexchange.io/api/v1/getmarketsummary?market_id=" + conf.special_ticker.CoinExchange)["result"], "LastPrice", "BTCVolume", "BidPrice", "AskPrice", "Change");
                exdata.link = rg_replace("https://www.coinexchange.io/market/{COIN}/BTC");
                break;
            }
            case "Graviex": {
                exdata.fillj(js_request("https://graviex.net:443//api/v2/tickers/{COIN}btc.json", true)["ticker"], "last", "volbtc", "buy", "sell", "change");
                exdata.link = rg_replace("https://graviex.net/markets/{COIN}btc", true);
                break;
            }
            case "Escodex": {
                exdata.fillj(js_request("http://labs.escodex.com/api/ticker").find(x => x.base === "BTC" && x.quote === conf.coin.toUpperCase()), "latest", "base_volume", "lowest_ask", "highest_bid", "percent_change");
                exdata.link = rg_replace("https://wallet.escodex.com/market/ESCODEX.{COIN}_ESCODEX.BTC");
                break;
            }
            case "Cryptopia": {
                exdata.fillj(js_request("https://www.cryptopia.co.nz/api/GetMarket/{COIN}_BTC")["Data"], "LastPrice", "BaseVolume", "AskPrice", "BidPrice", "Change");
                exdata.link = rg_replace("https://www.cryptopia.co.nz/Exchange/?market={COIN}_BTC");
                break;
            }
            case "Stex": {
                tmp = js_request("https://app.stex.com/api2/ticker").find(x => x.market_name === rg_replace("{COIN}_BTC"));
                exdata.fill(tmp["last"], (tmp["last"] + tmp["lastDayAgo"]) / 2 * tmp["volume"], tmp["ask"], tmp["bid"], tmp["last"] / tmp["lastDayAgo"]); // volume and change not 100% accurate
                exdata.link = rg_replace("https://app.stex.com/en/basic-trade/BTC?currency2={COIN}");
                break;
            }
            case "C-CEX": {
                tmp = js_request("https://c-cex.com/t/{COIN}-btc.json", true)["ticker"];
                exdata.fill(tmp["lastprice"], js_request("https://c-cex.com/t/volume_btc.json")["ticker"][conf.coin.toLowerCase()]["vol"], tmp["buy"], tmp["sell"], undefined);
                exdata.link = rg_replace("https://c-cex.com/?p={COIN}-btc", true);
                break;
            }
            case "HitBTC": {
                exdata.fillj(js_request("https://api.hitbtc.com/api/2/public/ticker/{COIN}BTC"), "last", "volumeQuote", "ask", "bid", ""); // change not supported
                exdata.link = rg_replace("https://hitbtc.com/{COIN}-to-BTC");
                break;
            }
            case "YoBit": {
                exdata.fillj(js_request("https://yobit.net/api/2/{COIN}_btc/ticker", true)["ticker"], "last", "vol", "buy", "sell", ""); // change not supported
                exdata.link = rg_replace("https://yobit.net/en/trade/{COIN}/BTC");
                break;
            }
            case "Bittrex": {
                tmp = js_request("https://bittrex.com/api/v1.1/public/getmarketsummary?market=btc-{COIN}", true)["result"][0];
                exdata.fill(tmp["Last"], tmp["BaseVolume"], tmp["Bid"], tmp["Ask"], tmp["Last"] / tmp["PrevDay"]); // change not 100% accurate
                exdata.link = rg_replace("https://www.bittrex.com/Market/Index?MarketName=BTC-{COIN}");
                break;
            }
            //case "Injex": { // added cause SNO got listed there, but it's seems like a scam, I'll enable if it becomes trusty
            //    exdata.fillj(js_request("https://api.injex.io/v1/market/stats/{COIN}/BTC")[0], "last_price", "24hvol_btc", "top_bid", "top_ask", "change");
            //    exdata.link = rg_replace("https://ex.injex.io/trade/{COIN}/BTC");
            //    break; 
            //}
        }
    }
    catch (e) {
        console.log("Error retrieving " + exchange + " data: " + e);
    }

    return exdata;
}
function get_config() {
    var str = fs.readFileSync("./config.json", "utf8"); // for some reason is adding a invalid character at the beggining that causes a throw
    var json = JSON.parse(str.slice(str.indexOf("{")));
    json.cmd = {
        stats: json.requests.blockcount !== "" && json.requests.mncount !== "" && json.requests.supply !== "",
        earnings: json.requests.blockcount !== "" && json.requests.mncount !== "",
        balance: json.requests.balance !== "",
        blockindex: json.requests.blockhash !== "" && json.requests.blockindex !== "",
        blockhash: json.requests.blockhash !== ""
    };
    return json;
}
function get_stage(blk) {
    for (stage of conf.stages)
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
    for (i = 5; i > 0; i--) {
        console.log("Restarting bot in " + i + " seconds..."); // just to avoid constant reset in case of constant crash cause no internet
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
    client = new Discord.Client();
    client.on("message", response_msg);
    client.login(conf.token).then(() => console.log("Bot restart succeeded!"));
}
function block_info_message(msg, blk) {
    var str = "Invalid block index or hash";
    try {
        var json = JSON.parse(blk);
        str =
            "**Index:** " + json["height"] + "\n" +
            "**Hash:** " + json["hash"] + "\n" +
            "**Confirmations:** " + json["confirmations"] + "\n" +
            "**Size:** " + json["size"] + "\n" +
            "**Date:** " + new Date(new Number(json["time"]) * 1000).toUTCString() + "\n" +
            "**Prev Hash:** " + json["previousblockhash"] + "\n" +
            "**Next Hash:** " + json["nextblockhash"] + "\n" +
            "**Transactions:**\n";
        for (i = 0; i < json["tx"].length; i++)
            str += json["tx"][i] + "\n";
    }
    catch (e) {
       //
    }
    msg.channel.send({
        embed: {
            title: "Block info",
            color: conf.color.explorer,
            description: str
        }
    });
}

function response_msg(msg) {

    if (msg.channel.id !== conf.channel || !msg.content.startsWith(conf.prefix) || msg.author.bot)
        return;
    
    var cmds = msg.content.slice(1).split(" ");
    var json, stage;

    const error_noparam = (n, descr) => {
        if (cmds.length >= n)
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

    switch (cmds[0]) {
        
        // Exchanges: 

        case "price": {

            var promises = [];
            for (ticker of conf.ticker)
                promises.push(new Promise((resolve, reject) => resolve(get_ticker(ticker))));

            Promise.all(promises).then(values => { 
                var fields_ticker = [];
                for (data of values) {
                    fields_ticker.push({
                        name: data.name,
                        value: "**| Price** : " + data.price + "\n" +
                            "**| Vol** : " + data.volume + "\n" +
                            "**| Buy** : " + data.ask + "\n" +
                            "**| Sell** : " + data.bid + "\n" +
                            "**| Chg** : " + data.change + "\n" +
                            "[Link](" + data.link + ")",
                        inline: true
                    });
                }

                msg.channel.send({
                    embed: {
                        title: "**Price Ticker**",
                        color: conf.color.prices,
                        fields: fields_ticker,
                        timestamp: new Date()
                    }
                });
            });

            break;
        }

        // Coin Info:

        case "stats": {
            if (!conf.cmd.stats) break;
            Promise.all([
                new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.blockcount))),
                new Promise((resolve, reject) => resolve(JSON.parse(bash_cmd(conf.requests.mncount))["enabled"])),
                new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.supply)))
            ]).then(([blockcount, mncount, supply]) => {
                stage = get_stage(blockcount);
                msg.channel.send({
                    embed: {
                        title: conf.coin + " Stats",
                        color: conf.color.coininfo,
                        fields: [
                            {
                                name: "Block Count",
                                value: blockcount,
                                inline: true
                            },
                            {
                                name: "MN Count",
                                value: mncount,
                                inline: true
                            },
                            {
                                name: "Supply",
                                value: parseFloat(supply).toFixed(4).replace(/(\d)(?=(?:\d{3})+(?:\.|$))|(\.\d{4}?)\d*$/g, (m, s1, s2) => s2 || s1 + ',') + " " + conf.coin,
                                inline: true
                            },
                            {
                                name: "Collateral",
                                value: stage.coll + " " + conf.coin,
                                inline: true
                            },
                            {
                                name: "MN Reward",
                                value: stage.mn + " " + conf.coin,
                                inline: true
                            },
                            {
                                name: "POS Reward",
                                value: stage.pos + " " + conf.coin,
                                inline: true
                            },
                            {
                                name: "Locked",
                                value: (mncount * stage.coll).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " " + conf.coin + " (" + (mncount * stage.coll / supply * 100).toFixed(2) + "%)",
                                inline: true
                            },
                            {
                                name: "Avg. MN Reward",
                                value: parseInt(mncount / 1440) + "d " + parseInt(mncount / 60 % 24) + "h " + mncount % 60 + "m",
                                inline: true
                            }
                        ],
                        timestamp: new Date()
                    }
                });
            });
            break;
        }
        case "earnings": { 
            if (!conf.cmd.earnings) break;
            Promise.all([
                new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.blockcount))),
                new Promise((resolve, reject) => resolve(JSON.parse(bash_cmd(conf.requests.mncount))["enabled"]))
            ]).then(([blockcount, mncount]) => {
                stage = get_stage(blockcount);
                var coinday = 86400 / conf.blocktime / mncount * stage.mn;
                msg.channel.send({
                    embed: {
                        title: conf.coin + " earnings",
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
            break;
        }

        // Explorer:

        case "balance": {
            if (!conf.cmd.balance || error_noparam(2, "You need to provide an address")) break;
            try {
                json = JSON.parse(bash_cmd(conf.requests.balance + cmds[1]));
                msg.channel.send({
                    embed: {
                        title: "Balance",
                        color: conf.color.explorer,
                        fields: [
                            {
                                name: "Address",
                                value: cmds[1]
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
                break;
            }
            catch (e) {
                //
            }
            msg.channel.send({
                embed: {
                    title: "Balance",
                    color: conf.color.explorer,
                    description: "Invalid address: " + cmds[1],
                    timestamp: new Date()
                }
            });
            break;
        }
        case "block-index": {
            if (!conf.cmd.blockindex || error_noparam(2, "You need to provide a block number")) break;
            block_info_message(msg, bash_cmd(conf.requests.blockhash + " " + bash_cmd(conf.requests.blockindex + " " + cmds[1])));
            break;
        }
        case "block-hash": {
            if (!conf.cmd.blockhash || error_noparam(2, "You need to provide a block hash")) break;
            block_info_message(msg, bash_cmd(conf.requests.blockhash + " " + cmds[1]));
            break;
        }

        // Other:

        case "help": {
            const blocked_cmd = (cmd, str) => {
                return !cmd ? "*blocked command*" : str;
            };
            msg.channel.send({
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
                                " - **" + conf.prefix + "stats** : " + blocked_cmd(conf.cmd.stats, "get the current stats of the " + conf.coin + " blockchain") + "\n" +
                                " - **" + conf.prefix + "earnings** : " + blocked_cmd(conf.cmd.earnings, "get the expected " + conf.coin + " earnings per masternode to get an idea of how close you are to getting a lambo") + "\n" +
                                " - **" + conf.prefix + "balance <address>** : " + blocked_cmd(conf.cmd.balance, "show the balance, sent and received of the given address") + "\n" +
                                " - **" + conf.prefix + "block-index <number>** : " + blocked_cmd(conf.cmd.blockindex, "show the info of the block by its index") + "\n" +
                                " - **" + conf.prefix + "block-hash <hash>** : " + blocked_cmd(conf.cmd.blockhash, "show the info of the block by its hash") + "\n" 
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
            break;
        }
        case "about": { 
            const donate = { // don't be evil with this, please
                "BCARD": "BQmTwK685ajop8CFY6bWVeM59rXgqZCTJb",
                "SNO": "SZ4pQpuqq11EG7dw6qjgqSs5tGq3iTw2uZ"
            };
            msg.channel.send({
                embed: {
                    title: "**About**",
                    color: conf.color.other,
                    description: "**Author:** <@464599914962485260>\n" + 
                        "**Source Code:** [Link](" + conf.sourcecode + ")\n" + // source link on conf just in case I change the repo
                        "**Description:** A simple bot for " + conf.coin + " to check the current status of the currency in many ways, use **!help** to see these ways\n" + 
                        (conf.coin in donate ? "**" + conf.coin + " Donations (to author):** " + donate[conf.coin] + "\n" : "") +
                        "** BTC Donations (to author):** 3HE1kwgHEWvxBa38NHuQbQQrhNZ9wxjhe7\n" 
                }
            });
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
            if (error_noworthy()) break;
            msg.channel.send("<@" + msg.author.id + "> check the dm I just sent to you :wink:");
            msg.author.send({ files: ["./config.json"] });
            break;
        }
        case "conf-set": {
            if (error_noworthy()) break;
            msg.channel.send("<@" + msg.author.id + "> check the dm I just sent to you :wink:");
            msg.author.send("Put the config.json file here and I'll update myself with the changes, don't send any message, just drag and drop the file, you have 90 seconds to put the file or you'll have to use **!conf-set** again").then(reply => {
                var msgcol = new Discord.MessageCollector(reply.channel, m => m.author.id === msg.author.id, { time: 90000 });
                msgcol.on("collect", (elem, col) => {
                    msgcol.stop("received");
                    if (elem.attachments.array()[0]["filename"] !== "config.json") {
                        msg.author.send("I requested a file called 'config.json', not whatever is this :expressionless: ");
                        return;
                    }
                    try {
                        var conf_res = synced_request(elem.attachments.array()[0]["url"]);
                        conf_res = conf_res.slice(conf_res.indexOf("{"));
                        JSON.parse(conf_res); // just check if throws
                        fs.writeFileSync("./config.json", conf_res);
                        conf = get_config();
                        msg.channel.send("Config updated by <@" + msg.author.id + ">, if something goes wrong, it will be his fault :stuck_out_tongue: ");
                    }
                    catch (e) {
                        msg.author.send("Something seems wrong on the json file you sent, check that everything is okay and use **!conf-set** again");
                    }
                });
                msgcol.on("end", (col, reason) => {
                    if (reason === "time")
                        msg.author.send("Timeout, any file posted from now ill be ignored unless **!conf-set** is used again");
                });
            });
            break;
        }
        
    }

}

process.on("uncaughtException", err => {
    console.log("Global exception caught: " + err);
    restart_bot();
});
process.on("unhandledRejection", err => {
    console.log("Global rejection handled: " + err);
    restart_bot();
});

client.on("message", response_msg);
client.login(conf.token).then(() => console.log("Bot ready!"));

