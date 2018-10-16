# Discord CryptoBot

A discord bot originally made for BCARD, and reworked to work with SNO, it can be easily adapted for any other currency.

# How to install

First, you can use this guide to crate the bot: https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/

The bot runs on Node.js, version 8.x or higher is recommended, it can be obtained here: https://nodejs.org/en/ 

The bot can run on any machine, but the commands **!stats**, **!earnings**, **!block-index** and **!block-hash** will only work if there's a wallet that accepts RPC commands (per example the typical masternode on a Linux machine) or you make your way with urls or customized programs.
In case of using a Linux machine for running the bot, you can install Node.js with these 2 commands:
```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt - get install - y nodejs
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

# Bot commands

- **!price:** Shows the last price, volume (in BTC), ask, bid and a link to the exchange for every exchange where the coin is listed.
- **!stats:** Shows the block count, MN count, supply, collateral, MN reward, POS reward, Locked coins and agerage MN reward frecuency.
- **!earnings:** Shows the ROI (in percentage and days) and the daily/weekly/monthly/yearly earnings of your cryptocurrency.
- **!balance ```<address>```:** Shows the sent, received and current balance of the given address.
- **!block-index ```<number>```:** Shows the block stats of the given block number.
- **!block-hash ```<hash>```:** Shows the block stats of the given block hash.
- **!help:** Shows every available command.
- **!about:** Shows the bot info.
- **!conf-get:** Receive a dm with the config file, requires devs permissions (see **Bot configuration**).
- **!conf-set:** Receive a dm asking to drag and drop a update of the config file, requires devs permissions (see **Bot configuration**).

# Bot configuration

You'll have to modify the "config.json" file to make it fit with your cryptocurrency, there's a list of every parameter:

- **ticker:** Here is where you put the name of every exchange where you're listed, the name MUST be exactly equal (uppercases included) to the names from **Currently supported exchanges**, follow this scheme to add the links of the API and the market: 
```
"ticker": [
    "CryptoBridge",
    "Crex24",
    "CoinExchange"
]
```
- **special_ticker:** CoinExchange requires a specific market id from https://www.coinexchange.io/api/v1/getmarkets to get a filtered ticker, not necessary to touch this if you don't use this exchange.
- **color:** Just the color of the embed messages.
- **devs:** List of the unique discord ids from the people who have permisions to use **!conf-get** and **!conf-set**.
- **stages:** List of every stage of the coin (MN/POS rewards and collateral from block X to Y), it follows this scheme: 
```
"stages": [
    "stages": [
    {
      "block": 18000, // from block 0 to 18000
      "coll": 1000, // collateral = 1000 coins
      "mn": 9.50, // MN reward = 10.50 coins
      "pos": 0.50 // POS reward = 0.50 coins
    },
    {
      "block": 36000, // from block 18001 to 36000
      "coll": 2000, // collateral increased to 2000 coins
      "mn": 14.25,
      "pos": 0.75
    },
    {
      "block": -1, // from block 36001 to infinite
      "coll": 2000, // collateral didn't changed, but you have to put the value anyway
      "mn": 4.75,
      "pos": 0.25
    }
]
```
- **requests:** The bash commands and/or urls used to get the data for **!stats**, **!earnings**, **!balance**, **!block-index** and **!block-hash**. Leaving a empty string will block the bot commands that makes use of the data. It's expected to use RPC commands and explorer urls, but you can customize them to retrieve the data from other sources. Example:
<pre>
"requests": {
    "blockcount": "mywalletname-cli getblockcount",    // change for: "curl http://mycoinexplorer.com/api/getblockcount" 
    "mncount":    "mywalletname-cli masternode count", // change for: "customprogramMNcount.exe" 
    "supply":     "curl http://mycoinexplorer.com/ext/getmoneysupply", // change for: "customprogram2 supply"
    "balance":    "curl http://mycoinexplorer.com/ext/getaddress/",    // change for: "" and <b>!balance</b> will be blocked
    "blockindex": "mywalletname-cli getblockhash",     // etc...
    "blockhash":  "mywalletname-cli getblock
}
Important note if you customize the requests: 
    - "blockcount" must return a string convertible into a number.
    - "mncount" must return a json type string with a number or string in a attribute called "enabled".
    - "supply" must return a string convertible into a number.
    - "balance" expects to receive a string (the address) and must return a json type string with a number or string in three attributes called "sent", "received" and "balance".
    - "blockindex": expects to receive a string convertible into a number and must return a string that indicates the block hash of the given block number.
    - "blockhash": expects to receive a string (the hash) and must return a json type string with the attributes "height": (block number), "hash": (block hash), "confirmations": (number), "size": (size of the block), "previousblockhash": (last block hash), "nextblockhash": (next block hash) and "tx": [ (list of the block transactions) ].
</pre>
- **hidenotsupported**: Hide the ticker values from exchanges APIs that doesn't support that feature instead of showing "Not Supported".
- **sourcecode:** You don't need to touch this, it's just in case I change the repo in the future.
- **channel:** The id of the channel where the bot will read and reply the commands.
- **prefix:** The initial character for the commands.
- **coin:** The name of your coin.
- **blocktime:** Block time in seconds (used to calculate the earnings).
- **token:** The token of your bot.

NOTE: The token on config.json is just an example, not the real one (for obvious reasons), use yours to work with your discord server.

# Currently supported exchanges

- CryptoBridge
- Crex24
- CoinExchange
- Graviex
- Escodex
- Cryptopia
- Stex
- C-CEX
- HitBTC
- YoBit
- Bittrex
- (more soon)

# Additional

```
BTC Donations: 3HE1kwgHEWvxBa38NHuQbQQrhNZ9wxjhe7

BCARD Donations: BQmTwK685ajop8CFY6bWVeM59rXgqZCTJb

SNO Donations: SZ4pQpuqq11EG7dw6qjgqSs5tGq3iTw2uZ
```

A big thanks to https://github.com/discordjs/discord.js for this amazing library for interfacing with the discord API.
