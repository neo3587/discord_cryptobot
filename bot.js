
/*
    Author: neo3587
    Source: https://github.com/neo3587/discord_cryptobot
    TODO (probably... some day):
        - !my-masternode-list -> click => info... is it even possible?, if not => field message (status, protocol, last seen, last payed, active time)
        - tiered MNs support
		- external script stage rewards (ex: always halving every N blocks) => print: ["mn":number, "pos":number, "pow":number, "next":block_left]

	ON PROGRESS:
		[X] remove dead exchanges
		[?] price & stats monitor only
		[ ] channel name price & stats
		[X] shared calls
		[X] remove useless commands: explorer & user address
		[X] join my-masternode colors
		[ ] my-earnings count only enabled nodes & show disabled count
		[ ] monitor message edit instead of delete (purge message on init)
		[ ] check for new exchanges to add
*/

/** @typedef {Object} Configuration
  * @property {string[]} special_ticker -
  * @property {Array<string|string[]>} ticker -
  * @property {{price:number, stats:number, stages:number, earnings:number, mining:number, addnodes:number,
                my_masternode:number, help:number, about:number, warning:number, error:number}} color -
  * @property {string[]} devs -
  * @property {{block:number, coll?: number, mn?:number, pos?:number, pow?:number}[]} stages -
  * @property {{blockcount:string, mncount:string, supply:string, balance:string, blockindex:string, blockhash:string, mnstat:string, addnodes:string}} requests -
  * @property {string[]} statorder -
  * @property {{enabled:true, channel:string, interval:number}} monitor -
  * @property {{enabled:true, data:Array<{channel:string, type:string, exchange?:string}>, interval:number}} channel_monitor -
  * @property {boolean} hidenotsupported -
  * @property {boolean} useraddrs -
  * @property {boolean} usermns -
  * @property {string[]} channel -
  * @property {string} prefix -
  * @property {string} coin -
  * @property {number} blocktime -
  * @property {number} tickrate -
  * @property {string} token -
*/

const Discord = require("discord.js");
const { XMLHttpRequest } = require("xmlhttprequest");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");


class ExchangeData {
	constructor(name) {
		this.name = name;
		this.link = "";
		this.price = "Error";
		this.volume = "Error";
		this.buy = "Error";
		this.sell = "Error";
		this.change = "Error";
		// this.high ?
		// this.low ?
	}
	fillj(json, price, volume, buy, sell, change) {
		this.fill(json[price], json[volume], json[buy], json[sell], json[change]);
	}
	fill(price, volume, buy, sell, change) {
		if (price === undefined && volume === undefined && buy === undefined && sell === undefined && change === undefined)
			return;
		this.set("price", price);
		this.set("volume", volume);
		this.set("buy", buy);
		this.set("sell", sell);
		this.set("change", change);
	}
	set(prop, val) {
		this[prop] = isNaN(val) ? undefined : prop !== "change" ? parseFloat(val).toFixed(8) :
			(val >= 0.0 ? "+" : "") + parseFloat(val).toFixed(2) + "%";
	}
}

class SharedData {

	constructor() {
		/** @type {Array<{val:ExchangeData, time:Date}>} */
		this._exdata = conf.ticker.map(x => ({ val: new ExchangeData(x), time: new Date(0) }));
		this._btcusd = { val: 0.0, time: new Date(0) };
		this._blockcount = { val: 0, time: new Date(0) };
		this._mncount = { val: 0, time: new Date(0) };
		this._supply = { val: 0, time: new Date(0) };
		this._hashrate = { val: 0, time: new Date(0) };
	}

	_refresh(data, fn) {
		return new Promise((resolve, reject) => {
			if (new Date() - data.time >= conf.tickrate * 1000) {
				data.time = new Date();
				fn(resolve);
			}
			else {
				resolve(data.val);
			}
		}).then(x => {
			data.val = x;
			return data.val;
		});
	}

