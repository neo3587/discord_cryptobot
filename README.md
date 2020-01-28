# Discord CryptoBot

A discord bot to display the price of a cryptocurrency in every listed exchange, blockchain stats, expected earnings, etc.

** Special note: In the following weeks, there will be changes that will significantly change the config.json structure **

# Index

- [How to install](#how-to-install)
- [Bot commands](#bot-commands)
- [Bot configuration](#bot-configuration)
- [Currently supported exchanges](#currently-supported-exchanges)
- [Image examples](#image-examples)
- [Additional](#additional)

# <a name = "how-to-install"></a> How to install

First, you can use this guide to crate the bot: https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/

The bot runs on Node.js, version 8.x or higher is recommended, it can be obtained here: https://nodejs.org/en/ 

The bot can run on any machine, but it's recommended to use a linux machine, since some commands may require a wallet that accepts RPC commands (almost all the commands can be run by calling the explorer API with `curl -s`).
In case of using a Linux machine for running the bot, you can install Node.js with these 2 commands:
```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
```
After installing Node.js, you'll need to install these 2 dependencies with the commands:
```
npm install discord.js
npm install xmlhttprequest
```
Modify the config.json to fit with your currency.

Finally, run the bot with:
```
node bot.js
```
Optionally you can run the bot on background with:
```
node bot.js background
```

# <a name = "bot-commands"></a> Bot commands

- **`!price:`** Shows the last price, volume (in BTC), ask, bid and a link to the exchange for every exchange where the coin is listed.
  
- **`!stats:`** Shows the block count, MN count, supply, collateral, MN reward, POS reward, Locked coins and agerage MN reward frecuency.
- **`!stages:`** Shows the upcoming reward structure changes.
- **`!earnings [amount_on_mns]`:** Shows the ROI (in percentage and days), the MN price, the daily/weekly/monthly/yearly earnings for your cryptocurrency and optionally you can input the amount of mns to calculate the earnings.
- **`!mining <number> [K/M/G/T]`:** Shows the expected earnings with the given hashrate, optionally you can use K,M,G or T to indicate the multiplier, example: ```!mining 500``` => asks for 500 H/s, ```!mining 20 M``` => asks for 20 MH/s, etc.
  
- **`!my-masternode-add <address>`:** Adds the given address to the user assigned masternode addresses list.
- **`!my-masternode-del <address>`:** Removes the given address from the user assigned masternode addresses list.
- **`!my-mastenode-list:`** Shows the user masternode addresses list and their status.
- **`!my-earnings:`** Shows the user expected earnings.
  
- **`!help:`** Shows every available command.
- **`!about:`** Shows the bot info.
  
- **`!conf-get:`** Receive a dm with the config file, requires devs permissions (see **Bot configuration**).
- **`!conf-set:`** Receive a dm asking to drag and drop a update of the config file, requires devs permissions (see **Bot configuration**).

*Note:* `<parameter>` *means required,* `[parameter]` *means optional*

# <a name ="bot-configuration"></a> Bot configuration

You'll have to modify the "config.json" file to make it fit with your cryptocurrency, there's a list of every parameter:

- **ticker:** Here is where you put the name of every exchange where you're listed, the name be equal (uppercases not necessary but recommended) to the names from **Currently supported exchanges**, follow this scheme to add the links of the API and the market: 
```
"ticker": [
    "Crex24",
    "Graviex",
    ["Crex24", "BTC", "USD"]  // optionally you can set custom pairs like this
]
```
- **color:** Just the color of the embed messages.
- **devs:** List of the unique discord ids from the people who have permisions to use **!conf-get** and **!conf-set**.
- **stages:** List of every stage of the coin (MN/POS rewards and collateral from block X to Y), it follows this scheme: 
```
"stages": [
    {
      "block": 18000, // from block 0 to 18000
      "coll": 1000, // collateral = 1000 coins
      "mn": 9.50, // MN reward = 9.50 coins
      "pow": 0.50 // POW reward = 0.50 coins
    },
    {
      "block": 36000, // from block 18001 to 36000
      "coll": 2000, // collateral increased to 2000 coins
      "mn": 14.25,
      "pow": 0.35,
      "pos": 0.35   // POS reward added on this stage
    },
    {
      "block": -1, // from block 36001 to infinite
      "coll": 2000, // collateral didn't changed, but you have to put the value anyway
      "mn": 4.75,
      "pos": 0.25  // POW deleted on this stage, only POS remains
    }
]
```
- **requests:** The bash commands used to get the data for most of the commands. Leaving a empty string or removing the parameter will block partially or completely the commands that makes use of the empty data. It's expected to use RPC commands and explorer urls, but you can customize them to retrieve the data from other sources (Example: "blockcount": "customProgramToGetBlockCount.exe"), example of typical requests:
<pre>
"requests": {
    "blockcount": "mywalletname-cli getblockcount",
    "mncount":    "mywalletname-cli masternode count,
    "supply":     "curl -s http://mycoinexplorer.com/ext/getmoneysupply", 
    "hashrate":   "curl -s http://mycoinexplorer.com/api/getnetworkhashps",
    "mnstat":     "mywalletname-cli masternode list",  // some wallets may require a custom script instead
    "addnodes":   "mywalletname-cli getpeerinfo"
}
Important note if you customize the requests: 
    - "blockcount"  must return a string convertible into a number.
    - "mncount"     must return a string convertible into a number.
    - "supply"      must return a string convertible into a number.
    - "hashrate":   expects to receive a string convertible into a number.
    - "mnstat":     expects a json with "addr" and "status" attributes.
    - "addnodes":   expects a json array of objects with a "addr" attribute.
</pre>
- **statorder**: Order of the <b>!stats</b> values, you can even remove some of them if you don't want them to be displayed, adding a empty string **""** will put a blank space as if it were a offset. Available values: 
```
"statorder": [
    "blockcount",  // requires requests.blockcount
    "mncount",     // requires requests.mncount
    "supply",      // requires requests.supply
    "collateral",  // requires requests.blockcount
    "mnreward",    // requires requests.blockcount
    "powreward",   // requires requests.blockcount
    "posreward",   // requires requests.blockcount
    "locked",      // requires requests.blockcount, requests.mncount and requests.supply
    "1streward",   // requires requests.mncount
    "avgmnreward", // requires requests.mncount
    "nextstage"    // requires requests.blockcount
  ]
```
- **monitor**: Use separate channel where only the bot have permission to send messages to post every X time the price, stats and earnings. It follows this scheme:
```
"monitor": {
    "enabled": true,
    "channel": "531519255519428638", // channel id where the bot will post the info    
    "interval": 60                   // refresh the data every 60 seconds
}
```
- **channel_monitor**: Use some locked voice channels where the users doesn't have connect permisions and the bot have edit persmisions to post every X time a custom set of stats. It follows this scheme:
```
"channel_monitor": {
    "enabled": true,
    "interval": 60,                      // refresh the data every 60 seconds
    "data": [
      {
				"channel": "671084902195658762", // channel id where the bot will change it's name for info
				"type": "ticker",                // info type, it can be either: ticker, blockcount or mncount
				"exchange": "Crex24"             // exchange name, only for "ticker" type
			},
			{
				"channel": "671085710974910570",
				"type": "ticker",
				"exchange": "Graviex"
			},
			{
				"channel": "671085807582576650",
				"type": "blockcount"
			},
			{
				"channel": "671085828436656128",
				"type": "mncount"
			}
    ]
}
```
- **hidenotsupported**: Hide the ticker values from exchanges APIs that doesn't support that feature instead of showing "Not Supported".
- **usermns:** Enable the user masternode commands (`!my-masternode-add`, `!my-masternode-del`, `!my-masternode-list`, `!my-balance`).
- **channel:** List of the ids of the channels where the bot will listen and reply the commands (leaving the list empty will listen all the channels).
- **prefix:** The initial character for the commands.
- **coin:** The name of your coin.
- **tickrate**: API calls minimum refresh time (price check, coin supply, masternode count, ...).
- **blocktime:** Block time in seconds (used for some calculations).
- **token:** The token of your bot.

*NOTE: The config.json of the repo is made for MCPC, you can use it as a template for your coin and discord server*

# <a name = "currently-supported-exchanges"></a> Currently supported exchanges

- Crex24
- Graviex
- Stex [¹](#currently-supported-exchanges-tags)
- HitBTC [⁴](#currently-supported-exchanges-tags)
- YoBit [⁴](#currently-supported-exchanges-tags)
- Bittrex [³](#currently-supported-exchanges-tags)
- SouthXchange
- Exrates
- Binance
- Bitfinex [¹](#currently-supported-exchanges-tags)
- Coinex [¹](#currently-supported-exchanges-tags)
- P2PB2B
- CoinsBit
- TradeSatoshi
- CoinBene [³](#currently-supported-exchanges-tags)
- Finexbox [¹⁴](#currently-supported-exchanges-tags)
- Midex
- CryptoHubExchange
- Altmarkets [⁴](#currently-supported-exchanges-tags)

<a name = "currently-supported-exchanges-tags"></a>
*1. BTC volume not 100% accurate*  
*2. BTC volume not supported*  
*3. 24h change not 100% accurate*  
*4. 24h change not supported*  
*NOTE: The non-supported or not 100% accurate features are due to the exchange API.*  
*NOTE 2: Feel free to ask for adding support to a specific exchange.*


# <a name = "image-examples"></a> Image examples

<img src="https://i.imgur.com/H9QgiNq.png" /> 
<img src="https://i.imgur.com/svbb9Iy.png" /> 
<img src="https://i.imgur.com/HH1DEZH.png" /> 
<img src="https://i.imgur.com/ikZt4ec.png" />
<img src="https://i.imgur.com/iOiz5KJ.png" />

# <a name = "additional"></a> Additional

If you're too lazy or just not sure how to make a profile, I can make one for your cryptocurrency for a very tiny fee.

```
BTC Donations:   3F6J19DmD5jowwwQbE9zxXoguGPVR716a7
ETH Donations:   0x7F9D6d654aEb3375A2974294a0911223d5d1DA52
LTC Donations:   MToq5nZkGh9TWpfQAEjue8ERFcaz6GFB57
DOGE Donations:  DK19TK7gex1j5gfJ5bebXcnCmwUjbhMHST
MCPC Donations:  MCwe8WxWNmcZL1CpdpG3yuudGYVphmTSLE
```

A big thanks to https://github.com/discordjs/discord.js for this amazing library for interfacing with the discord API.
