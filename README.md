# Discord CryptoBot

A discord bot originally made for BCARD, and reworked to work with SNO, it can be easily adapted for any other currency.

# Currently supported exchanges

- Cryptobridge
- Crex24
- CoinExchange
- Graviex
- (more soon)

# How to install

The bot runs on Node.js, version 8.x or higher is recommended, it can be obtained here: https://nodejs.org/en/
The bot can run on any machine, but the commands !stats, !earnings, !block-index and !block-hash will only work if there's a wallet that accepts RPC commands (per example the typical masternode on a Linux machine).
In case of using a Linux masternode for running the bot, you can install Node.js with these 2 commands:
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

# Notes

The token on config.json is not the real one for obvious reasons, use the yours to work with your discord server.
(full guide to understand every parameter of the config.json and every command soon)

# Additional

```
BTC Donations: 3HE1kwgHEWvxBa38NHuQbQQrhNZ9wxjhe7

BCARD Donations: BQmTwK685ajop8CFY6bWVeM59rXgqZCTJb

SNO Donations: SZ4pQpuqq11EG7dw6qjgqSs5tGq3iTw2uZ
```

A big thanks to https://github.com/discordjs/discord.js/ for this amazing library for interfacing with the discord API