	get_ticker(ticker) {
		return this._refresh(this._exdata.find(x => x.val.name.toLowerCase() === ticker.toLowerCase()), (resolve) => {

			const js_request = (url, fn) => {
				async_request(url).then(x => {
					try {
						fn(JSON.parse(x));
					}
					catch (e) { /**/ }
					resolve(exdata);
				}).catch(() => resolve(exdata));
			};

			let exdata = new ExchangeData(), tmp, coin_up, coin_lw, exchange;

			if (Array.isArray(ticker)) {
				coin_up = [ticker[1].toUpperCase(), ticker[2].toUpperCase()];
				coin_lw = [ticker[1].toLowerCase(), ticker[2].toLowerCase()];
				exchange = ticker[0];
				exdata.name = `${exchange} (${coin_up[0] !== conf.coin.toUpperCase() ? coin_up[0] + "-" : ""}${coin_up[1]})`;
			}
			else {
				coin_up = [conf.coin.toUpperCase(), "BTC"];
				coin_lw = [conf.coin.toLowerCase(), "btc"];
				exchange = ticker;
				exdata.name = exchange;
			}

			switch (exchange.toLowerCase()) {
				case "crex24": {
					exdata.link = `https://crex24.com/exchange/${coin_up[0]}-${coin_up[1]}`;
					js_request(`https://api.crex24.com/v2/public/tickers?instrument=${coin_up[0]}-${coin_up[1]}`, res => exdata.fillj(res[0], "last", "volumeInBtc", "bid", "ask", "percentChange"));
					break;
				}
				case "graviex": {
					exdata.link = `https://graviex.net/markets/${coin_lw[0]}${coin_lw[1]}`;
					js_request(`https://graviex.net:443/api/v2/tickers/${coin_lw[0]}${coin_lw[1]}.json`, res => {
						res = res.ticker;
						exdata.fill(res.last, res.volbtc, res.buy, res.sell, res.change * 100);
					});
					break;
				}
				case "stex": {
					exdata.link = `https://app.stex.com/en/trade/pair/${coin_up[1]}/${coin_up[0]}`;
					js_request(`https://app.stex.com/api2/ticker`, res => {
						tmp = res.find(x => x.market_name === `${coin_up[0]}_${coin_up[1]}`);
						exdata.fill(tmp.last, (parseFloat(tmp.last) + parseFloat(tmp.lastDayAgo)) / 2 * tmp.vol, tmp.ask, tmp.bid, tmp.lastDayAgo !== 0 ? (tmp.last / tmp.lastDayAgo - 1) * 100 : 0); // volume and change not 100% accurate
					});
					break;
				}
				case "hitbtc": {
					exdata.link = `https://hitbtc.com/${coin_up[0]}-to-${coin_up[1]}`;
					js_request(`https://api.hitbtc.com/api/2/public/ticker/${coin_up[0]}${coin_up[1]}`, res => exdata.fillj(res, "last", "volumeQuote", "ask", "bid", "")); // change not supported
					break;
				}
				case "yobit": {
					exdata.link = `https://yobit.net/en/trade/${coin_up[0]}/${coin_up[1]}`;
					js_request(`https://yobit.net/api/2/${coin_lw[0]}_${coin_lw[1]}/ticker`, res => exdata.fillj(res.ticker, "last", "vol", "buy", "sell", "")); // change not supported
					break;
				}
				case "bittrex": {
					exdata.link = `https://www.bittrex.com/Market/Index?MarketName=${coin_up[1]}-${coin_up[0]}`;
					js_request(`https://bittrex.com/api/v1.1/public/getmarketsummary?market=${coin_lw[1]}-${coin_lw[0]}`, res => {
						tmp = res.result[0];
						exdata.fill(tmp.Last, tmp.BaseVolume, tmp.Bid, tmp.Ask, tmp.Last / tmp.PrevDay); // change not 100% accurate
					});
					break;
				}
				case "southxchange": {
					exdata.link = `https://www.southxchange.com/Market/Book/${coin_up[0]}/${coin_up[1]}`;
					js_request(`https://www.southxchange.com/api/price/${coin_up[0]}/${coin_up[1]}`, res => exdata.fillj(res, "Last", "Volume24Hr", "Bid", "Ask", "Variation24Hr"));
					break;
				}
				case "exrates": {
					exdata.link = `https://exrates.me/dashboard`; // no filter
					js_request(`https://exrates.me/openapi/v1/public/ticker?currency_pair=${coin_lw[0]}_${coin_lw[1]}`, res => exdata.fillj(res[0], "last", "quoteVolume", "highestBid", "lowestAsk", "percentChange"));
					break;
				}
				case "binance": {
					exdata.link = `https://www.binance.com/es/trade/${coin_up[0]}_${coin_up[1]}`;
					js_request(`https://api.binance.com/api/v1/ticker/24hr?symbol=${coin_up[0]}${coin_up[1]}`, res => exdata.fillj(res, "lastPrice", "quoteVolume", "bidPrice", "askPrice", "priceChangePercent"));
					break;
				}
				case "bitfinex": {
					exdata.link = `https://www.bitfinex.com/t/${coin_up[0]}:${coin_up[1]}`;
					// [bid, bidsize, ask, asksize, daychg, daychg%, last, vol, high, low]
					js_request(`https://api.bitfinex.com/v2/ticker/t${coin_up[0]}${coin_up[1]}`, res => exdata.fill(res[6], (res[8] + res[9]) / 2 * res[7], res[0], res[2], res[5])); // volume not 100% accurate
					break;
				}
				case "coinex": {
					exdata.link = `https://www.coinex.com/exchange?currency=${coin_lw[1]}&dest=${coin_lw[0]}#limit`;
					js_request(`https://api.coinex.com/v1/market/ticker?market=${coin_up[0]}${coin_up[1]}`, res => {
						tmp = res.data.ticker;
						exdata.fill(tmp.last, (parseFloat(tmp.high) + parseFloat(tmp.low)) / 2 * tmp.vol, tmp.buy, tmp.sell, tmp.last / tmp.open); // volume not 100% accurate
					});
					break;
				}
				case "p2pb2b": {
					exdata.link = `https://p2pb2b.io/trade/${coin_up[0]}_${coin_up[1]}`;
					js_request(`https://p2pb2b.io/api/v1/public/ticker?market=${coin_up[0]}_${coin_up[1]}`, res => exdata.fillj(res.result, "last", "deal", "bid", "ask", "change"));
					break;
				}
				case "coinsbit": {
					exdata.link = `https://coinsbit.io/trade/${coin_up[0]}_${coin_up[1]}`;
					js_request(`https://coinsbit.io/api/v1/public/ticker?market=${coin_up[0]}_${coin_up[1]}`, res => exdata.fillj(res, result, "last", "deal", "bid", "ask", "change"));
					break;
				}
				case "tradesatoshi": {
					exdata.link = `https://tradesatoshi.com/Exchange/?market=${coin_up[0]}_${coin_up[1]}`;
					js_request(`https://tradesatoshi.com/api/public/getmarketsummary?market=${coin_up[0]}_${coin_up[1]}`, res => exdata.fillj(res.result, "last", "baseVolume", "bid", "ask", "change"));
					break;
				}
				case "coinbene": {
					exdata.link = `https://www.coinbene.com/exchange.html#/exchange?pairId=${coin_up[0]}${coin_up[1]}`;
					js_request(`https://api.coinbene.com/v1/market/ticker?symbol=${coin_lw[0]}${coin_lw[1]}`, res => exdata.fillj(res.ticker[0], "last", "24hrAmt", "bid", "ask", "")); // not supported change
					break;
				}
				case "finexbox": {
					exdata.link = `https://www.finexbox.com/market/pair/${coin_up[0]}-${coin_up[1]}.html`;
					Promise.all([
						async_request(`https://xapi.finexbox.com/v1/ticker?market=${coin_lw[0]}_${coin_lw[1]}`).catch(() => { }),
						async_request(`https://xapi.finexbox.com/v1/orders?market=${coin_lw[0]}_${coin_lw[1]}&count=1`).catch(() => { })
					]).then(([res, ord]) => {
						try {
							res = JSON.parse(res).result;
							exdata.set("price", res.price);
							exdata.set("volume", res.volume * res.average);
						}
						catch (e) { /**/ }
						try {
							ord = JSON.parse(ord).result;
							exdata.set("buy", ord.buy.length && ord.buy[0].price);
							exdata.set("sell", ord.sell.length && ord.sell[0].price);
						}
						catch (e) { /**/ }
						exdata.change = undefined;
						resolve(exdata); // volume not 100% accurate, 24h change not supported
					});
					break;
				}
				case "cryptohubexchange": {
					exdata.link = `https://cryptohubexchange.com/market/${coin_up[0]}/${coin_up[1]}/`;
					js_request(`https://cryptohubexchange.com/api/market/ticker/${coin_up[0]}/`, res => exdata.fillj(res[`${coin_up[1]}_${coin_up[0]}`], "last", "baseVolume", "highestBid", "lowestAsk", "percentChange"));
					break;
				}
				case "altmarkets": {
					exdata.link = `https://altmarkets.io/trading/${coin_lw[0]}${coin_lw[1]}`;
					js_request(`https://altmarkets.io/api/v2/tickers/${coin_lw[0]}${coin_lw[1]}`, res => exdata.fillj(res.ticker, "last", "quotevol", "buy", "sell", "")); // not supported change
					break;
				}
				default: {
					resolve(exdata);
				}
			}

		});
	}
	price_avg() {
		return new Promise((resolve, reject) => {
			let promises = [];
			for (let ticker of conf.ticker.filter(x => !Array.isArray(x) || x[2].toUpperCase() === "BTC"))
				promises.push(this.get_ticker(ticker));
			Promise.all(promises).then(values => {
				let price = 0.00, weight = 0.00;
				values = values.filter(x => !isNaN(x.price));
				values.forEach(x => {
					x.volume = isNaN(x.volume) ? 0 : parseFloat(x.volume);
					weight += x.volume;
				});
				values.forEach(x => price += parseFloat(x.price) * (weight !== 0 ? x.volume / weight : 1 / values.length));
				resolve(values.length === 0 ? undefined : price);
			});
		});
	}
	price_btc_usd() {
		return this._refresh(this._btcusd, (resolve) => {
			async_request("https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD").then(res => {
				try {
					resolve(JSON.parse(res).USD);
				}
				catch (e) {
					resolve(0);
				}
			}).catch(() => resolve(0));
		});
	}
	blockcount() {
		return this._refresh(this._blockcount, (resolve) => {
			resolve(bash_cmd(conf.requests.blockcount));
		});
	}
	mncount() {
		return this._refresh(this._mncount, (resolve) => {
			let cmd_res = bash_cmd(conf.requests.mncount);
			try {
				let json = JSON.parse(cmd_res);
				if (json.enabled !== undefined) {
					resolve(json.enabled.toString());
					return;
				}
			}
			catch (e) { /**/ }
			cmd_res = cmd_res.toString().replace("\n", "").trim();
			resolve(/^[0-9]+$/.test(cmd_res) ? cmd_res : "");
		});
	}
	supply() {
		return this._refresh(this._supply, (resolve) => {
			resolve(bash_cmd(conf.requests.supply));
		});
	}
	hashrate() {
		return this._refresh(this._hashrate, (resolve) => {
			resolve(bash_cmd(conf.requests.hashrate));
		});
	}
}

class BotCommand {

    /** @param {Discord.Message} msg -
      * @param {Function} fn_send - */
	constructor(msg, fn_send = txt => this.msg.channel.send(txt)) {
		this.msg = msg;
		this.fn_send = fn_send;
	}

	price() {
		let promises = [];
		for (let ticker of conf.ticker)
			promises.push(shared.get_ticker(ticker));

		return Promise.all(promises).then(values => {

			const hide_undef = (str, val) => {
				if (val === undefined)
					return conf.hidenotsupported ? "\n" : str + "Not Supported" + "\n";
				return str + val + "\n";
			};

			let embed = new Discord.RichEmbed();
			embed.title = "Price Ticker";
			embed.color = conf.color.price;
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
			if (embed.fields.length > 3 && embed.fields.length % 3 === 2) // fix bad placing if a row have 2 tickers
				embed.addBlankField(true);

			this.fn_send(embed);
		});
	}
	stats() {
		return Promise.all([
			shared.blockcount(),
			shared.mncount(),
			shared.supply()
		]).then(([blockcount, mncount, supply]) => {

			let valid = {
				blockcount: !isNaN(blockcount) && blockcount.trim() !== "",
				mncount: !isNaN(mncount) && mncount.trim() !== "",
				supply: !isNaN(supply) && supply.trim() !== ""
			};

			let stage = get_stage(blockcount);
			let stg_index = conf.stages.indexOf(stage);

			let embed = new Discord.RichEmbed();
			embed.title = conf.coin + " Stats";
			embed.color = conf.color.stats;
			embed.timestamp = new Date();

			for (let stat of conf.statorder) {
				switch (stat) {
					case "blockcount": {
						if (valid.blockcount)
							embed.addField("Block Count", blockcount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","), true);
						break;
					}
					case "mncount": {
						if (valid.mncount)
							embed.addField("MN Count", mncount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","), true);
						break;
					}
					case "supply": {
						if (valid.supply)
							embed.addField("Supply", parseFloat(supply).toFixed(4).replace(/(\d)(?=(?:\d{3})+(?:\.|$))|(\.\d{4}?)\d*$/g, (m, s1, s2) => s2 || s1 + ',') + " " + conf.coin, true);
						break;
					}
					case "collateral": {
						if (valid.blockcount)
							embed.addField("Collateral", stage.coll.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " " + conf.coin, true);
						break;
					}
					case "mnreward": {
						if (valid.blockcount)
							embed.addField("MN Reward", stage.mn + " " + conf.coin, true);
						break;
					}
					case "powreward": {
						if (stage.pow !== undefined && valid.blockcount)
							embed.addField("POW Reward", stage.pow + " " + conf.coin, true);
						break;
					}
					case "posreward": {
						if (stage.pos !== undefined && valid.blockcount)
							embed.addField("POS Reward", stage.pos + " " + conf.coin, true);
						break;
					}
					case "locked": {
						if (valid.blockcount && valid.mncount && valid.supply)
							embed.addField("Locked", (mncount * stage.coll).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " " + conf.coin + " (" + (mncount * stage.coll / supply * 100).toFixed(2) + "%)", true);
						break;
					}
					case "avgmnreward": {
						if (valid.mncount)
							embed.addField("Avg. MN Reward", parseInt(mncount / (86400 / conf.blocktime)) + "d " + parseInt(mncount / (3600 / conf.blocktime) % 24) + "h " + parseInt(mncount / (60 / conf.blocktime) % 60) + "m", true);
						break;
					}
					case "1stmnreward": {
						let x3mncount = mncount * 3;
						if (valid.mncount)
							embed.addField("1st MN Reward", parseInt(x3mncount / (86400 / conf.blocktime)) + "d " + parseInt(x3mncount / (3600 / conf.blocktime) % 24) + "h " + parseInt(x3mncount / (60 / conf.blocktime) % 60) + "m", true);
						break;
					}
					case "nextstage": {
						if (valid.blockcount)
							embed.addField("Next Stage", parseInt((conf.stages[stg_index].block - blockcount) / (86400 / conf.blocktime)) + "d " + parseInt((conf.stages[stg_index].block - blockcount) / (3600 / conf.blocktime) % 24) + "h " + parseInt((conf.stages[stg_index].block - blockcount) / (60 / conf.blocktime) % 60) + "m", true);
						break;
					}
					case "": {
						embed.addBlankField(true);
						break;
					}
				}
			}

			if (valid_request("blockcount") && !valid.blockcount)
				embed.description = (embed.description === undefined ? "" : embed.description) + "There seems to be a problem with the `blockcount` request\n";
			if (valid_request("mncount") && !valid.mncount)
				embed.description = (embed.description === undefined ? "" : embed.description) + "There seems to be a problem with the `mncount` request\n";
			if (valid_request("supply") && !valid.supply)
				embed.description = (embed.description === undefined ? "" : embed.description) + "There seems to be a problem with the `supply` request";

			this.fn_send(embed);

		});
	}

	stages() {
		return new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.blockcount))).then(blockcount => {

			let embed = new Discord.RichEmbed();
			embed.title = conf.coin + " Stages";
			embed.color = conf.color.stages;
			embed.timestamp = new Date();

			if (isNaN(blockcount) && blockcount.trim() !== "") {
				embed.description = "There seems to be a problem with the `blockcount` request\n";
			}
			else {
				let stgindex = conf.stages.indexOf(get_stage(blockcount));
				for (let i = stgindex; i < conf.stages.length && embed.fields.length < 25; i++) {
					let laststage = i > 0 ? conf.stages[i - 1] : { block: 0, coll: 0 };
					let days = (laststage.block - blockcount) / (86400 / conf.blocktime);
					embed.addField(
						"Stage " + (i + 1) + " (" + (days < 0 ? "current)" : days.toFixed(2) + " days)"),
						(laststage.block !== 0 && i !== stgindex ? "_Block:_ " + laststage.block + "\n" : "") +
						(laststage.coll < conf.stages[i].coll && i !== stgindex ? "_New collateral:_ " + conf.stages[i].coll + "\n" : "") +
						(conf.stages[i].mn !== undefined ? "_MN reward:_ " + conf.stages[i].mn + "\n" : "") +
						(conf.stages[i].pow !== undefined ? "_POW reward:_ " + conf.stages[i].pow + "\n" : "") +
						(conf.stages[i].pos !== undefined ? "_POS reward:_ " + conf.stages[i].pos + "\n" : ""),
						true
					);
				}
			}

			if (embed.fields.length > 3 && embed.fields.length % 3 === 2) // fix bad placing if a row have 2 tickers
				embed.addBlankField(true);

			this.fn_send(embed);

		});
	}
	earnings(mns) {
		return Promise.all([
			shared.blockcount(),
			shared.mncount(),
			shared.price_avg(),
			shared.price_btc_usd()
		]).then(([blockcount, mncount, avgbtc, priceusd]) => {

			let valid = {
				blockcount: !isNaN(blockcount) && blockcount.trim() !== "",
				mncount: !isNaN(mncount) && mncount.trim() !== ""
			};

			if (valid.blockcount && valid.mncount) {
				mns = mns !== undefined && mns > 0 ? mns : 1;
				let stage = get_stage(blockcount);
				let coinday = 86400 / conf.blocktime / mncount * stage.mn;
				this.fn_send({
					embed: {
						title: conf.coin + " Earnings" + (mns !== 1 ? " (" + mns + " MNs)" : ""),
						color: conf.color.earnings,
						fields: [
							{
								name: "ROI",
								value: (36500 / (stage.coll / coinday)).toFixed(2) + "%\n" + (stage.coll / coinday).toFixed(2) + " days",
								inline: true
							},
							{
								name: "MN Price",
								value: (stage.coll * avgbtc).toFixed(8) + " BTC\n" + (stage.coll * avgbtc * priceusd).toFixed(2) + " USD",
								inline: true
							}
						].concat(mns === 1 ? [{ name: "\u200b", value: "\u200b", inline: true }] : [
							{
								name: "Time to get 1 MN",
								value: (stage.coll / (coinday * mns)).toFixed(2) + " days",
								inline: true
							}
						]).concat(earn_fields(coinday * mns, avgbtc, priceusd)),
						timestamp: new Date()
					}
				});
			}
			else {
				this.fn_send(simple_message(conf.coin + " Earnings", (valid.blockcount ? "" : "There seems to be a problem with the `blockcount` request\n") + (valid.mncount ? "" : "There seems to be a problem with the `mncount` request")));
			}
		});
	}
	mining(hr, mult) {
		let letter = "";

		const calc_multiplier = () => {
			if (mult !== undefined)
				switch (mult.toUpperCase()) {
					case "K": case "KH": case "KHS": case "KH/S": case "KHASH": case "KHASHS": case "KHASH/S":
						letter = "K";
						return hr * 1000;
					case "M": case "MH": case "MHS": case "MH/S": case "MHASH": case "MHASHS": case "MHASH/S":
						letter = "M";
						return hr * 1000 * 1000;
					case "G": case "GH": case "GHS": case "GH/S": case "GHASH": case "GHASHS": case "GHASH/S":
						letter = "G";
						return hr * 1000 * 1000 * 1000;
					case "T": case "TH": case "THS": case "TH/S": case "THASH": case "THASHS": case "THASH/S":
						letter = "T";
						return hr * 1000 * 1000 * 1000 * 1000;
				}
			return hr;
		};

		if (/^[0-9.\n]+$/.test(hr)) {
			Promise.all([
				shared.blockcount(),
				shared.hashrate(),
				shared.price_avg(),
				shared.price_btc_usd()
			]).then(([blockcount, total_hr, avgbtc, priceusd]) => {

				let valid = {
					blockcount: !isNaN(blockcount) && blockcount.trim() !== "",
					mncount: !isNaN(total_hr) && total_hr.trim() !== ""
				};

				if (valid.blockcount && valid.mncount) {
					let stage = get_stage(blockcount);
					let coinday = 86400 / conf.blocktime * stage.pow * calc_multiplier() / total_hr;
					this.fn_send({
						embed: {
							title: conf.coin + " Mining (" + hr + " " + letter + "H/s)",
							color: stage.pow === undefined ? conf.color.warning : conf.color.mining,
							description: stage.pow === undefined ? "POW disabled in the current coin stage" : "",
							fields: stage.pow === undefined ? [] : earn_fields(coinday, avgbtc, priceusd),
							timestamp: new Date()
						}
					});
				}
				else {
					this.fn_send(simple_message(conf.coin + " Mining (" + hr + " " + letter + "H/s)",
						(valid.blockcount ? "" : "There seems to be a problem with the `blockcount` request\n") +
						(valid.hashrate ? "" : "There seems to be a problem with the `hashrate` request")
					));
				}
			});
		}
		else {
			this.fn_send(simple_message(conf.coin + " Mining ( ? H/s)", "Invalid hashrate"));
		}
	}
	addnodes() {
		new Promise((resolve, reject) => resolve(bash_cmd(conf.requests.addnodes))).then(info => {
			try {
				let str = "";
				JSON.parse(info).slice(0, 16).forEach(x => str += `addnode=${x.addr}\n`);
				this.fn_send(simple_message(conf.coin + " addnodes", "```ini\n" + str + "\n```", conf.color.addnodes));
			}
			catch (e) {
				this.fn_send(simple_message("Addnodes", "There seems to be a problem with the `addnodes` request"));
			}
		});
	}

	my_masternode_add(addrs) {
		create_no_exists(users_mn_folder);
		for (let addr of addrs) {
			try {
				let json = JSON.parse(bash_cmd(conf.requests.mnstat + " " + addr));
				if (Array.isArray(json))
					json = json[0];
				if (json.status !== undefined && json.addr === addr) {
					let addrs_list = fs.existsSync(users_mn_folder + "/" + this.msg.author.id + ".txt") ? fs.readFileSync(users_mn_folder + "/" + this.msg.author.id + ".txt", "utf8").split(/\r?\n/) : [];
					if (addrs_list.indexOf(addr) === -1) {
						fs.writeFileSync(users_mn_folder + "/" + this.msg.author.id + ".txt", addrs_list.concat([addr]).join("\n"));
						this.fn_send(simple_message("User Masternode Add", "Masternode address `" + addr + "` assigned to <@" + this.msg.author.id + ">\nStatus: " + json.status, conf.color.my_masternode));
					}
					else {
						this.fn_send(simple_message("User Masternode Add", "Masternode address `" + addr + "` already has been assigned to <@" + this.msg.author.id + ">", conf.color.warning));
					}
				}
			}
			catch (e) {
				this.fn_send(simple_message("User Masternode Add", "Invalid masternode address: `" + addr + "`\n(Can't be found in the masternode list)"));
			}
		}
	}
	my_masternode_del(addrs) {
		create_no_exists(users_mn_folder);
		for (let addr of addrs) {
			if (!fs.existsSync(users_mn_folder + "/" + this.msg.author.id + ".txt")) {
				this.fn_send(simple_message("User Masternode Delete", "There aren't masternode addresses assigned to <@" + this.msg.author.id + ">", conf.color.warning));
				return;
			}
			let addrs_list = fs.readFileSync(users_mn_folder + "/" + this.msg.author.id + ".txt", "utf8").split(/\r?\n/).filter(Boolean);
			let index = addrs_list.indexOf(addr);
			if (index !== -1) {
				addrs_list.splice(index, 1);
				if (addrs_list.length)
					fs.writeFileSync(users_mn_folder + "/" + this.msg.author.id + ".txt", addrs_list.join("\n"));
				else
					fs.unlinkSync(users_mn_folder + "/" + this.msg.author.id + ".txt");
				this.fn_send(simple_message("User Masternode Delete", "Masternode address `" + addr + "` deleted from <@" + this.msg.author.id + "> assigned addresses", conf.color.my_masternode));
			}
			else {
				this.fn_send(simple_message("User Masternode Delete", "Masternode address `" + addr + "` isn't assgined to <@" + this.msg.author.id + ">\nUse `" + conf.prefix + "my-masternode-list` to get your assigned masternode addresses"));
			}
		}
	}
	my_masternode_list() {
		create_no_exists(users_mn_folder);
		if (!fs.existsSync(users_mn_folder + "/" + this.msg.author.id + ".txt")) {
			this.fn_send(simple_message("User Masternode List", "There aren't masternode addresses assigned to <@" + this.msg.author.id + ">\nUse `" + conf.prefix + "my-masternode-add ADDRESS` to assign masternodes to your account", conf.color.warning));
			return;
		}

		let mn_str = "";

		for (let addr of fs.readFileSync(users_mn_folder + "/" + this.msg.author.id + ".txt", "utf8").split(/\r?\n/).filter(Boolean)) {
			mn_str += "`" + addr + "`";
			try {
				let json = JSON.parse(bash_cmd(conf.requests.mnstat + " " + addr));
				if (Array.isArray(json))
					json = json[0];
				if (json.status !== undefined && json.addr !== undefined)
					mn_str += " : " + json.status + "\n";
			}
			catch (e) {
				mn_str += " : NOT_FOUND\n";
			}
		}

		if (mn_str.length < 2000) {
			this.fn_send(simple_message("User Masternode List", mn_str, conf.color.my_masternode));
		}
		else {
			let mn_split = mn_str.split(/\r?\n/);
			let splits = parseInt(mn_split.length / 30) + 1;
			for (let i = 1; mn_split.length > 0; i++)
				this.fn_send(simple_message("User Masternode List (" + i + "/" + splits + ")", mn_split.splice(0, 30).join("\n"), conf.color.my_masternode));
		}
	}
	my_earnings() {
		create_no_exists(users_mn_folder);
		if (!fs.existsSync(users_mn_folder + "/" + this.msg.author.id + ".txt")) {
			this.fn_send(simple_message("User Earnings", "There aren't masternode addresses assigned to <@" + this.msg.author.id + ">\nUse `" + conf.prefix + "my-masternode-add ADDRESS` to assign masternodes to your account", conf.color.warning));
			return;
		}

		Promise.all([
			shared.blockcount(),
			shared.mncount(),
			shared.price_avg(),
			shared.price_btc_usd()
		]).then(([blockcount, mncount, avgbtc, priceusd]) => {

			let valid = {
				blockcount: !isNaN(blockcount) && blockcount.trim() !== "",
				mncount: !isNaN(mncount) && mncount.trim() !== ""
			};

			let mns = fs.readFileSync(users_mn_folder + "/" + this.msg.author.id + ".txt", "utf-8").split(/\r?\n/).filter(Boolean).length;

			if (valid.blockcount && valid.mncount) {
				let stage = get_stage(blockcount);
				let coinday = 86400 / conf.blocktime / mncount * stage.mn;
				this.fn_send({
					embed: {
						title: "User Earnings (" + mns + " MNs)",
						color: conf.color.my_masternode,
						fields: [
							{
								name: "Time to get 1 MN",
								value: (stage.coll / (coinday * mns)).toFixed(2) + " days"
							}
						].concat(earn_fields(coinday * mns, avgbtc, priceusd)),
						timestamp: new Date()
					}
				});
			}
			else {
				this.fn_send(simple_message("User Earnings (" + mns + " MNs)", (valid.blockcount ? "" : "There seems to be a problem with the `blockcount` request\n") + (valid.mncount ? "" : "There seems to be a problem with the `mncount` request")));
			}
		});
	}

	help() {
		this.fn_send({
			embed: {
				title: "Available commands",
				color: conf.color.help,
				fields: [
					{
						name: "Exchanges:",
						value:
							" - **" + conf.prefix + "price" + "** : get the current price of " + conf.coin + " on every listed exchange"
					},
					{
						name: "Coin Info:",
						value:
							" - **" + conf.prefix + "stats** : get the current stats of the " + conf.coin + " blockchain\n" +
							" - **" + conf.prefix + "stages** : get the info of the upcoming reward structures\n" +
							" - **" + conf.prefix + "earnings [amount of MNs]** : get the expected earnings per masternode, aditionally you can put the amount of MNs\n" +
							" - **" + conf.prefix + "mining <hashrate> [K/M/G/T]** : get the expected earnings with the given hashrate, aditionally you can put the hashrate multiplier (K = KHash/s, M = MHash/s, ...)\n" +
							" - **" + conf.prefix + "addnodes** : get a addnodes list for the chain sync"
					},
					{
						name: "User Masternode",
						value:
							" - **" + conf.prefix + "my-masternode-add <address>** : adds a masternode address to your address list\n" +
							" - **" + conf.prefix + "my-masternode-del <address>** : removes a masternode address from your address list\n" +
							" - **" + conf.prefix + "my-masternode-list** : show all your listed masternode addresses and their status\n" +
							" - **" + conf.prefix + "my-earnings** : shows your total earnings"
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
							" - **" + conf.prefix + "conf-set** : set a new config to the bot via dm"
					}
				]
			}
		});
	}
	about() {
		const donate = { // don't be evil with this, please
			"BTC": "3F6J19DmD5jowwwQbE9zxXoguGPVR716a7",
			"MCPC": "MCwe8WxWNmcZL1CpdpG3yuudGYVphmTSLE"
		};
		this.fn_send({
			embed: {
				title: "About",
				color: conf.color.about,
				description: "**Author:** <@464599914962485260>\n" +
					"**Source Code:** [Link](https://github.com/neo3587/discord_cryptobot)\n" +
					"**Description:** A simple bot for " + conf.coin + " to check the current status of the currency in many ways, use **!help** to see these ways\n" +
					(conf.coin in donate ? "**" + conf.coin + " Donations (to author):** `" + donate[conf.coin] + "`\n" : "") +
					"**BTC Donations (to author):** `" + donate.BTC + "`"
			}
		});
	}

	conf_get() {
		this.fn_send("<@" + this.msg.author.id + "> check the dm I just sent to you :wink:");
		this.msg.author.send({ files: [config_json_file] });
	}
	conf_set() {
		this.fn_send("<@" + this.msg.author.id + "> check the dm I just sent to you :kissing_heart:");
		this.msg.author.send("Put the config.json file here and I'll update myself with the changes, don't send any message, just drag and drop the file, you have 90 seconds to put the file or you'll have to use **!conf-set** again").then(reply => {
			let msgcol = new Discord.MessageCollector(reply.channel, m => m.author.id === this.msg.author.id, { time: 90000 });
			msgcol.on("collect", async (elem, col) => {
				msgcol.stop("received");
				if (elem.attachments.array()[0]["filename"] !== "config.json") {
					this.msg.author.send("I requested a file called 'config.json', not whatever is this :expressionless: ");
					return;
				}
				try {
					let conf_res = await async_request(elem.attachments.array()[0]["url"]);
					conf_res = conf_res.slice(conf_res.indexOf("{"));
					JSON.parse(conf_res); // just check if throws
					fs.writeFileSync(config_json_file, conf_res);
					this.fn_send("Config updated by <@" + this.msg.author.id + ">, if something goes wrong, it will be his fault :stuck_out_tongue:\nRebooting the bot to apply the new config").then(() => process.exit());
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


const config_json_file = path.dirname(process.argv[1]) + "/config.json";
const users_mn_folder = path.dirname(process.argv[1]) + "/.db_users_mn";
/** @type {Configuration} */
const conf = require(config_json_file);
const client = new Discord.Client();
const shared = new SharedData();



function start_monitor() {

	if (conf.monitor !== undefined && conf.monitor.enabled === true) {

        const channel = client.channels.get(conf.monitor.channel);
        let embeds = [];
        let cmd = new BotCommand(undefined, txt => embeds.push(txt));

		const refresh_monitor = async () => {
			
            embeds = [];
			await cmd.price();
			await cmd.stats();
			await cmd.earnings();

            await channel.bulkDelete(50);
            for (let emb of embeds)
                await channel.send(emb);
		};
		
        refresh_monitor().then(() => client.setInterval(() => refresh_monitor(), conf.monitor.interval * 1000)).catch(async e => {
            switch (e.code) {
                case 50001:
                    console.log("\x1b[33mThe bot doesn't have permissions to READ MESSAGES from the monitor channel\x1b[0m");
                    break;
                case 50013:
                    console.log("\x1b[33mThe bot doesn't have permissions to SEND and/or MANAGE MESSAGES from the monitor channel\x1b[0m");
                    break;
                case 50034:
                    console.log("\x1b[33mSome messages of the monitor channel are >14 days old, it may take a while to delete them all\x1b[0m");
                    let msgs = await channel.fetchMessages({ limit: 1 });
                    while (msgs.size > 0) {
                        await msgs.last().delete();
                        msgs = await channel.fetchMessages({ limit: 1 });
                    }
                    start_monitor();
                    break;
                default:
                    console.log("Uknown error with the monitor:");
                    console.log(e);
                    break;
            }
        });
	}

	if (conf.channel_monitor !== undefined && conf.channel_monitor.enabled === true) {

		const fns = conf.channel_monitor.data.map(x => {
			let channel = client.guilds.first().channels.get(x.channel);
			let fn = async () => { };

			switch (x.type) {
				case "blockcount":
					fn = async () => await shared.blockcount().then(blk => x.type + ": " + blk);
					break;
				case "mncount":
					fn = async () => await shared.mncount().then(cnt => x.type + ": " + cnt);
					break;
				case "ticker":
					fn = async () => await shared.get_ticker(x.exchange).then(tck => x.exchange + ": " + tck.price);
					break;
			}
			return { fn: fn, channel: channel };
		});

		

		const refresh_monitor = async () => {
			fns.forEach(x => x.fn().then(res => x.channel.setName(res)));
		};

		refresh_monitor().then(() => client.setInterval(() => refresh_monitor(), conf.monitor.interval * 1000)).catch(async e => {
			switch (e.code) {
				//case 50013:
					//console.log("\x1b[33mThe bot doesn't have permissions to SEND and/or MANAGE CHANNELS from the monitor channel\x1b[0m");
					//break;
				default:
					console.log("Uknown error with the channel monitor:");
					console.log(e);
					break;
			}
		});
	}
}
function configure_systemd(name) {
    if (process.platform === "linux") {
        let service = "[Unit]\n" +
            "Description=" + name + " service\n" +
            "After=network.target\n" +
            "\n" +
            "[Service]\n" +
            "User=root\n" +
            "Group=root\n" +
            "ExecStart=" + process.argv[0] + " " + process.argv[1] + "\n" +
            "Restart=always\n" +
            "\n" +
            "[Install]\n" +
            "WantedBy=multi-user.target";

        fs.writeFileSync("/etc/systemd/system/" + name + ".service", service);
        bash_cmd("chmod +x /etc/systemd/system/" + name + ".service");
        bash_cmd("systemctl daemon-reload");
        bash_cmd("systemctl start " + name + ".service");
        bash_cmd("systemctl enable " + name + ".service");

        console.log("Start:              \x1b[1;32msystemctl start   " + name + ".service\x1b[0m");
        console.log("Stop:               \x1b[1;32msystemctl stop    " + name + ".service\x1b[0m");
        console.log("Start on reboot:    \x1b[1;32msystemctl enable  " + name + ".service\x1b[0m");
        console.log("No start on reboot: \x1b[1;32msystemctl disable " + name + ".service\x1b[0m");
        console.log("Status:             \x1b[1;32msystemctl status  " + name + ".service\x1b[0m");

        console.log("Current status: Running and Start on reboot");
    }
    else {
        console.log("Can't run on background in non-linux systems");
    }
    process.exit();
}
function valid_request(req) {
    return conf.requests[req] !== undefined && conf.requests[req].trim() !== "";
}
function earn_fields(coinday, avgbtc, priceusd) {
    const earn_value = (mult) => {
        return (coinday * mult).toFixed(4) + " " + conf.coin + "\n" +
            (coinday * mult * avgbtc).toFixed(8) + " BTC\n" +
            (coinday * mult * avgbtc * priceusd).toFixed(2) + " USD";
    };
    return [
        {
            name: "Daily",
            value: earn_value(1),
            inline: true
        },
        {
            name: "Weekly",
            value: earn_value(7),
            inline: true
        },
        {
            name: "Monthly",
            value: earn_value(30),
            inline: true
        },
        {
            name: "Yearly",
            value: earn_value(365),
            inline: true
        }
    ];
}
function get_stage(blk) {
    for (let stage of conf.stages)
        if (blk <= stage.block)
            return stage;
    return conf.stages[conf.stages.length - 1];
}
function async_request(url) {
    return new Promise((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.open("GET", url);
        req.onreadystatechange = () => {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    try {
                        resolve(req.responseText);
                        return;
                    }
                    catch (e) { /**/ }
                }
                reject(req.statusText);
            }
        };
        req.send();
    });
}
function bash_cmd(cmd) {
    return (process.platform === "win32" ? spawnSync("cmd.exe", ["/S", "/C", cmd]) : spawnSync("sh", ["-c", cmd])).stdout.toString();
}
function create_no_exists(path, file = false) {
    if (!fs.existsSync(path)) {
        if (file)
            fs.writeFileSync(path, "");
        else
            fs.mkdirSync(path);
    }
}
function simple_message(title, descr, color = conf.color.error) {
    return {
        embed: {
            title: title,
            color: color,
            description: descr,
            timestamp: new Date()
        }
    };
}


function handle_child() {
    let child = spawn(process.argv[0], [process.argv[1], "handled_child"], { stdio: ["ignore", process.stdout, process.stderr, "ipc"] });
    child.on("close", (code, signal) => {
        child.kill();
        for (let i = 5; i > 0; i--) {
            console.log("Restarting bot in " + i + " seconds..."); // just to avoid constant reset in case of constant crash cause network is down
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
        }
        handle_child();
    });
    child.on("disconnect", () => child.kill());
    child.on("error", () => child.kill());
    child.on("exit", (code, signal) => child.kill());
}

process.on("uncaughtException", err => {
    console.log("Global exception caught:");
    console.log("Name: " + err.name);
    console.log("Message: " + err.message);
    console.log("Stack:" + err.stack);
    process.exit();
});
process.on("unhandledRejection", err => {
    console.log("Global rejection handled:");
    console.log("Name: " + err.name);
    console.log("Message: " + err.message);
    console.log("Stack:" + err.stack);
    process.exit();
});
client.on("message", msg => {

    if (conf.channel.length && !conf.channel.includes(msg.channel.id) || !msg.content.startsWith(conf.prefix) || msg.author.bot)
        return;

    let args = msg.content.slice(conf.prefix.length).split(/[ \r\n]/).filter(x => x.length);
    let cmd = new BotCommand(msg);

    const error_noparam = (n, descr) => {
        if (args.length > n)
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
    const enabled_cmd = (name, valid) => {
        if (valid)
            return true;
        msg.channel.send({
            embed: {
                title: "**" + conf.prefix + name + " command**",
                color: conf.color.warning,
                description: conf.prefix + name + " disabled in the bot configuration"
            }
        });
        return false;
    };

    switch (args[0]) {

        // Exchanges:

        case "price": {
            cmd.price();
            break;
        }

        // Coin Info:

        case "stats": {
            if (enabled_cmd("stats", valid_request("blockcount") || valid_request("mncount") || valid_request("supply")))
                cmd.stats();
            break;
        }
        case "stages": {
            if (enabled_cmd("stages", valid_request("blockcount")))
                cmd.stages();
            break;
        }
        case "earnings": {
            if (enabled_cmd("earnings", valid_request("blockcount") && valid_request("mncount")))
                cmd.earnings(args[1]);
            break;
        }
        case "mining": {
            if (enabled_cmd("mining", valid_request("blockcount") && valid_request("hashrate")) && !error_noparam(1, "You need to provide amount of hashrate"))
                cmd.mining(args[1], args[2]);
            break;
        }
        case "addnodes": {
            if (enabled_cmd("addnodes", valid_request("addnodes")))
                cmd.addnodes();
            break;
        }

        // User masternodes:

        case "my-masternode-add": {
            if (enabled_cmd("my-masternode-add", conf.useraddrs || valid_request("mnstat") || valid_request("blockcount") || valid_request("mncount")) && !error_noparam(1, "You need to provide at least one address"))
                cmd.my_masternode_add(args.slice(1));
            break;
        }
        case "my-masternode-del": {
            if (enabled_cmd("my-masternode-del", conf.useraddrs || valid_request("mnstat") || valid_request("blockcount") || valid_request("mncount")) && !error_noparam(1, "You need to provide at least one address"))
                cmd.my_masternode_del(args.slice(1));
            break;
        }
        case "my-masternode-list": {
            if (enabled_cmd("my-masternode-list", conf.useraddrs || valid_request("mnstat") || valid_request("blockcount") || valid_request("mncount")))
                cmd.my_masternode_list();
            break;
        }
        case "my-earnings": {
            if (enabled_cmd("my-earnings", conf.useraddrs || valid_request("mnstat") || valid_request("blockcount") || valid_request("mncount")))
                cmd.my_earnings();
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
            msg.channel.send(simple_message("Answer to life, the universe and everything", "42", conf.color.about));
            break;
        }
        case "price-go-to-the-moon": { // easter egg
            msg.channel.send(simple_message("**Price Ticker**", "**All Exchanges: ** One jillion satoshis", conf.color.price));
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

});


if (process.argv.length >= 3 && process.argv[2] === "background")
    configure_systemd("discord_cryptobot");
else if (process.argv.length >= 3 && process.argv[2] === "handled_child")
    client.login(conf.token).then(() => {
        console.log("Bot ready!");
		start_monitor();
    });
else
	handle_child();
